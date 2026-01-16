import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, MapPin, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { detectDatesInText, formatDateForDisplay, DetectedDate } from '@/lib/dateScanner';

interface AddDateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSelection?: string;
  selectionSource?: { nodePrefix: string; nodeLabel: string } | null;
  onSave: (date: Date, rawText: string, description?: string) => void;
}

export function AddDateDialog({
  open,
  onOpenChange,
  prefillSelection,
  selectionSource,
  onSave,
}: AddDateDialogProps) {
  const [rawText, setRawText] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [description, setDescription] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Detect dates in the selection
  const detectedDates = useMemo(() => {
    if (!prefillSelection) return [];
    return detectDatesInText(prefillSelection);
  }, [prefillSelection]);

  // Prefill when dialog opens
  useEffect(() => {
    if (open && prefillSelection) {
      setRawText(prefillSelection);
      
      // If we detected a high-confidence date, use it
      const highConfidence = detectedDates.find(d => d.confidence === 'high' && d.normalizedDate);
      const mediumConfidence = detectedDates.find(d => d.confidence === 'medium' && d.normalizedDate);
      const bestMatch = highConfidence || mediumConfidence;
      
      if (bestMatch?.normalizedDate) {
        setSelectedDate(bestMatch.normalizedDate);
      } else {
        setSelectedDate(undefined);
      }
      
      setDescription('');
    }
  }, [open, prefillSelection, detectedDates]);

  const handleSave = () => {
    if (!selectedDate || !rawText.trim()) return;
    onSave(selectedDate, rawText.trim(), description.trim() || undefined);
    onOpenChange(false);
    setRawText('');
    setSelectedDate(undefined);
    setDescription('');
  };

  const handleSuggestionClick = (detected: DetectedDate) => {
    setRawText(detected.rawText);
    if (detected.normalizedDate) {
      setSelectedDate(detected.normalizedDate);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Tag Date</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Source location */}
          {selectionSource && (
            <div className="flex items-start gap-2 px-3 py-2 bg-muted/50 rounded-md text-sm">
              <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
              <span className="text-muted-foreground break-words whitespace-normal">
                <span className="font-mono font-medium">{selectionSource.nodePrefix}</span>
                {' '}{selectionSource.nodeLabel}
              </span>
            </div>
          )}

          {/* Auto-detected dates */}
          {detectedDates.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Detected dates
              </Label>
              <div className="flex flex-wrap gap-1.5">
                {detectedDates.map((d, i) => (
                  <Badge
                    key={i}
                    variant={d.confidence === 'high' ? 'default' : 'secondary'}
                    className="cursor-pointer hover:bg-primary/80"
                    onClick={() => handleSuggestionClick(d)}
                  >
                    {d.rawText}
                    {d.confidence === 'low' && (
                      <span className="ml-1 opacity-60">?</span>
                    )}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Raw text input */}
          <div className="space-y-2">
            <Label htmlFor="raw-text">Date Text</Label>
            <Input
              id="raw-text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="e.g., March 2022"
            />
            <p className="text-xs text-muted-foreground">
              The text as it appears in your document
            </p>
          </div>

          {/* Date picker */}
          <div className="space-y-2">
            <Label>Normalized Date</Label>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !selectedDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {selectedDate ? formatDateForDisplay(selectedDate) : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setCalendarOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What happened on this date?"
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            disabled={!selectedDate || !rawText.trim()}
          >
            Tag Date
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
