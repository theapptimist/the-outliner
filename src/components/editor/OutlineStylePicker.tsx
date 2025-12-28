import { OutlineStyle, OUTLINE_STYLES } from '@/lib/outlineStyles';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OutlineStylePickerProps {
  value: OutlineStyle;
  onChange: (style: OutlineStyle) => void;
}

export function OutlineStylePicker({ value, onChange }: OutlineStylePickerProps) {
  const currentStyle = OUTLINE_STYLES.find(s => s.id === value);
  const displayText = currentStyle?.example.join('.') || '1.a.i';
  
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 gap-0.5 text-xs font-mono"
          title="Outline numbering style"
        >
          <span>{displayText}</span>
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start">
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
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
