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
import { ChevronDown, Star, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ManageStylesDialog } from './ManageStylesDialog';
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
  const [showManageStyles, setShowManageStyles] = useState(false);
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

  const getPreviewText = (config: MixedStyleConfig) => {
    return config.levels.slice(0, 3).map((level) => {
      const opt = FORMAT_OPTIONS.find(f => f.id === level.format);
      return opt?.example || '?';
    }).join(' → ');
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
            {getPreviewText(config)}
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 w-6 p-0",
            isDefault && "text-amber-500"
          )}
          onClick={(e) => {
            e.stopPropagation();
            handleSetDefault(id);
          }}
          title={isDefault ? "Current default" : "Set as default"}
        >
          <Star className={cn("h-3 w-3", isDefault && "fill-current")} />
        </Button>
      </div>
    );
  };
  
  return (
    <>
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
          <ScrollArea className="h-[460px]">
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
              onClick={() => {
                setShowManageStyles(true);
                setPopoverOpen(false);
              }}
            >
              <Pencil className="h-3.5 w-3.5" />
              Manage Styles
            </Button>
          </div>
        </PopoverContent>
      </Popover>
      
      {/* Manage Styles Dialog */}
      <ManageStylesDialog
        open={showManageStyles}
        onOpenChange={(open) => {
          setShowManageStyles(open);
          if (!open) {
            // Refresh custom styles when closing manager
            setCustomStyles(getCustomStyles());
            setDefaultStyleIdState(getDefaultStyleId());
          }
        }}
        onSelectStyle={handleApplyStyle}
      />
    </>
  );
}
