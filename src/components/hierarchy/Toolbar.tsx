import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Plus, 
  Trash2, 
  ChevronLeft, 
  ChevronRight,
  ChevronsUpDown,
  Maximize2,
  Minimize2,
  FolderPlus,
  ArrowDownRight,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { OutlineStylePicker } from '@/components/editor/OutlineStylePicker';
import { OutlineStyle } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';

interface ToolbarProps {
  hasSelection: boolean;
  outlineStyle: OutlineStyle;
  onOutlineStyleChange: (style: OutlineStyle) => void;
  onAddNode: () => void;
  onAddChildNode: () => void;
  onDeleteNode: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
  autoDescend: boolean;
  onToggleAutoDescend: () => void;
}

interface ToolbarButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'destructive';
}

function ToolbarButton({ 
  icon, 
  label, 
  shortcut, 
  onClick, 
  disabled,
  variant = 'default'
}: ToolbarButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={`h-8 w-8 p-0 ${variant === 'destructive' ? 'hover:text-destructive' : ''}`}
        >
          {icon}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="flex items-center gap-2">
        <span>{label}</span>
        {shortcut && (
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-muted rounded">
            {shortcut}
          </kbd>
        )}
      </TooltipContent>
    </Tooltip>
  );
}

export function Toolbar({
  hasSelection,
  outlineStyle,
  onOutlineStyleChange,
  onAddNode,
  onAddChildNode,
  onDeleteNode,
  onIndent,
  onOutdent,
  onCollapseAll,
  onExpandAll,
  autoDescend,
  onToggleAutoDescend,
}: ToolbarProps) {
  return (
    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-card/50">
      <ToolbarButton
        icon={<Plus size={16} />}
        label="Add node"
        shortcut="Enter"
        onClick={onAddNode}
      />
      <ToolbarButton
        icon={<FolderPlus size={16} />}
        label="Add child node"
        shortcut="⇧Enter"
        onClick={onAddChildNode}
        disabled={!hasSelection}
      />
      
      <Separator orientation="vertical" className="h-5 mx-1" />
      
      <ToolbarButton
        icon={<ChevronRight size={16} />}
        label="Indent"
        shortcut="Tab"
        onClick={onIndent}
        disabled={!hasSelection}
      />
      <ToolbarButton
        icon={<ChevronLeft size={16} />}
        label="Outdent"
        shortcut="⇧Tab"
        onClick={onOutdent}
        disabled={!hasSelection}
      />
      
      <Separator orientation="vertical" className="h-5 mx-1" />
      
      <ToolbarButton
        icon={<Minimize2 size={16} />}
        label="Collapse all"
        onClick={onCollapseAll}
      />
      <ToolbarButton
        icon={<Maximize2 size={16} />}
        label="Expand all"
        onClick={onExpandAll}
      />
      
      <Separator orientation="vertical" className="h-5 mx-1" />
      
      <OutlineStylePicker value={outlineStyle} onChange={onOutlineStyleChange} />
      
      <Separator orientation="vertical" className="h-5 mx-1" />
      
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant={autoDescend ? "secondary" : "ghost"}
            size="sm"
            onClick={onToggleAutoDescend}
            className={cn(
              "h-8 px-2 gap-1.5",
              autoDescend && "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            <ArrowDownRight size={16} />
            <span className="text-xs">Auto</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <div className="text-center">
            <div>Auto-Descend Mode</div>
            <div className="text-muted-foreground text-xs">Enter creates child nodes (1 → a → i)</div>
          </div>
        </TooltipContent>
      </Tooltip>
      
      <div className="flex-1" />
      
      <ToolbarButton
        icon={<Trash2 size={16} />}
        label="Delete node"
        shortcut="Del"
        onClick={onDeleteNode}
        disabled={!hasSelection}
        variant="destructive"
      />
    </div>
  );
}
