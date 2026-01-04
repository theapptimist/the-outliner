import { useState, useCallback, useRef, useEffect } from 'react';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { EditorProvider, useEditorContext } from '@/components/editor/EditorContext';
import { TermUsagesPane } from '@/components/editor/TermUsagesPane';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import { OpenDocumentDialog } from '@/components/editor/OpenDocumentDialog';
import { SaveAsDialog } from '@/components/editor/SaveAsDialog';
import { DocumentState, createEmptyDocument } from '@/types/document';
import {
  loadDocument,
  saveDocument,
  deleteDocument,
  exportDocument,
  importDocument,
  createNewDocument,
} from '@/lib/documentStorage';
import { toast } from 'sonner';

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

function loadCurrentDocument(): DocumentState {
  try {
    const currentId = localStorage.getItem(CURRENT_DOC_KEY);
    if (currentId) {
      const doc = loadDocument(currentId);
      if (doc) return doc;
    }
  } catch (e) {
    console.warn('Failed to load current document:', e);
  }
  // Create AND save new document so it appears in storage/recent
  return createNewDocument('Untitled');
}

// Inner component that uses EditorContext
function EditorContent() {
  const { inspectedTerm, setInspectedTerm, documentVersion } = useEditorContext();

  // Key the panel group so defaultSize recalculates when the usages pane opens/closes
  const layoutKey = inspectedTerm ? `usages:${inspectedTerm.id}` : 'usages:none';

  return (
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
  );
}

export default function Editor() {
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>('mixed');
  const [mixedConfig, setMixedConfig] = useState<MixedStyleConfig>(loadMixedConfig);
  const [autoDescend, setAutoDescend] = useState(false);
  const [showRevealCodes, setShowRevealCodes] = useState(false);
  
  // Document state
  const [document, setDocument] = useState<DocumentState>(loadCurrentDocument);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [documentVersion, setDocumentVersion] = useState(0);
  const [openDialogOpen, setOpenDialogOpen] = useState(false);
  const [saveAsDialogOpen, setSaveAsDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Undo/redo state passed up from document
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  
  // Refs for undo/redo callbacks
  const undoRef = useRef<() => void>(() => {});
  const redoRef = useRef<() => void>(() => {});

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
    localStorage.setItem(CURRENT_DOC_KEY, document.meta.id);
  }, [document.meta.id]);

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
    const newDoc = createNewDocument('Untitled');
    setDocument(newDoc);
    setDocumentVersion(v => v + 1);
    setHasUnsavedChanges(false);
    toast.success('New document created');
  }, [hasUnsavedChanges]);

  const handleSave = useCallback(() => {
    const saved = saveDocument(document);
    setDocument(saved);
    setHasUnsavedChanges(false);
    toast.success('Document saved');
  }, [document]);

  const handleSaveAs = useCallback((title: string) => {
    const newDoc: DocumentState = {
      ...document,
      meta: {
        ...document.meta,
        id: crypto.randomUUID(),
        title,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
    const saved = saveDocument(newDoc);
    setDocument(saved);
    setDocumentVersion(v => v + 1);
    setHasUnsavedChanges(false);
    toast.success(`Saved as "${title}"`);
  }, [document]);

  const handleOpenDocument = useCallback((id: string) => {
    if (hasUnsavedChanges && !confirm('Discard unsaved changes?')) return;
    const doc = loadDocument(id);
    if (doc) {
      setDocument(doc);
      setDocumentVersion(v => v + 1);
      setHasUnsavedChanges(false);
      toast.success(`Opened "${doc.meta.title}"`);
    } else {
      toast.error('Document not found');
    }
  }, [hasUnsavedChanges]);

  const handleDelete = useCallback(() => {
    if (!confirm('Delete this document permanently?')) return;
    deleteDocument(document.meta.id);
    const newDoc = createNewDocument('Untitled');
    setDocument(newDoc);
    setDocumentVersion(v => v + 1);
    setHasUnsavedChanges(false);
    toast.success('Document deleted');
  }, [document.meta.id]);

  const handleExport = useCallback(() => {
    exportDocument(document);
    toast.success('Document exported');
  }, [document]);

  const handleImport = useCallback(async () => {
    fileInputRef.current?.click();
  }, []);

  const handleFileSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const imported = await importDocument(file);
      setDocument(imported);
      setDocumentVersion(v => v + 1);
      setHasUnsavedChanges(false);
      toast.success('Document imported');
    } catch (err) {
      toast.error('Failed to import document');
    }
    e.target.value = '';
  }, []);

  const handleTitleChange = useCallback((title: string) => {
    setDocument(prev => ({
      ...prev,
      meta: { ...prev.meta, title },
    }));
    setHasUnsavedChanges(true);
  }, []);

  const handleDocumentContentChange = useCallback((content: any) => {
    setDocument(prev => ({
      ...prev,
      content,
    }));
    setHasUnsavedChanges(true);
  }, []);

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
    hasDocument: true,
  };

  return (
    <EditorProvider
      outlineStyle={outlineStyle}
      mixedConfig={mixedConfig}
      autoDescend={autoDescend}
      showRevealCodes={showRevealCodes}
      document={document}
      documentVersion={documentVersion}
      onDocumentContentChange={handleDocumentContentChange}
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
        />
        
        <EditorContent />

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
        />
      </div>
    </EditorProvider>
  );
}
