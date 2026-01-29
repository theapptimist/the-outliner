import React from 'react';
import { HierarchyNode } from '@/types/node';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronUp, Sparkles, Settings, Info } from 'lucide-react';
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
}: SectionControlPanelProps) {
  const { document } = useDocumentContext();
  const documentId = document?.meta?.id || 'unknown';
  const promptQueue = useSectionPromptQueue(documentId);
  const hasQueuedPrompt = promptQueue.hasQueuedPrompt(sectionId);

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
        <div className="relative mx-2 mb-2 rounded-md border border-foreground/10 bg-background/50 backdrop-blur-sm overflow-hidden">
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          {/* Sci-fi corner accents */}
          <div className="absolute top-0 left-0 w-3 h-3 border-l border-t border-foreground/20" />
          <div className="absolute top-0 right-0 w-3 h-3 border-r border-t border-foreground/20" />
          <div className="absolute bottom-0 left-0 w-3 h-3 border-l border-b border-foreground/20" />
          <div className="absolute bottom-0 right-0 w-3 h-3 border-r border-b border-foreground/20" />

          <Tabs defaultValue="ai" className="w-full">
            <div className="flex items-center justify-between px-3 pt-2 pb-1">
              <TabsList className="h-7 bg-foreground/5">
                <TabsTrigger 
                  value="ai" 
                  className="h-6 px-2 text-xs gap-1 data-[state=active]:bg-primary/20 data-[state=active]:text-primary"
                >
                  <Sparkles className="w-3 h-3" />
                  AI
                </TabsTrigger>
                <TabsTrigger 
                  value="info" 
                  className="h-6 px-2 text-xs gap-1 data-[state=active]:bg-foreground/10"
                >
                  <Info className="w-3 h-3" />
                  Info
                </TabsTrigger>
              </TabsList>
              
              <button
                onClick={onToggle}
                className="p-1 rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors"
                title="Close panel"
              >
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>

            <TabsContent value="ai" className="mt-0 p-2 pt-1">
              <SectionAIChat
                sectionId={sectionId}
                sectionLabel={sectionLabel}
                sectionContent={sectionContent}
                documentContext={documentContext}
                onInsertContent={onInsertContent}
                isFirstSection={isFirstSection}
                allSections={allSections}
                onCreateSection={onCreateSection}
              />
            </TabsContent>

            <TabsContent value="info" className="mt-0 p-3 pt-2">
              <div className="space-y-2 text-xs text-muted-foreground">
                <div>
                  <span className="text-foreground/70">Section:</span>{' '}
                  <span className="text-foreground">{sectionLabel}</span>
                </div>
                <div>
                  <span className="text-foreground/70">Children:</span>{' '}
                  <span className="text-foreground">{sectionChildren.length} items</span>
                </div>
                {sectionContent && (
                  <div className="mt-2 p-2 rounded bg-foreground/5 max-h-32 overflow-y-auto">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap text-muted-foreground">
                      {sectionContent.slice(0, 500)}
                      {sectionContent.length > 500 && '...'}
                    </pre>
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
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
