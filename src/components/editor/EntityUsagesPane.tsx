import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, MapPin, User, Calendar, Quote } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useEditorContext } from './EditorContext';

interface EntityUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  nodePrefix: string;
  count: number;
}

interface EntityUsagesPaneProps {
  type: 'term' | 'date' | 'person' | 'place';
  title: string;
  subtitle?: string;
  description?: string;
  usages: EntityUsage[];
  onClose: () => void;
}

export function EntityUsagesPane({
  type,
  title,
  subtitle,
  description,
  usages,
  onClose,
}: EntityUsagesPaneProps) {
  const { scrollToNode } = useEditorContext();
  const [currentIndex, setCurrentIndex] = useState(0);

  // Reset index when entity changes
  useEffect(() => {
    setCurrentIndex(0);
  }, [title]);

  const handlePrev = useCallback(() => {
    if (usages.length === 0) return;
    const newIndex = (currentIndex - 1 + usages.length) % usages.length;
    setCurrentIndex(newIndex);
    const usage = usages[newIndex];
    scrollToNode?.(usage.nodeId);
  }, [currentIndex, usages, scrollToNode]);

  const handleNext = useCallback(() => {
    if (usages.length === 0) return;
    const newIndex = (currentIndex + 1) % usages.length;
    setCurrentIndex(newIndex);
    const usage = usages[newIndex];
    scrollToNode?.(usage.nodeId);
  }, [currentIndex, usages, scrollToNode]);

  const handleUsageClick = useCallback((index: number) => {
    setCurrentIndex(index);
    const usage = usages[index];
    scrollToNode?.(usage.nodeId);
  }, [usages, scrollToNode]);

  const totalCount = usages.reduce((sum, u) => sum + u.count, 0);

  const iconConfig = {
    term: { Icon: Quote, color: 'text-amber-500' },
    date: { Icon: Calendar, color: 'text-blue-500' },
    person: { Icon: User, color: 'text-purple-500' },
    place: { Icon: MapPin, color: 'text-green-500' },
  };

  const { Icon, color } = iconConfig[type];

  return (
    <div className="flex flex-col h-full bg-background border-t border-border">
      {/* Header */}
      <div className="flex items-start justify-between px-3 py-2 border-b border-border shrink-0 bg-muted/30 gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", color)} />
          <span className="font-medium text-sm break-words whitespace-pre-wrap min-w-0">{title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {totalCount > 0 && (
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
              {totalCount} use{totalCount !== 1 && 's'}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-6 w-6 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Navigation */}
      {usages.length > 0 && (
        <div className="flex items-center justify-between px-3 py-1.5 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            className="h-7 px-2"
            disabled={usages.length <= 1}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Prev
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentIndex + 1} / {usages.length}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNext}
            className="h-7 px-2"
            disabled={usages.length <= 1}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      )}

      {/* Subtitle/description */}
      {(subtitle || description) && (
        <div className="px-3 py-2 border-b border-border shrink-0">
          {subtitle && (
            <div className="text-xs text-foreground font-medium">{subtitle}</div>
          )}
          {description && (
            <div className="text-xs text-muted-foreground mt-0.5 italic">{description}</div>
          )}
        </div>
      )}

      {/* Usages list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {usages.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <p>No usages found</p>
              <p className="text-xs mt-1">This may not appear in the outline yet</p>
            </div>
          ) : (
            <div className="space-y-1">
              {usages.map((usage, index) => (
                <button
                  key={`${usage.blockId}-${usage.nodeId}-${index}`}
                  onClick={() => handleUsageClick(index)}
                  className={cn(
                    "w-full text-left px-2 py-1.5 rounded-md text-sm transition-colors",
                    "hover:bg-muted",
                    currentIndex === index && "bg-primary/10 border border-primary/30"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className={cn("font-mono text-xs shrink-0", color)}>
                      {usage.nodePrefix || '—'}
                    </span>
                    {usage.count > 1 && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded">
                        ×{usage.count}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 break-words">
                    {usage.nodeLabel}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
