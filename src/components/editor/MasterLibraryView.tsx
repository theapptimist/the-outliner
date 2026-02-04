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
  Plus,
  Download,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useMasterEntities, MasterEntity, EntityType } from '@/hooks/useMasterEntities';
import { useEntityPermissions } from '@/hooks/useEntityPermissions';
import { usePublicEntities, PublicEntityWithData } from '@/hooks/usePublicEntities';
import { useDocumentContext } from './context';
import { useToast } from '@/hooks/use-toast';

export type LibraryScope = 'document' | 'my-library' | 'shared' | 'public';

interface LibraryScopeSelectorProps {
  activeScope: LibraryScope;
  onScopeChange: (scope: LibraryScope) => void;
  counts: {
    document: number;
    myLibrary: number;
    shared: number;
    public: number;
  };
}

const SCOPE_CONFIG: { id: LibraryScope; icon: typeof Library; label: string; description: string }[] = [
  { id: 'document', icon: Quote, label: 'Document', description: 'Entities in this document' },
  { id: 'my-library', icon: Library, label: 'My Library', description: 'Your personal entity library' },
  { id: 'shared', icon: Users, label: 'Shared', description: 'Shared with you' },
  { id: 'public', icon: Globe, label: 'Public', description: 'Community templates' },
];

export function LibraryScopeSelector({ activeScope, onScopeChange, counts }: LibraryScopeSelectorProps) {
  return (
    <div className="flex items-center gap-0.5 px-1 py-1 border-b border-border/30 bg-muted/10">
      {SCOPE_CONFIG.map(scope => (
        <Tooltip key={scope.id}>
          <TooltipTrigger asChild>
            <button
              data-allow-pointer
              onClick={() => onScopeChange(scope.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors",
                activeScope === scope.id 
                  ? "bg-primary/15 text-primary font-medium" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <scope.icon className="h-3 w-3" />
              <span className="hidden sm:inline">{scope.label}</span>
              {counts[scope.id === 'my-library' ? 'myLibrary' : scope.id] > 0 && (
                <Badge variant="secondary" className="h-4 px-1 text-[10px] font-medium">
                  {counts[scope.id === 'my-library' ? 'myLibrary' : scope.id]}
                </Badge>
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">{scope.description}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

// Entity card for master library view
interface MasterEntityCardProps {
  entity: MasterEntity;
  onImport?: () => void;
  isImporting?: boolean;
  showSource?: boolean;
  sourceLabel?: string;
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

function MasterEntityCard({ entity, onImport, isImporting, showSource, sourceLabel }: MasterEntityCardProps) {
  const Icon = ENTITY_ICONS[entity.entity_type];
  const iconColor = ENTITY_COLORS[entity.entity_type];
  
  // Extract display name based on entity type
  const getName = () => {
    const data = entity.data;
    switch (entity.entity_type) {
      case 'people':
        return data.name || 'Unnamed Person';
      case 'places':
        return data.name || 'Unnamed Place';
      case 'dates':
        return data.rawText || data.date || 'Unknown Date';
      case 'terms':
        return data.term || 'Untitled Term';
    }
  };
  
  const getSubtitle = () => {
    const data = entity.data;
    switch (entity.entity_type) {
      case 'people':
        return data.role || data.description;
      case 'places':
        return data.significance;
      case 'dates':
        return data.description;
      case 'terms':
        return data.definition;
    }
  };

  return (
    <div className={cn(
      "group p-2 rounded-md border border-border/30 bg-card/50 hover:bg-card transition-colors",
      "flex items-start gap-2"
    )}>
      <div className={cn("mt-0.5 p-1 rounded bg-muted/50", iconColor)}>
        <Icon className="h-3.5 w-3.5" />
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
                  data-allow-pointer
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={onImport}
                  disabled={isImporting}
                >
                  {isImporting ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Download className="h-3 w-3" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="left" className="text-xs">Add to document</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </div>
  );
}

// Master Library View component
interface MasterLibraryViewProps {
  scope: 'my-library' | 'shared' | 'public';
  entityTypeFilter?: EntityType;
  searchQuery: string;
}

export function MasterLibraryView({ scope, entityTypeFilter, searchQuery }: MasterLibraryViewProps) {
  const { document: currentDocument } = useDocumentContext();
  const documentId = currentDocument?.meta?.id || '';
  const { toast } = useToast();
  
  const [importingId, setImportingId] = useState<string | null>(null);
  
  // Hooks for different scopes
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
  
  const { getSharedWithMe } = useEntityPermissions();
  
  // Get shared entities
  const [sharedEntities, setSharedEntities] = useState<MasterEntity[]>([]);
  const [loadingShared, setLoadingShared] = useState(false);
  
  // Load shared entities when scope is 'shared'
  useEffect(() => {
    if (scope === 'shared') {
      setLoadingShared(true);
      fetchSharedEntities()
        .then(shared => setSharedEntities(shared))
        .finally(() => setLoadingShared(false));
    }
  }, [scope, fetchSharedEntities]);
  
  // Get entities based on scope
  const getEntities = (): MasterEntity[] => {
    switch (scope) {
      case 'my-library':
        return ownedEntities;
      case 'shared':
        return sharedEntities;
      case 'public':
        return publicEntities.map(pe => pe.entity);
    }
  };
  
  const isLoading = scope === 'my-library' ? loadingOwned 
    : scope === 'shared' ? loadingShared 
    : loadingPublic;
  
  // Filter entities
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
  
  // Handle import to document
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  
  if (filteredEntities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        {scope === 'my-library' && (
          <>
            <Library className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">Your library is empty</p>
            <p className="text-xs mt-1">Save entities to your library to reuse across documents</p>
          </>
        )}
        {scope === 'shared' && (
          <>
            <Users className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No shared entities</p>
            <p className="text-xs mt-1">Entities shared with you will appear here</p>
          </>
        )}
        {scope === 'public' && (
          <>
            <Globe className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">No public templates yet</p>
            <p className="text-xs mt-1">Community templates will appear here</p>
          </>
        )}
      </div>
    );
  }
  
  return (
    <ScrollArea className="flex-1">
      <div className="space-y-1.5 p-2">
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
