import { useState, useCallback, useMemo, useEffect } from 'react';
import { 
  User, 
  MapPin, 
  Calendar, 
  Quote, 
  Search,
  Library,
  Users,
  Globe,
  Download,
  Loader2,
  ExternalLink,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useMasterEntities, MasterEntity, EntityType } from '@/hooks/useMasterEntities';
import { useEntityPermissions } from '@/hooks/useEntityPermissions';
import { usePublicEntities } from '@/hooks/usePublicEntities';
import { useDocumentContext } from './context';
import { useToast } from '@/hooks/use-toast';

type MasterLibraryTab = 'my-library' | 'shared' | 'public';

interface MasterLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ENTITY_ICONS = {
  people: User,
  places: MapPin,
  dates: Calendar,
  terms: Quote,
};

const ENTITY_COLORS = {
  people: 'text-purple-500',
  places: 'text-emerald-500',
  dates: 'text-blue-500',
  terms: 'text-amber-500',
};

// Entity card for master library view
interface MasterEntityCardProps {
  entity: MasterEntity;
  onImport?: () => void;
  isImporting?: boolean;
  showSource?: boolean;
  sourceLabel?: string;
}

function MasterEntityCard({ entity, onImport, isImporting, showSource, sourceLabel }: MasterEntityCardProps) {
  const Icon = ENTITY_ICONS[entity.entity_type];
  const iconColor = ENTITY_COLORS[entity.entity_type];
  
  const getName = () => {
    const data = entity.data;
    switch (entity.entity_type) {
      case 'people': return data.name || 'Unnamed Person';
      case 'places': return data.name || 'Unnamed Place';
      case 'dates': return data.rawText || data.date || 'Unknown Date';
      case 'terms': return data.term || 'Untitled Term';
    }
  };
  
  const getSubtitle = () => {
    const data = entity.data;
    switch (entity.entity_type) {
      case 'people': return data.role || data.description;
      case 'places': return data.significance;
      case 'dates': return data.description;
      case 'terms': return data.definition;
    }
  };

  return (
    <div className={cn(
      "group p-2.5 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors",
      "flex items-start gap-2.5"
    )}>
      <div className={cn("mt-0.5 p-1.5 rounded-md bg-muted", iconColor)}>
        <Icon className="h-4 w-4" />
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-medium truncate">{getName()}</div>
            {getSubtitle() && (
              <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {getSubtitle()}
              </div>
            )}
            {showSource && sourceLabel && (
              <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                <ExternalLink className="h-2.5 w-2.5" />
                {sourceLabel}
              </div>
            )}
          </div>
          
          {onImport && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={onImport}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <>
                      <Download className="h-3.5 w-3.5 mr-1" />
                      <span className="text-xs">Import</span>
                    </>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Add to current document</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

// Tab content component
interface LibraryTabContentProps {
  scope: MasterLibraryTab;
  searchQuery: string;
  entityTypeFilter?: EntityType;
}

function LibraryTabContent({ scope, searchQuery, entityTypeFilter }: LibraryTabContentProps) {
  const { document: currentDocument } = useDocumentContext();
  const documentId = currentDocument?.meta?.id || '';
  const { toast } = useToast();
  
  const [importingId, setImportingId] = useState<string | null>(null);
  
  const { 
    entities: ownedEntities, 
    loading: loadingOwned,
    fetchSharedEntities,
  } = useMasterEntities({ entityType: entityTypeFilter, includeShared: scope === 'shared' });
  
  const { 
    publicEntities, 
    loading: loadingPublic,
    importToDocument,
  } = usePublicEntities({ entityType: entityTypeFilter });
  
  const [sharedEntities, setSharedEntities] = useState<MasterEntity[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  
  useEffect(() => {
    if (scope === 'shared') {
      setLoadingShared(true);
      fetchSharedEntities()
        .then(shared => setSharedEntities(shared))
        .finally(() => setLoadingShared(false));
    }
  }, [scope, fetchSharedEntities]);
  
  const getEntities = (): MasterEntity[] => {
    switch (scope) {
      case 'my-library': return ownedEntities;
      case 'shared': return sharedEntities;
      case 'public': return publicEntities.map(pe => pe.entity);
    }
  };
  
  const isLoading = scope === 'my-library' ? loadingOwned 
    : scope === 'shared' ? loadingShared 
    : loadingPublic;
  
  const filteredEntities = useMemo(() => {
    const entities = getEntities();
    if (!searchQuery.trim()) return entities;
    
    const q = searchQuery.toLowerCase();
    return entities.filter(entity => {
      const data = entity.data;
      const name = data.name || data.term || data.rawText || '';
      const subtitle = data.role || data.definition || data.description || data.significance || '';
      return name.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q);
    });
  }, [scope, ownedEntities, sharedEntities, publicEntities, searchQuery, entityTypeFilter]);
  
  const handleImport = async (entity: MasterEntity) => {
    if (!documentId) {
      toast({ title: 'No document open', variant: 'destructive' });
      return;
    }
    
    setImportingId(entity.id);
    try {
      const success = await importToDocument(entity.id, documentId);
      if (success) {
        toast({ title: 'Entity added to document' });
      }
    } finally {
      setImportingId(null);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (filteredEntities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        {scope === 'my-library' && (
          <>
            <Library className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">Your library is empty</p>
            <p className="text-xs mt-1 text-center max-w-[200px]">
              Save entities from your documents to reuse them across projects
            </p>
          </>
        )}
        {scope === 'shared' && (
          <>
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No shared entities</p>
            <p className="text-xs mt-1 text-center max-w-[200px]">
              Entities shared with you by collaborators will appear here
            </p>
          </>
        )}
        {scope === 'public' && (
          <>
            <Globe className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm font-medium">No public templates</p>
            <p className="text-xs mt-1 text-center max-w-[200px]">
              Community-contributed entity templates will appear here
            </p>
          </>
        )}
      </div>
    );
  }
  
  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-2 p-1">
        {filteredEntities.map(entity => (
          <MasterEntityCard
            key={entity.id}
            entity={entity}
            onImport={() => handleImport(entity)}
            isImporting={importingId === entity.id}
            showSource={scope === 'public'}
            sourceLabel={scope === 'public' ? 'Community' : undefined}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

export function MasterLibraryDialog({ open, onOpenChange }: MasterLibraryDialogProps) {
  const [activeTab, setActiveTab] = useState<MasterLibraryTab>('my-library');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<EntityType | undefined>(undefined);
  
  // Get counts for badges
  const { entities: masterEntities } = useMasterEntities();
  const { publicEntities } = usePublicEntities();
  const { getSharedWithMe } = useEntityPermissions();
  const [sharedCount, setSharedCount] = useState(0);
  
  useEffect(() => {
    if (open) {
      getSharedWithMe().then(ids => setSharedCount(ids.length));
    }
  }, [open, getSharedWithMe]);

  const entityTypes: { type: EntityType | undefined; icon: typeof User; label: string }[] = [
    { type: undefined, icon: Library, label: 'All' },
    { type: 'people', icon: User, label: 'People' },
    { type: 'places', icon: MapPin, label: 'Places' },
    { type: 'dates', icon: Calendar, label: 'Dates' },
    { type: 'terms', icon: Quote, label: 'Terms' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Library className="h-5 w-5" />
            Master Library
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MasterLibraryTab)} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="my-library" className="flex items-center gap-1.5">
              <Library className="h-3.5 w-3.5" />
              <span>My Library</span>
              {masterEntities.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {masterEntities.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="shared" className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              <span>Shared</span>
              {sharedCount > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {sharedCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="public" className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              <span>Public</span>
              {publicEntities.length > 0 && (
                <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                  {publicEntities.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
          
          {/* Search and filter bar */}
          <div className="flex items-center gap-2 mt-4">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entities..."
                className="pl-9"
              />
            </div>
            
            {/* Entity type filter */}
            <div className="flex items-center gap-0.5 p-1 bg-muted rounded-md">
              {entityTypes.map(({ type, icon: Icon, label }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setEntityFilter(type)}
                      className={cn(
                        "h-7 w-7 rounded flex items-center justify-center transition-colors",
                        entityFilter === type 
                          ? "bg-background shadow-sm text-foreground" 
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-xs">{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
          
          <div className="flex-1 mt-4">
            <TabsContent value="my-library" className="mt-0 h-full">
              <LibraryTabContent 
                scope="my-library" 
                searchQuery={searchQuery}
                entityTypeFilter={entityFilter}
              />
            </TabsContent>
            <TabsContent value="shared" className="mt-0 h-full">
              <LibraryTabContent 
                scope="shared" 
                searchQuery={searchQuery}
                entityTypeFilter={entityFilter}
              />
            </TabsContent>
            <TabsContent value="public" className="mt-0 h-full">
              <LibraryTabContent 
                scope="public" 
                searchQuery={searchQuery}
                entityTypeFilter={entityFilter}
              />
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
