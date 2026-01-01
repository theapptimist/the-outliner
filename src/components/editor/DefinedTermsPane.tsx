import { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Plus, Search, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { AddTermDialog } from './AddTermDialog';
import { TermUsage } from '@/lib/termScanner';
import { useEditorContext, SelectionSource } from './EditorContext';

interface DefinedTerm {
  id: string;
  term: string;
  definition: string;
  sourceLocation?: {
    prefix: string;
    label: string;
  };
  usages: TermUsage[];
}

interface DefinedTermsPaneProps {
  collapsed: boolean;
  selectedText?: string;
}

export function DefinedTermsPane({ collapsed, selectedText }: DefinedTermsPaneProps) {
  const { selectionSource } = useEditorContext();
  const [terms, setTerms] = useState<DefinedTerm[]>([
    { id: '1', term: 'Agreement', definition: 'This thing you\'re reading right now, plus the attachments.', usages: [] },
    { id: '2', term: 'Effective Date', definition: 'When everyone actually signs it.', usages: [] },
    { id: '3', term: 'Party', definition: 'You, them, whoever signed.', usages: [] },
  ]);
  const [searchQuery, setSearchQuery] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(new Set());

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
    <div className="flex flex-col h-full">
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

      {/* Add Term Button */}
      <div className="px-2 pb-2">
        <Button
          data-add-term-btn
          variant="outline"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className={cn(
            "w-full h-8 text-xs border-dashed border-accent text-accent bg-accent/10 hover:bg-accent/20 hover:border-accent",
            selectedText && "ring-2 ring-accent/60 border-accent bg-accent/15"
          )}
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Term
          {selectedText && <span className="ml-1 text-[10px] opacity-80">(from selection)</span>}
        </Button>
      </div>

      {/* Terms List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 pb-2">
          {filteredTerms.map((term) => {
            const isExpanded = expandedTerms.has(term.id);
            const hasUsages = term.usages.length > 0;
            const totalUsages = term.usages.reduce((sum, u) => sum + u.count, 0);

            return (
              <Collapsible
                key={term.id}
                open={isExpanded}
                onOpenChange={(open) => {
                  const next = new Set(expandedTerms);
                  if (open) next.add(term.id);
                  else next.delete(term.id);
                  setExpandedTerms(next);
                }}
              >
                <div
                  className={cn(
                    "rounded-md border border-border/50 bg-card/50",
                    "hover:border-accent/50 hover:bg-accent/5 transition-colors"
                  )}
                >
                  <CollapsibleTrigger asChild>
                    <button className="w-full p-2 text-left">
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-xs text-foreground">{term.term}</div>
                        <div className="flex items-center gap-1">
                          {totalUsages > 0 && (
                            <span className="text-[10px] bg-accent/20 text-accent px-1.5 py-0.5 rounded">
                              {totalUsages}
                            </span>
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
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-primary/70">
                          <MapPin className="h-2.5 w-2.5" />
                          <span className="font-mono">{term.sourceLocation.prefix}</span>
                          <span className="truncate max-w-[120px]">{term.sourceLocation.label}</span>
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
                              className="w-full text-left text-[10px] px-1.5 py-1 rounded bg-muted/30 hover:bg-muted/50 transition-colors"
                              onClick={() => {
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
                </div>
              </Collapsible>
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
          {terms.length} defined term{terms.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Add Term Dialog */}
      <AddTermDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        prefillSelection={selectedText}
        selectionSource={selectionSource}
        onSave={(term, definition, source) => {
          const newTerm: DefinedTerm = {
            id: crypto.randomUUID(),
            term,
            definition,
            sourceLocation: source ? { prefix: source.nodePrefix, label: source.nodeLabel } : undefined,
            usages: [], // Will be populated by scanner later
          };
          setTerms(prev => [...prev, newTerm]);
        }}
      />
    </div>
  );
}
