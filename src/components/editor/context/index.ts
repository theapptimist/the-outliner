// Re-export all context hooks and types for convenient imports
export { DocumentProvider, useDocumentContext } from './DocumentContext';
export type { FindReplaceMatch, FindReplaceProvider, PasteHierarchyFn, ScrollToNodeFn, PanelState } from './DocumentContext';

export { SelectionProvider, useSelectionContext } from './SelectionContext';
export type { SelectionSource, InsertTextAtCursorFn } from './SelectionContext';

export { TermsProvider, useTermsContext } from './TermsContext';
export type { DefinedTerm, TermUsage, HighlightMode } from './TermsContext';

export { PeopleProvider, usePeopleContext } from './PeopleContext';
export type { Person, PersonUsage, PeopleHighlightMode } from './PeopleContext';

export { PlacesProvider, usePlacesContext } from './PlacesContext';
export type { Place, PlaceUsage, PlacesHighlightMode } from './PlacesContext';
