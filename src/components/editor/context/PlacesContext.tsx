import { createContext, useContext, ReactNode, useState, useCallback, useEffect, useRef } from 'react';
import { useCloudEntities } from '@/hooks/useCloudEntities';
import { HierarchyNode } from '@/types/node';
import { OutlineStyle, MixedStyleConfig, getOutlinePrefix, getOutlinePrefixCustom, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
import { normalizeEntityName } from '@/lib/entityNameUtils';

// Highlight mode for places in document
export type PlacesHighlightMode = 'all' | 'selected' | 'none';

// Place usage tracking
export interface PlaceUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  nodePrefix: string;
  count: number;
}

// Place structure
export interface Place {
  id: string;
  name: string;
  significance?: string;
  usages: PlaceUsage[];
}

interface PlacesContextValue {
  places: Place[];
  setPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  addPlace: (name: string, significance?: string) => void;
  removePlace: (id: string) => void;
  updatePlace: (id: string, updates: Partial<Pick<Place, 'name' | 'significance'>>) => void;

  inspectedPlace: Place | null;
  setInspectedPlace: (place: Place | null) => void;

  highlightedPlace: Place | null;
  setHighlightedPlace: (place: Place | null) => void;

  placesHighlightMode: PlacesHighlightMode;
  setPlacesHighlightMode: (mode: PlacesHighlightMode) => void;

  recalculatePlaceUsages: (
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => void;

  loading: boolean;
}

const PlacesContext = createContext<PlacesContextValue>({
  places: [],
  setPlaces: () => {},
  addPlace: () => {},
  removePlace: () => {},
  updatePlace: () => {},
  inspectedPlace: null,
  setInspectedPlace: () => {},
  highlightedPlace: null,
  setHighlightedPlace: () => {},
  placesHighlightMode: 'all',
  setPlacesHighlightMode: () => {},
  recalculatePlaceUsages: () => {},
  loading: false,
});

interface PlacesProviderProps {
  children: ReactNode;
  documentId: string;
  documentVersion: number;
}

// Scan for place usages in hierarchy blocks
function scanForPlaceUsages(
  name: string,
  blocks: { id: string; tree: HierarchyNode[] }[],
  styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
): PlaceUsage[] {
  const usages: PlaceUsage[] = [];
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
  
  const style = styleConfig?.style ?? 'mixed';
  const mixedConfig = styleConfig?.mixedConfig ?? DEFAULT_MIXED_CONFIG;

  function computePrefix(depth: number, indices: number[]): string {
    const parts: string[] = [];
    for (let d = 0; d <= depth; d++) {
      const levelIndices = indices.slice(0, d + 1);
      const levelPrefix = style === 'mixed'
        ? getOutlinePrefixCustom(d, levelIndices, mixedConfig)
        : getOutlinePrefix(style, d, levelIndices);
      parts.push(levelPrefix.replace(/[.\s]+$/, '').replace(/^\(|\)$/g, ''));
    }
    return parts.join('');
  }

  function scanNode(node: HierarchyNode, blockId: string, depth: number, indices: number[]) {
    const labelMatches = (node.label.match(wordBoundaryRegex) || []).length;
    
    let contentMatches = 0;
    if (node.content) {
      const plainText = extractPlainTextFromTipTap(node.content);
      contentMatches = (plainText.match(wordBoundaryRegex) || []).length;
    }

    const totalCount = labelMatches + contentMatches;
    if (totalCount > 0) {
      usages.push({
        blockId,
        nodeId: node.id,
        nodeLabel: node.label.substring(0, 50) + (node.label.length > 50 ? '...' : ''),
        nodePrefix: computePrefix(depth, indices),
        count: totalCount,
      });
    }

    node.children.forEach((child, childIndex) => {
      scanNode(child, blockId, depth + 1, [...indices, childIndex + 1]);
    });
  }

  for (const block of blocks) {
    block.tree.forEach((root, rootIndex) => {
      scanNode(root, block.id, 0, [rootIndex + 1]);
    });
  }

  return usages;
}

function extractPlainTextFromTipTap(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractPlainTextFromTipTap).join(' ');
  }
  return '';
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function PlacesProvider({ children, documentId, documentVersion }: PlacesProviderProps) {
  const { 
    entities: places, 
    setEntities: setPlaces, 
    loading 
  } = useCloudEntities<Place>({
    documentId,
    entityType: 'place',
    localStorageKey: `tagged-places:${documentId}`,
  });

  const [inspectedPlace, setInspectedPlace] = useState<Place | null>(null);
  const [highlightedPlace, setHighlightedPlace] = useState<Place | null>(null);
  const [placesHighlightMode, setPlacesHighlightMode] = useState<PlacesHighlightMode>('all');
  
  // Track whether we've normalized existing places for this document
  const normalizedRef = useRef<string | null>(null);

  // One-time normalization of existing stored places per document
  useEffect(() => {
    if (loading) return;
    if (normalizedRef.current === documentId) return;
    normalizedRef.current = documentId;
    
    setPlaces(prev => {
      let changed = false;
      const normalized = prev.map(p => {
        const normalizedName = normalizeEntityName(p.name);
        if (normalizedName !== p.name) {
          changed = true;
          return { ...p, name: normalizedName };
        }
        return p;
      });
      return changed ? normalized : prev;
    });
  }, [documentId, loading, setPlaces]);

  useEffect(() => {
    setInspectedPlace(null);
    setHighlightedPlace(null);
  }, [documentVersion]);

  const addPlace = useCallback((name: string, significance?: string) => {
    const normalizedName = normalizeEntityName(name);
    if (!normalizedName) return; // Don't add empty names
    
    const newPlace: Place = {
      id: crypto.randomUUID(),
      name: normalizedName,
      significance,
      usages: [],
    };
    setPlaces(prev => [...prev, newPlace]);
  }, [setPlaces]);

  const removePlace = useCallback((id: string) => {
    setPlaces(prev => prev.filter(p => p.id !== id));
    setInspectedPlace(prev => prev?.id === id ? null : prev);
    setHighlightedPlace(prev => prev?.id === id ? null : prev);
  }, [setPlaces]);

  const updatePlace = useCallback((id: string, updates: Partial<Pick<Place, 'name' | 'significance'>>) => {
    setPlaces(prev => prev.map(p => {
      if (p.id !== id) return p;
      const normalizedUpdates = updates.name 
        ? { ...updates, name: normalizeEntityName(updates.name) }
        : updates;
      return { ...p, ...normalizedUpdates };
    }));
  }, [setPlaces]);

  const recalculatePlaceUsages = useCallback((
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => {
    const blocks = Object.entries(hierarchyBlocks).map(([id, tree]) => ({
      id,
      tree,
    }));

    setPlaces(prev => prev.map(place => ({
      ...place,
      usages: scanForPlaceUsages(place.name, blocks, styleConfig),
    })));
  }, [setPlaces]);

  return (
    <PlacesContext.Provider
      value={{
        places,
        setPlaces,
        addPlace,
        removePlace,
        updatePlace,
        inspectedPlace,
        setInspectedPlace,
        highlightedPlace,
        setHighlightedPlace,
        placesHighlightMode,
        setPlacesHighlightMode,
        recalculatePlaceUsages,
        loading,
      }}
    >
      {children}
    </PlacesContext.Provider>
  );
}

export function usePlacesContext() {
  return useContext(PlacesContext);
}
