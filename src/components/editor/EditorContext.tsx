import { ReactNode } from 'react';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { DocumentState } from '@/types/document';
import { 
  DocumentProvider, 
  useDocumentContext,
  SelectionProvider, 
  useSelectionContext,
  TermsProvider, 
  useTermsContext,
  PeopleProvider,
  usePeopleContext,
  PlacesProvider,
  usePlacesContext,
} from './context';
import { DatesProvider, useDatesContext } from './context/DatesContext';

// Re-export types for backward compatibility
export type { FindReplaceMatch, FindReplaceProvider, PasteHierarchyFn, ScrollToNodeFn, PanelState, CitationDefinitions } from './context';
export type { SelectionSource, InsertTextAtCursorFn } from './context';
export type { DefinedTerm, TermUsage, HighlightMode } from './context';
export type { Person, PersonUsage, PeopleHighlightMode } from './context';
export type { Place, PlaceUsage, PlacesHighlightMode } from './context';
export type { TaggedDate, DateUsage, DateHighlightMode } from './context/DatesContext';

interface EditorProviderProps {
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
  onHierarchyBlocksChange?: (blocks: Record<string, any>) => void;
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
  showRowHighlight,
  showSlashPlaceholder,
  document,
  documentVersion,
  onDocumentContentChange,
  onHierarchyBlocksChange,
  onUndoRedoChange,
}: EditorProviderProps) {
  const documentId = document?.meta?.id ?? 'default';

  return (
    <DocumentProvider
      outlineStyle={outlineStyle}
      mixedConfig={mixedConfig}
      autoDescend={autoDescend}
      showRevealCodes={showRevealCodes}
      showRowHighlight={showRowHighlight}
      showSlashPlaceholder={showSlashPlaceholder}
      document={document}
      documentVersion={documentVersion}
      onDocumentContentChange={onDocumentContentChange}
      onHierarchyBlocksChange={onHierarchyBlocksChange}
      onUndoRedoChange={onUndoRedoChange}
    >
      <SelectionProvider>
        <TermsProvider documentId={documentId} documentVersion={documentVersion}>
          <DatesProvider documentId={documentId} documentVersion={documentVersion}>
            <PeopleProvider documentId={documentId} documentVersion={documentVersion}>
              <PlacesProvider documentId={documentId} documentVersion={documentVersion}>
                {children}
              </PlacesProvider>
            </PeopleProvider>
          </DatesProvider>
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
  const datesContext = useDatesContext();
  const peopleContext = usePeopleContext();
  const placesContext = usePlacesContext();

  return {
    ...documentContext,
    ...selectionContext,
    ...termsContext,
    ...datesContext,
    ...peopleContext,
    ...placesContext,
  };
}

// Also export individual hooks for focused usage
export { useDocumentContext, useSelectionContext, useTermsContext, useDatesContext, usePeopleContext, usePlacesContext };
