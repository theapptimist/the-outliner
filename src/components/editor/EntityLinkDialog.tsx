import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { 
  Link, 
  ArrowRight, 
  Search, 
  FileText, 
  User, 
  MapPin, 
  Calendar, 
  Quote,
  Loader2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { loadAllUserEntities, EntityWithDocument } from '@/lib/cloudEntityQueries';
import { createEntityLink, areEntitiesLinked } from '@/lib/cloudEntityLinkStorage';
import { createEntityRelationship, COMMON_RELATIONSHIP_TYPES, getUserRelationshipTypes } from '@/lib/cloudEntityRelationshipStorage';
import { EntityType } from '@/lib/cloudEntityStorage';
import { useToast } from '@/hooks/use-toast';

interface EntityLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sourceEntity: {
    id: string;
    title: string;
    subtitle?: string;
    documentId: string;
  };
  entityType: 'people' | 'places' | 'dates' | 'terms';
  onLinkCreated?: () => void;
  onRelationshipCreated?: () => void;
}

const ENTITY_TYPE_MAP: Record<string, EntityType> = {
  people: 'person',
  places: 'place',
  dates: 'date',
  terms: 'term',
};

const ICON_MAP: Record<EntityType, typeof User> = {
  person: User,
  place: MapPin,
  date: Calendar,
  term: Quote,
};

const COLOR_MAP: Record<EntityType, string> = {
  person: 'text-purple-500',
  place: 'text-green-500',
  date: 'text-blue-500',
  term: 'text-amber-500',
};

export function EntityLinkDialog({
  open,
  onOpenChange,
  sourceEntity,
  entityType,
  onLinkCreated,
  onRelationshipCreated,
}: EntityLinkDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState<'identity' | 'relationship'>('identity');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<EntityWithDocument[]>([]);
  const [allEntities, setAllEntities] = useState<EntityWithDocument[]>([]);
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null);
  const [relationshipType, setRelationshipType] = useState('');
  const [customRelationType, setCustomRelationType] = useState('');
  const [relationshipDescription, setRelationshipDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadyLinked, setAlreadyLinked] = useState<Set<string>>(new Set());
  const [userRelationshipTypes, setUserRelationshipTypes] = useState<string[]>([]);

  const dbEntityType = ENTITY_TYPE_MAP[entityType];

  // Compute combined relationship types (common + user's custom types)
  const allRelationshipTypes: string[] = [...COMMON_RELATIONSHIP_TYPES];
  userRelationshipTypes.forEach(type => {
    if (!allRelationshipTypes.includes(type)) {
      allRelationshipTypes.push(type);
    }
  });

  // Load candidates when dialog opens
  useEffect(() => {
    if (!open || !user) return;

    const loadCandidates = async () => {
      setLoading(true);
      try {
        // For identity linking, load same entity type
        const sameType = await loadAllUserEntities(dbEntityType);
        // Filter out the source entity itself
        const filtered = sameType.filter(e => e.id !== sourceEntity.id);
        setCandidates(filtered);

        // For relationships, load all entities
        const allTypes = await Promise.all([
          loadAllUserEntities('person'),
          loadAllUserEntities('place'),
          loadAllUserEntities('date'),
          loadAllUserEntities('term'),
        ]);
        const all = allTypes.flat().filter(e => e.id !== sourceEntity.id);
        setAllEntities(all);

        // Check which are already linked
        const linkedSet = new Set<string>();
        for (const candidate of filtered) {
          const isLinked = await areEntitiesLinked(sourceEntity.id, candidate.id);
          if (isLinked) linkedSet.add(candidate.id);
        }
        setAlreadyLinked(linkedSet);

        // Load user's custom relationship types
        const customTypes = await getUserRelationshipTypes(user.id);
        setUserRelationshipTypes(customTypes);
      } catch (error) {
        console.error('Failed to load candidates:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCandidates();
  }, [open, user, sourceEntity.id, dbEntityType]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery('');
      setSelectedTargetId(null);
      setRelationshipType('');
      setCustomRelationType('');
      setRelationshipDescription('');
      setActiveTab('identity');
    }
  }, [open]);

  // Filter candidates based on search
  const getFilteredCandidates = useCallback(() => {
    const q = searchQuery.toLowerCase();
    return candidates.filter(c => {
      const name = getEntityName(c);
      const docTitle = c.document_title || '';
      return name.toLowerCase().includes(q) || docTitle.toLowerCase().includes(q);
    });
  }, [candidates, searchQuery]);

  const getFilteredAllEntities = useCallback(() => {
    const q = searchQuery.toLowerCase();
    return allEntities.filter(c => {
      const name = getEntityName(c);
      const docTitle = c.document_title || '';
      return name.toLowerCase().includes(q) || docTitle.toLowerCase().includes(q);
    });
  }, [allEntities, searchQuery]);

  const getEntityName = (entity: EntityWithDocument): string => {
    const data = entity.data;
    return (data.name || data.term || data.rawText || 'Unknown') as string;
  };

  const handleCreateLink = async () => {
    if (!selectedTargetId || !user) return;

    setIsSubmitting(true);
    try {
      const result = await createEntityLink(sourceEntity.id, selectedTargetId, user.id);
      if (result) {
        toast({
          title: 'Entities linked',
          description: 'These entities are now connected as the same identity.',
        });
        onLinkCreated?.();
        onOpenChange(false);
      } else {
        toast({
          title: 'Failed to link',
          description: 'Could not create the link. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating link:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRelationship = async () => {
    if (!selectedTargetId || !user) return;

    const finalRelationType = relationshipType === 'custom' ? customRelationType : relationshipType;
    if (!finalRelationType) {
      toast({
        title: 'Relationship type required',
        description: 'Please select or enter a relationship type.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await createEntityRelationship(
        sourceEntity.id,
        selectedTargetId,
        finalRelationType,
        user.id,
        relationshipDescription || undefined
      );
      if (result) {
        toast({
          title: 'Relationship created',
          description: `Connected "${sourceEntity.title}" → "${finalRelationType}" → target`,
        });
        onRelationshipCreated?.();
        onOpenChange(false);
      } else {
        toast({
          title: 'Failed to create relationship',
          description: 'Could not create the relationship. Please try again.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error creating relationship:', error);
      toast({
        title: 'Error',
        description: 'An unexpected error occurred.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTarget = activeTab === 'identity'
    ? candidates.find(c => c.id === selectedTargetId)
    : allEntities.find(c => c.id === selectedTargetId);

  const Icon = ICON_MAP[dbEntityType];
  const iconColor = COLOR_MAP[dbEntityType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-4 w-4" />
            Link Entity
          </DialogTitle>
          <DialogDescription>
            Connect "{sourceEntity.title}" with other entities
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'identity' | 'relationship')} className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="identity">Same Entity</TabsTrigger>
            <TabsTrigger value="relationship">Relationship</TabsTrigger>
          </TabsList>

          <TabsContent value="identity" className="flex-1 flex flex-col min-h-0 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Link this entity to the same real-world entity in another document.
            </p>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Candidates List */}
            <ScrollArea className="flex-1 border rounded-md">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : getFilteredCandidates().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {candidates.length === 0 
                    ? `No other ${entityType} found in your documents`
                    : 'No matches found'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {getFilteredCandidates().map((candidate) => {
                    const isLinked = alreadyLinked.has(candidate.id);
                    const isSelected = selectedTargetId === candidate.id;
                    
                    return (
                      <button
                        key={candidate.id}
                        onClick={() => !isLinked && setSelectedTargetId(isSelected ? null : candidate.id)}
                        disabled={isLinked}
                        className={cn(
                          "w-full text-left p-2 rounded-md transition-colors flex items-start gap-2",
                          isSelected && "bg-primary/10 ring-1 ring-primary",
                          !isSelected && !isLinked && "hover:bg-muted",
                          isLinked && "opacity-50 cursor-not-allowed"
                        )}
                      >
                        <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", iconColor)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {getEntityName(candidate)}
                            </span>
                            {isLinked && (
                              <Badge variant="secondary" className="text-[10px] shrink-0">
                                Already linked
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <FileText className="h-3 w-3" />
                            <span className="truncate">{candidate.document_title}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Preview */}
            {selectedTarget && !alreadyLinked.has(selectedTargetId!) && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-2">This will create an identity link:</p>
                <div className="flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded border">
                    <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    <span className="font-medium">{sourceEntity.title}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded border">
                    <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    <span className="font-medium">{getEntityName(selectedTarget)}</span>
                  </div>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="relationship" className="flex-1 flex flex-col min-h-0 mt-4">
            <p className="text-sm text-muted-foreground mb-3">
              Define how this entity relates to another entity.
            </p>

            {/* Relationship Type */}
            <div className="space-y-2 mb-3">
              <Label>Relationship Type</Label>
              <Select value={relationshipType} onValueChange={setRelationshipType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select relationship type..." />
                </SelectTrigger>
                <SelectContent>
                  {allRelationshipTypes.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                  <Separator className="my-1" />
                  <SelectItem value="custom">Custom...</SelectItem>
                </SelectContent>
              </Select>
              {relationshipType === 'custom' && (
                <Input
                  placeholder="Enter custom relationship type..."
                  value={customRelationType}
                  onChange={(e) => setCustomRelationType(e.target.value)}
                />
              )}
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search all entities..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* All Entities List */}
            <ScrollArea className="flex-1 border rounded-md">
              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : getFilteredAllEntities().length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  {allEntities.length === 0 
                    ? 'No entities found in your documents'
                    : 'No matches found'}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {getFilteredAllEntities().map((entity) => {
                    const entityIcon = ICON_MAP[entity.entity_type];
                    const entityColor = COLOR_MAP[entity.entity_type];
                    const isSelected = selectedTargetId === entity.id;
                    
                    return (
                      <button
                        key={entity.id}
                        onClick={() => setSelectedTargetId(isSelected ? null : entity.id)}
                        className={cn(
                          "w-full text-left p-2 rounded-md transition-colors flex items-start gap-2",
                          isSelected && "bg-primary/10 ring-1 ring-primary",
                          !isSelected && "hover:bg-muted"
                        )}
                      >
                        {(() => {
                          const EntityIcon = entityIcon;
                          return <EntityIcon className={cn("h-4 w-4 mt-0.5 shrink-0", entityColor)} />;
                        })()}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm truncate">
                              {getEntityName(entity)}
                            </span>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {entity.entity_type}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                            <FileText className="h-3 w-3" />
                            <span className="truncate">{entity.document_title}</span>
                          </div>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Description */}
            <div className="mt-3 space-y-2">
              <Label>Description (optional)</Label>
              <Input
                placeholder="Add a note about this relationship..."
                value={relationshipDescription}
                onChange={(e) => setRelationshipDescription(e.target.value)}
              />
            </div>

            {/* Preview */}
            {selectedTarget && (relationshipType || customRelationType) && (
              <div className="mt-3 p-3 bg-muted/50 rounded-md">
                <p className="text-xs text-muted-foreground mb-2">This will create a relationship:</p>
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded border">
                    <Icon className={cn("h-3.5 w-3.5", iconColor)} />
                    <span className="font-medium">{sourceEntity.title}</span>
                  </div>
                  <Badge variant="secondary">
                    {relationshipType === 'custom' ? customRelationType : relationshipType}
                  </Badge>
                  {(() => {
                    const TargetIcon = ICON_MAP[selectedTarget.entity_type];
                    const targetColor = COLOR_MAP[selectedTarget.entity_type];
                    return (
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-background rounded border">
                        <TargetIcon className={cn("h-3.5 w-3.5", targetColor)} />
                        <span className="font-medium">{getEntityName(selectedTarget)}</span>
                      </div>
                    );
                  })()}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          {activeTab === 'identity' ? (
            <Button
              onClick={handleCreateLink}
              disabled={!selectedTargetId || alreadyLinked.has(selectedTargetId) || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Linking...
                </>
              ) : (
                <>
                  <Link className="h-4 w-4 mr-2" />
                  Link Entities
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={handleCreateRelationship}
              disabled={!selectedTargetId || (!relationshipType && !customRelationType) || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Create Relationship
                </>
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
