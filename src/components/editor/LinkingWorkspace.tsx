import React, { useState, useMemo } from 'react';
import { Link2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useEditorContext } from './EditorContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { useAggregatedEntities } from '@/hooks/useAggregatedEntities';
import { LibraryPane, EntityRef } from './LibraryPane';
import { TargetEntityPane } from './TargetEntityPane';
import { GroupEntitiesDialog } from './GroupEntitiesDialog';

interface LinkingWorkspaceProps {
  onClose: () => void;
  selectedText?: string;
}

export function LinkingWorkspace({ onClose, selectedText }: LinkingWorkspaceProps) {
  const { terms, dates, people, places } = useEditorContext();
  const { isInMasterMode } = useNavigation();
  const { 
    shouldAggregate, 
    aggregatedPeople, 
    aggregatedPlaces, 
    aggregatedDates, 
    aggregatedTerms 
  } = useAggregatedEntities();

  const [selectedSource, setSelectedSource] = useState<EntityRef | null>(null);
  const [selectedTargets, setSelectedTargets] = useState<EntityRef[]>([]);
  const [showGroupDialog, setShowGroupDialog] = useState(false);

  // Build unified entity list for target pane
  const allEntities = useMemo((): EntityRef[] => {
    const entities: EntityRef[] = [];

    if (shouldAggregate) {
      // Aggregated mode - use aggregated entities
      aggregatedPeople.forEach(p => {
        entities.push({
          id: p.id,
          type: 'people',
          name: p.name || 'Unknown',
          sourceDocId: p.sourceDocId,
          sourceDocTitle: p.sourceDocTitle,
        });
      });
      aggregatedPlaces.forEach(p => {
        entities.push({
          id: p.id,
          type: 'places',
          name: p.name || 'Unknown',
          sourceDocId: p.sourceDocId,
          sourceDocTitle: p.sourceDocTitle,
        });
      });
      aggregatedDates.forEach(d => {
        entities.push({
          id: d.id,
          type: 'dates',
          name: d.rawText || 'Unknown',
          sourceDocId: d.sourceDocId,
          sourceDocTitle: d.sourceDocTitle,
        });
      });
      aggregatedTerms.forEach(t => {
        entities.push({
          id: t.id,
          type: 'terms',
          name: t.term || 'Unknown',
          sourceDocId: t.sourceDocId,
          sourceDocTitle: t.sourceDocTitle,
        });
      });
    } else {
      // Local mode - use current document entities
      people.forEach(p => {
        entities.push({
          id: p.id,
          type: 'people',
          name: p.name || 'Unknown',
        });
      });
      places.forEach(p => {
        entities.push({
          id: p.id,
          type: 'places',
          name: p.name || 'Unknown',
        });
      });
      dates.forEach(d => {
        entities.push({
          id: d.id,
          type: 'dates',
          name: d.rawText || 'Unknown',
        });
      });
      terms.forEach(t => {
        entities.push({
          id: t.id,
          type: 'terms',
          name: t.term || 'Unknown',
        });
      });
    }

    return entities;
  }, [shouldAggregate, aggregatedPeople, aggregatedPlaces, aggregatedDates, aggregatedTerms, people, places, dates, terms]);

  const handleSelectSource = (entity: EntityRef) => {
    // Toggle selection if clicking same source
    if (selectedSource?.id === entity.id && selectedSource?.type === entity.type) {
      setSelectedSource(null);
    } else {
      setSelectedSource(entity);
      // Remove from targets if it was selected there
      setSelectedTargets(prev => prev.filter(t => !(t.id === entity.id && t.type === entity.type)));
    }
  };

  const handleToggleTarget = (entity: EntityRef) => {
    setSelectedTargets(prev => {
      const exists = prev.some(t => t.id === entity.id && t.type === entity.type);
      if (exists) {
        return prev.filter(t => !(t.id === entity.id && t.type === entity.type));
      } else {
        return [...prev, entity];
      }
    });
  };

  const handleGroupSuccess = () => {
    setSelectedSource(null);
    setSelectedTargets([]);
  };

  const canGroup = selectedSource && selectedTargets.length > 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/30 bg-muted/30">
        <div className="flex items-center gap-2">
          <Link2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Entity Linking Workspace</span>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Main content - dual pane */}
      <div className="flex flex-1 min-h-0">
        {/* Source Pane (left) */}
        <div className="w-1/2 flex flex-col border-r border-border/30">
          <div className="px-3 py-2 border-b border-border/30 bg-muted/20">
            <div className="text-xs font-medium text-muted-foreground">Select Source</div>
          </div>
          <div className="flex-1 overflow-hidden">
            <LibraryPane
              collapsed={false}
              selectedText={selectedText}
              linkingMode
              selectedSource={selectedSource}
              onSelectSource={handleSelectSource}
            />
          </div>
        </div>

        {/* Target Pane (right) */}
        <div className="w-1/2 flex flex-col">
          <TargetEntityPane
            allEntities={allEntities}
            selectedSource={selectedSource}
            selectedTargets={selectedTargets}
            onToggleTarget={handleToggleTarget}
          />
        </div>
      </div>

      {/* Bottom action bar */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 bg-muted/30">
        <div className="text-xs text-muted-foreground">
          {selectedSource ? (
            <>
              Source: <span className="font-medium text-foreground">{selectedSource.name}</span>
              {selectedTargets.length > 0 && (
                <> → {selectedTargets.length} target{selectedTargets.length !== 1 ? 's' : ''}</>
              )}
            </>
          ) : (
            'Select a source entity to begin'
          )}
        </div>
        <Button
          onClick={() => setShowGroupDialog(true)}
          disabled={!canGroup}
          size="sm"
          className="h-8"
        >
          <Link2 className="h-3.5 w-3.5 mr-1.5" />
          Group {selectedTargets.length > 0 ? `${selectedTargets.length} ` : ''}Entities
        </Button>
      </div>

      {/* Group dialog */}
      <GroupEntitiesDialog
        open={showGroupDialog}
        onOpenChange={setShowGroupDialog}
        source={selectedSource}
        targets={selectedTargets}
        onSuccess={handleGroupSuccess}
      />
    </div>
  );
}
