import { useState, useEffect, useCallback } from 'react';
import { useEditorContext } from './EditorContext';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { X, ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateForDisplay } from '@/lib/dateScanner';
import { TaggedDate } from './EditorContext';

interface DateUsagesPaneProps {
  date: TaggedDate;
  onClose: () => void;
}

export function DateUsagesPane({ date, onClose }: DateUsagesPaneProps) {
  const { scrollToNode } = useEditorContext();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when date changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [date.id]);

  const handlePrev = useCallback(() => {
    if (date.usages.length === 0) return;
    const newIndex = (currentIndex - 1 + date.usages.length) % date.usages.length;
    setCurrentIndex(newIndex);
    const usage = date.usages[newIndex];
    scrollToNode?.(usage.nodeId);
  }, [currentIndex, date.usages, scrollToNode]);

  const handleNext = useCallback(() => {
    if (date.usages.length === 0) return;
    const newIndex = (currentIndex + 1) % date.usages.length;
    setCurrentIndex(newIndex);
    const usage = date.usages[newIndex];
    scrollToNode?.(usage.nodeId);
  }, [currentIndex, date.usages, scrollToNode]);

  const handleUsageClick = useCallback((index: number) => {
    setCurrentIndex(index);
    const usage = date.usages[index];
    scrollToNode?.(usage.nodeId);
  }, [date.usages, scrollToNode]);

  const totalCount = date.usages.reduce((sum, u) => sum + u.count, 0);

  return (
    <div className="flex flex-col h-full bg-background border-l border-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Calendar className="h-4 w-4 text-blue-500 shrink-0" />
          <span className="font-medium text-sm truncate">
            {formatDateForDisplay(date.date)}
          </span>
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded shrink-0">
              {totalCount} use{totalCount !== 1 && 's'}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="h-6 w-6 p-0 shrink-0"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Navigation */}
      {date.usages.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            className="h-7 px-2"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {date.usages.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            className="h-7 px-2"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Raw text display */}
      <div className="px-3 py-2 border-b border-border shrink-0">
        <div className="text-xs text-muted-foreground mb-1">Tagged as:</div>
        <div className="text-sm font-medium">"{date.rawText}"</div>
      </div>

      {/* Usages list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {date.usages.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <p>No usages found</p>
              <p className="text-xs mt-1">This date may not appear in the outline</p>
            </div>
          ) : (
            <div className="space-y-1">
              {date.usages.map((usage, index) => (
                <button
                  key={`${usage.blockId}-${usage.nodeId}`}
                  onClick={() => handleUsageClick(index)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
                    "hover:bg-muted",
                    currentIndex === index && "bg-blue-500/10 border border-blue-500/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-blue-600 dark:text-blue-400 shrink-0">
                      {usage.nodePrefix}
                    </span>
                    {usage.count > 1 && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                        ×{usage.count}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {usage.nodeLabel}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Description footer */}
      {date.description && (
        <div className="px-3 py-2 border-t border-border shrink-0 bg-muted/30">
          <div className="text-xs text-muted-foreground line-clamp-2">
            {date.description}
          </div>
        </div>
      )}
    </div>
  );
}
