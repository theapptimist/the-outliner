import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export interface NavigationEntry {
  id: string;
  title: string;
}

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
}

const NavigationContext = createContext<NavigationContextValue>({
  stack: [],
  canGoBack: false,
  currentOrigin: null,
  pushDocument: () => {},
  popDocument: () => null,
  clearStack: () => {},
});

interface NavigationProviderProps {
  children: ReactNode;
}

export function NavigationProvider({ children }: NavigationProviderProps) {
  const [stack, setStack] = useState<NavigationEntry[]>([]);

  const canGoBack = stack.length > 0;
  const currentOrigin = stack.length > 0 ? stack[stack.length - 1] : null;

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

  return (
    <NavigationContext.Provider
      value={{
        stack,
        canGoBack,
        currentOrigin,
        pushDocument,
        popDocument,
        clearStack,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation() {
  return useContext(NavigationContext);
}
