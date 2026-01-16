import { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { analyzeOutlineText, parseOutlineHierarchy } from '@/lib/outlinePasteParser';
import { Upload, FileText, ChevronRight, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImportOutlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: Array<{ label: string; depth: number }>) => void;
}

export function ImportOutlineDialog({
  open,
  onOpenChange,
  onImport,
}: ImportOutlineDialogProps) {
  const [inputText, setInputText] = useState('');

  // Parse the input text whenever it changes
  const parseResult = useMemo(() => {
    if (!inputText.trim()) return null;
    const analysis = analyzeOutlineText(inputText);
    const hierarchy = parseOutlineHierarchy(analysis);
    return {
      analysis,
      hierarchy,
      hasStructure: analysis.hasOutlinePatterns,
    };
  }, [inputText]);

  const handleImport = () => {
    if (parseResult && parseResult.hierarchy.length > 0) {
      onImport(parseResult.hierarchy);
      setInputText('');
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    setInputText('');
    onOpenChange(false);
  };

  // Render a preview item with visual depth indicator
  const renderPreviewItem = (item: { label: string; depth: number }, index: number) => {
    const truncatedLabel = item.label.length > 60 
      ? item.label.slice(0, 57) + '...' 
      : item.label;
    
    return (
      <div
        key={index}
        className={cn(
          "flex items-start gap-1 py-0.5 text-xs",
          item.depth === 0 && "font-medium"
        )}
        style={{ paddingLeft: `${item.depth * 16}px` }}
      >
        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
        <span className="break-words">{truncatedLabel}</span>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Import Outline
          </DialogTitle>
          <DialogDescription>
            Paste an outline from ChatGPT, Google Docs, or any text source. 
            The system will detect structure from dates, indentation, or numbered lists.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Input area */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="text-sm font-medium flex items-center gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              Paste Your Outline
            </div>
            <ScrollArea className="flex-1 min-h-0 border rounded-md">
              <Textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={`Paste your outline here...

Example formats supported:
• Numbered lists (1. 2. 3.)
• Bulleted lists (- or *)
• Date-based timelines
• Indented hierarchies
• Section headers`}
                className="min-h-[300px] h-full font-mono text-xs resize-none border-0 focus-visible:ring-0"
              />
            </ScrollArea>
          </div>

          {/* Preview area */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="text-sm font-medium flex items-center gap-2 shrink-0">
              Preview
              {parseResult && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({parseResult.hierarchy.length} items)
                </span>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0 border rounded-md bg-muted/30">
              <div className="p-2">
                {!inputText.trim() ? (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                    Paste content to see preview
                  </div>
                ) : parseResult && parseResult.hierarchy.length > 0 ? (
                  <div className="space-y-0.5">
                    {parseResult.hierarchy.slice(0, 50).map((item, i) => renderPreviewItem(item, i))}
                    {parseResult.hierarchy.length > 50 && (
                      <div className="text-xs text-muted-foreground pt-2 pl-1">
                        ... and {parseResult.hierarchy.length - 50} more items
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground text-sm gap-2">
                    <AlertCircle className="h-5 w-5" />
                    <span>No structure detected</span>
                    <span className="text-xs">Content will be imported as flat list</span>
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {parseResult && parseResult.hasStructure && (
              <div className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                Structure detected: {
                  parseResult.analysis.lines.filter(l => l.isDateLine).length > 0
                    ? 'Timeline/Date-based'
                    : parseResult.analysis.lines.filter(l => l.isSectionHeader).length > 0
                    ? 'Section-based'
                    : 'Traditional outline'
                }
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={!parseResult || parseResult.hierarchy.length === 0}
          >
            Import {parseResult ? `${parseResult.hierarchy.length} items` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}