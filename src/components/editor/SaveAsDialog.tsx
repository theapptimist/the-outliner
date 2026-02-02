import { useState, useEffect, forwardRef } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';
import { findDocumentsByTitle } from '@/lib/cloudDocumentStorage';

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, isMaster: boolean) => void;
  defaultTitle?: string;
  defaultIsMaster?: boolean;
  currentDocId?: string;
}

export const SaveAsDialog = forwardRef<HTMLDivElement, SaveAsDialogProps>(function SaveAsDialog({
  open,
  onOpenChange,
  onSave,
  defaultTitle = '',
  defaultIsMaster = false,
  currentDocId,
}, ref) {
  const [title, setTitle] = useState(defaultTitle);
  const [isMaster, setIsMaster] = useState(defaultIsMaster);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setIsMaster(defaultIsMaster);
      setDuplicateWarning(null);
    }
  }, [open, defaultTitle, defaultIsMaster]);

  // Debounced duplicate check
  useEffect(() => {
    if (!open || !title.trim()) {
      setDuplicateWarning(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsChecking(true);
      try {
        const existing = await findDocumentsByTitle(title.trim());
        // Filter out the current document (if editing)
        const duplicates = existing.filter(doc => doc.id !== currentDocId);
        
        if (duplicates.length > 0) {
          setDuplicateWarning(
            duplicates.length === 1
              ? 'A document with this title already exists'
              : `${duplicates.length} documents with this title already exist`
          );
        } else {
          setDuplicateWarning(null);
        }
      } catch (e) {
        console.error('[SaveAsDialog] Failed to check duplicates:', e);
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [title, open, currentDocId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (title.trim()) {
      onSave(title.trim(), isMaster);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Save As</DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-4">
            <div>
              <Label htmlFor="doc-title">Document Title</Label>
              <Input
                id="doc-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter document title..."
                className="mt-2"
                autoFocus
              />
              {duplicateWarning && (
                <div className="flex items-center gap-1.5 mt-2 text-xs text-warning">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  <span>{duplicateWarning}</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="is-master"
                checked={isMaster}
                onCheckedChange={(checked) => setIsMaster(checked === true)}
              />
              <Label 
                htmlFor="is-master" 
                className="text-sm font-normal cursor-pointer"
              >
                Mark as Master Outline
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Master outlines provide a navigation hub when viewing linked sub-outlines.
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!title.trim()}>
              {duplicateWarning ? 'Save Anyway' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
