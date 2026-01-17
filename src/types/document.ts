import { HierarchyNode } from './node';

export interface DocumentMeta {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  isMaster?: boolean;
}

export interface HierarchyBlockData {
  id: string;
  tree: HierarchyNode[];
}

export interface DocumentState {
  meta: DocumentMeta;
  /** TipTap JSON content with embedded hierarchy blocks */
  content: any;
  /** Map of hierarchy block IDs to their tree data */
  hierarchyBlocks: Record<string, HierarchyBlockData>;
}

export function createEmptyDocument(title: string = 'Untitled'): DocumentState {
  const now = new Date().toISOString();
  return {
    meta: {
      id: crypto.randomUUID(),
      title,
      createdAt: now,
      updatedAt: now,
    },
    content: {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    },
    hierarchyBlocks: {},
  };
}
