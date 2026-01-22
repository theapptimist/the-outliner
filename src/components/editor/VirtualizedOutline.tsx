import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { FlatNode } from '@/types/node';
import { cn } from '@/lib/utils';
import { OutlineStyle, getOutlinePrefix, getOutlinePrefixCustom, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { FileText } from 'lucide-react';

interface VirtualizedOutlineProps {
  nodes: FlatNode[];
  selectedId: string | null;
  outlineStyle: OutlineStyle;
  mixedConfig?: MixedStyleConfig;
  itemHeight?: number;
  overscan?: number;
  onSelect: (id: string) => void;
  onUpdateLabel: (id: string, label: string) => void;
  onNavigateUp: () => void;
  onNavigateDown: () => void;
  className?: string;
}

interface VirtualRange {
  start: number;
  end: number;
}

/**
 * Virtualized list component for rendering large outlines efficiently.
 * Only renders visible items plus a small overscan buffer.
 * Uses fixed row height for performance - best for 100+ node outlines.
 */
export function VirtualizedOutline({
  nodes,
  selectedId,
  outlineStyle,
  mixedConfig = DEFAULT_MIXED_CONFIG,
  itemHeight = 32,
  overscan = 10,
  onSelect,
  onUpdateLabel,
  onNavigateUp,
  onNavigateDown,
  className = '',
}: VirtualizedOutlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Calculate indices for each node at each depth (skip body nodes)
  const nodeIndices = useMemo(() => {
    const indices = new Map<string, number[]>();
    const counters: number[] = [];
    let lastDepth = -1;
    
    for (const node of nodes) {
      if (node.type === 'body') {
        indices.set(node.id, [...counters.slice(0, node.depth + 1)]);
        continue;
      }
      
      if (node.depth > lastDepth) {
        while (counters.length <= node.depth) {
          counters.push(0);
        }
      } else if (node.depth < lastDepth) {
        for (let i = node.depth + 1; i < counters.length; i++) {
          counters[i] = 0;
        }
      }
      
      counters[node.depth] = (counters[node.depth] ?? 0) + 1;
      indices.set(node.id, [...counters.slice(0, node.depth + 1)]);
      lastDepth = node.depth;
    }
    
    return indices;
  }, [nodes]);

  // Update container height on resize
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateHeight = () => {
      setContainerHeight(container.clientHeight);
    };

    updateHeight();

    const observer = new ResizeObserver(updateHeight);
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  // Handle scroll
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  // Calculate visible range
  const visibleRange = useMemo((): VirtualRange => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(nodes.length, start + visibleCount + overscan * 2);
    return { start, end };
  }, [scrollTop, containerHeight, itemHeight, overscan, nodes.length]);

  // Total height for scroll area
  const totalHeight = nodes.length * itemHeight;

  // Handle editing
  const handleStartEdit = useCallback((id: string, label: string) => {
    setEditingId(id);
    setEditValue(label);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const handleEndEdit = useCallback(() => {
    if (editingId && editValue.trim()) {
      onUpdateLabel(editingId, editValue.trim());
    }
    setEditingId(null);
  }, [editingId, editValue, onUpdateLabel]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (editingId) {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleEndEdit();
      } else if (e.key === 'Escape') {
        setEditingId(null);
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      onNavigateUp();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNavigateDown();
    } else if (e.key === 'F2' && selectedId) {
      const node = nodes.find(n => n.id === selectedId);
      if (node) {
        e.preventDefault();
        handleStartEdit(selectedId, node.label);
      }
    }
  }, [editingId, selectedId, nodes, onNavigateUp, onNavigateDown, handleStartEdit, handleEndEdit]);

  // Scroll selected node into view
  useEffect(() => {
    if (!selectedId || !containerRef.current) return;
    const index = nodes.findIndex(n => n.id === selectedId);
    if (index === -1) return;

    const top = index * itemHeight;
    const bottom = top + itemHeight;
    const container = containerRef.current;

    if (top < container.scrollTop) {
      container.scrollTop = top;
    } else if (bottom > container.scrollTop + containerHeight) {
      container.scrollTop = bottom - containerHeight;
    }
  }, [selectedId, nodes, itemHeight, containerHeight]);

  // Render visible items
  const visibleItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const node = nodes[i];
      if (!node) continue;
      
      const indices = nodeIndices.get(node.id) || [1];
      const isBody = node.type === 'body';
      const isLink = node.type === 'link' || !!node.linkedDocumentId;
      
      const prefix = isBody ? '' : (
        outlineStyle === 'mixed'
          ? getOutlinePrefixCustom(node.depth, indices, mixedConfig)
          : getOutlinePrefix(outlineStyle, node.depth, indices)
      );
      
      const visualDepth = isBody
        ? Math.max(0, node.depth - 1) + (node.visualIndent || 0)
        : node.depth;
      
      const isSelected = selectedId === node.id;
      const isEditing = editingId === node.id;
      
      items.push(
        <div
          key={node.id}
          className={cn(
            'absolute left-0 right-0 flex items-center px-2 cursor-pointer transition-colors',
            isSelected && 'bg-secondary/60',
            !isSelected && 'hover:bg-secondary/30'
          )}
          style={{
            top: i * itemHeight,
            height: itemHeight,
            paddingLeft: `${visualDepth * 24 + 8}px`,
          }}
          onClick={() => onSelect(node.id)}
          onDoubleClick={() => !isLink && handleStartEdit(node.id, node.label)}
        >
          <span className="font-mono text-sm text-muted-foreground w-14 text-right pr-2 flex-shrink-0">
            {prefix}
          </span>
          
          {isLink && (
            <FileText className="h-4 w-4 flex-shrink-0 mr-2 text-primary" />
          )}
          
          {isEditing ? (
            <input
              ref={inputRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleEndEdit}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleEndEdit();
                } else if (e.key === 'Escape') {
                  setEditingId(null);
                }
                e.stopPropagation();
              }}
              className="flex-1 bg-background border border-ring rounded px-1 text-sm font-mono outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span className={cn(
              "text-sm font-mono truncate",
              isLink && "text-primary underline",
              isBody && "text-muted-foreground"
            )}>
              {node.label || '\u00A0'}
            </span>
          )}
        </div>
      );
    }
    return items;
  }, [nodes, visibleRange, nodeIndices, outlineStyle, mixedConfig, selectedId, editingId, editValue, itemHeight, onSelect, handleStartEdit, handleEndEdit]);

  return (
    <div
      ref={containerRef}
      className={cn('overflow-auto focus:outline-none', className)}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <div
        style={{
          position: 'relative',
          height: totalHeight,
          width: '100%',
        }}
      >
        {visibleItems}
      </div>
    </div>
  );
}

/**
 * Hook to determine if virtualization should be enabled based on node count.
 * Only enables virtualization for large lists to avoid overhead on small lists.
 */
export function useVirtualizationEnabled(nodeCount: number, threshold = 100): boolean {
  return nodeCount >= threshold;
}
