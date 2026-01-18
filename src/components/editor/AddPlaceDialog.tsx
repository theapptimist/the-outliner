import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { MapPin } from 'lucide-react';
import { SelectionSource } from './EditorContext';

interface AddPlaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillSelection?: string;
  selectionSource?: SelectionSource | null;
  onSave: (name: string, significance?: string) => void;
}

export function AddPlaceDialog({
  open,
  onOpenChange,
  prefillSelection,
  selectionSource,
  onSave,
}: AddPlaceDialogProps) {
  const [name, setName] = useState('');
  const [significance, setSignificance] = useState('');

  // Reset and prefill when dialog opens
  useEffect(() => {
    if (open) {
      if (prefillSelection) {
        setName(prefillSelection.trim());
      } else {
        setName('');
      }
      setSignificance('');
    }
  }, [open, prefillSelection]);

  const handleSave = () => {
    if (name.trim()) {
      onSave(name.trim(), significance.trim() || undefined);
      onOpenChange(false);
    }
  };

  const isValid = name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden">
        <DialogHeader className="overflow-hidden">
          <DialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-green-500" />
            Add Place
          </DialogTitle>
          {selectionSource && (
            <div className="flex items-start gap-2 text-sm text-primary mt-2 bg-primary/10 px-3 py-2 rounded-md">
              <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span className="font-mono font-semibold flex-shrink-0">{selectionSource.nodePrefix}</span>
              <span className="break-words">{selectionSource.nodeLabel}</span>
            </div>
          )}
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Place Name</Label>
            <Input
              id="name"
              placeholder="e.g., City Lights Bookstore"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="significance">Significance (optional)</Label>
            <Textarea
              id="significance"
              placeholder="What happened here? Why is it important?"
              value={significance}
              onChange={(e) => setSignificance(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid}>
            Add Place
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
