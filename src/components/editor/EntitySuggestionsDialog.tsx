import { useState, useEffect } from 'react';
import { Check, X, Sparkles, User, MapPin, Calendar, Quote, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { 
  PersonSuggestion, 
  PlaceSuggestion, 
  DateSuggestion, 
  TermSuggestion,
  ScanState,
} from '@/hooks/useEntitySuggestions';

interface SuggestionCardProps {
  title: string;
  subtitle?: string;
  onAccept: () => void;
  onDismiss: () => void;
}

function SuggestionCard({ title, subtitle, onAccept, onDismiss }: SuggestionCardProps) {
  return (
    <div className="flex items-start gap-3 p-3 bg-muted/30 border border-border/50 rounded-lg group hover:bg-muted/50 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium break-words">{title}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground break-words whitespace-pre-wrap mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex gap-1 shrink-0">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-100"
          onClick={onAccept}
          title="Accept"
        >
          <Check className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-100"
          onClick={onDismiss}
          title="Dismiss"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

interface EntitySuggestionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scanState: ScanState;
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
  onAcceptAllPeople: () => void;
  onAcceptAllPlaces: () => void;
  onAcceptAllDates: () => void;
  onAcceptAllTerms: () => void;
  onDismissAll: () => void;
}

export function EntitySuggestionsDialog({
  open,
  onOpenChange,
  scanState,
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
  onAcceptAllPeople,
  onAcceptAllPlaces,
  onAcceptAllDates,
  onAcceptAllTerms,
  onDismissAll,
}: EntitySuggestionsDialogProps) {
  const totalCount = people.length + places.length + dates.length + terms.length;
  const isScanning = scanState === 'scanning';
  
  // Find first tab with suggestions
  const getDefaultTab = () => {
    if (people.length > 0) return 'people';
    if (places.length > 0) return 'places';
    if (dates.length > 0) return 'dates';
    if (terms.length > 0) return 'terms';
    return 'people';
  };

  const [activeTab, setActiveTab] = useState(getDefaultTab());
  
  // Update active tab when suggestions come in
  useEffect(() => {
    if (!isScanning && totalCount > 0) {
      setActiveTab(getDefaultTab());
    }
  }, [isScanning, totalCount]);

  // Close dialog if all suggestions are handled (but not while scanning)
  if (open && totalCount === 0 && !isScanning) {
    onOpenChange(false);
  }

  const tabs = [
    { id: 'people', label: 'People', icon: User, count: people.length, color: 'text-purple-500' },
    { id: 'places', label: 'Places', icon: MapPin, count: places.length, color: 'text-green-500' },
    { id: 'dates', label: 'Dates', icon: Calendar, count: dates.length, color: 'text-blue-500' },
    { id: 'terms', label: 'Terms', icon: Quote, count: terms.length, color: 'text-amber-500' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {isScanning ? (
              <Loader2 className="h-5 w-5 text-primary animate-spin" />
            ) : (
              <Sparkles className="h-5 w-5 text-primary" />
            )}
            {isScanning ? 'Scanning Document...' : 'AI-Detected Entities'}
          </DialogTitle>
          <DialogDescription>
            {isScanning 
              ? 'Analyzing your document for people, places, dates, and terms. This may take a moment...'
              : `Review and accept entities found in your document. ${totalCount} suggestion${totalCount !== 1 ? 's' : ''} remaining.`
            }
          </DialogDescription>
        </DialogHeader>

        {isScanning ? (
          <div className="flex-1 flex flex-col items-center justify-center py-12 gap-6">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
              <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-primary animate-pulse" />
              </div>
            </div>
            <div className="text-center space-y-2">
              <p className="text-sm font-medium text-foreground">AI is reading your document</p>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
            <TabsList className="grid grid-cols-4 w-full shrink-0">
              {tabs.map(tab => (
                <TabsTrigger 
                  key={tab.id} 
                  value={tab.id}
                  disabled={tab.count === 0}
                  className="relative"
                >
                  <tab.icon className={cn("h-4 w-4 mr-1.5", tab.color)} />
                  <span className="hidden sm:inline">{tab.label}</span>
                  {tab.count > 0 && (
                    <Badge variant="secondary" className="ml-1.5 h-5 min-w-[20px] px-1 text-xs">
                      {tab.count}
                    </Badge>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="flex-1 min-h-0 overflow-hidden mt-4">
            <TabsContent value="people" className="h-full m-0 flex flex-col">
              {people.length > 0 ? (
                <>
                  <div className="flex justify-end gap-2 mb-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={onAcceptAllPeople} className="text-green-600">
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept All
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 pr-2">
                      {people.map((person, index) => (
                        <SuggestionCard
                          key={`person-${index}`}
                          title={person.name}
                          subtitle={person.role}
                          onAccept={() => onAcceptPerson(index, person)}
                          onDismiss={() => onDismissPerson(index)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">No people suggestions</div>
              )}
            </TabsContent>

            <TabsContent value="places" className="h-full m-0 flex flex-col">
              {places.length > 0 ? (
                <>
                  <div className="flex justify-end gap-2 mb-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={onAcceptAllPlaces} className="text-green-600">
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept All
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 pr-2">
                      {places.map((place, index) => (
                        <SuggestionCard
                          key={`place-${index}`}
                          title={place.name}
                          subtitle={place.significance}
                          onAccept={() => onAcceptPlace(index, place)}
                          onDismiss={() => onDismissPlace(index)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">No place suggestions</div>
              )}
            </TabsContent>

            <TabsContent value="dates" className="h-full m-0 flex flex-col">
              {dates.length > 0 ? (
                <>
                  <div className="flex justify-end gap-2 mb-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={onAcceptAllDates} className="text-green-600">
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept All
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 pr-2">
                      {dates.map((date, index) => (
                        <SuggestionCard
                          key={`date-${index}`}
                          title={date.rawText}
                          subtitle={date.description}
                          onAccept={() => onAcceptDate(index, date)}
                          onDismiss={() => onDismissDate(index)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">No date suggestions</div>
              )}
            </TabsContent>

            <TabsContent value="terms" className="h-full m-0 flex flex-col">
              {terms.length > 0 ? (
                <>
                  <div className="flex justify-end gap-2 mb-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={onAcceptAllTerms} className="text-green-600">
                      <Check className="h-3.5 w-3.5 mr-1" /> Accept All
                    </Button>
                  </div>
                  <ScrollArea className="flex-1 min-h-0">
                    <div className="space-y-2 pr-2">
                      {terms.map((term, index) => (
                        <SuggestionCard
                          key={`term-${index}`}
                          title={term.term}
                          subtitle={term.definition}
                          onAccept={() => onAcceptTerm(index, term)}
                          onDismiss={() => onDismissTerm(index)}
                        />
                      ))}
                    </div>
                  </ScrollArea>
                </>
              ) : (
                <div className="text-center text-muted-foreground py-8">No term suggestions</div>
              )}
            </TabsContent>
          </div>
        </Tabs>
        )}

        <div className="flex justify-between pt-4 border-t shrink-0">
          {isScanning ? (
            <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
              Cancel
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={onDismissAll} className="text-muted-foreground">
                Dismiss All
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
