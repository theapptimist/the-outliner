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
  Folder,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { FolderPlus, MoreHorizontal, FolderInput } from 'lucide-react';
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useMasterEntities, MasterEntity, EntityType } from '@/hooks/useMasterEntities';
import { useEntityPermissions } from '@/hooks/useEntityPermissions';
import { usePublicEntities } from '@/hooks/usePublicEntities';
import { useMasterLibraryDocuments } from '@/hooks/useMasterLibraryDocuments';
import { supabase } from '@/integrations/supabase/client';
import { useDocumentFolders, FolderWithChildren } from '@/hooks/useDocumentFolders';
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
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  
  // Document and folder data
  const { documents: libraryDocuments, loading: loadingDocs, refresh: refreshDocs } = useMasterLibraryDocuments();
  const { folders, buildFolderTree, loading: loadingFolders } = useDocumentFolders();
  const { createFolder, moveDocumentToFolder } = useDocumentFolders();
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  
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
  
  // All documents state (not just library docs)
  const [allDocuments, setAllDocuments] = useState<Array<{id: string; title: string; folder_id: string | null; entityCount: number}>>([]);
  const [loadingAllDocs, setLoadingAllDocs] = useState(false);
  
  // Fetch all user documents when dialog opens
  useEffect(() => {
    if (!open || !user?.id) return;
    
    setLoadingAllDocs(true);
    supabase
      .from('documents')
      .select('id, title, folder_id')
      .eq('user_id', user.id)
      .order('title')
      .then(({ data, error }) => {
        if (error) {
          console.error('[MasterLibrary] Error fetching documents:', error);
          setAllDocuments([]);
        } else {
          // Merge with library docs to get entity counts
          const docsWithCounts = (data || []).map(doc => {
            const libraryDoc = libraryDocuments.find(ld => ld.id === doc.id);
            return {
              id: doc.id,
              title: doc.title,
              folder_id: doc.folder_id,
              entityCount: libraryDoc?.entityCount || 0,
            };
          });
          setAllDocuments(docsWithCounts);
        }
        setLoadingAllDocs(false);
      });
  }, [open, user?.id, libraryDocuments]);
  
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

  // Build folder tree with documents
  const folderTree = useMemo(() => buildFolderTree(null), [buildFolderTree]);
  
  // Get ALL documents grouped by folder (not just library docs)
  const documentsByFolder = useMemo(() => {
    const map = new Map<string | null, typeof allDocuments>();
    allDocuments.forEach(doc => {
      const folderId = doc.folder_id || null;
      if (!map.has(folderId)) {
        map.set(folderId, []);
      }
      map.get(folderId)!.push(doc);
    });
    return map;
  }, [allDocuments]);

  const toggleFolderExpanded = (folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  // Render folder with its documents recursively
  const renderFolderWithDocs = (folder: FolderWithChildren, depth: number = 0) => {
    const isExpanded = expandedFolders.has(folder.id);
    const folderDocs = documentsByFolder.get(folder.id) || [];
    const hasContent = folderDocs.length > 0 || folder.children.length > 0;
    
    return (
      <div key={folder.id}>
        <button
          onClick={() => toggleFolderExpanded(folder.id)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          style={{ paddingLeft: `${8 + depth * 12}px` }}
        >
          {isExpanded ? (
            <ChevronDown className="h-3 w-3 shrink-0" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0" />
          )}
          <Folder className={cn("h-3 w-3 shrink-0", isExpanded ? "text-warning" : "")} />
          <span className="flex-1 truncate font-medium">{folder.name}</span>
          <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">
            {folderDocs.reduce((sum, d) => sum + d.entityCount, 0)}
          </Badge>
        </button>
        
        {isExpanded && hasContent && (
          <div>
            {/* Child folders */}
            {folder.children.map(child => renderFolderWithDocs(child, depth + 1))}
            
            {/* Documents in this folder */}
            {folderDocs.map(doc => renderDocItem(doc, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Documents without a folder
  const unfolderedDocs = documentsByFolder.get(null) || [];
  
  // Handle moving document to folder
  const handleMoveToFolder = async (docId: string, folderId: string | null) => {
    const success = await moveDocumentToFolder(docId, folderId);
    if (success) {
      toast({
        title: "Document moved",
        description: folderId ? "Document moved to folder" : "Document moved to root",
      });
      refreshDocs();
      // Also update allDocuments state directly
      setAllDocuments(prev => prev.map(doc => 
        doc.id === docId ? { ...doc, folder_id: folderId } : doc
      ));
    } else {
      toast({
        title: "Error",
        description: "Failed to move document",
        variant: "destructive",
      });
    }
  };
  
  // Render a document item with move-to-folder dropdown
  const renderDocItem = (doc: { id: string; title: string; entityCount: number; folder_id: string | null }, depth: number = 0) => (
    <div
      key={doc.id}
      className={cn(
        "flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors group",
        selectedDocumentIds.has(doc.id)
          ? "bg-primary/10 text-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
      style={{ paddingLeft: `${8 + depth * 12}px` }}
    >
      <button
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
        className="flex items-center gap-2 flex-1 min-w-0 text-left"
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
        <span className="flex-1 break-words leading-tight truncate">{doc.title}</span>
      </button>
      <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">
        {doc.entityCount}
      </Badge>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button 
            onClick={(e) => e.stopPropagation()}
            className="h-5 w-5 flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity rounded hover:bg-muted-foreground/20"
            title="Move to folder"
          >
            <FolderInput className="h-3 w-3" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem 
            onClick={() => handleMoveToFolder(doc.id, null)}
            disabled={doc.folder_id === null}
          >
            <FileText className="h-3.5 w-3.5 mr-2" />
            No Folder (Root)
          </DropdownMenuItem>
          {folderTree.length > 0 && <DropdownMenuSeparator />}
          {folderTree.map(folder => (
            <DropdownMenuItem 
              key={folder.id}
              onClick={() => handleMoveToFolder(doc.id, folder.id)}
              disabled={doc.folder_id === folder.id}
              className={doc.folder_id === folder.id ? "bg-muted" : ""}
            >
              <Folder className="h-3.5 w-3.5 mr-2" />
              {folder.name}
              {doc.folder_id === folder.id && (
                <Check className="h-3 w-3 ml-auto text-primary" />
              )}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
  
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
                    {/* New Folder Button */}
                    {creatingFolder ? (
                      <div className="flex items-center gap-1 px-2 py-1">
                        <Input
                          value={newFolderName}
                          onChange={(e) => setNewFolderName(e.target.value)}
                          onKeyDown={async (e) => {
                            if (e.key === 'Enter' && newFolderName.trim()) {
                              await createFolder(newFolderName.trim());
                              setNewFolderName('');
                              setCreatingFolder(false);
                            }
                            if (e.key === 'Escape') {
                              setNewFolderName('');
                              setCreatingFolder(false);
                            }
                          }}
                          placeholder="Folder name..."
                          className="h-6 text-xs flex-1"
                          autoFocus
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={async () => {
                            if (newFolderName.trim()) {
                              await createFolder(newFolderName.trim());
                              setNewFolderName('');
                              setCreatingFolder(false);
                            }
                          }}
                        >
                          <Check className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0"
                          onClick={() => {
                            setNewFolderName('');
                            setCreatingFolder(false);
                          }}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setCreatingFolder(true)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                      >
                        <FolderPlus className="h-3.5 w-3.5" />
                        <span>New Folder</span>
                      </button>
                    )}
                    
                    <div className="h-px bg-border/50 my-1.5" />
                    
                    {allDocuments.length === 0 && folderTree.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-6 text-muted-foreground">
                        <FileText className="h-8 w-8 mb-2 opacity-30" />
                        <p className="text-xs text-center">No documents or folders yet</p>
                      </div>
                    ) : (
                      <>
                        {/* Select All */}
                        <button
                          onClick={() => {
                            if (selectedDocumentIds.size === allDocuments.length) {
                              setSelectedDocumentIds(new Set());
                            } else {
                              setSelectedDocumentIds(new Set(allDocuments.map(d => d.id)));
                            }
                          }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs transition-colors",
                            selectedDocumentIds.size === allDocuments.length
                              ? "bg-primary/10 text-foreground"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground"
                          )}
                        >
                          <div className={cn(
                            "h-4 w-4 rounded border flex items-center justify-center shrink-0",
                            selectedDocumentIds.size === allDocuments.length
                              ? "bg-primary border-primary"
                              : "border-border"
                          )}>
                            {selectedDocumentIds.size === allDocuments.length && (
                              <Check className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                          <span className="font-medium">All Documents</span>
                        </button>
                        
                        <div className="h-px bg-border/50 my-1.5" />
                        
                        {loadingDocs || loadingFolders || loadingAllDocs ? (
                          <div className="flex items-center justify-center py-4">
                            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                          </div>
                        ) : (
                          <>
                            {/* Folders with their documents */}
                            {folderTree.map(folder => renderFolderWithDocs(folder, 0))}
                            
                            {/* Documents without folder */}
                            {unfolderedDocs.map(doc => renderDocItem(doc))}
                          </>
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
