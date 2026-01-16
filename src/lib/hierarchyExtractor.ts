import { HierarchyBlockData } from '@/types/document';
import { HierarchyNode } from '@/types/node';

/**
 * Extract a flat outline from HierarchyBlockData
 * Returns array of { label, depth } for import into another outline
 */
export function extractOutlineFromHierarchyBlock(
  block: HierarchyBlockData
): Array<{ label: string; depth: number }> {
  if (!block || !block.tree || !Array.isArray(block.tree)) {
    return [];
  }

  const result: Array<{ label: string; depth: number }> = [];

  // Recursive traversal of the tree
  function traverse(nodes: HierarchyNode[], depth: number) {
    for (const node of nodes) {
      if (node.label) {
        result.push({ label: node.label, depth });
      }

      if (node.children && Array.isArray(node.children)) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(block.tree, 0);
  return result;
}
