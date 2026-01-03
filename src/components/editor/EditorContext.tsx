import { createContext, useContext, ReactNode, useState, useCallback, useRef, useEffect } from 'react';
import { Editor } from '@tiptap/react';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { HierarchyNode } from '@/types/node';
import { DefinedTerm } from './DefinedTermsPane';
import { DocumentState } from '@/types/document';

export type FindReplaceMatch =
  | { kind: 'tiptap'; from: number; to: number }
  | { kind: 'hierarchy'; providerId: string; nodeId: string; start: number; end: number };

export interface FindReplaceProvider {
  id: string;
  label: string;
  find: (term: string, caseSensitive: boolean) => FindReplaceMatch[];
  focus: (match: FindReplaceMatch) => void;
  replace: (match: FindReplaceMatch, replacement: string) => void;
  replaceAll: (term: string, replacement: string, caseSensitive: boolean) => number;
}

export interface SelectionSource {
  nodePrefix: string;
  nodeLabel: string;
}

// Callback type for inserting text at cursor and returning location info
export type InsertTextAtCursorFn = (text: string) => { nodePrefix: string; nodeLabel: string } | null;

// Callback type for scrolling to and highlighting a node
export type ScrollToNodeFn = (nodeId: string) => void;

interface EditorContextValue {
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  
  // Document state
  document: DocumentState | null;
  documentVersion: number;
  setDocumentContent: (content: any) => void;

  // TipTap editor (optional)
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;

  // Text selection tracking for defined terms
  selectedText: string;
  setSelectedText: (text: string) => void;
  
  // Source location of the selected text (outline context)
  selectionSource: SelectionSource | null;
  setSelectionSource: (source: SelectionSource | null) => void;

  // Node clipboard for copy/paste
  nodeClipboard: HierarchyNode[] | null;
  setNodeClipboard: (nodes: HierarchyNode[] | null) => void;

  // Insert text at cursor position in active outline (for term insertion)
  insertTextAtCursor: InsertTextAtCursorFn | null;
  setInsertTextAtCursor: (fn: InsertTextAtCursorFn | null) => void;

  // Scroll to and highlight a node
  scrollToNode: ScrollToNodeFn | null;
  setScrollToNode: (fn: ScrollToNodeFn | null) => void;

  // Term inspection state (for the right panel)
  inspectedTerm: DefinedTerm | null;
  setInspectedTerm: (term: DefinedTerm | null) => void;

  // Commands owned by DocumentEditor
  onInsertHierarchy: () => void;
  setInsertHierarchyHandler: (handler: () => void) => void;
  onFindReplace: (withReplace: boolean) => void;
  setFindReplaceHandler: (handler: (withReplace: boolean) => void) => void;

  // Search scopes
  findReplaceProviders: FindReplaceProvider[];
  registerFindReplaceProvider: (provider: FindReplaceProvider) => void;
  unregisterFindReplaceProvider: (providerId: string) => void;

  // Undo/redo (currently from the active outline block)
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
  
  document: null,
  documentVersion: 0,
  setDocumentContent: () => {},

  editor: null,
  setEditor: () => {},

  selectedText: '',
  setSelectedText: () => {},
  
  selectionSource: null,
  setSelectionSource: () => {},

  nodeClipboard: null,
  setNodeClipboard: () => {},

  insertTextAtCursor: null,
  setInsertTextAtCursor: () => {},

  scrollToNode: null,
  setScrollToNode: () => {},

  inspectedTerm: null,
  setInspectedTerm: () => {},

  onInsertHierarchy: () => {},
  setInsertHierarchyHandler: () => {},
  onFindReplace: () => {},
  setFindReplaceHandler: () => {},

  findReplaceProviders: [],
  registerFindReplaceProvider: () => {},
  unregisterFindReplaceProvider: () => {},

  registerUndoRedo: () => {},
});

interface EditorProviderProps {
  children: ReactNode;
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  document: DocumentState;
  documentVersion: number;
  onDocumentContentChange: (content: any) => void;
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
  document,
  documentVersion,
  onDocumentContentChange,
  onUndoRedoChange,
}: EditorProviderProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [selectedText, setSelectedText] = useState('');
  const [selectionSource, setSelectionSource] = useState<SelectionSource | null>(null);
  const [nodeClipboard, setNodeClipboard] = useState<HierarchyNode[] | null>(null);
  const [insertTextAtCursorFn, setInsertTextAtCursorFn] = useState<InsertTextAtCursorFn | null>(null);
  const [scrollToNodeFn, setScrollToNodeFn] = useState<ScrollToNodeFn | null>(null);
  const [inspectedTerm, setInspectedTerm] = useState<DefinedTerm | null>(null);
  const [insertHierarchyHandler, setInsertHierarchyHandlerState] = useState<() => void>(() => () => {});
  const [findReplaceHandler, setFindReplaceHandlerState] = useState<(withReplace: boolean) => void>(() => () => {});
  const [findReplaceProviders, setFindReplaceProviders] = useState<FindReplaceProvider[]>([]);
  const setInsertHierarchyHandler = useCallback((handler: () => void) => {
    setInsertHierarchyHandlerState(() => handler);
  }, []);

  const setFindReplaceHandler = useCallback((handler: (withReplace: boolean) => void) => {
    setFindReplaceHandlerState(() => handler);
  }, []);

  const setInsertTextAtCursor = useCallback((fn: InsertTextAtCursorFn | null) => {
    setInsertTextAtCursorFn(() => fn);
  }, []);

  const setScrollToNode = useCallback((fn: ScrollToNodeFn | null) => {
    setScrollToNodeFn(() => fn);
  }, []);

  const registerFindReplaceProvider = useCallback((provider: FindReplaceProvider) => {
    setFindReplaceProviders(prev => {
      const next = prev.filter(p => p.id !== provider.id);
      next.push(provider);
      return next;
    });
  }, []);

  const unregisterFindReplaceProvider = useCallback((providerId: string) => {
    setFindReplaceProviders(prev => prev.filter(p => p.id !== providerId));
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
        document,
        documentVersion,
        setDocumentContent: onDocumentContentChange,
        editor,
        setEditor,
        selectedText,
        setSelectedText,
        selectionSource,
        setSelectionSource,
        nodeClipboard,
        setNodeClipboard,
        insertTextAtCursor: insertTextAtCursorFn,
        setInsertTextAtCursor,
        scrollToNode: scrollToNodeFn,
        setScrollToNode,
        inspectedTerm,
        setInspectedTerm,
        onInsertHierarchy: insertHierarchyHandler,
        setInsertHierarchyHandler,
        onFindReplace: findReplaceHandler,
        setFindReplaceHandler,
        findReplaceProviders,
        registerFindReplaceProvider,
        unregisterFindReplaceProvider,
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
