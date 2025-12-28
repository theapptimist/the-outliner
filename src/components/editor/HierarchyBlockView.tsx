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
import { OutlineStylePicker } from './OutlineStylePicker';
import { OutlineHelp } from './OutlineHelp';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { Trash2, Minimize2, Maximize2, ExternalLink, ArrowDownRight, Undo2, Redo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

const MIXED_CONFIG_STORAGE_KEY = 'outline-mixed-config';

// Load mixed config from localStorage
function loadMixedConfig(): MixedStyleConfig {
  try {
    const stored = localStorage.getItem(MIXED_CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Validate structure
      if (parsed?.levels?.length === 6) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load mixed config from localStorage:', e);
  }
  return DEFAULT_MIXED_CONFIG;
}

// Save mixed config to localStorage
function saveMixedConfig(config: MixedStyleConfig) {
  try {
    localStorage.setItem(MIXED_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save mixed config to localStorage:', e);
  }
}

interface HierarchyBlockViewProps extends NodeViewProps {
  updateAttributes: (attrs: Record<string, any>) => void;
}

export function HierarchyBlockView({ node, deleteNode: deleteBlockNode, selected }: HierarchyBlockViewProps) {
  const blockId = node.attrs.blockId as string;
  
  // Local hierarchy state for this block - start with one empty node
  const [{ tree: initialTree, firstNodeId }] = useState(() => {
    const node = createNode(null, 'default', '');
    return { tree: [node], firstNodeId: node.id };
  });
  const [tree, setTreeState] = useState<HierarchyNode[]>(initialTree);
  const [selectedId, setSelectedId] = useState<string | null>(firstNodeId);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>('mixed');
  const [mixedConfig, setMixedConfig] = useState<MixedStyleConfig>(loadMixedConfig);
  const [autoDescend, setAutoDescend] = useState(false);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(firstNodeId);

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

  // Save mixed config to localStorage whenever it changes
  useEffect(() => {
    saveMixedConfig(mixedConfig);
  }, [mixedConfig]);

  // Global undo/redo keyboard handler
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

  // Shift+Esc: Merge node into previous sibling (or parent if no sibling) with line break
  const handleMergeIntoParent = useCallback((nodeId: string, currentValue?: string) => {
    const node = findNode(tree, nodeId);
    if (!node) {
      toast({ title: 'Merge failed', description: 'Could not find the selected line.' });
      return null;
    }

    const nodeLabel = (currentValue ?? node.label) ?? '';

    const flatIndex = flatNodes.findIndex(n => n.id === nodeId);
    if (flatIndex < 0) {
      toast({ title: 'Merge failed', description: 'Could not locate the line in the outline.' });
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
      toast({ title: 'Nothing to merge into', description: 'This line has no previous line or parent to merge into.' });
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

    toast({ title: 'Merged', description: 'Merged into the line above.' });

    return { targetId: targetNode.id, targetLabel: newLabel };
  }, [tree, flatNodes]);

  return (
    <NodeViewWrapper 
      className="hierarchy-block my-2 rounded-lg overflow-hidden group relative"
    >
      {/* Toolbar with help and controls */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">Outline</span>
          <OutlineHelp className="h-5 w-5 p-0" />
        </div>
        <div className="flex items-center gap-1">
          <OutlineStylePicker 
            value={outlineStyle} 
            onChange={setOutlineStyle}
            mixedConfig={mixedConfig}
            onMixedConfigChange={setMixedConfig}
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoDescend ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  "h-6 w-6 p-0",
                  autoDescend && "bg-primary/10 text-primary hover:bg-primary/20"
                )}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => setAutoDescend(!autoDescend)}
              >
                <ArrowDownRight className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Auto-Descend: Enter creates child (1 → a → i)</p>
            </TooltipContent>
          </Tooltip>
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
    </NodeViewWrapper>
  );
}
