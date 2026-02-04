import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { UserSettings } from '@/hooks/useUserSettings';
import { Save, ChevronDown, Highlighter, Slash } from 'lucide-react';

interface EditorSectionProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
}

export function EditorSection({ settings, onUpdateSettings }: EditorSectionProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Editor Preferences</CardTitle>
          <CardDescription>Configure how the editor behaves</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
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
