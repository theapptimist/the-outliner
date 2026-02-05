import { useState, useCallback, useRef, useEffect, useMemo, memo } from 'react';
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
  MoreVertical,
  Merge,
  Link2,
  Maximize2,
  Minimize2,
  Pencil,
  Library,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { EntityMergeDialog } from './EntityMergeDialog';
import { EntityLinkDialog } from './EntityLinkDialog';
import { EditEntityDialog, EditableEntity } from './EditEntityDialog';
import { formatDateForDisplay } from '@/lib/dateScanner';
import { useDocumentContext } from './context';
import { useEntityRelationshipCounts } from '@/hooks/useEntityRelationships';
import { MasterLibraryDialog } from './MasterLibraryDialog';

// EntityTab type is imported from NavigationContext

// EntityRef type for linking mode
export interface EntityRef {
  id: string;
  type: 'people' | 'places' | 'dates' | 'terms';
  name: string;
  sourceDocId?: string;
  sourceDocTitle?: string;
}

interface LibraryPaneProps {
  collapsed?: boolean;
  selectedText?: string;
  fullPage?: boolean;
  onToggleFullPage?: () => void;
  // Linking mode props
  linkingMode?: boolean;
  selectedSource?: EntityRef | null;
  onSelectSource?: (entity: EntityRef) => void;
  // Navigation to document
  onNavigateToDocument?: (docId: string) => void;
}

export function LibraryPane({ 
  collapsed, 
  selectedText, 
  fullPage, 
  onToggleFullPage,
  linkingMode,
  selectedSource,
  onSelectSource,
  onNavigateToDocument,
}: LibraryPaneProps) {
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
  const [mergeDialogOpen, setMergeDialogOpen] = useState(false);
  const [mergeSourceEntity, setMergeSourceEntity] = useState<{ id: string; title: string; subtitle?: string } | null>(null);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkSourceEntity, setLinkSourceEntity] = useState<{ id: string; title: string; subtitle?: string; documentId: string } | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<EditableEntity | null>(null);
  
  // Master library dialog state
  const [masterLibraryOpen, setMasterLibraryOpen] = useState(false);
  
  // Debug logging for edit dialog state
  useEffect(() => {
    console.log('[LibraryPane] editDialogOpen changed:', editDialogOpen, 'editingEntity:', editingEntity);
  }, [editDialogOpen, editingEntity]);
  
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
  // This works both in master mode AND when revealEntityInLibrary triggers a tab switch
  useEffect(() => {
    if (activeEntityTab && activeEntityTab !== localActiveTab) {
      setLocalActiveTab(activeEntityTab);
    }
  }, [activeEntityTab]);


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

  // Get document ID for linking
  const { document: currentDocument } = useDocumentContext();
  const documentId = currentDocument?.meta?.id || '';


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

  // Collect all entity IDs for relationship count lookup
  const allEntityIds = useMemo(() => {
    const ids: string[] = [];
    terms.forEach(t => ids.push(t.id));
    dates.forEach(d => ids.push(d.id));
    people.forEach(p => ids.push(p.id));
    places.forEach(p => ids.push(p.id));
    return ids;
  }, [terms, dates, people, places]);

  // Load relationship counts for all entities
  const { counts: relationshipCounts, refresh: refreshRelationshipCounts } = useEntityRelationshipCounts(allEntityIds);

  // Handle saving edited entity
  const handleEditSave = useCallback((updatedEntity: EditableEntity) => {
    if (updatedEntity.type === 'people') {
      setPeople(prev => prev.map(p => 
        p.id === updatedEntity.id 
          ? { ...p, name: updatedEntity.name || p.name, role: updatedEntity.role, description: updatedEntity.description }
          : p
      ));
      toast({ title: 'Person updated' });
    } else if (updatedEntity.type === 'places') {
      setPlaces(prev => prev.map(p => 
        p.id === updatedEntity.id 
          ? { ...p, name: updatedEntity.name || p.name, significance: updatedEntity.significance }
          : p
      ));
      toast({ title: 'Place updated' });
    } else if (updatedEntity.type === 'dates') {
      setDates(prev => prev.map(d => 
        d.id === updatedEntity.id 
          ? { ...d, date: updatedEntity.date || d.date, rawText: updatedEntity.rawText || d.rawText, description: updatedEntity.description }
          : d
      ));
      toast({ title: 'Date updated' });
    } else if (updatedEntity.type === 'terms') {
      setTerms(prev => prev.map(t => 
        t.id === updatedEntity.id 
          ? { ...t, term: updatedEntity.term || t.term, definition: updatedEntity.definition || t.definition }
          : t
      ));
      toast({ title: 'Term updated' });
    }
    setEditDialogOpen(false);
    setEditingEntity(null);
  }, [setPeople, setPlaces, setDates, setTerms, toast]);

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

  // Global highlight controls - set all four entity types at once
  const setAllHighlightModes = useCallback((mode: 'all' | 'selected' | 'none') => {
    setPeopleHighlightMode(mode);
    setPlacesHighlightMode(mode);
    setDateHighlightMode(mode);
    setHighlightMode(mode);
  }, [setPeopleHighlightMode, setPlacesHighlightMode, setDateHighlightMode, setHighlightMode]);

  // Compute global highlight state
  const globalHighlightState = (() => {
    const modes = [peopleHighlightMode, placesHighlightMode, dateHighlightMode, highlightMode];
    const allNone = modes.every(m => m === 'none');
    const allAll = modes.every(m => m === 'all');
    const anyOn = modes.some(m => m !== 'none');
    if (allNone) return 'off';
    if (allAll) return 'all';
    if (anyOn) return 'mixed';
    return 'off';
  })();

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

  // Linking filter state - must be declared before any conditional returns
  const [linkingFilter, setLinkingFilter] = useState<'all' | EntityTab>('all');

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

  // Simplified linking mode view - just entity tabs and list
  
  // Build all entities for linking mode
  const allLinkingEntities = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const entities: Array<{ type: EntityTab; data: any }> = [];
    
    // Filter and add terms
    terms.filter(t => 
      (t.term ?? '').toLowerCase().includes(q) ||
      (t.definition ?? '').toLowerCase().includes(q)
    ).forEach(t => entities.push({ type: 'terms', data: t }));
    
    // Filter and add dates
    dates.filter(d => 
      (d.rawText ?? '').toLowerCase().includes(q) ||
      (d.description ?? '').toLowerCase().includes(q)
    ).forEach(d => entities.push({ type: 'dates', data: d }));
    
    // Filter and add people
    people.filter(p => 
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.role ?? '').toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q)
    ).forEach(p => entities.push({ type: 'people', data: p }));
    
    // Filter and add places
    places.filter(p => 
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.significance ?? '').toLowerCase().includes(q)
    ).forEach(p => entities.push({ type: 'places', data: p }));
    
    return entities;
  }, [terms, dates, people, places, searchQuery]);
  
  // Apply type filter
  const filteredLinkingEntities = linkingFilter === 'all' 
    ? allLinkingEntities 
    : allLinkingEntities.filter(e => e.type === linkingFilter);

  if (linkingMode) {
    return (
      <div className="flex flex-col h-full">
        {/* Header - matches TargetEntityPane style */}
        <div className="px-3 py-2 border-b border-border/30 bg-muted/20">
          
          {/* Entity type filter tabs */}
          <div className="flex gap-1 mb-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setLinkingFilter('all')}
                  className={cn(
                    "px-2 py-1 text-xs rounded transition-colors",
                    linkingFilter === 'all' 
                      ? "bg-accent text-accent-foreground" 
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  )}
                >
                  All
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">All entity types</TooltipContent>
            </Tooltip>
            
            {tabs.map(tab => (
              <Tooltip key={tab.id}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setLinkingFilter(tab.id)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      linkingFilter === tab.id 
                        ? "bg-accent text-accent-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <tab.icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">{tab.label}</TooltipContent>
              </Tooltip>
            ))}
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sources..."
              className="h-7 pl-7 text-xs"
            />
          </div>
        </div>

        {/* Entity list */}
        <ScrollArea className="flex-1">
          <div className="space-y-1.5 p-2">
            {filteredLinkingEntities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-xs">
                <p>No matching entities</p>
              </div>
            ) : (
              filteredLinkingEntities.map(({ type, data }) => {
                if (type === 'terms') {
                  const term = data;
                  return (
                    <EntityCard
                      key={`terms-${term.id}`}
                      id={term.id}
                      title={term.term}
                      subtitle={term.definition}
                      icon={Quote}
                      iconColor="text-amber-500"
                      usageCount={term.usages.reduce((sum: number, u: any) => sum + u.count, 0)}
                      relationshipCount={relationshipCounts[term.id] || 0}
                      isHighlighted={false}
                      isInspected={false}
                      isExpanded={false}
                      onToggleExpand={() => {}}
                      onInsert={() => {}}
                      onHighlight={() => {}}
                      onViewUsages={() => {}}
                      onMerge={() => {}}
                      onLink={() => {}}
                      onEdit={() => { console.log('[LinkingMode] onEdit called for term:', term.id); setEditingEntity({ id: term.id, type: 'terms', term: term.term, definition: term.definition }); setEditDialogOpen(true); }}
                      onDelete={() => {}}
                      usages={term.usages}
                      linkingMode
                      entityType="terms"
                      isSelectedAsSource={selectedSource?.id === term.id && selectedSource?.type === 'terms'}
                      onSelectAsSource={() => onSelectSource?.({ id: term.id, type: 'terms', name: term.term })}
                    />
                  );
                }
                if (type === 'dates') {
                  const date = data;
                  return (
                    <EntityCard
                      key={`dates-${date.id}`}
                      id={date.id}
                      title={formatDateForDisplay(date.date)}
                      subtitle={date.rawText}
                      description={date.description}
                      icon={Calendar}
                      iconColor="text-blue-500"
                      usageCount={date.usages.reduce((sum: number, u: any) => sum + u.count, 0)}
                      relationshipCount={relationshipCounts[date.id] || 0}
                      isHighlighted={false}
                      isInspected={false}
                      isExpanded={false}
                      onToggleExpand={() => {}}
                      onInsert={() => {}}
                      onHighlight={() => {}}
                      onViewUsages={() => {}}
                      onMerge={() => {}}
                      onLink={() => {}}
                      onEdit={() => { console.log('[LinkingMode] onEdit called for date:', date.id); setEditingEntity({ id: date.id, type: 'dates', date: date.date, rawText: date.rawText, description: date.description }); setEditDialogOpen(true); }}
                      onDelete={() => {}}
                      usages={date.usages}
                      linkingMode
                      entityType="dates"
                      isSelectedAsSource={selectedSource?.id === date.id && selectedSource?.type === 'dates'}
                      onSelectAsSource={() => onSelectSource?.({ id: date.id, type: 'dates', name: date.rawText })}
                    />
                  );
                }
                if (type === 'people') {
                  const person = data;
                  return (
                    <EntityCard
                      key={`people-${person.id}`}
                      id={person.id}
                      title={person.name}
                      subtitle={person.role}
                      description={person.description}
                      icon={User}
                      iconColor="text-purple-500"
                      usageCount={person.usages.reduce((sum: number, u: any) => sum + u.count, 0)}
                      relationshipCount={relationshipCounts[person.id] || 0}
                      isHighlighted={false}
                      isInspected={false}
                      isExpanded={false}
                      onToggleExpand={() => {}}
                      onInsert={() => {}}
                      onHighlight={() => {}}
                      onViewUsages={() => {}}
                      onMerge={() => {}}
                      onLink={() => {}}
                      onEdit={() => { console.log('[LinkingMode] onEdit called for person:', person.id); setEditingEntity({ id: person.id, type: 'people', name: person.name, role: person.role, description: person.description }); setEditDialogOpen(true); }}
                      onDelete={() => {}}
                      usages={person.usages}
                      linkingMode
                      entityType="people"
                      isSelectedAsSource={selectedSource?.id === person.id && selectedSource?.type === 'people'}
                      onSelectAsSource={() => onSelectSource?.({ id: person.id, type: 'people', name: person.name })}
                    />
                  );
                }
                if (type === 'places') {
                  const place = data;
                  return (
                    <EntityCard
                      key={`places-${place.id}`}
                      id={place.id}
                      title={place.name}
                      subtitle={place.significance}
                      icon={MapPin}
                      iconColor="text-green-500"
                      usageCount={place.usages.reduce((sum: number, u: any) => sum + u.count, 0)}
                      relationshipCount={relationshipCounts[place.id] || 0}
                      isHighlighted={false}
                      isInspected={false}
                      isExpanded={false}
                      onToggleExpand={() => {}}
                      onInsert={() => {}}
                      onHighlight={() => {}}
                      onViewUsages={() => {}}
                      onMerge={() => {}}
                      onLink={() => {}}
                      onEdit={() => { console.log('[LinkingMode] onEdit called for place:', place.id); setEditingEntity({ id: place.id, type: 'places', name: place.name, significance: place.significance }); setEditDialogOpen(true); }}
                      onDelete={() => {}}
                      usages={place.usages}
                      linkingMode
                      entityType="places"
                      isSelectedAsSource={selectedSource?.id === place.id && selectedSource?.type === 'places'}
                      onSelectAsSource={() => onSelectSource?.({ id: place.id, type: 'places', name: place.name })}
                    />
                  );
                }
                return null;
              })
            )}
          </div>
        </ScrollArea>

        {/* Edit Entity Dialog - also needed in linking mode */}
        <EditEntityDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          entity={editingEntity}
          onSave={handleEditSave}
          onRelationshipDeleted={refreshRelationshipCounts}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Master Library Bar - spans full width */}
      <button
        data-allow-pointer
        onClick={() => setMasterLibraryOpen(true)}
        className="flex items-center justify-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/10 hover:bg-muted/30 transition-colors shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Library className="h-4 w-4" />
        Master Library
      </button>
      
      <div className="flex flex-1 min-h-0">
        {/* Vertical Tool Strip */}
        <div className="flex flex-col items-center gap-0.5 px-0.5 py-1 border-r border-border/30 bg-muted/20 overflow-y-auto shrink-0">
        {/* Full Page Toggle */}
        {onToggleFullPage && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-allow-pointer
                variant="ghost"
                size="sm"
                onClick={onToggleFullPage}
                className={cn(
                  "h-7 w-7 p-0",
                  fullPage && "bg-accent/20 text-accent"
                )}
              >
                {fullPage ? (
                  <Minimize2 className="h-3.5 w-3.5" />
                ) : (
                  <Maximize2 className="h-3.5 w-3.5" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              {fullPage ? 'Collapse to sidebar' : 'Expand to full page'}
            </TooltipContent>
          </Tooltip>
        )}

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
              data-allow-pointer
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
                data-allow-pointer
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (entitySuggestions.getTotalSuggestionCount() > 0) {
                    // If we already have suggestions, just open the dialog
                    setSuggestionsDialogOpen(true);
                  } else {
                    // Open dialog immediately to show scanning animation
                    setSuggestionsDialogOpen(true);
                    entitySuggestions.scanDocument(hierarchyBlocks);
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

        {/* Global Highlight Mode */}
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <Button
                  data-allow-pointer
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-7 w-7 p-0 relative",
                    globalHighlightState === 'all' && "bg-accent/20 text-accent",
                    globalHighlightState === 'mixed' && "bg-primary/20 text-primary",
                    globalHighlightState === 'off' && "text-muted-foreground"
                  )}
                >
                  <Highlighter className="h-3.5 w-3.5" />
                  <span className={cn(
                    "absolute bottom-0.5 right-0.5 h-1 w-1 rounded-full",
                    globalHighlightState === 'all' && "bg-accent",
                    globalHighlightState === 'mixed' && "bg-primary",
                    globalHighlightState === 'off' && "bg-muted-foreground"
                  )} />
                </Button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs">
              Highlighting {globalHighlightState === 'off' ? 'off' : globalHighlightState === 'all' ? 'on (all)' : 'on (mixed)'}
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="right" align="start" className="w-auto p-1.5" data-allow-pointer>
            <div className="flex flex-col gap-1">
              {/* Global controls */}
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1 mb-0.5">
                Global
              </div>
              <Button
                data-allow-pointer
                variant={globalHighlightState === 'all' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 justify-start text-xs px-2"
                onClick={() => setAllHighlightModes('all')}
              >
                <span className="h-2 w-2 rounded-full mr-2 bg-accent" />
                All On
              </Button>
              <Button
                data-allow-pointer
                variant={globalHighlightState === 'off' ? 'secondary' : 'ghost'}
                size="sm"
                className="h-7 justify-start text-xs px-2"
                onClick={() => setAllHighlightModes('none')}
              >
                <span className="h-2 w-2 rounded-full mr-2 bg-muted-foreground" />
                All Off
              </Button>
              
              {/* Per-type controls */}
              <div className="h-px bg-border/50 my-1" />
              <div className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide px-1 mb-0.5">
                Per Type
              </div>
              
              {/* People */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-1.5">
                  <User className="h-3 w-3 text-purple-500" />
                  <span className="text-xs">People</span>
                </div>
                <div className="flex gap-0.5">
                  {(['all', 'none'] as const).map(mode => (
                    <button
                      key={mode}
                      data-allow-pointer
                      onClick={() => setPeopleHighlightMode(mode)}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center text-[9px]",
                        peopleHighlightMode === mode 
                          ? "bg-primary/20 text-primary" 
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {mode === 'all' ? '●' : '○'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Places */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-green-500" />
                  <span className="text-xs">Places</span>
                </div>
                <div className="flex gap-0.5">
                  {(['all', 'none'] as const).map(mode => (
                    <button
                      key={mode}
                      data-allow-pointer
                      onClick={() => setPlacesHighlightMode(mode)}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center text-[9px]",
                        placesHighlightMode === mode 
                          ? "bg-primary/20 text-primary" 
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {mode === 'all' ? '●' : '○'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Dates */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-1.5">
                  <Calendar className="h-3 w-3 text-blue-500" />
                  <span className="text-xs">Dates</span>
                </div>
                <div className="flex gap-0.5">
                  {(['all', 'none'] as const).map(mode => (
                    <button
                      key={mode}
                      data-allow-pointer
                      onClick={() => setDateHighlightMode(mode)}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center text-[9px]",
                        dateHighlightMode === mode 
                          ? "bg-primary/20 text-primary" 
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {mode === 'all' ? '●' : '○'}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Terms */}
              <div className="flex items-center justify-between px-1 py-0.5">
                <div className="flex items-center gap-1.5">
                  <Quote className="h-3 w-3 text-amber-500" />
                  <span className="text-xs">Terms</span>
                </div>
                <div className="flex gap-0.5">
                  {(['all', 'none'] as const).map(mode => (
                    <button
                      key={mode}
                      data-allow-pointer
                      onClick={() => setHighlightMode(mode)}
                      className={cn(
                        "h-5 w-5 rounded flex items-center justify-center text-[9px]",
                        highlightMode === mode 
                          ? "bg-primary/20 text-primary" 
                          : "hover:bg-muted text-muted-foreground"
                      )}
                    >
                      {mode === 'all' ? '●' : '○'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* Recalculate */}
        {currentCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-allow-pointer
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
                      onMerge={() => {
                        setMergeSourceEntity({ id: term.id, title: term.term, subtitle: term.definition });
                        setMergeDialogOpen(true);
                      }}
                      onLink={() => {
                        setLinkSourceEntity({ id: term.id, title: term.term, subtitle: term.definition, documentId });
                        setLinkDialogOpen(true);
                      }}
                      onEdit={() => {
                        setEditingEntity({ id: term.id, type: 'terms', term: term.term, definition: term.definition });
                        setEditDialogOpen(true);
                      }}
                      onDelete={() => {
                        setTerms(prev => prev.filter(t => t.id !== term.id));
                        toast({ title: 'Term deleted' });
                      }}
                      usages={term.usages}
                      relationshipCount={relationshipCounts[term.id] || 0}
                      linkingMode={linkingMode}
                      entityType="terms"
                      isSelectedAsSource={selectedSource?.id === term.id && selectedSource?.type === 'terms'}
                      onSelectAsSource={() => onSelectSource?.({ id: term.id, type: 'terms', name: term.term })}
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
                      isExpanded={true}
                      onToggleExpand={() => {}}
                      alwaysExpanded={true}
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
                      onMerge={() => {
                        setMergeSourceEntity({ id: date.id, title: formatDateForDisplay(date.date), subtitle: date.rawText });
                        setMergeDialogOpen(true);
                      }}
                      onLink={() => {
                        setLinkSourceEntity({ id: date.id, title: formatDateForDisplay(date.date), subtitle: date.rawText, documentId });
                        setLinkDialogOpen(true);
                      }}
                      onEdit={() => {
                        setEditingEntity({ id: date.id, type: 'dates', date: date.date, rawText: date.rawText, description: date.description });
                        setEditDialogOpen(true);
                      }}
                      onDelete={() => {
                        setDates(prev => prev.filter(d => d.id !== date.id));
                        toast({ title: 'Date deleted' });
                      }}
                      usages={date.usages}
                      relationshipCount={relationshipCounts[date.id] || 0}
                      linkingMode={linkingMode}
                      entityType="dates"
                      isSelectedAsSource={selectedSource?.id === date.id && selectedSource?.type === 'dates'}
                      onSelectAsSource={() => onSelectSource?.({ id: date.id, type: 'dates', name: date.rawText })}
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
                      onMerge={() => {
                        setMergeSourceEntity({ id: person.id, title: person.name, subtitle: person.role });
                        setMergeDialogOpen(true);
                      }}
                      onLink={() => {
                        setLinkSourceEntity({ id: person.id, title: person.name, subtitle: person.role, documentId });
                        setLinkDialogOpen(true);
                      }}
                      onEdit={() => {
                        setEditingEntity({ id: person.id, type: 'people', name: person.name, role: person.role, description: person.description });
                        setEditDialogOpen(true);
                      }}
                      onDelete={() => {
                        setPeople(prev => prev.filter(p => p.id !== person.id));
                        toast({ title: 'Person deleted' });
                      }}
                      usages={person.usages}
                      relationshipCount={relationshipCounts[person.id] || 0}
                      linkingMode={linkingMode}
                      entityType="people"
                      isSelectedAsSource={selectedSource?.id === person.id && selectedSource?.type === 'people'}
                      onSelectAsSource={() => onSelectSource?.({ id: person.id, type: 'people', name: person.name })}
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
                      onMerge={() => {
                        setMergeSourceEntity({ id: place.id, title: place.name, subtitle: place.significance });
                        setMergeDialogOpen(true);
                      }}
                      onLink={() => {
                        setLinkSourceEntity({ id: place.id, title: place.name, subtitle: place.significance, documentId });
                        setLinkDialogOpen(true);
                      }}
                      onDelete={() => {
                        setPlaces(prev => prev.filter(p => p.id !== place.id));
                        toast({ title: 'Place deleted' });
                      }}
                      onEdit={() => {
                        setEditingEntity({ id: place.id, type: 'places', name: place.name, significance: place.significance });
                        setEditDialogOpen(true);
                      }}
                      usages={place.usages}
                      relationshipCount={relationshipCounts[place.id] || 0}
                      linkingMode={linkingMode}
                      entityType="places"
                      isSelectedAsSource={selectedSource?.id === place.id && selectedSource?.type === 'places'}
                      onSelectAsSource={() => onSelectSource?.({ id: place.id, type: 'places', name: place.name })}
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

      {/* Merge Dialog */}
      <EntityMergeDialog
        open={mergeDialogOpen}
        onOpenChange={(open) => {
          setMergeDialogOpen(open);
          if (!open) setMergeSourceEntity(null);
        }}
        sourceEntity={mergeSourceEntity ?? { id: '', title: '' }}
        entityType={activeTab}
        candidates={
          activeTab === 'terms'
            ? terms.filter(t => t.id !== mergeSourceEntity?.id).map(t => ({ id: t.id, title: t.term, subtitle: t.definition }))
            : activeTab === 'dates'
            ? dates.filter(d => d.id !== mergeSourceEntity?.id).map(d => ({ id: d.id, title: formatDateForDisplay(d.date), subtitle: d.rawText }))
            : activeTab === 'people'
            ? people.filter(p => p.id !== mergeSourceEntity?.id).map(p => ({ id: p.id, title: p.name, subtitle: p.role }))
            : places.filter(p => p.id !== mergeSourceEntity?.id).map(p => ({ id: p.id, title: p.name, subtitle: p.significance }))
        }
        onMerge={(targetId) => {
          if (!mergeSourceEntity) return;
          
          // Remove the source entity (the target entity absorbs it conceptually)
          if (activeTab === 'terms') {
            setTerms(prev => prev.filter(t => t.id !== mergeSourceEntity.id));
          } else if (activeTab === 'dates') {
            setDates(prev => prev.filter(d => d.id !== mergeSourceEntity.id));
          } else if (activeTab === 'people') {
            setPeople(prev => prev.filter(p => p.id !== mergeSourceEntity.id));
          } else if (activeTab === 'places') {
            setPlaces(prev => prev.filter(p => p.id !== mergeSourceEntity.id));
          }
          
          toast({
            title: 'Entities merged',
            description: `"${mergeSourceEntity.title}" merged into target entity`,
          });
        }}
      />

      {/* Link Dialog */}
      <EntityLinkDialog
        open={linkDialogOpen}
        onOpenChange={(open) => {
          setLinkDialogOpen(open);
          if (!open) setLinkSourceEntity(null);
        }}
        sourceEntity={linkSourceEntity ?? { id: '', title: '', documentId: '' }}
        entityType={activeTab}
        onLinkCreated={() => {
          toast({
            title: 'Entity linked',
            description: 'Cross-document identity link created.',
          });
        }}
        onRelationshipCreated={() => {
          toast({
            title: 'Relationship created',
            description: 'Entity relationship established.',
          });
          refreshRelationshipCounts();
        }}
      />

      {/* Edit Entity Dialog */}
      <EditEntityDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        entity={editingEntity}
        onSave={handleEditSave}
        onRelationshipDeleted={refreshRelationshipCounts}
      />

      {/* Master Library Dialog */}
      <MasterLibraryDialog
        open={masterLibraryOpen}
        onOpenChange={setMasterLibraryOpen}
        onJumpToDocument={onNavigateToDocument}
      />
      </div>
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
  onMerge: () => void;
  onLink: () => void;
  onEdit: () => void;
  onDelete: () => void;
  usages: { nodePrefix: string; nodeLabel: string; count: number }[];
  // Linking mode props
  linkingMode?: boolean;
  isSelectedAsSource?: boolean;
  onSelectAsSource?: () => void;
  entityType?: 'people' | 'places' | 'dates' | 'terms';
  // Relationship indicator
  relationshipCount?: number;
  // Force always expanded (no chevron toggle)
  alwaysExpanded?: boolean;
}

const EntityCard = memo(function EntityCard({
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
  onMerge,
  onLink,
  onEdit,
  onDelete,
  usages,
  linkingMode,
  isSelectedAsSource,
  onSelectAsSource,
  entityType,
  relationshipCount = 0,
  alwaysExpanded = false,
}: EntityCardProps) {
  // If alwaysExpanded is true, always show content
  const showExpanded = alwaysExpanded || isExpanded;
  return (
    <div
      className={cn(
        "rounded-md border overflow-hidden min-w-0 transition-colors",
        isHighlighted && "ring-1 ring-amber-500/50",
        linkingMode && "cursor-pointer",
        linkingMode && !isSelectedAsSource && "border-border bg-card/50 hover:bg-muted/50",
        linkingMode && isSelectedAsSource && "border-primary bg-primary/20",
        !linkingMode && "border-border bg-card/50"
      )}
      onClick={linkingMode ? onSelectAsSource : undefined}
    >
      {/* Header */}
      <div className="flex items-start gap-1.5 px-2 py-1.5 min-w-0">
        {!linkingMode && !alwaysExpanded && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand();
            }}
            className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          {usageCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
              {usageCount}
            </span>
          )}
        </div>

        <span className="text-xs font-medium flex-1 min-w-0 break-words">{title}</span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between px-2 pb-1.5 gap-1">
        <div className="flex items-center gap-0.5">
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

        <div className="flex items-center gap-0.5">
          {/* Relationship indicator */}
          {relationshipCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="h-6 w-6 flex items-center justify-center text-primary">
                  <Link2 className="h-3 w-3" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">
                {relationshipCount} relationship{relationshipCount !== 1 ? 's' : ''}
              </TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                data-allow-pointer
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem 
                data-allow-pointer
                onSelect={(e) => { 
                  console.log('[EntityCard] Edit onSelect fired', { defaultPrevented: e.defaultPrevented, linkingMode });
                  e.preventDefault(); 
                  setTimeout(() => {
                    console.log('[EntityCard] Edit setTimeout executing, calling onEdit()');
                    onEdit(); 
                  }, 0); 
                }}
              >
                <Pencil className="h-3.5 w-3.5 mr-2" />
                Edit...
              </DropdownMenuItem>
              <DropdownMenuItem 
                data-allow-pointer
                onSelect={(e) => { 
                  console.log('[EntityCard] Link onSelect fired');
                  e.preventDefault(); 
                  setTimeout(() => {
                    console.log('[EntityCard] Link setTimeout executing');
                    onLink(); 
                  }, 0); 
                }}
              >
                <Link2 className="h-3.5 w-3.5 mr-2" />
                Link entity...
              </DropdownMenuItem>
              <DropdownMenuItem 
                data-allow-pointer
                onSelect={(e) => { 
                  console.log('[EntityCard] Merge onSelect fired');
                  e.preventDefault(); 
                  setTimeout(() => {
                    console.log('[EntityCard] Merge setTimeout executing');
                    onMerge(); 
                  }, 0); 
                }}
              >
                <Merge className="h-3.5 w-3.5 mr-2" />
                Merge with...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                data-allow-pointer
                onSelect={(e) => { 
                  console.log('[EntityCard] Delete onSelect fired');
                  e.preventDefault(); 
                  setTimeout(() => {
                    console.log('[EntityCard] Delete setTimeout executing');
                    onDelete(); 
                  }, 0); 
                }} 
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Expanded content */}
      {showExpanded && (
        <div className="px-2 pb-2 pt-1 border-t border-border/30 space-y-1.5">
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
          {description && (
            <p className="text-xs text-muted-foreground italic">{description}</p>
          )}
          {usages.length > 0 && (
            <div className="pt-1">
              <p className="text-[10px] text-muted-foreground uppercase font-medium mb-1">Usages</p>
              <div className="flex flex-wrap gap-1">
                {usages.slice(0, 5).map((u, i) => (
                  <span
                    key={i}
                    className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded"
                    title={u.nodeLabel}
                  >
                    {u.nodePrefix}
                  </span>
                ))}
                {usages.length > 5 && (
                  <span className="text-xs text-muted-foreground">
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
});

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

const AggregatedEntityCard = memo(function AggregatedEntityCard({
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
    <div className="rounded-md border border-border bg-card/50 overflow-hidden min-w-0">
      {/* Header */}
      <div className="flex items-start gap-1.5 px-2 py-1.5 min-w-0">
        <button
          onClick={onToggleExpand}
          className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Icon className={cn("h-3.5 w-3.5", iconColor)} />
          {usageCount > 0 && (
            <span className="text-[10px] text-muted-foreground bg-muted px-1 py-0.5 rounded">
              {usageCount}
            </span>
          )}
        </div>

        <span className="text-xs font-medium flex-1 min-w-0 break-words">{title}</span>
      </div>

      {/* Source indicator */}
      <div className="flex items-center gap-1 px-2 pb-1.5 min-w-0">
        <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
        <span className="text-[10px] text-muted-foreground break-words min-w-0">{sourceDocTitle}</span>
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
});
