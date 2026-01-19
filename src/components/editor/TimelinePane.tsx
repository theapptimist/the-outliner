import { useState, useMemo } from 'react';
import { 
  Clock, 
  ChevronDown, 
  ChevronRight, 
  Search, 
  Highlighter,
  MapPin,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useDatesContext, TaggedDate, DateHighlightMode } from './context/DatesContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAggregatedEntities, AggregatedDate } from '@/hooks/useAggregatedEntities';
import { formatDateForDisplay, getDateGroup } from '@/lib/dateScanner';

interface TimelinePaneProps {
  collapsed?: boolean;
  onNavigateToDocument?: (id: string) => void;
}

interface TimelineGroup {
  year: number;
  quarter: number;
  label: string;
  dates: (TaggedDate | AggregatedDate)[];
}

function groupDatesByQuarter(dates: (TaggedDate | AggregatedDate)[]): TimelineGroup[] {
  const groups = new Map<string, TimelineGroup>();
  
  for (const date of dates) {
    const dateObj = date.date instanceof Date ? date.date : new Date(date.date as unknown as string);
    const { year, quarter } = getDateGroup(dateObj);
    const key = `${year}-Q${quarter}`;
    
    if (!groups.has(key)) {
      groups.set(key, {
        year,
        quarter,
        label: `${year} Q${quarter}`,
        dates: [],
      });
    }
    groups.get(key)!.dates.push(date);
  }
  
  // Sort groups chronologically
  return Array.from(groups.values()).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return a.quarter - b.quarter;
  });
}

export function TimelinePane({ collapsed, onNavigateToDocument }: TimelinePaneProps) {
  const { 
    dates: localDates, 
    setHighlightedDate,
    highlightedDate,
    dateHighlightMode,
    setDateHighlightMode,
    setInspectedDate,
  } = useDatesContext();
  
  const { isInMasterMode, activeSubOutlineId, masterDocument } = useNavigation();
  const { shouldAggregate, aggregatedDates, loading } = useAggregatedEntities();
  
  const [search, setSearch] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showSearch, setShowSearch] = useState(false);
  
  // Use aggregated dates in master mode, local dates otherwise
  const dates = shouldAggregate ? aggregatedDates : localDates;
  
  // Filter dates by search
  const filteredDates = useMemo(() => {
    if (!search.trim()) return dates;
    const searchLower = search.toLowerCase();
    return dates.filter(d => 
      d.rawText.toLowerCase().includes(searchLower) ||
      d.description?.toLowerCase().includes(searchLower)
    );
  }, [dates, search]);
  
  // Sort chronologically
  const sortedDates = useMemo(() => {
    return [...filteredDates].sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date as unknown as string);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date as unknown as string);
      return dateA.getTime() - dateB.getTime();
    });
  }, [filteredDates]);
  
  // Group by quarter
  const groups = useMemo(() => groupDatesByQuarter(sortedDates), [sortedDates]);
  
  // Toggle group expansion
  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };
  
  // Initialize all groups as expanded
  useMemo(() => {
    if (groups.length > 0 && expandedGroups.size === 0) {
      setExpandedGroups(new Set(groups.map(g => g.label)));
    }
  }, [groups.length]);
  
  // Cycle highlight mode
  const cycleHighlightMode = () => {
    const modes: DateHighlightMode[] = ['all', 'selected', 'none'];
    const currentIndex = modes.indexOf(dateHighlightMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setDateHighlightMode(nextMode);
    if (nextMode !== 'selected') {
      setHighlightedDate(null);
    }
  };
  
  // Handle date click - set for highlighting and inspection
  const handleDateClick = (date: TaggedDate | AggregatedDate) => {
    if (dateHighlightMode === 'selected') {
      setHighlightedDate(highlightedDate?.id === date.id ? null : date as TaggedDate);
    }
    setInspectedDate(date as TaggedDate);
  };
  
  // Handle navigation to source document
  const handleNavigateToSource = (date: AggregatedDate) => {
    if (date.sourceDocId && onNavigateToDocument) {
      onNavigateToDocument(date.sourceDocId);
    }
  };
  
  // Collapsed view
  if (collapsed) {
    return (
      <div className="flex flex-col items-center py-4 gap-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-1">
              <Clock className="h-5 w-5 text-info" />
              <Badge variant="secondary" className="text-xs px-1.5">
                {dates.length}
              </Badge>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right">
            Timeline ({dates.length} dates)
          </TooltipContent>
        </Tooltip>
      </div>
    );
  }
  
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-info" />
          <span className="text-sm font-medium">Timeline</span>
          <Badge variant="secondary" className="text-xs">
            {dates.length}
          </Badge>
        </div>
        
        <div className="flex items-center gap-1">
          {/* Search toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 w-6 p-0",
                  showSearch && "bg-info/15 text-info"
                )}
                onClick={() => setShowSearch(!showSearch)}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Search Timeline</TooltipContent>
          </Tooltip>
          
          {/* Highlight mode */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-6 w-6 p-0",
                  dateHighlightMode !== 'none' && "bg-info/15 text-info"
                )}
                onClick={cycleHighlightMode}
              >
                <Highlighter className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              Highlight: {dateHighlightMode}
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
      
      {/* Search input */}
      {showSearch && (
        <div className="px-3 py-2 border-b border-border/30">
          <Input
            placeholder="Search dates..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-7 text-xs"
          />
        </div>
      )}
      
      {/* Master mode indicator */}
      {shouldAggregate && (
        <div className="px-3 py-1.5 bg-warning/10 border-b border-warning/20">
          <span className="text-xs text-warning flex items-center gap-1.5">
            <FileText className="h-3 w-3" />
            Aggregated from {masterDocument?.links.length || 0} documents
          </span>
        </div>
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          <span className="text-sm">Loading timeline...</span>
        </div>
      )}
      
      {/* Empty state */}
      {!loading && dates.length === 0 && (
        <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <Clock className="h-8 w-8 text-muted-foreground/50 mb-2" />
          <p className="text-sm text-muted-foreground">No dates tagged yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Add dates in the Library to build your timeline
          </p>
        </div>
      )}
      
      {/* Timeline content */}
      {!loading && groups.length > 0 && (
        <ScrollArea className="flex-1">
          <div className="relative px-3 py-2">
            {/* Timeline rail */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-info/50 via-info/30 to-info/10" />
            
            {groups.map((group) => {
              const isExpanded = expandedGroups.has(group.label);
              
              return (
                <Collapsible
                  key={group.label}
                  open={isExpanded}
                  onOpenChange={() => toggleGroup(group.label)}
                >
                  {/* Quarter header */}
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center gap-2 w-full py-2 pl-4 pr-2 hover:bg-muted/50 rounded-md transition-colors group">
                      <div className="relative z-10 h-3 w-3 rounded-full bg-info/80 border-2 border-background shadow-sm" />
                      {isExpanded ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                      <span className="text-sm font-semibold text-foreground">
                        {group.label}
                      </span>
                      <Badge variant="outline" className="text-xs ml-auto">
                        {group.dates.length}
                      </Badge>
                    </button>
                  </CollapsibleTrigger>
                  
                  <CollapsibleContent>
                    <div className="ml-8 space-y-1 pb-2">
                      {group.dates.map((date) => {
                        const dateObj = date.date instanceof Date ? date.date : new Date(date.date as unknown as string);
                        const isHighlighted = highlightedDate?.id === date.id;
                        const isAggregated = 'sourceDocId' in date;
                        
                        return (
                          <div
                            key={date.id}
                            onClick={() => handleDateClick(date)}
                            className={cn(
                              "relative pl-4 pr-3 py-3 rounded-lg cursor-pointer transition-all",
                              "hover:bg-info/10 border border-border/50",
                              "bg-card/50 shadow-sm",
                              isHighlighted && "bg-info/15 border-info/40 shadow-info/20"
                            )}
                          >
                            {/* Connector line */}
                            <div className="absolute left-0 top-1/2 w-3 h-0.5 bg-info/30 -translate-y-1/2" />
                            
                            {/* Date content - redesigned for visibility */}
                            <div className="flex flex-col gap-1.5">
                              {/* Primary: Description/context - this is the meaningful part */}
                              {date.description ? (
                                <p className="text-sm font-medium text-foreground leading-snug">
                                  {date.description}
                                </p>
                              ) : (
                                <p className="text-sm text-foreground leading-snug">
                                  "{date.rawText}"
                                </p>
                              )}
                              
                              {/* Secondary row: formatted date + usages badge */}
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs font-medium text-info">
                                  {formatDateForDisplay(dateObj)}
                                </span>
                                {date.usages && date.usages.length > 0 && (
                                  <Badge variant="secondary" className="text-xs h-5">
                                    <MapPin className="h-2.5 w-2.5 mr-0.5" />
                                    {date.usages.length}
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Show rawText as tertiary if description exists */}
                              {date.description && (
                                <span className="text-xs text-muted-foreground italic">
                                  "{date.rawText}"
                                </span>
                              )}
                              
                              {/* Source document badge for aggregated dates */}
                              {isAggregated && (date as AggregatedDate).sourceDocTitle && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleNavigateToSource(date as AggregatedDate);
                                  }}
                                  className="flex items-center gap-1 text-xs text-warning hover:text-warning/80 mt-0.5"
                                >
                                  <FileText className="h-3 w-3" />
                                  {(date as AggregatedDate).sourceDocTitle}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
