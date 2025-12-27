import { FlatNode } from '@/types/node';
import { NodeTypeIcon } from './NodeTypeIcon';
import { cn } from '@/lib/utils';

interface OutlineViewProps {
  nodes: FlatNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function OutlineView({ nodes, selectedId, onSelect }: OutlineViewProps) {
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
        >
          <span className="text-muted-foreground select-none">
            {node.depth === 0 ? '•' : '◦'}
          </span>
          <NodeTypeIcon type={node.type} size={12} className="mt-1 flex-shrink-0" />
          <span className="text-foreground">{node.label}</span>
          {Object.keys(node.properties).length > 0 && (
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
