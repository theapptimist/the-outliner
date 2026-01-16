import { useState, useMemo, useRef, useEffect } from 'react';
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
import { listCloudDocuments, loadCloudDocument, CloudDocumentMetadata } from '@/lib/cloudDocumentStorage';
import { extractOutlineFromHierarchyBlock } from '@/lib/hierarchyExtractor';
import { Upload, FileText, ChevronRight, AlertCircle, File, X, Cloud, ClipboardPaste, HardDrive } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { formatDistanceToNow } from 'date-fns';

interface ImportOutlineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (items: Array<{ label: string; depth: number }>) => void;
}

type InputMode = 'cloud' | 'disk' | 'paste';

export function ImportOutlineDialog({
  open,
  onOpenChange,
  onImport,
}: ImportOutlineDialogProps) {
  const [inputMode, setInputMode] = useState<InputMode>('cloud');
  const [inputText, setInputText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [cloudDocs, setCloudDocs] = useState<CloudDocumentMetadata[]>([]);
  const [selectedCloudDocId, setSelectedCloudDocId] = useState<string | null>(null);
  const [cloudOutline, setCloudOutline] = useState<Array<{ label: string; depth: number }>>([]);
  const [loadingCloud, setLoadingCloud] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load cloud documents when dialog opens
  useEffect(() => {
    if (open) {
      listCloudDocuments().then(setCloudDocs);
    }
  }, [open]);

  // Parse text input (for disk/paste modes)
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

  // Get current preview items based on mode
  const previewItems = useMemo(() => {
    if (inputMode === 'cloud') {
      return cloudOutline;
    }
    return parseResult?.hierarchy || [];
  }, [inputMode, cloudOutline, parseResult]);

  const handleCloudDocSelect = async (docId: string) => {
    setSelectedCloudDocId(docId);
    setLoadingCloud(true);
    
    try {
      const doc = await loadCloudDocument(docId);
      if (doc && doc.hierarchyBlocks) {
        // Get the first hierarchy block (usually 'main' or the only one)
        const blockKey = Object.keys(doc.hierarchyBlocks)[0];
        if (blockKey) {
          const outline = extractOutlineFromHierarchyBlock(doc.hierarchyBlocks[blockKey]);
          setCloudOutline(outline);
        } else {
          setCloudOutline([]);
        }
      } else {
        setCloudOutline([]);
      }
    } catch (error) {
      console.error('Failed to load cloud document:', error);
      setCloudOutline([]);
    } finally {
      setLoadingCloud(false);
    }
  };

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
    if (previewItems.length > 0) {
      onImport(previewItems);
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
    setSelectedCloudDocId(null);
    setCloudOutline([]);
    setInputMode('cloud');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleModeChange = (mode: string) => {
    setInputMode(mode as InputMode);
    // Clear state when switching modes
    if (mode !== 'cloud') {
      setSelectedCloudDocId(null);
      setCloudOutline([]);
    }
    if (mode !== 'disk' && mode !== 'paste') {
      setInputText('');
      setSelectedFile(null);
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
            Import an outline from your cloud documents, a local file, or paste text directly.
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
          {/* Input area with tabs */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <Tabs value={inputMode} onValueChange={handleModeChange} className="flex flex-col min-h-0 overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 shrink-0">
                <TabsTrigger value="cloud" className="gap-1.5 text-xs">
                  <Cloud className="h-3.5 w-3.5" />
                  Cloud
                </TabsTrigger>
                <TabsTrigger value="disk" className="gap-1.5 text-xs">
                  <HardDrive className="h-3.5 w-3.5" />
                  Disk
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-1.5 text-xs">
                  <ClipboardPaste className="h-3.5 w-3.5" />
                  Paste
                </TabsTrigger>
              </TabsList>

              {/* Cloud Tab */}
              <TabsContent value="cloud" className="flex-1 min-h-0 overflow-hidden mt-2">
                <ScrollArea className="h-[280px] border rounded-md bg-muted/30">
                  <div className="p-2 space-y-1">
                    {cloudDocs.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-[250px] text-muted-foreground text-sm gap-2">
                        <Cloud className="h-8 w-8" />
                        <span>No cloud documents found</span>
                      </div>
                    ) : (
                      cloudDocs.map((doc) => (
                        <button
                          key={doc.id}
                          onClick={() => handleCloudDocSelect(doc.id)}
                          className={cn(
                            "w-full text-left p-2 rounded-md hover:bg-accent transition-colors",
                            selectedCloudDocId === doc.id && "bg-accent"
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{doc.title}</div>
                              <div className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(doc.updatedAt), { addSuffix: true })}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>

              {/* Disk Tab */}
              <TabsContent value="disk" className="flex-1 min-h-0 overflow-hidden mt-2">
                <div className="h-[280px] border rounded-md bg-muted/30 flex flex-col">
                  {!selectedFile ? (
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
                    </div>
                  ) : (
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
                  )}
                </div>
              </TabsContent>

              {/* Paste Tab */}
              <TabsContent value="paste" className="flex-1 min-h-0 overflow-hidden mt-2">
                <ScrollArea className="h-[280px] border rounded-md bg-muted/30">
                  <Textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={`Paste your outline here...

Example formats supported:
• Numbered lists (1. 2. 3.)
• Bulleted lists (- or *)
• Date-based timelines
• Indented hierarchies`}
                    className="min-h-[280px] h-full font-mono text-xs resize-none border-0 focus-visible:ring-0 rounded-none"
                  />
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview area */}
          <div className="flex flex-col gap-2 min-h-0 overflow-hidden">
            <div className="text-sm font-medium flex items-center gap-2 shrink-0">
              Preview
              {previewItems.length > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({previewItems.length} items)
                </span>
              )}
            </div>
            <ScrollArea className="flex-1 min-h-0 border rounded-md bg-muted/30">
              <div className="p-2">
                {loadingCloud ? (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                    Loading...
                  </div>
                ) : previewItems.length === 0 ? (
                  <div className="flex items-center justify-center h-[280px] text-muted-foreground text-sm">
                    {inputMode === 'cloud' 
                      ? 'Select a document to preview'
                      : inputMode === 'disk'
                      ? 'Select a file to see preview'
                      : 'Paste text to see preview'
                    }
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {previewItems.slice(0, 50).map((item, i) => renderPreviewItem(item, i))}
                    {previewItems.length > 50 && (
                      <div className="text-xs text-muted-foreground pt-2 pl-1">
                        ... and {previewItems.length - 50} more items
                      </div>
                    )}
                  </div>
                )}
              </div>
            </ScrollArea>
            
            {parseResult && parseResult.hasStructure && (inputMode === 'disk' || inputMode === 'paste') && (
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

        <DialogFooter className="shrink-0">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button 
            onClick={handleImport}
            disabled={previewItems.length === 0 || loadingCloud}
          >
            Import {previewItems.length > 0 ? `${previewItems.length} items` : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
