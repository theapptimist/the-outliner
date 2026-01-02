import { useState, useCallback, useRef, useEffect } from 'react';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { EditorProvider, useEditorContext } from '@/components/editor/EditorContext';
import { TermUsagesPane } from '@/components/editor/TermUsagesPane';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';

const MIXED_CONFIG_STORAGE_KEY = 'outline-mixed-config';

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

// Inner component that uses EditorContext
function EditorContent({
  outlineStyle,
  onOutlineStyleChange,
  mixedConfig,
  onMixedConfigChange,
  autoDescend,
  onAutoDescendChange,
  showRevealCodes,
  onShowRevealCodesChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: {
  outlineStyle: OutlineStyle;
  onOutlineStyleChange: (style: OutlineStyle) => void;
  mixedConfig: MixedStyleConfig;
  onMixedConfigChange: (config: MixedStyleConfig) => void;
  autoDescend: boolean;
  onAutoDescendChange: (v: boolean) => void;
  showRevealCodes: boolean;
  onShowRevealCodesChange: (v: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}) {
  const { inspectedTerm, setInspectedTerm } = useEditorContext();
  
  return (
    <div className="flex-1 flex overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Main Editor Panel */}
        <ResizablePanel defaultSize={inspectedTerm ? 70 : 100} minSize={40}>
          <div className="flex flex-col h-full overflow-hidden">
            <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <h1 className="text-lg font-semibold text-foreground">The Outliner</h1>
              <p className="text-sm text-muted-foreground">Type "/" for commands</p>
            </header>
            <main className="flex-1 overflow-hidden">
              <DocumentEditor />
            </main>
          </div>
        </ResizablePanel>
        
        {/* Right Panel - Term Usages (conditionally rendered) */}
        {inspectedTerm && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
              <TermUsagesPane 
                term={inspectedTerm} 
                onClose={() => setInspectedTerm(null)} 
              />
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}

export default function Editor() {
  const [outlineStyle, setOutlineStyle] = useState<OutlineStyle>('mixed');
  const [mixedConfig, setMixedConfig] = useState<MixedStyleConfig>(loadMixedConfig);
  const [autoDescend, setAutoDescend] = useState(false);
  const [showRevealCodes, setShowRevealCodes] = useState(false);
  
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

  // Save mixed config when it changes
  useEffect(() => {
    saveMixedConfig(mixedConfig);
  }, [mixedConfig]);

  // Global keyboard handler for reveal codes
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey && e.key === 'F3') {
        e.preventDefault();
        setShowRevealCodes(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <EditorProvider
      outlineStyle={outlineStyle}
      mixedConfig={mixedConfig}
      autoDescend={autoDescend}
      showRevealCodes={showRevealCodes}
      onUndoRedoChange={handleUndoRedoChange}
    >
      <div className="h-screen flex bg-background">
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
        />
        
        <EditorContent
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
        />
      </div>
    </EditorProvider>
  );
}
