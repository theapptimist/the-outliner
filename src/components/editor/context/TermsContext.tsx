import { createContext, useContext, ReactNode, useState, useCallback } from 'react';
import { DefinedTerm } from '../DefinedTermsPane';

// Callback type for adding extracted defined terms
export type AddExtractedTermsFn = (terms: Array<{ term: string; definition: string; sourceLabel: string }>) => void;

interface TermsContextValue {
  // Term inspection state (for the right panel)
  inspectedTerm: DefinedTerm | null;
  setInspectedTerm: (term: DefinedTerm | null) => void;

  // Add extracted terms from AI-generated content
  addExtractedTerms: AddExtractedTermsFn | null;
  setAddExtractedTerms: (fn: AddExtractedTermsFn | null) => void;
}

const TermsContext = createContext<TermsContextValue>({
  inspectedTerm: null,
  setInspectedTerm: () => {},

  addExtractedTerms: null,
  setAddExtractedTerms: () => {},
});

interface TermsProviderProps {
  children: ReactNode;
}

export function TermsProvider({ children }: TermsProviderProps) {
  const [inspectedTerm, setInspectedTerm] = useState<DefinedTerm | null>(null);
  const [addExtractedTermsFn, setAddExtractedTermsFn] = useState<AddExtractedTermsFn | null>(null);

  const setAddExtractedTerms = useCallback((fn: AddExtractedTermsFn | null) => {
    setAddExtractedTermsFn(() => fn);
  }, []);

  return (
    <TermsContext.Provider
      value={{
        inspectedTerm,
        setInspectedTerm,
        addExtractedTerms: addExtractedTermsFn,
        setAddExtractedTerms,
      }}
    >
      {children}
    </TermsContext.Provider>
  );
}

export function useTermsContext() {
  return useContext(TermsContext);
}
