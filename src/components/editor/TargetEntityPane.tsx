import React, { useState, useMemo } from 'react';
import { User, MapPin, Calendar, BookOpen, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { EntityRef } from './LibraryPane';

export type EntityType = 'people' | 'places' | 'dates' | 'terms';

interface TargetEntityPaneProps {
  allEntities: EntityRef[];
  selectedSource: EntityRef | null;
  selectedTargets: EntityRef[];
  onToggleTarget: (entity: EntityRef) => void;
}

const ENTITY_ICONS = {
  people: User,
  places: MapPin,
  dates: Calendar,
  terms: BookOpen,
};

const ENTITY_COLORS = {
  people: 'text-blue-500',
  places: 'text-emerald-500',
  dates: 'text-amber-500',
  terms: 'text-purple-500',
};

export function TargetEntityPane({
  allEntities,
  selectedSource,
  selectedTargets,
  onToggleTarget,
}: TargetEntityPaneProps) {
  const [activeFilter, setActiveFilter] = useState<EntityType | 'all'>('all');
  const [search, setSearch] = useState('');

  // Filter out the selected source and apply type/search filters
  const filteredEntities = useMemo(() => {
    return allEntities.filter(entity => {
      // Exclude selected source
      if (selectedSource && entity.id === selectedSource.id && entity.type === selectedSource.type) {
        return false;
      }
      // Type filter
      if (activeFilter !== 'all' && entity.type !== activeFilter) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        return entity.name.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [allEntities, selectedSource, activeFilter, search]);

  const isSelected = (entity: EntityRef) => {
    return selectedTargets.some(t => t.id === entity.id && t.type === entity.type);
  };

  return (
    <div className="flex flex-col h-full border-l border-border/30">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border/30 bg-muted/20">
        <div className="text-xs font-medium text-muted-foreground mb-2">Select Targets</div>
        
        {/* Entity type filter tabs */}
        <div className="flex gap-1 mb-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => setActiveFilter('all')}
                className={cn(
                  "px-2 py-1 text-xs rounded transition-colors",
                  activeFilter === 'all' 
                    ? "bg-accent text-accent-foreground" 
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                All
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-xs">All entity types</TooltipContent>
          </Tooltip>
          
          {(['people', 'places', 'dates', 'terms'] as EntityType[]).map(type => {
            const Icon = ENTITY_ICONS[type];
            return (
              <Tooltip key={type}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setActiveFilter(type)}
                    className={cn(
                      "p-1.5 rounded transition-colors",
                      activeFilter === type 
                        ? "bg-accent text-accent-foreground" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs capitalize">{type}</TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search targets..."
            className="h-7 pl-7 text-xs"
          />
        </div>
      </div>

      {/* Entity list */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {filteredEntities.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-4">
              {selectedSource ? 'No matching entities' : 'Select a source first'}
            </div>
          ) : (
            filteredEntities.map(entity => {
              const Icon = ENTITY_ICONS[entity.type];
              const checked = isSelected(entity);
              
              return (
                <label
                  key={`${entity.type}-${entity.id}`}
                  className={cn(
                    "flex items-start gap-2 p-2 rounded-md cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    checked && "bg-accent/20 ring-1 ring-accent/50"
                  )}
                >
                  <Checkbox
                    checked={checked}
                    onCheckedChange={() => onToggleTarget(entity)}
                    className="mt-0.5 shrink-0"
                  />
                  <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", ENTITY_COLORS[entity.type])} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium break-words">{entity.name}</div>
                    {entity.sourceDocTitle && (
                      <div className="text-[10px] text-muted-foreground truncate">
                        from {entity.sourceDocTitle}
                      </div>
                    )}
                  </div>
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>

      {/* Selection count */}
      {selectedTargets.length > 0 && (
        <div className="px-3 py-2 border-t border-border/30 bg-muted/20">
          <div className="text-xs text-muted-foreground">
            {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''} selected
          </div>
        </div>
      )}
    </div>
  );
}
