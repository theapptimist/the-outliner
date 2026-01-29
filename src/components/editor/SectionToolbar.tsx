import React from 'react';
import { Sparkles, Play, Link2, Upload, Minimize2, Maximize2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

export interface SectionToolbarProps {
  sectionId: string;
  isAIPanelOpen: boolean;
  onToggleAIPanel: () => void;
  onSpeedRead: () => void;
  onLinkDocument: () => void;
  onImport: () => void;
  /** Block-level actions (only shown on first section) */
  isFirstSection?: boolean;
  isBlockCollapsed?: boolean;
  onToggleBlockCollapse?: () => void;
  onDeleteBlock?: () => void;
  /** Whether this section has a queued AI prompt */
  hasQueuedPrompt?: boolean;
}

export function SectionToolbar({
  sectionId,
  isAIPanelOpen,
  onToggleAIPanel,
  onSpeedRead,
  onLinkDocument,
  onImport,
  isFirstSection = false,
  isBlockCollapsed = false,
  onToggleBlockCollapse,
  onDeleteBlock,
  hasQueuedPrompt = false,
}: SectionToolbarProps) {
  return (
    <div className="flex items-center gap-0.5">
      {/* AI Panel Toggle */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-6 w-6 p-0 bg-background/80 backdrop-blur-sm relative",
              isAIPanelOpen && "text-primary bg-primary/10",
              hasQueuedPrompt && !isAIPanelOpen && "text-primary"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAIPanel();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-3 w-3" />
            {/* Queued prompt indicator */}
            {hasQueuedPrompt && !isAIPanelOpen && (
              <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p>{isAIPanelOpen ? "Close AI panel" : hasQueuedPrompt ? "Open AI panel (prompt queued)" : "Open AI panel"}</p>
        </TooltipContent>
      </Tooltip>

      {/* Speed Read */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onSpeedRead();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Play className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p>Speed Read</p>
        </TooltipContent>
      </Tooltip>

      {/* Link Document */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onLinkDocument();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Link2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p>Link document</p>
        </TooltipContent>
      </Tooltip>

      {/* Import */}
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
            onClick={(e) => {
              e.stopPropagation();
              onImport();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Upload className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p>Import outline</p>
        </TooltipContent>
      </Tooltip>

      {/* Block-level actions (only on first section) */}
      {isFirstSection && (
        <>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleBlockCollapse?.();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {isBlockCollapsed ? (
                  <Maximize2 className="h-3 w-3" />
                ) : (
                  <Minimize2 className="h-3 w-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              <p>{isBlockCollapsed ? 'Expand' : 'Collapse'}</p>
            </TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 bg-background/80 backdrop-blur-sm text-destructive hover:text-destructive"
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteBlock?.();
                }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>
              <p>Delete outline</p>
            </TooltipContent>
          </Tooltip>
        </>
      )}
    </div>
  );
}
