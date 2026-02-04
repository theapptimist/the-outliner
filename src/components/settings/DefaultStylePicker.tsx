import { useCloudStylePreferences } from '@/hooks/useCloudStylePreferences';
import { PRESET_STYLES, CustomStyle } from '@/lib/customStyles';
import { FORMAT_OPTIONS, MixedStyleConfig } from '@/lib/outlineStyles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DefaultStylePickerProps {
  className?: string;
}

export function DefaultStylePicker({ className }: DefaultStylePickerProps) {
  const { defaultStyleId, setDefaultStyle, customStyles, isLoading } = useCloudStylePreferences();

  const handleSetDefault = (id: string | null) => {
    setDefaultStyle(id === defaultStyleId ? null : id);
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
        className={cn(
          "flex items-center gap-2 p-3 rounded-lg border transition-colors",
          isDefault 
            ? "border-primary/50 bg-primary/5" 
            : "border-border hover:bg-secondary/50"
        )}
      >
        <div className="flex-1">
          <div className="font-medium text-sm flex items-center gap-2">
            {name}
            <span className={cn(
              "text-[10px] px-1.5 py-0.5 rounded font-normal",
              isPreset 
                ? "bg-primary/10 text-primary" 
                : "bg-secondary text-muted-foreground"
            )}>
              {isPreset ? 'Preset' : 'Custom'}
            </span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
          <div className="text-xs font-mono mt-1 text-muted-foreground">
            {getPreviewText(config)}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 w-8 p-0",
            isDefault && "text-primary"
          )}
          onClick={() => handleSetDefault(id)}
          title={isDefault ? "Clear default" : "Set as default"}
        >
          <Star className={cn("h-4 w-4", isDefault && "fill-current")} />
        </Button>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn("space-y-2", className)}>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg border border-border animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      <ScrollArea className="h-[400px] pr-3">
        {/* Presets */}
        <div className="space-y-2 mb-4">
          <div className="text-xs font-medium text-muted-foreground px-1 sticky top-0 bg-background py-1">
            Presets
          </div>
          {PRESET_STYLES.map((preset) =>
            renderStyleItem(preset.id, preset.name, preset.description, preset.config, true)
          )}
        </div>

        {/* Custom Styles */}
        {customStyles.length > 0 && (
          <div className="space-y-2">
            <Separator className="my-3" />
            <div className="text-xs font-medium text-muted-foreground px-1 sticky top-0 bg-background py-1">
              Custom Styles
            </div>
            {customStyles.map((style) =>
              renderStyleItem(style.id, style.name, style.description, style.config, false)
            )}
          </div>
        )}
      </ScrollArea>

      {/* Current selection indicator */}
      <div className="mt-3 pt-3 border-t border-border">
        <div className="text-xs text-muted-foreground">
          {defaultStyleId ? (
            <>
              <Star className="h-3 w-3 inline mr-1 text-primary fill-primary" />
              Default: {
                PRESET_STYLES.find(p => p.id === defaultStyleId)?.name ||
                customStyles.find(s => s.id === defaultStyleId)?.name ||
                'Unknown'
              }
            </>
          ) : (
            'No default style set'
          )}
        </div>
      </div>
    </div>
  );
}
