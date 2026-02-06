import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
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
import { SaveAsMasterDialog } from '@/components/editor/SaveAsMasterDialog';
import { FileMenu } from '@/components/editor/FileMenu';
import { DocumentState, createEmptyDocument, HierarchyBlockData, DocumentDisplayOptions } from '@/types/document';
import { HierarchyNode } from '@/types/node';
import { useAuth } from '@/contexts/AuthContext';
import { useDebouncedAutoSave } from '@/hooks/useDebouncedAutoSave';
import { useCloudStylePreferences } from '@/hooks/useCloudStylePreferences';
import { useUserSettings } from '@/hooks/useUserSettings';
import {
  loadCloudDocument,
  saveCloudDocument,
  deleteCloudDocument,
  exportCloudDocument,
  importCloudDocument,
  createCloudDocument,
  createLocalDocument,
  isDocumentEmpty,
} from '@/lib/cloudDocumentStorage';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

const CURRENT_DOC_KEY = 'outliner:current-doc-id';

// Helper to extract link nodes from hierarchy blocks
function extractLinkNodes(hierarchyBlocks: Record<string, HierarchyBlockData>): MasterDocumentLink[] {
  const links: MasterDocumentLink[] = [];
  
  function traverse(nodes: HierarchyNode[]) {
    for (const node of nodes) {
      // A node is link-like if it has linkedDocumentId (type can be 'link' OR 'body')
      if (node.linkedDocumentId) {
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

interface PendingNavigation {
  documentId: string;
  documentTitle: string;
  links: MasterDocumentLink[];
}

// Inner component that uses EditorContext and Navigation
function EditorContent({ 
  onNavigateToDocument,
  onPromptSaveAsMaster,
  pendingNavigation,
  onClearPendingNavigation,
  onSaveDocumentAsMaster,
  onOpenMasterLibrary,
  onJumpFromMasterLibrary,
}: { 
  onNavigateToDocument: (id: string) => void;
  onPromptSaveAsMaster: (pending: PendingNavigation) => void;
  pendingNavigation: PendingNavigation | null;
  onClearPendingNavigation: () => void;
  onSaveDocumentAsMaster: (newTitle?: string) => Promise<DocumentState | null>;
  onOpenMasterLibrary: () => void;
  onJumpFromMasterLibrary: (docId: string) => void;
}) {
  const { inspectedTerm, setInspectedTerm, documentVersion, setNavigateToDocument, document } = useEditorContext();
  const { pushDocument, setMasterDocument, setActiveSubOutlineId } = useNavigation();

  // Handle save as master and then navigate (needs navigation context access)
  const handleSaveAsMasterAndNavigate = useCallback(async (newTitle?: string) => {
    if (!pendingNavigation) return;
    
    try {
      // Save via parent - returns the saved document
      const saved = await onSaveDocumentAsMaster(newTitle);
      if (!saved) return;
      
      // Now set up navigation context with master mode
      pushDocument(saved.meta.id, saved.meta.title);
      setMasterDocument({
        id: saved.meta.id,
        title: saved.meta.title,
        links: pendingNavigation.links,
      });
      setActiveSubOutlineId(pendingNavigation.documentId);
      
      // Navigate to sub-document
      onNavigateToDocument(pendingNavigation.documentId);
    } finally {
      onClearPendingNavigation();
    }
  }, [pendingNavigation, onSaveDocumentAsMaster, pushDocument, setMasterDocument, setActiveSubOutlineId, onNavigateToDocument, onClearPendingNavigation]);

  // Handle just navigate without saving as master
  const handleJustNavigate = useCallback(() => {
    if (!pendingNavigation) return;
    onNavigateToDocument(pendingNavigation.documentId);
    onClearPendingNavigation();
  }, [pendingNavigation, onNavigateToDocument, onClearPendingNavigation]);

  // Register navigation handler with context
  useEffect(() => {
    const handler = (documentId: string, documentTitle: string) => {
      if (!document) {
        onNavigateToDocument(documentId);
        return;
      }

      // Only push saved documents onto the navigation stack
      // A document is considered "saved" if it has a real title OR has been modified since creation
      const isSaved = document.meta.title !== 'Untitled' || 
                      document.meta.createdAt !== document.meta.updatedAt;
      
      if (isSaved) {
        pushDocument(document.meta.id, document.meta.title);
      }
      
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
      
      onNavigateToDocument(documentId);
    };
    setNavigateToDocument(handler);
    return () => setNavigateToDocument(null);
  }, [setNavigateToDocument, pushDocument, document, onNavigateToDocument, setMasterDocument, setActiveSubOutlineId]);

  // Key the panel group so defaultSize recalculates when the usages pane opens/closes
  const layoutKey = inspectedTerm ? `usages:${inspectedTerm.id}` : 'usages:none';

  return (
    <>
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Back navigation bar */}
        <NavigationBackBar 
          onNavigateBack={onNavigateToDocument} 
          onOpenMasterLibrary={onOpenMasterLibrary}
        />
        
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

      {/* SaveAsMasterDialog needs navigation context */}
      <SaveAsMasterDialog
        open={!!pendingNavigation}
        onOpenChange={(open) => !open && onClearPendingNavigation()}
        onSaveAsMaster={handleSaveAsMasterAndNavigate}
        onJustNavigate={handleJustNavigate}
        documentTitle={document?.meta?.title || 'Untitled'}
      />
    </>
  );
}

// Wrapper component that provides navigation-aware callbacks to both Sidebar and EditorContent
// This component lives inside NavigationProvider so it can use useNavigation
interface NavigationAwareContentProps {
  document: DocumentState;
  masterLibraryOpen: boolean;
  setMasterLibraryOpen: (open: boolean) => void;
  handleNavigateToDocument: (id: string, skipConfirm?: boolean) => Promise<void>;
  handlePromptSaveAsMaster: (pending: PendingNavigation) => void;
  pendingNavigation: PendingNavigation | null;
  setPendingNavigation: (pending: PendingNavigation | null) => void;
  handleSaveDocumentAsMaster: (newTitle?: string) => Promise<DocumentState | null>;
  outlineStyle: OutlineStyle;
  setOutlineStyle: (style: OutlineStyle) => void;
  mixedConfig: MixedStyleConfig;
  setMixedConfig: (config: MixedStyleConfig) => void;
  autoDescend: boolean;
  setAutoDescend: (value: boolean) => void;
  showRevealCodes: boolean;
  setShowRevealCodes: (value: boolean) => void;
  showRowHighlight: boolean;
  setShowRowHighlight: (value: boolean) => void;
  showSlashPlaceholder: boolean;
  setShowSlashPlaceholder: (value: boolean) => void;
  undoRef: React.MutableRefObject<() => void>;
  redoRef: React.MutableRefObject<() => void>;
  canUndo: boolean;
  canRedo: boolean;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  openDialogOpen: boolean;
  setOpenDialogOpen: (open: boolean) => void;
  handleOpenDocument: (id: string) => void;
  saveAsDialogOpen: boolean;
  setSaveAsDialogOpen: (open: boolean) => void;
  handleSaveAs: (title: string, isMaster?: boolean) => Promise<void>;
  fileMenuProps: React.ComponentProps<typeof FileMenu>;
}

function NavigationAwareContent({
  document,
  masterLibraryOpen,
  setMasterLibraryOpen,
  handleNavigateToDocument,
  handlePromptSaveAsMaster,
  pendingNavigation,
  setPendingNavigation,
  handleSaveDocumentAsMaster,
  outlineStyle,
  setOutlineStyle,
  mixedConfig,
  setMixedConfig,
  autoDescend,
  setAutoDescend,
  showRevealCodes,
  setShowRevealCodes,
  showRowHighlight,
  setShowRowHighlight,
  showSlashPlaceholder,
  setShowSlashPlaceholder,
  undoRef,
  redoRef,
  canUndo,
  canRedo,
  fileInputRef,
  handleFileSelected,
  openDialogOpen,
  setOpenDialogOpen,
  handleOpenDocument,
  saveAsDialogOpen,
  setSaveAsDialogOpen,
  handleSaveAs,
  fileMenuProps,
}: NavigationAwareContentProps) {

  // Snippets navigation callback - dialog now owns pushDocument, so this just navigates
  const handleJumpFromMasterLibrary = useCallback((docId: string) => {
    // Close modal (defensive - dialog also closes itself)
    setMasterLibraryOpen(false);
    // Navigate - pushDocument('master-library') is now handled inside MasterLibraryDialog
    handleNavigateToDocument(docId, true);
  }, [setMasterLibraryOpen, handleNavigateToDocument]);

  return (
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
        showRowHighlight={showRowHighlight}
        onShowRowHighlightChange={(v) => {
          setShowRowHighlight(v);
          localStorage.setItem('outliner:showRowHighlight', String(v));
        }}
        showSlashPlaceholder={showSlashPlaceholder}
        onShowSlashPlaceholderChange={(v) => {
          setShowSlashPlaceholder(v);
          localStorage.setItem('outliner:showSlashPlaceholder', String(v));
        }}
        onUndo={() => undoRef.current()}
        onRedo={() => redoRef.current()}
        canUndo={canUndo}
        canRedo={canRedo}
        fileMenuProps={fileMenuProps}
        onNavigateToDocument={(id) => handleNavigateToDocument(id, true)}
        onJumpFromMasterLibrary={handleJumpFromMasterLibrary}
        masterLibraryOpen={masterLibraryOpen}
        onMasterLibraryOpenChange={setMasterLibraryOpen}
      />
      
      <EditorContent 
        onNavigateToDocument={(id) => handleNavigateToDocument(id, true)} 
        onPromptSaveAsMaster={handlePromptSaveAsMaster}
        pendingNavigation={pendingNavigation}
        onClearPendingNavigation={() => setPendingNavigation(null)}
        onSaveDocumentAsMaster={handleSaveDocumentAsMaster}
        onOpenMasterLibrary={() => setMasterLibraryOpen(true)}
        onJumpFromMasterLibrary={handleJumpFromMasterLibrary}
      />

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
  );
}

export default function Editor() {
  const { user, loading: authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  
  // User settings (includes startWithOutline)
  const { settings: userSettings } = useUserSettings();
  
  // Cloud-synced style preferences
  const { 
    currentMixedConfig, 
    updateMixedConfig,
    isLoading: stylesLoading,
  } = useCloudStylePreferences();
  
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>('mixed');
  const [mixedConfig, setMixedConfigLocal] = useState<MixedStyleConfig>(DEFAULT_MIXED_CONFIG);
  const [autoDescend, setAutoDescend] = useState(false);
  const [showRevealCodes, setShowRevealCodes] = useState(false);
  const [showRowHighlight, setShowRowHighlight] = useState(() => {
    const stored = localStorage.getItem('outliner:showRowHighlight');
    return stored === 'true'; // default false
  });
  const [showSlashPlaceholder, setShowSlashPlaceholder] = useState(() => {
    const stored = localStorage.getItem('outliner:showSlashPlaceholder');
    return stored === 'true'; // default false
  });
  
  // Sync cloud config to local state when loaded
  useEffect(() => {
    if (currentMixedConfig) {
      setMixedConfigLocal(currentMixedConfig);
    }
  }, [currentMixedConfig]);
  
  // Wrapper to update both local state and cloud
  const setMixedConfig = useCallback((config: MixedStyleConfig) => {
    setMixedConfigLocal(config);
    updateMixedConfig(config);
  }, [updateMixedConfig]);
  
  // Document state
  const [document, setDocument] = useState<DocumentState | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PendingNavigation | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [masterLibraryOpen, setMasterLibraryOpen] = useState(false);
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

  // Load document on mount (only runs once per user session)
  // NOTE: userSettings.startWithOutline is accessed at execution time, NOT as a dependency,
  // to prevent race conditions where settings loading overwrites navigated documents
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
        // Access startWithOutline at execution time to get current value
        const withOutline = userSettings?.startWithOutline ?? true;
        const localDoc = createLocalDocument('Untitled', withOutline);
        setDocument(localDoc);
      } catch (e) {
        console.error('Failed to load document:', e);
        // Fallback to local-only empty document
        const withOutline = userSettings?.startWithOutline ?? true;
        const localDoc = createLocalDocument('Untitled', withOutline);
        setDocument(localDoc);
      }
      setIsLoading(false);
    }
    
    if (user) {
      loadInitialDocument();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]); // Only re-run on user change, not settings changes

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

  // Debounced auto-save for document changes
  const [isSaving, setIsSaving] = useState(false);
  const { flush: flushAutoSave } = useDebouncedAutoSave({
    document,
    userId: user?.id,
    enabled: autoSaveEnabled && hasUnsavedChanges,
    delayMs: 3000,
    onSaveStart: () => setIsSaving(true),
    onSaveComplete: () => {
      setIsSaving(false);
      setHasUnsavedChanges(false);
    },
    onSaveError: () => setIsSaving(false),
  });

  // Persist current doc ID
  useEffect(() => {
    if (document?.meta?.id) {
      localStorage.setItem(CURRENT_DOC_KEY, document.meta.id);
    }
  }, [document?.meta?.id]);

  // Mixed config is now synced via useCloudStylePreferences hook

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
    // Skip confirmation if the document is empty (no real content)
    const docIsEmpty = document && isDocumentEmpty(document);
    if (hasUnsavedChanges && !docIsEmpty && !confirm('Discard unsaved changes?')) return;
    
    // Create LOCAL-ONLY document - not persisted until explicit save
    const localDoc = createLocalDocument('Untitled', userSettings.startWithOutline);
    setDocument(localDoc);
    setDocumentVersion(v => v + 1);
    setHasUnsavedChanges(true); // Mark as unsaved so user knows to save
    toast.success('New document created (not yet saved)');
  }, [hasUnsavedChanges, document, userSettings.startWithOutline]);

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
    const docIsEmpty = document && isDocumentEmpty(document);
    if (!skipConfirm && hasUnsavedChanges && !docIsEmpty && !confirm('Discard unsaved changes?')) return;
    
    try {
      const doc = await loadCloudDocument(id);
      if (doc) {
        setDocument(doc);
        setDocumentVersion(v => v + 1);
        setHasUnsavedChanges(false);
      } else {
        // Document not found - likely an unsaved local document that was in the nav stack
        toast.error('Document not found (may not have been saved)');
      }
    } catch (e) {
      console.error('Failed to open document:', e);
      toast.error('Failed to open document');
    }
  }, [hasUnsavedChanges, document]);

  // Handle prompt to save as master (just sets pending - dialog controlled by pendingNavigation)
  const handlePromptSaveAsMaster = useCallback((pending: PendingNavigation) => {
    setPendingNavigation(pending);
  }, []);

  // Save document as master (returns saved doc for EditorContent to use)
  const handleSaveDocumentAsMaster = useCallback(async (newTitle?: string): Promise<DocumentState | null> => {
    if (!user || !document) return null;
    
    try {
      const updatedDoc: DocumentState = {
        ...document,
        meta: {
          ...document.meta,
          title: newTitle || document.meta.title,
          isMaster: true,
          updatedAt: new Date().toISOString(),
        },
      };
      const saved = await saveCloudDocument(updatedDoc, user.id);
      setDocument(saved);
      setHasUnsavedChanges(false);
      toast.success(`Saved "${saved.meta.title}" as Master`);
      return saved;
    } catch (e) {
      toast.error('Failed to save document');
      return null;
    }
  }, [user, document]);

  const handleOpenDocument = useCallback(async (id: string) => {
    const docIsEmpty = document && isDocumentEmpty(document);
    if (hasUnsavedChanges && !docIsEmpty && !confirm('Discard unsaved changes?')) return;

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
  }, [hasUnsavedChanges, document]);

  const handleDelete = useCallback(async () => {
    if (!user || !document) return;
    if (!confirm('Delete this document permanently?')) return;
    
    try {
      await deleteCloudDocument(document.meta.id);
      // Clear current doc ID from localStorage
      localStorage.removeItem(CURRENT_DOC_KEY);
      // Create a new local-only document instead of auto-persisting
      const localDoc = createLocalDocument('Untitled', userSettings.startWithOutline);
      setDocument(localDoc);
      setDocumentVersion(v => v + 1);
      setHasUnsavedChanges(false);
      toast.success('Document deleted');
    } catch (e) {
      toast.error('Failed to delete document');
    }
  }, [user, document, userSettings.startWithOutline]);

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

  const handleDisplayOptionsChange = useCallback((options: DocumentDisplayOptions) => {
    setDocument(prev => prev ? {
      ...prev,
      displayOptions: options,
    } : null);
    setHasUnsavedChanges(true);
  }, []);

  const handleCitationDefinitionsChange = useCallback((definitions: Record<string, string>) => {
    setDocument(prev => prev ? {
      ...prev,
      citationDefinitions: definitions,
    } : null);
    setHasUnsavedChanges(true);
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut();
    navigate('/');
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
    isSaving,
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
        showRowHighlight={showRowHighlight}
        showSlashPlaceholder={showSlashPlaceholder}
        document={document}
        documentVersion={documentVersion}
        onDocumentContentChange={handleDocumentContentChange}
        onDocumentTitleChange={handleTitleChange}
        onHierarchyBlocksChange={handleHierarchyBlocksChange}
        onDisplayOptionsChange={handleDisplayOptionsChange}
        onCitationDefinitionsChange={handleCitationDefinitionsChange}
        onUndoRedoChange={handleUndoRedoChange}
      >
        <NavigationAwareContent
          document={document}
          masterLibraryOpen={masterLibraryOpen}
          setMasterLibraryOpen={setMasterLibraryOpen}
          handleNavigateToDocument={handleNavigateToDocument}
          handlePromptSaveAsMaster={handlePromptSaveAsMaster}
          pendingNavigation={pendingNavigation}
          setPendingNavigation={setPendingNavigation}
          handleSaveDocumentAsMaster={handleSaveDocumentAsMaster}
          outlineStyle={outlineStyle}
          setOutlineStyle={setOutlineStyle}
          mixedConfig={mixedConfig}
          setMixedConfig={setMixedConfig}
          autoDescend={autoDescend}
          setAutoDescend={setAutoDescend}
          showRevealCodes={showRevealCodes}
          setShowRevealCodes={setShowRevealCodes}
          showRowHighlight={showRowHighlight}
          setShowRowHighlight={setShowRowHighlight}
          showSlashPlaceholder={showSlashPlaceholder}
          setShowSlashPlaceholder={setShowSlashPlaceholder}
          undoRef={undoRef}
          redoRef={redoRef}
          canUndo={canUndo}
          canRedo={canRedo}
          fileInputRef={fileInputRef}
          handleFileSelected={handleFileSelected}
          openDialogOpen={openDialogOpen}
          setOpenDialogOpen={setOpenDialogOpen}
          handleOpenDocument={handleOpenDocument}
          saveAsDialogOpen={saveAsDialogOpen}
          setSaveAsDialogOpen={setSaveAsDialogOpen}
          handleSaveAs={handleSaveAs}
          fileMenuProps={fileMenuProps}
        />
      </EditorProvider>
    </NavigationProvider>
  );
}
