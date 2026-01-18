import { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface SaveAsMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAsMaster: (newTitle?: string) => void;
  onJustNavigate: () => void;
  documentTitle: string;
}

export function SaveAsMasterDialog({
  open,
  onOpenChange,
  onSaveAsMaster,
  onJustNavigate,
  documentTitle,
}: SaveAsMasterDialogProps) {
  const isUntitled = documentTitle === 'Untitled';
  const [title, setTitle] = useState(documentTitle);

  // Reset title when dialog opens
  useEffect(() => {
    if (open) {
      setTitle(isUntitled ? '' : documentTitle);
    }
  }, [open, documentTitle, isUntitled]);

  const handleSave = () => {
    onOpenChange(false);
    onSaveAsMaster(isUntitled ? title : undefined);
  };

  const canSave = !isUntitled || title.trim().length > 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save as Master Outline?</AlertDialogTitle>
          <AlertDialogDescription>
            {isUntitled ? (
              "This document contains links to other documents. Enter a name and save it as a Master Outline to enable the navigation hub in the sidebar."
            ) : (
              `"${documentTitle}" contains links to other documents. Would you like to save it as a Master Outline? This enables the navigation hub in the sidebar, allowing you to easily jump between linked documents.`
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {isUntitled && (
          <div className="py-2">
            <Label htmlFor="master-title" className="text-sm font-medium">
              Master Outline Title
            </Label>
            <Input
              id="master-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter a title..."
              className="mt-1.5"
              autoFocus
            />
          </div>
        )}

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onJustNavigate();
            }}
          >
            Just Navigate
          </Button>
          <AlertDialogAction
            onClick={handleSave}
            disabled={!canSave}
          >
            Save as Master
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
