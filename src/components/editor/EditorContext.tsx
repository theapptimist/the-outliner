import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';

interface EditorContextValue {
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;
  onInsertHierarchy: () => void;
  setInsertHierarchyHandler: (handler: () => void) => void;
  onFindReplace: (withReplace: boolean) => void;
  setFindReplaceHandler: (handler: (withReplace: boolean) => void) => void;
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
  editor: null,
  setEditor: () => {},
  onInsertHierarchy: () => {},
  setInsertHierarchyHandler: () => {},
  onFindReplace: () => {},
  setFindReplaceHandler: () => {},
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
  const [editor, setEditor] = useState<Editor | null>(null);
  const [insertHierarchyHandler, setInsertHierarchyHandlerState] = useState<() => void>(() => () => {});
  const [findReplaceHandler, setFindReplaceHandlerState] = useState<(withReplace: boolean) => void>(() => () => {});

  const setInsertHierarchyHandler = useCallback((handler: () => void) => {
    setInsertHierarchyHandlerState(() => handler);
  }, []);

  const setFindReplaceHandler = useCallback((handler: (withReplace: boolean) => void) => {
    setFindReplaceHandlerState(() => handler);
  }, []);

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
        editor,
        setEditor,
        onInsertHierarchy: insertHierarchyHandler,
        setInsertHierarchyHandler,
        onFindReplace: findReplaceHandler,
        setFindReplaceHandler,
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
