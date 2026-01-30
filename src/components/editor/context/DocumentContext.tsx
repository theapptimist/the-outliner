import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import { OutlineStyle, MixedStyleConfig, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { DocumentState } from '@/types/document';
import { HierarchyNode } from '@/types/node';

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

// Callback type for pasting AI-generated hierarchy items
export type PasteHierarchyFn = (items: Array<{ label: string; depth: number }>) => void;

// Callback type for scrolling to and highlighting a node
export type ScrollToNodeFn = (nodeId: string) => void;

// Callback type for navigating to a linked document
export type NavigateToDocumentFn = (documentId: string, documentTitle: string) => void;

// Panel state for AI toolbar
export interface PanelState {
  openPanelCount: number;
  totalSectionCount: number;
  onOpenAllPanels: () => void;
  onCloseAllPanels: () => void;
}

interface DocumentContextValue {
  // Style settings
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  showRowHighlight: boolean;
  showSlashPlaceholder: boolean;
  
  // Document state
  document: DocumentState | null;
  documentVersion: number;
  setDocumentContent: (content: any) => void;

  // Hierarchy block sync for usage scanning
  hierarchyBlocks: Record<string, HierarchyNode[]>;
  updateHierarchyBlock: (blockId: string, tree: HierarchyNode[]) => void;
  removeHierarchyBlock: (blockId: string) => void;

  // TipTap editor
  editor: Editor | null;
  setEditor: (editor: Editor | null) => void;

  // Node clipboard for copy/paste
  nodeClipboard: HierarchyNode[] | null;
  setNodeClipboard: (nodes: HierarchyNode[] | null) => void;

  // Scroll to and highlight a node
  scrollToNode: ScrollToNodeFn | null;
  setScrollToNode: (fn: ScrollToNodeFn | null) => void;

  // Navigate to a linked document
  navigateToDocument: NavigateToDocumentFn | null;
  setNavigateToDocument: (fn: NavigateToDocumentFn | null) => void;

  // AI-generated hierarchy paste handler
  onPasteHierarchy: PasteHierarchyFn | null;
  setOnPasteHierarchy: (fn: PasteHierarchyFn | null) => void;

  // Commands owned by DocumentEditor
  onInsertHierarchy: () => void;
  setInsertHierarchyHandler: (handler: () => void) => void;
  onFindReplace: (withReplace: boolean) => void;
  setFindReplaceHandler: (handler: (withReplace: boolean) => void) => void;

  // Search scopes
  findReplaceProviders: FindReplaceProvider[];
  registerFindReplaceProvider: (provider: FindReplaceProvider) => void;
  unregisterFindReplaceProvider: (providerId: string) => void;

  // Undo/redo
  registerUndoRedo: (
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => void;

  // Panel state for AI toolbar
  panelState: PanelState;
  setPanelState: (state: PanelState) => void;
}

const DocumentContext = createContext<DocumentContextValue>({
  outlineStyle: 'mixed',
  mixedConfig: DEFAULT_MIXED_CONFIG,
  autoDescend: false,
  showRevealCodes: false,
  showRowHighlight: true,
  showSlashPlaceholder: false,
  
  document: null,
  documentVersion: 0,
  setDocumentContent: () => {},

  hierarchyBlocks: {},
  updateHierarchyBlock: () => {},
  removeHierarchyBlock: () => {},

  editor: null,
  setEditor: () => {},

  nodeClipboard: null,
  setNodeClipboard: () => {},

  scrollToNode: null,
  setScrollToNode: () => {},

  navigateToDocument: null,
  setNavigateToDocument: () => {},

  onPasteHierarchy: null,
  setOnPasteHierarchy: () => {},

  onInsertHierarchy: () => {},
  setInsertHierarchyHandler: () => {},
  onFindReplace: () => {},
  setFindReplaceHandler: () => {},

  findReplaceProviders: [],
  registerFindReplaceProvider: () => {},
  unregisterFindReplaceProvider: () => {},

  registerUndoRedo: () => {},

  panelState: { openPanelCount: 0, totalSectionCount: 0, onOpenAllPanels: () => {}, onCloseAllPanels: () => {} },
  setPanelState: () => {},
});

interface DocumentProviderProps {
  children: ReactNode;
  outlineStyle: OutlineStyle;
  mixedConfig: MixedStyleConfig;
  autoDescend: boolean;
  showRevealCodes: boolean;
  showRowHighlight: boolean;
  showSlashPlaceholder: boolean;
  document: DocumentState;
  documentVersion: number;
  onDocumentContentChange: (content: any) => void;
  onHierarchyBlocksChange?: (blocks: Record<string, { id: string; tree: HierarchyNode[] }>) => void;
  onUndoRedoChange?: (
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => void;
}

export function DocumentProvider({
  children,
  outlineStyle,
  mixedConfig,
  autoDescend,
  showRevealCodes,
  showRowHighlight,
  showSlashPlaceholder,
  document,
  documentVersion,
  onDocumentContentChange,
  onHierarchyBlocksChange,
  onUndoRedoChange,
}: DocumentProviderProps) {
  const [editor, setEditor] = useState<Editor | null>(null);
  const [nodeClipboard, setNodeClipboard] = useState<HierarchyNode[] | null>(null);
  const [scrollToNodeFn, setScrollToNodeFn] = useState<ScrollToNodeFn | null>(null);
  const [navigateToDocumentFn, setNavigateToDocumentFn] = useState<NavigateToDocumentFn | null>(null);
  const [pasteHierarchyFn, setPasteHierarchyFn] = useState<PasteHierarchyFn | null>(null);
  const [insertHierarchyHandler, setInsertHierarchyHandlerState] = useState<() => void>(() => () => {});
  const [findReplaceHandler, setFindReplaceHandlerState] = useState<(withReplace: boolean) => void>(() => () => {});
  const [findReplaceProviders, setFindReplaceProviders] = useState<FindReplaceProvider[]>([]);
  const [hierarchyBlocks, setHierarchyBlocks] = useState<Record<string, HierarchyNode[]>>({});
  const [panelState, setPanelState] = useState<PanelState>({
    openPanelCount: 0,
    totalSectionCount: 0,
    onOpenAllPanels: () => {},
    onCloseAllPanels: () => {},
  });

  const updateHierarchyBlock = useCallback((blockId: string, tree: HierarchyNode[]) => {
    setHierarchyBlocks(prev => {
      const next = {
        ...prev,
        [blockId]: tree,
      };
      // Notify parent of hierarchy changes for cloud persistence
      // Convert to HierarchyBlockData format: { id, tree }
      const blocksData: Record<string, { id: string; tree: HierarchyNode[] }> = {};
      for (const [id, t] of Object.entries(next)) {
        blocksData[id] = { id, tree: t };
      }
      onHierarchyBlocksChange?.(blocksData);
      return next;
    });
  }, [onHierarchyBlocksChange]);

  const removeHierarchyBlock = useCallback((blockId: string) => {
    setHierarchyBlocks(prev => {
      const { [blockId]: _, ...rest } = prev;
      // Notify parent of hierarchy changes for cloud persistence
      // Convert to HierarchyBlockData format: { id, tree }
      const blocksData: Record<string, { id: string; tree: HierarchyNode[] }> = {};
      for (const [id, t] of Object.entries(rest)) {
        blocksData[id] = { id, tree: t };
      }
      onHierarchyBlocksChange?.(blocksData);
      return rest;
    });
  }, [onHierarchyBlocksChange]);

  const setOnPasteHierarchy = useCallback((fn: PasteHierarchyFn | null) => {
    setPasteHierarchyFn(() => fn);
  }, []);

  const setInsertHierarchyHandler = useCallback((handler: () => void) => {
    setInsertHierarchyHandlerState(() => handler);
  }, []);

  const setFindReplaceHandler = useCallback((handler: (withReplace: boolean) => void) => {
    setFindReplaceHandlerState(() => handler);
  }, []);

  const setScrollToNode = useCallback((fn: ScrollToNodeFn | null) => {
    setScrollToNodeFn(() => fn);
  }, []);

  const setNavigateToDocument = useCallback((fn: NavigateToDocumentFn | null) => {
    setNavigateToDocumentFn(() => fn);
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

  const registerUndoRedo = useCallback((
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => {
    onUndoRedoChange?.(undo, redo, canUndo, canRedo);
  }, [onUndoRedoChange]);

  return (
    <DocumentContext.Provider
      value={{
        outlineStyle,
        mixedConfig,
        autoDescend,
        showRevealCodes,
        showRowHighlight,
        showSlashPlaceholder,
        document,
        documentVersion,
        setDocumentContent: onDocumentContentChange,
        hierarchyBlocks,
        updateHierarchyBlock,
        removeHierarchyBlock,
        editor,
        setEditor,
        nodeClipboard,
        setNodeClipboard,
        scrollToNode: scrollToNodeFn,
        setScrollToNode,
        navigateToDocument: navigateToDocumentFn,
        setNavigateToDocument,
        onPasteHierarchy: pasteHierarchyFn,
        setOnPasteHierarchy,
        onInsertHierarchy: insertHierarchyHandler,
        setInsertHierarchyHandler,
        onFindReplace: findReplaceHandler,
        setFindReplaceHandler,
        findReplaceProviders,
        registerFindReplaceProvider,
        unregisterFindReplaceProvider,
        registerUndoRedo,
        panelState,
        setPanelState,
      }}
    >
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocumentContext() {
  return useContext(DocumentContext);
}
