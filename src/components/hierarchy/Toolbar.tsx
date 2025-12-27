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
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface ToolbarProps {
  hasSelection: boolean;
  onAddNode: () => void;
  onAddChildNode: () => void;
  onDeleteNode: () => void;
  onIndent: () => void;
  onOutdent: () => void;
  onCollapseAll: () => void;
  onExpandAll: () => void;
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
  onAddNode,
  onAddChildNode,
  onDeleteNode,
  onIndent,
  onOutdent,
  onCollapseAll,
  onExpandAll,
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
