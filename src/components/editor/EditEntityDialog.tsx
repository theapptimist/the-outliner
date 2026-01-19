import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, MapPin, Calendar as CalendarIcon, Quote, Pencil, Link2, Trash2, ArrowRight, Loader2, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDateForDisplay } from '@/lib/dateScanner';
import { useEntityRelationships } from '@/hooks/useEntityRelationships';
import { deleteEntityRelationship, updateEntityRelationship, EntityRelationship, COMMON_RELATIONSHIP_TYPES, getUserRelationshipTypes } from '@/lib/cloudEntityRelationshipStorage';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export type EntityType = 'people' | 'places' | 'dates' | 'terms';

export interface EditableEntity {
  id: string;
  type: EntityType;
  // Person fields
  name?: string;
  role?: string;
  description?: string;
  // Place fields
  significance?: string;
  // Date fields
  date?: Date;
  rawText?: string;
  // Term fields
  term?: string;
  definition?: string;
}

interface EntityInfo {
  id: string;
  name: string;
  type: string;
}

interface EditEntityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entity: EditableEntity | null;
  onSave: (entity: EditableEntity) => void;
  onRelationshipDeleted?: () => void;
}

export function EditEntityDialog({
  open,
  onOpenChange,
  entity,
  onSave,
  onRelationshipDeleted,
}: EditEntityDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Person/Place name
  const [name, setName] = useState('');
  // Person role
  const [role, setRole] = useState('');
  // Person/Date description
  const [description, setDescription] = useState('');
  // Place significance
  const [significance, setSignificance] = useState('');
  // Date fields
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [rawText, setRawText] = useState('');
  const [calendarOpen, setCalendarOpen] = useState(false);
  // Term fields
  const [term, setTerm] = useState('');
  const [definition, setDefinition] = useState('');
  
  // Relationships
  const { relationships, loading: loadingRelationships, refresh: refreshRelationships } = useEntityRelationships(open ? entity?.id ?? null : null);
  const [relatedEntities, setRelatedEntities] = useState<Record<string, EntityInfo>>({});
  const [loadingEntities, setLoadingEntities] = useState(false);
  const [deletingRelationship, setDeletingRelationship] = useState<string | null>(null);
  
  // Edit relationship state
  const [editingRelationshipId, setEditingRelationshipId] = useState<string | null>(null);
  const [editingRelationshipType, setEditingRelationshipType] = useState('');
  const [savingRelationship, setSavingRelationship] = useState(false);
  const [availableRelationshipTypes, setAvailableRelationshipTypes] = useState<string[]>([]);

  // Reset and prefill when dialog opens or entity changes
  useEffect(() => {
    if (open && entity) {
      if (entity.type === 'people') {
        setName(entity.name || '');
        setRole(entity.role || '');
        setDescription(entity.description || '');
      } else if (entity.type === 'places') {
        setName(entity.name || '');
        setSignificance(entity.significance || '');
      } else if (entity.type === 'dates') {
        setSelectedDate(entity.date);
        setRawText(entity.rawText || '');
        setDescription(entity.description || '');
      } else if (entity.type === 'terms') {
        setTerm(entity.term || '');
        setDefinition(entity.definition || '');
      }
    }
  }, [open, entity]);

  // Load available relationship types
  useEffect(() => {
    if (!open || !user) return;
    
    const loadRelationshipTypes = async () => {
      const userTypes = await getUserRelationshipTypes(user.id);
      const allTypes = [...new Set([...COMMON_RELATIONSHIP_TYPES, ...userTypes])];
      setAvailableRelationshipTypes(allTypes);
    };
    
    loadRelationshipTypes();
  }, [open, user]);

  // Fetch entity details for relationships
  useEffect(() => {
    if (!open || relationships.length === 0) {
      setRelatedEntities({});
      return;
    }

    const fetchEntityInfo = async () => {
      setLoadingEntities(true);
      const entityIds = new Set<string>();
      
      relationships.forEach(rel => {
        if (rel.source_entity_id !== entity?.id) entityIds.add(rel.source_entity_id);
        if (rel.target_entity_id !== entity?.id) entityIds.add(rel.target_entity_id);
      });

      if (entityIds.size === 0) {
        setLoadingEntities(false);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('document_entities')
          .select('id, entity_type, data')
          .in('id', Array.from(entityIds));

        if (error) throw error;

        const entities: Record<string, EntityInfo> = {};
        data?.forEach(ent => {
          const entData = ent.data as Record<string, unknown>;
          let name = 'Unknown';
          if (ent.entity_type === 'people' || ent.entity_type === 'places') {
            name = (entData?.name as string) || 'Unknown';
          } else if (ent.entity_type === 'dates') {
            name = (entData?.rawText as string) || 'Unknown Date';
          } else if (ent.entity_type === 'terms') {
            name = (entData?.term as string) || 'Unknown Term';
          }
          entities[ent.id] = { id: ent.id, name, type: ent.entity_type };
        });
        setRelatedEntities(entities);
      } catch (error) {
        console.error('Failed to fetch entity info:', error);
      } finally {
        setLoadingEntities(false);
      }
    };

    fetchEntityInfo();
  }, [open, relationships, entity?.id]);

  const handleDeleteRelationship = async (relationshipId: string) => {
    setDeletingRelationship(relationshipId);
    try {
      const success = await deleteEntityRelationship(relationshipId);
      if (success) {
        toast({ title: 'Relationship removed' });
        refreshRelationships();
        onRelationshipDeleted?.();
      } else {
        toast({ title: 'Failed to remove relationship', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to delete relationship:', error);
      toast({ title: 'Failed to remove relationship', variant: 'destructive' });
    } finally {
      setDeletingRelationship(null);
    }
  };

  const handleStartEditRelationship = (rel: EntityRelationship) => {
    setEditingRelationshipId(rel.id);
    setEditingRelationshipType(rel.relationship_type);
  };

  const handleCancelEditRelationship = () => {
    setEditingRelationshipId(null);
    setEditingRelationshipType('');
  };

  const handleSaveRelationship = async (relationshipId: string) => {
    if (!editingRelationshipType.trim()) return;
    
    setSavingRelationship(true);
    try {
      const updated = await updateEntityRelationship(relationshipId, {
        relationship_type: editingRelationshipType.trim(),
      });
      
      if (updated) {
        toast({ title: 'Relationship updated' });
        refreshRelationships();
        setEditingRelationshipId(null);
        setEditingRelationshipType('');
      } else {
        toast({ title: 'Failed to update relationship', variant: 'destructive' });
      }
    } catch (error) {
      console.error('Failed to update relationship:', error);
      toast({ title: 'Failed to update relationship', variant: 'destructive' });
    } finally {
      setSavingRelationship(false);
    }
  };

  const getRelationshipDisplay = (rel: EntityRelationship) => {
    const isSource = rel.source_entity_id === entity?.id;
    const otherEntityId = isSource ? rel.target_entity_id : rel.source_entity_id;
    const otherEntity = relatedEntities[otherEntityId];
    
    return {
      direction: isSource ? 'outgoing' : 'incoming',
      relationshipType: rel.relationship_type,
      otherEntity: otherEntity || { id: otherEntityId, name: 'Loading...', type: 'unknown' },
      description: rel.description,
    };
  };

  const getEntityIcon = (type: string) => {
    switch (type) {
      case 'people': return <User className="h-3 w-3 text-purple-500" />;
      case 'places': return <MapPin className="h-3 w-3 text-green-500" />;
      case 'dates': return <CalendarIcon className="h-3 w-3 text-blue-500" />;
      case 'terms': return <Quote className="h-3 w-3 text-amber-500" />;
      default: return null;
    }
  };

  const handleSave = () => {
    if (!entity) return;

    const updatedEntity: EditableEntity = { id: entity.id, type: entity.type };

    if (entity.type === 'people') {
      if (!name.trim()) return;
      updatedEntity.name = name.trim();
      updatedEntity.role = role.trim() || undefined;
      updatedEntity.description = description.trim() || undefined;
    } else if (entity.type === 'places') {
      if (!name.trim()) return;
      updatedEntity.name = name.trim();
      updatedEntity.significance = significance.trim() || undefined;
    } else if (entity.type === 'dates') {
      if (!selectedDate) return;
      updatedEntity.date = selectedDate;
      updatedEntity.rawText = rawText.trim() || formatDateForDisplay(selectedDate);
      updatedEntity.description = description.trim() || undefined;
    } else if (entity.type === 'terms') {
      if (!term.trim() || !definition.trim()) return;
      updatedEntity.term = term.trim();
      updatedEntity.definition = definition.trim();
    }

    onSave(updatedEntity);
    onOpenChange(false);
  };

  const isValid = () => {
    if (!entity) return false;
    if (entity.type === 'people' || entity.type === 'places') {
      return name.trim().length > 0;
    }
    if (entity.type === 'dates') {
      return !!selectedDate;
    }
    if (entity.type === 'terms') {
      return term.trim().length > 0 && definition.trim().length > 0;
    }
    return false;
  };

  const getIcon = () => {
    if (!entity) return <Pencil className="h-5 w-5" />;
    switch (entity.type) {
      case 'people': return <User className="h-5 w-5 text-purple-500" />;
      case 'places': return <MapPin className="h-5 w-5 text-green-500" />;
      case 'dates': return <CalendarIcon className="h-5 w-5 text-blue-500" />;
      case 'terms': return <Quote className="h-5 w-5 text-amber-500" />;
    }
  };

  const getTitle = () => {
    if (!entity) return 'Edit Entity';
    switch (entity.type) {
      case 'people': return 'Edit Person';
      case 'places': return 'Edit Place';
      case 'dates': return 'Edit Date';
      case 'terms': return 'Edit Term';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        <DialogHeader className="overflow-hidden flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            {getIcon()}
            {getTitle()}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4">
          <div className="space-y-4 py-4">
            {/* Person fields */}
            {entity?.type === 'people' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Harold Norse"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="role">Role (optional)</Label>
                  <Input
                    id="role"
                    placeholder="e.g., poet, friend, publisher"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief bio or relationship note..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Place fields */}
            {entity?.type === 'places' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Beat Hotel"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="significance">Significance (optional)</Label>
                  <Textarea
                    id="significance"
                    placeholder="Why this place is important..."
                    value={significance}
                    onChange={(e) => setSignificance(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Date fields */}
            {entity?.type === 'dates' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="rawText">Date Text</Label>
                  <Input
                    id="rawText"
                    placeholder="e.g., Spring 1959"
                    value={rawText}
                    onChange={(e) => setRawText(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>Normalized Date</Label>
                  <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal",
                          !selectedDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {selectedDate ? formatDateForDisplay(selectedDate) : "Select a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => {
                          setSelectedDate(date);
                          setCalendarOpen(false);
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Context or notes about this date..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="resize-none"
                    rows={3}
                  />
                </div>
              </>
            )}

            {/* Term fields */}
            {entity?.type === 'terms' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="term">Term</Label>
                  <Input
                    id="term"
                    placeholder="e.g., Beat Generation"
                    value={term}
                    onChange={(e) => setTerm(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="definition">Definition</Label>
                  <Textarea
                    id="definition"
                    placeholder="Definition or explanation..."
                    value={definition}
                    onChange={(e) => setDefinition(e.target.value)}
                    className="resize-none"
                    rows={4}
                  />
                </div>
              </>
            )}

            {/* Relationships Section */}
            <Separator className="my-4" />
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Link2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm font-medium">Relationships</Label>
                {loadingRelationships && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
              </div>

              {relationships.length === 0 && !loadingRelationships ? (
                <p className="text-sm text-muted-foreground italic">No relationships defined</p>
              ) : (
                <div className="space-y-2">
                  {relationships.map((rel) => {
                    const display = getRelationshipDisplay(rel);
                    const isEditing = editingRelationshipId === rel.id;
                    
                    return (
                      <div
                        key={rel.id}
                        className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/50 border border-border"
                      >
                        {isEditing ? (
                          // Edit mode
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <Select
                              value={editingRelationshipType}
                              onValueChange={setEditingRelationshipType}
                            >
                              <SelectTrigger className="h-7 text-xs w-[140px]">
                                <SelectValue placeholder="Select type" />
                              </SelectTrigger>
                              <SelectContent>
                                {availableRelationshipTypes.map((type) => (
                                  <SelectItem key={type} value={type} className="text-xs">
                                    {type}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                            <div className="flex items-center gap-1 min-w-0">
                              {getEntityIcon(display.otherEntity.type)}
                              <span className="text-sm truncate">{display.otherEntity.name}</span>
                            </div>
                          </div>
                        ) : (
                          // View mode - clickable to edit
                          <button
                            className="flex items-center gap-2 min-w-0 flex-1 text-left hover:bg-muted/50 rounded -m-1 p-1 transition-colors"
                            onClick={() => handleStartEditRelationship(rel)}
                            title="Click to edit relationship type"
                          >
                            {display.direction === 'outgoing' ? (
                              <>
                                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 underline decoration-dashed underline-offset-2">
                                  {display.relationshipType || <em className="text-muted-foreground/60">(no type)</em>}
                                </span>
                                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <div className="flex items-center gap-1 min-w-0">
                                  {getEntityIcon(display.otherEntity.type)}
                                  <span className="text-sm truncate">{display.otherEntity.name}</span>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-center gap-1 min-w-0">
                                  {getEntityIcon(display.otherEntity.type)}
                                  <span className="text-sm truncate">{display.otherEntity.name}</span>
                                </div>
                                <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                                <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0 underline decoration-dashed underline-offset-2">
                                  {display.relationshipType || <em className="text-muted-foreground/60">(no type)</em>}
                                </span>
                              </>
                            )}
                          </button>
                        )}
                        
                        <div className="flex items-center gap-1 flex-shrink-0">
                          {isEditing ? (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() => handleSaveRelationship(rel.id)}
                                disabled={savingRelationship || !editingRelationshipType.trim()}
                              >
                                {savingRelationship ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Check className="h-3 w-3" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={handleCancelEditRelationship}
                                disabled={savingRelationship}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </>
                          ) : (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-destructive"
                              onClick={() => handleDeleteRelationship(rel.id)}
                              disabled={deletingRelationship === rel.id}
                            >
                              {deletingRelationship === rel.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex-shrink-0 pt-4 border-t">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={!isValid()}>
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
