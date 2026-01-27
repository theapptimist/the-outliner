import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Plus, 
  Trash2, 
  Pencil, 
  ChevronUp, 
  ChevronDown,
  Underline,
  Italic,
  Copy,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { 
  CustomStyle, 
  getCustomStyles, 
  addCustomStyle, 
  updateCustomStyle, 
  deleteCustomStyle,
  createDefaultCustomConfig,
  PRESET_STYLES,
} from '@/lib/customStyles';
import { 
  MixedStyleConfig, 
  LevelStyle, 
  FormatType, 
  FORMAT_OPTIONS 
} from '@/lib/outlineStyles';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface StyleManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectStyle: (config: MixedStyleConfig) => void;
  currentConfig: MixedStyleConfig;
}

interface ExtendedLevelStyle extends LevelStyle {
  italic?: boolean;
}

interface ExtendedMixedStyleConfig {
  levels: [ExtendedLevelStyle, ExtendedLevelStyle, ExtendedLevelStyle, ExtendedLevelStyle, ExtendedLevelStyle, ExtendedLevelStyle];
}

export function StyleManager({ 
  open, 
  onOpenChange, 
  onSelectStyle,
  currentConfig,
}: StyleManagerProps) {
  const [customStyles, setCustomStyles] = useState<CustomStyle[]>([]);
  const [editingStyle, setEditingStyle] = useState<CustomStyle | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [styleName, setStyleName] = useState('');
  const [styleDescription, setStyleDescription] = useState('');
  const [editConfig, setEditConfig] = useState<ExtendedMixedStyleConfig>(createDefaultCustomConfig() as ExtendedMixedStyleConfig);

  useEffect(() => {
    if (open) {
      setCustomStyles(getCustomStyles());
    }
  }, [open]);

  const handleCreate = () => {
    setIsCreating(true);
    setEditingStyle(null);
    setStyleName('');
    setStyleDescription('');
    setEditConfig(createDefaultCustomConfig() as ExtendedMixedStyleConfig);
  };

  const handleEdit = (style: CustomStyle) => {
    setEditingStyle(style);
    setIsCreating(false);
    setStyleName(style.name);
    setStyleDescription(style.description);
    setEditConfig(style.config as ExtendedMixedStyleConfig);
  };

  const handleDuplicate = (style: CustomStyle) => {
    const newStyle = addCustomStyle({
      name: `${style.name} (Copy)`,
      description: style.description,
      config: { ...style.config },
    });
    setCustomStyles(getCustomStyles());
  };

  const handleDelete = (id: string) => {
    deleteCustomStyle(id);
    setCustomStyles(getCustomStyles());
    if (editingStyle?.id === id) {
      setEditingStyle(null);
      setIsCreating(false);
    }
  };

  const handleSave = () => {
    if (!styleName.trim()) return;

    if (editingStyle) {
      updateCustomStyle(editingStyle.id, {
        name: styleName,
        description: styleDescription,
        config: editConfig as MixedStyleConfig,
      });
    } else {
      addCustomStyle({
        name: styleName,
        description: styleDescription,
        config: editConfig as MixedStyleConfig,
      });
    }
    
    setCustomStyles(getCustomStyles());
    setEditingStyle(null);
    setIsCreating(false);
  };

  const handleLevelChange = (levelIndex: number, format: FormatType) => {
    const newLevels = [...editConfig.levels] as ExtendedMixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], format };
    setEditConfig({ levels: newLevels });
  };

  const handleUnderlineChange = (levelIndex: number, underline: boolean) => {
    const newLevels = [...editConfig.levels] as ExtendedMixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], underline };
    setEditConfig({ levels: newLevels });
  };

  const handleItalicChange = (levelIndex: number, italic: boolean) => {
    const newLevels = [...editConfig.levels] as ExtendedMixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], italic };
    setEditConfig({ levels: newLevels });
  };

  const handleSuffixChange = (levelIndex: number, suffix: string) => {
    const newLevels = [...editConfig.levels] as ExtendedMixedStyleConfig['levels'];
    newLevels[levelIndex] = { ...newLevels[levelIndex], suffix };
    setEditConfig({ levels: newLevels });
  };

  const moveLevel = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= editConfig.levels.length) return;
    
    const newLevels = [...editConfig.levels] as ExtendedMixedStyleConfig['levels'];
    [newLevels[index], newLevels[targetIndex]] = [newLevels[targetIndex], newLevels[index]];
    setEditConfig({ levels: newLevels });
  };

  const handleApplyStyle = (config: MixedStyleConfig) => {
    onSelectStyle(config);
    onOpenChange(false);
  };

  const isEditorOpen = isCreating || editingStyle !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {isEditorOpen 
              ? (editingStyle ? 'Edit Style' : 'Create New Style')
              : 'Manage Styles'
            }
          </DialogTitle>
        </DialogHeader>

        {!isEditorOpen ? (
          <div className="space-y-4">
            {/* Create new button */}
            <Button onClick={handleCreate} className="w-full gap-2">
              <Plus size={16} />
              Create New Style
            </Button>

            <ScrollArea className="h-[400px] pr-4">
              {/* Preset styles */}
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted-foreground px-1">Presets</h3>
                {PRESET_STYLES.map((preset, index) => (
                  <div
                    key={`preset-${index}`}
                    className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-sm flex items-center gap-2">
                        {preset.name}
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-normal">
                          Default
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground">{preset.description}</div>
                      <div className="text-xs font-mono mt-1 text-muted-foreground">
                        {preset.config.levels.slice(0, 3).map((level, i) => {
                          const opt = FORMAT_OPTIONS.find(f => f.id === level.format);
                          let preview = opt?.example || '?';
                          if (level.underline) preview = `${preview}`;
                          return preview;
                        }).join(' → ')}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleApplyStyle(preset.config)}
                    >
                      Apply
                    </Button>
                  </div>
                ))}
              </div>

              {customStyles.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-muted-foreground px-1">Custom Styles</h3>
                    {customStyles.map((style) => (
                      <div
                        key={style.id}
                        className="flex items-center gap-2 p-3 rounded-lg border border-border hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex-1">
                          <div className="font-medium text-sm">{style.name}</div>
                          <div className="text-xs text-muted-foreground">{style.description}</div>
                          <div className="text-xs font-mono mt-1 text-muted-foreground">
                            {style.config.levels.slice(0, 3).map((level, i) => {
                              const opt = FORMAT_OPTIONS.find(f => f.id === level.format);
                              let preview = opt?.example || '?';
                              if (level.underline) preview = `${preview}`;
                              return preview;
                            }).join(' → ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEdit(style)}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => handleDuplicate(style)}
                          >
                            <Copy size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 hover:text-destructive"
                            onClick={() => handleDelete(style.id)}
                          >
                            <Trash2 size={14} />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApplyStyle(style.config)}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </ScrollArea>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Back button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={() => {
                setEditingStyle(null);
                setIsCreating(false);
              }}
            >
              ← Back to Styles
            </Button>

            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-4">
                {/* Style name and description */}
                <div className="grid gap-3">
                  <div>
                    <label className="text-sm font-medium">Style Name</label>
                    <Input
                      value={styleName}
                      onChange={(e) => setStyleName(e.target.value)}
                      placeholder="My Custom Style"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium">Description</label>
                    <Input
                      value={styleDescription}
                      onChange={(e) => setStyleDescription(e.target.value)}
                      placeholder="Optional description"
                      className="mt-1"
                    />
                  </div>
                </div>

                <Separator />

                {/* Level configuration */}
                <div>
                  <label className="text-sm font-medium">Level Formatting</label>
                  <div className="mt-2 space-y-2">
                    {editConfig.levels.map((level, index) => (
                      <div key={index} className="flex items-center gap-2 p-2 rounded bg-secondary/30">
                        {/* Reorder buttons */}
                        <div className="flex flex-col">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-5 p-0"
                            onClick={() => moveLevel(index, 'up')}
                            disabled={index === 0}
                          >
                            <ChevronUp className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-4 w-5 p-0"
                            onClick={() => moveLevel(index, 'down')}
                            disabled={index === editConfig.levels.length - 1}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </Button>
                        </div>
                        
                        <span className="text-xs text-muted-foreground w-12">Level {index + 1}</span>
                        
                        <Select
                          value={level.format}
                          onValueChange={(val) => handleLevelChange(index, val as FormatType)}
                        >
                          <SelectTrigger className="h-8 text-xs w-24">
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

                        {/* Auto-underline */}
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`underline-${index}`}
                            checked={level.underline || false}
                            onCheckedChange={(checked) => handleUnderlineChange(index, !!checked)}
                            className="h-4 w-4"
                          />
                          <label htmlFor={`underline-${index}`} className="cursor-pointer" title="Auto-underline">
                            <Underline className="h-3.5 w-3.5 text-muted-foreground" />
                          </label>
                        </div>

                        {/* Auto-italic */}
                        <div className="flex items-center gap-1">
                          <Checkbox
                            id={`italic-${index}`}
                            checked={level.italic || false}
                            onCheckedChange={(checked) => handleItalicChange(index, !!checked)}
                            className="h-4 w-4"
                          />
                          <label htmlFor={`italic-${index}`} className="cursor-pointer" title="Auto-italic">
                            <Italic className="h-3.5 w-3.5 text-muted-foreground" />
                          </label>
                        </div>

                        {/* Suffix */}
                        <Input
                          value={level.suffix || ''}
                          onChange={(e) => handleSuffixChange(index, e.target.value)}
                          placeholder=""
                          className="h-8 w-10 text-xs text-center px-1"
                          maxLength={2}
                          title="Suffix character (e.g., : or .)"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div className="p-3 rounded-lg bg-secondary/50">
                  <div className="text-xs font-medium text-muted-foreground mb-2">Preview</div>
                  <div className="text-sm font-mono">
                    {editConfig.levels.map((level, i) => {
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
                          {i < editConfig.levels.length - 1 && ' → '}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </ScrollArea>

            {/* Save button */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingStyle(null);
                  setIsCreating(false);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!styleName.trim()}>
                {editingStyle ? 'Save Changes' : 'Create Style'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
