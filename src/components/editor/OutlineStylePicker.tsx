import { useState } from 'react';
import { OutlineStyle, OUTLINE_STYLES, MixedStyleConfig, DEFAULT_MIXED_CONFIG, FORMAT_OPTIONS, FormatType, LevelStyle, STANDARD_MIXED_CONFIG } from '@/lib/outlineStyles';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ChevronDown, Settings2, Underline, ChevronUp, Italic, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { StyleManager } from './StyleManager';
import { Separator } from '@/components/ui/separator';

interface OutlineStylePickerProps {
  value: OutlineStyle;
  onChange: (style: OutlineStyle) => void;
  mixedConfig?: MixedStyleConfig;
  onMixedConfigChange?: (config: MixedStyleConfig) => void;
}

export function OutlineStylePicker({ 
  value, 
  onChange, 
  mixedConfig = DEFAULT_MIXED_CONFIG,
  onMixedConfigChange 
}: OutlineStylePickerProps) {
  const [showStyleManager, setShowStyleManager] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  
  const currentStyle = OUTLINE_STYLES.find(s => s.id === value);
  
  // Helper to get format from LevelStyle
  const getFormat = (level: LevelStyle): FormatType => level.format;
  
  // Build display text from mixed config if using mixed style
  const getDisplayText = () => {
    if (value === 'mixed' && mixedConfig) {
      return mixedConfig.levels.slice(0, 3).map(level => {
        const format = getFormat(level);
        const opt = FORMAT_OPTIONS.find(f => f.id === format);
        return opt?.example || '?';
      }).join(' ');
    }
    return currentStyle?.example.join(' ') || '1. a. i.';
  };

  const handleApplyFromManager = (config: MixedStyleConfig) => {
    if (!onMixedConfigChange) return;
    onChange('mixed');
    onMixedConfigChange(config);
  };

  const handleLevelChange = (levelIndex: number, format: FormatType) => {
    if (!onMixedConfigChange) return;
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], format };
    onMixedConfigChange({ levels: newLevels });
  };

  const handleUnderlineChange = (levelIndex: number, underline: boolean) => {
    if (!onMixedConfigChange) return;
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], underline };
    onMixedConfigChange({ levels: newLevels });
  };

  const handleItalicChange = (levelIndex: number, italic: boolean) => {
    if (!onMixedConfigChange) return;
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], italic };
    onMixedConfigChange({ levels: newLevels });
  };

  const handleSuffixChange = (levelIndex: number, suffix: string) => {
    if (!onMixedConfigChange) return;
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], suffix };
    onMixedConfigChange({ levels: newLevels });
  };

  const applyPreset = (preset: MixedStyleConfig) => {
    if (!onMixedConfigChange) return;
    onMixedConfigChange(preset);
  };

  const moveLevel = (index: number, direction: 'up' | 'down') => {
    if (!onMixedConfigChange) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mixedConfig.levels.length) return;
    
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];
    onMixedConfigChange({ levels: newLevels });
  };
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-0.5 text-xs font-mono"
          title="Outline numbering style"
        >
          <span>{getDisplayText()}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-2" align="start">
        {!showCustomize ? (
          <>
            {/* Manage Styles button at top */}
            <button
              onClick={() => setShowStyleManager(true)}
              className="flex items-center gap-2 w-full px-2 py-2 rounded text-left transition-colors hover:bg-secondary mb-2"
            >
              <Settings className="h-4 w-4" />
              <div className="flex-1">
                <div className="text-sm font-medium">Manage Styles</div>
                <div className="text-xs text-muted-foreground">Create and edit custom styles</div>
              </div>
            </button>
            
            <Separator className="my-2" />
            
            <div className="text-xs font-medium text-muted-foreground mb-2 px-1">
              Numbering Style
            </div>
            <div className="grid gap-1">
              {OUTLINE_STYLES.map((style) => (
                <button
                  key={style.id}
                  onClick={() => onChange(style.id)}
                  className={cn(
                    'flex items-center gap-3 px-2 py-1.5 rounded text-left transition-colors',
                    value === style.id
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-secondary'
                  )}
                >
                  <div className="flex items-center gap-1 w-16 text-xs font-mono">
                    {style.example.map((ex, i) => (
                      <span key={i} className="opacity-70">{ex}</span>
                    ))}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{style.name}</div>
                    <div className={cn(
                      'text-xs',
                      value === style.id ? 'text-primary-foreground/70' : 'text-muted-foreground'
                    )}>
                      {style.description}
                    </div>
                  </div>
                  {style.id === 'mixed' && value === 'mixed' && onMixedConfigChange && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 ml-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowCustomize(true);
                      }}
                    >
                      <Settings2 className="h-3 w-3" />
                    </Button>
                  )}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-muted-foreground">
                Customize Mixed Style
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setShowCustomize(false)}
              >
                ← Back
              </Button>
            </div>
            
            {/* Presets */}
            <div className="flex gap-1 mb-3">
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs flex-1"
                onClick={() => applyPreset(STANDARD_MIXED_CONFIG)}
              >
                Standard
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-6 text-xs flex-1"
                onClick={() => applyPreset(DEFAULT_MIXED_CONFIG)}
              >
                Heading:
              </Button>
            </div>
            
            <div className="grid gap-1.5">
              {mixedConfig.levels.map((level, index) => {
                return (
                  <div key={index} className="flex items-center gap-1">
                    {/* Reorder buttons */}
                    <div className="flex flex-col">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-5 p-0"
                        onClick={() => moveLevel(index, 'up')}
                        disabled={index === 0}
                      >
                        <ChevronUp className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-3 w-5 p-0"
                        onClick={() => moveLevel(index, 'down')}
                        disabled={index === mixedConfig.levels.length - 1}
                      >
                        <ChevronDown className="h-3 w-3" />
                      </Button>
                    </div>
                    
                    <span className="text-xs text-muted-foreground w-8">L{index + 1}</span>
                    <Select
                      value={level.format}
                      onValueChange={(val) => handleLevelChange(index, val as FormatType)}
                    >
                      <SelectTrigger className="h-7 text-xs w-16">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAT_OPTIONS.map((opt) => (
                          <SelectItem key={opt.id} value={opt.id} className="text-xs">
                            <span className="font-mono mr-2">{opt.example}</span>
                            <span className="text-muted-foreground">{opt.label}</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <div className="flex items-center gap-0.5">
                      <Checkbox
                        id={`underline-${index}`}
                        checked={level.underline || false}
                        onCheckedChange={(checked) => handleUnderlineChange(index, !!checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`underline-${index}`} className="cursor-pointer" title="Auto-underline">
                        <Underline className="h-3 w-3 text-muted-foreground" />
                      </label>
                    </div>
                    <div className="flex items-center gap-0.5">
                      <Checkbox
                        id={`italic-${index}`}
                        checked={level.italic || false}
                        onCheckedChange={(checked) => handleItalicChange(index, !!checked)}
                        className="h-4 w-4"
                      />
                      <label htmlFor={`italic-${index}`} className="cursor-pointer" title="Auto-italic">
                        <Italic className="h-3 w-3 text-muted-foreground" />
                      </label>
                    </div>
                    <Input
                      value={level.suffix || ''}
                      onChange={(e) => handleSuffixChange(index, e.target.value)}
                      placeholder=""
                      className="h-7 w-8 text-xs text-center px-0.5"
                      maxLength={2}
                      title="Suffix"
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-3 pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground">
                Preview: {mixedConfig.levels.map((level, i) => {
                  const opt = FORMAT_OPTIONS.find(o => o.id === level.format);
                  let preview = opt?.example || '?';
                  if (level.suffix) preview = `${preview}${level.suffix}`;
                  return (
                    <span 
                      key={i}
                      className={cn(
                        level.underline && 'underline',
                        level.italic && 'italic',
                      )}
                    >
                      {preview}
                      {i < mixedConfig.levels.length - 1 && ' → '}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
      
      {/* Style Manager Dialog */}
      <StyleManager
        open={showStyleManager}
        onOpenChange={setShowStyleManager}
        onSelectStyle={handleApplyFromManager}
        currentConfig={mixedConfig}
      />
    </Popover>
  );
}
