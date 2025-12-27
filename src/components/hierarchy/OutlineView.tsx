import { useState, useRef, useEffect, useCallback } from 'react';
import { FlatNode } from '@/types/node';
import { NodeTypeIcon } from './NodeTypeIcon';
import { cn } from '@/lib/utils';

interface OutlineViewProps {
  nodes: FlatNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
}

export function OutlineView({ nodes, selectedId, onSelect, onUpdateLabel }: OutlineViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId]);

  const handleStartEdit = useCallback((id: string, currentLabel: string) => {
    setEditingId(id);
    setEditValue(currentLabel);
  }, []);

  const handleEndEdit = useCallback((id: string) => {
    if (editValue.trim()) {
      onUpdateLabel(id, editValue.trim());
    }
    setEditingId(null);
  }, [editValue, onUpdateLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter') {
      handleEndEdit(id);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    }
  }, [handleEndEdit]);

  // Global keyboard listener for F2
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F2' && selectedId && !editingId) {
        const node = nodes.find(n => n.id === selectedId);
        if (node) {
          e.preventDefault();
          handleStartEdit(selectedId, node.label);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [selectedId, editingId, nodes, handleStartEdit]);

  return (
    <div className="flex-1 overflow-auto scrollbar-thin p-4 font-mono text-sm">
      {nodes.map((node) => (
        <div
          key={node.id}
          className={cn(
            'flex items-start gap-2 py-1 px-2 rounded cursor-pointer transition-colors',
            selectedId === node.id && 'bg-secondary',
            selectedId !== node.id && 'hover:bg-secondary/50'
          )}
          style={{ marginLeft: `${node.depth * 24}px` }}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => handleStartEdit(node.id, node.label)}
        >
          <span className="text-muted-foreground select-none">
            {node.depth === 0 ? '•' : '◦'}
          </span>
          <NodeTypeIcon type={node.type} size={12} className="mt-1 flex-shrink-0" />
          
          {editingId === node.id ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={(e) => handleKeyDown(e, node.id)}
              onBlur={() => handleEndEdit(node.id)}
              className="flex-1 bg-background border border-ring rounded px-1 py-0.5 text-sm font-mono outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className="text-foreground">{node.label}</span>
          )}
          
          {Object.keys(node.properties).length > 0 && editingId !== node.id && (
            <span className="text-muted-foreground text-xs">
              ({Object.keys(node.properties).length} props)
            </span>
          )}
        </div>
      ))}
      
      {nodes.length === 0 && (
        <div className="flex items-center justify-center h-32 text-muted-foreground">
          <p className="text-sm">Empty hierarchy</p>
        </div>
      )}
    </div>
  );
}
