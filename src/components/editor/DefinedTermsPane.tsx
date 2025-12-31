import { useState } from 'react';
import { BookOpen, Plus, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface DefinedTerm {
  id: string;
  term: string;
  definition: string;
}

interface DefinedTermsPaneProps {
  collapsed: boolean;
}

export function DefinedTermsPane({ collapsed }: DefinedTermsPaneProps) {
  const [terms, setTerms] = useState<DefinedTerm[]>([
    { id: '1', term: 'Agreement', definition: 'This thing you\'re reading right now, plus the attachments.' },
    { id: '2', term: 'Effective Date', definition: 'When everyone actually signs it.' },
    { id: '3', term: 'Party', definition: 'You, them, whoever signed.' },
  ]);
  const [searchQuery, setSearchQuery] = useState('');

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
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs border-dashed border-accent/50 text-accent hover:bg-accent/10 hover:border-accent"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Add Term
        </Button>
      </div>

      {/* Terms List */}
      <ScrollArea className="flex-1 px-2">
        <div className="space-y-2 pb-2">
          {filteredTerms.map((term) => (
            <div
              key={term.id}
              className={cn(
                "p-2 rounded-md border border-border/50 bg-card/50",
                "hover:border-accent/50 hover:bg-accent/5 transition-colors cursor-pointer"
              )}
            >
              <div className="font-medium text-xs text-foreground">{term.term}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                {term.definition}
              </div>
            </div>
          ))}
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
    </div>
  );
}
