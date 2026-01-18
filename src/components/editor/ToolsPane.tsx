import { Editor } from '@tiptap/react';
import { 
  Code2, 
  ArrowDownRight, 
  Layers, 
  Undo2, 
  Redo2, 
  Sun, 
  Moon, 
  GitBranch, 
  Search,
  Rows3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { OutlineStylePicker } from './OutlineStylePicker';
import { OutlineHelp } from './OutlineHelp';
import { FormattingToolbar } from './FormattingToolbar';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { cn } from '@/lib/utils';

interface ToolsPaneProps {
  collapsed: boolean;
  editor: Editor | null;
  outlineStyle: OutlineStyle;
  onOutlineStyleChange: (style: OutlineStyle) => void;
  mixedConfig: MixedStyleConfig;
  onMixedConfigChange: (config: MixedStyleConfig) => void;
  autoDescend: boolean;
  onAutoDescendChange: (value: boolean) => void;
  showRevealCodes: boolean;
  onShowRevealCodesChange: (value: boolean) => void;
  showRowHighlight: boolean;
  onShowRowHighlightChange: (value: boolean) => void;
  isDark: boolean;
  onToggleTheme: () => void;
  onInsertHierarchy: () => void;
  onFindReplace: (withReplace: boolean) => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function ToolsPane({
  collapsed,
  editor,
  outlineStyle,
  onOutlineStyleChange,
  mixedConfig,
  onMixedConfigChange,
  autoDescend,
  onAutoDescendChange,
  showRevealCodes,
  onShowRevealCodesChange,
  showRowHighlight,
  onShowRowHighlightChange,
  isDark,
  onToggleTheme,
  onInsertHierarchy,
  onFindReplace,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: ToolsPaneProps) {
  return (
    <>
      {/* Tools section */}
      <div className="relative flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
        {/* Outline - NOW AT TOP */}
        {!collapsed && (
          <span className="text-[10px] font-medium text-warning uppercase tracking-wider px-1">
            Outline
          </span>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                data-allow-pointer
                variant="ghost"
                size="sm"
                onClick={onInsertHierarchy}
                disabled={!editor}
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  "hover:bg-warning/15 hover:text-warning transition-colors"
                )}
              >
                <GitBranch className="h-4 w-4 text-warning" />
                {!collapsed && <span className="ml-2 text-xs">Insert Outline</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Insert hierarchical outline block</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Outline Style */}
        {collapsed ? (
          <div className="flex justify-center">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-accent/15 hover:text-accent transition-colors">
                  <Layers className="h-4 w-4 text-accent" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Outline Style</p>
              </TooltipContent>
            </Tooltip>
          </div>
        ) : (
          <div className="space-y-1 mt-2">
            <span className="text-[10px] font-medium text-accent uppercase tracking-wider px-1">
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

        {/* Options */}
        {!collapsed && (
          <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider px-1 mt-2 block">
            Options
          </span>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          {/* Auto-Descend */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={autoDescend ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  "hover:bg-success/15 transition-colors",
                  autoDescend && "bg-success/15 text-success hover:bg-success/25 border border-success/30"
                )}
                onClick={() => onAutoDescendChange(!autoDescend)}
              >
                <ArrowDownRight className={cn("h-4 w-4", autoDescend && "text-success")} />
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
                  "hover:bg-accent/15 transition-colors",
                  showRevealCodes && "bg-accent/15 text-accent hover:bg-accent/25 border border-accent/30"
                )}
                onClick={() => onShowRevealCodesChange(!showRevealCodes)}
              >
                <Code2 className={cn("h-4 w-4", showRevealCodes && "text-accent")} />
                {!collapsed && <span className="ml-2 text-xs">Reveal Codes</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>WordPerfect-style codes (Alt+F3)</p>
            </TooltipContent>
          </Tooltip>

          {/* Row Highlight */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showRowHighlight ? "secondary" : "ghost"}
                size="sm"
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  "hover:bg-primary/15 transition-colors",
                  showRowHighlight && "bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30"
                )}
                onClick={() => onShowRowHighlightChange(!showRowHighlight)}
              >
                <Rows3 className={cn("h-4 w-4", showRowHighlight && "text-primary")} />
                {!collapsed && <span className="ml-2 text-xs">Row Highlight</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Highlight selected row in outline</p>
            </TooltipContent>
          </Tooltip>

          {/* Theme Toggle */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  "hover:bg-warning/15 transition-colors"
                )}
                onClick={onToggleTheme}
              >
                {isDark ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-primary" />}
                {!collapsed && <span className="ml-2 text-xs">{isDark ? 'Light Mode' : 'Dark Mode'}</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Toggle {isDark ? 'light' : 'dark'} mode</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator className="my-2" />

        {/* Find & Replace */}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onFindReplace(true)}
                disabled={!editor}
                className={cn(
                  collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
                  "hover:bg-primary/15 hover:text-primary transition-colors"
                )}
              >
                <Search className="h-4 w-4 text-primary" />
                {!collapsed && <span className="ml-2 text-xs">Find & Replace</span>}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p>Find & Replace (Ctrl+F)</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <Separator className="my-2" />
        <div className={cn("flex gap-1", collapsed ? "flex-col items-center" : "")}>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 hover:bg-primary/15 hover:text-primary transition-colors"
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
                className="h-8 w-8 p-0 hover:bg-primary/15 hover:text-primary transition-colors"
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

        <FormattingToolbar editor={editor} collapsed={collapsed} />

        <Separator className="my-2" />

        {/* Help */}
        <div className={cn(collapsed && "flex justify-center")}>
          {collapsed ? (
            <OutlineHelp className="h-8 w-8 p-0 hover:bg-primary/15 hover:text-primary transition-colors" />
          ) : (
            <div className="space-y-1">
              <span className="text-[10px] font-medium text-primary uppercase tracking-wider px-1">
                Help
              </span>
              <div className="flex items-center gap-1">
                <OutlineHelp className="h-8 w-8 p-0 hover:bg-primary/15 hover:text-primary transition-colors" />
                <span className="text-xs text-muted-foreground">Shortcuts</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!collapsed && (
        <div className="relative p-2 border-t border-border/30">
          <p className="text-[10px] text-muted-foreground text-center">
            Press <kbd className="px-1 py-0.5 rounded bg-muted text-[9px] font-mono">?</kbd> for shortcuts
          </p>
        </div>
      )}
    </>
  );
}
