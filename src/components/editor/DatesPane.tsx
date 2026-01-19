import { useState, useEffect, useRef, useCallback } from 'react';
import { useEditorContext } from './EditorContext';
import { AddDateDialog } from './AddDateDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Calendar,
  CalendarDays,
  Plus,
  Search,
  X,
  Highlighter,
  Eye,
  Type,
  RefreshCw,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Check,
  RotateCcw,
  ChevronsDown,
  ChevronsUp,
} from 'lucide-react';
import { formatDateForDisplay, TaggedDate } from '@/lib/dateScanner';

interface DatesPaneProps {
  collapsed?: boolean;
  selectedText?: string;
}

export function DatesPane({ collapsed, selectedText }: DatesPaneProps) {
  const {
    dates,
    setDates,
    addDate,
    inspectedDate,
    setInspectedDate,
    highlightedDate,
    setHighlightedDate,
    dateHighlightMode,
    setDateHighlightMode,
    recalculateDateUsages,
    reparseDates,
    hierarchyBlocks,
    outlineStyle,
    mixedConfig,
    selectionSource,
    insertTextAtCursor,
  } = useEditorContext();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [capturedSelection, setCapturedSelection] = useState<string>('');
  const [collapsedDates, setCollapsedDates] = useState<Set<string>>(new Set());
  const [recalcFeedback, setRecalcFeedback] = useState<'idle' | 'done' | 'empty'>('idle');
  const [reparseFeedback, setReparseFeedback] = useState<'idle' | 'done' | 'none'>('idle');
  const [orphanWarningDismissed, setOrphanWarningDismissed] = useState(false);

  // Backup for undo
  const deletedDatesBackup = useRef<TaggedDate[]>([]);
  const undoTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const hasAutoExpandedRef = useRef(false);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) {
        clearTimeout(undoTimeoutRef.current);
      }
    };
  }, []);

  // Auto-expand all tiles when dates first load (survives HMR state carryover)
  useEffect(() => {
    if (dates.length > 0 && !hasAutoExpandedRef.current) {
      setCollapsedDates(new Set());
      hasAutoExpandedRef.current = true;
    }
  }, [dates]);

  // Reset auto-expand flag when dates list is cleared
  useEffect(() => {
    if (dates.length === 0) {
      hasAutoExpandedRef.current = false;
    }
  }, [dates.length]);

  // Expand all / Collapse all handlers
  const handleExpandAll = useCallback(() => {
    setCollapsedDates(new Set());
  }, []);

  const handleCollapseAll = useCallback(() => {
    setCollapsedDates(new Set(dates.map(d => d.id)));
  }, [dates]);

  // Toggle collapsed state for a date
  const toggleCollapsed = useCallback((id: string) => {
    setCollapsedDates(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Auto-recalculate when hierarchy blocks or dates change
  useEffect(() => {
    if (dates.length > 0 && Object.keys(hierarchyBlocks).length > 0) {
      recalculateDateUsages(hierarchyBlocks, { style: outlineStyle, mixedConfig });
    }
  }, [hierarchyBlocks, dates.length, outlineStyle, mixedConfig, recalculateDateUsages]);

  // Check for orphan dates (no outline to scan)
  const hasOutline = Object.keys(hierarchyBlocks).length > 0;
  const showOrphanWarning = dates.length > 0 && !hasOutline && !orphanWarningDismissed;

  // Handlers
  const handleClearDates = useCallback(() => {
    if (dates.length === 0) return;

    deletedDatesBackup.current = [...dates];
    setDates([]);

    if (undoTimeoutRef.current) {
      clearTimeout(undoTimeoutRef.current);
    }

    toast('Cleared all dates', {
      action: {
        label: 'Undo',
        onClick: () => {
          setDates(deletedDatesBackup.current);
          deletedDatesBackup.current = [];
        },
      },
      duration: 10000,
    });

    undoTimeoutRef.current = setTimeout(() => {
      deletedDatesBackup.current = [];
    }, 10000);
  }, [dates, setDates]);

  const handleHighlightDate = useCallback((taggedDate: TaggedDate) => {
    if (highlightedDate?.id === taggedDate.id) {
      setHighlightedDate(null);
    } else {
      setHighlightedDate(taggedDate);
      if (dateHighlightMode === 'none') {
        setDateHighlightMode('selected');
      }
    }
  }, [highlightedDate, setHighlightedDate, dateHighlightMode, setDateHighlightMode]);

  const handleViewUsages = useCallback((taggedDate: TaggedDate) => {
    if (inspectedDate?.id === taggedDate.id) {
      setInspectedDate(null);
    } else {
      setInspectedDate(taggedDate);
    }
  }, [inspectedDate, setInspectedDate]);

  const handleDateClick = useCallback((taggedDate: TaggedDate) => {
    if (insertTextAtCursor) {
      insertTextAtCursor(taggedDate.rawText);
    }
  }, [insertTextAtCursor]);

  const cycleHighlightMode = useCallback(() => {
    const modes: Array<'all' | 'selected' | 'none'> = ['all', 'selected', 'none'];
    const currentIndex = modes.indexOf(dateHighlightMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setDateHighlightMode(nextMode);

    if (nextMode === 'selected') {
      setHighlightedDate(null);
    }
  }, [dateHighlightMode, setDateHighlightMode, setHighlightedDate]);

  const handleRecalculate = useCallback(() => {
    if (!hasOutline) {
      setRecalcFeedback('empty');
    } else {
      recalculateDateUsages(hierarchyBlocks, { style: outlineStyle, mixedConfig });
      setRecalcFeedback('done');
    }
    setTimeout(() => setRecalcFeedback('idle'), 1500);
  }, [hasOutline, recalculateDateUsages, hierarchyBlocks, outlineStyle, mixedConfig]);

  const handleReparseDates = useCallback(() => {
    const count = reparseDates();
    if (count > 0) {
      setReparseFeedback('done');
      toast.success(`Re-parsed ${count} date${count !== 1 ? 's' : ''}`);
    } else {
      setReparseFeedback('none');
      toast.info('All dates already correct');
    }
    setTimeout(() => setReparseFeedback('idle'), 1500);
  }, [reparseDates]);


  // Filter dates by search
  const filteredDates = dates.filter(d => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.rawText.toLowerCase().includes(q) ||
      (d.description?.toLowerCase().includes(q))
    );
  });

  // Collapsed view
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-2">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={() => {
                  setCapturedSelection(selectedText || '');
                  setDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Add Date</TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {dates.length > 0 && (
          <div className="text-[10px] text-muted-foreground font-medium">
            {dates.length}
          </div>
        )}

        <AddDateDialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) setCapturedSelection('');
          }}
          prefillSelection={capturedSelection}
          selectionSource={selectionSource}
          onSave={(date, rawText, description) => {
            addDate(date, rawText, description);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Tool strip */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border shrink-0">
        <TooltipProvider delayDuration={300}>
          {/* Add Date */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-allow-pointer
                variant="ghost"
                size="sm"
                onClick={() => {
                  setCapturedSelection(selectedText || '');
                  setDialogOpen(true);
                }}
                className={cn(
                  "h-7 w-7 p-0",
                  selectedText && "bg-accent/20 text-accent"
                )}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {selectedText ? `Tag "${selectedText.slice(0, 20)}..."` : 'Tag Date'}
            </TooltipContent>
          </Tooltip>

          {/* Search toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-allow-pointer
                variant="ghost"
                size="sm"
                onClick={() => setSearchOpen(!searchOpen)}
                className={cn("h-7 w-7 p-0", searchOpen && "bg-accent/20")}
              >
                <Search className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search Dates</TooltipContent>
          </Tooltip>

          {/* Highlight mode */}
          <Popover>
            <Tooltip>
              <TooltipTrigger asChild>
                <PopoverTrigger asChild>
                  <Button
                    data-allow-pointer
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-7 w-7 p-0",
                      dateHighlightMode === 'all' && "text-blue-500",
                      dateHighlightMode === 'selected' && highlightedDate && "text-blue-500"
                    )}
                  >
                    <Highlighter className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
              </TooltipTrigger>
              <TooltipContent>Highlight Mode</TooltipContent>
            </Tooltip>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="flex flex-col gap-1 text-sm">
                <button
                  onClick={() => setDateHighlightMode('all')}
                  className={cn(
                    "px-3 py-1.5 rounded text-left hover:bg-muted",
                    dateHighlightMode === 'all' && "bg-muted font-medium"
                  )}
                >
                  All dates
                </button>
                <button
                  onClick={() => {
                    setDateHighlightMode('selected');
                    setHighlightedDate(null);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded text-left hover:bg-muted",
                    dateHighlightMode === 'selected' && "bg-muted font-medium"
                  )}
                >
                  Selected only
                </button>
                <button
                  onClick={() => setDateHighlightMode('none')}
                  className={cn(
                    "px-3 py-1.5 rounded text-left hover:bg-muted",
                    dateHighlightMode === 'none' && "bg-muted font-medium"
                  )}
                >
                  Off
                </button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Recalculate */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-allow-pointer
                variant="ghost"
                size="sm"
                onClick={handleRecalculate}
                className={cn(
                  "h-7 w-7 p-0",
                  recalcFeedback === 'done' && "text-green-500",
                  recalcFeedback === 'empty' && "text-yellow-500"
                )}
              >
                {recalcFeedback === 'done' ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              {recalcFeedback === 'done'
                ? 'Usages updated!'
                : recalcFeedback === 'empty'
                  ? 'No outline to scan'
                  : 'Recalculate Usages'}
            </TooltipContent>
          </Tooltip>

          {/* Re-parse dates */}
          {dates.length > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-allow-pointer
                  variant="ghost"
                  size="sm"
                  onClick={handleReparseDates}
                  className={cn(
                    "h-7 w-7 p-0",
                    reparseFeedback === 'done' && "text-green-500",
                    reparseFeedback === 'none' && "text-muted-foreground"
                  )}
                >
                  {reparseFeedback === 'done' ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <RotateCcw className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {reparseFeedback === 'done'
                  ? 'Dates re-parsed!'
                  : reparseFeedback === 'none'
                    ? 'All dates correct'
                    : 'Re-parse Dates from Text'}
              </TooltipContent>
            </Tooltip>
          )}

          {/* Expand all / Collapse all */}
          {dates.length > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-allow-pointer
                    variant="ghost"
                    size="sm"
                    onClick={handleExpandAll}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronsDown className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Expand All</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-allow-pointer
                    variant="ghost"
                    size="sm"
                    onClick={handleCollapseAll}
                    className="h-7 w-7 p-0"
                  >
                    <ChevronsUp className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Collapse All</TooltipContent>
              </Tooltip>
            </>
          )}

          <div className="flex-1" />

          {/* Clear all */}
          {dates.length > 0 && (
            <AlertDialog>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertDialogTrigger asChild>
                    <Button
                      data-allow-pointer
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 text-destructive/70 hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent>Clear All Dates</TooltipContent>
              </Tooltip>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Clear all dates?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will remove all {dates.length} tagged date{dates.length !== 1 && 's'}.
                    You can undo this action for 10 seconds.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearDates}>
                    Clear All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </TooltipProvider>
      </div>

      {/* Orphan warning */}
      {showOrphanWarning && (
        <div className="mx-2 mt-2 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-md text-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="text-yellow-700 dark:text-yellow-400">
                No outline found. Usages cannot be calculated.
              </p>
              <button
                onClick={() => setOrphanWarningDismissed(true)}
                className="text-muted-foreground hover:underline mt-1"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search input */}
      {searchOpen && (
        <div className="px-2 py-1.5 border-b border-border">
          <div className="relative">
            <Input
              placeholder="Search dates..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 text-xs pr-6"
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dates list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1.5">
          {filteredDates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {dates.length === 0 ? (
                <div className="flex flex-col items-center gap-2">
                  <CalendarDays className="h-8 w-8 opacity-40" />
                  <p>No dates tagged yet</p>
                  <p className="text-xs">Select text and click + to tag</p>
                </div>
              ) : (
                <p>No matching dates</p>
              )}
            </div>
          ) : (
            filteredDates.map((taggedDate) => {
              const isCollapsed = collapsedDates.has(taggedDate.id);
              const isHighlighted = highlightedDate?.id === taggedDate.id;
              const isInspected = inspectedDate?.id === taggedDate.id;
              const usageCount = taggedDate.usages.reduce((sum, u) => sum + u.count, 0);

              return (
                <div
                  key={taggedDate.id}
                  className={cn(
                    "border rounded-lg p-3 bg-card transition-colors shadow-sm",
                    isHighlighted && "border-blue-500/50 bg-blue-500/5"
                  )}
                >
                  {/* Primary content: Description or rawText as main focus */}
                  <div className="mb-2">
                    {taggedDate.description ? (
                      <p className="text-sm font-medium text-foreground leading-snug break-words">
                        {taggedDate.description}
                      </p>
                    ) : (
                      <p className="text-sm text-foreground leading-snug break-words">
                        "{taggedDate.rawText}"
                      </p>
                    )}
                  </div>

                  {/* Secondary row: formatted date + usage count */}
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-3.5 w-3.5 text-info shrink-0" />
                    <span className="text-xs font-medium text-info">
                      {formatDateForDisplay(taggedDate.date)}
                    </span>
                    {usageCount > 0 && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded ml-auto">
                        {usageCount} usage{usageCount !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>

                  {/* Show rawText as tertiary if description exists */}
                  {taggedDate.description && (
                    <div className="text-xs text-muted-foreground italic mb-2 break-words">
                      "{taggedDate.rawText}"
                    </div>
                  )}

                  {/* Tool strip + expand toggle */}
                  <div className="flex items-center gap-0.5 pt-1 border-t border-border/50">
                    <TooltipProvider delayDuration={300}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            data-allow-pointer
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDateClick(taggedDate)}
                            className="h-6 w-6 p-0"
                          >
                            <Type className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Insert</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            data-allow-pointer
                            variant="ghost"
                            size="sm"
                            onClick={() => handleHighlightDate(taggedDate)}
                            className={cn(
                              "h-6 w-6 p-0",
                              isHighlighted && "bg-blue-500/20 text-blue-500"
                            )}
                          >
                            <Highlighter className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isHighlighted ? 'Stop highlighting' : 'Highlight'}
                        </TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            data-allow-pointer
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewUsages(taggedDate)}
                            className={cn(
                              "h-6 w-6 p-0",
                              isInspected && "bg-accent/20 text-accent"
                            )}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isInspected ? 'Hide usages' : 'View usages'}
                        </TooltipContent>
                      </Tooltip>

                      {/* Collapse toggle for locations - expanded by default */}
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            data-allow-pointer
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleCollapsed(taggedDate.id)}
                            className="h-6 w-6 p-0 ml-auto"
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          {isCollapsed ? 'Show locations' : 'Hide locations'}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Locations - shown by default (when NOT in collapsed set) */}
                  {!isCollapsed && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <div className="text-[11px] space-y-0.5">
                        <div className="text-muted-foreground font-medium mb-1">Locations:</div>
                        {taggedDate.usages.length === 0 ? (
                          <div className="text-xs text-muted-foreground">No locations found.</div>
                        ) : (
                          <>
                            {taggedDate.usages.slice(0, 5).map((usage, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-muted-foreground">
                                <span className="font-mono text-[10px]">{usage.nodePrefix}</span>
                                <span className="truncate text-xs">{usage.nodeLabel}</span>
                                {usage.count > 1 && (
                                  <span className="text-[10px]">×{usage.count}</span>
                                )}
                              </div>
                            ))}
                            {taggedDate.usages.length > 5 && (
                              <div className="text-muted-foreground text-[10px]">
                                +{taggedDate.usages.length - 5} more...
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Add Date Dialog */}
      <AddDateDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setCapturedSelection('');
        }}
        prefillSelection={capturedSelection}
        selectionSource={selectionSource}
        onSave={(date, rawText, description) => {
          addDate(date, rawText, description);
        }}
      />
    </div>
  );
}
