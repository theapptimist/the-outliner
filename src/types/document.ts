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

// Display options for document-level features (TOC, End Notes, Entity Extraction)
export interface DocumentDisplayOptions {
  showTableOfContents: boolean;
  showEndNotes: boolean;
  extractEntities: boolean;
}

// Citation definitions for End Notes (marker -> full citation text)
export type CitationDefinitions = Record<string, string>;

export interface DocumentState {
  meta: DocumentMeta;
  /** TipTap JSON content with embedded hierarchy blocks */
  content: any;
  /** Map of hierarchy block IDs to their tree data */
  hierarchyBlocks: Record<string, HierarchyBlockData>;
  /** Display options for TOC, End Notes, etc. */
  displayOptions?: DocumentDisplayOptions;
  /** Citation definitions for End Notes */
  citationDefinitions?: CitationDefinitions;
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
    displayOptions: {
      showTableOfContents: false,
      showEndNotes: false,
      extractEntities: false,
    },
    citationDefinitions: {},
  };
}
