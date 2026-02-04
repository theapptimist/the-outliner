import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { UserSettings } from '@/hooks/useUserSettings';
import { Sun, Moon, Monitor, Type, Maximize2 } from 'lucide-react';

interface AppearanceSectionProps {
  settings: UserSettings;
  onUpdateSettings: (updates: Partial<UserSettings>) => void;
}

export function AppearanceSection({ settings, onUpdateSettings }: AppearanceSectionProps) {
  return (
    <div className="space-y-6">
      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sun className="h-4 w-4" />
            Theme
          </CardTitle>
          <CardDescription>Choose your preferred color scheme</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.theme}
            onValueChange={(value) => onUpdateSettings({ theme: value as UserSettings['theme'] })}
            className="grid grid-cols-3 gap-4"
          >
            <Label
              htmlFor="theme-light"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="light" id="theme-light" className="sr-only" />
              <Sun className="h-6 w-6 mb-2" />
              <span className="text-sm">Light</span>
            </Label>
            <Label
              htmlFor="theme-dark"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="dark" id="theme-dark" className="sr-only" />
              <Moon className="h-6 w-6 mb-2" />
              <span className="text-sm">Dark</span>
            </Label>
            <Label
              htmlFor="theme-system"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="system" id="theme-system" className="sr-only" />
              <Monitor className="h-6 w-6 mb-2" />
              <span className="text-sm">System</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Font Size */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Type className="h-4 w-4" />
            Font Size
          </CardTitle>
          <CardDescription>Adjust the base font size of the application</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.fontSize}
            onValueChange={(value) =>
              onUpdateSettings({ fontSize: value as UserSettings['fontSize'] })
            }
            className="grid grid-cols-3 gap-4"
          >
            <Label
              htmlFor="font-small"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="small" id="font-small" className="sr-only" />
              <span className="text-xs mb-2">Aa</span>
              <span className="text-sm">Small</span>
            </Label>
            <Label
              htmlFor="font-medium"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="medium" id="font-medium" className="sr-only" />
              <span className="text-sm mb-2">Aa</span>
              <span className="text-sm">Medium</span>
            </Label>
            <Label
              htmlFor="font-large"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="large" id="font-large" className="sr-only" />
              <span className="text-base mb-2">Aa</span>
              <span className="text-sm">Large</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Page Width */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Maximize2 className="h-4 w-4" />
            Page Width
          </CardTitle>
          <CardDescription>Control the maximum width of the editor content area</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={settings.pageWidth}
            onValueChange={(value) =>
              onUpdateSettings({ pageWidth: value as UserSettings['pageWidth'] })
            }
            className="grid grid-cols-4 gap-3"
          >
            <Label
              htmlFor="width-narrow"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="narrow" id="width-narrow" className="sr-only" />
              <div className="w-4 h-6 border-2 border-current rounded mb-2" />
              <span className="text-xs">Narrow</span>
            </Label>
            <Label
              htmlFor="width-normal"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="normal" id="width-normal" className="sr-only" />
              <div className="w-6 h-6 border-2 border-current rounded mb-2" />
              <span className="text-xs">Normal</span>
            </Label>
            <Label
              htmlFor="width-wide"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="wide" id="width-wide" className="sr-only" />
              <div className="w-8 h-6 border-2 border-current rounded mb-2" />
              <span className="text-xs">Wide</span>
            </Label>
            <Label
              htmlFor="width-full"
              className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-3 hover:bg-accent hover:text-accent-foreground cursor-pointer [&:has([data-state=checked])]:border-primary"
            >
              <RadioGroupItem value="full" id="width-full" className="sr-only" />
              <div className="w-10 h-6 border-2 border-current rounded mb-2" />
              <span className="text-xs">Full</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>
    </div>
  );
}
