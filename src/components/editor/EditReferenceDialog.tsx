import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';

interface EditReferenceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  marker: string;
  currentText: string;
  onSave: (marker: string, text: string) => void;
}

export function EditReferenceDialog({
  open,
  onOpenChange,
  marker,
  currentText,
  onSave,
}: EditReferenceDialogProps) {
  const [text, setText] = useState(currentText);

  useEffect(() => {
    setText(currentText);
  }, [currentText, open]);

  const handleSave = () => {
    onSave(marker, text.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Reference {marker}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-2">
            <Label htmlFor="reference-text">Citation Text</Label>
            <Textarea
              id="reference-text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="e.g., Smith, J. (2023). Title of the work. Publisher."
              rows={3}
              className="resize-none"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Enter the full citation for this reference. This will appear in the References section.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
