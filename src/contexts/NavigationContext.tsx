import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';

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

// Session storage keys for persistence across HMR/reloads
const MASTER_DOC_KEY = 'outliner:masterDocument';
const ACTIVE_SUB_KEY = 'outliner:activeSubOutlineId';
const ENTITY_TAB_KEY = 'outliner:activeEntityTab';
const NAV_STACK_KEY = 'outliner:navigationStack';

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

// Helper to safely parse JSON from sessionStorage
function getStoredValue<T>(key: string, fallback: T): T {
  try {
    const stored = sessionStorage.getItem(key);
    if (stored) {
      return JSON.parse(stored) as T;
    }
  } catch (e) {
    console.warn(`Failed to parse ${key} from sessionStorage`, e);
  }
  return fallback;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  // Initialize state from sessionStorage for persistence across reloads
  const [stack, setStack] = useState<NavigationEntry[]>(() => 
    getStoredValue<NavigationEntry[]>(NAV_STACK_KEY, [])
  );
  const [masterDocument, setMasterDocumentState] = useState<MasterDocumentInfo | null>(() =>
    getStoredValue<MasterDocumentInfo | null>(MASTER_DOC_KEY, null)
  );
  const [activeSubOutlineId, setActiveSubOutlineIdState] = useState<string | null>(() =>
    getStoredValue<string | null>(ACTIVE_SUB_KEY, null)
  );
  const [activeEntityTab, setActiveEntityTabState] = useState<EntityTab | null>(() =>
    getStoredValue<EntityTab | null>(ENTITY_TAB_KEY, null)
  );

  // Persist stack to sessionStorage
  useEffect(() => {
    sessionStorage.setItem(NAV_STACK_KEY, JSON.stringify(stack));
  }, [stack]);

  // Persist masterDocument to sessionStorage
  useEffect(() => {
    if (masterDocument) {
      sessionStorage.setItem(MASTER_DOC_KEY, JSON.stringify(masterDocument));
    } else {
      sessionStorage.removeItem(MASTER_DOC_KEY);
    }
  }, [masterDocument]);

  // Persist activeSubOutlineId to sessionStorage
  useEffect(() => {
    if (activeSubOutlineId) {
      sessionStorage.setItem(ACTIVE_SUB_KEY, JSON.stringify(activeSubOutlineId));
    } else {
      sessionStorage.removeItem(ACTIVE_SUB_KEY);
    }
  }, [activeSubOutlineId]);

  // Persist activeEntityTab to sessionStorage
  useEffect(() => {
    if (activeEntityTab) {
      sessionStorage.setItem(ENTITY_TAB_KEY, JSON.stringify(activeEntityTab));
    } else {
      sessionStorage.removeItem(ENTITY_TAB_KEY);
    }
  }, [activeEntityTab]);

  const canGoBack = stack.length > 0;
  const currentOrigin = stack.length > 0 ? stack[stack.length - 1] : null;
  const isInMasterMode = masterDocument !== null;

  const pushDocument = useCallback((id: string, title: string) => {
    setStack(prev => [...prev, { id, title }]);
  }, []);

  const popDocument = useCallback((): NavigationEntry | null => {
    if (stack.length === 0) return null;
    const popped = stack[stack.length - 1];
    setStack(prev => prev.slice(0, -1));
    return popped;
  }, [stack]);

  const clearStack = useCallback(() => {
    setStack([]);
  }, []);

  const setMasterDocument = useCallback((doc: MasterDocumentInfo | null) => {
    setMasterDocumentState(doc);
    if (!doc) {
      setActiveSubOutlineIdState(null);
      setActiveEntityTabState(null);
    }
  }, []);

  const setActiveSubOutlineId = useCallback((id: string | null) => {
    setActiveSubOutlineIdState(id);
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
