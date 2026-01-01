import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SmartPasteResult, stripOutlinePrefixes, parseOutlineHierarchy } from '@/lib/outlinePasteParser';
import { FileText, List, ListTree, X } from 'lucide-react';

export type SmartPasteAction = 'strip' | 'hierarchy' | 'raw' | 'cancel';

interface SmartPasteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pasteData: SmartPasteResult | null;
  onAction: (action: SmartPasteAction, data?: string | Array<{ label: string; depth: number }>) => void;
}

export function SmartPasteDialog({ open, onOpenChange, pasteData, onAction }: SmartPasteDialogProps) {
  if (!pasteData) return null;

  const handleStrip = () => {
    const stripped = stripOutlinePrefixes(pasteData);
    onAction('strip', stripped);
    onOpenChange(false);
  };

  const handleHierarchy = () => {
    const hierarchy = parseOutlineHierarchy(pasteData);
    onAction('hierarchy', hierarchy);
    onOpenChange(false);
  };

  const handleRaw = () => {
    onAction('raw', pasteData.rawText);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onAction('cancel');
    onOpenChange(false);
  };

  // Preview of what the text looks like
  const previewLines = pasteData.lines.slice(0, 4);
  const hasMore = pasteData.lines.length > 4;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <List className="h-5 w-5 text-primary" />
            Outline Detected in Paste
          </DialogTitle>
          <DialogDescription>
            The pasted text contains outline formatting. How would you like to handle it?
          </DialogDescription>
        </DialogHeader>

        {/* Preview */}
        <div className="bg-muted/50 rounded-md p-3 font-mono text-xs max-h-32 overflow-auto">
          {previewLines.map((line, i) => (
            <div key={i} className="flex gap-2">
              {line.prefix && (
                <span className="text-destructive/70 line-through">{line.prefix.trim()}</span>
              )}
              <span className="text-foreground">{line.strippedText || <span className="text-muted-foreground italic">empty line</span>}</span>
            </div>
          ))}
          {hasMore && (
            <div className="text-muted-foreground mt-1">...and {pasteData.lines.length - 4} more lines</div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <Button
            variant="default"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleStrip}
          >
            <FileText className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">Strip prefixes</div>
              <div className="text-xs opacity-80 font-normal">Remove numbering, paste as plain text</div>
            </div>
          </Button>

          <Button
            variant="secondary"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleHierarchy}
          >
            <ListTree className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">Parse hierarchy</div>
              <div className="text-xs opacity-80 font-normal">Create nested outline nodes</div>
            </div>
          </Button>

          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-auto py-3"
            onClick={handleRaw}
          >
            <List className="h-4 w-4 flex-shrink-0" />
            <div className="text-left">
              <div className="font-medium">Paste as-is</div>
              <div className="text-xs opacity-80 font-normal">Keep original formatting</div>
            </div>
          </Button>

          <Button
            variant="ghost"
            className="w-full justify-start gap-3"
            onClick={handleCancel}
          >
            <X className="h-4 w-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
