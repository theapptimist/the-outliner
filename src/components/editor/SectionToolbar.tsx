import React from 'react';
import { Sparkles, Play, Link2, Upload } from 'lucide-react';
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
}

export function SectionToolbar({
  sectionId,
  isAIPanelOpen,
  onToggleAIPanel,
  onSpeedRead,
  onLinkDocument,
  onImport,
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
              "h-6 w-6 p-0 bg-background/80 backdrop-blur-sm",
              isAIPanelOpen && "text-primary bg-primary/10"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onToggleAIPanel();
            }}
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Sparkles className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={4}>
          <p>{isAIPanelOpen ? "Close AI panel" : "Open AI panel"}</p>
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
    </div>
  );
}
