import { createContext, useContext, ReactNode, useCallback, useEffect } from 'react';
import { useCloudEntities } from '@/hooks/useCloudEntities';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { HierarchyNode } from '@/types/node';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { TaggedDate, DateUsage, scanForDateUsages } from '@/lib/dateScanner';

// Re-export types
export type { TaggedDate, DateUsage } from '@/lib/dateScanner';

// Highlight mode for dates in document
export type DateHighlightMode = 'all' | 'selected' | 'none';

// Storage format with serialized date
interface StoredTaggedDate {
  id: string;
  date: string; // ISO string
  rawText: string;
  description?: string;
  usages: DateUsage[];
}

// Convert stored format to runtime format
function deserializeDates(json: string): TaggedDate[] {
  try {
    const parsed: StoredTaggedDate[] = JSON.parse(json);
    return parsed.map(d => ({
      ...d,
      date: new Date(d.date),
    }));
  } catch {
    return [];
  }
}

interface DatesContextValue {
  // Dates data
  dates: TaggedDate[];
  setDates: React.Dispatch<React.SetStateAction<TaggedDate[]>>;
  addDate: (date: Date, rawText: string, description?: string) => void;
  removeDate: (id: string) => void;
  updateDate: (id: string, updates: Partial<Pick<TaggedDate, 'date' | 'rawText' | 'description'>>) => void;

  // Date inspection state (for the usages panel)
  inspectedDate: TaggedDate | null;
  setInspectedDate: (date: TaggedDate | null) => void;

  // Highlighted date (for "selected" highlight mode)
  highlightedDate: TaggedDate | null;
  setHighlightedDate: (date: TaggedDate | null) => void;

  // Highlight mode
  dateHighlightMode: DateHighlightMode;
  setDateHighlightMode: (mode: DateHighlightMode) => void;

  // Recalculate usages for all dates by scanning hierarchy blocks
  recalculateDateUsages: (
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => void;

  loading: boolean;
}

const DatesContext = createContext<DatesContextValue>({
  dates: [],
  setDates: () => {},
  addDate: () => {},
  removeDate: () => {},
  updateDate: () => {},
  inspectedDate: null,
  setInspectedDate: () => {},
  highlightedDate: null,
  setHighlightedDate: () => {},
  dateHighlightMode: 'all',
  setDateHighlightMode: () => {},
  recalculateDateUsages: () => {},
  loading: false,
});

interface DatesProviderProps {
  children: ReactNode;
  documentId: string;
  documentVersion: number;
}

export function DatesProvider({ children, documentId, documentVersion }: DatesProviderProps) {
  // Use cloud storage with custom deserializer for Date objects
  const { 
    entities: rawDates, 
    setEntities: setRawDates, 
    loading 
  } = useCloudEntities<TaggedDate>({
    documentId,
    entityType: 'date',
    localStorageKey: `tagged-dates:${documentId}`,
    deserialize: deserializeDates,
  });

  // Convert Date objects properly (cloud storage stores as ISO strings)
  const dates = rawDates.map(d => ({
    ...d,
    date: d.date instanceof Date ? d.date : new Date(d.date as unknown as string),
  }));

  const setDates: React.Dispatch<React.SetStateAction<TaggedDate[]>> = useCallback((action) => {
    setRawDates(prev => {
      const currentDates = prev.map(d => ({
        ...d,
        date: d.date instanceof Date ? d.date : new Date(d.date as unknown as string),
      }));
      return typeof action === 'function' ? action(currentDates) : action;
    });
  }, [setRawDates]);

  const [inspectedDate, setInspectedDate] = useSessionStorage<TaggedDate | null>(`inspected-date:${documentId}`, null);
  const [highlightedDate, setHighlightedDate] = useSessionStorage<TaggedDate | null>(`highlighted-date:${documentId}`, null);
  const [dateHighlightMode, setDateHighlightMode] = useSessionStorage<DateHighlightMode>('dates-highlight-mode', 'all');

  // Clear states when document changes
  useEffect(() => {
    setInspectedDate(null);
    setHighlightedDate(null);
  }, [documentVersion]);

  // Add a single date
  const addDate = useCallback((date: Date, rawText: string, description?: string) => {
    const newDate: TaggedDate = {
      id: crypto.randomUUID(),
      date,
      rawText,
      description,
      usages: [],
    };
    setDates(prev => [...prev, newDate]);
  }, [setDates]);

  // Remove a date
  const removeDate = useCallback((id: string) => {
    setDates(prev => prev.filter(d => d.id !== id));
    // Clear inspection/highlight if this date was selected
    setInspectedDate(prev => prev?.id === id ? null : prev);
    setHighlightedDate(prev => prev?.id === id ? null : prev);
  }, [setDates]);

  // Update a date
  const updateDate = useCallback((id: string, updates: Partial<Pick<TaggedDate, 'date' | 'rawText' | 'description'>>) => {
    setDates(prev => prev.map(d => 
      d.id === id ? { ...d, ...updates } : d
    ));
  }, [setDates]);

  // Recalculate usages for all dates by scanning hierarchy blocks
  const recalculateDateUsages = useCallback((
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => {
    const blocks = Object.entries(hierarchyBlocks).map(([id, tree]) => ({
      id,
      tree,
    }));

    setDates(prev => prev.map(taggedDate => ({
      ...taggedDate,
      usages: scanForDateUsages(taggedDate.rawText, blocks, styleConfig),
    })));
  }, [setDates]);

  return (
    <DatesContext.Provider
      value={{
        dates,
        setDates,
        addDate,
        removeDate,
        updateDate,
        inspectedDate,
        setInspectedDate,
        highlightedDate,
        setHighlightedDate,
        dateHighlightMode,
        setDateHighlightMode,
        recalculateDateUsages,
        loading,
      }}
    >
      {children}
    </DatesContext.Provider>
  );
}

export function useDatesContext() {
  return useContext(DatesContext);
}
