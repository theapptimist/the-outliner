import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { EditorProvider, useEditorContext } from '@/components/editor/EditorContext';
import { TermUsagesPane } from '@/components/editor/TermUsagesPane';
import { NavigationBackBar } from '@/components/editor/NavigationBackBar';
import { NavigationProvider, useNavigation, MasterDocumentLink } from '@/contexts/NavigationContext';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { OpenDocumentDialog } from '@/components/editor/OpenDocumentDialog';
import { SaveAsDialog } from '@/components/editor/SaveAsDialog';
import { DocumentState, createEmptyDocument, HierarchyBlockData } from '@/types/document';
import { HierarchyNode } from '@/types/node';
import { useAuth } from '@/contexts/AuthContext';
import {
  loadCloudDocument,
  saveCloudDocument,
  deleteCloudDocument,
  exportCloudDocument,
  importCloudDocument,
  createCloudDocument,
  createLocalDocument,
} from '@/lib/cloudDocumentStorage';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const MIXED_CONFIG_STORAGE_KEY = 'outline-mixed-config';
const CURRENT_DOC_KEY = 'outliner:current-doc-id';

function loadMixedConfig(): MixedStyleConfig {
  try {
    const stored = localStorage.getItem(MIXED_CONFIG_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed?.levels?.length === 6) {
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Failed to load mixed config from localStorage:', e);
  }
  return DEFAULT_MIXED_CONFIG;
}

function saveMixedConfig(config: MixedStyleConfig) {
  try {
    localStorage.setItem(MIXED_CONFIG_STORAGE_KEY, JSON.stringify(config));
  } catch (e) {
    console.warn('Failed to save mixed config to localStorage:', e);
  }
}

// Helper to extract link nodes from hierarchy blocks
function extractLinkNodes(hierarchyBlocks: Record<string, HierarchyBlockData>): MasterDocumentLink[] {
  const links: MasterDocumentLink[] = [];
  
  function traverse(nodes: HierarchyNode[]) {
    for (const node of nodes) {
      if (node.type === 'link' && node.linkedDocumentId) {
        links.push({
          nodeId: node.id,
          linkedDocumentId: node.linkedDocumentId,
          linkedDocumentTitle: node.linkedDocumentTitle || 'Untitled',
        });
      }
      if (node.children?.length) {
        traverse(node.children);
      }
    }
  }
  
  for (const block of Object.values(hierarchyBlocks)) {
    traverse(block.tree);
  }
  
  return links;
}

// Inner component that uses EditorContext and Navigation
function EditorContent({ 
  onNavigateToDocument,
}: { 
  onNavigateToDocument: (id: string) => void;
}) {
  const { inspectedTerm, setInspectedTerm, documentVersion, setNavigateToDocument, document } = useEditorContext();
  const { pushDocument, setMasterDocument, setActiveSubOutlineId } = useNavigation();

  // Register navigation handler with context
  useEffect(() => {
    console.log('[nav] registering navigateToDocument handler', { currentDocId: document?.meta?.id, isMaster: document?.meta?.isMaster });
    const handler = (documentId: string, documentTitle: string) => {
      console.log('[nav] navigating to', { from: document?.meta?.id, to: documentId, title: documentTitle });
      // Push current document onto navigation stack before navigating
      if (document) {
        pushDocument(document.meta.id, document.meta.title);
        
        // If current document is a master, set up master mode
        if (document.meta.isMaster) {
          const links = extractLinkNodes(document.hierarchyBlocks);
          setMasterDocument({
            id: document.meta.id,
            title: document.meta.title,
            links,
          });
          setActiveSubOutlineId(documentId);
        }
      }
      onNavigateToDocument(documentId);
    };
    setNavigateToDocument(handler);
    return () => setNavigateToDocument(null);
  }, [setNavigateToDocument, pushDocument, document, onNavigateToDocument, setMasterDocument, setActiveSubOutlineId]);

  // Key the panel group so defaultSize recalculates when the usages pane opens/closes
  const layoutKey = inspectedTerm ? `usages:${inspectedTerm.id}` : 'usages:none';

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Back navigation bar */}
      <NavigationBackBar onNavigateBack={onNavigateToDocument} />
      
      <div className="flex-1 flex overflow-hidden">
        <ResizablePanelGroup key={layoutKey} direction="horizontal" className="flex-1">
          {/* Term Usages Panel */}
          <ResizablePanel
            defaultSize={inspectedTerm ? 25 : 0}
            minSize={0}
            maxSize={40}
            collapsible
            collapsedSize={0}
          >
            {inspectedTerm ? (
              <TermUsagesPane term={inspectedTerm} onClose={() => setInspectedTerm(null)} />
            ) : (
              <div className="h-full" />
            )}
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Main Editor Panel */}
          <ResizablePanel defaultSize={inspectedTerm ? 75 : 100} minSize={40}>
            <main className="h-full overflow-hidden">
              {/* Force TipTap to remount on explicit document changes */}
              <DocumentEditor key={documentVersion} />
            </main>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

export default function Editor() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>('mixed');
  const [mixedConfig, setMixedConfig] = useState<MixedStyleConfig>(loadMixedConfig);
  const [autoDescend, setAutoDescend] = useState(false);
  const [showRevealCodes, setShowRevealCodes] = useState(false);
  
  // Document state
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Undo/redo state passed up from document
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Refs for undo/redo callbacks
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Load document on mount
  useEffect(() => {
    async function loadInitialDocument() {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const currentId = localStorage.getItem(CURRENT_DOC_KEY);
        if (currentId) {
          const doc = await loadCloudDocument(currentId);
          if (doc) {
            setDocument(doc);
            setIsLoading(false);
            return;
          }
        }
        
        // No existing document - create LOCAL-ONLY document (not persisted until save)
        const localDoc = createLocalDocument('Untitled');
        setDocument(localDoc);
      } catch (e) {
        console.error('Failed to load document:', e);
        // Fallback to local-only empty document
        const localDoc = createLocalDocument('Untitled');
        setDocument(localDoc);
      }
      setIsLoading(false);
    }
    
    if (user) {
      loadInitialDocument();
    }
  }, [user]);

  const handleUndoRedoChange = useCallback((
    undo: () => void,
    redo: () => void,
    canU: boolean,
    canR: boolean
  ) => {
    undoRef.current = undo;
    redoRef.current = redo;
    setCanUndo(canU);
    setCanRedo(canR);
  }, []);

  // Persist current doc ID
  useEffect(() => {
    if (document?.meta?.id) {
      localStorage.setItem(CURRENT_DOC_KEY, document.meta.id);
    }
  }, [document?.meta?.id]);

  // Save mixed config when it changes
  useEffect(() => {
    saveMixedConfig(mixedConfig);
  }, [mixedConfig]);

  // Global keyboard handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F3') {
        e.preventDefault();
        setShowRevealCodes(prev => !prev);
      }
      // Ctrl/Cmd+S = Save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Ctrl/Cmd+O = Open
      if ((e.ctrlKey || e.metaKey) && e.key === 'o') {
        e.preventDefault();
        setOpenDialogOpen(true);
      }
      // Ctrl/Cmd+N = New
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        handleNew();
      }
      // Ctrl/Cmd+Shift+S = Save As
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
        e.preventDefault();
        setSaveAsDialogOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [document]);

  const handleNew = useCallback(() => {
    if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
    
    // Create LOCAL-ONLY document - not persisted until explicit save
    const localDoc = createLocalDocument('Untitled');
    setDocument(localDoc);
    setDocumentVersion(v => v + 1);
    setHasUnsavedChanges(true); // Mark as unsaved so user knows to save
    toast.success('New document created (not yet saved)');
  }, [hasUnsavedChanges]);

  const handleSave = useCallback(async () => {
    if (!user || !document) return;
    
    try {
      const saved = await saveCloudDocument(document, user.id);
      setDocument(saved);
      setHasUnsavedChanges(false);
      toast.success('Saved to cloud');
    } catch (e) {
      toast.error('Failed to save document');
    }
  }, [user, document]);

  const handleSaveAs = useCallback(async (title: string, isMaster: boolean = false) => {
    if (!user || !document) return;
    
    try {
      const newDoc: DocumentState = {
        ...document,
        meta: {
          ...document.meta,
          id: crypto.randomUUID(),
          title,
          isMaster,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      };
      const saved = await saveCloudDocument(newDoc, user.id);
      setDocument(saved);
      setDocumentVersion(v => v + 1);
      setHasUnsavedChanges(false);
      toast.success(`Saved as "${title}"${isMaster ? ' (Master)' : ''}`);
    } catch (e) {
      toast.error('Failed to save document');
    }
  }, [user, document]);

  // Handle navigation to a document (for both regular open and link navigation)
  const handleNavigateToDocument = useCallback(async (id: string, skipConfirm = false) => {
    if (!skipConfirm && hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
    
    try {
      const doc = await loadCloudDocument(id);
      if (doc) {
        setDocument(doc);
        setDocumentVersion(v => v + 1);
        setHasUnsavedChanges(false);
      } else {
        toast.error('Document not found');
      }
    } catch (e) {
      toast.error('Failed to open document');
    }
  }, [hasUnsavedChanges]);

  const handleOpenDocument = useCallback(async (id: string) => {
    if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;

    try {
      const doc = await loadCloudDocument(id);
      if (doc) {
        setDocument(doc);
        setDocumentVersion(v => v + 1);
        setHasUnsavedChanges(false);
        toast.success(`Opened "${doc.meta.title}"`);
      } else {
        toast.error('Document not found');
      }
    } catch (e) {
      toast.error('Failed to open document');
    }
  }, [hasUnsavedChanges]);

  const handleDelete = useCallback(async () => {
    if (!user || !document) return;
    if (!confirm('Delete this document permanently?')) return;
    
    try {
      await deleteCloudDocument(document.meta.id);
      // Clear current doc ID from localStorage
      localStorage.removeItem(CURRENT_DOC_KEY);
      // Create a new local-only document instead of auto-persisting
      const localDoc = createLocalDocument('Untitled');
      setDocument(localDoc);
      setDocumentVersion(v => v + 1);
      setHasUnsavedChanges(false);
      toast.success('Document deleted');
    } catch (e) {
      toast.error('Failed to delete document');
    }
  }, [user, document]);

  const handleExport = useCallback(() => {
    if (!document) return;
    exportCloudDocument(document);
    toast.success('Document exported');
  }, [document]);

  const handleImport = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const imported = await importCloudDocument(file, user.id);
      setDocument(imported);
      setDocumentVersion(v => v + 1);
      setHasUnsavedChanges(false);
      toast.success('Document imported');
    } catch (err) {
      toast.error('Failed to import document');
    }
    e.target.value = '';
  }, [user]);

  const handleTitleChange = useCallback((title: string) => {
    setDocument(prev => prev ? {
      ...prev,
      meta: { ...prev.meta, title },
    } : null);
    setHasUnsavedChanges(true);
  }, []);

  const handleDocumentContentChange = useCallback((content: any) => {
    setDocument(prev => prev ? {
      ...prev,
      content,
    } : null);
    setHasUnsavedChanges(true);
  }, []);

  const handleHierarchyBlocksChange = useCallback((blocks: Record<string, { id: string; tree: HierarchyNode[] }>) => {
    setDocument(prev => prev ? {
      ...prev,
      hierarchyBlocks: blocks,
    } : null);
    setHasUnsavedChanges(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/auth');
  }, [signOut, navigate]);

  // Loading states
  if (authLoading || isLoading || !document) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const fileMenuProps = {
    documentTitle: document.meta.title,
    hasUnsavedChanges,
    onNew: handleNew,
    onOpen: () => setOpenDialogOpen(true),
    onSave: handleSave,
    onSaveAs: () => setSaveAsDialogOpen(true),
    onRename: handleTitleChange,
    onExport: handleExport,
    onImport: handleImport,
    onDelete: handleDelete,
    onOpenRecent: handleOpenDocument,
    onSignOut: handleSignOut,
    hasDocument: true,
  };

  return (
    <NavigationProvider>
      <EditorProvider
        outlineStyle={outlineStyle}
        mixedConfig={mixedConfig}
        autoDescend={autoDescend}
        showRevealCodes={showRevealCodes}
        document={document}
        documentVersion={documentVersion}
        onDocumentContentChange={handleDocumentContentChange}
        onHierarchyBlocksChange={handleHierarchyBlocksChange}
        onUndoRedoChange={handleUndoRedoChange}
      >
        <div className="h-screen flex bg-background">
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept=".json"
            onChange={handleFileSelected}
          />
          
          <EditorSidebar
            outlineStyle={outlineStyle}
            onOutlineStyleChange={setOutlineStyle}
            mixedConfig={mixedConfig}
            onMixedConfigChange={setMixedConfig}
            autoDescend={autoDescend}
            onAutoDescendChange={setAutoDescend}
            showRevealCodes={showRevealCodes}
            onShowRevealCodesChange={setShowRevealCodes}
            onUndo={() => undoRef.current()}
            onRedo={() => redoRef.current()}
            canUndo={canUndo}
            canRedo={canRedo}
            fileMenuProps={fileMenuProps}
            onNavigateToDocument={(id) => handleNavigateToDocument(id, true)}
          />
          
          <EditorContent onNavigateToDocument={(id) => handleNavigateToDocument(id, true)} />

          <OpenDocumentDialog
            open={openDialogOpen}
            onOpenChange={setOpenDialogOpen}
            onSelect={handleOpenDocument}
            currentDocId={document.meta.id}
          />

          <SaveAsDialog
            open={saveAsDialogOpen}
            onOpenChange={setSaveAsDialogOpen}
            onSave={handleSaveAs}
            defaultTitle={document.meta.title}
            defaultIsMaster={document.meta.isMaster}
          />
        </div>
      </EditorProvider>
    </NavigationProvider>
  );
}
