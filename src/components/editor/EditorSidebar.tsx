import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Code2, 
  ArrowDownRight, 
  Layers,
  Undo2,
  Redo2,
  Sun,
  Moon,
  Bold,
  Italic,
  Strikethrough,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  GitBranch,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { OutlineStylePicker } from './OutlineStylePicker';
import { OutlineHelp } from './OutlineHelp';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { useEditorContext } from './EditorContext';
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

interface ToolButtonProps {
  onClick: () => void;
  isActive?: boolean;
  disabled?: boolean;
  icon: React.ReactNode;
  label: string;
  tooltip: string;
  collapsed: boolean;
  color?: string;
}

function ToolButton({ onClick, isActive, disabled, icon, label, tooltip, collapsed, color = "primary" }: ToolButtonProps) {
  const colorClasses = {
    primary: "hover:bg-primary/15 hover:text-primary",
    accent: "hover:bg-accent/15 hover:text-accent",
    success: "hover:bg-success/15 hover:text-success",
    warning: "hover:bg-warning/15 hover:text-warning",
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          disabled={disabled}
          className={cn(
            collapsed ? "h-8 w-8 p-0" : "w-full justify-start h-8 px-2",
            "transition-colors",
            colorClasses[color as keyof typeof colorClasses],
            isActive && `bg-${color}/15 text-${color}`
          )}
        >
          {icon}
          {!collapsed && <span className="ml-2 text-xs">{label}</span>}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        <p>{tooltip}</p>
      </TooltipContent>
    </Tooltip>
  );
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
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  const { editor, onInsertHierarchy, onFindReplace } = useEditorContext();

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  return (
    <div 
      className={cn(
        "flex flex-col border-r border-border/30 transition-all duration-300 relative overflow-hidden",
        collapsed ? "w-12" : "w-56"
      )}
    >
      {/* Gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-accent/5 to-success/5 dark:from-primary/10 dark:via-accent/8 dark:to-success/8" />
      <div className="absolute inset-0 bg-card/80 backdrop-blur-sm" />
      
      {/* Decorative accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary via-accent to-success opacity-60" />

      {/* Header with collapse toggle */}
      <div className="relative flex items-center justify-between p-2 border-b border-border/30">
        {!collapsed && (
          <span className="text-xs font-semibold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent uppercase tracking-wider">
            Tools
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-7 w-7 p-0 hover:bg-primary/10 hover:text-primary transition-colors",
            collapsed && "mx-auto"
          )}
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
                onClick={() => setIsDark(!isDark)}
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

        {/* Text Formatting */}
        {!collapsed && (
          <span className="text-[10px] font-medium text-primary uppercase tracking-wider px-1">
            Format
          </span>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          <ToolButton
            onClick={() => editor?.chain().focus().toggleBold().run()}
            isActive={editor?.isActive('bold')}
            disabled={!editor}
            icon={<Bold className="h-4 w-4" />}
            label="Bold"
            tooltip="Bold (Ctrl+B)"
            collapsed={collapsed}
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            isActive={editor?.isActive('italic')}
            disabled={!editor}
            icon={<Italic className="h-4 w-4" />}
            label="Italic"
            tooltip="Italic (Ctrl+I)"
            collapsed={collapsed}
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleStrike().run()}
            isActive={editor?.isActive('strike')}
            disabled={!editor}
            icon={<Strikethrough className="h-4 w-4" />}
            label="Strikethrough"
            tooltip="Strikethrough"
            collapsed={collapsed}
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleCode().run()}
            isActive={editor?.isActive('code')}
            disabled={!editor}
            icon={<Code className="h-4 w-4" />}
            label="Code"
            tooltip="Inline Code"
            collapsed={collapsed}
          />
        </div>

        <Separator className="my-2" />

        {/* Headings */}
        {!collapsed && (
          <span className="text-[10px] font-medium text-accent uppercase tracking-wider px-1">
            Headings
          </span>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          <ToolButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
            isActive={editor?.isActive('heading', { level: 1 })}
            disabled={!editor}
            icon={<Heading1 className="h-4 w-4" />}
            label="Heading 1"
            tooltip="Heading 1"
            collapsed={collapsed}
            color="accent"
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor?.isActive('heading', { level: 2 })}
            disabled={!editor}
            icon={<Heading2 className="h-4 w-4" />}
            label="Heading 2"
            tooltip="Heading 2"
            collapsed={collapsed}
            color="accent"
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor?.isActive('heading', { level: 3 })}
            disabled={!editor}
            icon={<Heading3 className="h-4 w-4" />}
            label="Heading 3"
            tooltip="Heading 3"
            collapsed={collapsed}
            color="accent"
          />
        </div>

        <Separator className="my-2" />

        {/* Lists & Blocks */}
        {!collapsed && (
          <span className="text-[10px] font-medium text-success uppercase tracking-wider px-1">
            Blocks
          </span>
        )}
        <div className={cn("space-y-1", collapsed && "flex flex-col items-center")}>
          <ToolButton
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            isActive={editor?.isActive('bulletList')}
            disabled={!editor}
            icon={<List className="h-4 w-4" />}
            label="Bullet List"
            tooltip="Bullet List"
            collapsed={collapsed}
            color="success"
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            isActive={editor?.isActive('orderedList')}
            disabled={!editor}
            icon={<ListOrdered className="h-4 w-4" />}
            label="Numbered List"
            tooltip="Numbered List"
            collapsed={collapsed}
            color="success"
          />
          <ToolButton
            onClick={() => editor?.chain().focus().toggleBlockquote().run()}
            isActive={editor?.isActive('blockquote')}
            disabled={!editor}
            icon={<Quote className="h-4 w-4" />}
            label="Quote"
            tooltip="Block Quote"
            collapsed={collapsed}
            color="success"
          />
          <ToolButton
            onClick={() => editor?.chain().focus().setHorizontalRule().run()}
            disabled={!editor}
            icon={<Minus className="h-4 w-4" />}
            label="Divider"
            tooltip="Horizontal Rule"
            collapsed={collapsed}
            color="success"
          />
        </div>

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
    </div>
  );
}
