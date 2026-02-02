import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { DocumentAIPanel } from './DocumentAIPanel';

export function DocumentAIButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={() => setIsOpen(true)}
            className={cn(
              "absolute top-2 left-2 z-10",
              "h-8 w-8 flex items-center justify-center rounded-md",
              "bg-background/80 backdrop-blur-sm border border-foreground/10",
              "hover:bg-primary/10 hover:border-primary/30 hover:text-primary",
              "text-muted-foreground transition-all duration-200",
              "shadow-sm hover:shadow-md",
              isOpen && "bg-primary/10 border-primary/30 text-primary"
            )}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          <p>Document AI Assistant</p>
        </TooltipContent>
      </Tooltip>

      <DocumentAIPanel
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
