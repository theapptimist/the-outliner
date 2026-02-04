import { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useCloudEntities } from '@/hooks/useCloudEntities';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { useMasterEntitySync } from '@/hooks/useMasterEntitySync';
import { HierarchyNode } from '@/types/node';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { scanForTermUsages } from '@/lib/termScanner';

// Highlight mode for terms in document
export type HighlightMode = 'all' | 'selected' | 'none';

// Term usage tracking
export interface TermUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  nodePrefix: string;
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
  recalculateUsages: (
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => void;

  loading: boolean;
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
  loading: false,
});

interface TermsProviderProps {
  children: ReactNode;
  documentId: string;
  documentVersion: number;
}

export function TermsProvider({ children, documentId, documentVersion }: TermsProviderProps) {
  // Use cloud storage for terms
  const { 
    entities: terms, 
    setEntities: setTerms, 
    loading 
  } = useCloudEntities<DefinedTerm>({
    documentId,
    entityType: 'term',
    localStorageKey: `defined-terms:${documentId}`,
  });

  const [inspectedTerm, setInspectedTerm] = useSessionStorage<DefinedTerm | null>(`inspected-term:${documentId}`, null);
  const [highlightedTerm, setHighlightedTerm] = useSessionStorage<DefinedTerm | null>(`highlighted-term:${documentId}`, null);
  const [highlightMode, setHighlightMode] = useSessionStorage<HighlightMode>('terms-highlight-mode', 'all');

  // Clear states when document changes
  useEffect(() => {
    setInspectedTerm(null);
    setHighlightedTerm(null);
  }, [documentVersion]);

  // Sync to Master Library
  const { syncToMaster } = useMasterEntitySync();

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
    
    // Sync to Master Library (fire and forget)
    syncToMaster('terms', { term, definition }, documentId);
  }, [setTerms, syncToMaster, documentId]);

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
      
      // Sync new terms to Master Library
      toAdd.forEach(t => {
        syncToMaster('terms', { term: t.term, definition: t.definition }, documentId);
      });
      
      return [...prev, ...toAdd];
    });
  }, [setTerms, syncToMaster, documentId]);

  // Recalculate usages for all terms by scanning hierarchy blocks
  const recalculateUsages = useCallback((
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => {
    const blocks = Object.entries(hierarchyBlocks).map(([id, tree]) => ({
      id,
      tree,
    }));

    setTerms(prev => prev.map(term => ({
      ...term,
      usages: scanForTermUsages(term.term, blocks, styleConfig),
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
        loading,
      }}
    >
      {children}
    </TermsContext.Provider>
  );
}

export function useTermsContext() {
  return useContext(TermsContext);
}
