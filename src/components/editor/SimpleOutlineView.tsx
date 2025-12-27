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
  onMergeIntoParent: (id: string) => void;
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
  onMergeIntoParent,
}: SimpleOutlineViewProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // Track pending focus after Enter creates new node
  const pendingFocusAfterIdRef = useRef<string | null>(null);
  const prevNodesLengthRef = useRef(nodes.length);

  // Calculate indices for each node at each depth
  const nodeIndices = useMemo(() => {
    const indices = new Map<string, number[]>();
    const counters: number[] = [];
    let lastDepth = -1;
    
    for (const node of nodes) {
      if (node.depth > lastDepth) {
        while (counters.length <= node.depth) {
          counters.push(0);
        }
      } else if (node.depth < lastDepth) {
        counters.length = node.depth + 1;
      }
      
      counters[node.depth] = (counters[node.depth] || 0) + 1;
      indices.set(node.id, [...counters.slice(0, node.depth + 1)]);
      lastDepth = node.depth;
    }
    
    return indices;
  }, [nodes]);

  const handleStartEdit = useCallback((id: string, currentLabel: string) => {
    setEditingId(id);
    setEditValue(currentLabel);
  }, []);

  // When a new node is added after pressing Enter, auto-focus it
  useEffect(() => {
    const afterId = pendingFocusAfterIdRef.current;
    
    // Check if a node was added
    if (afterId && nodes.length > prevNodesLengthRef.current) {
      const afterIndex = nodes.findIndex((n) => n.id === afterId);
      const newNode = afterIndex >= 0 ? nodes[afterIndex + 1] : null;

      if (newNode) {
        handleStartEdit(newNode.id, newNode.label);
        // Focus will happen via the effect below
      }
      pendingFocusAfterIdRef.current = null;
    }
    
    prevNodesLengthRef.current = nodes.length;
  }, [nodes, handleStartEdit]);

  // Focus input when editingId changes
  useEffect(() => {
    if (editingId) {
      requestAnimationFrame(() => {
        const input = inputRefs.current.get(editingId);
        if (input) {
          input.focus();
        }
      });
    }
  }, [editingId]);

  const handleEndEdit = useCallback((id: string) => {
    onUpdateLabel(id, editValue);
    setEditingId(null);
  }, [editValue, onUpdateLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleEndEdit(id);
      // Mark that we want to focus the node created after this one
      pendingFocusAfterIdRef.current = id;
      onAddNode();
    } else if (e.key === 'Escape') {
      setEditingId(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Save current value first
      onUpdateLabel(id, editValue);
      // Indent or outdent
      if (e.shiftKey) {
        onOutdent(id);
      } else {
        onIndent(id);
      }
      // Keep editing the same node - don't call setEditingId(null)
    } else if (e.key === 'Backspace' && editValue === '') {
      e.preventDefault();
      setEditingId(null);
      onDelete(id);
    } else if (e.key === 'F9' && e.shiftKey) {
      // Shift+F9: Merge into parent with line break (WordPerfect style)
      e.preventDefault();
      onUpdateLabel(id, editValue);
      setEditingId(null);
      onMergeIntoParent(id);
    }
  }, [handleEndEdit, onAddNode, onIndent, onOutdent, editValue, onDelete, onUpdateLabel, onMergeIntoParent]);

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
        case 'F9':
          if (e.shiftKey && selectedId) {
            e.preventDefault();
            onMergeIntoParent(selectedId);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingId, selectedId, nodes, onNavigateUp, onNavigateDown, onAddNode, onAddChildNode, onIndent, onOutdent, onDelete, handleStartEdit, onMergeIntoParent]);

  // Callback ref to store input references
  const setInputRef = useCallback((id: string) => (el: HTMLInputElement | null) => {
    if (el) {
      inputRefs.current.set(id, el);
    } else {
      inputRefs.current.delete(id);
    }
  }, []);

  return (
    <div 
      ref={containerRef}
      className="p-4 focus:outline-none" 
      tabIndex={0}
    >
      {nodes.map((node) => {
        const indices = nodeIndices.get(node.id) || [1];
        const prefix = getOutlinePrefix(outlineStyle, node.depth, indices);
        
        return (
          <div
            key={node.id}
            className={cn(
              'flex items-start gap-2 py-1.5 px-2 rounded cursor-text group',
              selectedId === node.id && 'bg-secondary'
            )}
            style={{ paddingLeft: `${node.depth * 24 + 8}px` }}
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
                ref={setInputRef(node.id)}
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
                'flex-1 text-sm whitespace-pre-wrap',
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
