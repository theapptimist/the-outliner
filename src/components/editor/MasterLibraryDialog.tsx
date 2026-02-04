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
  Upload,
  CheckCircle,
  FileText,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useMasterLibraryDocuments } from '@/hooks/useMasterLibraryDocuments';
import { useDocumentContext } from './context';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { checkMigrationNeeded, migrateDocumentEntitiesToMaster, backfillSourceDocumentIds } from '@/lib/masterEntityMigration';

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
  selectedDocumentIds: Set<string>;
}

function LibraryTabContent({ scope, searchQuery, entityTypeFilter, selectedDocumentIds }: LibraryTabContentProps) {
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
    let entities = getEntities();
    
    // Filter by selected documents (only for my-library)
    if (scope === 'my-library' && selectedDocumentIds.size > 0) {
      entities = entities.filter(e => 
        e.source_document_id && selectedDocumentIds.has(e.source_document_id)
      );
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      entities = entities.filter(entity => {
        const data = entity.data;
        const name = data.name || data.term || data.rawText || '';
        const subtitle = data.role || data.definition || data.description || data.significance || '';
        return name.toLowerCase().includes(q) || subtitle.toLowerCase().includes(q);
      });
    }
    
    return entities;
  }, [scope, ownedEntities, sharedEntities, publicEntities, searchQuery, entityTypeFilter, selectedDocumentIds]);
  
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
              {searchQuery ? 'No entities match your search' : 'Entities you create will automatically appear here'}
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
    <div className="h-full overflow-auto p-3">
      <div className="space-y-2">
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
    </div>
  );
}

export function MasterLibraryDialog({ open, onOpenChange }: MasterLibraryDialogProps) {
  const [activeTab, setActiveTab] = useState<MasterLibraryTab>('my-library');
  const [searchQuery, setSearchQuery] = useState('');
  const [entityFilter, setEntityFilter] = useState<EntityType | undefined>(undefined);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedDocumentIds, setSelectedDocumentIds] = useState<Set<string>>(new Set());
  
  // Document explorer
  const { documents: libraryDocuments, loading: loadingDocs, refresh: refreshDocs } = useMasterLibraryDocuments();
  
  // Migration state
  const { user } = useAuth();
  const { toast } = useToast();
  const [migrationInfo, setMigrationInfo] = useState<{ needed: boolean; count: number; backfillNeeded: boolean; backfillCount: number } | null>(null);
  const [isMigrating, setIsMigrating] = useState(false);
  const [isBackfilling, setIsBackfilling] = useState(false);
  const [migrationComplete, setMigrationComplete] = useState(false);
  
  // Get counts for badges
  const { entities: masterEntities, refresh: refreshMaster } = useMasterEntities();
  const { publicEntities } = usePublicEntities();
  const { getSharedWithMe } = useEntityPermissions();
  const [sharedCount, setSharedCount] = useState(0);
  
  // Check if migration is needed when dialog opens
  useEffect(() => {
    if (open && user?.id && !migrationComplete) {
      checkMigrationNeeded(user.id).then(result => {
        setMigrationInfo({
          needed: result.needed,
          count: result.documentEntityCount,
          backfillNeeded: result.backfillNeeded,
          backfillCount: result.backfillCount,
        });
      });
    }
  }, [open, user?.id, migrationComplete]);
  
  useEffect(() => {
    if (open) {
      getSharedWithMe().then(ids => setSharedCount(ids.length));
    }
  }, [open, getSharedWithMe]);
  
  const handleMigration = async () => {
    if (!user?.id) return;
    
    setIsMigrating(true);
    try {
      const result = await migrateDocumentEntitiesToMaster(user.id);
      if (result.success) {
        toast({
          title: 'Migration complete',
          description: `${result.migratedCount} entities imported to Master Library${result.skippedCount > 0 ? ` (${result.skippedCount} duplicates skipped)` : ''}`,
        });
        setMigrationComplete(true);
        setMigrationInfo(null);
        refreshMaster();
        refreshDocs();
      } else {
        toast({
          title: 'Migration failed',
          description: result.errors[0] || 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setIsMigrating(false);
    }
  };

  const handleBackfill = async () => {
    if (!user?.id) return;
    
    setIsBackfilling(true);
    try {
      const result = await backfillSourceDocumentIds(user.id);
      if (result.success) {
        toast({
          title: 'Backfill complete',
          description: `${result.updatedCount} entities linked to their source documents`,
        });
        setMigrationInfo(prev => prev ? { ...prev, backfillNeeded: false, backfillCount: 0 } : null);
        refreshDocs();
      } else {
        toast({
          title: 'Backfill failed',
          description: result.errors[0] || 'Unknown error',
          variant: 'destructive',
        });
      }
    } finally {
      setIsBackfilling(false);
    }
  };

  const entityTypes: { type: EntityType | undefined; icon: typeof User; label: string; color?: string }[] = [
    { type: undefined, icon: Library, label: 'All' },
    { type: 'people', icon: User, label: 'People', color: 'text-purple-500' },
    { type: 'places', icon: MapPin, label: 'Places', color: 'text-emerald-500' },
    { type: 'dates', icon: Calendar, label: 'Dates', color: 'text-blue-500' },
    { type: 'terms', icon: Quote, label: 'Terms', color: 'text-amber-500' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col p-0 gap-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as MasterLibraryTab)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <DialogHeader className="px-4 py-3 border-b shrink-0">
            <div className="flex items-center justify-between pr-8">
              <DialogTitle className="flex items-center gap-2">
                <Library className="h-5 w-5" />
                Master Library
              </DialogTitle>
              
              <TabsList className="h-9 bg-muted p-1">
                <TabsTrigger value="my-library" className="h-7 px-4 text-sm font-medium flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Library className="h-3.5 w-3.5" />
                  <span>My Library</span>
                  {masterEntities.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {masterEntities.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="shared" className="h-7 px-4 text-sm font-medium flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Users className="h-3.5 w-3.5" />
                  <span>Shared</span>
                  {sharedCount > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {sharedCount}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="public" className="h-7 px-4 text-sm font-medium flex items-center gap-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                  <Globe className="h-3.5 w-3.5" />
                  <span>Public</span>
                  {publicEntities.length > 0 && (
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
                      {publicEntities.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>
          </DialogHeader>
          
          <div className="flex flex-1 min-h-0">
            {/* Vertical Tool Strip */}
            <div className="flex flex-col items-center gap-1 px-1.5 py-2 border-r border-border/30 bg-muted/20 shrink-0">
              {/* Search Toggle */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setSearchOpen(!searchOpen)}
                    className={cn(
                      "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                      searchOpen 
                        ? "bg-primary/20 text-primary" 
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                    )}
                  >
                    <Search className="h-4 w-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="text-xs">Search</TooltipContent>
              </Tooltip>
              
              {/* Divider */}
              <div className="h-px w-5 bg-border/50 my-1" />
              
              {/* Entity Type Filters */}
              {entityTypes.map(({ type, icon: Icon, label, color }) => (
                <Tooltip key={label}>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setEntityFilter(type)}
                      className={cn(
                        "h-8 w-8 rounded-md flex items-center justify-center transition-colors",
                        entityFilter === type 
                          ? "bg-accent/20 text-foreground" 
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <Icon className={cn("h-4 w-4", entityFilter === type && color)} />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="text-xs">{label}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            
            {/* Document Explorer Strip - Always show for My Library tab */}
            {activeTab === 'my-library' && (
              <div className="w-48 flex flex-col border-r border-border/30 bg-muted/10 shrink-0 min-h-0 overflow-hidden">
                <div className="px-3 py-2 border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                      Documents
                    </span>
                    {selectedDocumentIds.size > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-5 px-1.5 text-[10px]"
                        onClick={() => setSelectedDocumentIds(new Set())}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                </div>
                <ScrollArea className="flex-1 min-h-0">
                  <div className="p-2 space-y-0.5">
                    {libraryDocuments.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <FileText className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-xs text-center">No documents with entities yet</p>
                      </div>
                    ) : (
                      <>
                        {/* Select All */}
                        <button
                          onClick={() => {
                            if (selectedDocumentIds.size === libraryDocuments.length) {
                              setSelectedDocumentIds(new Set());
                            } else {
                              setSelectedDocumentIds(new Set(libraryDocuments.map(d => d.id)));
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors",
                            selectedDocumentIds.size === libraryDocuments.length
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                            selectedDocumentIds.size === libraryDocuments.length
                              ? "bg-primary border-primary"
                              : "border-border"
                          )}>
                            {selectedDocumentIds.size === libraryDocuments.length && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <span className="font-medium">All Documents</span>
                        </button>
                        
                        <div className="h-px bg-border/50 my-1.5" />
                        
                        {loadingDocs ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          libraryDocuments.map(doc => (
                            <button
                              key={doc.id}
                              onClick={() => {
                                setSelectedDocumentIds(prev => {
                                  const next = new Set(prev);
                                  if (next.has(doc.id)) {
                                    next.delete(doc.id);
                                  } else {
                                    next.add(doc.id);
                                  }
                                  return next;
                                });
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors group",
                                selectedDocumentIds.has(doc.id)
                                  ? "bg-primary/10 text-foreground"
                                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
                              )}
                            >
                              <div className={cn(
                                "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                                selectedDocumentIds.has(doc.id)
                                  ? "bg-primary border-primary"
                                  : "border-border"
                              )}>
                                {selectedDocumentIds.has(doc.id) && (
                                  <Check className="h-3 w-3 text-primary-foreground" />
                                )}
                              </div>
                              <FileText className="h-3 w-3 shrink-0 opacity-50" />
                              <span className="truncate flex-1">{doc.title}</span>
                              <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">
                                {doc.entityCount}
                              </Badge>
                            </button>
                          ))
                        )}
                      </>
                    )}
                  </div>
                </ScrollArea>
              </div>
            )}
            
            {/* Main Content Area */}
            <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">
              {/* Expandable Search Bar */}
              {searchOpen && (
                <div className="flex items-center gap-2 px-3 py-2 border-b border-border/30 bg-muted/10">
                  <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search entities..."
                    className="h-8 text-sm"
                    autoFocus
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 shrink-0"
                    onClick={() => {
                      setSearchOpen(false);
                      setSearchQuery('');
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
              
              {/* Migration Banner */}
              {migrationInfo?.needed && !migrationComplete && activeTab === 'my-library' && (
                <div className="mx-3 my-2 p-3 rounded-lg border border-primary/30 bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Upload className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Import existing entities
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Found {migrationInfo.count} entities in your documents. Import them to your Master Library for easy reuse across all projects.
                      </p>
                      <Button
                        size="sm"
                        className="mt-2 h-7"
                        onClick={handleMigration}
                        disabled={isMigrating}
                      >
                        {isMigrating ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Importing...
                          </>
                        ) : (
                          <>
                            <Upload className="h-3.5 w-3.5 mr-1.5" />
                            Import All Entities
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Backfill Banner - for entities migrated before source_document_id tracking */}
              {migrationInfo?.backfillNeeded && !migrationInfo?.needed && activeTab === 'my-library' && (
                <div className="mx-3 my-2 p-3 rounded-lg border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-start gap-3">
                    <FileText className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        Link entities to documents
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {migrationInfo.backfillCount} entities need to be linked to their source documents for filtering.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7"
                        onClick={handleBackfill}
                        disabled={isBackfilling}
                      >
                        {isBackfilling ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                            Linking...
                          </>
                        ) : (
                          <>
                            <FileText className="h-3.5 w-3.5 mr-1.5" />
                            Link to Documents
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Migration Complete Message */}
              {migrationComplete && activeTab === 'my-library' && (
                <div className="mx-3 my-2 p-3 rounded-lg border border-success/30 bg-success/5">
                  <div className="flex items-center gap-2 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-sm">Entities imported successfully!</span>
                  </div>
                </div>
              )}
              
              {/* Tab Content */}
              <TabsContent value="my-library" className="mt-0 flex-1 min-h-0 overflow-hidden">
                <LibraryTabContent 
                  scope="my-library" 
                  searchQuery={searchQuery}
                  entityTypeFilter={entityFilter}
                  selectedDocumentIds={selectedDocumentIds}
                />
              </TabsContent>
              <TabsContent value="shared" className="mt-0 flex-1 min-h-0 overflow-hidden">
                <LibraryTabContent 
                  scope="shared" 
                  searchQuery={searchQuery}
                  entityTypeFilter={entityFilter}
                  selectedDocumentIds={selectedDocumentIds}
                />
              </TabsContent>
              <TabsContent value="public" className="mt-0 flex-1 min-h-0 overflow-hidden">
                <LibraryTabContent 
                  scope="public" 
                  searchQuery={searchQuery}
                  entityTypeFilter={entityFilter}
                  selectedDocumentIds={selectedDocumentIds}
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
