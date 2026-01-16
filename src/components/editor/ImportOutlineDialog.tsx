import { useState, useMemo, useRef } from 'react';
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
import { Upload, FileText, ChevronRight, AlertCircle, File, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showPasteOption, setShowPasteOption] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setInputText(text);
    };
    reader.readAsText(file);
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    setInputText('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = () => {
    if (parseResult && parseResult.hierarchy.length > 0) {
      onImport(parseResult.hierarchy);
      handleReset();
      onOpenChange(false);
    }
  };

  const handleCancel = () => {
    handleReset();
    onOpenChange(false);
  };

  const handleReset = () => {
    setInputText('');
    setSelectedFile(null);
    setShowPasteOption(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
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
            Upload a text file containing an outline from ChatGPT, Google Docs, or any source.
            The system will detect structure from dates, indentation, or numbered lists.
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.text"
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="grid grid-cols-2 gap-4 flex-1 min-h-0 overflow-hidden">
          {/* Input area */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="text-sm font-medium flex items-center gap-2 shrink-0">
              <FileText className="h-4 w-4" />
              Select File
            </div>
            
            <div className="flex-1 min-h-0 border rounded-md bg-muted/30 flex flex-col">
              {!selectedFile && !showPasteOption ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 p-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <File className="h-8 w-8 text-muted-foreground" />
                  </div>
                  <Button onClick={handleChooseFile} variant="outline" className="gap-2">
                    <Upload className="h-4 w-4" />
                    Choose File...
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Supports .txt and .md files
                  </p>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-xs text-muted-foreground"
                    onClick={() => setShowPasteOption(true)}
                  >
                    Or paste text instead
                  </Button>
                </div>
              ) : selectedFile ? (
                <div className="flex-1 flex flex-col p-3 gap-2">
                  <div className="flex items-center gap-2 p-2 bg-background rounded border">
                    <File className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-sm truncate flex-1">{selectedFile.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6 shrink-0"
                      onClick={handleClearFile}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {inputText.split('\n').length} lines • {inputText.length} characters
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-fit gap-2"
                    onClick={handleChooseFile}
                  >
                    <Upload className="h-3 w-3" />
                    Choose Different File
                  </Button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                  <div className="flex items-center justify-between p-2 border-b shrink-0">
                    <span className="text-xs text-muted-foreground">Paste text</span>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="h-6 text-xs"
                      onClick={() => {
                        setShowPasteOption(false);
                        setInputText('');
                      }}
                    >
                      Use file instead
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <Textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      placeholder={`Paste your outline here...

Example formats supported:
• Numbered lists (1. 2. 3.)
• Bulleted lists (- or *)
• Date-based timelines
• Indented hierarchies`}
                      className="min-h-[250px] h-full font-mono text-xs resize-none border-0 focus-visible:ring-0 rounded-none"
                    />
                  </ScrollArea>
                </div>
              )}
            </div>
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
                    Select a file to see preview
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