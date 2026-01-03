import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { FlatNode, DropPosition, HierarchyNode } from '@/types/node';
import { OutlineStyle, getOutlinePrefix, getOutlinePrefixCustom, MixedStyleConfig, DEFAULT_MIXED_CONFIG, getLevelStyle } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';
import { useEditorContext } from './EditorContext';
import { toast } from '@/hooks/use-toast';
import { SmartPasteDialog, SmartPasteAction } from './SmartPasteDialog';
import { analyzeOutlineText, SmartPasteResult } from '@/lib/outlinePasteParser';
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
  onCopyNode?: (id: string) => HierarchyNode | null;
  onPasteNodes?: (afterId: string, nodes: HierarchyNode[]) => string | undefined;
  onPasteHierarchy?: (afterId: string, items: Array<{ label: string; depth: number }>) => void;
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
    onCopyNode,
    onPasteNodes,
    onPasteHierarchy,
    autoDescend = false,
  },
  forwardedRef
) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [highlightedNodeId, setHighlightedNodeId] = useState<string | null>(null);
  const inputRefs = useRef<Map<string, HTMLTextAreaElement>>(new Map());
  const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);
  const { setSelectedText, setSelectionSource, nodeClipboard, setNodeClipboard, setInsertTextAtCursor, setScrollToNode, editor } = useEditorContext();

  // Track last focused position for term insertion when clicking sidebar
  const lastFocusedNodeIdRef = useRef<string | null>(null);
  const lastCursorPositionRef = useRef<{ start: number; end: number }>({ start: 0, end: 0 });
  const lastEditValueRef = useRef<string>('');

  // Smart paste dialog state
  const [smartPasteDialogOpen, setSmartPasteDialogOpen] = useState(false);
  const [smartPasteData, setSmartPasteData] = useState<SmartPasteResult | null>(null);
  const smartPasteNodeIdRef = useRef<string | null>(null);

  // Track mouse drag state for distinguishing clicks from text selection
  const mouseDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDragRef = useRef(false);

  // Track text selection in textarea and include source context
  const handleSelectionChange = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>, nodePrefix: string, nodeLabel: string) => {
    const textarea = e.currentTarget;
    const selectedText = textarea.value.substring(
      textarea.selectionStart,
      textarea.selectionEnd
    );
    setSelectedText(selectedText);
    if (selectedText) {
      setSelectionSource({ nodePrefix, nodeLabel });
    }
    
    // Track cursor position for term insertion
    lastCursorPositionRef.current = { start: textarea.selectionStart, end: textarea.selectionEnd };
    lastEditValueRef.current = textarea.value;
  }, [setSelectedText, setSelectionSource]);

  useEffect(() => {
    editingIdRef.current = editingId;
  }, [editingId]);

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

  // Stable ref callbacks cache - prevents ref churn on re-renders
  const inputRefCallbacks = useRef(new Map<string, (el: HTMLTextAreaElement | null) => void>());
  // Track when we just entered edit mode (to force cursor to end only on entry)
  const justStartedEditingRef = useRef<string | null>(null);
  // Track whether edit was started programmatically (should move cursor to end) vs mouse click (browser places cursor)
  const editIntentRef = useRef<'mouse' | 'program' | null>(null);

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

  const handleStartEdit = useCallback(
    (
      id: string,
      currentLabel: string,
      options?: { placeCursor?: 'end' }
    ) => {
      // Track intent for cursor placement
      if (options?.placeCursor === 'end') {
        editIntentRef.current = 'program';
        justStartedEditingRef.current = id;
      } else {
        editIntentRef.current = 'mouse';
      }

      setEditingId(id);
      setEditValue(currentLabel);
    },
    []
  );

  // Auto-focus on initial mount if autoFocusId is provided
  const autoFocusHandledRef = useRef(false);
  useEffect(() => {
    if (autoFocusId && nodes.length > 0 && !autoFocusHandledRef.current) {
      const node = nodes.find(n => n.id === autoFocusId);
      if (node) {
        autoFocusHandledRef.current = true;
        handleStartEdit(autoFocusId, node.label, { placeCursor: 'end' });
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
        handleStartEdit(newNode.id, newNode.label, { placeCursor: 'end' });
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
        handleStartEdit(newNode.id, newNode.label, { placeCursor: 'end' });
      }
      pendingFocusAfterIdRef.current = null;
    }
    
    prevNodesLengthRef.current = nodes.length;
  }, [nodes, handleStartEdit]);

  // Focus textarea when editingId is set programmatically (e.g., from handleStartEdit for Enter/F2)
  useEffect(() => {
    if (!editingId) return;
    // Only focus if it was a programmatic start (not from textarea onFocus)
    if (editIntentRef.current === 'program') {
      const input = inputRefs.current.get(editingId);
      if (input && document.activeElement !== input) {
        input.focus();
      }
    }
  }, [editingId]);

  const handleEndEdit = useCallback((id: string) => {
    // If a blur from a previous textarea fires after we've already moved edit focus,
    // ignore it (this prevents auto-descend focus from being cancelled).
    if (editingIdRef.current !== id) return;

    onUpdateLabel(id, editValue);
    setEditingId(null);
  }, [editValue, onUpdateLabel]);

  // Register insert-at-cursor function for term insertion from sidebar
  useEffect(() => {
    const insertFn = (text: string) => {
      // Try current editing session first
      let targetNodeId = editingIdRef.current;
      let textarea = targetNodeId ? inputRefs.current.get(targetNodeId) : null;
      let cursorStart = textarea?.selectionStart ?? 0;
      let cursorEnd = textarea?.selectionEnd ?? 0;
      let currentVal = textarea?.value ?? '';

      // Fallback to last focused position if not currently editing
      if (!textarea && lastFocusedNodeIdRef.current) {
        targetNodeId = lastFocusedNodeIdRef.current;
        textarea = inputRefs.current.get(targetNodeId);
        cursorStart = lastCursorPositionRef.current.start;
        cursorEnd = lastCursorPositionRef.current.end;
        currentVal = lastEditValueRef.current;
        
        // Re-enter edit mode for this node
        if (textarea && targetNodeId) {
          const node = nodes.find(n => n.id === targetNodeId);
          if (node) {
            setEditingId(targetNodeId);
            setEditValue(currentVal);
          }
        }
      }

      if (!textarea || !targetNodeId) return null;

      const node = nodes.find(n => n.id === targetNodeId);
      if (!node) return null;

      // Insert text at cursor position
      const newVal = currentVal.slice(0, cursorStart) + text + currentVal.slice(cursorEnd);
      
      // Update state
      setEditValue(newVal);
      
      // Update cursor position after React re-renders
      const finalNodeId = targetNodeId;
      requestAnimationFrame(() => {
        const el = inputRefs.current.get(finalNodeId);
        if (el) {
          const newPos = cursorStart + text.length;
          el.selectionStart = newPos;
          el.selectionEnd = newPos;
          el.focus();
        }
      });

      // Calculate FULL hierarchical prefix for this node (e.g., "1.a.b." not just "b.")
      const isBody = node.type === 'body';
      const indices = nodeIndices.get(node.id) || [1];
      
      // Build full hierarchical prefix path
      const fullPrefix = isBody ? '' : (() => {
        if (outlineStyle === 'legal') {
          return indices.slice(0, node.depth + 1).join('.') + '.';
        }
        // For mixed/other styles, build path from each level
        return indices.slice(0, node.depth + 1).map((idx, d) => {
          const levelPrefix = outlineStyle === 'mixed'
            ? getOutlinePrefixCustom(d, indices, mixedConfig)
            : getOutlinePrefix(outlineStyle, d, indices.slice(0, d + 1).map((_, i) => indices[i]));
          // Remove trailing punctuation for compact display
          return levelPrefix.replace(/[.\s]+$/, '').replace(/^\(|\)$/g, '');
        }).join('') + '.';
      })();

      return { nodePrefix: fullPrefix, nodeLabel: newVal };
    };

    setInsertTextAtCursor(insertFn);

    return () => {
      setInsertTextAtCursor(null);
    };
  }, [nodes, nodeIndices, outlineStyle, mixedConfig, setInsertTextAtCursor]);

  // Register scroll-to-node function for term usage navigation
  useEffect(() => {
    const scrollFn = (nodeId: string) => {
      const nodeEl = nodeRefs.current.get(nodeId);
      if (nodeEl) {
        // Scroll node into view
        nodeEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Trigger highlight animation
        setHighlightedNodeId(nodeId);
        
        // Clear highlight after animation completes
        setTimeout(() => {
          setHighlightedNodeId(null);
        }, 1500);
      }
    };

    setScrollToNode(scrollFn);

    return () => {
      setScrollToNode(null);
    };
  }, [setScrollToNode]);

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
        // Escape: exit outline and return focus to main TipTap editor
        e.preventDefault();
        setEditingId(null);
        if (editor) {
          editor.chain().focus().run();
        }
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
    } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+C: Copy node if no text selection
      const textarea = e.currentTarget;
      const hasTextSelection = textarea.selectionStart !== textarea.selectionEnd;
      if (!hasTextSelection && onCopyNode) {
        e.preventDefault();
        const copied = onCopyNode(node.id);
        if (copied) {
          setNodeClipboard([copied]);
          toast({ title: 'Copied', description: `"${copied.label.slice(0, 30)}${copied.label.length > 30 ? '...' : ''}"` });
        }
      }
      // If there's text selection, let default copy behavior work
    } else if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
      // Ctrl+V: Paste nodes if clipboard has nodes and no text in system clipboard
      if (nodeClipboard && nodeClipboard.length > 0 && onPasteNodes) {
        e.preventDefault();
        const newId = onPasteNodes(node.id, nodeClipboard);
        if (newId) {
          toast({ title: 'Pasted', description: `${nodeClipboard.length} item(s)` });
        }
      }
      // Otherwise let default paste behavior work for text
    }
  }, [handleEndEdit, onAddNode, onAddBodyNode, onAddBodyNodeWithSpacer, onAddChildNode, onIndent, onOutdent, onVisualIndent, editValue, onDelete, onUpdateLabel, onMergeIntoParent, autoDescend, nodes, onCopyNode, onPasteNodes, nodeClipboard, setNodeClipboard]);

  // Handle paste event to detect outline patterns
  const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>, nodeId: string) => {
    const text = e.clipboardData.getData('text/plain');
    if (!text) return;

    // Analyze the pasted text for outline patterns
    const analysis = analyzeOutlineText(text);
    
    if (analysis.hasOutlinePatterns) {
      // Show dialog to let user choose how to handle it
      e.preventDefault();
      smartPasteNodeIdRef.current = nodeId;
      setSmartPasteData(analysis);
      setSmartPasteDialogOpen(true);
    }
    // Otherwise let normal paste happen
  }, []);

  // Handle smart paste action from dialog
  const handleSmartPasteAction = useCallback((action: SmartPasteAction, data?: string | Array<{ label: string; depth: number }>) => {
    const nodeId = smartPasteNodeIdRef.current;
    if (!nodeId) return;

    const textarea = inputRefs.current.get(nodeId);
    
    if (action === 'cancel') {
      // Refocus the textarea
      textarea?.focus();
      return;
    }

    if (action === 'strip' || action === 'raw') {
      // Insert text at cursor position
      const textToInsert = data as string;
      if (textarea) {
        const start = textarea.selectionStart ?? 0;
        const end = textarea.selectionEnd ?? 0;
        const currentVal = textarea.value;
        const newVal = currentVal.slice(0, start) + textToInsert + currentVal.slice(end);
        setEditValue(newVal);
        
        requestAnimationFrame(() => {
          const el = inputRefs.current.get(nodeId);
          if (el) {
            const newPos = start + textToInsert.length;
            el.selectionStart = newPos;
            el.selectionEnd = newPos;
            el.focus();
            // Resize textarea
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          }
        });
      }
    } else if (action === 'hierarchy' && onPasteHierarchy) {
      // Create hierarchy nodes
      const items = data as Array<{ label: string; depth: number }>;
      onPasteHierarchy(nodeId, items);
      toast({ title: 'Imported', description: `${items.length} outline item(s)` });
    }

    setSmartPasteData(null);
    smartPasteNodeIdRef.current = null;
  }, [onPasteHierarchy]);

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
            if (node) handleStartEdit(selectedId, node.label, { placeCursor: 'end' });
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

  // Stable ref callback getter - returns same function instance per node ID
  const getInputRefCallback = useCallback((id: string) => {
    let callback = inputRefCallbacks.current.get(id);
    if (!callback) {
      callback = (el: HTMLTextAreaElement | null) => {
        if (el) {
          inputRefs.current.set(id, el);
          // Auto-resize on mount
          requestAnimationFrame(() => {
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
          });
        } else {
          inputRefs.current.delete(id);
        }
      };
      inputRefCallbacks.current.set(id, callback);
    }
    return callback;
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
        
        // Build full hierarchical prefix for source attribution (e.g., "1.a." or "1a")
        const fullPrefix = isBody ? '' : (() => {
          if (outlineStyle === 'legal') {
            return indices.slice(0, node.depth + 1).join('.') + '.';
          }
          // For mixed/other styles, build path from each level
          return indices.slice(0, node.depth + 1).map((idx, d) => {
            const levelPrefix = outlineStyle === 'mixed'
              ? getOutlinePrefixCustom(d, indices, mixedConfig)
              : getOutlinePrefix(outlineStyle, d, indices.slice(0, d + 1).map((_, i) => indices[i]));
            // Remove trailing punctuation for compact display
            return levelPrefix.replace(/[.\s]+$/, '').replace(/^\(|\)$/g, '');
          }).join('') + '.';
        })();
        
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
            ref={(el) => {
              if (el) {
                nodeRefs.current.set(node.id, el);
              } else {
                nodeRefs.current.delete(node.id);
              }
            }}
            className={cn(
              'grid items-start py-1.5 px-2 cursor-text group transition-all duration-300',
              highlightedNodeId === node.id && 'bg-accent/30 ring-2 ring-accent/50 rounded-md'
            )}
            style={{ 
              paddingLeft: `${visualDepth * 24 + 8}px`,
              gridTemplateColumns: '3.5rem 1fr'
            }}
            onMouseDown={(e) => {
              // Capture mouse down position to detect drag vs click
              mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
              isDragRef.current = false;
            }}
            onMouseUp={(e) => {
              // Calculate movement to distinguish click from drag
              const downPos = mouseDownPosRef.current;
              if (downPos) {
                const dx = Math.abs(e.clientX - downPos.x);
                const dy = Math.abs(e.clientY - downPos.y);
                isDragRef.current = dx > 5 || dy > 5;
              }
              mouseDownPosRef.current = null;
              
              // If it was a drag (text selection), preserve the selection - don't move cursor
              if (isDragRef.current) {
                return;
              }
              
              // True click in prefix area - focus textarea and move cursor to end
              const target = e.target as HTMLElement;
              if (target.tagName !== 'TEXTAREA') {
                const textarea = inputRefs.current.get(node.id);
                if (textarea) {
                  textarea.focus();
                  const len = textarea.value.length;
                  textarea.selectionStart = len;
                  textarea.selectionEnd = len;
                }
              }
            }}
            onClick={(e) => {
              e.stopPropagation();
            }}
          >
            
            {/* Prefix/numbering - body nodes get empty spacer for alignment */}
            <span className={cn(
              "font-mono text-sm leading-6 text-right pr-2 whitespace-nowrap",
              prefix ? "text-muted-foreground" : ""
            )}>
              {prefix || ''}
            </span>
            
            {/* Label + suffix container - keeps them in same grid cell */}
            <div className="flex items-start min-w-0">
              {(() => {
                const displayValue =
                  editingId === node.id
                    ? editValue
                    : levelStyle.suffix && node.label
                      ? `${node.label}${levelStyle.suffix}`
                      : node.label;

                const shouldUnderline =
                  levelStyle.underline && (editingId === node.id ? editValue : node.label);

                return (
                  <>
                    <textarea
                      ref={getInputRefCallback(node.id)}
                      value={displayValue}
                      onChange={(e) => {
                        if (editingId !== node.id) return;
                        setEditValue(e.target.value);
                        // Auto-resize textarea to fit content including visual wraps
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      }}
                      onKeyDown={(e) => {
                        if (editingId !== node.id) return;
                        handleKeyDown(e, node);
                      }}
                      onPaste={(e) => {
                        if (editingId !== node.id) return;
                        handlePaste(e, node.id);
                      }}
                      onSelect={(e) => {
                        // Allow selection tracking even during focus transition
                        handleSelectionChange(e, fullPrefix, node.label);
                      }}
                      onMouseDown={(e) => {
                        // Track drag start position for this textarea
                        mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
                        isDragRef.current = false;
                        e.stopPropagation();
                      }}
                      onMouseUp={(e) => {
                        // Check if this was a drag (text selection)
                        const downPos = mouseDownPosRef.current;
                        if (downPos) {
                          const dx = Math.abs(e.clientX - downPos.x);
                          const dy = Math.abs(e.clientY - downPos.y);
                          isDragRef.current = dx > 5 || dy > 5;
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      onFocus={(e) => {
                        // Track this as the last focused node for term insertion
                        lastFocusedNodeIdRef.current = node.id;

                        // If not already editing this node, enter edit mode
                        if (editingId !== node.id) {
                          onSelect(node.id);
                          setEditingId(node.id);
                          setEditValue(node.label);

                          // For programmatic focus (from handleStartEdit), move cursor to end
                          if (
                            editIntentRef.current === 'program' &&
                            justStartedEditingRef.current === node.id
                          ) {
                            requestAnimationFrame(() => {
                              const el = inputRefs.current.get(node.id);
                              if (el) {
                                const len = el.value.length;
                                el.selectionStart = len;
                                el.selectionEnd = len;
                              }
                              justStartedEditingRef.current = null;
                              editIntentRef.current = null;
                            });
                          }
                          // For mouse focus, browser already placed cursor correctly - don't move it
                        }

                        lastCursorPositionRef.current = {
                          start: e.target.selectionStart,
                          end: e.target.selectionEnd,
                        };
                        lastEditValueRef.current = e.target.value;

                        // Ensure proper height when textarea receives focus
                        requestAnimationFrame(() => {
                          e.target.style.height = 'auto';
                          e.target.style.height = `${e.target.scrollHeight}px`;
                        });
                      }}
                      onBlur={(e) => {
                        // Save final cursor position before blur
                        lastCursorPositionRef.current = {
                          start: e.target.selectionStart,
                          end: e.target.selectionEnd,
                        };
                        lastEditValueRef.current = e.target.value;

                        const next = e.relatedTarget as HTMLElement | null;
                        // Clicking sidebar toggles should not kick you out of editing
                        if (next?.closest('[data-editor-sidebar]')) {
                          requestAnimationFrame(() => {
                            inputRefs.current.get(node.id)?.focus();
                          });
                          return;
                        }

                        if (editingId === node.id) {
                          handleEndEdit(node.id);
                        }
                      }}
                      placeholder=""
                      rows={1}
                      style={{
                        caretColor:
                          editingId === node.id
                            ? 'hsl(var(--primary))'
                            : 'transparent',
                      }}
                      className={cn(
                        "w-full min-w-0 bg-transparent border-none outline-none p-0 m-0 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-none whitespace-pre-wrap break-words leading-6 select-text cursor-text",
                        shouldUnderline && "underline decoration-foreground",
                        !node.label && editingId !== node.id && "text-muted-foreground/50"
                      )}
                    />

                    {/* While editing, keep suffix visible but not part of the editable value */}
                    {levelStyle.suffix && editingId === node.id && editValue && (
                      <span
                        className={cn(
                          "text-foreground text-sm font-mono leading-6 select-none",
                          shouldUnderline && "underline decoration-foreground"
                        )}
                      >
                        {levelStyle.suffix}
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        );
      })}
      
      {nodes.length === 0 && (
        <div className="text-sm text-muted-foreground/50 px-4 py-2 italic">
          Press Enter to add an item
        </div>
      )}

      {/* Smart Paste Dialog */}
      <SmartPasteDialog
        open={smartPasteDialogOpen}
        onOpenChange={setSmartPasteDialogOpen}
        pasteData={smartPasteData}
        onAction={handleSmartPasteAction}
      />
    </div>
  );
});
