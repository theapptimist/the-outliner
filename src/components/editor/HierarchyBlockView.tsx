import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useCallback, useEffect, useRef } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Link } from 'react-router-dom';
import { HierarchyNode, NodeType, DropPosition } from '@/types/node';
import { 
  createNode, 
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
import { RevealCodes } from './RevealCodes';
import { FindReplaceMatch, FindReplaceProvider, useEditorContext } from './EditorContext';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { Trash2, Minimize2, Maximize2, ExternalLink } from 'lucide-react';

interface HierarchyBlockViewProps extends NodeViewProps {
  updateAttributes: (attrs: Record<string, any>) => void;
}

export function HierarchyBlockView({ node, deleteNode: deleteBlockNode, selected }: HierarchyBlockViewProps) {
  const blockId = node.attrs.blockId as string;
  
  // Get settings from context
  const {
    outlineStyle,
    mixedConfig,
    autoDescend,
    showRevealCodes,
    registerUndoRedo,
    registerFindReplaceProvider,
    unregisterFindReplaceProvider,
  } = useEditorContext();
  
  // Local hierarchy state for this block - start with one empty node
  const [{ tree: initialTree, firstNodeId }] = useState(() => {
    const node = createNode(null, 'default', '');
    return { tree: [node], firstNodeId: node.id };
  });
  const [tree, setTreeState] = useState<HierarchyNode[]>(initialTree);
  const treeRef = useRef<HierarchyNode[]>(initialTree);
  const [selectedId, setSelectedId] = useState<string | null>(firstNodeId);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(firstNodeId);

  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

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
      if (flatNodes.length > 0) setSelectedId(flatNodes[0].id);
      return;
    }
    const currentIndex = flatNodes.findIndex(n => n.id === selectedId);
    if (currentIndex > 0) {
      setSelectedId(flatNodes[currentIndex - 1].id);
    }
  }, [selectedId, flatNodes]);

  const navigateDown = useCallback(() => {
    if (!selectedId) {
      if (flatNodes.length > 0) setSelectedId(flatNodes[0].id);
      return;
    }
    const currentIndex = flatNodes.findIndex(n => n.id === selectedId);
    if (currentIndex < flatNodes.length - 1) {
      setSelectedId(flatNodes[currentIndex + 1].id);
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

  return (
    <NodeViewWrapper 
      className="hierarchy-block my-2 rounded-lg overflow-hidden group relative"
    >
      {/* Minimal toolbar - main controls are in sidebar */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30 bg-muted/20">
        <span className="text-xs text-muted-foreground font-medium">Outline</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            asChild
            title="Open in Hierarchy Editor"
          >
            <Link to="/hierarchy">
              <ExternalLink className="h-3 w-3" />
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={isCollapsed ? 'Expand' : 'Collapse'}
          >
            {isCollapsed ? (
              <Maximize2 className="h-3 w-3" />
            ) : (
              <Minimize2 className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 text-destructive hover:text-destructive"
            onClick={() => deleteBlockNode()}
            title="Delete outline"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>
      
      {/* Outline view */}
      {!isCollapsed && (
        <div className="border-l-2 border-border/50 ml-1">
          <SimpleOutlineView
            nodes={flatNodes}
            selectedId={selectedId}
            outlineStyle={outlineStyle}
            mixedConfig={mixedConfig}
            autoFocusId={autoFocusId}
            onAutoFocusHandled={() => setAutoFocusId(null)}
            onSelect={setSelectedId}
            onToggleCollapse={handleToggleCollapse}
            onUpdateLabel={handleUpdateLabel}
            onMove={handleMove}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onVisualIndent={handleVisualIndent}
            onAddNode={(afterId) => {
              const anchorId = afterId ?? selectedId;
              if (anchorId) {
                const anchor = flatNodes.find(n => n.id === anchorId);
                addNode(anchor?.parentId ?? null, 'default', '', anchorId);
              } else {
                addNode(null, 'default', '');
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
            autoDescend={autoDescend}
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
