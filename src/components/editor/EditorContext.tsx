import { ReactNode, createContext, useContext, useCallback } from 'react';
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
import { useNavigation, EntityTab } from '@/contexts/NavigationContext';
import { normalizeEntityName } from '@/lib/entityNameUtils';

// Re-export types for backward compatibility
export type { FindReplaceMatch, FindReplaceProvider, PasteHierarchyFn, ScrollToNodeFn, PanelState, CitationDefinitions } from './context';
export type { SelectionSource, InsertTextAtCursorFn } from './context';
export type { DefinedTerm, TermUsage, HighlightMode } from './context';
export type { Person, PersonUsage, PeopleHighlightMode } from './context';
export type { Place, PlaceUsage, PlacesHighlightMode } from './context';
export type { TaggedDate, DateUsage, DateHighlightMode } from './context/DatesContext';

// Entity reveal context for click-to-reveal functionality
export type EntityType = 'term' | 'person' | 'place' | 'date';

interface EntityRevealContextValue {
  revealEntityInLibrary: (entityType: EntityType, matchedText: string) => void;
}

const EntityRevealContext = createContext<EntityRevealContextValue>({
  revealEntityInLibrary: () => {},
});

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
  onDocumentTitleChange?: (title: string) => void;
  onHierarchyBlocksChange?: (blocks: Record<string, any>) => void;
  onUndoRedoChange?: (
    undo: () => void,
    redo: () => void,
    canUndo: boolean,
    canRedo: boolean
  ) => void;
}

// Inner provider that has access to all entity contexts
function EntityRevealProvider({ children }: { children: ReactNode }) {
  const { setActiveSidebarTab, setActiveEntityTab } = useNavigation();
  const termsContext = useTermsContext();
  const datesContext = useDatesContext();
  const peopleContext = usePeopleContext();
  const placesContext = usePlacesContext();

  const revealEntityInLibrary = useCallback((entityType: EntityType, matchedText: string) => {
    // Normalize the clicked text to match how entities are stored
    const normalizedText = normalizeEntityName(matchedText).toLowerCase();
    
    console.log('[EntityReveal] Click detected:', { entityType, matchedText, normalizedText });
    
    // Find the entity and set it as inspected
    switch (entityType) {
      case 'term': {
        const term = termsContext.terms.find(t => 
          normalizeEntityName(t.term).toLowerCase() === normalizedText
        );
        console.log('[EntityReveal] Term search:', { found: !!term, termsCount: termsContext.terms.length });
        if (term) {
          termsContext.setInspectedTerm(term);
          setActiveEntityTab('terms');
        }
        break;
      }
      case 'person': {
        const person = peopleContext.people.find(p => 
          normalizeEntityName(p.name).toLowerCase() === normalizedText
        );
        console.log('[EntityReveal] Person search:', { found: !!person, peopleCount: peopleContext.people.length });
        if (person) {
          peopleContext.setInspectedPerson(person);
          setActiveEntityTab('people');
        }
        break;
      }
      case 'place': {
        const place = placesContext.places.find(p => 
          normalizeEntityName(p.name).toLowerCase() === normalizedText
        );
        console.log('[EntityReveal] Place search:', { found: !!place, placesCount: placesContext.places.length });
        if (place) {
          placesContext.setInspectedPlace(place);
          setActiveEntityTab('places');
        }
        break;
      }
      case 'date': {
        const date = datesContext.dates.find(d => 
          normalizeEntityName(d.rawText).toLowerCase() === normalizedText
        );
        console.log('[EntityReveal] Date search:', { found: !!date, datesCount: datesContext.dates.length });
        if (date) {
          datesContext.setInspectedDate(date);
          setActiveEntityTab('dates');
        }
        break;
      }
    }
    
    // Switch to library tab
    setActiveSidebarTab('library');
  }, [
    termsContext, datesContext, peopleContext, placesContext,
    setActiveSidebarTab, setActiveEntityTab
  ]);

  return (
    <EntityRevealContext.Provider value={{ revealEntityInLibrary }}>
      {children}
    </EntityRevealContext.Provider>
  );
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
  onDocumentTitleChange,
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
      onDocumentTitleChange={onDocumentTitleChange}
      onHierarchyBlocksChange={onHierarchyBlocksChange}
      onUndoRedoChange={onUndoRedoChange}
    >
      <SelectionProvider>
        <TermsProvider documentId={documentId} documentVersion={documentVersion}>
          <DatesProvider documentId={documentId} documentVersion={documentVersion}>
            <PeopleProvider documentId={documentId} documentVersion={documentVersion}>
              <PlacesProvider documentId={documentId} documentVersion={documentVersion}>
                <EntityRevealProvider>
                  {children}
                </EntityRevealProvider>
              </PlacesProvider>
            </PeopleProvider>
          </DatesProvider>
        </TermsProvider>
      </SelectionProvider>
    </DocumentProvider>
  );
}

// Hook to access entity reveal functionality
export function useEntityReveal() {
  return useContext(EntityRevealContext);
}

// Unified hook that combines all contexts for backward compatibility
export function useEditorContext() {
  const documentContext = useDocumentContext();
  const selectionContext = useSelectionContext();
  const termsContext = useTermsContext();
  const datesContext = useDatesContext();
  const peopleContext = usePeopleContext();
  const placesContext = usePlacesContext();
  const entityRevealContext = useContext(EntityRevealContext);

  return {
    ...documentContext,
    ...selectionContext,
    ...termsContext,
    ...datesContext,
    ...peopleContext,
    ...placesContext,
    ...entityRevealContext,
  };
}

// Also export individual hooks for focused usage
export { useDocumentContext, useSelectionContext, useTermsContext, useDatesContext, usePeopleContext, usePlacesContext };
