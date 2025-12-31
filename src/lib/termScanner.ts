import { HierarchyNode } from '@/types/node';

export interface TermUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  count: number;
}

/**
 * Scans hierarchy nodes for occurrences of a term.
 * Uses case-insensitive matching with word boundaries.
 */
export function scanForTermUsages(
  term: string,
  blocks: { id: string; tree: HierarchyNode[] }[]
): TermUsage[] {
  const usages: TermUsage[] = [];
  const termLower = term.toLowerCase();
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(term)}\\b`, 'gi');

  function scanNode(node: HierarchyNode, blockId: string) {
    // Check the node's label
    const labelMatches = (node.label.match(wordBoundaryRegex) || []).length;
    
    // Check the node's rich content if it exists
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
        count: totalCount,
      });
    }

    // Recurse into children
    for (const child of node.children) {
      scanNode(child, blockId);
    }
  }

  for (const block of blocks) {
    for (const root of block.tree) {
      scanNode(root, block.id);
    }
  }

  return usages;
}

/**
 * Extracts plain text from TipTap JSON content.
 */
function extractPlainTextFromTipTap(content: any): string {
  if (!content) return '';
  
  if (typeof content === 'string') return content;
  
  if (content.text) return content.text;
  
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractPlainTextFromTipTap).join(' ');
  }
  
  return '';
}

/**
 * Escapes special regex characters in a string.
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
