export type NodeType = 'default' | 'container' | 'data' | 'action' | 'reference' | 'body' | 'link';

export interface NodeProperty {
  key: string;
  value: string | number | boolean | null;
}

export interface HierarchyNode {
  id: string;
  parentId: string | null;
  orderIndex: number;
  type: NodeType;
  label: string;
  properties: Record<string, string | number | boolean | null>;
  collapsed: boolean;
  children: HierarchyNode[];
  /** Rich text content stored as TipTap JSON */
  content?: any;
  /** Visual indent level for body nodes (Block Tab feature) */
  visualIndent?: number;
  /** For 'link' type nodes: the ID of the linked document */
  linkedDocumentId?: string;
  /** For 'link' type nodes: cached title of the linked document */
  linkedDocumentTitle?: string;
}

export interface FlatNode extends Omit<HierarchyNode, 'children'> {
  depth: number;
  hasChildren: boolean;
  isLastChild: boolean;
  ancestorIds: string[];
}

export type DropPosition = 'before' | 'after' | 'inside';

export interface DragState {
  nodeId: string;
  targetId: string | null;
  position: DropPosition;
}

export interface NodeOperation {
  type: 'create' | 'delete' | 'move' | 'update' | 'indent' | 'outdent';
  nodeId: string;
  payload?: any;
  timestamp: number;
  reversible: boolean;
}

export type ProjectionType = 'tree' | 'outline' | 'graph';
