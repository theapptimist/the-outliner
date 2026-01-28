import { MixedStyleConfig, LevelStyle, DEFAULT_MIXED_CONFIG, STANDARD_MIXED_CONFIG } from './outlineStyles';

export interface CustomStyle {
  id: string;
  name: string;
  description: string;
  config: MixedStyleConfig;
  createdAt: number;
}

const STORAGE_KEY = 'outliner-custom-styles';
const DEFAULT_STYLE_KEY = 'outliner-default-style';

// Get all custom styles from localStorage
export function getCustomStyles(): CustomStyle[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load custom styles:', e);
  }
  return [];
}

// Save custom styles to localStorage
export function saveCustomStyles(styles: CustomStyle[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(styles));
  } catch (e) {
    console.error('Failed to save custom styles:', e);
  }
}

// Add a new custom style
export function addCustomStyle(style: Omit<CustomStyle, 'id' | 'createdAt'>): CustomStyle {
  const newStyle: CustomStyle = {
    ...style,
    id: `custom-${Date.now()}`,
    createdAt: Date.now(),
  };
  const styles = getCustomStyles();
  styles.push(newStyle);
  saveCustomStyles(styles);
  return newStyle;
}

// Update an existing custom style
export function updateCustomStyle(id: string, updates: Partial<Omit<CustomStyle, 'id' | 'createdAt'>>): CustomStyle | null {
  const styles = getCustomStyles();
  const index = styles.findIndex(s => s.id === id);
  if (index === -1) return null;
  
  styles[index] = { ...styles[index], ...updates };
  saveCustomStyles(styles);
  return styles[index];
}

// Delete a custom style
export function deleteCustomStyle(id: string): boolean {
  const styles = getCustomStyles();
  const filtered = styles.filter(s => s.id !== id);
  if (filtered.length === styles.length) return false;
  
  saveCustomStyles(filtered);
  
  // If the deleted style was the default, clear the default
  if (getDefaultStyleId() === id) {
    clearDefaultStyle();
  }
  
  return true;
}

// Get a custom style by ID
export function getCustomStyle(id: string): CustomStyle | null {
  const styles = getCustomStyles();
  return styles.find(s => s.id === id) || null;
}

// Create a default config for a new custom style
export function createDefaultCustomConfig(): MixedStyleConfig {
  return {
    levels: [
      { format: 'numeric', underline: false, suffix: '' },
      { format: 'alpha-lower', underline: false, suffix: '' },
      { format: 'roman-lower', underline: false, suffix: '' },
      { format: 'numeric-paren', underline: false, suffix: '' },
      { format: 'alpha-lower-paren', underline: false, suffix: '' },
      { format: 'roman-lower-paren', underline: false, suffix: '' },
    ]
  };
}

// Default style management
export function getDefaultStyleId(): string | null {
  try {
    return localStorage.getItem(DEFAULT_STYLE_KEY);
  } catch (e) {
    console.error('Failed to get default style:', e);
    return null;
  }
}

export function setDefaultStyleId(id: string): void {
  try {
    localStorage.setItem(DEFAULT_STYLE_KEY, id);
  } catch (e) {
    console.error('Failed to set default style:', e);
  }
}

export function clearDefaultStyle(): void {
  try {
    localStorage.removeItem(DEFAULT_STYLE_KEY);
  } catch (e) {
    console.error('Failed to clear default style:', e);
  }
}

// Get the default style config (returns null if no default is set)
export function getDefaultStyleConfig(): MixedStyleConfig | null {
  const defaultId = getDefaultStyleId();
  if (!defaultId) return null;
  
  // Check presets first
  const preset = PRESET_STYLES.find(p => p.id === defaultId);
  if (preset) return preset.config;
  
  // Check custom styles
  const custom = getCustomStyle(defaultId);
  if (custom) return custom.config;
  
  return null;
}

// Built-in presets (now with IDs for default selection)
export const PRESET_STYLES: (Omit<CustomStyle, 'createdAt'> & { id: string })[] = [
  {
    id: 'preset-standard',
    name: 'Standard Mixed',
    description: '1. a. i. (1) (a) (i)',
    config: STANDARD_MIXED_CONFIG,
  },
  {
    id: 'preset-heading',
    name: 'Heading Style',
    description: 'Level 1 with colon separator',
    config: DEFAULT_MIXED_CONFIG,
  },
  {
    id: 'preset-numeric',
    name: 'Numeric',
    description: '1. 2. 3. at all levels',
    config: {
      levels: [
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
      ]
    },
  },
  {
    id: 'preset-bullet',
    name: 'Bullets',
    description: '• ○ ■ bullet points',
    config: {
      levels: [
        { format: 'bullet' },
        { format: 'bullet' },
        { format: 'bullet' },
        { format: 'bullet' },
        { format: 'bullet' },
        { format: 'bullet' },
      ]
    },
  },
  {
    id: 'preset-roman',
    name: 'Roman',
    description: 'I. II. III. uppercase Roman',
    config: {
      levels: [
        { format: 'roman' },
        { format: 'roman' },
        { format: 'roman' },
        { format: 'roman' },
        { format: 'roman' },
        { format: 'roman' },
      ]
    },
  },
  {
    id: 'preset-roman-lower',
    name: 'Roman Lower',
    description: 'i. ii. iii. lowercase Roman',
    config: {
      levels: [
        { format: 'roman-lower' },
        { format: 'roman-lower' },
        { format: 'roman-lower' },
        { format: 'roman-lower' },
        { format: 'roman-lower' },
        { format: 'roman-lower' },
      ]
    },
  },
  {
    id: 'preset-alpha',
    name: 'Alphabetic',
    description: 'A. B. C. uppercase letters',
    config: {
      levels: [
        { format: 'alpha' },
        { format: 'alpha' },
        { format: 'alpha' },
        { format: 'alpha' },
        { format: 'alpha' },
        { format: 'alpha' },
      ]
    },
  },
  {
    id: 'preset-alpha-lower',
    name: 'Alpha Lower',
    description: 'a. b. c. lowercase letters',
    config: {
      levels: [
        { format: 'alpha-lower' },
        { format: 'alpha-lower' },
        { format: 'alpha-lower' },
        { format: 'alpha-lower' },
        { format: 'alpha-lower' },
        { format: 'alpha-lower' },
      ]
    },
  },
  {
    id: 'preset-legal',
    name: 'Legal',
    description: '1.1, 1.1.1 hierarchical numbering',
    config: {
      levels: [
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
        { format: 'numeric' },
      ]
    },
  },
  {
    id: 'preset-academic',
    name: 'Academic',
    description: 'Roman → Alpha → Numeric',
    config: {
      levels: [
        { format: 'roman', underline: true },
        { format: 'alpha' },
        { format: 'numeric' },
        { format: 'alpha-lower' },
        { format: 'roman-lower' },
        { format: 'numeric-paren' },
      ]
    },
  },
];
