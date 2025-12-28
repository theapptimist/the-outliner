import { useState } from 'react';
import { OutlineStyle, OUTLINE_STYLES, MixedStyleConfig, DEFAULT_MIXED_CONFIG, FORMAT_OPTIONS, FormatType } from '@/lib/outlineStyles';
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
import { ChevronDown, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const [showCustomize, setShowCustomize] = useState(false);
  
  const currentStyle = OUTLINE_STYLES.find(s => s.id === value);
  
  // Build display text from mixed config if using mixed style
  const getDisplayText = () => {
    if (value === 'mixed' && mixedConfig) {
      return mixedConfig.levels.slice(0, 3).map(format => {
        const opt = FORMAT_OPTIONS.find(f => f.id === format);
        return opt?.example || '?';
      }).join(' ');
    }
    return currentStyle?.example.join(' ') || '1. a. i.';
  };

  const handleLevelChange = (levelIndex: number, format: FormatType) => {
    if (!onMixedConfigChange) return;
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    newLevels[levelIndex] = format;
    onMixedConfigChange({ levels: newLevels });
  };

  const levelLabels = ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6'];
  
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
      <PopoverContent className="w-72 p-2" align="start">
        {!showCustomize ? (
          <>
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
            <div className="grid gap-2">
              {levelLabels.map((label, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-14">{label}</span>
                  <Select
                    value={mixedConfig.levels[index]}
                    onValueChange={(val) => handleLevelChange(index, val as FormatType)}
                  >
                    <SelectTrigger className="h-7 text-xs flex-1">
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
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-border/50">
              <div className="text-xs text-muted-foreground">
                Preview: {mixedConfig.levels.map((f, i) => {
                  const opt = FORMAT_OPTIONS.find(o => o.id === f);
                  return opt?.example || '?';
                }).join(' → ')}
              </div>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
