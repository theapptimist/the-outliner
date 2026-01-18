import { HierarchyNode } from '@/types/node';

/**
 * Extracts all readable text content from hierarchy blocks for AI analysis.
 * Includes node labels and body content with hierarchical context.
 */
export function extractDocumentContent(
  hierarchyBlocks: Record<string, HierarchyNode[]>
): string {
  const textParts: string[] = [];

  for (const [blockId, nodes] of Object.entries(hierarchyBlocks)) {
    const blockText = extractNodesText(nodes, 0);
    if (blockText.trim()) {
      textParts.push(blockText);
    }
  }

  return textParts.join('\n\n');
}

/**
 * Recursively extracts text from hierarchy nodes with proper indentation
 * to preserve document structure for AI understanding.
 */
function extractNodesText(nodes: HierarchyNode[], depth: number): string {
  const lines: string[] = [];
  const indent = '  '.repeat(depth);

  for (const node of nodes) {
    // Add the node label
    if (node.label && node.label.trim()) {
      lines.push(`${indent}${node.label}`);
    }

    // Add content if present (TipTap rich text)
    if (node.content) {
      const contentText = extractPlainTextFromContent(node.content);
      if (contentText.trim()) {
        lines.push(`${indent}  ${contentText}`);
      }
    }

    // Recursively process children
    if (node.children && node.children.length > 0) {
      const childText = extractNodesText(node.children, depth + 1);
      if (childText.trim()) {
        lines.push(childText);
      }
    }
  }

  return lines.join('\n');
}

/**
 * Extracts plain text from TipTap JSON content structure.
 */
function extractPlainTextFromContent(content: any): string {
  if (!content) return '';
  
  // Handle string content
  if (typeof content === 'string') {
    return content;
  }

  // Handle TipTap document structure
  if (content.type === 'doc' && content.content) {
    return content.content.map(extractPlainTextFromContent).join(' ');
  }

  // Handle paragraph nodes
  if (content.type === 'paragraph' && content.content) {
    return content.content.map(extractPlainTextFromContent).join('');
  }

  // Handle text nodes
  if (content.type === 'text' && content.text) {
    return content.text;
  }

  // Handle arrays
  if (Array.isArray(content)) {
    return content.map(extractPlainTextFromContent).join(' ');
  }

  // Handle objects with content property
  if (content.content) {
    return extractPlainTextFromContent(content.content);
  }

  return '';
}

/**
 * Extracts text from TipTap editor content (for the main document body).
 */
export function extractEditorContent(editorContent: any): string {
  if (!editorContent) return '';

  const textParts: string[] = [];

  function traverse(node: any) {
    if (!node) return;

    // Skip hierarchy blocks - they're handled separately
    if (node.type === 'hierarchyBlock') {
      return;
    }

    // Extract text from text nodes
    if (node.type === 'text' && node.text) {
      textParts.push(node.text);
    }

    // Recurse into content
    if (node.content && Array.isArray(node.content)) {
      for (const child of node.content) {
        traverse(child);
      }
    }
  }

  traverse(editorContent);
  return textParts.join(' ');
}

/**
 * Combines all document content for AI analysis.
 * Limits output to a reasonable size for AI processing.
 */
export function getFullDocumentText(
  hierarchyBlocks: Record<string, HierarchyNode[]>,
  editorContent?: any,
  maxLength: number = 32000
): string {
  const parts: string[] = [];

  // Extract hierarchy content
  const hierarchyText = extractDocumentContent(hierarchyBlocks);
  if (hierarchyText.trim()) {
    parts.push('=== Document Outline ===\n' + hierarchyText);
  }

  // Extract editor body content (non-hierarchy)
  if (editorContent) {
    const bodyText = extractEditorContent(editorContent);
    if (bodyText.trim()) {
      parts.push('=== Document Body ===\n' + bodyText);
    }
  }

  const fullText = parts.join('\n\n');

  // Truncate if too long
  if (fullText.length > maxLength) {
    return fullText.slice(0, maxLength) + '\n\n[Content truncated for analysis...]';
  }

  return fullText;
}
