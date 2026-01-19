import { HierarchyNode } from '@/types/node';
import { OutlineStyle, MixedStyleConfig, getOutlinePrefix, getOutlinePrefixCustom, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';

// Date usage tracking (mirrors TermUsage)
export interface DateUsage {
  blockId: string;
  nodeId: string;
  nodeLabel: string;
  nodePrefix: string;
  count: number;
}

// Tagged date structure
export interface TaggedDate {
  id: string;
  date: Date;                    // Normalized date value
  rawText: string;               // Original text (e.g., "March 2022")
  description?: string;          // Optional note about what happened
  usages: DateUsage[];           // Where this date appears
}

// Detected date from auto-scan
export interface DetectedDate {
  rawText: string;
  normalizedDate: Date | null;   // null if couldn't parse
  confidence: 'high' | 'medium' | 'low';
  position: { start: number; end: number };
}

// Common date patterns
const DATE_PATTERNS = [
  // ISO format: 2022-03-15
  { regex: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, parser: parseISO },
  // US format: 3/15/2022 or 03/15/2022
  { regex: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, parser: parseUSDate },
  // Full month with day: March 15, 2022 or August 20, 2022 (Saturday) - must check day before month-only
  { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s*(\d{4})/gi, parser: parseFullMonthWithDay },
  // Month range: March-April 2021
  { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)[-–](January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi, parser: parseMonthRange },
  // Full month only: March 2022 (no day)
  { regex: /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})\b/gi, parser: parseFullMonthOnly },
  // Year with month in parentheses: 2019 (June)
  { regex: /\b(\d{4})\s*\((January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\)/gi, parser: parseYearParenMonth },
  // Approximate date with tilde: ~August 9-10, 2022 or ~1994
  { regex: /~\s*(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})(?:-\d{1,2})?,?\s*(\d{4})/gi, parser: parseApproxFullMonth },
  { regex: /~\s*(\d{4})\b/g, parser: parseApproxYear },
  // Abbreviated month: Mar 15, 2022 or Mar 2022
  { regex: /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\.?\s+(\d{1,2})?,?\s*(\d{4})\b/gi, parser: parseAbbrevMonth },
  // Season + year: Spring 2021
  { regex: /\b(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})\b/gi, parser: parseSeason },
  // Quarter: Q1 2020, Q3 2021
  { regex: /\bQ([1-4])\s+(\d{4})\b/gi, parser: parseQuarter },
  // Date range: 1966-67 or 1966-1967
  { regex: /\b(19\d{2}|20\d{2})[-–](\d{2,4})\b/g, parser: parseYearRange },
  // Year only: 2020, 2021 (lower confidence)
  { regex: /\b(19\d{2}|20\d{2})\b/g, parser: parseYearOnly },
];

const MONTH_MAP: Record<string, number> = {
  january: 0, jan: 0,
  february: 1, feb: 1,
  march: 2, mar: 2,
  april: 3, apr: 3,
  may: 4,
  june: 5, jun: 5,
  july: 6, jul: 6,
  august: 7, aug: 7,
  september: 8, sep: 8,
  october: 9, oct: 9,
  november: 10, nov: 10,
  december: 11, dec: 11,
};

const SEASON_MAP: Record<string, number> = {
  spring: 2,   // March
  summer: 5,   // June
  fall: 8,     // September
  autumn: 8,
  winter: 11,  // December
};

function parseISO(match: RegExpMatchArray): Date | null {
  const [, year, month, day] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

function parseUSDate(match: RegExpMatchArray): Date | null {
  const [, month, day, year] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

function parseFullMonth(match: RegExpMatchArray): Date | null {
  const [, month, day, year] = match;
  const monthNum = MONTH_MAP[month.toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, day ? parseInt(day) : 1);
}

function parseFullMonthWithDay(match: RegExpMatchArray): Date | null {
  const [, month, day, year] = match;
  const monthNum = MONTH_MAP[month.toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, parseInt(day));
}

function parseFullMonthOnly(match: RegExpMatchArray): Date | null {
  const [, month, year] = match;
  const monthNum = MONTH_MAP[month.toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, 1);
}

function parseMonthRange(match: RegExpMatchArray): Date | null {
  // For ranges like "March-April 2021", use the first month
  const [, startMonth, , year] = match;
  const monthNum = MONTH_MAP[startMonth.toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, 1);
}

function parseYearParenMonth(match: RegExpMatchArray): Date | null {
  // For "2019 (June)" format
  const [, year, month] = match;
  const monthNum = MONTH_MAP[month.toLowerCase().replace('.', '')];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, 1);
}

function parseApproxFullMonth(match: RegExpMatchArray): Date | null {
  // For "~August 9-10, 2022" format
  const [, month, day, year] = match;
  const monthNum = MONTH_MAP[month.toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, parseInt(day));
}

function parseApproxYear(match: RegExpMatchArray): Date | null {
  // For "~1994" format
  const [, year] = match;
  return new Date(parseInt(year), 0, 1);
}

function parseYearRange(match: RegExpMatchArray): Date | null {
  // For "1966-67" or "1966-1967" format - use the first year
  const [, startYear] = match;
  return new Date(parseInt(startYear), 0, 1);
}

function parseAbbrevMonth(match: RegExpMatchArray): Date | null {
  const [, month, day, year] = match;
  const monthNum = MONTH_MAP[month.toLowerCase().replace('.', '')];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, day ? parseInt(day) : 1);
}

function parseSeason(match: RegExpMatchArray): Date | null {
  const [, season, year] = match;
  const monthNum = SEASON_MAP[season.toLowerCase()];
  if (monthNum === undefined) return null;
  return new Date(parseInt(year), monthNum, 1);
}

function parseQuarter(match: RegExpMatchArray): Date | null {
  const [, quarter, year] = match;
  const monthNum = (parseInt(quarter) - 1) * 3;
  return new Date(parseInt(year), monthNum, 1);
}

function parseYearOnly(match: RegExpMatchArray): Date | null {
  const [, year] = match;
  return new Date(parseInt(year), 0, 1);
}

/**
 * Detect dates in a text string
 */
export function detectDatesInText(text: string): DetectedDate[] {
  const detected: DetectedDate[] = [];
  const seenRanges = new Set<string>();

  for (const { regex, parser } of DATE_PATTERNS) {
    regex.lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const rangeKey = `${match.index}-${match.index + match[0].length}`;
      
      // Skip if we already detected a date at this position
      if (seenRanges.has(rangeKey)) continue;
      seenRanges.add(rangeKey);

      const normalizedDate = parser(match);
      const confidence = getConfidence(match[0], normalizedDate);

      detected.push({
        rawText: match[0],
        normalizedDate,
        confidence,
        position: { start: match.index, end: match.index + match[0].length },
      });
    }
  }

  // Sort by position
  return detected.sort((a, b) => a.position.start - b.position.start);
}

function getConfidence(rawText: string, date: Date | null): 'high' | 'medium' | 'low' {
  if (!date) return 'low';
  
  // Approximate dates (with ~) are lower confidence
  if (rawText.startsWith('~')) return 'medium';
  
  // Year-only patterns are low confidence
  if (/^~?\d{4}$/.test(rawText)) return 'low';
  
  // Year ranges like 1966-67 are low confidence
  if (/^\d{4}[-–]\d{2,4}$/.test(rawText)) return 'low';
  
  // Seasons and quarters are medium confidence
  if (/^(Spring|Summer|Fall|Autumn|Winter|Q[1-4])/i.test(rawText)) return 'medium';
  
  // Month ranges are medium confidence
  if (/^(January|February|March|April|May|June|July|August|September|October|November|December)[-–]/i.test(rawText)) return 'medium';
  
  // Year with parenthetical month: 2019 (June)
  if (/^\d{4}\s*\([A-Za-z]+\)$/.test(rawText)) return 'medium';
  
  // Full dates with day are high confidence
  if (/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(rawText)) return 'high';
  if (/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/i.test(rawText)) return 'high';
  if (/\d{1,2},?\s*\d{4}/.test(rawText)) return 'high';
  
  return 'medium';
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Scan hierarchy blocks for occurrences of a date's raw text
 */
export function scanForDateUsages(
  rawText: string,
  blocks: Array<{ id: string; tree: HierarchyNode[] }>,
  styleConfig?: { style: OutlineStyle; mixedConfig?: MixedStyleConfig }
): DateUsage[] {
  const usages: DateUsage[] = [];
  const regex = new RegExp(escapeRegex(rawText), 'gi');

  const style = styleConfig?.style ?? 'mixed';
  const mixedConfig = styleConfig?.mixedConfig ?? DEFAULT_MIXED_CONFIG;

  function computePrefix(depth: number, indices: number[]): string {
    // Build full hierarchical prefix by concatenating each level
    const parts: string[] = [];
    for (let d = 0; d <= depth; d++) {
      const levelIndices = indices.slice(0, d + 1);
      const levelPrefix = style === 'mixed'
        ? getOutlinePrefixCustom(d, levelIndices, mixedConfig)
        : getOutlinePrefix(style, d, levelIndices);
      // Remove trailing punctuation for compact display
      parts.push(levelPrefix.replace(/[.\s]+$/, '').replace(/^\(|\)$/g, ''));
    }
    return parts.join('');
  }

  function scanNode(node: HierarchyNode, blockId: string, depth: number, indices: number[]) {
    const label = node.label || '';
    regex.lastIndex = 0;
    
    let count = 0;
    while (regex.exec(label) !== null) {
      count++;
    }

    if (count > 0) {
      usages.push({
        blockId,
        nodeId: node.id,
        nodeLabel: label,
        nodePrefix: computePrefix(depth, indices),
        count,
      });
    }

    // Scan children
    node.children?.forEach((child, childIndex) => {
      scanNode(child, blockId, depth + 1, [...indices, childIndex + 1]);
    });
  }

  for (const block of blocks) {
    block.tree.forEach((rootNode, rootIndex) => {
      scanNode(rootNode, block.id, 0, [rootIndex + 1]);
    });
  }

  return usages;
}

/**
 * Format a date for display in the timeline
 */
export function formatDateForDisplay(date: Date): string {
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a date for grouping (year-quarter)
 */
export function getDateGroup(date: Date): { year: number; quarter: number } {
  return {
    year: date.getFullYear(),
    quarter: Math.floor(date.getMonth() / 3) + 1,
  };
}

/**
 * Sort dates chronologically
 */
export function sortDatesChronologically(dates: TaggedDate[]): TaggedDate[] {
  return [...dates].sort((a, b) => a.date.getTime() - b.date.getTime());
}
