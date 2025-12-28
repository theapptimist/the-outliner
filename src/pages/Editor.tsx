import { useState, useCallback, useRef, useEffect } from 'react';
import { DocumentEditor } from '@/components/editor/DocumentEditor';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { EditorProvider } from '@/components/editor/EditorContext';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';

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
        
        <div className="flex-1 flex flex-col overflow-hidden">
          <header className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
            <h1 className="text-lg font-semibold text-foreground">The Outliner</h1>
            <p className="text-sm text-muted-foreground">Type "/" for commands</p>
          </header>
          <main className="flex-1 overflow-hidden">
            <DocumentEditor />
          </main>
        </div>
      </div>
    </EditorProvider>
  );
}
