import { HierarchyNode, NodeType, FlatNode, NodeOperation } from '@/types/node';

let operationHistory: NodeOperation[] = [];

export function generateId(): string {
  return `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

export function createNode(
  parentId: string | null = null,
  type: NodeType = 'default',
  label: string = 'New Node',
  orderIndex: number = 0
): HierarchyNode {
  return {
    id: generateId(),
    parentId,
    orderIndex,
    type,
    label,
    properties: {},
    collapsed: false,
    children: [],
  };
}

export function cloneTree(node: HierarchyNode): HierarchyNode {
  return {
    ...node,
    id: generateId(),
    children: node.children.map(cloneTree),
  };
}

export function findNode(root: HierarchyNode[], nodeId: string): HierarchyNode | null {
  for (const node of root) {
    if (node.id === nodeId) return node;
    const found = findNode(node.children, nodeId);
    if (found) return found;
  }
  return null;
}

export function findParentNode(root: HierarchyNode[], nodeId: string): HierarchyNode | null {
  for (const node of root) {
    if (node.children.some(child => child.id === nodeId)) {
      return node;
    }
    const found = findParentNode(node.children, nodeId);
    if (found) return found;
  }
  return null;
}

export function getSiblings(root: HierarchyNode[], nodeId: string): HierarchyNode[] {
  const parent = findParentNode(root, nodeId);
  if (parent) {
    return parent.children;
  }
  return root.filter(n => n.parentId === null);
}

export function getNodeIndex(siblings: HierarchyNode[], nodeId: string): number {
  return siblings.findIndex(n => n.id === nodeId);
}

export function reorderSiblings(siblings: HierarchyNode[]): HierarchyNode[] {
  return siblings.map((node, index) => ({
    ...node,
    orderIndex: index,
  }));
}

export function insertNode(
  root: HierarchyNode[],
  newNode: HierarchyNode,
  parentId: string | null,
  index: number
): HierarchyNode[] {
  if (parentId === null) {
    const updated = [...root];
    updated.splice(index, 0, newNode);
    return reorderSiblings(updated);
  }

  return root.map(node => {
    if (node.id === parentId) {
      const updatedChildren = [...node.children];
      updatedChildren.splice(index, 0, { ...newNode, parentId });
      return {
        ...node,
        children: reorderSiblings(updatedChildren),
      };
    }
    if (node.children.length > 0) {
      return {
        ...node,
        children: insertNode(node.children, newNode, parentId, index),
      };
    }
    return node;
  });
}

export function deleteNode(root: HierarchyNode[], nodeId: string): HierarchyNode[] {
  return root
    .filter(node => node.id !== nodeId)
    .map(node => ({
      ...node,
      children: deleteNode(node.children, nodeId),
    }))
    .map((node, _, arr) => ({
      ...node,
      children: reorderSiblings(node.children),
    }));
}

export function updateNode(
  root: HierarchyNode[],
  nodeId: string,
  updates: Partial<HierarchyNode>
): HierarchyNode[] {
  return root.map(node => {
    if (node.id === nodeId) {
      return { ...node, ...updates, children: node.children };
    }
    return {
      ...node,
      children: updateNode(node.children, nodeId, updates),
    };
  });
}

export function moveNode(
  root: HierarchyNode[],
  nodeId: string,
  newParentId: string | null,
  newIndex: number
): HierarchyNode[] {
  const node = findNode(root, nodeId);
  if (!node) return root;

  // Remove from current location
  let updated = deleteNode(root, nodeId);

  // Reattach at new location with subtree
  const movedNode = { ...node, parentId: newParentId };
  updated = insertNode(updated, movedNode, newParentId, newIndex);

  return updated;
}

export function indentNode(root: HierarchyNode[], nodeId: string): HierarchyNode[] {
  const siblings = getSiblings(root, nodeId);
  const nodeIndex = getNodeIndex(siblings, nodeId);

  if (nodeIndex <= 0) return root; // Can't indent first sibling

  const previousSibling = siblings[nodeIndex - 1];
  const node = findNode(root, nodeId);
  if (!node) return root;

  // Move node to be last child of previous sibling
  let updated = deleteNode(root, nodeId);
  const movedNode = { ...node, parentId: previousSibling.id };

  return insertNode(updated, movedNode, previousSibling.id, previousSibling.children.length);
}

export function outdentNode(root: HierarchyNode[], nodeId: string): HierarchyNode[] {
  const parent = findParentNode(root, nodeId);
  if (!parent) return root; // Already at root level

  const grandparent = findParentNode(root, parent.id);
  const grandparentId = grandparent?.id ?? null;

  const parentSiblings = getSiblings(root, parent.id);
  const parentIndex = getNodeIndex(parentSiblings, parent.id);

  const node = findNode(root, nodeId);
  if (!node) return root;

  // Move node to be sibling of its parent (after parent)
  let updated = deleteNode(root, nodeId);
  const movedNode = { ...node, parentId: grandparentId };

  return insertNode(updated, movedNode, grandparentId, parentIndex + 1);
}

export function toggleCollapse(root: HierarchyNode[], nodeId: string): HierarchyNode[] {
  return updateNode(root, nodeId, { collapsed: !findNode(root, nodeId)?.collapsed });
}

export function flattenTree(
  nodes: HierarchyNode[],
  depth: number = 0,
  ancestorIds: string[] = [],
  parentCollapsed: boolean = false
): FlatNode[] {
  const result: FlatNode[] = [];

  nodes.forEach((node, index) => {
    if (parentCollapsed) return;

    const isLastChild = index === nodes.length - 1;
    const flatNode: FlatNode = {
      id: node.id,
      parentId: node.parentId,
      orderIndex: node.orderIndex,
      type: node.type,
      label: node.label,
      properties: node.properties,
      collapsed: node.collapsed,
      depth,
      hasChildren: node.children.length > 0,
      isLastChild,
      ancestorIds,
    };

    result.push(flatNode);

    if (node.children.length > 0 && !node.collapsed) {
      result.push(...flattenTree(
        node.children,
        depth + 1,
        [...ancestorIds, node.id],
        node.collapsed
      ));
    }
  });

  return result;
}

export function recordOperation(operation: Omit<NodeOperation, 'timestamp'>): void {
  operationHistory.push({
    ...operation,
    timestamp: Date.now(),
  });
}

export function getOperationHistory(): NodeOperation[] {
  return [...operationHistory];
}

export function clearHistory(): void {
  operationHistory = [];
}

export function createSampleTree(): HierarchyNode[] {
  const root1 = createNode(null, 'container', 'Project Alpha', 0);
  const child1 = createNode(root1.id, 'data', 'Configuration', 0);
  const child2 = createNode(root1.id, 'container', 'Modules', 1);
  const grandchild1 = createNode(child2.id, 'action', 'Core Module', 0);
  const grandchild2 = createNode(child2.id, 'reference', 'Utils Module', 1);
  const child3 = createNode(root1.id, 'default', 'Documentation', 2);

  const root2 = createNode(null, 'container', 'Project Beta', 1);
  const betaChild1 = createNode(root2.id, 'data', 'Settings', 0);
  const betaChild2 = createNode(root2.id, 'action', 'Build Tasks', 1);

  child2.children = [grandchild1, grandchild2];
  root1.children = [child1, child2, child3];
  root2.children = [betaChild1, betaChild2];

  return [root1, root2];
}
