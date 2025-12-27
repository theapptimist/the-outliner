import { useMemo } from 'react';
import { HierarchyNode } from '@/types/node';
import { NodeTypeIcon } from './NodeTypeIcon';
import { cn } from '@/lib/utils';

interface GraphViewProps {
  tree: HierarchyNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

interface PositionedNode {
  node: HierarchyNode;
  x: number;
  y: number;
  parentX?: number;
  parentY?: number;
}

function calculatePositions(
  nodes: HierarchyNode[],
  x: number = 0,
  y: number = 0,
  parentX?: number,
  parentY?: number
): PositionedNode[] {
  const result: PositionedNode[] = [];
  const nodeWidth = 160;
  const nodeHeight = 48;
  const horizontalGap = 40;
  const verticalGap = 60;

  let currentX = x;

  nodes.forEach((node) => {
    const childPositions = node.children.length > 0
      ? calculatePositions(
          node.children,
          currentX,
          y + nodeHeight + verticalGap,
          currentX + nodeWidth / 2,
          y + nodeHeight
        )
      : [];

    const childWidth = childPositions.length > 0
      ? childPositions
          .filter(p => p.node.parentId === node.id)
          .reduce((max, p) => Math.max(max, p.x + nodeWidth), currentX) - currentX + horizontalGap
      : nodeWidth + horizontalGap;

    result.push({
      node,
      x: currentX,
      y,
      parentX,
      parentY,
    });

    result.push(...childPositions);
    currentX += childWidth;
  });

  return result;
}

export function GraphView({ tree, selectedId, onSelect }: GraphViewProps) {
  const positions = useMemo(() => calculatePositions(tree), [tree]);

  const bounds = useMemo(() => {
    if (positions.length === 0) return { width: 400, height: 300 };
    
    const maxX = Math.max(...positions.map(p => p.x)) + 200;
    const maxY = Math.max(...positions.map(p => p.y)) + 100;
    
    return { width: Math.max(maxX, 400), height: Math.max(maxY, 300) };
  }, [positions]);

  return (
    <div className="flex-1 overflow-auto scrollbar-thin">
      <svg
        width={bounds.width}
        height={bounds.height}
        className="min-w-full min-h-full"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="6"
            markerHeight="6"
            refX="6"
            refY="3"
            orient="auto"
          >
            <path
              d="M0,0 L6,3 L0,6"
              fill="none"
              stroke="hsl(var(--muted-foreground))"
              strokeWidth="1"
            />
          </marker>
        </defs>

        {/* Connection lines */}
        {positions
          .filter(p => p.parentX !== undefined && p.parentY !== undefined)
          .map(({ node, x, y, parentX, parentY }) => (
            <path
              key={`line-${node.id}`}
              d={`M${parentX},${parentY} L${parentX},${y - 20} L${x + 80},${y - 20} L${x + 80},${y}`}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="1.5"
              className="transition-colors"
            />
          ))}

        {/* Nodes */}
        {positions.map(({ node, x, y }) => (
          <g
            key={node.id}
            transform={`translate(${x}, ${y})`}
            onClick={() => onSelect(node.id)}
            className="cursor-pointer"
          >
            <rect
              width="160"
              height="44"
              rx="6"
              className={cn(
                'transition-all',
                selectedId === node.id
                  ? 'fill-secondary stroke-primary stroke-2'
                  : 'fill-card stroke-border stroke-1 hover:stroke-muted-foreground'
              )}
            />
            <foreignObject x="8" y="8" width="144" height="28">
              <div className="flex items-center gap-2 h-full">
                <NodeTypeIcon type={node.type} size={14} />
                <span className="text-xs font-mono text-foreground truncate">
                  {node.label}
                </span>
              </div>
            </foreignObject>
            {node.children.length > 0 && (
              <text
                x="152"
                y="28"
                className="text-[10px] fill-muted-foreground font-mono"
                textAnchor="end"
              >
                {node.children.length}
              </text>
            )}
          </g>
        ))}

        {positions.length === 0 && (
          <text
            x="50%"
            y="50%"
            textAnchor="middle"
            className="fill-muted-foreground text-sm"
          >
            Empty graph
          </text>
        )}
      </svg>
    </div>
  );
}
