import { createContext, useContext, ReactNode, useState, useCallback } from 'react';

export interface SelectionSource {
  nodePrefix: string;
  nodeLabel: string;
}

// Callback type for inserting text at cursor and returning location info
export type InsertTextAtCursorFn = (text: string) => { nodePrefix: string; nodeLabel: string } | null;

interface SelectionContextValue {
  // Text selection tracking for defined terms
  selectedText: string;
  setSelectedText: (text: string) => void;
  
  // Source location of the selected text (outline context)
  selectionSource: SelectionSource | null;
  setSelectionSource: (source: SelectionSource | null) => void;

  // Insert text at cursor position in active outline (for term insertion)
  insertTextAtCursor: InsertTextAtCursorFn | null;
  setInsertTextAtCursor: (fn: InsertTextAtCursorFn | null) => void;
}

const SelectionContext = createContext<SelectionContextValue>({
  selectedText: '',
  setSelectedText: () => {},
  
  selectionSource: null,
  setSelectionSource: () => {},

  insertTextAtCursor: null,
  setInsertTextAtCursor: () => {},
});

interface SelectionProviderProps {
  children: ReactNode;
}

export function SelectionProvider({ children }: SelectionProviderProps) {
  const [selectedText, setSelectedText] = useState('');
  const [selectionSource, setSelectionSource] = useState<SelectionSource | null>(null);
  const [insertTextAtCursorFn, setInsertTextAtCursorFn] = useState<InsertTextAtCursorFn | null>(null);

  const setInsertTextAtCursor = useCallback((fn: InsertTextAtCursorFn | null) => {
    setInsertTextAtCursorFn(() => fn);
  }, []);

  return (
    <SelectionContext.Provider
      value={{
        selectedText,
        setSelectedText,
        selectionSource,
        setSelectionSource,
        insertTextAtCursor: insertTextAtCursorFn,
        setInsertTextAtCursor,
      }}
    >
      {children}
    </SelectionContext.Provider>
  );
}

export function useSelectionContext() {
  return useContext(SelectionContext);
}
