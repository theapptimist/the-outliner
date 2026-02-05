import { normalizeEntityName } from '@/lib/entityNameUtils';

export interface DocumentSnippet {
  text: string;
  nodeLabel?: string;
  blockId?: string;
  nodeId?: string;
}

export type EntityType = 'people' | 'places' | 'dates' | 'terms';

export interface SnippetSearchInput {
  entityType: EntityType;
  text: string;
}

// Max snippets to return per search to keep UI usable
const MAX_SNIPPETS_PER_DOCUMENT = 10;
const MAX_SNIPPETS_PER_NODE = 2;
// Hard cap on characters to prevent worst-case performance
const MAX_CHARS_TO_SCAN = 200000;

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a matcher based on entity type:
 * - terms: word-boundary regex (case-insensitive)
 * - dates: simple substring match
 * - people/places: normalized matching
 */
function createMatcher(input: SnippetSearchInput): (text: string) => { index: number; length: number }[] {
  const { entityType, text: searchText } = input;
  
  if (entityType === 'terms') {
    const regex = new RegExp(`\\b${escapeRegex(searchText)}\\b`, 'gi');
    return (text: string) => {
      const matches: { index: number; length: number }[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ index: match.index, length: match[0].length });
      }
      regex.lastIndex = 0;
      return matches;
    };
  }
  
  if (entityType === 'dates') {
    const searchLower = searchText.toLowerCase();
    return (text: string) => {
      const matches: { index: number; length: number }[] = [];
      const textLower = text.toLowerCase();
      let idx = 0;
      while ((idx = textLower.indexOf(searchLower, idx)) !== -1) {
        matches.push({ index: idx, length: searchText.length });
        idx += 1;
      }
      return matches;
    };
  }
  
  // people/places: normalized matching
  const normalizedSearch = normalizeEntityName(searchText).toLowerCase();
  const searchLower = searchText.toLowerCase();
  
  return (text: string) => {
    const matches: { index: number; length: number }[] = [];
    const textLower = text.toLowerCase();
    
    // Try direct substring match first
    let idx = 0;
    while ((idx = textLower.indexOf(searchLower, idx)) !== -1) {
      matches.push({ index: idx, length: searchText.length });
      idx += 1;
    }
    
    // If no direct match, try normalized matching
    if (matches.length === 0 && normalizedSearch !== searchLower) {
      const normalizedText = normalizeEntityName(text).toLowerCase();
      let searchStart = 0;
      while (true) {
        const normalizedIndex = normalizedText.indexOf(normalizedSearch, searchStart);
        if (normalizedIndex === -1) break;
        matches.push({ index: normalizedIndex, length: normalizedSearch.length });
        searchStart = normalizedIndex + 1;
      }
    }
    
    return matches;
  };
}

/**
 * Creates a snippet from text around a match position
 */
function createSnippet(text: string, matchIndex: number, matchLength: number): string {
  const contextRadius = 40;
  const start = Math.max(0, matchIndex - contextRadius);
  const end = Math.min(text.length, matchIndex + matchLength + contextRadius);
  let snippet = text.substring(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < text.length) snippet = snippet + '...';
  return snippet;
}

interface TraversalContext {
  snippets: DocumentSnippet[];
  matcher: (text: string) => { index: number; length: number }[];
  nodeSnippetCounts: Map<string, number>;
  charsScanned: number;
  done: boolean;
}

/**
 * Scan a single text string for matches and add snippets to context
 */
function scanTextForSnippets(
  ctx: TraversalContext,
  text: string,
  nodeLabel?: string,
  blockId?: string,
  nodeId?: string
): void {
  if (ctx.done || !text) return;
  
  // Update chars scanned
  ctx.charsScanned += text.length;
  
  const nodeKey = blockId && nodeId ? `${blockId}:${nodeId}` : 'content';
  const currentCount = ctx.nodeSnippetCounts.get(nodeKey) || 0;
  
  if (currentCount >= MAX_SNIPPETS_PER_NODE) return;
  
  const matches = ctx.matcher(text);
  
  for (const match of matches) {
    if (ctx.snippets.length >= MAX_SNIPPETS_PER_DOCUMENT) {
      ctx.done = true;
      return;
    }
    
    const nodeCount = ctx.nodeSnippetCounts.get(nodeKey) || 0;
    if (nodeCount >= MAX_SNIPPETS_PER_NODE) break;
    
    const snippetText = createSnippet(text, match.index, match.length);
    
    ctx.snippets.push({
      text: snippetText,
      nodeLabel: nodeLabel?.substring(0, 50),
      blockId,
      nodeId,
    });
    
    ctx.nodeSnippetCounts.set(nodeKey, nodeCount + 1);
  }
  
  // Check if we've scanned too many characters
  if (ctx.charsScanned >= MAX_CHARS_TO_SCAN) {
    ctx.done = true;
  }
}

/**
 * Extract plain text from TipTap content node (bounded, early-exit)
 */
function extractNodeText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractNodeText).join(' ');
  }
  return '';
}

/**
 * Scan a hierarchy node for snippets (early-exit)
 */
function scanHierarchyNode(
  ctx: TraversalContext,
  node: any,
  blockId: string
): void {
  if (ctx.done) return;
  
  // Check label
  if (node.label) {
    scanTextForSnippets(ctx, node.label, node.label, blockId, node.id);
  }
  
  if (ctx.done) return;
  
  // Check content
  if (node.content) {
    const plainText = extractNodeText(node.content);
    scanTextForSnippets(ctx, plainText, node.label, blockId, node.id);
  }
  
  if (ctx.done) return;
  
  // Recurse into children
  if (Array.isArray(node.children)) {
    for (const child of node.children) {
      if (ctx.done) return;
      scanHierarchyNode(ctx, child, blockId);
    }
  }
}

/**
 * Find snippets in hierarchy blocks with early-exit
 */
export function findSnippetsInHierarchy(
  hierarchyBlocks: Record<string, any>,
  input: SnippetSearchInput
): DocumentSnippet[] {
  const ctx: TraversalContext = {
    snippets: [],
    matcher: createMatcher(input),
    nodeSnippetCounts: new Map(),
    charsScanned: 0,
    done: false,
  };

  for (const [blockId, block] of Object.entries(hierarchyBlocks)) {
    if (ctx.done) break;
    
    const tree = (block as any)?.tree;
    if (Array.isArray(tree)) {
      for (const node of tree) {
        if (ctx.done) break;
        scanHierarchyNode(ctx, node, blockId);
      }
    }
  }

  return ctx.snippets;
}

/**
 * Traverse TipTap content with early-exit for snippet finding
 */
function traverseContentForSnippets(
  ctx: TraversalContext,
  node: any
): void {
  if (ctx.done || !node) return;
  
  // Handle text nodes
  if (node.type === 'text' && node.text) {
    scanTextForSnippets(ctx, node.text);
    return;
  }
  
  // Handle paragraph/heading - collect all text and scan
  if ((node.type === 'paragraph' || node.type === 'heading') && node.content) {
    const paragraphText = node.content
      .filter((n: any) => n.type === 'text' && n.text)
      .map((n: any) => n.text)
      .join('');
    
    if (paragraphText) {
      scanTextForSnippets(ctx, paragraphText);
    }
    return;
  }
  
  // Recurse into content array
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      if (ctx.done) return;
      traverseContentForSnippets(ctx, child);
    }
  }
}

/**
 * Find snippets in TipTap content with early-exit
 */
export function findSnippetsInContent(
  content: any,
  input: SnippetSearchInput,
  existingSnippetCount: number = 0
): DocumentSnippet[] {
  const ctx: TraversalContext = {
    snippets: [],
    matcher: createMatcher(input),
    nodeSnippetCounts: new Map(),
    charsScanned: 0,
    done: existingSnippetCount >= MAX_SNIPPETS_PER_DOCUMENT,
  };

  if (!ctx.done) {
    traverseContentForSnippets(ctx, content);
  }

  // Limit to remaining slots
  const remaining = MAX_SNIPPETS_PER_DOCUMENT - existingSnippetCount;
  return ctx.snippets.slice(0, remaining);
}

// Re-export types for backwards compatibility
export { MAX_SNIPPETS_PER_DOCUMENT };
