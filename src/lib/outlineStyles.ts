export type OutlineStyle = 
  | 'none'           // No numbering
  | 'bullet'         // • ○ ■
  | 'numeric'        // 1. 2. 3.
  | 'alpha'          // A. B. C.
  | 'alpha-lower'    // a. b. c.
  | 'roman'          // I. II. III.
  | 'roman-lower'    // i. ii. iii.
  | 'legal'          // 1.1, 1.1.1
  | 'mixed';         // 1. a. i.

// Individual format types for customization
export type FormatType = 
  | 'numeric'        // 1.
  | 'numeric-paren'  // (1)
  | 'alpha'          // A.
  | 'alpha-paren'    // (A)
  | 'alpha-lower'    // a.
  | 'alpha-lower-paren' // (a)
  | 'roman'          // I.
  | 'roman-paren'    // (I)
  | 'roman-lower'    // i.
  | 'roman-lower-paren' // (i)
  | 'bullet';        // •

export interface MixedStyleConfig {
  levels: [FormatType, FormatType, FormatType, FormatType, FormatType, FormatType];
}

export const DEFAULT_MIXED_CONFIG: MixedStyleConfig = {
  levels: ['numeric', 'alpha-lower', 'roman-lower', 'numeric-paren', 'alpha-lower-paren', 'roman-lower-paren']
};

export const FORMAT_OPTIONS: { id: FormatType; label: string; example: string }[] = [
  { id: 'numeric', label: '1.', example: '1.' },
  { id: 'numeric-paren', label: '(1)', example: '(1)' },
  { id: 'alpha', label: 'A.', example: 'A.' },
  { id: 'alpha-paren', label: '(A)', example: '(A)' },
  { id: 'alpha-lower', label: 'a.', example: 'a.' },
  { id: 'alpha-lower-paren', label: '(a)', example: '(a)' },
  { id: 'roman', label: 'I.', example: 'I.' },
  { id: 'roman-paren', label: '(I)', example: '(I)' },
  { id: 'roman-lower', label: 'i.', example: 'i.' },
  { id: 'roman-lower-paren', label: '(i)', example: '(i)' },
  { id: 'bullet', label: '•', example: '•' },
];

export interface OutlineStyleConfig {
  id: OutlineStyle;
  name: string;
  description: string;
  example: string[];
}

export const OUTLINE_STYLES: OutlineStyleConfig[] = [
  { 
    id: 'none', 
    name: 'None', 
    description: 'No numbering',
    example: ['—', '—', '—']
  },
  { 
    id: 'bullet', 
    name: 'Bullets', 
    description: 'Bullet points',
    example: ['•', '○', '■']
  },
  { 
    id: 'numeric', 
    name: 'Numeric', 
    description: '1, 2, 3...',
    example: ['1.', '2.', '3.']
  },
  { 
    id: 'alpha', 
    name: 'Alphabetic', 
    description: 'A, B, C...',
    example: ['A.', 'B.', 'C.']
  },
  { 
    id: 'alpha-lower', 
    name: 'Lowercase', 
    description: 'a, b, c...',
    example: ['a.', 'b.', 'c.']
  },
  { 
    id: 'roman', 
    name: 'Roman', 
    description: 'I, II, III...',
    example: ['I.', 'II.', 'III.']
  },
  { 
    id: 'roman-lower', 
    name: 'Roman Lower', 
    description: 'i, ii, iii...',
    example: ['i.', 'ii.', 'iii.']
  },
  { 
    id: 'legal', 
    name: 'Legal', 
    description: '1.1, 1.1.1...',
    example: ['1.', '1.1', '1.1.1']
  },
  { 
    id: 'mixed', 
    name: 'Mixed', 
    description: '1. a. i. (1)...',
    example: ['1.', 'a.', 'i.']
  },
];

// Convert number to Roman numerals
function toRoman(num: number): string {
  // Guard against 0 or negative numbers
  if (num <= 0) return '?';
  
  const romanNumerals: [number, string][] = [
    [1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'],
    [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'],
    [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']
  ];
  
  let result = '';
  for (const [value, symbol] of romanNumerals) {
    while (num >= value) {
      result += symbol;
      num -= value;
    }
  }
  return result;
}

// Convert number to alphabetic (1=A, 26=Z, 27=AA, etc.)
function toAlpha(num: number): string {
  let result = '';
  while (num > 0) {
    num--;
    result = String.fromCharCode(65 + (num % 26)) + result;
    num = Math.floor(num / 26);
  }
  return result;
}

// Bullets for different depths
const BULLETS = ['•', '○', '■', '◇', '▸', '▹'];

// Get prefix for a node based on style, depth, and position
export function getOutlinePrefix(
  style: OutlineStyle,
  depth: number,
  indices: number[] // Array of 1-based indices at each depth level
): string {
  if (style === 'none') return '';
  
  const currentIndex = indices[depth] || 1;
  
  switch (style) {
    case 'bullet':
      return BULLETS[depth % BULLETS.length];
    
    case 'numeric':
      return `${currentIndex}.`;
    
    case 'alpha':
      return `${toAlpha(currentIndex)}.`;
    
    case 'alpha-lower':
      return `${toAlpha(currentIndex).toLowerCase()}.`;
    
    case 'roman':
      return `${toRoman(currentIndex)}.`;
    
    case 'roman-lower':
      return `${toRoman(currentIndex).toLowerCase()}.`;
    
    case 'legal':
      return indices.slice(0, depth + 1).join('.') + (depth > 0 ? '' : '.');
    
    case 'mixed': {
      // Use default pattern - for custom, use getOutlinePrefixCustom
      const patterns = [
        () => `${currentIndex}.`,
        () => `${toAlpha(currentIndex).toLowerCase()}.`,
        () => `${toRoman(currentIndex).toLowerCase()}.`,
        () => `(${currentIndex})`,
        () => `(${toAlpha(currentIndex).toLowerCase()})`,
        () => `(${toRoman(currentIndex).toLowerCase()})`,
      ];
      return patterns[depth % patterns.length]();
    }
    
    default:
      return '';
  }
}

// Get prefix using custom mixed config
export function getOutlinePrefixCustom(
  depth: number,
  indices: number[],
  config: MixedStyleConfig
): string {
  const currentIndex = indices[depth] || 1;
  const format = config.levels[depth % config.levels.length];
  
  return formatIndex(currentIndex, format);
}

// Format a single index based on format type
function formatIndex(index: number, format: FormatType): string {
  switch (format) {
    case 'numeric':
      return `${index}.`;
    case 'numeric-paren':
      return `(${index})`;
    case 'alpha':
      return `${toAlpha(index)}.`;
    case 'alpha-paren':
      return `(${toAlpha(index)})`;
    case 'alpha-lower':
      return `${toAlpha(index).toLowerCase()}.`;
    case 'alpha-lower-paren':
      return `(${toAlpha(index).toLowerCase()})`;
    case 'roman':
      return `${toRoman(index)}.`;
    case 'roman-paren':
      return `(${toRoman(index)})`;
    case 'roman-lower':
      return `${toRoman(index).toLowerCase()}.`;
    case 'roman-lower-paren':
      return `(${toRoman(index).toLowerCase()})`;
    case 'bullet':
      return '•';
    default:
      return `${index}.`;
  }
}
