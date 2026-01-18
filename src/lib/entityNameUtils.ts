/**
 * Utility functions for normalizing entity names (People, Places, etc.)
 * to ensure consistent matching for highlighting and usage scanning.
 */

/**
 * Normalizes an entity name by:
 * - Trimming whitespace
 * - Collapsing multiple spaces to a single space
 * - Removing common leading/trailing punctuation that may be captured from text selections
 */
export function normalizeEntityName(name: string): string {
  if (!name) return '';
  
  // Trim whitespace
  let normalized = name.trim();
  
  // Collapse multiple spaces to single space
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Remove leading punctuation (quotes, parentheses, brackets, etc.)
  normalized = normalized.replace(/^["'""''`(\[{<«»]+/, '');
  
  // Remove trailing punctuation (commas, periods, semicolons, colons, quotes, parentheses, etc.)
  normalized = normalized.replace(/[,"'""''`.:;!?)}\]>«»]+$/, '');
  
  // Final trim in case removing punctuation left whitespace
  return normalized.trim();
}
