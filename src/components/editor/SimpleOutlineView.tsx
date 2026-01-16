import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef } from 'react';
import { FlatNode, DropPosition, HierarchyNode } from '@/types/node';
import { OutlineStyle, getOutlinePrefix, getOutlinePrefixCustom, MixedStyleConfig, DEFAULT_MIXED_CONFIG, getLevelStyle } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';
import { useEditorContext, DefinedTerm, HighlightMode } from './EditorContext';
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
  onAddNode: (afterId?: string | null) => string | undefined;
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
  /** Handler for navigating to a linked document */
  onNavigateToLinkedDocument?: (documentId: string, documentTitle: string) => void;
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
    onNavigateToLinkedDocument,
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
  const { setSelectedText, setSelectionSource, nodeClipboard, setNodeClipboard, setInsertTextAtCursor, setScrollToNode, editor, terms, highlightMode, highlightedTerm } = useEditorContext();

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

  // Build regex for term highlighting
  const termHighlightRegex = useMemo(() => {
    if (highlightMode === 'none') return null;
    
    // In 'selected' mode with no term chosen, highlight nothing (wait state)
    const termsToHighlight = highlightMode === 'selected'
      ? (highlightedTerm ? [highlightedTerm] : [])
      : terms;
    
    if (termsToHighlight.length === 0) return null;
    
    const escaped = termsToHighlight.map(t => 
      t.term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    return new RegExp(`\\b(${escaped.join('|')})\\b`, 'gi');
  }, [terms, highlightMode, highlightedTerm]);

  // Helper to render text with term highlights
  const renderHighlightedText = useCallback((text: string) => {
    if (!termHighlightRegex || !text) {
      return text || ' ';
    }
    
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let key = 0;
    
    // Reset regex state
    termHighlightRegex.lastIndex = 0;
    
    while ((match = termHighlightRegex.exec(text)) !== null) {
      // Add text before match
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      
      // Add highlighted match
      parts.push(
        <span key={key++} className="term-highlight">
          {match[0]}
        </span>
      );
      
      lastIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }
    
    return parts.length > 0 ? parts : (text || ' ');
  }, [termHighlightRegex]);

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
  // For focus-on-mount: when a textarea mounts and matches this ID, focus it immediately
  const pendingProgramFocusIdRef = useRef<string | null>(null);

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
        // Mark this ID for focus-on-mount (in case textarea isn't rendered yet)
        pendingProgramFocusIdRef.current = id;
      } else {
        editIntentRef.current = 'mouse';
      }

      setEditingId(id);
      setEditValue(currentLabel);
    },
    []
  );

  // Auto-focus when autoFocusId changes (for programmatic navigation like arrow keys)
  const lastAutoFocusIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (autoFocusId && nodes.length > 0 && autoFocusId !== lastAutoFocusIdRef.current) {
      const node = nodes.find(n => n.id === autoFocusId);
      if (node) {
        lastAutoFocusIdRef.current = autoFocusId;
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
        
        // Set persistent focus highlight (different from term highlighting)
        setHighlightedNodeId(nodeId);
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
        const newId = onAddNode(node.id);
        if (newId) {
          pendingNewNodeIdRef.current = newId;
        }
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
      // Re-focus the textarea after indent/outdent to maintain edit mode
      requestAnimationFrame(() => {
        const input = inputRefs.current.get(node.id);
        if (input) {
          input.focus();
        }
      });
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
    } else if (e.key === 'ArrowUp') {
      // Navigate to previous node if cursor is on first line
      const input = e.currentTarget;
      const cursorPos = input.selectionStart ?? 0;
      const textBefore = editValue.slice(0, cursorPos);
      const isOnFirstLine = !textBefore.includes('\n');
      
      if (isOnFirstLine) {
        e.preventDefault();
        // Save current value directly before navigating
        onUpdateLabel(node.id, editValue);
        setEditingId(null);
        onNavigateUp();
      }
      // Otherwise let arrow work normally within multi-line text
    } else if (e.key === 'ArrowDown') {
      // Navigate to next node if cursor is on last line
      const input = e.currentTarget;
      const cursorPos = input.selectionStart ?? 0;
      const textAfter = editValue.slice(cursorPos);
      const isOnLastLine = !textAfter.includes('\n');
      
      if (isOnLastLine) {
        e.preventDefault();
        // Save current value directly before navigating
        onUpdateLabel(node.id, editValue);
        setEditingId(null);
        onNavigateDown();
      }
      // Otherwise let arrow work normally within multi-line text
    }
  }, [handleEndEdit, onAddNode, onAddBodyNode, onAddBodyNodeWithSpacer, onAddChildNode, onIndent, onOutdent, onVisualIndent, editValue, onDelete, onUpdateLabel, onMergeIntoParent, autoDescend, nodes, onCopyNode, onPasteNodes, nodeClipboard, setNodeClipboard, onNavigateUp, onNavigateDown]);

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
          // Focus-on-mount: if this textarea is the one we're waiting for, focus it now
          if (pendingProgramFocusIdRef.current === id) {
            pendingProgramFocusIdRef.current = null;
            requestAnimationFrame(() => {
              el.focus();
              // Place cursor at end
              el.selectionStart = el.selectionEnd = el.value.length;
            });
          }
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
        const isLink = node.type === 'link';
        const prefix = (isBody || isLink) ? '' : (
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
              'grid items-start py-0.5 px-2 cursor-text group transition-all duration-300',
              highlightedNodeId === node.id && 'bg-sky-500/15 ring-2 ring-sky-500/40 rounded-md'
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
            
            {/* Label + suffix in single inline-grid - suffix stays glued to text */}
            {(() => {
              const isEditing = editingId === node.id;
              const displayValue = isEditing ? editValue : node.label;
              const suffix = levelStyle.suffix && node.label ? levelStyle.suffix : '';
              const shouldUnderline = levelStyle.underline && (isEditing ? editValue : node.label);

              return (
                <div 
                  className="inline-grid min-w-0 w-full"
                  style={{ maxWidth: '100%' }}
                >
                  {/* Hidden sizer - includes text + suffix to size the container */}
                  <span 
                    className="invisible whitespace-pre-wrap break-words text-sm font-mono leading-6 min-w-0"
                    style={{ gridArea: '1 / 1' }}
                    aria-hidden="true"
                  >
                    {displayValue || ' '}{suffix}
                  </span>
                  
                  {/* Visible layer - text (maybe underlined) + suffix (never underlined) */}
                  <span 
                    className="whitespace-pre-wrap break-words text-sm font-mono leading-6 min-w-0 pointer-events-none"
                    style={{ gridArea: '1 / 1' }}
                    aria-hidden="true"
                  >
                    <span className={cn(shouldUnderline && "underline decoration-foreground")}>
                      {renderHighlightedText(displayValue)}
                    </span>
                    {suffix && <span className="select-none">{suffix}</span>}
                  </span>
                  
                  {/* Textarea - overlays both, but only covers the text width */}
                  <textarea
                    ref={getInputRefCallback(node.id)}
                    value={displayValue}
                    onChange={(e) => {
                      if (editingId !== node.id) {
                        setEditingId(node.id);
                        setEditValue(e.target.value);
                      } else {
                        setEditValue(e.target.value);
                      }
                      e.target.style.height = 'auto';
                      e.target.style.height = `${e.target.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      // Always allow Escape to exit outline
                      if (e.key === 'Escape') {
                        e.preventDefault();
                        if (editingId === node.id) {
                          handleEndEdit(node.id);
                        }
                        setEditingId(null);
                        editor?.chain().focus().run();
                        return;
                      }
                      
                      // Always allow Tab to work for indent/outdent, even before editingId propagates
                      if (e.key === 'Tab') {
                        e.preventDefault();
                        if (editingId !== node.id) {
                          setEditingId(node.id);
                          setEditValue(node.label);
                        }
                        handleKeyDown(e, node);
                        return;
                      }
                      
                      if (editingId !== node.id) {
                        const isNavKey = ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key);
                        if (!isNavKey && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
                          // Will enter edit mode via onChange
                        } else if (!isNavKey) {
                          return;
                        }
                      }
                      if (editingId === node.id) {
                        handleKeyDown(e, node);
                      }
                    }}
                    onPaste={(e) => {
                      if (editingId !== node.id) {
                        setEditingId(node.id);
                        setEditValue(node.label);
                      }
                      handlePaste(e, node.id);
                    }}
                    onSelect={(e) => {
                      // Use current value (editValue if editing, node.label otherwise)
                      handleSelectionChange(e, fullPrefix, displayValue);
                    }}
                    onFocus={(e) => {
                      lastFocusedNodeIdRef.current = node.id;
                      onSelect(node.id);

                      if (editIntentRef.current === 'program') {
                        setEditingId(node.id);
                        setEditValue(node.label);
                        editIntentRef.current = null;
                      }

                      requestAnimationFrame(() => {
                        e.target.style.height = 'auto';
                        e.target.style.height = `${e.target.scrollHeight}px`;
                      });
                    }}
                    onBlur={(e) => {
                      lastCursorPositionRef.current = {
                        start: e.target.selectionStart,
                        end: e.target.selectionEnd,
                      };
                      lastEditValueRef.current = e.target.value;

                      const next = e.relatedTarget as HTMLElement | null;
                      if (next?.closest('[data-editor-sidebar]')) {
                        // Allow focus to go to textareas/inputs in the sidebar (e.g., AI prompt)
                        if (next?.closest('textarea, input, [contenteditable="true"]')) {
                          return;
                        }
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
                      gridArea: '1 / 1',
                      caretColor: 'hsl(var(--primary))',
                    }}
                    className={cn(
                      "w-full min-w-0 bg-transparent border-none outline-none p-0 m-0 text-sm font-mono text-transparent placeholder:text-muted-foreground/50 resize-none whitespace-pre-wrap break-words leading-6 select-text cursor-text caret-primary",
                      !node.label && editingId !== node.id && "text-muted-foreground/50"
                    )}
                  />
                </div>
              );
            })()}
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
