import { useState, useEffect } from 'react';
import { MixedStyleConfig, FORMAT_OPTIONS, FormatType, STANDARD_MIXED_CONFIG, DEFAULT_MIXED_CONFIG } from '@/lib/outlineStyles';
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
import { ChevronDown, ChevronUp, Underline, Italic, Settings, Star, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { StyleManager } from './StyleManager';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  PRESET_STYLES, 
  getCustomStyles, 
  CustomStyle,
  getDefaultStyleId,
  setDefaultStyleId,
} from '@/lib/customStyles';

interface OutlineStylePickerProps {
  value: string; // Now used for tracking, but we use config directly
  onChange: (style: string) => void;
  mixedConfig?: MixedStyleConfig;
  onMixedConfigChange?: (config: MixedStyleConfig) => void;
}

export function OutlineStylePicker({ 
  value, 
  onChange, 
  mixedConfig = STANDARD_MIXED_CONFIG,
  onMixedConfigChange 
}: OutlineStylePickerProps) {
  const [showStyleManager, setShowStyleManager] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [defaultStyleId, setDefaultStyleIdState] = useState<string | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  
  useEffect(() => {
    if (popoverOpen) {
      setCustomStyles(getCustomStyles());
      setDefaultStyleIdState(getDefaultStyleId());
    }
  }, [popoverOpen]);
  
  // Build display text from current config
  const getDisplayText = () => {
    if (mixedConfig) {
      return mixedConfig.levels.slice(0, 3).map(level => {
        const opt = FORMAT_OPTIONS.find(f => f.id === level.format);
        return opt?.example || '?';
      }).join(' ');
    }
    return '1. a. i.';
  };

  const handleApplyStyle = (config: MixedStyleConfig) => {
    if (!onMixedConfigChange) return;
    onChange('mixed');
    onMixedConfigChange(config);
    setPopoverOpen(false);
  };

  const handleSetDefault = (id: string) => {
    setDefaultStyleId(id);
    setDefaultStyleIdState(id);
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

  const moveLevel = (index: number, direction: 'up' | 'down') => {
    if (!onMixedConfigChange) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= mixedConfig.levels.length) return;
    
    const newLevels = [...mixedConfig.levels] as MixedStyleConfig['levels'];
    [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];
    onMixedConfigChange({ levels: newLevels });
  };

  const renderStyleItem = (
    id: string,
    name: string,
    description: string,
    config: MixedStyleConfig,
    isPreset: boolean
  ) => {
    const isDefault = defaultStyleId === id;
    
    return (
      <div
        key={id}
        className="flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
      >
        <button
          className="flex-1 text-left"
          onClick={() => handleApplyStyle(config)}
        >
          <div className="font-medium text-sm flex items-center gap-2">
            {name}
            {isPreset && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-normal">
                Preset
              </span>
            )}
            {isDefault && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-600 dark:text-amber-400 font-normal flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 fill-current" />
                Default
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{description}</div>
          <div className="text-xs font-mono mt-1 text-muted-foreground">
            {config.levels.slice(0, 3).map((level, i) => {
              const opt = FORMAT_OPTIONS.find(f => f.id === level.format);
              return opt?.example || '?';
            }).join(' → ')}
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0",
            isDefault && "text-amber-500"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleSetDefault(id);
          }}
          title={isDefault ? "Current default" : "Set as default"}
        >
          <Star className={cn("h-3.5 w-3.5", isDefault && "fill-current")} />
        </Button>
      </div>
    );
  };
  
  return (
    <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
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
            <ScrollArea className="h-[320px]">
              {/* Presets */}
              <div className="space-y-1.5 mb-3">
                <div className="text-xs font-medium text-muted-foreground px-1">Presets</div>
                {PRESET_STYLES.map((preset) => 
                  renderStyleItem(preset.id, preset.name, preset.description, preset.config, true)
                )}
              </div>
              
              {/* Custom Styles */}
              {customStyles.length > 0 && (
                <div className="space-y-1.5 mb-3">
                  <Separator className="my-2" />
                  <div className="text-xs font-medium text-muted-foreground px-1">Custom Styles</div>
                  {customStyles.map((style) => 
                    renderStyleItem(style.id, style.name, style.description, style.config, false)
                  )}
                </div>
              )}
            </ScrollArea>
            
            <Separator className="my-2" />
            
            {/* Bottom actions */}
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                onClick={() => setShowStyleManager(true)}
              >
                <Settings className="h-3.5 w-3.5" />
                Manage Styles
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8 text-xs gap-1"
                onClick={() => setShowCustomize(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
                Customize Current
              </Button>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-medium text-muted-foreground">
                Customize Current Style
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
            
            <ScrollArea className="h-[280px]">
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
            </ScrollArea>
          </>
        )}
      </PopoverContent>
      
      {/* Style Manager Dialog */}
      <StyleManager
        open={showStyleManager}
        onOpenChange={(open) => {
          setShowStyleManager(open);
          if (!open) {
            // Refresh custom styles when closing manager
            setCustomStyles(getCustomStyles());
            setDefaultStyleIdState(getDefaultStyleId());
          }
        }}
        onSelectStyle={handleApplyStyle}
        currentConfig={mixedConfig}
      />
    </Popover>
  );
}
