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
  createSampleTree,
} from '@/lib/nodeOperations';
import { TreeView } from '@/components/hierarchy/TreeView';
import { Trash2, Minimize2, Maximize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface HierarchyBlockViewProps extends NodeViewProps {
  updateAttributes: (attrs: Record<string, any>) => void;
}

export function HierarchyBlockView({ node, deleteNode: deleteBlockNode, selected }: HierarchyBlockViewProps) {
  const blockId = node.attrs.blockId as string;
  
  // Local hierarchy state for this block
  const [tree, setTree] = useState<HierarchyNode[]>(() => createSampleTree());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);

  const flatNodes = flattenTree(tree);

  const addNode = useCallback((
    parentId: string | null = null,
    type: NodeType = 'default',
    label: string = 'New Node',
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

  const addChildNode = useCallback((parentId: string, type: NodeType = 'default', label: string = 'New Node') => {
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

  const updateNodeData = useCallback((nodeId: string, updates: Partial<HierarchyNode>) => {
    setTree(prev => updateNode(prev, nodeId, updates));
  }, []);

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

  return (
    <NodeViewWrapper 
      className={cn(
        'my-2 rounded-lg overflow-hidden group',
        selected ? 'ring-2 ring-primary/50' : ''
      )}
    >
      {/* Minimal hover controls */}
      <div className="absolute -right-8 top-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1">
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
      
      {/* Tree view - seamless */}
      {!isCollapsed && (
        <div className="border-l-2 border-border/50 pl-2 ml-1">
          <TreeView
            nodes={flatNodes}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onToggleCollapse={handleToggleCollapse}
            onUpdateLabel={handleUpdateLabel}
            onMove={handleMove}
            onIndent={handleIndent}
            onOutdent={handleOutdent}
            onAddNode={() => {
              if (selectedId) {
                const node = flatNodes.find(n => n.id === selectedId);
                addNode(node?.parentId ?? null, 'default', 'New Node', selectedId);
              } else {
                addNode(null, 'default', 'New Node');
              }
            }}
            onAddChildNode={() => {
              if (selectedId) {
                addChildNode(selectedId, 'default', 'New Node');
              }
            }}
            onDelete={removeNode}
            onNavigateUp={navigateUp}
            onNavigateDown={navigateDown}
          />
        </div>
      )}
      
      {isCollapsed && (
        <button 
          onClick={() => setIsCollapsed(false)}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
        >
          ▸ {flatNodes.length} items
        </button>
      )}
    </NodeViewWrapper>
  );
}
