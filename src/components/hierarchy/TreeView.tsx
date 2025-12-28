import { useState, useCallback, useEffect } from 'react';
import { FlatNode, DropPosition } from '@/types/node';
import { TreeNode } from './TreeNode';
import { cn } from '@/lib/utils';

interface TreeViewProps {
  nodes: FlatNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onMove: (nodeId: string, targetId: string, position: DropPosition) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onAddNode: () => void;
  onAddChildNode: () => void;
  autoDescend?: boolean;
}

export function TreeView({
  nodes,
  selectedId,
  onSelect,
  onToggleCollapse,
  onUpdateLabel,
  onMove,
  onIndent,
  onOutdent,
  onDelete,
  onNavigateUp,
  onNavigateDown,
  onAddNode,
  onAddChildNode,
  autoDescend = false,
}: TreeViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverState, setDragOverState] = useState<{
    targetId: string;
    position: DropPosition;
  } | null>(null);

  const handleStartEdit = useCallback((id: string) => {
    setEditingId(id);
  }, []);

  const handleEndEdit = useCallback((id: string, newLabel: string) => {
    if (newLabel.trim()) {
      onUpdateLabel(id, newLabel.trim());
    }
    setEditingId(null);
  }, [onUpdateLabel]);

  const handleDragStart = useCallback((id: string) => {
    setDraggingId(id);
  }, []);

  const handleDragOver = useCallback((targetId: string, position: DropPosition) => {
    setDragOverState({ targetId, position });
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverState(null);
  }, []);

  const handleDrop = useCallback((targetId: string, position: DropPosition) => {
    if (draggingId && draggingId !== targetId) {
      onMove(draggingId, targetId, position);
    }
    handleDragEnd();
  }, [draggingId, onMove, handleDragEnd]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onNavigateUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onNavigateDown();
          break;
        case 'ArrowRight':
          if (selectedId) {
            const node = nodes.find(n => n.id === selectedId);
            if (node?.hasChildren && node.collapsed) {
              onToggleCollapse(selectedId);
            }
          }
          break;
        case 'ArrowLeft':
          if (selectedId) {
            const node = nodes.find(n => n.id === selectedId);
            if (node?.hasChildren && !node.collapsed) {
              onToggleCollapse(selectedId);
            } else if (node?.parentId) {
              onSelect(node.parentId);
            }
          }
          break;
        case 'Tab':
          e.preventDefault();
          if (selectedId) {
            if (e.shiftKey) {
              onOutdent(selectedId);
            } else {
              onIndent(selectedId);
            }
          }
          break;
        case 'Enter':
          e.preventDefault();
          if (e.shiftKey) {
            onAddChildNode();
          } else if (autoDescend && selectedId) {
            onAddChildNode();
          } else {
            onAddNode();
          }
          break;
        case 'Delete':
        case 'Backspace':
          if (selectedId && !editingId) {
            e.preventDefault();
            onDelete(selectedId);
          }
          break;
        case 'F2':
          if (selectedId) {
            e.preventDefault();
            handleStartEdit(selectedId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedId,
    editingId,
    nodes,
    onNavigateUp,
    onNavigateDown,
    onToggleCollapse,
    onSelect,
    onIndent,
    onOutdent,
    onDelete,
    onAddNode,
    onAddChildNode,
    handleStartEdit,
    autoDescend,
  ]);

  return (
    <div 
      className={cn(
        'flex-1 overflow-auto scrollbar-thin',
        'focus:outline-none'
      )}
      tabIndex={0}
    >
      <div className="py-1">
        {nodes.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            isSelected={selectedId === node.id}
            isEditing={editingId === node.id}
            onSelect={onSelect}
            onToggleCollapse={onToggleCollapse}
            onStartEdit={handleStartEdit}
            onEndEdit={handleEndEdit}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDrop={handleDrop}
            dragOverState={dragOverState}
            draggingId={draggingId}
          />
        ))}
        
        {nodes.length === 0 && (
          <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
            <p className="text-sm">No nodes yet</p>
            <p className="text-xs mt-1">Press Enter to create a node</p>
          </div>
        )}
      </div>
    </div>
  );
}
