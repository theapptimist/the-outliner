import { useRef, useMemo, useCallback, useState, useEffect } from 'react';
import { HierarchyNode } from '@/types/node';

interface VirtualizedOutlineProps {
  nodes: HierarchyNode[];
  itemHeight?: number;
  overscan?: number;
  renderItem: (node: HierarchyNode, index: number, style: React.CSSProperties) => React.ReactNode;
  className?: string;
}

interface VirtualRange {
  start: number;
  end: number;
}

/**
 * Virtualized list component for rendering large outlines efficiently.
 * Only renders visible items plus a small overscan buffer.
 */
export function VirtualizedOutline({
  nodes,
  itemHeight = 48,
  overscan = 5,
  renderItem,
  className = '',
}: VirtualizedOutlineProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);

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

  // Render visible items
  const visibleItems = useMemo(() => {
    const items: React.ReactNode[] = [];
    for (let i = visibleRange.start; i < visibleRange.end; i++) {
      const node = nodes[i];
      if (!node) continue;
      
      const style: React.CSSProperties = {
        position: 'absolute',
        top: i * itemHeight,
        left: 0,
        right: 0,
        height: itemHeight,
      };
      
      items.push(renderItem(node, i, style));
    }
    return items;
  }, [nodes, visibleRange, itemHeight, renderItem]);

  return (
    <div
      ref={containerRef}
      className={`overflow-auto ${className}`}
      onScroll={handleScroll}
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
