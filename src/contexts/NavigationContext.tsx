import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface NavigationEntry {
  id: string;
  title: string;
}

export interface MasterDocumentLink {
  nodeId: string;
  linkedDocumentId: string;
  linkedDocumentTitle: string;
}

export interface MasterDocumentInfo {
  id: string;
  title: string;
  links: MasterDocumentLink[];
}

export type EntityTab = 'people' | 'places' | 'dates' | 'terms';

interface NavigationContextValue {
  /** Stack of documents we've navigated through */
  stack: NavigationEntry[];
  /** Whether we can go back */
  canGoBack: boolean;
  /** The document we came from (top of stack) */
  currentOrigin: NavigationEntry | null;
  /** Push a document onto the stack (called before navigating away) */
  pushDocument: (id: string, title: string) => void;
  /** Pop the stack and return the previous document */
  popDocument: () => NavigationEntry | null;
  /** Clear the entire navigation stack */
  clearStack: () => void;
  /** Master document info for master outline mode */
  masterDocument: MasterDocumentInfo | null;
  /** Set or clear the master document */
  setMasterDocument: (doc: MasterDocumentInfo | null) => void;
  /** Whether we're currently viewing a sub-outline of a master */
  isInMasterMode: boolean;
  /** The currently active sub-outline ID (if in master mode) */
  activeSubOutlineId: string | null;
  /** Set the active sub-outline ID */
  setActiveSubOutlineId: (id: string | null) => void;
  /** The active entity tab for Library pane in master mode */
  activeEntityTab: EntityTab | null;
  /** Set the active entity tab (persists across subordinate navigation) */
  setActiveEntityTab: (tab: EntityTab | null) => void;
}

const NavigationContext = createContext<NavigationContextValue>({
  stack: [],
  canGoBack: false,
  currentOrigin: null,
  pushDocument: () => {},
  popDocument: () => null,
  clearStack: () => {},
  masterDocument: null,
  setMasterDocument: () => {},
  isInMasterMode: false,
  activeSubOutlineId: null,
  setActiveSubOutlineId: () => {},
  activeEntityTab: null,
  setActiveEntityTab: () => {},
});

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [stack, setStack] = useState<NavigationEntry[]>([]);
  const [masterDocument, setMasterDocumentState] = useState<MasterDocumentInfo | null>(null);
  const [activeSubOutlineId, setActiveSubOutlineId] = useState<string | null>(null);
  const [activeEntityTab, setActiveEntityTabState] = useState<EntityTab | null>(null);

  const canGoBack = stack.length > 0;
  const currentOrigin = stack.length > 0 ? stack[stack.length - 1] : null;
  const isInMasterMode = masterDocument !== null;

  const pushDocument = useCallback((id: string, title: string) => {
    setStack(prev => [...prev, { id, title }]);
  }, []);

  const popDocument = useCallback((): NavigationEntry | null => {
    let popped: NavigationEntry | null = null;
    setStack(prev => {
      if (prev.length === 0) return prev;
      popped = prev[prev.length - 1];
      return prev.slice(0, -1);
    });
    return popped;
  }, []);

  const clearStack = useCallback(() => {
    setStack([]);
  }, []);

  const setMasterDocument = useCallback((doc: MasterDocumentInfo | null) => {
    setMasterDocumentState(doc);
    if (!doc) {
      setActiveSubOutlineId(null);
      setActiveEntityTabState(null); // Clear entity mode when leaving master mode
    }
  }, []);

  const setActiveEntityTab = useCallback((tab: EntityTab | null) => {
    setActiveEntityTabState(tab);
  }, []);

  return (
    <NavigationContext.Provider
      value={{
        stack,
        canGoBack,
        currentOrigin,
        pushDocument,
        popDocument,
        clearStack,
        masterDocument,
        setMasterDocument,
        isInMasterMode,
        activeSubOutlineId,
        setActiveSubOutlineId,
        activeEntityTab,
        setActiveEntityTab,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
