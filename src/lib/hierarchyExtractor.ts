import { HierarchyBlockData } from '@/types/document';
import { HierarchyNode } from '@/types/node';

/**
 * Extract a flat outline from HierarchyBlockData
 * Returns array of { label, depth } for import into another outline
 */
export function extractOutlineFromHierarchyBlock(
  block: HierarchyBlockData | HierarchyNode[]
): Array<{ label: string; depth: number }> {
  // Handle both formats: direct array or { id, tree } wrapper
  const nodes: HierarchyNode[] = Array.isArray(block) ? block : block?.tree;

  if (!nodes || !Array.isArray(nodes)) {
    return [];
  }

  const result: Array<{ label: string; depth: number }> = [];

  function traverse(nodeList: HierarchyNode[], depth: number) {
    for (const node of nodeList) {
      if (node.label) {
        result.push({ label: node.label, depth });
      }

      if (node.children && Array.isArray(node.children)) {
        traverse(node.children, depth + 1);
      }
    }
  }

  traverse(nodes, 0);
  return result;
}
