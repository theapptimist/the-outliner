import { createContext, useContext, ReactNode, useState, useCallback, useEffect } from 'react';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { HierarchyNode } from '@/types/node';
import { OutlineStyle, MixedStyleConfig, getOutlinePrefix, getOutlinePrefixCustom, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';

// Highlight mode for people in document
export type PeopleHighlightMode = 'all' | 'selected' | 'none';

// Person usage tracking
export interface PersonUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  nodePrefix: string;
  count: number;
}

// Person structure
export interface Person {
  id: string;
  name: string;
  role?: string;
  description?: string;
  usages: PersonUsage[];
}

interface PeopleContextValue {
  people: Person[];
  setPeople: React.Dispatch<React.SetStateAction<Person[]>>;
  addPerson: (name: string, role?: string, description?: string) => void;
  removePerson: (id: string) => void;
  updatePerson: (id: string, updates: Partial<Pick<Person, 'name' | 'role' | 'description'>>) => void;

  inspectedPerson: Person | null;
  setInspectedPerson: (person: Person | null) => void;

  highlightedPerson: Person | null;
  setHighlightedPerson: (person: Person | null) => void;

  peopleHighlightMode: PeopleHighlightMode;
  setPeopleHighlightMode: (mode: PeopleHighlightMode) => void;

  recalculatePeopleUsages: (
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => void;
}

const PeopleContext = createContext<PeopleContextValue>({
  people: [],
  setPeople: () => {},
  addPerson: () => {},
  removePerson: () => {},
  updatePerson: () => {},
  inspectedPerson: null,
  setInspectedPerson: () => {},
  highlightedPerson: null,
  setHighlightedPerson: () => {},
  peopleHighlightMode: 'all',
  setPeopleHighlightMode: () => {},
  recalculatePeopleUsages: () => {},
});

interface PeopleProviderProps {
  children: ReactNode;
  documentId: string;
  documentVersion: number;
}

// Scan for person usages in hierarchy blocks
function scanForPersonUsages(
  name: string,
  blocks: { id: string; tree: HierarchyNode[] }[],
  styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
): PersonUsage[] {
  const usages: PersonUsage[] = [];
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

export function PeopleProvider({ children, documentId, documentVersion }: PeopleProviderProps) {
  const [people, setPeople] = useSessionStorage<Person[]>(`tagged-people:${documentId}`, []);
  const [inspectedPerson, setInspectedPerson] = useState<Person | null>(null);
  const [highlightedPerson, setHighlightedPerson] = useState<Person | null>(null);
  const [peopleHighlightMode, setPeopleHighlightMode] = useState<PeopleHighlightMode>('all');

  useEffect(() => {
    setInspectedPerson(null);
    setHighlightedPerson(null);
  }, [documentVersion]);

  const addPerson = useCallback((name: string, role?: string, description?: string) => {
    const newPerson: Person = {
      id: crypto.randomUUID(),
      name,
      role,
      description,
      usages: [],
    };
    setPeople(prev => [...prev, newPerson]);
  }, [setPeople]);

  const removePerson = useCallback((id: string) => {
    setPeople(prev => prev.filter(p => p.id !== id));
    setInspectedPerson(prev => prev?.id === id ? null : prev);
    setHighlightedPerson(prev => prev?.id === id ? null : prev);
  }, [setPeople]);

  const updatePerson = useCallback((id: string, updates: Partial<Pick<Person, 'name' | 'role' | 'description'>>) => {
    setPeople(prev => prev.map(p => 
      p.id === id ? { ...p, ...updates } : p
    ));
  }, [setPeople]);

  const recalculatePeopleUsages = useCallback((
    hierarchyBlocks: Record<string, HierarchyNode[]>,
    styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
  ) => {
    const blocks = Object.entries(hierarchyBlocks).map(([id, tree]) => ({
      id,
      tree,
    }));

    setPeople(prev => prev.map(person => ({
      ...person,
      usages: scanForPersonUsages(person.name, blocks, styleConfig),
    })));
  }, [setPeople]);

  return (
    <PeopleContext.Provider
      value={{
        people,
        setPeople,
        addPerson,
        removePerson,
        updatePerson,
        inspectedPerson,
        setInspectedPerson,
        highlightedPerson,
        setHighlightedPerson,
        peopleHighlightMode,
        setPeopleHighlightMode,
        recalculatePeopleUsages,
      }}
    >
      {children}
    </PeopleContext.Provider>
  );
}

export function usePeopleContext() {
  return useContext(PeopleContext);
}
