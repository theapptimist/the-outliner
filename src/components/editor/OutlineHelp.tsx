import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface OutlineHelpProps {
  className?: string;
}

const shortcuts = [
  { key: 'Enter', action: 'Add new item below' },
  { key: 'Shift + Enter', action: 'Add child item' },
  { key: 'Tab', action: 'Indent (make child)' },
  { key: 'Shift + Tab', action: 'Outdent (move up level)' },
  { key: '↑ / ↓', action: 'Navigate items' },
  { key: 'Delete', action: 'Remove item' },
  { key: 'Click', action: 'Edit item text' },
];

const tips = [
  'Hover on the right edge for style options',
  'Choose numbering: 1. 2. 3. or A. B. C. or I. II. III.',
  'Collapse items by clicking the arrow',
];

export function OutlineHelp({ className }: OutlineHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={className}
          title="Outline help"
        >
          <HelpCircle className="h-3 w-3" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="px-3 py-2 border-b border-border">
          <h4 className="font-medium text-sm">Outline Shortcuts</h4>
        </div>
        
        <div className="p-2">
          <div className="space-y-1">
            {shortcuts.map((s) => (
              <div key={s.key} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{s.action}</span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>
        </div>
        
        <div className="px-3 py-2 border-t border-border bg-muted/30">
          <h5 className="text-xs font-medium text-muted-foreground mb-1">Tips</h5>
          <ul className="space-y-0.5">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                <span className="text-primary">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </PopoverContent>
    </Popover>
  );
}
