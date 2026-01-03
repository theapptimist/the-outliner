// Re-export all context hooks and types for convenient imports
export { DocumentProvider, useDocumentContext } from './DocumentContext';
export type { FindReplaceMatch, FindReplaceProvider, PasteHierarchyFn, ScrollToNodeFn } from './DocumentContext';

export { SelectionProvider, useSelectionContext } from './SelectionContext';
export type { SelectionSource, InsertTextAtCursorFn } from './SelectionContext';

export { TermsProvider, useTermsContext } from './TermsContext';
export type { DefinedTerm, TermUsage } from './TermsContext';
