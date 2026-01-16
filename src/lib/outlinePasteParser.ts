/**
 * Utility functions for parsing and handling pasted outline text.
 * Enhanced to support date-based hierarchies and indentation-only structures.
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

// Date patterns for timeline-style content
const DATE_LINE_PATTERNS = [
  // Full date: January 15, 2022 or January 2022
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}?,?\s*\d{4}/i,
  // Abbreviated date: Jan 15, 2022 or Jan 2022
  /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+\d{1,2}?,?\s*\d{4}/i,
  // Year with context: 2019 (June) or 2022 (approximate)
  /^\d{4}\s*\([^)]+\)/,
  // Date range: July 31 - August 16, 2022
  /^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}\s*[-–]\s*(January|February|March|April|May|June|July|August|September|October|November|December)?\s*\d{1,2}?,?\s*\d{4}/i,
  // ISO style: 2022-07-29
  /^\d{4}-\d{2}-\d{2}/,
  // US style: 07/29/2022 or 7/29/2022
  /^\d{1,2}\/\d{1,2}\/\d{4}/,
  // Season/Quarter: Spring 2022, Q1 2022
  /^(Spring|Summer|Fall|Winter|Autumn|Q[1-4])\s+\d{4}/i,
  // Approximate: ~August 9-10, 2022 or circa 2022
  /^[~≈]?\s*(January|February|March|April|May|June|July|August|September|October|November|December|circa|c\.)\s+/i,
];

// Section header patterns (lines that indicate major sections)
const SECTION_HEADER_PATTERNS = [
  // Title case headers ending with period or standalone
  /^[A-Z][A-Za-z\s]+Period$/,
  /^[A-Z][A-Za-z\s-]+$/,
];

export interface ParsedOutlineLine {
  originalText: string;
  strippedText: string;
  prefix: string;
  indentLevel: number;
  prefixType: 'number' | 'letter' | 'roman' | 'bullet' | 'parenthesized' | 'date' | 'section' | 'none';
  isDateLine: boolean;
  isSectionHeader: boolean;
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
 * Checks if a line starts with a date pattern.
 */
function isDateLine(text: string): boolean {
  const trimmed = text.trim();
  return DATE_LINE_PATTERNS.some(pattern => pattern.test(trimmed));
}

/**
 * Checks if a line looks like a section header.
 */
function isSectionHeader(text: string): boolean {
  const trimmed = text.trim();
  // Section headers: short, title-case lines without traditional outline prefixes
  if (trimmed.length > 50) return false;
  if (SECTION_HEADER_PATTERNS.some(p => p.test(trimmed))) return true;
  // Also detect standalone capitalized short lines (like "Pre-Crisis Period")
  if (/^[A-Z][A-Za-z\s\-']+$/.test(trimmed) && trimmed.split(/\s+/).length <= 5) return true;
  return false;
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
  const lineIsDate = isDateLine(trimmedLine);
  const lineIsSectionHeader = !lineIsDate && isSectionHeader(trimmedLine);
  
  // Check for traditional outline prefixes first
  for (const pattern of OUTLINE_PATTERNS) {
    const match = trimmedLine.match(pattern);
    if (match) {
      return {
        originalText: line,
        strippedText: trimmedLine.slice(match[0].length),
        prefix: match[0],
        indentLevel,
        prefixType: detectPrefixType(match[0]),
        isDateLine: false,
        isSectionHeader: false,
      };
    }
  }
  
  // Mark date lines and section headers
  return {
    originalText: line,
    strippedText: trimmedLine,
    prefix: '',
    indentLevel,
    prefixType: lineIsDate ? 'date' : (lineIsSectionHeader ? 'section' : 'none'),
    isDateLine: lineIsDate,
    isSectionHeader: lineIsSectionHeader,
  };
}

/**
 * Analyzes pasted text to detect and parse outline patterns.
 * Enhanced to detect date-based and indentation-based hierarchies.
 */
export function analyzeOutlineText(text: string): SmartPasteResult {
  const lines = text.split('\n');
  const parsedLines = lines.map(parseLine);
  
  // Count different types of structure indicators
  const traditionalPatterns = parsedLines.filter(l => 
    l.prefixType !== 'none' && l.prefixType !== 'date' && l.prefixType !== 'section'
  );
  const dateLines = parsedLines.filter(l => l.isDateLine);
  const sectionHeaders = parsedLines.filter(l => l.isSectionHeader);
  const nonEmptyLines = parsedLines.filter(l => l.strippedText.trim().length > 0);
  
  // Check for indentation variation (even without prefixes)
  const indentLevels = new Set(parsedLines.filter(l => l.strippedText.trim()).map(l => l.indentLevel));
  const hasIndentVariation = indentLevels.size > 1;
  
  // Determine if we should offer smart paste
  const hasOutlinePatterns = 
    // Traditional outline prefixes (at least 2 lines or 30%)
    (traditionalPatterns.length >= 2) ||
    (traditionalPatterns.length >= nonEmptyLines.length * 0.3) ||
    // Date-based timeline (at least 2 date lines)
    (dateLines.length >= 2) ||
    // Section headers with content (at least 1 header + indented content)
    (sectionHeaders.length >= 1 && hasIndentVariation) ||
    // Significant indentation variation suggesting hierarchy (3+ levels)
    (indentLevels.size >= 3 && nonEmptyLines.length >= 5);
  
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
 * Checks if the first line looks like a document title.
 */
function isDocumentTitle(text: string): boolean {
  const trimmed = text.trim();
  // Long lines or lines containing title keywords
  if (trimmed.length > 30) return true;
  if (/\b(Timeline|Outline|Project|Document|Overview|Summary|Draft|Notes)\b/i.test(trimmed)) return true;
  return false;
}

/**
 * Converts parsed outline to a hierarchy structure for importing as nodes.
 * Enhanced to handle date-based and indentation-only hierarchies.
 * Returns an array of { label, depth } objects.
 */
export function parseOutlineHierarchy(result: SmartPasteResult): Array<{ label: string; depth: number }> {
  const hierarchy: Array<{ label: string; depth: number }> = [];
  
  // Analyze the structure to determine hierarchy method
  const dateLines = result.lines.filter(l => l.isDateLine);
  const sectionHeaders = result.lines.filter(l => l.isSectionHeader);
  const traditionalPatterns = result.lines.filter(l => 
    l.prefixType !== 'none' && l.prefixType !== 'date' && l.prefixType !== 'section'
  );
  
  // Determine hierarchy mode
  const useTraditionalMode = traditionalPatterns.length >= 2;
  const useDateMode = !useTraditionalMode && dateLines.length >= 2;
  const useSectionMode = !useTraditionalMode && !useDateMode && sectionHeaders.length >= 1;
  
  // For date/section mode, we use a different approach
  if (useDateMode || useSectionMode) {
    let currentSectionDepth = -1;
    let currentDateDepth = -1;
    let isFirstNonEmptyLine = true;
    let hasTitle = false;
    
    for (const line of result.lines) {
      const text = line.strippedText.trim();
      if (!text) continue; // Skip empty lines
      
      let depth = 0;
      
      // Check if first line is a document title
      if (isFirstNonEmptyLine) {
        isFirstNonEmptyLine = false;
        // Title detection: long line or contains title keywords, but NOT a date or section header
        if (!line.isDateLine && !line.isSectionHeader && isDocumentTitle(text)) {
          hasTitle = true;
          hierarchy.push({ label: text, depth: 0 });
          continue;
        }
      }
      
      const titleOffset = hasTitle ? 1 : 0;
      
      if (line.isSectionHeader) {
        // Section headers: depth 0 (no title) or depth 1 (with title)
        depth = titleOffset;
        currentSectionDepth = depth;
        currentDateDepth = -1;
      } else if (line.isDateLine) {
        // Dates: one level deeper than sections
        depth = currentSectionDepth >= 0 ? currentSectionDepth + 1 : titleOffset;
        currentDateDepth = depth;
      } else {
        // Content/bullets: one level deeper than dates or sections
        depth = currentDateDepth >= 0 ? currentDateDepth + 1 : 
                currentSectionDepth >= 0 ? currentSectionDepth + 1 : 
                titleOffset;
      }
      
      hierarchy.push({
        label: text,
        depth: Math.min(depth, 6), // Cap at reasonable depth
      });
    }
  } else {
    // Traditional prefix-based hierarchy
    const prefixTypeOrder: ParsedOutlineLine['prefixType'][] = [];
    
    for (const line of result.lines) {
      if (!line.strippedText.trim()) continue; // Skip empty lines
      
      let depth = 0;
      
      if (line.prefixType !== 'none' && line.prefixType !== 'date' && line.prefixType !== 'section') {
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
  }
  
  // Normalize depths to start at 0 and be sequential
  if (hierarchy.length > 0) {
    const minDepth = Math.min(...hierarchy.map(h => h.depth));
    hierarchy.forEach(h => h.depth -= minDepth);
  }
  
  return hierarchy;
}
