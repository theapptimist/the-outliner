import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Check, Merge } from 'lucide-react';

interface EntityMergeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntity: {
    id: string;
    title: string;
    subtitle?: string;
  };
  candidates: Array<{
    id: string;
    title: string;
    subtitle?: string;
  }>;
  entityType: 'people' | 'places' | 'dates' | 'terms';
  onMerge: (targetId: string) => void;
}

export function EntityMergeDialog({
  open,
  onOpenChange,
  sourceEntity,
  candidates,
  entityType,
  onMerge,
}: EntityMergeDialogProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleMerge = () => {
    if (selectedId) {
      onMerge(selectedId);
      onOpenChange(false);
      setSelectedId(null);
    }
  };

  const typeLabel = {
    people: 'person',
    places: 'place',
    dates: 'date',
    terms: 'term',
  }[entityType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-4 w-4" />
            Merge {typeLabel}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="text-sm">
            <span className="text-muted-foreground">Merging </span>
            <span className="font-medium">"{sourceEntity.title}"</span>
            <span className="text-muted-foreground"> into:</span>
          </div>

          {candidates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              No other {typeLabel}s to merge with
            </div>
          ) : (
            <ScrollArea className="h-[200px] border rounded-md">
              <div className="p-2 space-y-1">
                {candidates.map((candidate) => (
                  <button
                    key={candidate.id}
                    onClick={() => setSelectedId(candidate.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md transition-colors",
                      "hover:bg-muted/50",
                      selectedId === candidate.id && "bg-primary/10 ring-1 ring-primary"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium truncate">{candidate.title}</div>
                        {candidate.subtitle && (
                          <div className="text-xs text-muted-foreground truncate">{candidate.subtitle}</div>
                        )}
                      </div>
                      {selectedId === candidate.id && (
                        <Check className="h-4 w-4 text-primary shrink-0 ml-2" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          )}

          <p className="text-xs text-muted-foreground">
            The source {typeLabel} will be deleted and its usages will be attributed to the target.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleMerge} disabled={!selectedId}>
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
