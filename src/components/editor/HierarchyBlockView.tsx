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
    
    if (afterNodeId) {
      const siblings = parentId 
        ? (findNode(tree, parentId)?.children ?? [])
        : tree;
      const afterIndex = getNodeIndex(siblings, afterNodeId);
      setTree(prev => insertNode(prev, newNode, parentId, afterIndex + 1));
    } else {
      const siblings = parentId 
        ? (findNode(tree, parentId)?.children ?? [])
        : tree;
      setTree(prev => insertNode(prev, newNode, parentId, siblings.length));
    }
    
    setSelectedId(newNode.id);
    return newNode.id;
  }, [tree]);

  const addChildNode = useCallback((parentId: string, type: NodeType = 'default', label: string = '') => {
    const parent = findNode(tree, parentId);
    if (!parent) return null;
    
    const newNode = createNode(parentId, type, label);
    setTree(prev => insertNode(prev, newNode, parentId, parent.children.length));
    setSelectedId(newNode.id);
    
    if (parent.collapsed) {
      setTree(prev => toggleCollapse(prev, parentId));
    }
    
    return newNode.id;
  }, [tree]);

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
  const handleMergeIntoParent = useCallback((nodeId: string) => {
    const node = findNode(tree, nodeId);
    if (!node) return;
    
    // Get siblings at this level
    const flatIndex = flatNodes.findIndex(n => n.id === nodeId);
    const currentNode = flatNodes[flatIndex];
    
    // Find previous sibling at same depth
    let targetNode: { id: string; label: string } | null = null;
    
    // Look backwards for a sibling at the same depth
    for (let i = flatIndex - 1; i >= 0; i--) {
      const prevNode = flatNodes[i];
      if (prevNode.depth === currentNode.depth && prevNode.parentId === currentNode.parentId) {
        // Found previous sibling
        targetNode = { id: prevNode.id, label: prevNode.label };
        break;
      }
      if (prevNode.depth < currentNode.depth) {
        // We've gone up a level, no previous sibling exists
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
    
    if (!targetNode) return; // Can't merge root-level first item
    
    // Append this node's label to target with line break
    const newLabel = targetNode.label 
      ? `${targetNode.label}\n${node.label}`
      : node.label;
    
    // Update target label and delete this node
    setTree(prev => {
      const updated = updateNode(prev, targetNode!.id, { label: newLabel });
      return deleteNode(updated, nodeId);
    });
    
    // Select the target
    setSelectedId(targetNode.id);
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
            onAddNode={() => {
              if (selectedId) {
                const node = flatNodes.find(n => n.id === selectedId);
                addNode(node?.parentId ?? null, 'default', '', selectedId);
              } else {
                addNode(null, 'default', '');
              }
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
