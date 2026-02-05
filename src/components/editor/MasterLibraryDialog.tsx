import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
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
  ChevronLeft,
  File,
  ArrowRight,
} from 'lucide-react';
import { useEntityDocuments, EntityDocumentInfo, DocumentSnippet } from '@/hooks/useEntityDocuments';
import { FolderPlus, MoreHorizontal, FolderInput, Trash2, RefreshCw } from 'lucide-react';
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
import { Json } from '@/integrations/supabase/types';
import { useDocumentFolders, FolderWithChildren } from '@/hooks/useDocumentFolders';
import { useDocumentContext } from './context';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { checkMigrationNeeded, migrateDocumentEntitiesToMaster, backfillSourceDocumentIds } from '@/lib/masterEntityMigration';
import { FullScreenModalHeader } from './FullScreenModalHeader';
import { useNavigation } from '@/contexts/NavigationContext';

// MasterLibraryDialog - Full-page modal for managing the Master Library
type MasterLibraryTab = 'my-library' | 'shared' | 'public';

interface MasterLibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onJumpToDocument?: (docId: string) => void;
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

// --- Document emptiness detection (keeps Master Library explorer free of blank/Untitled docs) ---
function hasNonEmptyNodes(nodes: any[]): boolean {
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  return nodes.some((node) => {
    const label = node.label?.trim?.() || '';
    if (label.length > 0) return true;
    if (Array.isArray(node.children) && hasNonEmptyNodes(node.children)) return true;
    return false;
  });
}

function parseHierarchyBlocks(json: Json | null): Record<string, any> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  return json as Record<string, any>;
}

function isDocumentEmpty(content: Json | null, hierarchyBlocks: Json | null): boolean {
  const blocks = parseHierarchyBlocks(hierarchyBlocks);

  const hasHierarchyContent = Object.values(blocks).some((block) => {
    const tree = (block as any)?.tree;
    return hasNonEmptyNodes(tree);
  });
  if (hasHierarchyContent) return false;

  if (!content || typeof content !== 'object') return true;
  const docContent = (content as any).content;
  if (!Array.isArray(docContent)) return true;

  const hasRealContent = docContent.some((node: any) => {
    if (node.type === 'hierarchyBlock') return false;
    if (node.type === 'paragraph') return node.content && node.content.length > 0;
    return node.type !== 'paragraph';
  });
  return !hasRealContent;
}

// Document thumbnail with expandable snippet viewer
interface DocumentThumbnailProps {
  doc: EntityDocumentInfo;
  entityName: string;
  entityType: EntityType;
  entityDocuments: ReturnType<typeof useEntityDocuments>;
  onJumpToDocument: (docId: string) => void;
  isNavigating?: boolean;
}



const DocumentThumbnail = React.forwardRef<HTMLDivElement, DocumentThumbnailProps>(({ 
  doc, 
  entityName,
  entityType,
  entityDocuments, 
  onJumpToDocument,
  isNavigating,
}, ref) => {
  const [isSelected, setIsSelected] = useState(false);
  const [snippets, setSnippets] = useState<DocumentSnippet[]>([]);
  const [currentSnippetIndex, setCurrentSnippetIndex] = useState(0);
  
  const isLoadingSnippets = entityDocuments.isSnippetLoading(doc.id, { entityType, text: entityName });

  // Check if the current snippet is a timeout/error sentinel
  const isErrorSnippet = snippets.length === 1 && 
    (snippets[0]?.text?.startsWith('⏱️') || snippets[0]?.text?.startsWith('⚠️'));

  const fetchSnippets = async () => {
    console.log('[DocumentThumbnail] Fetching snippets', { docId: doc.id, entityType, entityName });
    const fetchedSnippets = await entityDocuments.fetchSnippetsForDocument(doc.id, { entityType, text: entityName });
    console.log('[DocumentThumbnail] Got snippets:', fetchedSnippets.length);
    setSnippets(fetchedSnippets);
    setCurrentSnippetIndex(0);
  };

  const handleClick = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const newIsSelected = !isSelected;
    setIsSelected(newIsSelected);  // Toggle immediately for instant feedback
    
    if (newIsSelected) {
      await fetchSnippets();
    }
  };

  const handleRetry = async (e: React.MouseEvent) => {
    e.stopPropagation();
    // Clear the cache for this document/entity so we can retry
    entityDocuments.clearSnippetCache?.(doc.id, { entityType, text: entityName });
    setSnippets([]);
    await fetchSnippets();
  };

  const handlePrevSnippet = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSnippetIndex(prev => Math.max(0, prev - 1));
  };

  const handleNextSnippet = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentSnippetIndex(prev => Math.min(snippets.length - 1, prev + 1));
  };

  const handleJump = (e: React.MouseEvent) => {
    e.stopPropagation();
    onJumpToDocument(doc.id);
  };

  return (
    <div ref={ref} className="flex flex-col" data-allow-pointer>
      {/* Thumbnail */}
      <div 
        className={cn(
          "flex flex-col items-center gap-1 p-2 rounded-md bg-card border transition-colors cursor-pointer min-w-[80px] max-w-[100px]",
          isSelected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50"
        )}
        onClick={handleClick}
        onMouseDown={(e) => e.stopPropagation()}
        data-allow-pointer
      >
        <div className="w-12 h-14 bg-background border border-border/50 rounded flex items-center justify-center pointer-events-none">
          <File className="h-6 w-6 text-muted-foreground/50" />
        </div>
        <span className="text-[10px] text-muted-foreground text-center line-clamp-2 leading-tight pointer-events-none">
          {doc.title}
        </span>
      </div>
      
      {/* Expanded section below thumbnail */}
      {isSelected && (
        <div className="mt-1 p-2 rounded-md bg-card border border-primary/30 min-w-[200px] max-w-[280px]">
        {/* Jump to document button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start h-7 px-2 mb-2 text-xs text-primary hover:text-primary hover:bg-primary/10"
            onClick={handleJump}
            disabled={isNavigating}
          >
            {isNavigating ? (
              <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
            ) : (
              <ArrowRight className="h-3 w-3 mr-1.5" />
            )}
            {isNavigating ? 'Opening...' : 'Jump to document'}
          </Button>
          
          {/* Snippet section */}
          {isLoadingSnippets ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            </div>
          ) : snippets.length === 0 ? (
            <div className="text-[10px] text-muted-foreground italic py-2 px-1">
              No text snippets found
            </div>
          ) : isErrorSnippet ? (
            <div className="space-y-2">
              <div className="text-[11px] text-muted-foreground italic py-1 px-1">
                {snippets[0]?.text?.includes('timed out') 
                  ? 'Snippet extraction took too long.' 
                  : 'Could not extract snippets.'}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleRetry}
              >
                <RefreshCw className="h-3 w-3 mr-1.5" />
                Retry
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {/* Snippet navigation header */}
              {snippets.length > 1 && (
                <div className="flex items-center justify-between px-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={handlePrevSnippet}
                    disabled={currentSnippetIndex === 0}
                  >
                    <ChevronLeft className="h-3 w-3" />
                  </Button>
                  <span className="text-[10px] text-muted-foreground">
                    {currentSnippetIndex + 1} of {snippets.length}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-5 w-5 p-0"
                    onClick={handleNextSnippet}
                    disabled={currentSnippetIndex === snippets.length - 1}
                  >
                    <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              )}
              
              {/* Current snippet */}
              <div className="bg-muted/50 rounded px-2 py-1.5 text-[11px] leading-relaxed">
                <HighlightedSnippet 
                  text={snippets[currentSnippetIndex]?.text || ''} 
                  highlight={entityName} 
                />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

DocumentThumbnail.displayName = 'DocumentThumbnail';

// Component to highlight the entity name within snippet text
// Using a simple function that returns JSX (no ref needed)
const HighlightedSnippet = ({ text, highlight }: { text: string; highlight: string }) => {
  if (!highlight || !text) return <span>{text}</span>;
  
  // Check for timeout/error sentinel snippets
  if (text.startsWith('⏱️') || text.startsWith('⚠️')) {
    return <span className="text-muted-foreground italic">{text}</span>;
  }
  
  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  
  return (
    <span>
      {parts.map((part, i) => 
        regex.test(part) ? (
          <mark key={i} className="bg-primary/30 text-foreground px-0.5 rounded">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
};

// Entity card for master library view
interface MasterEntityCardProps {
  entity: MasterEntity;
  onImport?: () => void;
  isImporting?: boolean;
  showSource?: boolean;
  sourceLabel?: string;
  entityDocuments: ReturnType<typeof useEntityDocuments>;
  onJumpToDocument?: (docId: string) => void;
}

function MasterEntityCard({ 
  entity, 
  onImport, 
  isImporting, 
  showSource, 
  sourceLabel,
  entityDocuments,
  onJumpToDocument,
}: MasterEntityCardProps) {
  const Icon = ENTITY_ICONS[entity.entity_type];
  const iconColor = ENTITY_COLORS[entity.entity_type];
  const [isExpanded, setIsExpanded] = useState(false);
  const [documents, setDocuments] = useState<EntityDocumentInfo[]>([]);
  
  const cachedDocs = entityDocuments.getFromCache(entity.id);
  const isLoadingDocs = entityDocuments.isLoading(entity.id);
  
  // Get document count from cache or show "..."
  const docCount = cachedDocs?.length;
  
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

  const handleCardClick = async () => {
    if (!isExpanded) {
      // Fetch documents when expanding
      const docs = await entityDocuments.fetchDocumentsForEntity(entity.id, entity.source_document_id);
      setDocuments(docs);
      
      // Pre-cache snippets for all documents in the background
      if (docs.length > 0 && entityName) {
        const precacheItems = docs.map(doc => ({
          documentId: doc.id,
          input: { entityType: entity.entity_type, text: entityName },
        }));
        // Fire and forget - don't await
        entityDocuments.precacheSnippets?.(precacheItems);
      }
    }
    setIsExpanded(!isExpanded);
  };

  const entityName = getName() || '';

  return (
    <div className="space-y-0">
      <div 
        className={cn(
          "group p-2.5 rounded-md border border-border bg-card hover:bg-muted/50 transition-colors cursor-pointer",
          "flex items-start gap-2.5",
          isExpanded && "rounded-b-none border-b-0"
        )}
        onClick={handleCardClick}
      >
        <div className={cn("mt-0.5 p-1.5 rounded-md bg-muted", iconColor)}>
          <Icon className="h-4 w-4" />
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{entityName}</span>
                {docCount !== undefined ? (
                  <span className="text-xs text-muted-foreground">({docCount})</span>
                ) : (
                  <span className="text-xs text-muted-foreground">(…)</span>
                )}
              </div>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onImport();
                    }}
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
      
      {/* Expanded document thumbnails section */}
      {isExpanded && (
        <div 
          className="border border-t-0 border-border rounded-b-md bg-muted/30 p-3"
          onClick={(e) => e.stopPropagation()}
          data-allow-pointer
        >
          {isLoadingDocs ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : documents.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-2">
              No documents found
            </div>
          ) : (
            <div className="space-y-2">
              {/* Pre-caching indicator */}
              {entityDocuments.isPrecaching && (
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground px-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Loading snippets...</span>
                </div>
              )}
              <div className="flex flex-wrap gap-3 items-start">
                {documents.map(doc => (
                  <DocumentThumbnail
                    key={doc.id}
                    doc={doc}
                    entityName={entityName}
                    entityType={entity.entity_type}
                    entityDocuments={entityDocuments}
                    onJumpToDocument={onJumpToDocument || (() => {})}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Tab content component
interface LibraryTabContentProps {
  scope: MasterLibraryTab;
  searchQuery: string;
  entityTypeFilter?: EntityType;
  selectedDocumentIds: Set<string>;
  onJumpToDocument: (docId: string) => void;
}

function LibraryTabContent({ scope, searchQuery, entityTypeFilter, selectedDocumentIds, onJumpToDocument }: LibraryTabContentProps) {
  const { document: currentDocument } = useDocumentContext();
  const documentId = currentDocument?.meta?.id || '';
  const { toast } = useToast();
  const entityDocuments = useEntityDocuments();
  
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
     console.log('[LibraryTabContent] Filtering by documents:', {
       selectedCount: selectedDocumentIds.size,
       selectedIds: Array.from(selectedDocumentIds),
       totalEntities: entities.length,
       entitiesWithSourceDoc: entities.filter(e => e.source_document_id).length,
     });
      entities = entities.filter(e => 
        e.source_document_id && selectedDocumentIds.has(e.source_document_id)
      );
     console.log('[LibraryTabContent] After filter:', entities.length, 'entities');
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
  
  // Pre-fetch document counts for visible entities
  useEffect(() => {
    filteredEntities.slice(0, 20).forEach(entity => {
      if (!entityDocuments.getFromCache(entity.id)) {
        entityDocuments.fetchDocumentsForEntity(entity.id, entity.source_document_id);
      }
    });
  }, [filteredEntities, entityDocuments]);
  
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
            entityDocuments={entityDocuments}
            onJumpToDocument={onJumpToDocument}
          />
        ))}
      </div>
    </div>
  );
}

export function MasterLibraryDialog({ open, onOpenChange, onJumpToDocument }: MasterLibraryDialogProps) {
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
  const [isBulkMoving, setIsBulkMoving] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [renamingDocId, setRenamingDocId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  
  // Resizable explorer pane
  const [explorerWidth, setExplorerWidth] = useState(192); // 12rem = 192px (w-48)
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(192);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = explorerWidth;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [explorerWidth]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = e.clientX - startX.current;
      const newWidth = Math.max(160, Math.min(400, startWidth.current + delta));
      setExplorerWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizing.current) {
        isResizing.current = false;
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  // Handler for jumping to a document from entity cards
  // Prefer onJumpToDocument (direct editor callback) over navigateToDocument (context pipeline)
  const { navigateToDocument, document: currentDoc } = useDocumentContext();
  const { pushDocument } = useNavigation();
  
  const [isNavigating, setIsNavigating] = useState(false);
  
  const handleJumpToDocument = useCallback((docId: string) => {
    console.log('[MasterLibrary] handleJumpToDocument called', { 
      docId, 
      currentDocId: currentDoc?.meta?.id,
      hasOnJumpToDocument: !!onJumpToDocument,
      hasNavigateToDocument: !!navigateToDocument
    });
    
    // Don't navigate if already on this document
    if (currentDoc?.meta?.id === docId) {
      console.log('[MasterLibrary] Already on this document, just closing');
      onOpenChange(false);
      return;
    }
    
    setIsNavigating(true);
    
    // Push current document to navigation stack for Back button support
    if (currentDoc?.meta?.id) {
      console.log('[MasterLibrary] Pushing current doc to nav stack:', currentDoc.meta.id);
      pushDocument(currentDoc.meta.id, currentDoc.meta.title || 'Untitled');
    }
    
    // Navigate using the DIRECT prop callback first (more reliable than context pipeline)
    if (onJumpToDocument) {
      console.log('[MasterLibrary] Using onJumpToDocument (direct callback)');
      onJumpToDocument(docId);
    } else if (navigateToDocument) {
      console.log('[MasterLibrary] Fallback to navigateToDocument from context');
      navigateToDocument(docId, '');
    } else {
      console.error('[MasterLibrary] No navigation handler available!');
      setIsNavigating(false);
      return;
    }
    
    // Close dialog AFTER navigation is triggered
    onOpenChange(false);
    setIsNavigating(false);
  }, [onOpenChange, onJumpToDocument, navigateToDocument, currentDoc?.meta?.id, currentDoc?.meta?.title, pushDocument]);
  
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
      .select('id, title, folder_id, content, hierarchy_blocks')
      .eq('user_id', user.id)
      .order('title')
      .then(({ data, error }) => {
        if (error) {
          console.error('[MasterLibrary] Error fetching documents:', error);
          setAllDocuments([]);
        } else {
          const nonEmptyDocs = (data || []).filter(
            (doc) => !isDocumentEmpty((doc as any).content, (doc as any).hierarchy_blocks)
          );

          // Merge with library docs to get entity counts
          const docsWithCounts = nonEmptyDocs.map(doc => {
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
  
  // Handle document rename
  const handleRenameDocument = async (docId: string, newTitle: string) => {
    const trimmed = newTitle.trim();
    if (!trimmed || !user?.id) {
      setRenamingDocId(null);
      return;
    }
    
    const { error } = await supabase
      .from('documents')
      .update({ title: trimmed, updated_at: new Date().toISOString() })
      .eq('id', docId)
      .eq('user_id', user.id);
    
    if (error) {
      toast({ title: 'Failed to rename document', variant: 'destructive' });
    } else {
      // Update local state
      setAllDocuments(prev => prev.map(d => d.id === docId ? { ...d, title: trimmed } : d));
      refreshDocs();
    }
    setRenamingDocId(null);
  };
  
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
   
   // Get all document IDs in this folder and its children recursively
   const getAllDocsInFolder = (f: FolderWithChildren): string[] => {
     const docs = documentsByFolder.get(f.id) || [];
     const docIds = docs.map(d => d.id);
     const childDocIds = f.children.flatMap(child => getAllDocsInFolder(child));
     return [...docIds, ...childDocIds];
   };
   
   const allFolderDocIds = getAllDocsInFolder(folder);
   const allSelected = allFolderDocIds.length > 0 && allFolderDocIds.every(id => selectedDocumentIds.has(id));
    
    return (
      <div key={folder.id}>
       <div
         className={cn(
           "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors cursor-pointer",
           allSelected 
             ? "bg-primary/10 text-foreground"
             : "text-muted-foreground hover:bg-muted hover:text-foreground"
         )}
          style={{ paddingLeft: `${8 + depth * 12}px` }}
         onClick={() => {
           // Clicking folder selects all its docs (and deselects others)
           if (allFolderDocIds.length > 0) {
            console.log('[renderFolderWithDocs] Folder clicked:', folder.name, 'docs:', allFolderDocIds);
             if (allSelected) {
               // Deselect all docs in this folder
               setSelectedDocumentIds(new Set());
             } else {
               // Select only docs in this folder
               setSelectedDocumentIds(new Set(allFolderDocIds));
             }
           }
           // Auto-expand when selecting
           if (!isExpanded) {
             setExpandedFolders(prev => new Set([...prev, folder.id]));
           }
         }}
        >
         <button
           onClick={(e) => {
             e.stopPropagation();
             toggleFolderExpanded(folder.id);
           }}
           className="h-4 w-4 flex items-center justify-center shrink-0"
         >
           {isExpanded ? (
             <ChevronDown className="h-3 w-3" />
           ) : (
             <ChevronRight className="h-3 w-3" />
           )}
         </button>
         <div className={cn(
           "h-4 w-4 rounded border flex items-center justify-center shrink-0",
           allSelected
             ? "bg-primary border-primary"
             : "border-border"
         )}>
           {allSelected && (
             <Check className="h-3 w-3 text-primary-foreground" />
           )}
         </div>
          <Folder className={cn("h-3 w-3 shrink-0", isExpanded ? "text-warning" : "")} />
          <span className="flex-1 truncate font-medium">{folder.name}</span>
          <Badge variant="secondary" className="h-4 px-1 text-[10px] shrink-0">
            {folderDocs.reduce((sum, d) => sum + d.entityCount, 0)}
          </Badge>
       </div>
        
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

  const handleMoveSelectedToFolder = async (folderId: string | null) => {
    if (selectedDocumentIds.size === 0) return;
    setIsBulkMoving(true);
    try {
      const ids = Array.from(selectedDocumentIds);
      const results = await Promise.all(ids.map(id => moveDocumentToFolder(id, folderId)));
      const okCount = results.filter(Boolean).length;

      // Update local state in one pass for snappy UI
      setAllDocuments(prev => prev.map(doc => (
        selectedDocumentIds.has(doc.id) ? { ...doc, folder_id: folderId } : doc
      )));

      toast({
        title: okCount === ids.length ? 'Documents moved' : 'Some documents could not be moved',
        description: folderId ? `Moved ${okCount}/${ids.length} into folder` : `Moved ${okCount}/${ids.length} to root`,
        variant: okCount === ids.length ? 'default' : 'destructive',
      });

      // Keep selection, but most users expect it cleared after an action
      setSelectedDocumentIds(new Set());
      refreshDocs();
    } finally {
      setIsBulkMoving(false);
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedDocumentIds.size === 0) return;
    
    setIsBulkDeleting(true);
    try {
      const ids = Array.from(selectedDocumentIds);
      const { error } = await supabase
        .from('documents')
        .delete()
        .in('id', ids);
      
      if (error) throw error;
      
      toast({
        title: 'Documents deleted',
        description: `${ids.length} document${ids.length > 1 ? 's' : ''} removed`,
      });
      
      // Clear selection and update state
      setSelectedDocumentIds(new Set());
      setShowDeleteConfirm(false);
      setAllDocuments(prev => prev.filter(d => !ids.includes(d.id)));
      refreshDocs();
    } catch (err) {
      console.error('[MasterLibrary] Delete error:', err);
      toast({
        title: 'Delete failed',
        description: 'Could not delete documents',
        variant: 'destructive',
      });
    } finally {
      setIsBulkDeleting(false);
    }
  };
  
  // Render a document item with move-to-folder dropdown
  const renderDocItem = (doc: { id: string; title: string; entityCount: number; folder_id: string | null }, depth: number = 0) => {
    const isRenaming = renamingDocId === doc.id;
    
    return (
      <div
        key={doc.id}
        className={cn(
          "flex items-start gap-2 px-2 py-1.5 rounded text-xs transition-colors group",
          selectedDocumentIds.has(doc.id)
            ? "bg-primary/10 text-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        style={{ paddingLeft: `${8 + depth * 12}px` }}
      >
        {/* Checkbox for selection */}
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
          className="shrink-0 mt-0.5"
        >
          <div className={cn(
            "h-4 w-4 rounded border flex items-center justify-center",
            selectedDocumentIds.has(doc.id)
              ? "bg-primary border-primary"
              : "border-border"
          )}>
            {selectedDocumentIds.has(doc.id) && (
              <Check className="h-3 w-3 text-primary-foreground" />
            )}
          </div>
        </button>
        
        <FileText className="h-3 w-3 shrink-0 opacity-50 mt-0.5" />
        
        {/* Title - click to rename */}
        {isRenaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={() => handleRenameDocument(doc.id, renameValue)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                handleRenameDocument(doc.id, renameValue);
              } else if (e.key === 'Escape') {
                setRenamingDocId(null);
              }
            }}
            autoFocus
            className="flex-1 min-w-0 bg-transparent border-b border-primary outline-none text-xs leading-tight"
            style={{ maxWidth: '15ch' }}
          />
        ) : (
          <button
            onClick={() => {
              setRenamingDocId(doc.id);
              setRenameValue(doc.title);
            }}
            className="flex-1 min-w-0 text-left cursor-text hover:underline"
          >
            <span
              className="leading-tight whitespace-normal break-words"
              style={{ maxWidth: '15ch' }}
            >
              {doc.title}
            </span>
          </button>
        )}
        
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
  };
  
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
      <DialogContent className="max-w-none w-[calc(100vw-2rem)] h-[calc(100vh-2rem)] flex flex-col p-0 gap-0 overflow-hidden z-[60]">
        <FullScreenModalHeader onBack={() => onOpenChange(false)} />
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
              <div 
                className="flex flex-col border-r border-border/30 bg-muted/10 shrink-0 min-h-0 overflow-hidden relative"
                style={{ width: explorerWidth }}
              >
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

                    {/* Bulk move for selected documents */}
                    {selectedDocumentIds.size > 0 && (
                      <>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-left text-xs text-foreground bg-muted/40 hover:bg-muted transition-colors"
                            disabled={isBulkMoving}
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              {isBulkMoving ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                              ) : (
                                <FolderInput className="h-3.5 w-3.5 shrink-0" />
                              )}
                              <span className="truncate">Move selected ({selectedDocumentIds.size})</span>
                            </span>
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 opacity-60" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-48">
                          <DropdownMenuItem onClick={() => handleMoveSelectedToFolder(null)}>
                            <FileText className="h-3.5 w-3.5 mr-2" />
                            No Folder (Root)
                          </DropdownMenuItem>
                          {folderTree.length > 0 && <DropdownMenuSeparator />}
                          {folderTree.map(folder => (
                            <DropdownMenuItem key={folder.id} onClick={() => handleMoveSelectedToFolder(folder.id)}>
                              <Folder className="h-3.5 w-3.5 mr-2" />
                              {folder.name}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Delete selected with confirmation */}
                      {!showDeleteConfirm ? (
                        <button
                          onClick={() => setShowDeleteConfirm(true)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded text-left text-xs text-destructive hover:bg-destructive/10 transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">Delete selected ({selectedDocumentIds.size})</span>
                        </button>
                      ) : (
                        <div className="flex flex-col gap-1.5 px-2 py-1.5 rounded bg-destructive/10 border border-destructive/30">
                          <span className="text-xs text-destructive font-medium">Delete {selectedDocumentIds.size} doc{selectedDocumentIds.size > 1 ? 's' : ''}?</span>
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-6 px-2 text-xs flex-1"
                              onClick={handleDeleteSelected}
                              disabled={isBulkDeleting}
                            >
                              {isBulkDeleting ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'Delete'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 px-2 text-xs"
                              onClick={() => setShowDeleteConfirm(false)}
                              disabled={isBulkDeleting}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                      </>
                    )}
                    
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
                {/* Resize Handle */}
                <div
                  onMouseDown={handleMouseDown}
                  className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 transition-colors z-10"
                  title="Drag to resize"
                />
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
                  onJumpToDocument={handleJumpToDocument}
                />
              </TabsContent>
              <TabsContent value="shared" className="mt-0 flex-1 min-h-0 overflow-hidden">
                <LibraryTabContent 
                  scope="shared" 
                  searchQuery={searchQuery}
                  entityTypeFilter={entityFilter}
                  selectedDocumentIds={selectedDocumentIds}
                  onJumpToDocument={handleJumpToDocument}
                />
              </TabsContent>
              <TabsContent value="public" className="mt-0 flex-1 min-h-0 overflow-hidden">
                <LibraryTabContent 
                  scope="public" 
                  searchQuery={searchQuery}
                  entityTypeFilter={entityFilter}
                  selectedDocumentIds={selectedDocumentIds}
                  onJumpToDocument={handleJumpToDocument}
                />
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
