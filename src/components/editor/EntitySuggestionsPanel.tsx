import { Check, X, Sparkles, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PersonSuggestion, 
  PlaceSuggestion, 
  DateSuggestion, 
  TermSuggestion,
  ScanState
} from '@/hooks/useEntitySuggestions';

interface SuggestionCardProps {
  title: string;
  subtitle?: string;
  onAccept: () => void;
  onDismiss: () => void;
}

function SuggestionCard({ title, subtitle, onAccept, onDismiss }: SuggestionCardProps) {
  return (
    <div className="flex items-start gap-2 p-2 bg-primary/5 border border-primary/20 rounded-md group hover:bg-primary/10 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100"
          onClick={onAccept}
          title="Accept"
        >
          <Check className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100"
          onClick={onDismiss}
          title="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}

interface EntitySuggestionsPanelProps {
  type: 'people' | 'places' | 'dates' | 'terms';
  state: ScanState;
  people: PersonSuggestion[];
  places: PlaceSuggestion[];
  dates: DateSuggestion[];
  terms: TermSuggestion[];
  onAcceptPerson: (index: number, suggestion: PersonSuggestion) => void;
  onAcceptPlace: (index: number, suggestion: PlaceSuggestion) => void;
  onAcceptDate: (index: number, suggestion: DateSuggestion) => void;
  onAcceptTerm: (index: number, suggestion: TermSuggestion) => void;
  onDismissPerson: (index: number) => void;
  onDismissPlace: (index: number) => void;
  onDismissDate: (index: number) => void;
  onDismissTerm: (index: number) => void;
  onDismissAll: () => void;
  onAcceptAll: () => void;
}

export function EntitySuggestionsPanel({
  type,
  state,
  people,
  places,
  dates,
  terms,
  onAcceptPerson,
  onAcceptPlace,
  onAcceptDate,
  onAcceptTerm,
  onDismissPerson,
  onDismissPlace,
  onDismissDate,
  onDismissTerm,
  onDismissAll,
  onAcceptAll
}: EntitySuggestionsPanelProps) {
  // Show loading state
  if (state === 'scanning') {
    return (
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg mb-3">
        <div className="flex items-center gap-2 text-primary">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm font-medium">Scanning document...</span>
        </div>
      </div>
    );
  }

  // Get suggestions for current tab
  let currentSuggestions: Array<{ title: string; subtitle?: string; index: number }> = [];
  
  if (type === 'people') {
    currentSuggestions = people.map((p, i) => ({ 
      title: p.name, 
      subtitle: p.role, 
      index: i 
    }));
  } else if (type === 'places') {
    currentSuggestions = places.map((p, i) => ({ 
      title: p.name, 
      subtitle: p.significance, 
      index: i 
    }));
  } else if (type === 'dates') {
    currentSuggestions = dates.map((d, i) => ({ 
      title: d.rawText, 
      subtitle: d.description, 
      index: i 
    }));
  } else if (type === 'terms') {
    currentSuggestions = terms.map((t, i) => ({ 
      title: t.term, 
      subtitle: t.definition, 
      index: i 
    }));
  }

  // Don't render if no suggestions for this tab
  if (currentSuggestions.length === 0 && state !== 'reviewing') {
    return null;
  }

  if (currentSuggestions.length === 0) {
    return null;
  }

  const handleAccept = (index: number) => {
    if (type === 'people') onAcceptPerson(index, people[index]);
    else if (type === 'places') onAcceptPlace(index, places[index]);
    else if (type === 'dates') onAcceptDate(index, dates[index]);
    else if (type === 'terms') onAcceptTerm(index, terms[index]);
  };

  const handleDismiss = (index: number) => {
    if (type === 'people') onDismissPerson(index);
    else if (type === 'places') onDismissPlace(index);
    else if (type === 'dates') onDismissDate(index);
    else if (type === 'terms') onDismissTerm(index);
  };

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg mb-3 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-primary/10 bg-primary/10">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <span className="text-xs font-medium text-primary">
            {currentSuggestions.length} suggestion{currentSuggestions.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 text-green-600 hover:text-green-700 hover:bg-green-100"
            onClick={onAcceptAll}
          >
            Accept All
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground"
            onClick={onDismissAll}
          >
            Dismiss All
          </Button>
        </div>
      </div>
      <ScrollArea className="max-h-48">
        <div className="p-2 space-y-1.5">
          {currentSuggestions.map((suggestion) => (
            <SuggestionCard
              key={`${type}-${suggestion.index}`}
              title={suggestion.title}
              subtitle={suggestion.subtitle}
              onAccept={() => handleAccept(suggestion.index)}
              onDismiss={() => handleDismiss(suggestion.index)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
