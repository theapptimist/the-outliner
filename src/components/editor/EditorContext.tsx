import { createContext, useContext, ReactNode } from 'react';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';

interface EditorContextValue {
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  registerUndoRedo: (
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => void;
}

const EditorContext = createContext<EditorContextValue>({
  outlineStyle: 'mixed',
  mixedConfig: DEFAULT_MIXED_CONFIG,
  autoDescend: false,
  showRevealCodes: false,
  registerUndoRedo: () => {},
});

interface EditorProviderProps {
  children: ReactNode;
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  onUndoRedoChange?: (
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => void;
}

export function EditorProvider({
  children,
  outlineStyle,
  mixedConfig,
  autoDescend,
  showRevealCodes,
  onUndoRedoChange,
}: EditorProviderProps) {
  const registerUndoRedo = (
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => {
    onUndoRedoChange?.(undo, redo, canUndo, canRedo);
  };

  return (
    <EditorContext.Provider
      value={{
        outlineStyle,
        mixedConfig,
        autoDescend,
        showRevealCodes,
        registerUndoRedo,
      }}
    >
      {children}
    </EditorContext.Provider>
  );
}

export function useEditorContext() {
  return useContext(EditorContext);
}
