import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { HierarchyNode } from '@/types/node';
import { scanForTermUsages } from '@/lib/termScanner';

// Highlight mode for terms in document
export type HighlightMode = 'all' | 'selected' | 'none';

// Term usage tracking
export interface TermUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  count: number;
}

// Defined term structure
export interface DefinedTerm {
  id: string;
  term: string;
  definition: string;
  sourceLocation?: {
    prefix: string;
    label: string;
  };
  usages: TermUsage[];
}

interface TermsContextValue {
  // Terms data
  terms: DefinedTerm[];
  setTerms: React.Dispatch<React.SetStateAction<DefinedTerm[]>>;
  addTerm: (term: string, definition: string, source?: { nodePrefix: string; nodeLabel: string }) => void;
  
  // Term inspection state (for the usages panel - controls panel open/close)
  inspectedTerm: DefinedTerm | null;
  setInspectedTerm: (term: DefinedTerm | null) => void;

  // Highlighted term (for "selected" highlight mode - controls which term is highlighted in doc)
  highlightedTerm: DefinedTerm | null;
  setHighlightedTerm: (term: DefinedTerm | null) => void;

  // Highlight mode
  highlightMode: HighlightMode;
  setHighlightMode: (mode: HighlightMode) => void;

  // Add extracted terms from AI-generated content (built-in, no registration needed)
  addExtractedTerms: (terms: Array<{ term: string; definition: string; sourceLabel: string }>) => void;

  // Recalculate usages for all terms by scanning hierarchy blocks
  recalculateUsages: (hierarchyBlocks: Record<string, HierarchyNode[]>) => void;
}

const TermsContext = createContext<TermsContextValue>({
  terms: [],
  setTerms: () => {},
  addTerm: () => {},
  inspectedTerm: null,
  setInspectedTerm: () => {},
  highlightedTerm: null,
  setHighlightedTerm: () => {},
  highlightMode: 'all',
  setHighlightMode: () => {},
  addExtractedTerms: () => {},
  recalculateUsages: () => {},
});

interface TermsProviderProps {
  children: ReactNode;
  documentId: string;
  documentVersion: number;
}

export function TermsProvider({ children, documentId, documentVersion }: TermsProviderProps) {
  // Use document-specific storage key so terms are scoped to each document
  const [terms, setTerms] = useSessionStorage<DefinedTerm[]>(`defined-terms:${documentId}`, []);
  const [inspectedTerm, setInspectedTerm] = useState<DefinedTerm | null>(null);
  const [highlightedTerm, setHighlightedTerm] = useState<DefinedTerm | null>(null);
  const [highlightMode, setHighlightMode] = useState<HighlightMode>('all');

  // Clear states when document changes
  useEffect(() => {
    setInspectedTerm(null);
    setHighlightedTerm(null);
  }, [documentVersion]);

  // Add a single term
  const addTerm = useCallback((term: string, definition: string, source?: { nodePrefix: string; nodeLabel: string }) => {
    const newTerm: DefinedTerm = {
      id: crypto.randomUUID(),
      term,
      definition,
      sourceLocation: source ? { prefix: source.nodePrefix, label: source.nodeLabel } : undefined,
      usages: [],
    };
    setTerms(prev => [...prev, newTerm]);
  }, [setTerms]);

  // Add extracted terms from AI generation (built into context, no registration needed)
  const addExtractedTerms = useCallback((extractedTerms: Array<{ term: string; definition: string; sourceLabel: string }>) => {
    const newTerms: DefinedTerm[] = extractedTerms.map(t => ({
      id: crypto.randomUUID(),
      term: t.term,
      definition: t.definition,
      sourceLocation: { prefix: 'AI', label: t.sourceLabel },
      usages: [],
    }));
    
    // Only add terms that don't already exist (case-insensitive)
    setTerms(prev => {
      const existingLower = new Set(prev.map(t => t.term.toLowerCase()));
      const toAdd = newTerms.filter(t => !existingLower.has(t.term.toLowerCase()));
      return [...prev, ...toAdd];
    });
  }, [setTerms]);

  // Recalculate usages for all terms by scanning hierarchy blocks
  const recalculateUsages = useCallback((hierarchyBlocks: Record<string, HierarchyNode[]>) => {
    const blocks = Object.entries(hierarchyBlocks).map(([id, tree]) => ({
      id,
      tree,
    }));

    setTerms(prev => prev.map(term => ({
      ...term,
      usages: scanForTermUsages(term.term, blocks),
    })));
  }, [setTerms]);

  return (
    <TermsContext.Provider
      value={{
        terms,
        setTerms,
        addTerm,
        inspectedTerm,
        setInspectedTerm,
        highlightedTerm,
        setHighlightedTerm,
        highlightMode,
        setHighlightMode,
        addExtractedTerms,
        recalculateUsages,
      }}
    >
      {children}
    </TermsContext.Provider>
  );
}

export function useTermsContext() {
  return useContext(TermsContext);
}
