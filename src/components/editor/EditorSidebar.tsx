import { useState } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Code2, 
  ArrowDownRight, 
  Layers,
  Undo2,
  Redo2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { OutlineStylePicker } from './OutlineStylePicker';
import { OutlineHelp } from './OutlineHelp';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';

interface EditorSidebarProps {
  outlineStyle: OutlineStyle;
  onOutlineStyleChange: (style: OutlineStyle) => void;
  mixedConfig: MixedStyleConfig;
  onMixedConfigChange: (config: MixedStyleConfig) => void;
  autoDescend: boolean;
  onAutoDescendChange: (value: boolean) => void;
  showRevealCodes: boolean;
  onShowRevealCodesChange: (value: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function EditorSidebar({
  outlineStyle,
  onOutlineStyleChange,
  mixedConfig,
  onMixedConfigChange,
  autoDescend,
  onAutoDescendChange,
  showRevealCodes,
  onShowRevealCodesChange,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: EditorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div 
      className={cn(
        "flex flex-col border-r border-border bg-card/50 transition-all duration-200",
        collapsed ? "w-12" : "w-56"
      )}
    >
      {/* Header with collapse toggle */}
      <div className="flex items-center justify-between p-2 border-b border-border/50">
        {!collapsed && (
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Tools
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 w-7 p-0", collapsed && "mx-auto")}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Tools section */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {/* Undo/Redo */}
        <div className={cn("flex gap-1", collapsed ? "flex-col items-center" : "")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onUndo}
                disabled={!canUndo}
              >
                <Undo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Undo (Ctrl+Z)</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={onRedo}
                disabled={!canRedo}
              >
                <Redo2 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Redo (Ctrl+Shift+Z)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator className="my-2" />

        {/* Outline Style */}
        {collapsed ? (
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <Layers className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Outline Style</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="space-y-1">
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
              Style
            </span>
            <OutlineStylePicker
              value={outlineStyle}
              onChange={onOutlineStyleChange}
              mixedConfig={mixedConfig}
              onMixedConfigChange={onMixedConfigChange}
            />
          </div>
        )}

        <Separator className="my-2" />

        {/* Toggle buttons */}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          {!collapsed && (
            <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
              Options
            </span>
          )}
          
          {/* Auto-Descend */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoDescend ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  autoDescend && "bg-primary/10 text-primary hover:bg-primary/20"
                )}
                onClick={() => onAutoDescendChange(!autoDescend)}
              >
                <ArrowDownRight className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-xs">Auto-Descend</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Enter creates child (1 → a → i)</p>
            </TooltipContent>
          </Tooltip>

          {/* Reveal Codes */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showRevealCodes ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  showRevealCodes && "bg-secondary text-secondary-foreground"
                )}
                onClick={() => onShowRevealCodesChange(!showRevealCodes)}
              >
                <Code2 className="h-4 w-4" />
                {!collapsed && <span className="ml-2 text-xs">Reveal Codes</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>WordPerfect-style codes (Alt+F3)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator className="my-2" />

        {/* Help */}
        <div className={cn(collapsed && "flex justify-center")}>
          {collapsed ? (
            <OutlineHelp className="h-8 w-8 p-0" />
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider px-1">
                Help
              </span>
              <div className="flex items-center gap-1">
                <OutlineHelp className="h-8 w-8 p-0" />
                <span className="text-xs text-muted-foreground">Shortcuts</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="p-2 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground text-center">
            Press ? for shortcuts
          </p>
        </div>
      )}
    </div>
  );
}
