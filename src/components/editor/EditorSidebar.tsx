import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Wrench,
  BookOpen,
  Plus,
  Sparkles,
  Network,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { OutlineStyle, MixedStyleConfig } from '@/lib/outlineStyles';
import { useEditorContext } from './EditorContext';
import { useNavigation } from '@/contexts/NavigationContext';
import { DefinedTermsPane } from './DefinedTermsPane';
import { AIGeneratePane } from './AIGeneratePane';
import { ToolsPane } from './ToolsPane';
import { MasterOutlinePane } from './MasterOutlinePane';
import { FileMenu } from './FileMenu';
import { cn } from '@/lib/utils';

type SidebarTab = 'tools' | 'terms' | 'ai' | 'master';

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
  fileMenuProps: React.ComponentProps<typeof FileMenu>;
  onNavigateToDocument?: (id: string) => void;
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
  fileMenuProps,
  onNavigateToDocument,
}: EditorSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<SidebarTab>('tools');
  const [isDark, setIsDark] = useState(() => 
    document.documentElement.classList.contains('dark')
  );
  const { editor, onInsertHierarchy, onFindReplace, selectedText, onPasteHierarchy } = useEditorContext();
  const { isInMasterMode } = useNavigation();

  // Ref to hold pending AI items when we need to create an outline block first
  const pendingAIItemsRef = useRef<Array<{ label: string; depth: number }> | null>(null);
  
  // Callback for AI generation to insert hierarchy
  const handleAIInsertHierarchy = useCallback((items: Array<{ label: string; depth: number }>) => {
    if (onPasteHierarchy) {
      onPasteHierarchy(items);
    } else {
      // No outline block yet - create one first, then paste
      pendingAIItemsRef.current = items;
      onInsertHierarchy();
    }
  }, [onPasteHierarchy, onInsertHierarchy]);
  
  // When onPasteHierarchy becomes available and we have pending items, paste them
  useEffect(() => {
    if (onPasteHierarchy && pendingAIItemsRef.current) {
      const items = pendingAIItemsRef.current;
      pendingAIItemsRef.current = null;
      requestAnimationFrame(() => {
        onPasteHierarchy(items);
      });
    }
  }, [onPasteHierarchy]);

  // Auto-switch to master tab when entering master mode
  useEffect(() => {
    if (isInMasterMode) {
      setActiveTab('master');
    }
  }, [isInMasterMode]);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleToggleTheme = useCallback(() => {
    setIsDark(prev => !prev);
  }, []);

  return (
    <div
      data-editor-sidebar
      onMouseDownCapture={(e) => {
        // Prevent sidebar controls from taking focus away from the active textarea.
        const t = e.target as HTMLElement | null;
        // Always allow form controls through
        if (t?.closest('textarea, input, select, option, [contenteditable="true"]')) return;
        if (t?.closest('[data-allow-pointer]')) return;
        if (t?.closest('button,[role="button"],a')) {
          e.preventDefault();
        }
      }}
      onPointerDownCapture={(e) => {
        const t = e.target as HTMLElement | null;
        // Always allow form controls through
        if (t?.closest('textarea, input, select, option, [contenteditable="true"]')) return;
        if (t?.closest('[data-allow-pointer]')) return;
        if (t?.closest('button,[role="button"],a')) {
          e.preventDefault();
        }
      }}
      className={cn(
        "flex flex-col border-r border-border/30 transition-all duration-300 relative overflow-hidden",
        collapsed ? "w-12" : activeTab === 'terms' ? "w-64" : "w-56"
      )}
    >
      {/* Subtle gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-muted/30 via-background to-muted/20" />
      
      {/* Decorative accent line */}
      <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary via-accent to-primary/50 opacity-50" />

      {/* Tool Strip Header - distinguished with stronger background */}
      <div className="relative bg-gradient-to-r from-primary/10 via-accent/8 to-primary/10 border-b border-primary/20 shadow-sm">
        <div className={cn(
          "flex items-center justify-between px-2 py-2",
          collapsed && "justify-center"
        )}>
          {!collapsed && (
            <span className="text-xs font-semibold text-primary tracking-wide uppercase">Editor</span>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 hover:bg-primary/15 hover:text-primary transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
        
        {/* Navigation bullets */}
        <div className={cn(
          "flex items-center gap-1 px-2 pb-2",
          collapsed && "flex-col"
        )}>
          {/* File Menu Icon */}
          <FileMenu {...fileMenuProps} iconOnly />
          
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-allow-pointer
                onClick={() => setActiveTab('tools')}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  activeTab === 'tools'
                    ? "bg-primary/15 text-primary"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <Wrench className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "bottom"}>Tools</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-allow-pointer
                onClick={() => setActiveTab('terms')}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  activeTab === 'terms'
                    ? "bg-accent/15 text-accent"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <BookOpen className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "bottom"}>Defined Terms</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-allow-pointer
                onClick={() => setActiveTab('ai')}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  activeTab === 'ai'
                    ? "bg-success/15 text-success"
                    : "hover:bg-muted/50 text-muted-foreground"
                )}
              >
                <Sparkles className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "bottom"}>AI Generate</TooltipContent>
          </Tooltip>
          {/* Always-visible Add Term button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                data-allow-pointer
                onClick={() => {
                  setActiveTab('terms');
                  // Small delay to let tab switch, then open dialog
                  setTimeout(() => {
                    const addBtn = document.querySelector('[data-add-term-btn]') as HTMLButtonElement;
                    addBtn?.click();
                  }, 50);
                }}
                className={cn(
                  "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                  "bg-success/15 text-success hover:bg-success/25"
                )}
              >
                <Plus className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent side={collapsed ? "right" : "bottom"}>Add Term</TooltipContent>
          </Tooltip>
          
          {/* Master Outline button - only visible when in master mode */}
          {isInMasterMode && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  data-allow-pointer
                  onClick={() => setActiveTab('master')}
                  className={cn(
                    "h-7 w-7 rounded-md flex items-center justify-center transition-colors",
                    activeTab === 'master'
                      ? "bg-warning/15 text-warning"
                      : "hover:bg-muted/50 text-muted-foreground"
                  )}
                >
                  <Network className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent side={collapsed ? "right" : "bottom"}>Master Outline</TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Conditional Content - now properly conditional rendering */}
      {activeTab === 'terms' && (
        <div className="relative flex-1 overflow-y-auto scrollbar-thin">
          <DefinedTermsPane collapsed={collapsed} selectedText={selectedText} />
        </div>
      )}
      
      {activeTab === 'ai' && (
        <div className="relative flex-1 overflow-y-auto p-2 scrollbar-thin">
          <AIGeneratePane 
            onInsertHierarchy={handleAIInsertHierarchy}
          />
        </div>
      )}
      
      {activeTab === 'master' && (
        <div className="relative flex-1 overflow-y-auto scrollbar-thin">
          <MasterOutlinePane
            collapsed={collapsed}
            onNavigateToDocument={(id) => onNavigateToDocument?.(id)}
          />
        </div>
      )}
      
      {activeTab === 'tools' && (
        <ToolsPane
          collapsed={collapsed}
          editor={editor}
          outlineStyle={outlineStyle}
          onOutlineStyleChange={onOutlineStyleChange}
          mixedConfig={mixedConfig}
          onMixedConfigChange={onMixedConfigChange}
          autoDescend={autoDescend}
          onAutoDescendChange={onAutoDescendChange}
          showRevealCodes={showRevealCodes}
          onShowRevealCodesChange={onShowRevealCodesChange}
          isDark={isDark}
          onToggleTheme={handleToggleTheme}
          onInsertHierarchy={onInsertHierarchy}
          onFindReplace={onFindReplace}
          onUndo={onUndo}
          onRedo={onRedo}
          canUndo={canUndo}
          canRedo={canRedo}
        />
      )}
    </div>
  );
}
