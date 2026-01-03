import { HierarchyNode } from '@/types/node';

export interface TermUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  count: number;
}

export interface ExtractedTerm {
  term: string;
  definition: string;
  sourceLabel: string;
}

/**
 * Extracts defined terms from AI-generated outline items.
 * Looks for patterns like: "Term" means..., the "Term", referred to as "Term"
 */
export function extractDefinedTermsFromItems(
  items: Array<{ label: string; depth: number }>
): ExtractedTerm[] {
  const terms: ExtractedTerm[] = [];
  const seenTerms = new Set<string>();

  for (const item of items) {
    const label = item.label;
    
    // Pattern 1: "Term" means/refers to... (definition pattern)
    // e.g., "Confidential Information" means any non-public information...
    const defPattern = /"([^"]+)"\s+(means|refers to|shall mean|is defined as)/gi;
    let match;
    while ((match = defPattern.exec(label)) !== null) {
      const term = match[1].trim();
      if (!seenTerms.has(term.toLowerCase())) {
        seenTerms.add(term.toLowerCase());
        terms.push({
          term,
          definition: label,
          sourceLabel: label.substring(0, 60) + (label.length > 60 ? '...' : ''),
        });
      }
    }

    // Pattern 2: the "Term" or (the "Term") - introducing a defined term
    // e.g., the parties (the "Parties"), hereinafter the "Landlord"
    const introPattern = /(?:the|hereinafter|referred to as|collectively,?)\s*(?:\(?\s*the\s*)?"([^"]+)"/gi;
    while ((match = introPattern.exec(label)) !== null) {
      const term = match[1].trim();
      if (!seenTerms.has(term.toLowerCase())) {
        seenTerms.add(term.toLowerCase());
        terms.push({
          term,
          definition: label,
          sourceLabel: label.substring(0, 60) + (label.length > 60 ? '...' : ''),
        });
      }
    }
  }

  return terms;
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
