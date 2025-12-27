import { useState, useRef, useEffect } from 'react';
import { FlatNode, DropPosition } from '@/types/node';
import { NodeTypeIcon } from './NodeTypeIcon';
import { ChevronRight, ChevronDown, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TreeNodeProps {
  node: FlatNode;
  isSelected: boolean;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onStartEdit: (id: string) => void;
  onEndEdit: (id: string, newLabel: string) => void;
  onDragStart: (id: string) => void;
  onDragOver: (id: string, position: DropPosition) => void;
  onDragEnd: () => void;
  onDrop: (targetId: string, position: DropPosition) => void;
  dragOverState: { targetId: string; position: DropPosition } | null;
  draggingId: string | null;
}

export function TreeNode({
  node,
  isSelected,
  isEditing,
  onSelect,
  onToggleCollapse,
  onStartEdit,
  onEndEdit,
  onDragStart,
  onDragOver,
  onDragEnd,
  onDrop,
  dragOverState,
  draggingId,
}: TreeNodeProps) {
  const [editValue, setEditValue] = useState(node.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const nodeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', node.id);
    onDragStart(node.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (draggingId === node.id) return;
    
    const rect = nodeRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const y = e.clientY - rect.top;
    const height = rect.height;
    
    let position: DropPosition;
    if (y < height * 0.25) {
      position = 'before';
    } else if (y > height * 0.75) {
      position = 'after';
    } else {
      position = 'inside';
    }
    
    onDragOver(node.id, position);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (dragOverState) {
      onDrop(dragOverState.targetId, dragOverState.position);
    }
    onDragEnd();
  };

  const handleDoubleClick = () => {
    onStartEdit(node.id);
    setEditValue(node.label);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onEndEdit(node.id, editValue);
    } else if (e.key === 'Escape') {
      setEditValue(node.label);
      onEndEdit(node.id, node.label);
    }
  };

  const isDragging = draggingId === node.id;
  const isDragTarget = dragOverState?.targetId === node.id;

  return (
    <div
      ref={nodeRef}
      className={cn(
        'group relative flex items-center h-8 cursor-pointer select-none',
        'transition-colors duration-fast',
        isSelected && 'bg-secondary',
        isDragging && 'opacity-50',
        !isSelected && !isDragging && 'hover:bg-secondary/50'
      )}
      style={{ paddingLeft: `${node.depth * 20 + 8}px` }}
      onClick={() => onSelect(node.id)}
      onDoubleClick={handleDoubleClick}
      draggable={!isEditing}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragLeave={() => {}}
      onDrop={handleDrop}
      onDragEnd={onDragEnd}
    >
      {/* Indent guides */}
      {Array.from({ length: node.depth }).map((_, i) => (
        <div
          key={i}
          className="node-indent-guide"
          style={{ left: `${i * 20 + 16}px` }}
        />
      ))}

      {/* Drop indicators */}
      {isDragTarget && dragOverState?.position === 'before' && (
        <div className="node-drop-indicator top-0" />
      )}
      {isDragTarget && dragOverState?.position === 'after' && (
        <div className="node-drop-indicator bottom-0" />
      )}
      {isDragTarget && dragOverState?.position === 'inside' && (
        <div className="absolute inset-0 border-2 border-primary/50 rounded pointer-events-none" />
      )}

      {/* Drag handle */}
      <GripVertical 
        size={12} 
        className="mr-1 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity cursor-grab" 
      />

      {/* Expand/collapse */}
      <button
        className={cn(
          'flex items-center justify-center w-4 h-4 mr-1',
          'text-muted-foreground hover:text-foreground transition-colors',
          !node.hasChildren && 'invisible'
        )}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse(node.id);
        }}
      >
        {node.collapsed ? (
          <ChevronRight size={14} />
        ) : (
          <ChevronDown size={14} />
        )}
      </button>

      {/* Node type icon */}
      <NodeTypeIcon type={node.type} className="mr-2 flex-shrink-0" />

      {/* Label */}
      {isEditing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onEndEdit(node.id, editValue)}
          className="flex-1 bg-background border border-ring rounded px-1 py-0.5 text-sm font-mono outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-sm font-mono truncate text-foreground">
          {node.label}
        </span>
      )}

      {/* Property count badge */}
      {Object.keys(node.properties).length > 0 && (
        <span className="ml-2 px-1.5 py-0.5 text-xs font-mono bg-muted text-muted-foreground rounded">
          {Object.keys(node.properties).length}
        </span>
      )}
    </div>
  );
}
