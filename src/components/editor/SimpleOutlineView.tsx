import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FlatNode, DropPosition } from '@/types/node';
import { OutlineStyle, getOutlinePrefix } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';


interface SimpleOutlineViewProps {
  nodes: FlatNode[];
  selectedId: string | null;
  outlineStyle: OutlineStyle;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onMove: (nodeId: string, targetId: string, position: DropPosition) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onAddNode: () => void;
  onAddChildNode: () => void;
  onDelete: (id: string) => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
}

export function SimpleOutlineView({
  nodes,
  selectedId,
  outlineStyle,
  onSelect,
  onToggleCollapse,
  onUpdateLabel,
  onIndent,
  onOutdent,
  onAddNode,
  onAddChildNode,
  onDelete,
  onNavigateUp,
  onNavigateDown,
}: SimpleOutlineViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [pendingAutoEdit, setPendingAutoEdit] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Helps us reliably start editing the *newly created* sibling after Enter
  const autoEditAfterIdRef = useRef<string | null>(null);
  const prevNodesRef = useRef<FlatNode[]>(nodes);

  // Calculate indices for each node at each depth
  const nodeIndices = useMemo(() => {
    const indices = new Map<string, number[]>();
    const counters: number[] = [];
    let lastDepth = -1;
    
    for (const node of nodes) {
      // Adjust counters based on depth change
      if (node.depth > lastDepth) {
        // Going deeper - push new counter
        while (counters.length <= node.depth) {
          counters.push(0);
        }
      } else if (node.depth < lastDepth) {
        // Going shallower - reset deeper counters
        counters.length = node.depth + 1;
      }
      
      // Increment counter at current depth
      counters[node.depth] = (counters[node.depth] || 0) + 1;
      
      // Store a copy of current indices for this node
      indices.set(node.id, [...counters.slice(0, node.depth + 1)]);
      lastDepth = node.depth;
    }
    
    return indices;
  }, [nodes]);

  useEffect(() => {
    if (editingId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingId, nodes.length]);


  const handleStartEdit = useCallback((id: string, currentLabel: string) => {
    setEditingId(id);
    setEditValue(currentLabel);
  }, []);

  // After creating a new node via Enter, immediately put the *new* node into edit mode
  useEffect(() => {
    if (!pendingAutoEdit) return;

    const afterId = autoEditAfterIdRef.current;
    const prev = prevNodesRef.current;

    // If a node was added, it should appear right after the current node
    if (afterId && nodes.length > prev.length) {
      const afterIndex = nodes.findIndex((n) => n.id === afterId);
      const candidate = afterIndex >= 0 ? nodes[afterIndex + 1] : null;

      if (candidate) {
        handleStartEdit(candidate.id, candidate.label);
        requestAnimationFrame(() => inputRef.current?.focus());
        setPendingAutoEdit(false);
        autoEditAfterIdRef.current = null;
        return;
      }
    }

    // Fallback: if selection already moved, edit selected
    if (selectedId) {
      const node = nodes.find((n) => n.id === selectedId);
      if (node) {
        handleStartEdit(selectedId, node.label);
        requestAnimationFrame(() => inputRef.current?.focus());
        setPendingAutoEdit(false);
        autoEditAfterIdRef.current = null;
      }
    }
  }, [pendingAutoEdit, selectedId, nodes, handleStartEdit]);

  // Track previous nodes so we can detect when a node was added
  useEffect(() => {
    prevNodesRef.current = nodes;
  }, [nodes]);

  const handleEndEdit = useCallback((id: string) => {
    onUpdateLabel(id, editValue);
    setEditingId(null);
  }, [editValue, onUpdateLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEndEdit(id);
      // Add sibling after current and keep typing
      autoEditAfterIdRef.current = id;
      setPendingAutoEdit(true);
      setTimeout(() => onAddNode(), 0);
    } else if (e.key === 'Escape') {
      setEditingId(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      handleEndEdit(id);
      if (e.shiftKey) {
        onOutdent(id);
      } else {
        onIndent(id);
      }
    } else if (e.key === 'Backspace' && editValue === '') {
      // Delete empty line on backspace
      e.preventDefault();
      setEditingId(null);
      onDelete(id);
    }
  }, [handleEndEdit, onAddNode, onIndent, onOutdent, editValue, onDelete]);

  // Global keyboard handler
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== containerRef.current) return;
      
      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          onNavigateUp();
          break;
        case 'ArrowDown':
          e.preventDefault();
          onNavigateDown();
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedId) {
            const node = nodes.find(n => n.id === selectedId);
            if (node) handleStartEdit(selectedId, node.label);
          } else {
            onAddNode();
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
        case 'Delete':
        case 'Backspace':
          if (selectedId) {
            e.preventDefault();
            onDelete(selectedId);
          }
          break;
        case 'F2':
          if (selectedId) {
            e.preventDefault();
            const node = nodes.find(n => n.id === selectedId);
            if (node) handleStartEdit(selectedId, node.label);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingId, selectedId, nodes, onNavigateUp, onNavigateDown, onAddNode, onAddChildNode, onIndent, onOutdent, onDelete, handleStartEdit]);

  return (
    <div 
      ref={containerRef}
      className="py-1 focus:outline-none" 
      tabIndex={0}
    >
      {nodes.map((node) => {
        const indices = nodeIndices.get(node.id) || [1];
        const prefix = getOutlinePrefix(outlineStyle, node.depth, indices);
        
        return (
          <div
            key={node.id}
            className={cn(
              'flex items-start gap-1 py-0.5 px-1 rounded cursor-text group',
              selectedId === node.id && 'bg-secondary'
            )}
            style={{ paddingLeft: `${node.depth * 20 + 4}px` }}
            onClick={() => {
              onSelect(node.id);
              if (editingId !== node.id) {
                handleStartEdit(node.id, node.label);
              }
            }}
          >
            
            {/* Prefix/numbering */}
            {prefix && (
              <span className="text-muted-foreground font-mono text-sm w-8 flex-shrink-0 text-right pr-1">
                {prefix}
              </span>
            )}
            
            {/* Label - always in edit mode when selected */}
            {editingId === node.id ? (
              <input
                ref={inputRef}
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, node.id)}
                onBlur={() => handleEndEdit(node.id)}
                placeholder="Type here..."
                className="flex-1 bg-transparent border-none outline-none text-sm text-foreground placeholder:text-muted-foreground/50"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className={cn(
                'flex-1 text-sm',
                node.label ? 'text-foreground' : 'text-muted-foreground/50'
              )}>
                {node.label || 'Type here...'}
              </span>
            )}
          </div>
        );
      })}
      
      {nodes.length === 0 && (
        <div className="text-sm text-muted-foreground px-4 py-2">
          Press Enter to add an item
        </div>
      )}
    </div>
  );
}
