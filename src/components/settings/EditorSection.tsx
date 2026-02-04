import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { UserSettings } from '@/hooks/useUserSettings';
import { useCloudStylePreferences } from '@/hooks/useCloudStylePreferences';
import { OUTLINE_STYLES, OutlineStyle } from '@/lib/outlineStyles';
import { Save, ChevronDown, Highlighter, Slash, ListOrdered } from 'lucide-react';

interface EditorSectionProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
}

export function EditorSection({ settings, onUpdateSettings }: EditorSectionProps) {
  const { defaultStyleId, setDefaultStyle, customStyles, isLoading: stylesLoading } = useCloudStylePreferences();

  // Combine preset styles with custom styles for the selector
  const allStyles = [
    ...OUTLINE_STYLES.map(s => ({ id: s.id, name: s.name, isCustom: false })),
    ...customStyles.map(s => ({ id: s.id, name: s.name, isCustom: true })),
  ];

  const handleStyleChange = (value: string) => {
    setDefaultStyle(value === 'none' ? null : value);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editor Preferences</CardTitle>
          <CardDescription>Configure how the editor behaves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Default outline style */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ListOrdered className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="default-style" className="text-sm font-medium">
                  Default outline style
                </Label>
                <p className="text-xs text-muted-foreground">
                  Style applied to new documents
                </p>
              </div>
            </div>
            <Select
              value={defaultStyleId || 'none'}
              onValueChange={handleStyleChange}
              disabled={stylesLoading}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Select style" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {allStyles.map(style => (
                  <SelectItem key={style.id} value={style.id}>
                    {style.name}{style.isCustom ? ' ✦' : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Auto-save */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Save className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="auto-save" className="text-sm font-medium">
                  Auto-save
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically save changes as you type
                </p>
              </div>
            </div>
            <Switch
              id="auto-save"
              checked={settings.autoSave}
              onCheckedChange={(checked) => onUpdateSettings({ autoSave: checked })}
            />
          </div>

          {/* Auto-descend */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="auto-descend" className="text-sm font-medium">
                  Auto-descend
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically navigate into child items when pressing Enter
                </p>
              </div>
            </div>
            <Switch
              id="auto-descend"
              checked={settings.autoDescend}
              onCheckedChange={(checked) => onUpdateSettings({ autoDescend: checked })}
            />
          </div>

          {/* Row highlight */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Highlighter className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="row-highlight" className="text-sm font-medium">
                  Row highlight
                </Label>
                <p className="text-xs text-muted-foreground">
                  Highlight the currently focused row
                </p>
              </div>
            </div>
            <Switch
              id="row-highlight"
              checked={settings.showRowHighlight}
              onCheckedChange={(checked) => onUpdateSettings({ showRowHighlight: checked })}
            />
          </div>

          {/* Slash placeholder */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Slash className="h-4 w-4 text-muted-foreground" />
              <div>
                <Label htmlFor="slash-placeholder" className="text-sm font-medium">
                  Slash command hint
                </Label>
                <p className="text-xs text-muted-foreground">
                  Show "Type / for commands" placeholder in empty rows
                </p>
              </div>
            </div>
            <Switch
              id="slash-placeholder"
              checked={settings.showSlashPlaceholder}
              onCheckedChange={(checked) => onUpdateSettings({ showSlashPlaceholder: checked })}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
