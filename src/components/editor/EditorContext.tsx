import { ReactNode } from 'react';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { DocumentState } from '@/types/document';
import { 
  DocumentProvider, 
  useDocumentContext,
  SelectionProvider, 
  useSelectionContext,
  TermsProvider, 
  useTermsContext 
} from './context';

// Re-export types for backward compatibility
export type { FindReplaceMatch, FindReplaceProvider, PasteHierarchyFn, ScrollToNodeFn } from './context';
export type { SelectionSource, InsertTextAtCursorFn } from './context';
export type { DefinedTerm, TermUsage, HighlightMode } from './context';

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
  const documentId = document?.meta?.id ?? 'default';

  return (
    <DocumentProvider
      outlineStyle={outlineStyle}
      mixedConfig={mixedConfig}
      autoDescend={autoDescend}
      showRevealCodes={showRevealCodes}
      document={document}
      documentVersion={documentVersion}
      onDocumentContentChange={onDocumentContentChange}
      onUndoRedoChange={onUndoRedoChange}
    >
      <SelectionProvider>
        <TermsProvider documentId={documentId} documentVersion={documentVersion}>
          {children}
        </TermsProvider>
      </SelectionProvider>
    </DocumentProvider>
  );
}

// Unified hook that combines all contexts for backward compatibility
export function useEditorContext() {
  const documentContext = useDocumentContext();
  const selectionContext = useSelectionContext();
  const termsContext = useTermsContext();

  return {
    ...documentContext,
    ...selectionContext,
    ...termsContext,
  };
}

// Also export individual hooks for focused usage
export { useDocumentContext, useSelectionContext, useTermsContext };
