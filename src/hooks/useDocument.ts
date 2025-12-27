import { useState, useCallback, useMemo } from 'react';
import { DocumentState, HierarchyBlockData, createEmptyDocument } from '@/types/document';
import { HierarchyNode } from '@/types/node';
import { createSampleTree } from '@/lib/nodeOperations';

export function useDocument(initialDocument?: DocumentState) {
  const [document, setDocument] = useState<DocumentState>(
    initialDocument ?? createEmptyDocument()
  );

  const updateMeta = useCallback((updates: Partial<DocumentState['meta']>) => {
    setDocument(prev => ({
      ...prev,
      meta: {
        ...prev.meta,
        ...updates,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const updateContent = useCallback((content: any) => {
    setDocument(prev => ({
      ...prev,
      content,
      meta: {
        ...prev.meta,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const addHierarchyBlock = useCallback((): string => {
    const blockId = crypto.randomUUID();
    const newBlock: HierarchyBlockData = {
      id: blockId,
      tree: createSampleTree(),
    };

    setDocument(prev => ({
      ...prev,
      hierarchyBlocks: {
        ...prev.hierarchyBlocks,
        [blockId]: newBlock,
      },
      meta: {
        ...prev.meta,
        updatedAt: new Date().toISOString(),
      },
    }));

    return blockId;
  }, []);

  const updateHierarchyBlock = useCallback((blockId: string, tree: HierarchyNode[]) => {
    setDocument(prev => ({
      ...prev,
      hierarchyBlocks: {
        ...prev.hierarchyBlocks,
        [blockId]: {
          ...prev.hierarchyBlocks[blockId],
          tree,
        },
      },
      meta: {
        ...prev.meta,
        updatedAt: new Date().toISOString(),
      },
    }));
  }, []);

  const removeHierarchyBlock = useCallback((blockId: string) => {
    setDocument(prev => {
      const { [blockId]: _, ...rest } = prev.hierarchyBlocks;
      return {
        ...prev,
        hierarchyBlocks: rest,
        meta: {
          ...prev.meta,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }, []);

  const getHierarchyBlock = useCallback((blockId: string): HierarchyBlockData | null => {
    return document.hierarchyBlocks[blockId] ?? null;
  }, [document.hierarchyBlocks]);

  return {
    document,
    setDocument,
    updateMeta,
    updateContent,
    addHierarchyBlock,
    updateHierarchyBlock,
    removeHierarchyBlock,
    getHierarchyBlock,
  };
}
