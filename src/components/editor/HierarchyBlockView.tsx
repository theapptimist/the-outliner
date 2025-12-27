import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { useState, useCallback } from 'react';
import { HierarchyNode, NodeType, DropPosition } from '@/types/node';
import { 
  createNode, 
  findNode, 
  insertNode, 
  deleteNode, 
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
import { OutlineStyle } from '@/lib/outlineStyles';
import { Trash2, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';

interface HierarchyBlockViewProps extends NodeViewProps {
  updateAttributes: (attrs: Record<string, any>) => void;
}

export function HierarchyBlockView({ node, deleteNode: deleteBlockNode, selected }: HierarchyBlockViewProps) {
  const blockId = node.attrs.blockId as string;
  
  // Local hierarchy state for this block - start with one empty node
  const [tree, setTree] = useState<HierarchyNode[]>(() => [
    createNode(null, 'default', '')
  ]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>('mixed');

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
    
    setTree(prev => deleteNode(prev, nodeId));
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
      className={cn(
        'my-2 rounded-lg overflow-hidden group relative',
        selected ? 'ring-2 ring-primary/50' : ''
      )}
    >
      {/* Toolbar with help and controls */}
      <div className="flex items-center justify-between px-2 py-1 border-b border-border/30 bg-muted/20">
        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">Outline</span>
          <OutlineHelp className="h-5 w-5 p-0" />
        </div>
        <div className="flex items-center gap-1">
          <OutlineStylePicker value={outlineStyle} onChange={setOutlineStyle} />
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
            onSelect={setSelectedId}
            onToggleCollapse={handleToggleCollapse}
            onUpdateLabel={handleUpdateLabel}
            onMove={handleMove}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
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
                // Add body node as sibling after the anchor (same parent)
                const anchor = flatNodes.find(n => n.id === anchorId);
                return addNode(anchor?.parentId ?? null, 'body', '', anchorId);
              } else {
                return addNode(null, 'body', '');
              }
            }}
            onAddBodyNodeWithSpacer={(afterId) => {
              const anchorId = afterId ?? selectedId;
              if (anchorId) {
                // Insert spacer + typing node as siblings right after the anchor (same parent)
                const anchor = flatNodes.find(n => n.id === anchorId);
                const parentId = anchor?.parentId ?? null;

                const spacerNode = createNode(parentId, 'body', '');
                const typingNode = createNode(parentId, 'body', '');

                setTree(prev => {
                  const siblings = parentId
                    ? (findNode(prev, parentId)?.children ?? [])
                    : prev;

                  const anchorIndex = getNodeIndex(siblings, anchorId);
                  const insertAt = Math.max(0, anchorIndex + 1);

                  const withSpacer = insertNode(prev, spacerNode, parentId, insertAt);
                  return insertNode(withSpacer, typingNode, parentId, insertAt + 1);
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
            onAddChildNode={() => {
              if (selectedId) {
                addChildNode(selectedId, 'default', '');
              }
            }}
            onDelete={removeNode}
            onNavigateUp={navigateUp}
            onNavigateDown={navigateDown}
            onMergeIntoParent={handleMergeIntoParent}
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
