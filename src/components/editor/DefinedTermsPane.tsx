import { useState, useCallback, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus, Search, MapPin, Eye, Trash2, Highlighter, RefreshCw, X, Type } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { cn } from '@/lib/utils';
import { AddTermDialog } from './AddTermDialog';
import { useEditorContext, DefinedTerm, HighlightMode } from './EditorContext';
import { useToast } from '@/hooks/use-toast';

interface DefinedTermsPaneProps {
  collapsed: boolean;
  selectedText?: string;
}

export function DefinedTermsPane({ collapsed, selectedText }: DefinedTermsPaneProps) {
  const { 
    selectionSource, 
    insertTextAtCursor, 
    inspectedTerm,
    setInspectedTerm,
    highlightedTerm,
    setHighlightedTerm,
    terms, 
    setTerms, 
    addTerm,
    highlightMode,
    setHighlightMode,
    recalculateUsages,
    document,
  } = useEditorContext();
  
  const { toast } = useToast();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());
  const [recalcFeedback, setRecalcFeedback] = useState<'idle' | 'done' | 'empty'>('idle');
  const [orphanWarningDismissed, setOrphanWarningDismissed] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  
  // Undo capability - store deleted terms temporarily
  const deletedTermsBackup = useRef<DefinedTerm[] | null>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Auto-recalculate usages when hierarchy blocks or terms change
  useEffect(() => {
    if (document?.hierarchyBlocks && Object.keys(document.hierarchyBlocks).length > 0 && terms.length > 0) {
      recalculateUsages(document.hierarchyBlocks);
    }
  }, [document?.hierarchyBlocks, terms.length, recalculateUsages]);
  
  // Handle clearing terms with undo capability
  const handleClearTerms = useCallback(() => {
    // Store backup for undo
    deletedTermsBackup.current = [...terms];
    const count = terms.length;
    
    // Clear the terms
    setTerms([]);
    setClearConfirmOpen(false);
    
    // Clear any existing timeout
    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }
    
    // Show toast with undo
    const { dismiss } = toast({
      title: `Cleared ${count} term${count !== 1 ? 's' : ''}`,
      description: "Click Undo to restore them.",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (deletedTermsBackup.current) {
              setTerms(deletedTermsBackup.current);
              deletedTermsBackup.current = null;
              dismiss();
              toast({
                title: "Terms restored",
                description: `${count} term${count !== 1 ? 's' : ''} have been restored.`,
              });
            }
          }}
        >
          Undo
        </Button>
      ),
    });
    
    // Clear backup after 10 seconds
    undoTimeoutRef.current = setTimeout(() => {
      deletedTermsBackup.current = null;
    }, 10000);
  }, [terms, setTerms, toast]);
  
  // Handle highlighting a specific term (highlighter button)
  const handleHighlightTerm = useCallback((term: DefinedTerm, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    
    // If already highlighting this term, turn off highlighting
    if (highlightMode === 'selected' && highlightedTerm?.id === term.id) {
      setHighlightMode('none');
      setHighlightedTerm(null);
    } else {
      // Set to highlight just this term
      setHighlightMode('selected');
      setHighlightedTerm(term);
    }
  }, [highlightMode, highlightedTerm, setHighlightMode, setHighlightedTerm]);

  // Handle opening term usages pane (eye button) - toggles the panel
  const handleViewUsages = useCallback((term: DefinedTerm, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    // Toggle: if already viewing this term's usages, close the panel
    if (inspectedTerm?.id === term.id) {
      setInspectedTerm(null);
    } else {
      setInspectedTerm(term);
    }
  }, [inspectedTerm, setInspectedTerm]);

  // Handle clicking on a term card to insert it at cursor
  const handleTermClick = useCallback((term: DefinedTerm, e: React.MouseEvent) => {
    // Only insert if clicking on the main card area (not on expand trigger or usages)
    if ((e.target as HTMLElement).closest('[data-usage-item]')) return;

    if (insertTextAtCursor) {
      const result = insertTextAtCursor(term.term);
      if (result) {
        // Add this location as a usage
        setTerms(prev => prev.map(t => {
          if (t.id !== term.id) return t;
          
          // Check if this location is already tracked
          const existingUsage = t.usages.find(u => u.nodeLabel === result.nodeLabel);
          if (existingUsage) {
            // Increment count
            return {
              ...t,
              usages: t.usages.map(u => 
                u.nodeLabel === result.nodeLabel 
                  ? { ...u, count: u.count + 1 }
                  : u
              )
            };
          } else {
            // Add new usage
            return {
              ...t,
              usages: [...t.usages, {
                blockId: '', // Unknown from sidebar context
                nodeId: '', // Unknown from sidebar context
                nodeLabel: `${result.nodePrefix} ${result.nodeLabel}`.trim(),
                count: 1
              }]
            };
          }
        }));
      }
    }
  }, [insertTextAtCursor, setTerms]);

  // Cycle through highlight modes
  const cycleHighlightMode = useCallback(() => {
    const modes: HighlightMode[] = ['all', 'selected', 'none'];
    const currentIndex = modes.indexOf(highlightMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    setHighlightMode(modes[nextIndex]);
  }, [highlightMode, setHighlightMode]);

  // Handle recalculating usages
  const handleRecalculate = useCallback(() => {
    if (document?.hierarchyBlocks && Object.keys(document.hierarchyBlocks).length > 0) {
      recalculateUsages(document.hierarchyBlocks);
      setRecalcFeedback('done');
    } else {
      // No hierarchy blocks to scan
      setRecalcFeedback('empty');
    }
    // Reset feedback after a moment
    setTimeout(() => setRecalcFeedback('idle'), 1500);
  }, [document, recalculateUsages]);

  const filteredTerms = terms.filter(t =>
    t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Detect orphaned terms (terms exist but no outline to scan)
  const hasOrphanedTerms = terms.length > 0 && 
    (!document?.hierarchyBlocks || Object.keys(document.hierarchyBlocks).length === 0);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 space-y-2">
        <BookOpen className="h-5 w-5 text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Vertical Tool Strip - compact */}
      <div className="flex flex-col items-center gap-0.5 px-0.5 py-1 border-r border-border/30 bg-muted/20">
        {/* Add Term */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-add-term-btn
              data-allow-pointer
              variant="ghost"
              size="sm"
              onClick={() => setDialogOpen(true)}
              className={cn(
                "h-7 w-7 p-0",
                selectedText && "bg-accent/20 text-accent"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Add term{selectedText ? ' (from selection)' : ''}
          </TooltipContent>
        </Tooltip>

        {/* Search Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSearchOpen(!searchOpen)}
              className={cn(
                "h-7 w-7 p-0",
                searchOpen && "bg-accent/20 text-accent",
                searchQuery && "text-accent"
              )}
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            {searchOpen ? 'Close search' : 'Search terms'}
          </TooltipContent>
        </Tooltip>

        {/* Highlight Mode Toggle */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 relative",
                    highlightMode === 'all' && "bg-accent/20 text-accent",
                    highlightMode === 'selected' && "bg-primary/20 text-primary",
                    highlightMode === 'none' && "text-muted-foreground"
                  )}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  {/* Mode indicator dot */}
                  <span className={cn(
                    "absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full",
                    highlightMode === 'all' && "bg-accent",
                    highlightMode === 'selected' && "bg-primary",
                    highlightMode === 'none' && "bg-muted-foreground"
                  )} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Highlight mode
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="w-auto p-1">
            <div className="flex flex-col gap-0.5">
              <Button
                variant={highlightMode === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 justify-start text-xs px-2"
                onClick={() => setHighlightMode('all')}
              >
                <span className="h-2 w-2 rounded-full bg-accent mr-2" />
                All terms
              </Button>
              <Button
                variant={highlightMode === 'selected' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 justify-start text-xs px-2"
                onClick={() => {
                  setHighlightMode('selected');
                  setHighlightedTerm(null); // Clear any highlighted term - wait for user to select one
                }}
              >
                <span className="h-2 w-2 rounded-full bg-primary mr-2" />
                Selected only
              </Button>
              {highlightMode === 'selected' && (
                <div className="px-2 py-1 text-[10px] text-muted-foreground border-t border-border/30 mt-0.5">
                  {highlightedTerm 
                    ? <span>Showing: <strong className="text-primary">{highlightedTerm.term}</strong></span>
                    : <span>Click <Highlighter className="inline h-2.5 w-2.5 mx-0.5" /> on a term to select</span>
                  }
                </div>
              )}
              <Button
                variant={highlightMode === 'none' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 justify-start text-xs px-2"
                onClick={() => setHighlightMode('none')}
              >
                <span className="h-2 w-2 rounded-full bg-muted-foreground mr-2" />
                Off
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Recalculate Usages */}
        {terms.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRecalculate}
                className={cn(
                  "h-7 w-7 p-0 transition-colors",
                  recalcFeedback === 'done' && "text-success",
                  recalcFeedback === 'empty' && "text-warning",
                  recalcFeedback === 'idle' && "text-muted-foreground hover:text-primary"
                )}
              >
                <RefreshCw className={cn(
                  "h-3.5 w-3.5",
                  recalcFeedback !== 'idle' && "animate-spin"
                )} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {recalcFeedback === 'done' 
                ? 'Usages updated!' 
                : recalcFeedback === 'empty'
                ? 'No outline to scan'
                : 'Recalculate usages'}
            </TooltipContent>
          </Tooltip>
        )}

        <div className="flex-1" />

        {/* Clear All */}
        {terms.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setClearConfirmOpen(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Clear all ({terms.length})
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Orphaned terms warning */}
        {hasOrphanedTerms && !orphanWarningDismissed && (
          <div className="p-2 border-b border-warning/30 bg-warning/10">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-warning-foreground">
                No outline found. Terms are from a previous session.
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 px-2 text-[10px] text-warning-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => setClearConfirmOpen(true)}
                >
                  Clear
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 w-5 p-0 text-warning-foreground hover:text-foreground hover:bg-muted"
                  onClick={() => setOrphanWarningDismissed(true)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Search (collapsible) */}
        {searchOpen && (
          <div className="p-2 border-b border-border/30">
            <Input
              autoFocus
              placeholder="Filter terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs"
            />
          </div>
        )}

        {/* Terms List */}
        <ScrollArea className="flex-1 px-1">
          <div className="space-y-2 pb-2">
            {filteredTerms.map((term) => {
              const isExpanded = expandedTerms.has(term.id);
              const hasUsages = term.usages.length > 0;
              const totalUsages = term.usages.reduce((sum, u) => sum + u.count, 0);
              const isHighlighted = highlightMode === 'selected' && highlightedTerm?.id === term.id;
              const isInspected = inspectedTerm?.id === term.id;

              return (
                <div
                  key={term.id}
                  className={cn(
                    "rounded-md border border-border/50 bg-card/50 overflow-hidden",
                    isHighlighted && "ring-1 ring-amber-500/50"
                  )}
                  onMouseDownCapture={(e) => {
                    // Prevent focus theft from editor textarea, but allow interactive controls
                    const target = e.target as HTMLElement;
                    const isInteractive = !!target.closest(
                      'button, [role="button"], a, input, textarea, select, [contenteditable="true"], [data-allow-pointer]'
                    );
                    if (!isInteractive) e.preventDefault();
                  }}
                >
                  {/* Tool Strip Header */}
                  <div className="flex items-center justify-between px-2 py-1.5 bg-muted/50 border-b border-border/30">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="flex items-center gap-1.5 text-xs font-medium text-foreground hover:text-primary transition-colors"
                          onClick={(e) => handleTermClick(term, e)}
                          onMouseDownCapture={(e) => e.stopPropagation()}
                        >
                          <Type className="h-3 w-3 text-primary" />
                          Insert
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        Insert term at cursor
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="flex items-center gap-1">
                      {/* Highlight button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                              isHighlighted 
                                ? "bg-amber-500/30 text-amber-600 dark:text-amber-400" 
                                : "text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10"
                            )}
                            onMouseDownCapture={(e) => e.stopPropagation()}
                            onClick={(e) => handleHighlightTerm(term, e)}
                          >
                            <Highlighter className="h-3 w-3" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {isHighlighted ? 'Turn off highlighting' : 'Highlight in document'}
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* View usages button */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            className={cn(
                              "flex items-center gap-1 px-1.5 py-0.5 rounded text-xs transition-colors",
                              isInspected 
                                ? "bg-accent/30 text-accent" 
                                : "text-accent hover:bg-accent/20"
                            )}
                            onMouseDownCapture={(e) => e.stopPropagation()}
                            onClick={(e) => handleViewUsages(term, e)}
                          >
                            <Eye className="h-3 w-3" />
                            <span className="text-[10px]">{totalUsages}</span>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          {isInspected ? 'Close usages panel' : 'View usages'}
                        </TooltipContent>
                      </Tooltip>
                      
                      {/* Expand chevron */}
                      {hasUsages && (
                        <button
                          className="p-0.5 text-muted-foreground hover:text-foreground transition-colors"
                          onMouseDownCapture={(e) => e.stopPropagation()}
                          onClick={(e) => {
                            e.stopPropagation();
                            const next = new Set(expandedTerms);
                            if (isExpanded) next.delete(term.id);
                            else next.add(term.id);
                            setExpandedTerms(next);
                          }}
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Card Content */}
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={(open) => {
                      const next = new Set(expandedTerms);
                      if (open) next.add(term.id);
                      else next.delete(term.id);
                      setExpandedTerms(next);
                    }}
                  >
                    <div className="p-2">
                      <div className="font-medium text-xs text-foreground">{term.term}</div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                        {term.definition}
                      </div>
                      {term.sourceLocation && (
                        <div className="grid grid-cols-[auto_auto_1fr] gap-1.5 mt-2 text-xs text-primary items-start">
                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                          <span className="font-mono font-medium whitespace-nowrap">{term.sourceLocation.prefix}</span>
                          <span className="min-w-0 break-words">{term.sourceLocation.label}</span>
                        </div>
                      )}
                    </div>
                    
                    <CollapsibleContent>
                      {hasUsages && (
                        <div className="px-2 pb-2 pt-1 border-t border-border/30">
                          <div className="text-[10px] text-muted-foreground mb-1">Found in:</div>
                          <div className="space-y-1">
                            {term.usages.map((usage, idx) => (
                              <button
                                key={`${usage.nodeId}-${idx}`}
                                data-usage-item
                                className="w-full text-left text-[10px] px-1.5 py-1 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Navigate to usage location
                                  console.log('Navigate to:', usage);
                                }}
                              >
                                <span className="text-foreground">{usage.nodeLabel}</span>
                                {usage.count > 1 && (
                                  <span className="text-muted-foreground ml-1">×{usage.count}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </CollapsibleContent>
                  </Collapsible>
                </div>
              );
            })}
            {filteredTerms.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                {searchQuery ? 'No matching terms' : 'No defined terms yet'}
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="p-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground text-center">
            {terms.length} term{terms.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Add Term Dialog */}
      <AddTermDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefillSelection={selectedText}
        selectionSource={selectionSource}
        onSave={(term, definition, source) => {
          addTerm(term, definition, source ?? undefined);
        }}
      />
      
      {/* Clear Confirmation Dialog */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all defined terms?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove {terms.length} term{terms.length !== 1 ? 's' : ''} from this document. 
              You'll have a brief window to undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearTerms} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Clear {terms.length} term{terms.length !== 1 ? 's' : ''}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
