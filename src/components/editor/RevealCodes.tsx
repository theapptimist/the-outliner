import { FlatNode, NodeType } from '@/types/node';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface RevealCodesProps {
  nodes: FlatNode[];
  selectedId: string | null;
}

// WordPerfect-style code representations
function getNodeTypeCode(type: NodeType): string {
  switch (type) {
    case 'default': return '[Otln]';
    case 'body': return '[Body]';
    case 'container': return '[Cont]';
    case 'data': return '[Data]';
    case 'action': return '[Actn]';
    case 'reference': return '[Ref]';
    default: return '[Node]';
  }
}

function getIndentCode(depth: number): string {
  if (depth === 0) return '';
  return `[Ind:${depth}]`;
}

function getVisualIndentCode(visualIndent: number | undefined): string {
  if (!visualIndent || visualIndent === 0) return '';
  return `[Tab:${visualIndent}]`;
}

export function RevealCodes({ nodes, selectedId }: RevealCodesProps) {
  const selectedNode = nodes.find(n => n.id === selectedId);
  const selectedIndex = nodes.findIndex(n => n.id === selectedId);
  
  // Show context: 2 nodes before and after selected, or first 5 if nothing selected
  const contextStart = selectedId ? Math.max(0, selectedIndex - 2) : 0;
  const contextEnd = selectedId ? Math.min(nodes.length, selectedIndex + 3) : Math.min(5, nodes.length);
  const visibleNodes = nodes.slice(contextStart, contextEnd);

  return (
    <div className="bg-[#1a1a2e] border-t-2 border-[#4a4a6a] font-mono text-xs">
      {/* Header bar - WordPerfect style */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#2a2a4a] text-[#8888aa] border-b border-[#4a4a6a]">
        <span>Reveal Codes</span>
        <span className="text-[#6666aa]">Alt+F3 to toggle</span>
      </div>
      
      {/* Codes display */}
      <ScrollArea className="h-24">
        <div className="p-2 space-y-0.5">
          {visibleNodes.length === 0 ? (
            <div className="text-[#6666aa] italic">No nodes</div>
          ) : (
            visibleNodes.map((node, idx) => {
              const isSelected = node.id === selectedId;
              const globalIdx = contextStart + idx;
              
              return (
                <div 
                  key={node.id}
                  className={cn(
                    'flex items-start gap-1 py-0.5 px-1 rounded',
                    isSelected && 'bg-[#3a3a5a] ring-1 ring-[#6a6aaa]'
                  )}
                >
                  {/* Line number */}
                  <span className="text-[#4a4a6a] w-6 text-right flex-shrink-0">
                    {globalIdx + 1}:
                  </span>
                  
                  {/* Codes */}
                  <div className="flex flex-wrap gap-0.5 items-center">
                    {/* Structural codes */}
                    <span className="text-[#ff6b6b]">{getNodeTypeCode(node.type)}</span>
                    {node.depth > 0 && (
                      <span className="text-[#4ecdc4]">{getIndentCode(node.depth)}</span>
                    )}
                    {node.visualIndent && node.visualIndent > 0 && (
                      <span className="text-[#ffe66d]">{getVisualIndentCode(node.visualIndent)}</span>
                    )}
                    
                    {/* Content */}
                    <span className="text-[#f8f8f2]">
                      {node.label || <span className="text-[#6666aa] italic">empty</span>}
                    </span>
                    
                    {/* Properties indicator */}
                    {Object.keys(node.properties).length > 0 && (
                      <span className="text-[#bd93f9]">[Props:{Object.keys(node.properties).length}]</span>
                    )}
                    
                    {/* Collapse state */}
                    {node.collapsed && (
                      <span className="text-[#ffb86c]">[Collapsed]</span>
                    )}
                    
                    {/* Has children indicator */}
                    {node.hasChildren && (
                      <span className="text-[#50fa7b]">[+Children]</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
      
      {/* Selected node detail bar */}
      {selectedNode && (
        <div className="px-3 py-1 bg-[#2a2a4a] border-t border-[#4a4a6a] text-[#8888aa] flex gap-4 text-[10px]">
          <span>ID: <span className="text-[#6a6aaa]">{selectedNode.id.slice(0, 8)}...</span></span>
          <span>Depth: <span className="text-[#4ecdc4]">{selectedNode.depth}</span></span>
          <span>Type: <span className="text-[#ff6b6b]">{selectedNode.type}</span></span>
          {selectedNode.parentId && (
            <span>Parent: <span className="text-[#6a6aaa]">{selectedNode.parentId.slice(0, 8)}...</span></span>
          )}
          <span>Order: <span className="text-[#ffe66d]">{selectedNode.orderIndex}</span></span>
        </div>
      )}
    </div>
  );
}
