import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useNavigate } from 'react-router-dom';
import { HierarchyNode, NodeType, DropPosition } from '@/types/node';
import { 
  createNode,
  cloneTree,
  findNode, 
  insertNode, 
  deleteNode,
  deleteNodeAndPromoteChildren, 
  updateNode, 
  moveNode, 
  indentNode, 
  outdentNode, 
  toggleCollapse, 
  flattenTree, 
  getSiblings, 
  getNodeIndex,
} from '@/lib/nodeOperations';
import { SimpleOutlineView } from './SimpleOutlineView';
import { VirtualizedOutline, useVirtualizationEnabled } from './VirtualizedOutline';
import { RevealCodes } from './RevealCodes';
import { FindReplaceMatch, FindReplaceProvider, useEditorContext } from './EditorContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Trash2, Minimize2, Maximize2, ExternalLink, Upload, Link2, Play, Loader2 } from 'lucide-react';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { getOutlinePrefix, getOutlinePrefixCustom } from '@/lib/outlineStyles';
import { FlatNode } from '@/types/node';

// Lazy load heavy dialogs
const ImportOutlineDialog = lazy(() => import('./ImportOutlineDialog').then(m => ({ default: m.ImportOutlineDialog })));
const LinkDocumentDialog = lazy(() => import('./LinkDocumentDialog').then(m => ({ default: m.LinkDocumentDialog })));
const SpritzerDialog = lazy(() => import('./SpritzerDialog').then(m => ({ default: m.SpritzerDialog })));

interface HierarchyBlockViewProps extends NodeViewProps {
  updateAttributes: (attrs: Record<string, any>) => void;
}

export function HierarchyBlockView({ node, deleteNode: deleteBlockNode, selected }: HierarchyBlockViewProps) {
  const blockId = node.attrs.blockId as string;
  const navigate = useNavigate();
  // Get settings from context
  const {
    outlineStyle,
    mixedConfig,
    autoDescend,
    showRevealCodes,
    showRowHighlight,
    registerUndoRedo,
    registerFindReplaceProvider,
    unregisterFindReplaceProvider,
    setOnPasteHierarchy,
    updateHierarchyBlock,
    removeHierarchyBlock,
    document,
    navigateToDocument,
    // Entity data for Adaptive Cognitive Pacing
    terms,
    dates,
    people,
    places,
  } = useEditorContext();
  
  // Compute initial tree: prefer saved data from document, fallback to empty node
  const [{ initialTree, firstNodeId }] = useState(() => {
    // Check if document has saved hierarchy data for this block
    // hierarchyBlocks stores HierarchyBlockData: { id, tree }
    const savedBlock = document?.hierarchyBlocks?.[blockId];
    const savedTree = savedBlock?.tree;
    if (savedTree && Array.isArray(savedTree) && savedTree.length > 0) {
      return { initialTree: savedTree as HierarchyNode[], firstNodeId: savedTree[0].id };
    }
    // No saved data, create empty tree
    const node = createNode(null, 'default', '');
    return { initialTree: [node], firstNodeId: node.id };
  });
  
  // Use session storage for tree persistence keyed by blockId
  const [tree, setTreeState] = useSessionStorage<HierarchyNode[]>(`outline-tree:${blockId}`, initialTree);
  const treeRef = useRef<HierarchyNode[]>(tree);
  const [selectedId, setSelectedId] = useState<string | null>(() => tree[0]?.id ?? firstNodeId);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(() => tree[0]?.id ?? firstNodeId);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  // Relink dialog state for fixing broken link nodes
  const [relinkDialogOpen, setRelinkDialogOpen] = useState(false);
  const [relinkNodeId, setRelinkNodeId] = useState<string | null>(null);
  // Spritz reader dialog state
  const [spritzerOpen, setSpritzerOpen] = useState(false);
  // Section-targeted action state
  const [targetSectionId, setTargetSectionId] = useState<string | null>(null);

  useEffect(() => {
    treeRef.current = tree;
    // Sync tree to document context for usage scanning
    updateHierarchyBlock(blockId, tree);
  }, [tree, blockId, updateHierarchyBlock]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      removeHierarchyBlock(blockId);
    };
  }, [blockId, removeHierarchyBlock]);

  // Undo/Redo history
  const historyRef = useRef<HierarchyNode[][]>([initialTree]);
  const historyIndexRef = useRef(0);
  const isUndoRedoRef = useRef(false);

  const setTree = useCallback((updater: HierarchyNode[] | ((prev: HierarchyNode[]) => HierarchyNode[])) => {
    setTreeState(prev => {
      const nextState = typeof updater === 'function' ? updater(prev) : updater;
      
      // Don't add to history if this is an undo/redo operation
      if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return nextState;
      }
      
      // Truncate any future history if we're not at the end
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
      
      // Add new state to history
      historyRef.current.push(nextState);
      
      // Limit history size to 50
      if (historyRef.current.length > 50) {
        historyRef.current = historyRef.current.slice(-50);
      }
      
      historyIndexRef.current = historyRef.current.length - 1;
      
      return nextState;
    });
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      isUndoRedoRef.current = true;
      setTreeState(historyRef.current[historyIndexRef.current]);
      return true;
    }
    return false;
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      isUndoRedoRef.current = true;
      setTreeState(historyRef.current[historyIndexRef.current]);
      return true;
    }
    return false;
  }, []);

  // Register undo/redo with context
  useEffect(() => {
    const canUndo = historyIndexRef.current > 0;
    const canRedo = historyIndexRef.current < historyRef.current.length - 1;
    registerUndoRedo(undo, redo, canUndo, canRedo);
  }, [undo, redo, registerUndoRedo, tree]);

  // Register this outline as a Find/Replace search provider
  useEffect(() => {
    const providerId = `hierarchy:${blockId}`;

    const replaceAllOccurrences = (
      text: string,
      needle: string,
      replacement: string,
      cs: boolean
    ): { next: string; count: number } => {
      if (!needle) return { next: text, count: 0 };

      const hay = cs ? text : text.toLowerCase();
      const ndl = cs ? needle : needle.toLowerCase();

      let idx = 0;
      let count = 0;
      let out = '';

      while (true) {
        const at = hay.indexOf(ndl, idx);
        if (at === -1) {
          out += text.slice(idx);
          break;
        }
        out += text.slice(idx, at) + replacement;
        idx = at + needle.length;
        count += 1;
      }

      return { next: out, count };
    };

    const provider: FindReplaceProvider = {
      id: providerId,
      label: 'Outline',
      find: (term, cs) => {
        const matches: FindReplaceMatch[] = [];
        const flat = flattenTree(treeRef.current);
        const needle = cs ? term : term.toLowerCase();

        flat.forEach(n => {
          const label = n.label ?? '';
          const hay = cs ? label : label.toLowerCase();
          let idx = 0;

          while (true) {
            const at = hay.indexOf(needle, idx);
            if (at === -1) break;
            matches.push({
              kind: 'hierarchy',
              providerId,
              nodeId: n.id,
              start: at,
              end: at + term.length,
            });
            idx = at + Math.max(1, term.length);
          }
        });

        return matches;
      },
      focus: (m) => {
        if (m.kind !== 'hierarchy') return;
        setIsCollapsed(false);
        setSelectedId(m.nodeId);
        setAutoFocusId(m.nodeId);

        // Expand collapsed ancestors to reveal match
        setTree(prev => {
          let next = prev;
          let cur = findNode(next, m.nodeId);
          while (cur?.parentId) {
            const parent = findNode(next, cur.parentId);
            if (parent?.collapsed) {
              next = toggleCollapse(next, parent.id);
            }
            cur = parent ?? null;
          }
          return next;
        });
      },
      replace: (m, replacement) => {
        if (m.kind !== 'hierarchy') return;
        setTree(prev => {
          const target = findNode(prev, m.nodeId);
          if (!target) return prev;
          const label = target.label ?? '';
          const nextLabel = label.slice(0, m.start) + replacement + label.slice(m.end);
          return updateNode(prev, m.nodeId, { label: nextLabel });
        });
      },
      replaceAll: (term, replacement, cs) => {
        let total = 0;
        setTree(prev => {
          let next = prev;
          const flat = flattenTree(prev);

          flat.forEach(n => {
            const label = n.label ?? '';
            const { next: nextLabel, count } = replaceAllOccurrences(label, term, replacement, cs);
            if (count > 0) {
              total += count;
              next = updateNode(next, n.id, { label: nextLabel });
            }
          });

          return next;
        });

        return total;
      },
    };

    registerFindReplaceProvider(provider);
    return () => unregisterFindReplaceProvider(providerId);
  }, [blockId, registerFindReplaceProvider, unregisterFindReplaceProvider, setTree, setSelectedId]);

  // Global keyboard handler (undo/redo only - reveal codes handled in Editor.tsx)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const flatNodes = flattenTree(tree);

  const addNode = useCallback((
    parentId: string | null = null,
    type: NodeType = 'default',
    label: string = '',
    afterNodeId?: string
  ) => {
    const newNode = createNode(parentId, type, label);

    setTree(prev => {
      const siblings = parentId
        ? (findNode(prev, parentId)?.children ?? [])
        : prev;

      const index = afterNodeId
        ? Math.max(0, getNodeIndex(siblings, afterNodeId) + 1)
        : siblings.length;

      return insertNode(prev, newNode, parentId, index);
    });

    setSelectedId(newNode.id);
    return newNode.id;
  }, []);

  const addChildNode = useCallback((parentId: string, type: NodeType = 'default', label: string = '') => {
    const newNode = createNode(parentId, type, label);

    setTree(prev => {
      const parent = findNode(prev, parentId);
      if (!parent) return prev;

      let next = insertNode(prev, newNode, parentId, parent.children.length);
      if (parent.collapsed) {
        next = toggleCollapse(next, parentId);
      }
      return next;
    });

    setSelectedId(newNode.id);
    return newNode.id;
  }, []);

  const removeNode = useCallback((nodeId: string) => {
    const nodeIndex = flatNodes.findIndex(n => n.id === nodeId);
    
    if (nodeIndex > 0) {
      setSelectedId(flatNodes[nodeIndex - 1].id);
    } else if (flatNodes.length > 1) {
      setSelectedId(flatNodes[1]?.id ?? null);
    } else {
      setSelectedId(null);
    }
    
    setTree(prev => deleteNodeAndPromoteChildren(prev, nodeId));
  }, [flatNodes]);

  const handleMove = useCallback((nodeId: string, targetId: string, position: DropPosition) => {
    if (nodeId === targetId) return;
    
    const targetNode = findNode(tree, targetId);
    if (!targetNode) return;
    
    let newParentId: string | null;
    let newIndex: number;
    
    if (position === 'inside') {
      newParentId = targetId;
      newIndex = targetNode.children.length;
    } else {
      newParentId = targetNode.parentId;
      const siblings = getSiblings(tree, targetId);
      const targetIndex = getNodeIndex(siblings, targetId);
      newIndex = position === 'before' ? targetIndex : targetIndex + 1;
    }
    
    setTree(prev => moveNode(prev, nodeId, newParentId, newIndex));
  }, [tree]);

  const handleIndent = useCallback((nodeId: string) => {
    setTree(prev => indentNode(prev, nodeId));
  }, []);

  const handleOutdent = useCallback((nodeId: string) => {
    setTree(prev => outdentNode(prev, nodeId));
  }, []);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setTree(prev => toggleCollapse(prev, nodeId));
  }, []);

  // Visual indent for body nodes (Block Tab feature)
  const handleVisualIndent = useCallback((nodeId: string, delta: number) => {
    setTree(prev => updateNode(prev, nodeId, { 
      visualIndent: Math.max(0, (findNode(prev, nodeId)?.visualIndent || 0) + delta)
    }));
  }, []);

  const navigateUp = useCallback(() => {
    if (!selectedId) {
      const first = flatNodes[0];
      if (first) {
        setSelectedId(first.id);
        setAutoFocusId(first.id);
      }
      return;
    }
    const currentIndex = flatNodes.findIndex(n => n.id === selectedId);
    if (currentIndex > 0) {
      const nextId = flatNodes[currentIndex - 1].id;
      setSelectedId(nextId);
      setAutoFocusId(nextId);
    }
  }, [selectedId, flatNodes]);

  const navigateDown = useCallback(() => {
    if (!selectedId) {
      const first = flatNodes[0];
      if (first) {
        setSelectedId(first.id);
        setAutoFocusId(first.id);
      }
      return;
    }
    const currentIndex = flatNodes.findIndex(n => n.id === selectedId);
    if (currentIndex < flatNodes.length - 1) {
      const nextId = flatNodes[currentIndex + 1].id;
      setSelectedId(nextId);
      setAutoFocusId(nextId);
    }
  }, [selectedId, flatNodes]);

  const handleUpdateLabel = useCallback((nodeId: string, label: string) => {
    setTree(prev => updateNode(prev, nodeId, { label }));
  }, []);

  // Merge node into previous sibling (or parent if no sibling) with line break
  const handleMergeIntoParent = useCallback((nodeId: string, currentValue?: string, showToast: boolean = true) => {
    const node = findNode(tree, nodeId);
    if (!node) {
      if (showToast) toast({ title: 'Merge failed', description: 'Could not find the selected line.' });
      return null;
    }

    const nodeLabel = (currentValue ?? node.label) ?? '';

    const flatIndex = flatNodes.findIndex(n => n.id === nodeId);
    if (flatIndex < 0) {
      if (showToast) toast({ title: 'Merge failed', description: 'Could not locate the line in the outline.' });
      return null;
    }

    const currentNode = flatNodes[flatIndex];

    // Find previous sibling at same depth
    let targetNode: { id: string; label: string } | null = null;

    for (let i = flatIndex - 1; i >= 0; i--) {
      const prevNode = flatNodes[i];
      if (prevNode.depth === currentNode.depth && prevNode.parentId === currentNode.parentId) {
        targetNode = { id: prevNode.id, label: prevNode.label };
        break;
      }
      if (prevNode.depth < currentNode.depth) {
        break;
      }
    }

    // If no previous sibling, try to merge into parent
    if (!targetNode && node.parentId) {
      const parent = findNode(tree, node.parentId);
      if (parent) {
        targetNode = { id: parent.id, label: parent.label };
      }
    }

    if (!targetNode) {
      // No toast for silent failures (like backspace at first line)
      return null;
    }

    // Append this node's label to target; if empty, create a blank new line
    const appended = nodeLabel.length > 0 ? `\n${nodeLabel}` : `\n`;
    const newLabel = `${targetNode.label ?? ''}${appended}`;

    setTree(prev => {
      const updated = updateNode(prev, targetNode!.id, { label: newLabel });
      return deleteNode(updated, nodeId);
    });

    setSelectedId(targetNode.id);

    if (showToast) {
      toast({ title: 'Merged', description: 'Merged into the line above.' });
    }

    return { targetId: targetNode.id, targetLabel: newLabel };
  }, [tree, flatNodes]);

  // Copy node and its children as a cloned subtree
  const handleCopyNode = useCallback((nodeId: string): HierarchyNode | null => {
    const node = findNode(tree, nodeId);
    if (!node) return null;
    return cloneTree(node);
  }, [tree]);

  // Paste nodes after the given node
  const handlePasteNodes = useCallback((afterId: string, nodesToPaste: HierarchyNode[]): string | undefined => {
    if (nodesToPaste.length === 0) return undefined;

    const afterNode = findNode(tree, afterId);
    if (!afterNode) return undefined;

    const parentId = afterNode.parentId;
    const siblings = getSiblings(tree, afterId);
    const afterIndex = getNodeIndex(siblings, afterId);

    let lastInsertedId: string | undefined;

    setTree(prev => {
      let next = prev;
      nodesToPaste.forEach((node, i) => {
        // Clone again to get fresh IDs for each paste
        const cloned = cloneTree(node);
        cloned.parentId = parentId;
        next = insertNode(next, cloned, parentId, afterIndex + 1 + i);
        lastInsertedId = cloned.id;
      });
      return next;
    });

    if (lastInsertedId) {
      setSelectedId(lastInsertedId);
      setAutoFocusId(lastInsertedId);
    }

    return lastInsertedId;
  }, [tree]);

  // Paste hierarchy items from smart paste
  const handlePasteHierarchy = useCallback((afterId: string, items: Array<{ label: string; depth: number }>) => {
    if (items.length === 0) return;

    const afterNode = findNode(tree, afterId);
    if (!afterNode) return;

    // Filter out empty items
    const filteredItems = items.filter(item => item.label.trim().length > 0);
    if (filteredItems.length === 0) return;

    // If anchor node is empty and first item is depth 0, replace anchor content instead of inserting after
    const anchorIsEmpty = !afterNode.label.trim();
    const firstItem = filteredItems[0];
    const shouldReplaceAnchor = anchorIsEmpty && firstItem.depth === 0;

    // Build hierarchy nodes from the parsed items
    // We need to track parent IDs at each depth level
    const parentStack: (string | null)[] = [afterNode.parentId];
    let lastInsertedId: string | undefined;
    let insertIndex = getNodeIndex(getSiblings(tree, afterId), afterId) + 1;
    let startIndex = 0;

    setTree(prev => {
      let next = prev;
      
      // If we should replace anchor, update its label with first item
      if (shouldReplaceAnchor) {
        next = updateNode(next, afterId, { label: firstItem.label });
        lastInsertedId = afterId;
        parentStack[1] = afterId; // First item now occupies the anchor
        startIndex = 1; // Skip first item in the loop
      }
      
      for (let i = startIndex; i < filteredItems.length; i++) {
        const item = filteredItems[i];
        
        // Adjust parent stack based on depth
        while (parentStack.length > item.depth + 1) {
          parentStack.pop();
        }
        while (parentStack.length < item.depth + 1) {
          // Use the last inserted node as parent for deeper levels
          parentStack.push(lastInsertedId || parentStack[parentStack.length - 1] || null);
        }

        const parentId = parentStack[item.depth] ?? null;
        const newNode = createNode(parentId, 'default', item.label);
        
        if (item.depth === 0) {
          // Top level: insert after the anchor
          next = insertNode(next, newNode, afterNode.parentId, insertIndex++);
        } else {
          // Nested: add as child of the current parent at this depth
          const parent = findNode(next, parentId!);
          next = insertNode(next, newNode, parentId, parent?.children.length ?? 0);
        }
        
        lastInsertedId = newNode.id;
        
        // Update parent stack for potential children
        parentStack[item.depth + 1] = newNode.id;
      }
      
      return next;
    });

    if (lastInsertedId) {
      setSelectedId(lastInsertedId);
      setAutoFocusId(lastInsertedId);
    }
  }, [tree]);

  // Context-callable paste handler (uses selected node or last node as anchor)
  const handlePasteHierarchyFromContext = useCallback((items: Array<{ label: string; depth: number }>) => {
    console.log('[' + blockId + '] handlePasteHierarchyFromContext called', { itemCount: items.length });
    
    const currentTree = treeRef.current;
    console.log('[' + blockId + '] treeRef.current type:', typeof currentTree, 'isArray:', Array.isArray(currentTree), 'length:', currentTree?.length);
    
    if (!currentTree || !Array.isArray(currentTree)) {
      console.error('[' + blockId + '] Invalid tree ref:', currentTree);
      return;
    }
    
    let currentFlatNodes;
    try {
      currentFlatNodes = flattenTree(currentTree);
    } catch (e) {
      console.error('[' + blockId + '] flattenTree error:', e);
      return;
    }
    console.log('[' + blockId + '] Current flat nodes:', currentFlatNodes.length, 'first label:', currentFlatNodes[0]?.label);
    
    // Check if tree only has a single empty node (fresh outline)
    const isFreshOutline = currentFlatNodes.length === 1 && 
                           !currentFlatNodes[0].label?.trim();
    
    console.log('[' + blockId + '] isFreshOutline:', isFreshOutline);
    
    if (isFreshOutline && items.length > 0) {
      console.log('[' + blockId + '] Building new tree from AI items');
      // Build hierarchy directly as the new tree (replacing the empty placeholder)
      const newTree: HierarchyNode[] = [];
      const parentStack: (HierarchyNode[] | null)[] = [newTree]; // Stack of children arrays
      const nodeStack: (HierarchyNode | null)[] = [null]; // Stack of parent nodes
      let lastInsertedId: string | null = null;
      
      for (const item of items) {
        const depth = Math.max(0, item.depth);
        
        // Trim parent stacks to current depth
        while (parentStack.length > depth + 1) {
          parentStack.pop();
          nodeStack.pop();
        }
        
        // Extend stacks if needed (for jumps in depth)
        while (parentStack.length < depth + 1) {
          const lastParent = nodeStack[nodeStack.length - 1];
          if (lastParent) {
            parentStack.push(lastParent.children);
            nodeStack.push(lastParent);
          } else {
            break;
          }
        }
        
        const targetArray = parentStack[parentStack.length - 1] || newTree;
        const parentNode = nodeStack[nodeStack.length - 1];
        
        const newNode = createNode(parentNode?.id || null, 'default', item.label);
        targetArray.push(newNode);
        lastInsertedId = newNode.id;
        
        // Prepare for potential children
        parentStack[depth + 1] = newNode.children;
        nodeStack[depth + 1] = newNode;
      }
      
      console.log('[' + blockId + '] Setting new tree with', newTree.length, 'root nodes');
      setTree(newTree);
      if (lastInsertedId) {
        setSelectedId(lastInsertedId);
        setAutoFocusId(lastInsertedId);
      }
      return;
    }
    
    // Existing logic for non-empty outlines
    const anchorId = selectedId || currentFlatNodes[currentFlatNodes.length - 1]?.id;
    console.log('[' + blockId + '] Using anchor:', anchorId);
    if (anchorId) {
      handlePasteHierarchy(anchorId, items);
    } else {
      console.error('[' + blockId + '] No anchor found for paste!');
    }
  }, [blockId, selectedId, handlePasteHierarchy, setTree]);

  // Register the paste handler with context
  useEffect(() => {
    console.log('[' + blockId + '] Registering paste handler');
    setOnPasteHierarchy(handlePasteHierarchyFromContext);
    return () => {
      console.log('[' + blockId + '] Unregistering paste handler');
      setOnPasteHierarchy(null);
    };
  }, [blockId, handlePasteHierarchyFromContext, setOnPasteHierarchy]);

  return (
    <NodeViewWrapper 
      className="hierarchy-block my-2 rounded-lg group relative"
    >
      {/* Import Outline Dialog - Lazy loaded */}
      <Suspense fallback={null}>
        <ImportOutlineDialog
          open={importDialogOpen}
          onOpenChange={(open) => {
            setImportDialogOpen(open);
            if (!open) setTargetSectionId(null);
          }}
        onImport={(items) => {
          // Use targetSectionId if set (from section toolbar), otherwise use selectedId
          const anchorId = targetSectionId ?? selectedId ?? flatNodes[flatNodes.length - 1]?.id;
          if (anchorId && items.length > 0) {
            if (targetSectionId) {
              // Insert as children of section
              const sectionNode = findNode(tree, targetSectionId);
              if (sectionNode) {
                const filteredItems = items.filter(item => item.label.trim().length > 0);
                setTree(prev => {
                  let next = prev;
                  let insertIndex = sectionNode.children?.length || 0;
                  
                  for (const item of filteredItems) {
                    const newNode = createNode(targetSectionId, 'default', item.label);
                    next = insertNode(next, newNode, targetSectionId, insertIndex++);
                  }
                  
                  return next;
                });
              }
            } else {
              handlePasteHierarchy(anchorId, items);
            }
          }
          setTargetSectionId(null);
        }}
        onLink={(docId, docTitle) => {
          const anchorId = targetSectionId ?? selectedId ?? flatNodes[flatNodes.length - 1]?.id;
          if (anchorId) {
            if (targetSectionId) {
              // Insert as child of section
              const newNode = createNode(targetSectionId, 'link', docTitle);
              newNode.linkedDocumentId = docId;
              newNode.linkedDocumentTitle = docTitle;
              setTree(prev => insertNode(prev, newNode, targetSectionId, 0));
              setSelectedId(newNode.id);
              setAutoFocusId(newNode.id);
            } else {
              const anchor = flatNodes.find(n => n.id === anchorId);
              // If the anchor node is empty, replace it with the link instead of inserting after
              if (anchor && anchor.label.trim() === '' && anchor.type !== 'link' && !anchor.linkedDocumentId) {
                // Preserve BODY type for hanging indent links (keeps them unnumbered)
                const preservedType = anchor.type === 'body' ? 'body' : 'link';
                setTree(prev => updateNode(prev, anchorId, {
                  type: preservedType,
                  label: docTitle,
                  linkedDocumentId: docId,
                  linkedDocumentTitle: docTitle,
                }));
                setSelectedId(anchorId);
                setAutoFocusId(anchorId);
              } else {
                // Insert as sibling - inherit body type if anchor is body
                const newType = anchor?.type === 'body' ? 'body' : 'link';
                const newNode = createNode(anchor?.parentId ?? null, newType, docTitle);
                newNode.linkedDocumentId = docId;
                newNode.linkedDocumentTitle = docTitle;
                setTree(prev => insertNode(prev, newNode, anchor?.parentId ?? null, getNodeIndex(getSiblings(prev, anchorId), anchorId) + 1));
                setSelectedId(newNode.id);
                setAutoFocusId(newNode.id);
              }
            }
          }
          setTargetSectionId(null);
        }}
      />
      </Suspense>
      
      {/* Link Document Dialog - for creating new links - Lazy loaded */}
      <Suspense fallback={null}>
        <LinkDocumentDialog
          open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) setTargetSectionId(null);
        }}
        onSelect={(docId, docTitle) => {
          // Use targetSectionId if set (from section toolbar), otherwise use selectedId
          const anchorId = targetSectionId ?? selectedId ?? flatNodes[flatNodes.length - 1]?.id;
          if (anchorId) {
            const anchor = flatNodes.find(n => n.id === anchorId);
            // If the anchor is a section (targetSectionId), add as child
            if (targetSectionId) {
              const newNode = createNode(targetSectionId, 'link', docTitle);
              newNode.linkedDocumentId = docId;
              newNode.linkedDocumentTitle = docTitle;
              // Insert as first child of the section
              setTree(prev => insertNode(prev, newNode, targetSectionId, 0));
              setSelectedId(newNode.id);
              setAutoFocusId(newNode.id);
            } else if (anchor && anchor.label.trim() === '' && anchor.type !== 'link' && !anchor.linkedDocumentId) {
              // If the anchor node is empty, replace it with the link instead of inserting after
              // Preserve BODY type for hanging indent links (keeps them unnumbered)
              const preservedType = anchor.type === 'body' ? 'body' : 'link';
              setTree(prev => updateNode(prev, anchorId, {
                type: preservedType,
                label: docTitle,
                linkedDocumentId: docId,
                linkedDocumentTitle: docTitle,
              }));
              setSelectedId(anchorId);
              setAutoFocusId(anchorId);
            } else {
              // Insert as sibling - inherit body type if anchor is body
              const newType = anchor?.type === 'body' ? 'body' : 'link';
              const newNode = createNode(anchor?.parentId ?? null, newType, docTitle);
              newNode.linkedDocumentId = docId;
              newNode.linkedDocumentTitle = docTitle;
              setTree(prev => insertNode(prev, newNode, anchor?.parentId ?? null, getNodeIndex(getSiblings(prev, anchorId), anchorId) + 1));
              setSelectedId(newNode.id);
              setAutoFocusId(newNode.id);
            }
          }
          setTargetSectionId(null);
        }}
        currentDocId={document?.meta?.id}
      />
      </Suspense>
      
      {/* Relink Document Dialog - for fixing broken link nodes - Lazy loaded */}
      <Suspense fallback={null}>
        <LinkDocumentDialog
          open={relinkDialogOpen}
        onOpenChange={(open) => {
          setRelinkDialogOpen(open);
          if (!open) setRelinkNodeId(null);
        }}
        onSelect={(docId, docTitle) => {
          if (relinkNodeId) {
            // When relinking, preserve the existing node type (don't overwrite body with link)
            const existingNode = flatNodes.find(n => n.id === relinkNodeId);
            const preservedType = existingNode?.type === 'body' ? 'body' : (existingNode?.type || 'link');
            setTree(prev => updateNode(prev, relinkNodeId, { 
              linkedDocumentId: docId, 
              linkedDocumentTitle: docTitle,
              label: docTitle,
              type: preservedType
            }));
            setSelectedId(relinkNodeId);
            setAutoFocusId(relinkNodeId);
            toast({ title: 'Link connected', description: `Now links to "${docTitle}"` });
          }
          setRelinkNodeId(null);
        }}
        currentDocId={document?.meta?.id}
      />
      </Suspense>
      
      {/* Spritzer Dialog with Adaptive Cognitive Pacing - Lazy loaded */}
      <Suspense fallback={null}>
        <SpritzerDialog
          open={spritzerOpen}
        onOpenChange={(open) => {
          setSpritzerOpen(open);
          if (!open) setTargetSectionId(null);
        }}
        tree={tree}
        startNodeId={targetSectionId ?? selectedId ?? undefined}
        prefixGenerator={(node: FlatNode) => {
          // Build indices array for the node
          const nodeFlat = flattenTree(tree);
          const indices: number[] = [];
          let currentDepth = 0;
          const counters: number[] = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
          
          for (const n of nodeFlat) {
            // Reset counters for deeper levels when going to shallower depth
            if (n.depth < currentDepth) {
              for (let d = n.depth + 1; d < counters.length; d++) {
                counters[d] = 0;
              }
            }
            currentDepth = n.depth;
            
            // Only count numbered nodes (not body type)
            if (n.type !== 'body') {
              counters[n.depth]++;
            }
            
            if (n.id === node.id) {
              for (let d = 0; d <= n.depth; d++) {
                indices[d] = counters[d];
              }
              break;
            }
          }
          
          if (node.type === 'body') return '';
          
          if (outlineStyle === 'mixed' && mixedConfig) {
            return getOutlinePrefixCustom(node.depth, indices, mixedConfig);
          }
          return getOutlinePrefix(outlineStyle, node.depth, indices);
        }}
        // Pass entity data for Adaptive Cognitive Pacing™
        people={people}
        places={places}
        dates={dates}
        terms={terms}
      />
      </Suspense>
      
      {/* Floating toolbar - appears on hover */}
      <div className="absolute top-3 right-2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setSpritzerOpen(true)}
            >
              <Play className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            <p>Speed Read</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setLinkDialogOpen(true)}
            >
              <Link2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            <p>Link document</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setImportDialogOpen(true)}
            >
              <Upload className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            <p>Import Outline</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
              onClick={() => setIsCollapsed(!isCollapsed)}
            >
              {isCollapsed ? (
                <Maximize2 className="h-3 w-3" />
              ) : (
                <Minimize2 className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            <p>{isCollapsed ? 'Expand' : 'Collapse'}</p>
          </TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
              onClick={() => deleteBlockNode()}
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={4}>
            <p>Delete outline</p>
          </TooltipContent>
        </Tooltip>
      </div>
      
      {/* Outline view - use virtualized version for large outlines */}
      {!isCollapsed && flatNodes.length >= 100 && (
        <div className="h-[500px]">
          <VirtualizedOutline
            nodes={flatNodes}
            selectedId={selectedId}
            outlineStyle={outlineStyle}
            mixedConfig={mixedConfig}
            onSelect={setSelectedId}
            onUpdateLabel={handleUpdateLabel}
            onNavigateUp={navigateUp}
            onNavigateDown={navigateDown}
            className="h-full"
          />
        </div>
      )}
      
      {!isCollapsed && flatNodes.length < 100 && (
        <div>
          <SimpleOutlineView
            nodes={flatNodes}
            tree={tree}
            selectedId={selectedId}
            outlineStyle={outlineStyle}
            mixedConfig={mixedConfig}
            showRowHighlight={showRowHighlight}
            autoFocusId={autoFocusId}
            onAutoFocusHandled={() => setAutoFocusId(null)}
            onSelect={setSelectedId}
            onToggleCollapse={handleToggleCollapse}
            onUpdateLabel={handleUpdateLabel}
            onMove={handleMove}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onVisualIndent={handleVisualIndent}
            onAddNode={(afterId, type = 'default') => {
              const anchorId = afterId ?? selectedId;
              if (anchorId) {
                const anchor = flatNodes.find(n => n.id === anchorId);
                return addNode(anchor?.parentId ?? null, type as any, '', anchorId);
              } else {
                return addNode(null, type as any, '');
              }
            }}
            onAddBodyNode={(afterId) => {
              const anchorId = afterId ?? selectedId;
              if (anchorId) {
                // Add body node as child of the anchor (indented under it)
                return addChildNode(anchorId, 'body', '');
              } else {
                return addNode(null, 'body', '');
              }
            }}
            onAddBodyNodeWithSpacer={(afterId) => {
              const anchorId = afterId ?? selectedId;
              if (anchorId) {
                // Insert spacer + typing node as children of the anchor (indented under it)
                const spacerNode = createNode(anchorId, 'body', '');
                const typingNode = createNode(anchorId, 'body', '');

                setTree(prev => {
                  const withSpacer = insertNode(prev, spacerNode, anchorId, 0);
                  return insertNode(withSpacer, typingNode, anchorId, 1);
                });

                setSelectedId(typingNode.id);
                return typingNode.id;
              }

              // No anchor: append both at root
              const spacerNode = createNode(null, 'body', '');
              const typingNode = createNode(null, 'body', '');
              setTree(prev => {
                const insertAt = prev.length;
                const withSpacer = insertNode(prev, spacerNode, null, insertAt);
                return insertNode(withSpacer, typingNode, null, insertAt + 1);
              });
              setSelectedId(typingNode.id);
              return typingNode.id;
            }}
            onAddChildNode={(parentId) => {
              const anchorId = parentId ?? selectedId;
              if (anchorId) {
                return addChildNode(anchorId, 'default', '');
              }
              return undefined;
            }}
            onDelete={removeNode}
            onNavigateUp={navigateUp}
            onNavigateDown={navigateDown}
            onMergeIntoParent={handleMergeIntoParent}
            onCopyNode={handleCopyNode}
            onPasteNodes={handlePasteNodes}
            onPasteHierarchy={handlePasteHierarchy}
            onInsertSectionContent={(sectionId, items) => {
              if (items.length === 0) return;
              
              const sectionNode = findNode(tree, sectionId);
              if (!sectionNode) return;
              
              // Filter out empty items
              const filteredItems = items.filter(item => item.label.trim().length > 0);
              if (filteredItems.length === 0) return;
              
              // Build hierarchy nodes respecting depth
              // parentStack[0] = sectionId (depth 0 items become children of section)
              const parentStack: string[] = [sectionId];
              let lastInsertedId: string | undefined;
              let firstInsertedId: string | undefined;
              
              setTree(prev => {
                let next = prev;
                const currentSectionNode = findNode(next, sectionId);
                const baseIndex = currentSectionNode?.children?.length || 0;
                let insertIndex = baseIndex;
                
                for (let i = 0; i < filteredItems.length; i++) {
                  const item = filteredItems[i];
                  
                  // Adjust parent stack based on depth
                  // Trim stack if we're going back up
                  while (parentStack.length > item.depth + 1) {
                    parentStack.pop();
                  }
                  // Extend stack if we're going deeper
                  while (parentStack.length < item.depth + 1) {
                    parentStack.push(lastInsertedId || parentStack[parentStack.length - 1]);
                  }
                  
                  const parentId = parentStack[item.depth];
                  const newNode = createNode(parentId, 'default', item.label);
                  
                  if (item.depth === 0) {
                    // Top level: insert as child of section
                    next = insertNode(next, newNode, sectionId, insertIndex++);
                  } else {
                    // Nested: add as child of the current parent at this depth
                    const parent = findNode(next, parentId);
                    next = insertNode(next, newNode, parentId, parent?.children?.length ?? 0);
                  }
                  
                  if (!firstInsertedId) {
                    firstInsertedId = newNode.id;
                  }
                  lastInsertedId = newNode.id;
                  
                  // Update parent stack for potential children
                  parentStack[item.depth + 1] = newNode.id;
                }
                
                return next;
              });
              
              // Focus the first inserted item
              if (firstInsertedId) {
                setSelectedId(firstInsertedId);
                setAutoFocusId(firstInsertedId);
              }
            }}
            autoDescend={autoDescend}
            onNavigateToLinkedDocument={navigateToDocument ?? undefined}
            onRequestRelink={(nodeId) => {
              console.log('[HierarchyBlockView] onRequestRelink called', { nodeId });
              setRelinkNodeId(nodeId);
              setRelinkDialogOpen(true);
            }}
            onConvertToNumbered={(nodeId) => {
              // Convert a BODY/link node back to a numbered 'default' type
              setTree(prev => updateNode(prev, nodeId, { type: 'default' }));
            }}
            onSectionSpeedRead={(sectionId) => {
              setTargetSectionId(sectionId);
              setSpritzerOpen(true);
            }}
            onSectionLinkDocument={(sectionId) => {
              setTargetSectionId(sectionId);
              setLinkDialogOpen(true);
            }}
            onSectionImport={(sectionId) => {
              setTargetSectionId(sectionId);
              setImportDialogOpen(true);
            }}
          />
        </div>
      )}
      
      {isCollapsed && (
        <button 
          onClick={() => setIsCollapsed(false)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1 px-2"
        >
          ▸ {flatNodes.length} items
        </button>
      )}
      
      {/* Reveal Codes panel - WordPerfect style */}
      {showRevealCodes && !isCollapsed && (
        <RevealCodes nodes={flatNodes} selectedId={selectedId} />
      )}
    </NodeViewWrapper>
  );
}
