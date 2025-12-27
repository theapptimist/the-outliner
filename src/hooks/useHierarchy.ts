import { useState, useCallback, useMemo, useEffect } from 'react';
import { HierarchyNode, NodeType, FlatNode, DropPosition } from '@/types/node';
import {
  createNode,
  findNode,
  insertNode,
  deleteNode,
  updateNode,
  moveNode,
  indentNode,
  outdentNode,
  toggleCollapse,
  flattenTree,
  getSiblings,
  getNodeIndex,
  createSampleTree,
} from '@/lib/nodeOperations';

const STORAGE_KEY = 'hierarchy-tree-data';

function loadFromStorage(): HierarchyNode[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.warn('Failed to load hierarchy from localStorage:', e);
  }
  return null;
}

function saveToStorage(tree: HierarchyNode[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tree));
  } catch (e) {
    console.warn('Failed to save hierarchy to localStorage:', e);
  }
}

export function useHierarchy(initialTree?: HierarchyNode[]) {
  const [tree, setTree] = useState<HierarchyNode[]>(() => {
    const stored = loadFromStorage();
    return stored ?? initialTree ?? createSampleTree();
  });

  // Persist to localStorage whenever tree changes
  useEffect(() => {
    saveToStorage(tree);
  }, [tree]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const flatNodes = useMemo(() => flattenTree(tree), [tree]);

  const addNode = useCallback((
    parentId: string | null = null,
    type: NodeType = 'default',
    label: string = 'New Node',
    afterNodeId?: string
  ) => {
    const newNode = createNode(parentId, type, label);
    
    if (afterNodeId) {
      const siblings = parentId 
        ? (findNode(tree, parentId)?.children ?? [])
        : tree;
      const afterIndex = getNodeIndex(siblings, afterNodeId);
      setTree(prev => insertNode(prev, newNode, parentId, afterIndex + 1));
    } else {
      const siblings = parentId 
        ? (findNode(tree, parentId)?.children ?? [])
        : tree;
      setTree(prev => insertNode(prev, newNode, parentId, siblings.length));
    }
    
    setSelectedId(newNode.id);
    return newNode.id;
  }, [tree]);

  const addChildNode = useCallback((parentId: string, type: NodeType = 'default', label: string = 'New Node') => {
    const parent = findNode(tree, parentId);
    if (!parent) return null;
    
    const newNode = createNode(parentId, type, label);
    setTree(prev => insertNode(prev, newNode, parentId, parent.children.length));
    setSelectedId(newNode.id);
    
    // Ensure parent is expanded
    if (parent.collapsed) {
      setTree(prev => toggleCollapse(prev, parentId));
    }
    
    return newNode.id;
  }, [tree]);

  const removeNode = useCallback((nodeId: string) => {
    const flatList = flatNodes;
    const nodeIndex = flatList.findIndex(n => n.id === nodeId);
    
    // Select previous or next sibling/parent
    if (nodeIndex > 0) {
      setSelectedId(flatList[nodeIndex - 1].id);
    } else if (flatList.length > 1) {
      setSelectedId(flatList[1]?.id ?? null);
    } else {
      setSelectedId(null);
    }
    
    setTree(prev => deleteNode(prev, nodeId));
  }, [flatNodes]);

  const updateNodeData = useCallback((nodeId: string, updates: Partial<HierarchyNode>) => {
    setTree(prev => updateNode(prev, nodeId, updates));
  }, []);

  const handleMove = useCallback((nodeId: string, targetId: string, position: DropPosition) => {
    if (nodeId === targetId) return;
    
    const targetNode = findNode(tree, targetId);
    if (!targetNode) return;
    
    let newParentId: string | null;
    let newIndex: number;
    
    if (position === 'inside') {
      newParentId = targetId;
      newIndex = targetNode.children.length;
    } else {
      newParentId = targetNode.parentId;
      const siblings = getSiblings(tree, targetId);
      const targetIndex = getNodeIndex(siblings, targetId);
      newIndex = position === 'before' ? targetIndex : targetIndex + 1;
    }
    
    setTree(prev => moveNode(prev, nodeId, newParentId, newIndex));
  }, [tree]);

  const handleIndent = useCallback((nodeId: string) => {
    setTree(prev => indentNode(prev, nodeId));
  }, []);

  const handleOutdent = useCallback((nodeId: string) => {
    setTree(prev => outdentNode(prev, nodeId));
  }, []);

  const handleToggleCollapse = useCallback((nodeId: string) => {
    setTree(prev => toggleCollapse(prev, nodeId));
  }, []);

  const collapseAll = useCallback(() => {
    const collapseRecursive = (nodes: HierarchyNode[]): HierarchyNode[] => 
      nodes.map(node => ({
        ...node,
        collapsed: node.children.length > 0,
        children: collapseRecursive(node.children),
      }));
    setTree(collapseRecursive);
  }, []);

  const expandAll = useCallback(() => {
    const expandRecursive = (nodes: HierarchyNode[]): HierarchyNode[] => 
      nodes.map(node => ({
        ...node,
        collapsed: false,
        children: expandRecursive(node.children),
      }));
    setTree(expandRecursive);
  }, []);

  const selectNode = useCallback((nodeId: string | null) => {
    setSelectedId(nodeId);
  }, []);

  const navigateUp = useCallback(() => {
    if (!selectedId) {
      if (flatNodes.length > 0) setSelectedId(flatNodes[0].id);
      return;
    }
    const currentIndex = flatNodes.findIndex(n => n.id === selectedId);
    if (currentIndex > 0) {
      setSelectedId(flatNodes[currentIndex - 1].id);
    }
  }, [selectedId, flatNodes]);

  const navigateDown = useCallback(() => {
    if (!selectedId) {
      if (flatNodes.length > 0) setSelectedId(flatNodes[0].id);
      return;
    }
    const currentIndex = flatNodes.findIndex(n => n.id === selectedId);
    if (currentIndex < flatNodes.length - 1) {
      setSelectedId(flatNodes[currentIndex + 1].id);
    }
  }, [selectedId, flatNodes]);

  const selectedNode = useMemo(() => 
    selectedId ? findNode(tree, selectedId) : null
  , [tree, selectedId]);

  return {
    tree,
    flatNodes,
    selectedId,
    selectedNode,
    addNode,
    addChildNode,
    removeNode,
    updateNodeData,
    handleMove,
    handleIndent,
    handleOutdent,
    handleToggleCollapse,
    collapseAll,
    expandAll,
    selectNode,
    navigateUp,
    navigateDown,
  };
}
