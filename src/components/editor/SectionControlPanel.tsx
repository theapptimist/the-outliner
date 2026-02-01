import React, { useState } from 'react';
import { HierarchyNode } from '@/types/node';
import { Collapsible, CollapsibleContent } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronUp, Sparkles, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SectionAIChat } from './SectionAIChat';
import { useSectionPromptQueue } from '@/hooks/useSectionPromptQueue';
import { useDocumentContext } from './context/DocumentContext';

interface SectionInfo {
  id: string;
  title: string;
}

export interface SectionControlPanelProps {
  sectionId: string;
  sectionLabel: string;
  sectionChildren: HierarchyNode[];
  documentContext?: string;
  isOpen: boolean;
  onToggle: () => void;
  onInsertContent: (items: Array<{ label: string; depth: number }>) => void;
  /** Whether this is the first section (enables document planning) */
  isFirstSection?: boolean;
  /** All sections in the document */
  allSections?: SectionInfo[];
  /** Callback to create a new depth-0 section after a given node, returns the new section's ID */
  onCreateSection?: (title: string, afterId?: string | null) => string | undefined;
  /** Callback to update an existing section's label */
  onUpdateSectionLabel?: (sectionId: string, newLabel: string) => void;
  /** Callback to insert AI-generated content into a specific section */
  onInsertSectionContent?: (sectionId: string, items: Array<{ label: string; depth: number }>) => void;
  /** Callback to programmatically open multiple section panels (for Auto-Write cascade) */
  onOpenSectionPanels?: (sectionIds: string[]) => void;
}

export function SectionControlPanel({
  sectionId,
  sectionLabel,
  sectionChildren,
  documentContext,
  isOpen,
  onToggle,
  onInsertContent,
  isFirstSection = false,
  allSections = [],
  onCreateSection,
  onUpdateSectionLabel,
  onInsertSectionContent,
  onOpenSectionPanels,
}: SectionControlPanelProps) {
  const { document } = useDocumentContext();
  const documentId = document?.meta?.id || 'unknown';
  const promptQueue = useSectionPromptQueue(documentId);
  const hasQueuedPrompt = promptQueue.hasQueuedPrompt(sectionId);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Flatten children to text for context
  const flattenChildren = (nodes: HierarchyNode[], depth = 0): string => {
    return nodes
      .map(node => {
        const indent = '  '.repeat(depth);
        const childrenText = node.children?.length 
          ? '\n' + flattenChildren(node.children, depth + 1) 
          : '';
        return `${indent}${node.label}${childrenText}`;
      })
      .join('\n');
  };

  const sectionContent = flattenChildren(sectionChildren);

  return (
    <Collapsible open={isOpen} onOpenChange={onToggle}>
      <CollapsibleContent>
        <div 
          className={cn(
            "relative mx-2 mb-2 rounded-md border border-foreground/10 bg-background/50 backdrop-blur-sm overflow-hidden transition-all duration-200",
            isFullscreen && "fixed inset-4 z-50 mx-0 mb-0 shadow-2xl"
          )}
        >
          {/* Fullscreen backdrop */}
          {isFullscreen && (
            <div 
              className="fixed inset-0 bg-background/80 backdrop-blur-sm -z-10" 
              onClick={() => setIsFullscreen(false)}
            />
          )}
          
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          {/* Sci-fi corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-foreground/20" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-foreground/20" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-foreground/20" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-foreground/20" />

          <div className="flex flex-col h-full">
            {/* Header */}
            <div className="flex items-center justify-between px-3 pt-2 pb-1 border-b border-foreground/5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Assistant</span>
                {isFullscreen && (
                  <span className="text-muted-foreground font-normal ml-1">
                    — {sectionLabel.slice(0, 40)}{sectionLabel.length > 40 ? '...' : ''}
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-1">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {isFullscreen ? (
                        <Minimize2 className="w-3.5 h-3.5" />
                      ) : (
                        <Maximize2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" sideOffset={4}>
                    <p>{isFullscreen ? "Exit fullscreen" : "Fullscreen"}</p>
                  </TooltipContent>
                </Tooltip>
                
                <button
                  onClick={onToggle}
                  className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                  title="Close panel"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* AI Chat Content */}
            <div className={cn(
              "p-2 pt-1",
              isFullscreen && "flex-1 overflow-hidden"
            )}>
              <SectionAIChat
                sectionId={sectionId}
                sectionLabel={sectionLabel}
                sectionContent={sectionContent}
                documentContext={documentContext}
                onInsertContent={onInsertContent}
                isFirstSection={isFirstSection}
                allSections={allSections}
                onCreateSection={onCreateSection}
                onUpdateSectionLabel={onUpdateSectionLabel}
                onInsertSectionContent={onInsertSectionContent}
                onOpenSectionPanels={onOpenSectionPanels}
                onClosePanel={onToggle}
                isFullscreen={isFullscreen}
              />
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// Toggle button component for depth-0 rows
export function SectionPanelToggle({
  isOpen,
  onToggle,
  hasQueuedPrompt = false,
}: {
  isOpen: boolean;
  onToggle: () => void;
  hasQueuedPrompt?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggle();
          }}
          onPointerDown={(e) => e.stopPropagation()}
          className={cn(
            "h-6 w-6 p-0 flex items-center justify-center rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm relative",
            isOpen && "text-primary bg-primary/10",
            hasQueuedPrompt && !isOpen && "text-primary"
          )}
        >
          <Sparkles className="h-3 w-3" />
          {/* Queued prompt indicator dot */}
          {hasQueuedPrompt && !isOpen && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" sideOffset={4}>
        <p>{isOpen ? "Close AI panel" : hasQueuedPrompt ? "Open AI panel (prompt queued)" : "Open AI panel"}</p>
      </TooltipContent>
    </Tooltip>
  );
}
