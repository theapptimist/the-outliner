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

interface SaveAsMasterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveAsMaster: () => void;
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
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save as Master Outline?</AlertDialogTitle>
          <AlertDialogDescription>
            "{documentTitle}" contains links to other documents. Would you like to save it as a Master Outline?
            This enables the navigation hub in the sidebar, allowing you to easily jump between linked documents.
          </AlertDialogDescription>
        </AlertDialogHeader>
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
            onClick={() => {
              onOpenChange(false);
              onSaveAsMaster();
            }}
          >
            Save as Master
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
