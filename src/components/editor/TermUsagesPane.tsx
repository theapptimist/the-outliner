import { useCallback, useState, useEffect } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEditorContext, DefinedTerm } from './EditorContext';

interface TermUsagesPaneProps {
  term: DefinedTerm;
  onClose: () => void;
}

export function TermUsagesPane({ term, onClose }: TermUsagesPaneProps) {
  const { scrollToNode } = useEditorContext();
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const usages = term.usages;
  const hasUsages = usages.length > 0;
  
  // Reset index when term changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [term.id]);
  
  const handlePrev = useCallback(() => {
    if (usages.length === 0) return;
    const newIndex = currentIndex === 0 ? usages.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
    const usage = usages[newIndex];
    if (usage.nodeId && scrollToNode) {
      scrollToNode(usage.nodeId);
    }
  }, [usages, currentIndex, scrollToNode]);
  
  const handleNext = useCallback(() => {
    if (usages.length === 0) return;
    const newIndex = currentIndex === usages.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
    const usage = usages[newIndex];
    if (usage.nodeId && scrollToNode) {
      scrollToNode(usage.nodeId);
    }
  }, [usages, currentIndex, scrollToNode]);
  
  const handleUsageClick = useCallback((index: number) => {
    setCurrentIndex(index);
    const usage = usages[index];
    if (usage.nodeId && scrollToNode) {
      scrollToNode(usage.nodeId);
    }
  }, [usages, scrollToNode]);
  
  const totalUsages = usages.reduce((sum, u) => sum + u.count, 0);

  return (
    <div className="flex flex-col h-full bg-card border-r border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs font-medium text-muted-foreground">Usages of</span>
          <span className="text-sm font-semibold text-foreground truncate">{term.term}</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={onClose}
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      
      {/* Navigation Controls */}
      {hasUsages && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={handlePrev}
            disabled={usages.length <= 1}
          >
            <ChevronLeft className="h-3.5 w-3.5 mr-1" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} of {usages.length} locations ({totalUsages} total)
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2"
            onClick={handleNext}
            disabled={usages.length <= 1}
          >
            Next
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>
      )}
      
      {/* Source Definition */}
      {term.sourceLocation && (
        <div className="px-3 py-2 border-b border-border/50 bg-primary/5">
          <div className="text-[10px] text-muted-foreground mb-1">Defined at:</div>
          <div className="flex items-center gap-1.5 text-xs text-primary">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="font-mono font-medium">{term.sourceLocation.prefix}</span>
            <span className="truncate">{term.sourceLocation.label}</span>
          </div>
        </div>
      )}
      
      {/* Usages List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {hasUsages ? (
            usages.map((usage, idx) => (
              <button
                key={`${usage.nodeId}-${idx}`}
                className={cn(
                  "w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors",
                  "hover:bg-accent/10",
                  idx === currentIndex 
                    ? "bg-accent/20 border border-accent/30" 
                    : "bg-muted/30 border border-transparent"
                )}
                onClick={() => handleUsageClick(idx)}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-foreground">{usage.nodeLabel}</span>
                  <div className="flex items-center gap-1 shrink-0">
                    {usage.count > 1 && (
                      <span className="text-[10px] text-muted-foreground">×{usage.count}</span>
                    )}
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="text-center py-8 text-xs text-muted-foreground">
              <p>No usages found yet.</p>
              <p className="mt-1 text-[10px]">Click on a term card to insert it.</p>
            </div>
          )}
        </div>
      </ScrollArea>
      
      {/* Footer */}
      <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
        <p className="text-[10px] text-muted-foreground text-center">
          Definition: <span className="text-foreground">{term.definition}</span>
        </p>
      </div>
    </div>
  );
}
