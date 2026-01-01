/**
 * Utility functions for parsing and handling pasted outline text.
 */

// Common outline prefix patterns
const OUTLINE_PATTERNS = [
  // Numbered: 1. 2. 3. or 1) 2) 3)
  /^(\d+)[.)]\s*/,
  // Lowercase letters: a. b. c. or a) b) c)
  /^([a-z])[.)]\s*/i,
  // Roman numerals: i. ii. iii. or i) ii) iii)
  /^(i{1,3}|iv|vi{0,3}|ix|xi{0,3})[.)]\s*/i,
  // Bullets: • - * 
  /^[•\-\*]\s*/,
  // Parenthesized: (1) (a) (i)
  /^\((\d+|[a-z]|i{1,3}|iv|vi{0,3}|ix|xi{0,3})\)\s*/i,
];

export interface ParsedOutlineLine {
  originalText: string;
  strippedText: string;
  prefix: string;
  indentLevel: number;
  prefixType: 'number' | 'letter' | 'roman' | 'bullet' | 'parenthesized' | 'none';
}

export interface SmartPasteResult {
  hasOutlinePatterns: boolean;
  lines: ParsedOutlineLine[];
  rawText: string;
}

/**
 * Detects the type of outline prefix.
 */
function detectPrefixType(prefix: string): ParsedOutlineLine['prefixType'] {
  if (!prefix) return 'none';
  if (/^\(\d+\)/.test(prefix) || /^\([a-z]\)/i.test(prefix) || /^\([ivx]+\)/i.test(prefix)) return 'parenthesized';
  if (/^\d+[.)]/.test(prefix)) return 'number';
  if (/^[a-z][.)]/i.test(prefix)) return 'letter';
  if (/^[ivx]+[.)]/i.test(prefix)) return 'roman';
  if (/^[•\-\*]/.test(prefix)) return 'bullet';
  return 'none';
}

/**
 * Counts leading whitespace to determine indent level.
 */
function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  if (!match) return 0;
  const spaces = match[1];
  // Count tabs as 4 spaces
  return Math.floor(spaces.replace(/\t/g, '    ').length / 2);
}

/**
 * Parses a single line and extracts outline prefix information.
 */
function parseLine(line: string): ParsedOutlineLine {
  const trimmedLine = line.trimStart();
  const indentLevel = getIndentLevel(line);
  
  for (const pattern of OUTLINE_PATTERNS) {
    const match = trimmedLine.match(pattern);
    if (match) {
      return {
        originalText: line,
        strippedText: trimmedLine.slice(match[0].length),
        prefix: match[0],
        indentLevel,
        prefixType: detectPrefixType(match[0]),
      };
    }
  }
  
  return {
    originalText: line,
    strippedText: trimmedLine,
    prefix: '',
    indentLevel,
    prefixType: 'none',
  };
}

/**
 * Analyzes pasted text to detect and parse outline patterns.
 */
export function analyzeOutlineText(text: string): SmartPasteResult {
  const lines = text.split('\n');
  const parsedLines = lines.map(parseLine);
  
  // Check if any lines have outline patterns
  const linesWithPatterns = parsedLines.filter(l => l.prefixType !== 'none');
  const hasOutlinePatterns = linesWithPatterns.length > 0 && 
    linesWithPatterns.length >= Math.min(2, lines.length * 0.3); // At least 2 lines or 30% have patterns
  
  return {
    hasOutlinePatterns,
    lines: parsedLines,
    rawText: text,
  };
}

/**
 * Strips all outline prefixes from the parsed lines.
 */
export function stripOutlinePrefixes(result: SmartPasteResult): string {
  return result.lines
    .map(line => line.strippedText)
    .join('\n');
}

/**
 * Converts parsed outline to a hierarchy structure for importing as nodes.
 * Returns an array of { label, depth } objects.
 */
export function parseOutlineHierarchy(result: SmartPasteResult): Array<{ label: string; depth: number }> {
  const hierarchy: Array<{ label: string; depth: number }> = [];
  
  // Track prefix types to infer hierarchy
  const prefixTypeOrder: ParsedOutlineLine['prefixType'][] = [];
  
  for (const line of result.lines) {
    if (!line.strippedText.trim()) continue; // Skip empty lines
    
    let depth = 0;
    
    if (line.prefixType !== 'none') {
      // Find or add this prefix type in the order
      const typeIndex = prefixTypeOrder.indexOf(line.prefixType);
      if (typeIndex >= 0) {
        depth = typeIndex;
      } else {
        // New prefix type, add it and use its position as depth
        prefixTypeOrder.push(line.prefixType);
        depth = prefixTypeOrder.length - 1;
      }
      
      // Also consider indentation
      depth = Math.max(depth, line.indentLevel);
    } else {
      // No prefix - use indentation level
      depth = line.indentLevel;
    }
    
    hierarchy.push({
      label: line.strippedText.trim(),
      depth: Math.min(depth, 5), // Cap at reasonable depth
    });
  }
  
  // Normalize depths to start at 0 and be sequential
  if (hierarchy.length > 0) {
    const minDepth = Math.min(...hierarchy.map(h => h.depth));
    hierarchy.forEach(h => h.depth -= minDepth);
  }
  
  return hierarchy;
}
