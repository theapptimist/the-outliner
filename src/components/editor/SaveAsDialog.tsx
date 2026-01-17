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

interface SaveAsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (title: string, isMaster: boolean) => void;
  defaultTitle?: string;
  defaultIsMaster?: boolean;
}

export const SaveAsDialog = forwardRef<HTMLDivElement, SaveAsDialogProps>(function SaveAsDialog({
  open,
  onOpenChange,
  onSave,
  defaultTitle = '',
  defaultIsMaster = false,
}, ref) {
  const [title, setTitle] = useState(defaultTitle);
  const [isMaster, setIsMaster] = useState(defaultIsMaster);

  useEffect(() => {
    if (open) {
      setTitle(defaultTitle);
      setIsMaster(defaultIsMaster);
    }
  }, [open, defaultTitle, defaultIsMaster]);

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
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
});
