import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { FlatNode, DropPosition } from '@/types/node';
import { OutlineStyle, getOutlinePrefix, getOutlinePrefixCustom, MixedStyleConfig, DEFAULT_MIXED_CONFIG, getLevelStyle } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';

interface SimpleOutlineViewProps {
  nodes: FlatNode[];
  selectedId: string | null;
  outlineStyle: OutlineStyle;
  mixedConfig?: MixedStyleConfig;
  autoFocusId?: string | null;
  onAutoFocusHandled?: () => void;
  onSelect: (id: string) => void;
  onToggleCollapse: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onMove: (nodeId: string, targetId: string, position: DropPosition) => void;
  onIndent: (id: string) => void;
  onOutdent: (id: string) => void;
  onVisualIndent?: (id: string, delta: number) => void;
  onAddNode: (afterId?: string | null) => void;
  onAddBodyNode: (afterId?: string | null) => string | undefined;
  onAddBodyNodeWithSpacer?: (afterId?: string | null) => string | undefined;
  onAddChildNode: (parentId?: string) => string | undefined;
  onDelete: (id: string) => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  onMergeIntoParent: (
    id: string,
    currentValue?: string,
    showToast?: boolean
  ) => { targetId: string; targetLabel: string } | null;
  autoDescend?: boolean;
}

export const SimpleOutlineView = forwardRef<HTMLDivElement, SimpleOutlineViewProps>(function SimpleOutlineView(
  {
    nodes,
    selectedId,
    outlineStyle,
    mixedConfig = DEFAULT_MIXED_CONFIG,
    autoFocusId,
    onAutoFocusHandled,
    onSelect,
    onToggleCollapse,
    onUpdateLabel,
    onIndent,
    onOutdent,
    onVisualIndent,
    onAddNode,
    onAddBodyNode,
    onAddBodyNodeWithSpacer,
    onAddChildNode,
    onDelete,
    onNavigateUp,
    onNavigateDown,
    onMergeIntoParent,
    autoDescend = false,
  },
  forwardedRef
) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  // If a parent passes a ref, we attach it to our focusable container.
  const setContainerRef = useCallback(
    (el: HTMLDivElement | null) => {
      containerRef.current = el;
      if (!forwardedRef) return;
      if (typeof forwardedRef === 'function') {
        forwardedRef(el);
      } else {
        forwardedRef.current = el;
      }
    },
    [forwardedRef]
  );

  // Track pending focus - stores exact new node ID to focus
  const pendingNewNodeIdRef = useRef<string | null>(null);
  const pendingFocusAfterIdRef = useRef<string | null>(null);
  const prevNodesLengthRef = useRef(nodes.length);

  // Calculate indices for each node at each depth (skip body nodes)
  const nodeIndices = useMemo(() => {
    const indices = new Map<string, number[]>();
    const counters: number[] = [];
    let lastDepth = -1;
    
    for (const node of nodes) {
      // Body nodes don't get numbered - they inherit the previous index
      if (node.type === 'body') {
        // Use the same indices as the last numbered node at this depth
        indices.set(node.id, [...counters.slice(0, node.depth + 1)]);
        continue;
      }
      
      // Going deeper: initialize new depth levels to 0
      if (node.depth > lastDepth) {
        while (counters.length <= node.depth) {
          counters.push(0);
        }
      } 
      // Going shallower: truncate and reset deeper levels
      else if (node.depth < lastDepth) {
        // Reset counters for levels deeper than current
        for (let i = node.depth + 1; i < counters.length; i++) {
          counters[i] = 0;
        }
      }
      
      // Increment the counter for current depth (ensure it's at least 1)
      counters[node.depth] = (counters[node.depth] ?? 0) + 1;
      indices.set(node.id, [...counters.slice(0, node.depth + 1)]);
      lastDepth = node.depth;
    }
    
    return indices;
  }, [nodes]);

  const handleStartEdit = useCallback((id: string, currentLabel: string) => {
    setEditingId(id);
    setEditValue(currentLabel);
  }, []);

  // Auto-focus on initial mount if autoFocusId is provided
  const autoFocusHandledRef = useRef(false);
  useEffect(() => {
    if (autoFocusId && nodes.length > 0 && !autoFocusHandledRef.current) {
      const node = nodes.find(n => n.id === autoFocusId);
      if (node) {
        autoFocusHandledRef.current = true;
        handleStartEdit(autoFocusId, node.label);
        onAutoFocusHandled?.();
      }
    }
  }, [autoFocusId, nodes, handleStartEdit, onAutoFocusHandled]);

  // When a new node is added after pressing Enter, auto-focus it
  useEffect(() => {
    // First priority: focus node by exact ID (for body node shortcuts)
    const newNodeId = pendingNewNodeIdRef.current;
    if (newNodeId) {
      const newNode = nodes.find(n => n.id === newNodeId);
      if (newNode) {
        handleStartEdit(newNode.id, newNode.label);
        pendingNewNodeIdRef.current = null;
        prevNodesLengthRef.current = nodes.length;
        return;
      }
      // If the node isn't in the list yet (batched state updates), keep the id for next render.
    }
    
    // Second priority: focus node after anchor (for regular Enter)
    const afterId = pendingFocusAfterIdRef.current;
    if (afterId && nodes.length > prevNodesLengthRef.current) {
      const afterIndex = nodes.findIndex((n) => n.id === afterId);
      const newNode = afterIndex >= 0 ? nodes[afterIndex + 1] : null;

      if (newNode) {
        handleStartEdit(newNode.id, newNode.label);
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
          const len = input.value.length;
          input.selectionStart = len;
          input.selectionEnd = len;
        }
      });
    }
  }, [editingId]);

  const handleEndEdit = useCallback((id: string) => {
    onUpdateLabel(id, editValue);
    setEditingId(null);
  }, [editValue, onUpdateLabel]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>, node: FlatNode) => {
    // Prevent key-repeat (holding Enter) from creating many empty nodes.
    if (e.key === 'Enter' && (e as any).repeat) {
      e.preventDefault();
      return;
    }

    const insertLineBreak = () => {
      e.preventDefault();
      const input = e.currentTarget;
      const start = input.selectionStart ?? editValue.length;
      const end = input.selectionEnd ?? editValue.length;
      const nextValue = `${editValue.slice(0, start)}\n${editValue.slice(end)}`;
      setEditValue(nextValue);
      requestAnimationFrame(() => {
        input.selectionStart = input.selectionEnd = start + 1;
      });
    };

    // BODY NODES: Enter should continue the same block (newline), not create a new node.
    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey && node.type === 'body') {
      insertLineBreak();
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      handleEndEdit(node.id);
      if (autoDescend) {
        // Auto-descend: create child node and focus it
        const newId = onAddChildNode(node.id);
        if (newId) {
          pendingNewNodeIdRef.current = newId;
        }
      } else {
        // Normal: create sibling node after this one
        pendingFocusAfterIdRef.current = node.id;
        onAddNode(node.id);
      }
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      // Ctrl+Enter: create spacer + body node (two nodes, focus the second)
      e.preventDefault();
      handleEndEdit(node.id);
      if (onAddBodyNodeWithSpacer) {
        const newId = onAddBodyNodeWithSpacer(node.id);
        if (newId) {
          pendingNewNodeIdRef.current = newId;
        }
      } else {
        // Fallback to single body node
        const newId = onAddBodyNode(node.id);
        if (newId) {
          pendingNewNodeIdRef.current = newId;
        }
      }
    } else if (e.key === '/' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+/: create single body node, focus it
      e.preventDefault();
      handleEndEdit(node.id);
      const newId = onAddBodyNode(node.id);
      if (newId) {
        pendingNewNodeIdRef.current = newId;
      }
    } else if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter: insert a line break inside the current item
      insertLineBreak();
    } else if (e.key === 'Escape') {
      if (e.shiftKey) {
        // Shift+Esc: Merge into previous sibling with line break
        e.preventDefault();
        const result = onMergeIntoParent(node.id, editValue);
        if (result) {
          setEditingId(result.targetId);
          setEditValue(result.targetLabel);
        } else {
          setEditingId(null);
        }
      } else {
        setEditingId(null);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      // Save current value first
      onUpdateLabel(node.id, editValue);
      // Indent or outdent
      if (e.shiftKey) {
        onOutdent(node.id);
      } else {
        onIndent(node.id);
      }
      // Keep editing the same node - don't call setEditingId(null)
    } else if (e.key === 'Backspace' && editValue === '') {
      // Empty line - delete it and move cursor to previous line
      e.preventDefault();
      
      // Find the previous node to move cursor to
      const currentIndex = nodes.findIndex(n => n.id === node.id);
      const prevNode = currentIndex > 0 ? nodes[currentIndex - 1] : null;
      
      onDelete(node.id);
      
      if (prevNode) {
        setEditingId(prevNode.id);
        setEditValue(prevNode.label);
        // Position cursor at end of previous line
        requestAnimationFrame(() => {
          const prevInput = inputRefs.current.get(prevNode.id);
          if (prevInput) {
            prevInput.focus();
            prevInput.selectionStart = prevInput.selectionEnd = prevNode.label.length;
          }
        });
      } else {
        setEditingId(null);
      }
    } else if (e.key === 'Backspace') {
      // Check if cursor is at the beginning of the line
      const input = e.currentTarget;
      const cursorPos = input.selectionStart ?? 0;
      
      if (cursorPos === 0 && input.selectionEnd === 0) {
        // At beginning of line with content - try to merge into previous line
        // Don't prevent default yet - only if merge succeeds
        const result = onMergeIntoParent(node.id, editValue, false); // false = no toast for backspace merge
        if (result) {
          e.preventDefault();
          // Calculate merge point: where the original target label ended (before the newline we added)
          const originalTargetLength = result.targetLabel.length - editValue.length - 1; // -1 for newline
          setEditingId(result.targetId);
          setEditValue(result.targetLabel);
          // Position cursor at the merge point
          requestAnimationFrame(() => {
            const newInput = inputRefs.current.get(result.targetId);
            if (newInput) {
              newInput.focus();
              const pos = Math.max(0, originalTargetLength);
              newInput.selectionStart = newInput.selectionEnd = pos;
            }
          });
        }
        // If merge returns null, don't prevent default - backspace just won't do anything special
        // at position 0 of the first line (which is expected behavior)
      }
      // Otherwise let backspace work normally (delete character before cursor)
    } else if (e.key === ']' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+]: Visual indent (Block Tab) for body nodes
      e.preventDefault();
      if (node.type === 'body' && onVisualIndent) {
        onVisualIndent(node.id, 1);
      }
    } else if (e.key === '[' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+[: Visual outdent (Block Tab) for body nodes
      e.preventDefault();
      if (node.type === 'body' && onVisualIndent) {
        onVisualIndent(node.id, -1);
      }
    }
  }, [handleEndEdit, onAddNode, onAddBodyNode, onAddBodyNodeWithSpacer, onAddChildNode, onIndent, onOutdent, onVisualIndent, editValue, onDelete, onUpdateLabel, onMergeIntoParent, autoDescend, nodes]);

  // Global keyboard handler
  useEffect(() => {
    if (!containerRef.current) return;
    
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (editingId) return;
      if (!containerRef.current?.contains(document.activeElement) && document.activeElement !== containerRef.current) return;

      // Prevent key-repeat (holding Enter) from creating many empty nodes.
      if (e.key === 'Enter' && e.repeat) {
        e.preventDefault();
        return;
      }
      
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
            onAddNode(null);
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
        case 'Escape':
          if (e.shiftKey && selectedId) {
            e.preventDefault();
            const current = nodes.find(n => n.id === selectedId);
            const result = onMergeIntoParent(selectedId, current?.label);
            // We'll naturally render the updated state; editing can be started by clicking.
            // (We avoid forcing edit mode here because state updates happen in the parent.)
            void result;
          }
          break;
      }
      
      // Handle Ctrl+] and Ctrl+[ for visual indent (using e.code for reliability)
      if ((e.ctrlKey || e.metaKey) && selectedId) {
        if (e.code === 'BracketRight' || e.key === ']') {
          const node = nodes.find(n => n.id === selectedId);
          if (node?.type === 'body' && onVisualIndent) {
            e.preventDefault();
            onVisualIndent(selectedId, 1);
          }
        } else if (e.code === 'BracketLeft' || e.key === '[') {
          const node = nodes.find(n => n.id === selectedId);
          if (node?.type === 'body' && onVisualIndent) {
            e.preventDefault();
            onVisualIndent(selectedId, -1);
          }
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [editingId, selectedId, nodes, onNavigateUp, onNavigateDown, onAddNode, onAddChildNode, onIndent, onOutdent, onVisualIndent, onDelete, handleStartEdit, onMergeIntoParent]);

  // Callback ref to store input references
  const setInputRef = useCallback((id: string) => (el: HTMLTextAreaElement | null) => {
    if (el) {
      inputRefs.current.set(id, el);
    } else {
      inputRefs.current.delete(id);
    }
  }, []);

  return (
    <div 
      ref={setContainerRef}
      className="py-2 focus:outline-none" 
      tabIndex={0}
    >
      {nodes.map((node) => {
        const indices = nodeIndices.get(node.id) || [1];
        const isBody = node.type === 'body';
        const prefix = isBody ? '' : (
          outlineStyle === 'mixed' 
            ? getOutlinePrefixCustom(node.depth, indices, mixedConfig)
            : getOutlinePrefix(outlineStyle, node.depth, indices)
        );
        
        // Get level styling for mixed mode
        const levelStyle = outlineStyle === 'mixed' && !isBody
          ? getLevelStyle(node.depth, mixedConfig)
          : { underline: false, suffix: '' };

        // Body nodes are logically children, but should visually align under the parent's text.
        // Also add visualIndent for Block Tab feature
        const visualDepth = isBody 
          ? Math.max(0, node.depth - 1) + (node.visualIndent || 0)
          : node.depth;
        
        return (
          <div
            key={node.id}
            className={cn(
              'grid items-start py-1.5 px-2 cursor-text group'
            )}
            style={{ 
              paddingLeft: `${visualDepth * 24 + 8}px`,
              gridTemplateColumns: '3.5rem 1fr'
            }}
            onClick={() => {
              onSelect(node.id);
              if (editingId !== node.id) {
                handleStartEdit(node.id, node.label);
              }
            }}
          >
            
            {/* Prefix/numbering - body nodes get empty spacer for alignment */}
            <span className={cn(
              "font-mono text-sm leading-6 text-right pr-2 whitespace-nowrap pt-px",
              prefix ? "text-muted-foreground" : ""
            )}>
              {prefix || ''}
            </span>
            
            {/* Label - always in edit mode when selected */}
            {editingId === node.id ? (
              <textarea
                ref={setInputRef(node.id)}
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, node)}
                onBlur={() => handleEndEdit(node.id)}
                placeholder=""
                rows={Math.min(12, Math.max(1, editValue.split('\n').length))}
                style={{ caretColor: 'hsl(var(--primary))' }}
                className={cn(
                  "bg-transparent border-none outline-none text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-none whitespace-pre-wrap leading-6",
                  levelStyle.underline && editValue && "underline decoration-foreground"
                )}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="text-sm font-mono whitespace-pre-wrap leading-6">
                <span className={cn(
                  node.label ? 'text-foreground' : 'text-muted-foreground/50',
                  levelStyle.underline && node.label && 'underline'
                )}>
                  {node.label || ''}
                </span>
                {levelStyle.suffix && node.label && (
                  <span className="text-foreground">{levelStyle.suffix}</span>
                )}
              </span>
            )}
          </div>
        );
      })}
      
      {nodes.length === 0 && (
        <div className="text-sm text-muted-foreground/50 px-4 py-2 italic">
          Press Enter to add an item
        </div>
      )}
    </div>
  );
});
