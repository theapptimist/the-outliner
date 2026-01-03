import { useState, useCallback } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus, Search, MapPin, Eye, Trash2, Highlighter, HighlighterIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { AddTermDialog } from './AddTermDialog';
import { useEditorContext, DefinedTerm, HighlightMode } from './EditorContext';

interface DefinedTermsPaneProps {
  collapsed: boolean;
  selectedText?: string;
}

export function DefinedTermsPane({ collapsed, selectedText }: DefinedTermsPaneProps) {
  const { 
    selectionSource, 
    insertTextAtCursor, 
    setInspectedTerm, 
    terms, 
    setTerms, 
    addTerm,
    highlightMode,
    setHighlightMode,
  } = useEditorContext();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

  // Handle opening term usages pane
  const handleViewUsages = useCallback((term: DefinedTerm, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setInspectedTerm(term);
  }, [setInspectedTerm]);

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

  const filteredTerms = terms.filter(t =>
    t.term.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.definition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 space-y-2">
        <BookOpen className="h-5 w-5 text-accent" />
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Vertical Tool Strip */}
      <div className="flex flex-col items-center gap-1 p-1 border-r border-border/30 bg-muted/20">
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
                "h-8 w-8 p-0",
                selectedText && "bg-accent/20 text-accent"
              )}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Add term{selectedText ? ' (from selection)' : ''}
          </TooltipContent>
        </Tooltip>

        {/* Highlight Mode Toggle */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={cycleHighlightMode}
              className={cn(
                "h-8 w-8 p-0 relative",
                highlightMode === 'all' && "bg-accent/20 text-accent",
                highlightMode === 'selected' && "bg-primary/20 text-primary",
                highlightMode === 'none' && "text-muted-foreground"
              )}
            >
              <Highlighter className="h-4 w-4" />
              {/* Mode indicator dot */}
              <span className={cn(
                "absolute bottom-1 right-1 h-1.5 w-1.5 rounded-full",
                highlightMode === 'all' && "bg-accent",
                highlightMode === 'selected' && "bg-primary",
                highlightMode === 'none' && "bg-muted-foreground"
              )} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Highlight: {highlightMode === 'all' ? 'All terms' : highlightMode === 'selected' ? 'Selected only' : 'Off'}
          </TooltipContent>
        </Tooltip>

        <div className="flex-1" />

        {/* Clear All */}
        {terms.length > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => setTerms([])}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Clear all terms ({terms.length})
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Search */}
        <div className="p-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Search terms..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-7 h-8 text-xs"
            />
          </div>
        </div>

        {/* Terms List */}
        <ScrollArea className="flex-1 px-2">
          <div className="space-y-2 pb-2">
            {filteredTerms.map((term) => {
              const isExpanded = expandedTerms.has(term.id);
              const hasUsages = term.usages.length > 0;
              const totalUsages = term.usages.reduce((sum, u) => sum + u.count, 0);

              return (
                <div
                  key={term.id}
                  className={cn(
                    "rounded-md border border-border/50 bg-card/50",
                    "hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer"
                  )}
                  onClick={(e) => handleTermClick(term, e)}
                  onMouseDownCapture={(e) => {
                    // Prevent focus theft from editor textarea
                    e.preventDefault();
                  }}
                >
                  <Collapsible
                    open={isExpanded}
                    onOpenChange={(open) => {
                      const next = new Set(expandedTerms);
                      if (open) next.add(term.id);
                      else next.delete(term.id);
                      setExpandedTerms(next);
                    }}
                  >
                    <CollapsibleTrigger asChild>
                      <button 
                        className="w-full p-2 text-left"
                        onMouseDownCapture={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center justify-between">
                          <div className="font-medium text-xs text-foreground">{term.term}</div>
                          <div className="flex items-center gap-1">
                            {totalUsages > 0 && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    className="flex items-center gap-1 text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded hover:bg-accent/30 transition-colors"
                                    onMouseDownCapture={(e) => e.stopPropagation()}
                                    onClick={(e) => handleViewUsages(term, e)}
                                  >
                                    <Eye className="h-2.5 w-2.5" />
                                    {totalUsages}
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="left" className="text-xs">
                                  View all usages
                                </TooltipContent>
                              </Tooltip>
                            )}
                            {hasUsages && (
                              isExpanded ? (
                                <ChevronDown className="h-3 w-3 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                              )
                            )}
                          </div>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                          {term.definition}
                        </div>
                        {term.sourceLocation && (
                          <div className="flex items-center gap-1.5 mt-2 text-xs text-primary">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="font-mono font-medium">{term.sourceLocation.prefix}</span>
                            <span className="truncate max-w-[140px]">{term.sourceLocation.label}</span>
                          </div>
                        )}
                      </button>
                    </CollapsibleTrigger>
                    
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
    </div>
  );
}
