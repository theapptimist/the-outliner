import { useNavigation, MasterDocumentLink } from '@/contexts/NavigationContext';
import { FileText, ArrowLeft, Network } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface MasterOutlinePaneProps {
  collapsed: boolean;
  onNavigateToDocument: (id: string) => void;
}

export function MasterOutlinePane({
  collapsed,
  onNavigateToDocument,
}: MasterOutlinePaneProps) {
  const { masterDocument, activeSubOutlineId, setActiveSubOutlineId } = useNavigation();

  if (!masterDocument || collapsed) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-2 text-muted-foreground">
        <Network className="h-6 w-6 mb-2 opacity-50" />
        {!collapsed && <span className="text-xs">No master</span>}
      </div>
    );
  }

  const handleReturnToMaster = () => {
    setActiveSubOutlineId(null);
    onNavigateToDocument(masterDocument.id);
  };

  const handleNavigateToLinked = (link: MasterDocumentLink) => {
    setActiveSubOutlineId(link.linkedDocumentId);
    onNavigateToDocument(link.linkedDocumentId);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Master Document Header */}
      <div className="p-3 border-b border-border/30 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-2">
          <Network className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-primary uppercase tracking-wide">
            Master Outline
          </span>
        </div>
        <h3 className="text-sm font-medium text-foreground truncate" title={masterDocument.title}>
          {masterDocument.title}
        </h3>
      </div>

      {/* Return to Master Button - only show when viewing a sub-outline */}
      {activeSubOutlineId && (
        <div className="p-2 border-b border-border/20">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 text-xs"
            onClick={handleReturnToMaster}
            data-allow-pointer
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Return to Master
          </Button>
        </div>
      )}

      {/* Sub-Outline Links */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1">
            Linked Documents
          </div>
          {masterDocument.links.length === 0 ? (
            <div className="text-xs text-muted-foreground px-2 py-4 text-center">
              No linked documents
            </div>
          ) : (
            masterDocument.links.map((link: MasterDocumentLink) => (
              <button
                key={link.nodeId}
                data-allow-pointer
                onClick={() => handleNavigateToLinked(link)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left transition-colors",
                  "hover:bg-muted/50",
                  activeSubOutlineId === link.linkedDocumentId
                    ? "bg-primary/10 text-primary border-l-2 border-primary"
                    : "text-foreground"
                )}
              >
                <FileText className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="text-xs break-words min-w-0">
                  {link.linkedDocumentTitle || 'Untitled'}
                </span>
              </button>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
