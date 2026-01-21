import { HierarchyNode, FlatNode } from '@/types/node';
import { flattenTree } from '@/lib/nodeOperations';

/**
 * Spritz Speed Reading Utilities
 *
 * Implements the Optimal Recognition Point (ORP) algorithm and text processing
 * for rapid serial visual presentation (RSVP) reading.
 */

export interface SpritzWord {
  text: string;
  orpIndex: number;
  pauseMultiplier: number;
}

export interface SpritzNode {
  id: string;
  label: string;
  prefix: string;
  depth: number;
  words: SpritzWord[];
}

/**
 * Calculate the Optimal Recognition Point (ORP) for a word.
 * The ORP is the character position where the eye should focus for fastest recognition.
 * 
 * Standard ORP positions based on word length:
 * - 1 char: position 0
 * - 2-5 chars: position 1
 * - 6-9 chars: position 2
 * - 10-13 chars: position 3
 * - 14+ chars: position 4
 */
export function calculateORP(word: string): number {
  const len = word.length;
  if (len <= 1) return 0;
  if (len <= 5) return 1;
  if (len <= 9) return 2;
  if (len <= 13) return 3;
  return 4;
}

/**
 * Calculate the pause multiplier for a word based on punctuation.
 * Certain punctuation marks warrant longer display times.
 */
export function calculatePauseMultiplier(word: string): number {
  const lastChar = word.slice(-1);
  
  // Sentence-ending punctuation: 2x pause
  if ('.!?'.includes(lastChar)) return 2.0;
  
  // Clause-separating punctuation: 1.5x pause
  if (',;:'.includes(lastChar)) return 1.5;
  
  // Long words (>10 chars): 1.3x pause
  if (word.length > 10) return 1.3;
  
  return 1.0;
}

/**
 * Parse a string into SpritzWord objects with ORP and pause data.
 */
export function parseTextToWords(text: string): SpritzWord[] {
  if (!text || text.trim() === '') return [];
  
  // Split on whitespace, keeping punctuation attached to words
  const rawWords = text.split(/\s+/).filter(w => w.length > 0);
  
  return rawWords.map(word => ({
    text: word,
    orpIndex: calculateORP(word),
    pauseMultiplier: calculatePauseMultiplier(word),
  }));
}

/**
 * Extract text content from a node's label.
 * Strips any markdown or special formatting.
 */
export function extractNodeText(node: FlatNode | HierarchyNode): string {
  return node.label?.trim() ?? '';
}

/**
 * Build a flat list of SpritzNode objects from a tree, starting from a given node.
 * If startNodeId is provided, only includes that node and its descendants.
 */
export function buildSpritzNodes(
  tree: HierarchyNode[],
  startNodeId?: string,
  prefixGenerator?: (node: FlatNode) => string
): SpritzNode[] {
  const flat = flattenTree(tree);
  
  // Find start index if startNodeId provided
  let startIndex = 0;
  let startDepth = 0;
  
  if (startNodeId) {
    startIndex = flat.findIndex(n => n.id === startNodeId);
    if (startIndex === -1) return [];
    startDepth = flat[startIndex].depth;
  }
  
  const result: SpritzNode[] = [];
  
  for (let i = startIndex; i < flat.length; i++) {
    const node = flat[i];
    
    // If we started from a specific node, stop when we exit that subtree
    if (startNodeId && i > startIndex && node.depth <= startDepth) {
      break;
    }
    
    const text = extractNodeText(node);
    if (text.length === 0) continue;
    
    result.push({
      id: node.id,
      label: text,
      prefix: prefixGenerator ? prefixGenerator(node) : '',
      depth: node.depth,
      words: parseTextToWords(text),
    });
  }
  
  return result;
}

/**
 * Calculate the delay in milliseconds for a word at a given WPM.
 */
export function calculateWordDelay(wpm: number, pauseMultiplier: number = 1.0): number {
  const baseDelay = 60000 / wpm; // ms per word
  return Math.round(baseDelay * pauseMultiplier);
}

/**
 * Get total word count across all SpritzNodes.
 */
export function getTotalWordCount(nodes: SpritzNode[]): number {
  return nodes.reduce((sum, node) => sum + node.words.length, 0);
}

/**
 * Find the node and word index for a global word position.
 */
export function findWordPosition(
  nodes: SpritzNode[],
  globalIndex: number
): { nodeIndex: number; wordIndex: number } | null {
  let cumulative = 0;
  
  for (let i = 0; i < nodes.length; i++) {
    const nodeWordCount = nodes[i].words.length;
    if (globalIndex < cumulative + nodeWordCount) {
      return {
        nodeIndex: i,
        wordIndex: globalIndex - cumulative,
      };
    }
    cumulative += nodeWordCount;
  }
  
  return null;
}

/**
 * Get the global word index from node and word indices.
 */
export function getGlobalWordIndex(nodes: SpritzNode[], nodeIndex: number, wordIndex: number): number {
  let cumulative = 0;
  for (let i = 0; i < nodeIndex && i < nodes.length; i++) {
    cumulative += nodes[i].words.length;
  }
  return cumulative + wordIndex;
}

/**
 * Build a section tree for quick navigation.
 */
export interface SectionOption {
  id: string;
  prefix: string;
  label: string;
  depth: number;
  wordCount: number;
}

export function buildSectionOptions(
  tree: HierarchyNode[],
  prefixGenerator: (node: FlatNode) => string
): SectionOption[] {
  const flat = flattenTree(tree);
  
  return flat
    .filter(node => node.type !== 'body') // Only numbered/heading nodes
    .map(node => {
      // Count words in this node and its descendants
      const subtree = buildSpritzNodes(tree, node.id, prefixGenerator);
      const wordCount = getTotalWordCount(subtree);
      
      return {
        id: node.id,
        prefix: prefixGenerator(node),
        label: node.label?.slice(0, 40) ?? '',
        depth: node.depth,
        wordCount,
      };
    })
    .filter(opt => opt.wordCount > 0);
}
