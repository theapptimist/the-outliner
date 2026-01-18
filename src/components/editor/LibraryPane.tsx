import { useState, useCallback, useRef, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  Calendar, 
  Quote, 
  Plus, 
  Search, 
  Highlighter, 
  RefreshCw, 
  Trash2,
  ChevronDown,
  ChevronRight,
  Eye,
  Type,
  X,
  FileText,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import { useEditorContext } from './EditorContext';
import { useNavigation, EntityTab } from '@/contexts/NavigationContext';
import { useToast } from '@/hooks/use-toast';
import { useAggregatedEntities } from '@/hooks/useAggregatedEntities';
import { useEntitySuggestions, PersonSuggestion, PlaceSuggestion, DateSuggestion, TermSuggestion } from '@/hooks/useEntitySuggestions';
import { AddTermDialog } from './AddTermDialog';
import { AddDateDialog } from './AddDateDialog';
import { AddPersonDialog } from './AddPersonDialog';
import { AddPlaceDialog } from './AddPlaceDialog';
import { EntityUsagesPane } from './EntityUsagesPane';
import { EntitySuggestionsDialog } from './EntitySuggestionsDialog';
import { formatDateForDisplay } from '@/lib/dateScanner';

// EntityTab type is imported from NavigationContext

interface LibraryPaneProps {
  collapsed?: boolean;
  selectedText?: string;
}

export function LibraryPane({ collapsed, selectedText }: LibraryPaneProps) {
  const { isInMasterMode, activeEntityTab, setActiveEntityTab, activeSubOutlineId } = useNavigation();
  
  // Aggregated entities from sub-docs when viewing master
  const { 
    shouldAggregate, 
    aggregatedPeople, 
    aggregatedPlaces, 
    aggregatedDates, 
    aggregatedTerms 
  } = useAggregatedEntities();
  
  // Local state for entity tab, synced with NavigationContext in master mode
  const [localActiveTab, setLocalActiveTab] = useState<EntityTab>('terms');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [capturedSelection, setCapturedSelection] = useState('');
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [suggestionsDialogOpen, setSuggestionsDialogOpen] = useState(false);
  const [recalcFeedback, setRecalcFeedback] = useState<'idle' | 'done' | 'empty'>('idle');
  
  const { toast } = useToast();

  // In master mode, use the persisted entity tab from NavigationContext
  const activeTab = isInMasterMode && activeEntityTab ? activeEntityTab : localActiveTab;
  
  // Wrapper to set tab both locally and in NavigationContext (when in master mode)
  const setActiveTab = useCallback((tab: EntityTab) => {
    setLocalActiveTab(tab);
    if (isInMasterMode) {
      setActiveEntityTab(tab);
    }
  }, [isInMasterMode, setActiveEntityTab]);

  // Sync local state when activeEntityTab changes from NavigationContext
  useEffect(() => {
    if (isInMasterMode && activeEntityTab && activeEntityTab !== localActiveTab) {
      setLocalActiveTab(activeEntityTab);
    }
  }, [isInMasterMode, activeEntityTab]);

  // Get all context values
  const {
    // Terms
    terms,
    setTerms,
    addTerm,
    inspectedTerm,
    setInspectedTerm,
    highlightedTerm,
    setHighlightedTerm,
    highlightMode,
    setHighlightMode,
    recalculateUsages,
    // Dates
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
    // People
    people,
    setPeople,
    addPerson,
    inspectedPerson,
    setInspectedPerson,
    highlightedPerson,
    setHighlightedPerson,
    peopleHighlightMode,
    setPeopleHighlightMode,
    recalculatePeopleUsages,
    // Places
    places,
    setPlaces,
    addPlace,
    inspectedPlace,
    setInspectedPlace,
    highlightedPlace,
    setHighlightedPlace,
    placesHighlightMode,
    setPlacesHighlightMode,
    recalculatePlaceUsages,
    // Common
    selectionSource,
    selectedText: contextSelectedText,
    insertTextAtCursor,
    hierarchyBlocks,
    outlineStyle,
    mixedConfig,
  } = useEditorContext();

  // Entity suggestions from AI scan
  const entitySuggestions = useEntitySuggestions({
    existingPeople: people,
    existingPlaces: places,
    existingDates: dates,
    existingTerms: terms,
  });

  // Backup refs for undo
  const backupRef = useRef<any>(null);
  const undoTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);
    };
  }, []);

  // Auto-recalculate usages when hierarchy or entities change
  // Using JSON.stringify to detect deep changes, not just length changes
  const termsKey = terms.map(t => t.id).join(',');
  const datesKey = dates.map(d => d.id).join(',');
  const peopleKey = people.map(p => p.id).join(',');
  const placesKey = places.map(p => p.id).join(',');
  const hierarchyBlocksKey = Object.keys(hierarchyBlocks).join(',');

  useEffect(() => {
    if (hierarchyBlocksKey && terms.length > 0) {
      const styleConfig = { style: outlineStyle, mixedConfig };
      recalculateUsages(hierarchyBlocks, styleConfig);
    }
  }, [hierarchyBlocksKey, termsKey, outlineStyle, mixedConfig, hierarchyBlocks, recalculateUsages]);

  useEffect(() => {
    if (hierarchyBlocksKey && dates.length > 0) {
      const styleConfig = { style: outlineStyle, mixedConfig };
      recalculateDateUsages(hierarchyBlocks, styleConfig);
    }
  }, [hierarchyBlocksKey, datesKey, outlineStyle, mixedConfig, hierarchyBlocks, recalculateDateUsages]);

  useEffect(() => {
    if (hierarchyBlocksKey && people.length > 0) {
      const styleConfig = { style: outlineStyle, mixedConfig };
      recalculatePeopleUsages(hierarchyBlocks, styleConfig);
    }
  }, [hierarchyBlocksKey, peopleKey, outlineStyle, mixedConfig, hierarchyBlocks, recalculatePeopleUsages]);

  useEffect(() => {
    if (hierarchyBlocksKey && places.length > 0) {
      const styleConfig = { style: outlineStyle, mixedConfig };
      recalculatePlaceUsages(hierarchyBlocks, styleConfig);
    }
  }, [hierarchyBlocksKey, placesKey, outlineStyle, mixedConfig, hierarchyBlocks, recalculatePlaceUsages]);

  // Get current entity count (use aggregated counts when viewing master)
  const getCount = useCallback((tab: EntityTab) => {
    if (shouldAggregate) {
      switch (tab) {
        case 'people': return aggregatedPeople.length;
        case 'places': return aggregatedPlaces.length;
        case 'dates': return aggregatedDates.length;
        case 'terms': return aggregatedTerms.length;
      }
    }
    switch (tab) {
      case 'people': return people.length;
      case 'places': return places.length;
      case 'dates': return dates.length;
      case 'terms': return terms.length;
    }
  }, [shouldAggregate, aggregatedPeople.length, aggregatedPlaces.length, aggregatedDates.length, aggregatedTerms.length, people.length, places.length, dates.length, terms.length]);

  // Use context selection, falling back to prop
  const effectiveSelectedText = contextSelectedText || selectedText || '';
  
  // Handle add action
  const handleAdd = useCallback(() => {
    setCapturedSelection(effectiveSelectedText);
    setDialogOpen(true);
  }, [effectiveSelectedText]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    let items: any[] = [];
    let setter: (items: any[]) => void;
    
    switch (activeTab) {
      case 'people':
        items = [...people];
        setter = setPeople;
        break;
      case 'places':
        items = [...places];
        setter = setPlaces;
        break;
      case 'dates':
        items = [...dates];
        setter = setDates;
        break;
      case 'terms':
        items = [...terms];
        setter = setTerms;
        break;
    }

    backupRef.current = { tab: activeTab, items };
    setter([]);
    setClearConfirmOpen(false);

    if (undoTimeoutRef.current) clearTimeout(undoTimeoutRef.current);

    const count = items.length;
    const label = activeTab === 'people' ? 'people' : activeTab;
    
    const { dismiss } = toast({
      title: `Cleared ${count} ${label}`,
      description: "Click Undo to restore.",
      action: (
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (backupRef.current?.tab === activeTab) {
              switch (activeTab) {
                case 'people': setPeople(backupRef.current.items); break;
                case 'places': setPlaces(backupRef.current.items); break;
                case 'dates': setDates(backupRef.current.items); break;
                case 'terms': setTerms(backupRef.current.items); break;
              }
              backupRef.current = null;
              dismiss();
            }
          }}
        >
          Undo
        </Button>
      ),
    });

    undoTimeoutRef.current = setTimeout(() => {
      backupRef.current = null;
    }, 10000);
  }, [activeTab, people, places, dates, terms, setPeople, setPlaces, setDates, setTerms, toast]);

  // Handle recalculate
  const handleRecalculate = useCallback(() => {
    const hasOutline = Object.keys(hierarchyBlocks).length > 0;
    if (!hasOutline) {
      setRecalcFeedback('empty');
    } else {
      const styleConfig = { style: outlineStyle, mixedConfig };
      switch (activeTab) {
        case 'people': recalculatePeopleUsages(hierarchyBlocks, styleConfig); break;
        case 'places': recalculatePlaceUsages(hierarchyBlocks, styleConfig); break;
        case 'dates': recalculateDateUsages(hierarchyBlocks, styleConfig); break;
        case 'terms': recalculateUsages(hierarchyBlocks, styleConfig); break;
      }
      setRecalcFeedback('done');
    }
    setTimeout(() => setRecalcFeedback('idle'), 1500);
  }, [activeTab, hierarchyBlocks, outlineStyle, mixedConfig, recalculatePeopleUsages, recalculatePlaceUsages, recalculateDateUsages, recalculateUsages]);

  // Get highlight mode for current tab
  const getHighlightMode = useCallback(() => {
    switch (activeTab) {
      case 'people': return peopleHighlightMode;
      case 'places': return placesHighlightMode;
      case 'dates': return dateHighlightMode;
      case 'terms': return highlightMode;
    }
  }, [activeTab, peopleHighlightMode, placesHighlightMode, dateHighlightMode, highlightMode]);

  const setCurrentHighlightMode = useCallback((mode: 'all' | 'selected' | 'none') => {
    switch (activeTab) {
      case 'people': setPeopleHighlightMode(mode); break;
      case 'places': setPlacesHighlightMode(mode); break;
      case 'dates': setDateHighlightMode(mode); break;
      case 'terms': setHighlightMode(mode); break;
    }
  }, [activeTab, setPeopleHighlightMode, setPlacesHighlightMode, setDateHighlightMode, setHighlightMode]);

  // Toggle expand
  const toggleExpand = useCallback((id: string) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Filter items based on search (use aggregated when viewing master)
  const getFilteredItems = useCallback(() => {
    const q = searchQuery.toLowerCase();
    
    if (shouldAggregate) {
      switch (activeTab) {
        case 'people':
          return aggregatedPeople.filter(p => 
            p.name?.toLowerCase().includes(q) || 
            p.role?.toLowerCase().includes(q) ||
            p.description?.toLowerCase().includes(q)
          );
        case 'places':
          return aggregatedPlaces.filter(p => 
            p.name?.toLowerCase().includes(q) || 
            p.significance?.toLowerCase().includes(q)
          );
        case 'dates':
          return aggregatedDates.filter(d => 
            d.rawText?.toLowerCase().includes(q) ||
            d.description?.toLowerCase().includes(q)
          );
        case 'terms':
          return aggregatedTerms.filter(t => 
            t.term?.toLowerCase().includes(q) ||
            t.definition?.toLowerCase().includes(q)
          );
      }
    }
    
    switch (activeTab) {
      case 'people':
        return people.filter(p => 
          p.name?.toLowerCase().includes(q) || 
          p.role?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
        );
      case 'places':
        return places.filter(p => 
          p.name?.toLowerCase().includes(q) || 
          p.significance?.toLowerCase().includes(q)
        );
      case 'dates':
        return dates.filter(d => 
          d.rawText?.toLowerCase().includes(q) ||
          d.description?.toLowerCase().includes(q)
        );
      case 'terms':
        return terms.filter(t => 
          t.term?.toLowerCase().includes(q) ||
          t.definition?.toLowerCase().includes(q)
        );
    }
  }, [activeTab, searchQuery, shouldAggregate, aggregatedPeople, aggregatedPlaces, aggregatedDates, aggregatedTerms, people, places, dates, terms]);

  const filteredItems = getFilteredItems();
  const currentCount = getCount(activeTab);
  const currentHighlightMode = getHighlightMode();

  // Tab configuration
  const tabs: { id: EntityTab; icon: typeof User; color: string; label: string }[] = [
    { id: 'people', icon: User, color: 'text-purple-500', label: 'People' },
    { id: 'places', icon: MapPin, color: 'text-green-500', label: 'Places' },
    { id: 'dates', icon: Calendar, color: 'text-blue-500', label: 'Dates' },
    { id: 'terms', icon: Quote, color: 'text-amber-500', label: 'Terms' },
  ];

  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-2 gap-1">
        {tabs.map(tab => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "h-7 w-7 rounded flex items-center justify-center transition-colors",
                  activeTab === tab.id ? "bg-muted" : "hover:bg-muted/50"
                )}
              >
                <tab.icon className={cn("h-4 w-4", tab.color)} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">{tab.label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Vertical Tool Strip */}
      <div className="flex flex-col items-center gap-0.5 px-0.5 py-1 border-r border-border/30 bg-muted/20">
        {/* Add */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              data-add-term-btn
              data-allow-pointer
              variant="ghost"
              size="sm"
              onClick={handleAdd}
              className={cn(
                "h-7 w-7 p-0",
                selectedText && "bg-accent/20 text-accent"
              )}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs">
            Add {activeTab.slice(0, -1)}{selectedText ? ' (from selection)' : ''}
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
            {searchOpen ? 'Close search' : 'Search'}
          </TooltipContent>
        </Tooltip>

        {/* AI Scan */}
        {!shouldAggregate && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  if (entitySuggestions.getTotalSuggestionCount() > 0) {
                    // If we already have suggestions, just open the dialog
                    setSuggestionsDialogOpen(true);
                  } else {
                    // Scan and open dialog when done
                    await entitySuggestions.scanDocument(hierarchyBlocks);
                    setSuggestionsDialogOpen(true);
                  }
                }}
                disabled={entitySuggestions.state === 'scanning'}
                className={cn(
                  "h-7 w-7 p-0 relative",
                  entitySuggestions.state === 'scanning' && "animate-pulse",
                  entitySuggestions.getTotalSuggestionCount() > 0 && "text-primary"
                )}
              >
                <Sparkles className="h-3.5 w-3.5" />
                {entitySuggestions.getTotalSuggestionCount() > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 min-w-[12px] px-0.5 text-[8px] font-bold bg-primary text-primary-foreground rounded-full flex items-center justify-center">
                    {entitySuggestions.getTotalSuggestionCount()}
                  </span>
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {entitySuggestions.state === 'scanning' 
                ? 'Scanning...' 
                : entitySuggestions.getTotalSuggestionCount() > 0
                  ? `${entitySuggestions.getTotalSuggestionCount()} suggestions`
                  : 'AI Scan for entities'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Highlight Mode */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 relative",
                    currentHighlightMode === 'all' && "bg-accent/20 text-accent",
                    currentHighlightMode === 'selected' && "bg-primary/20 text-primary",
                    currentHighlightMode === 'none' && "text-muted-foreground"
                  )}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  <span className={cn(
                    "absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full",
                    currentHighlightMode === 'all' && "bg-accent",
                    currentHighlightMode === 'selected' && "bg-primary",
                    currentHighlightMode === 'none' && "bg-muted-foreground"
                  )} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">Highlight mode</TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="w-auto p-1">
            <div className="flex flex-col gap-0.5">
              {(['all', 'selected', 'none'] as const).map(mode => (
                <Button
                  key={mode}
                  variant={currentHighlightMode === mode ? 'secondary' : 'ghost'}
                  size="sm"
                  className="h-7 justify-start text-xs px-2"
                  onClick={() => setCurrentHighlightMode(mode)}
                >
                  <span className={cn(
                    "h-2 w-2 rounded-full mr-2",
                    mode === 'all' && "bg-accent",
                    mode === 'selected' && "bg-primary",
                    mode === 'none' && "bg-muted-foreground"
                  )} />
                  {mode === 'all' ? 'All' : mode === 'selected' ? 'Selected' : 'Off'}
                </Button>
              ))}
            </div>
          </PopoverContent>
        </Popover>

        {/* Recalculate */}
        {currentCount > 0 && (
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
                <RefreshCw className={cn("h-3.5 w-3.5", recalcFeedback !== 'idle' && "animate-spin")} />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {recalcFeedback === 'done' ? 'Updated!' : recalcFeedback === 'empty' ? 'No outline' : 'Recalculate'}
            </TooltipContent>
          </Tooltip>
        )}

        {/* Divider */}
        <div className="h-px w-4 bg-border/50 my-1" />

        {/* Entity Type Tabs */}
        {tabs.map(tab => (
          <Tooltip key={tab.id}>
            <TooltipTrigger asChild>
              <button
                data-allow-pointer
                onClick={() => {
                  setActiveTab(tab.id);
                  setSearchQuery('');
                }}
                className={cn(
                  "h-7 w-7 p-0 rounded flex items-center justify-center transition-colors relative",
                  activeTab === tab.id 
                    ? "bg-accent/20" 
                    : "hover:bg-muted/50"
                )}
              >
                <tab.icon className={cn("h-3.5 w-3.5", activeTab === tab.id ? tab.color : "text-muted-foreground")} />
                {getCount(tab.id) > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 h-3 min-w-[12px] px-0.5 text-[8px] font-bold bg-muted text-muted-foreground rounded-full flex items-center justify-center">
                    {getCount(tab.id)}
                  </span>
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">{tab.label}</TooltipContent>
          </Tooltip>
        ))}

        <div className="flex-1" />

        {/* Clear All */}
        {currentCount > 0 && (
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
              Clear all ({currentCount})
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Main Content */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Show Usages Pane if an entity is being inspected */}
        {inspectedTerm && activeTab === 'terms' && (
          <EntityUsagesPane
            type="term"
            title={inspectedTerm.term}
            subtitle={inspectedTerm.definition}
            usages={inspectedTerm.usages}
            onClose={() => setInspectedTerm(null)}
          />
        )}
        {inspectedDate && activeTab === 'dates' && (
          <EntityUsagesPane
            type="date"
            title={formatDateForDisplay(inspectedDate.date)}
            subtitle={inspectedDate.rawText}
            description={inspectedDate.description}
            usages={inspectedDate.usages}
            onClose={() => setInspectedDate(null)}
          />
        )}
        {inspectedPerson && activeTab === 'people' && (
          <EntityUsagesPane
            type="person"
            title={inspectedPerson.name}
            subtitle={inspectedPerson.role}
            description={inspectedPerson.description}
            usages={inspectedPerson.usages}
            onClose={() => setInspectedPerson(null)}
          />
        )}
        {inspectedPlace && activeTab === 'places' && (
          <EntityUsagesPane
            type="place"
            title={inspectedPlace.name}
            subtitle={inspectedPlace.significance}
            usages={inspectedPlace.usages}
            onClose={() => setInspectedPlace(null)}
          />
        )}

        {/* Items List - hidden when inspecting */}
        {!((inspectedTerm && activeTab === 'terms') ||
           (inspectedDate && activeTab === 'dates') ||
           (inspectedPerson && activeTab === 'people') ||
           (inspectedPlace && activeTab === 'places')) && (
          <ScrollArea className="flex-1 px-1">
            <div className="space-y-1.5 py-2">
              {/* Aggregated view header when viewing master */}
              {shouldAggregate && (
                <div className="flex items-center gap-1.5 px-2 py-1 mb-2 bg-muted/30 rounded text-xs text-muted-foreground">
                  <FileText className="h-3 w-3" />
                  <span>Aggregated from sub-documents</span>
                </div>
              )}

              {filteredItems.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  {currentCount === 0 ? (
                    <div className="flex flex-col items-center gap-2">
                      {tabs.find(t => t.id === activeTab)?.icon && (
                        <div className="opacity-40">
                          {(() => {
                            const Icon = tabs.find(t => t.id === activeTab)!.icon;
                            return <Icon className="h-8 w-8" />;
                          })()}
                        </div>
                      )}
                      <p>No {activeTab} tagged yet</p>
                      {shouldAggregate ? (
                        <p className="text-[10px]">Tag {activeTab} in sub-documents to see them here</p>
                      ) : (
                        <p className="text-[10px]">Select text and click + to add</p>
                      )}
                    </div>
                  ) : (
                    <p>No matching {activeTab}</p>
                  )}
                </div>
              ) : shouldAggregate ? (
                // Aggregated read-only view
                <>
                  {activeTab === 'terms' && aggregatedTerms.filter(t => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (t.term ?? '').toLowerCase().includes(q) ||
                      (t.definition ?? '').toLowerCase().includes(q)
                    );
                  }).map(term => (
                    <AggregatedEntityCard
                      key={`${term.sourceDocId}-${term.id}`}
                      title={term.term}
                      subtitle={term.definition}
                      icon={Quote}
                      iconColor="text-amber-500"
                      sourceDocTitle={term.sourceDocTitle}
                      usageCount={term.usages?.reduce((sum, u) => sum + u.count, 0) ?? 0}
                      isExpanded={expandedItems.has(term.id)}
                      onToggleExpand={() => toggleExpand(term.id)}
                    />
                  ))}
                  
                  {activeTab === 'dates' && aggregatedDates.filter(d => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (d.rawText ?? '').toLowerCase().includes(q) ||
                      (d.description ?? '').toLowerCase().includes(q)
                    );
                  }).map(date => (
                    <AggregatedEntityCard
                      key={`${date.sourceDocId}-${date.id}`}
                      title={formatDateForDisplay(date.date)}
                      subtitle={date.rawText}
                      description={date.description}
                      icon={Calendar}
                      iconColor="text-blue-500"
                      sourceDocTitle={date.sourceDocTitle}
                      usageCount={date.usages?.reduce((sum, u) => sum + u.count, 0) ?? 0}
                      isExpanded={expandedItems.has(date.id)}
                      onToggleExpand={() => toggleExpand(date.id)}
                    />
                  ))}
                  
                  {activeTab === 'people' && aggregatedPeople.filter(p => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (p.name ?? '').toLowerCase().includes(q) ||
                      (p.role ?? '').toLowerCase().includes(q) ||
                      (p.description ?? '').toLowerCase().includes(q)
                    );
                  }).map(person => (
                    <AggregatedEntityCard
                      key={`${person.sourceDocId}-${person.id}`}
                      title={person.name}
                      subtitle={person.role}
                      description={person.description}
                      icon={User}
                      iconColor="text-purple-500"
                      sourceDocTitle={person.sourceDocTitle}
                      usageCount={person.usages?.reduce((sum, u) => sum + u.count, 0) ?? 0}
                      isExpanded={expandedItems.has(person.id)}
                      onToggleExpand={() => toggleExpand(person.id)}
                    />
                  ))}
                  
                  {activeTab === 'places' && aggregatedPlaces.filter(p => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (p.name ?? '').toLowerCase().includes(q) ||
                      (p.significance ?? '').toLowerCase().includes(q)
                    );
                  }).map(place => (
                    <AggregatedEntityCard
                      key={`${place.sourceDocId}-${place.id}`}
                      title={place.name}
                      subtitle={place.significance}
                      icon={MapPin}
                      iconColor="text-green-500"
                      sourceDocTitle={place.sourceDocTitle}
                      usageCount={place.usages?.reduce((sum, u) => sum + u.count, 0) ?? 0}
                      isExpanded={expandedItems.has(place.id)}
                      onToggleExpand={() => toggleExpand(place.id)}
                    />
                  ))}
                </>
              ) : (
                // Normal editable view
                <>
                  {activeTab === 'terms' && terms.filter(t => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (t.term ?? '').toLowerCase().includes(q) ||
                      (t.definition ?? '').toLowerCase().includes(q)
                    );
                  }).map(term => (
                    <EntityCard
                      key={term.id}
                      id={term.id}
                      title={term.term}
                      subtitle={term.definition}
                      icon={Quote}
                      iconColor="text-amber-500"
                      usageCount={term.usages.reduce((sum, u) => sum + u.count, 0)}
                      isHighlighted={highlightMode === 'selected' && highlightedTerm?.id === term.id}
                      isInspected={inspectedTerm?.id === term.id}
                      isExpanded={expandedItems.has(term.id)}
                      onToggleExpand={() => toggleExpand(term.id)}
                      onInsert={() => insertTextAtCursor?.(term.term)}
                      onHighlight={() => {
                        if (highlightMode === 'selected' && highlightedTerm?.id === term.id) {
                          setHighlightMode('none');
                          setHighlightedTerm(null);
                        } else {
                          setHighlightMode('selected');
                          setHighlightedTerm(term);
                        }
                      }}
                      onViewUsages={() => setInspectedTerm(inspectedTerm?.id === term.id ? null : term)}
                      usages={term.usages}
                    />
                  ))}

                  {activeTab === 'dates' && dates.filter(d => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (d.rawText ?? '').toLowerCase().includes(q) ||
                      (d.description ?? '').toLowerCase().includes(q)
                    );
                  }).map(date => (
                    <EntityCard
                      key={date.id}
                      id={date.id}
                      title={formatDateForDisplay(date.date)}
                      subtitle={date.rawText}
                      description={date.description}
                      icon={Calendar}
                      iconColor="text-blue-500"
                      usageCount={date.usages.reduce((sum, u) => sum + u.count, 0)}
                      isHighlighted={dateHighlightMode === 'selected' && highlightedDate?.id === date.id}
                      isInspected={inspectedDate?.id === date.id}
                      isExpanded={expandedItems.has(date.id)}
                      onToggleExpand={() => toggleExpand(date.id)}
                      onInsert={() => insertTextAtCursor?.(date.rawText)}
                      onHighlight={() => {
                        if (dateHighlightMode === 'selected' && highlightedDate?.id === date.id) {
                          setDateHighlightMode('none');
                          setHighlightedDate(null);
                        } else {
                          setDateHighlightMode('selected');
                          setHighlightedDate(date);
                        }
                      }}
                      onViewUsages={() => setInspectedDate(inspectedDate?.id === date.id ? null : date)}
                      usages={date.usages}
                    />
                  ))}

                  {activeTab === 'people' && people.filter(p => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (p.name ?? '').toLowerCase().includes(q) ||
                      (p.role ?? '').toLowerCase().includes(q) ||
                      (p.description ?? '').toLowerCase().includes(q)
                    );
                  }).map(person => (
                    <EntityCard
                      key={person.id}
                      id={person.id}
                      title={person.name}
                      subtitle={person.role}
                      description={person.description}
                      icon={User}
                      iconColor="text-purple-500"
                      usageCount={person.usages.reduce((sum, u) => sum + u.count, 0)}
                      isHighlighted={peopleHighlightMode === 'selected' && highlightedPerson?.id === person.id}
                      isInspected={inspectedPerson?.id === person.id}
                      isExpanded={expandedItems.has(person.id)}
                      onToggleExpand={() => toggleExpand(person.id)}
                      onInsert={() => insertTextAtCursor?.(person.name)}
                      onHighlight={() => {
                        if (peopleHighlightMode === 'selected' && highlightedPerson?.id === person.id) {
                          setPeopleHighlightMode('none');
                          setHighlightedPerson(null);
                        } else {
                          setPeopleHighlightMode('selected');
                          setHighlightedPerson(person);
                        }
                      }}
                      onViewUsages={() => setInspectedPerson(inspectedPerson?.id === person.id ? null : person)}
                      usages={person.usages}
                    />
                  ))}

                  {activeTab === 'places' && places.filter(p => {
                    const q = searchQuery.toLowerCase();
                    return (
                      (p.name ?? '').toLowerCase().includes(q) ||
                      (p.significance ?? '').toLowerCase().includes(q)
                    );
                  }).map(place => (
                    <EntityCard
                      key={place.id}
                      id={place.id}
                      title={place.name}
                      subtitle={place.significance}
                      icon={MapPin}
                      iconColor="text-green-500"
                      usageCount={place.usages.reduce((sum, u) => sum + u.count, 0)}
                      isHighlighted={placesHighlightMode === 'selected' && highlightedPlace?.id === place.id}
                      isInspected={inspectedPlace?.id === place.id}
                      isExpanded={expandedItems.has(place.id)}
                      onToggleExpand={() => toggleExpand(place.id)}
                      onInsert={() => insertTextAtCursor?.(place.name)}
                      onHighlight={() => {
                        if (placesHighlightMode === 'selected' && highlightedPlace?.id === place.id) {
                          setPlacesHighlightMode('none');
                          setHighlightedPlace(null);
                        } else {
                          setPlacesHighlightMode('selected');
                          setHighlightedPlace(place);
                        }
                      }}
                      onViewUsages={() => setInspectedPlace(inspectedPlace?.id === place.id ? null : place)}
                      usages={place.usages}
                    />
                  ))}
                </>
              )}
            </div>
          </ScrollArea>
        )}
      </div>

      {/* Dialogs */}
      <AddTermDialog
        open={dialogOpen && activeTab === 'terms'}
        onOpenChange={setDialogOpen}
        prefillSelection={capturedSelection}
        selectionSource={selectionSource}
        onSave={(term, definition, source) => {
          addTerm(term, definition, source ? { nodePrefix: source.nodePrefix, nodeLabel: source.nodeLabel } : undefined);
        }}
      />
      <AddDateDialog
        open={dialogOpen && activeTab === 'dates'}
        onOpenChange={setDialogOpen}
        prefillSelection={capturedSelection}
        selectionSource={selectionSource}
        onSave={(date, rawText, description) => {
          addDate(date, rawText, description);
        }}
      />
      <AddPersonDialog
        open={dialogOpen && activeTab === 'people'}
        onOpenChange={setDialogOpen}
        prefillSelection={capturedSelection}
        selectionSource={selectionSource}
        onSave={(name, role, description) => {
          addPerson(name, role, description);
        }}
      />
      <AddPlaceDialog
        open={dialogOpen && activeTab === 'places'}
        onOpenChange={setDialogOpen}
        prefillSelection={capturedSelection}
        selectionSource={selectionSource}
        onSave={(name, significance) => {
          addPlace(name, significance);
        }}
      />

      {/* AI Suggestions Dialog */}
      <EntitySuggestionsDialog
        open={suggestionsDialogOpen}
        onOpenChange={setSuggestionsDialogOpen}
        scanState={entitySuggestions.state}
        people={entitySuggestions.suggestions.people}
        places={entitySuggestions.suggestions.places}
        dates={entitySuggestions.suggestions.dates}
        terms={entitySuggestions.suggestions.terms}
        onAcceptPerson={(index, suggestion) => {
          addPerson(suggestion.name, suggestion.role || '');
          entitySuggestions.acceptPerson(index);
        }}
        onAcceptPlace={(index, suggestion) => {
          addPlace(suggestion.name, suggestion.significance || '');
          entitySuggestions.acceptPlace(index);
        }}
        onAcceptDate={(index, suggestion) => {
          const parsed = new Date(suggestion.rawText);
          const dateValue = isNaN(parsed.getTime()) ? new Date() : parsed;
          addDate(dateValue, suggestion.rawText, suggestion.description || '');
          entitySuggestions.acceptDate(index);
        }}
        onAcceptTerm={(index, suggestion) => {
          addTerm(suggestion.term, suggestion.definition);
          entitySuggestions.acceptTerm(index);
        }}
        onDismissPerson={(index) => entitySuggestions.dismissPerson(index)}
        onDismissPlace={(index) => entitySuggestions.dismissPlace(index)}
        onDismissDate={(index) => entitySuggestions.dismissDate(index)}
        onDismissTerm={(index) => entitySuggestions.dismissTerm(index)}
        onAcceptAllPeople={() => {
          entitySuggestions.suggestions.people.forEach((s) => {
            addPerson(s.name, s.role || '');
          });
          entitySuggestions.suggestions.people.forEach((_, i) => entitySuggestions.dismissPerson(0));
        }}
        onAcceptAllPlaces={() => {
          entitySuggestions.suggestions.places.forEach((s) => {
            addPlace(s.name, s.significance || '');
          });
          entitySuggestions.suggestions.places.forEach((_, i) => entitySuggestions.dismissPlace(0));
        }}
        onAcceptAllDates={() => {
          entitySuggestions.suggestions.dates.forEach((s) => {
            const parsed = new Date(s.rawText);
            const dateValue = isNaN(parsed.getTime()) ? new Date() : parsed;
            addDate(dateValue, s.rawText, s.description || '');
          });
          entitySuggestions.suggestions.dates.forEach((_, i) => entitySuggestions.dismissDate(0));
        }}
        onAcceptAllTerms={() => {
          entitySuggestions.suggestions.terms.forEach((s) => {
            addTerm(s.term, s.definition);
          });
          entitySuggestions.suggestions.terms.forEach((_, i) => entitySuggestions.dismissTerm(0));
        }}
        onDismissAll={() => entitySuggestions.dismissAll()}
      />

      {/* Clear Confirmation */}
      <AlertDialog open={clearConfirmOpen} onOpenChange={setClearConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all {activeTab}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will remove all {currentCount} {activeTab}. You can undo this action for 10 seconds.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>Clear All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// Reusable entity card component
interface EntityCardProps {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  icon: typeof User;
  iconColor: string;
  usageCount: number;
  isHighlighted: boolean;
  isInspected: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onInsert: () => void;
  onHighlight: () => void;
  onViewUsages: () => void;
  usages: { nodePrefix: string; nodeLabel: string; count: number }[];
}

function EntityCard({
  id,
  title,
  subtitle,
  description,
  icon: Icon,
  iconColor,
  usageCount,
  isHighlighted,
  isInspected,
  isExpanded,
  onToggleExpand,
  onInsert,
  onHighlight,
  onViewUsages,
  usages,
}: EntityCardProps) {
  return (
    <div
      className={cn(
        "rounded-md border border-border/50 bg-card/50 overflow-hidden",
        isHighlighted && "ring-1 ring-amber-500/50"
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />

        <span className="text-xs font-medium truncate flex-1">{title}</span>

        {usageCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {usageCount}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-0.5 px-2 pb-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
              onClick={onInsert}
            >
              <Type className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Insert</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0",
                isHighlighted ? "text-amber-500" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={onHighlight}
            >
              <Highlighter className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Highlight</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-6 w-6 p-0",
                isInspected ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}
              onClick={onViewUsages}
            >
              <Eye className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">View usages</TooltipContent>
        </Tooltip>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-border/30 space-y-1">
          {subtitle && (
            <p className="text-[10px] text-muted-foreground">{subtitle}</p>
          )}
          {description && (
            <p className="text-[10px] text-muted-foreground italic">{description}</p>
          )}
          {usages.length > 0 && (
            <div className="pt-1">
              <p className="text-[9px] text-muted-foreground uppercase font-medium mb-1">Usages</p>
              <div className="flex flex-wrap gap-1">
                {usages.slice(0, 5).map((u, i) => (
                  <span
                    key={i}
                    className="text-[10px] font-mono bg-muted px-1.5 py-0.5 rounded"
                    title={u.nodeLabel}
                  >
                    {u.nodePrefix}
                  </span>
                ))}
                {usages.length > 5 && (
                  <span className="text-[10px] text-muted-foreground">
                    +{usages.length - 5} more
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Read-only card for aggregated entities from sub-documents
interface AggregatedEntityCardProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon: typeof User;
  iconColor: string;
  sourceDocTitle: string;
  usageCount: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function AggregatedEntityCard({
  title,
  subtitle,
  description,
  icon: Icon,
  iconColor,
  sourceDocTitle,
  usageCount,
  isExpanded,
  onToggleExpand,
}: AggregatedEntityCardProps) {
  return (
    <div className="rounded-md border border-border/50 bg-card/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-1.5 px-2 py-1.5">
        <button
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground shrink-0"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />

        <span className="text-xs font-medium truncate flex-1">{title}</span>

        {usageCount > 0 && (
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {usageCount}
          </span>
        )}
      </div>

      {/* Source indicator */}
      <div className="flex items-center gap-1 px-2 pb-1.5">
        <FileText className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] text-muted-foreground truncate">{sourceDocTitle}</span>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-border/30 space-y-1">
          {subtitle && (
            <p className="text-[10px] text-muted-foreground break-words">{subtitle}</p>
          )}
          {description && (
            <p className="text-[10px] text-muted-foreground italic break-words">{description}</p>
          )}
        </div>
      )}
    </div>
  );
}
