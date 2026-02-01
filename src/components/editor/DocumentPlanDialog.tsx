import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Sparkles, Check, X, GripVertical, Plus, Zap, ListPlus } from 'lucide-react';

export interface SectionPrompt {
  sectionId: string | null; // null for new sections
  sectionTitle: string;
  prompt: string;
  enabled: boolean;
  isNew?: boolean; // true if this section needs to be created
}

interface DocumentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionPrompts: SectionPrompt[];
  onApprove: (prompts: SectionPrompt[], autoExecute: boolean) => void;
  onCancel: () => void;
}

export function DocumentPlanDialog({
  open,
  onOpenChange,
  sectionPrompts: initialPrompts,
  onApprove,
  onCancel,
}: DocumentPlanDialogProps) {
  const [prompts, setPrompts] = useState<SectionPrompt[]>(initialPrompts);
  const [size, setSize] = useState({ width: 672, height: 600 }); // Default max-w-2xl = 672px
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

  // Reset when dialog opens with new prompts
  useEffect(() => {
    if (open) {
      setPrompts(initialPrompts);
    }
  }, [open, initialPrompts]);

  const handlePromptChange = (index: number, newPrompt: string) => {
    setPrompts(prev =>
      prev.map((p, i) => (i === index ? { ...p, prompt: newPrompt } : p))
    );
  };

  const handleTitleChange = (index: number, newTitle: string) => {
    setPrompts(prev =>
      prev.map((p, i) => (i === index ? { ...p, sectionTitle: newTitle } : p))
    );
  };

  const handleToggleEnabled = (index: number) => {
    setPrompts(prev =>
      prev.map((p, i) => (i === index ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleApprove = (autoExecute: boolean) => {
    const enabledPrompts = prompts.filter(p => p.enabled && p.prompt.trim());
    onApprove(enabledPrompts, autoExecute);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    resizeRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startW: size.width,
      startH: size.height,
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current) return;
      
      const deltaX = e.clientX - resizeRef.current.startX;
      const deltaY = e.clientY - resizeRef.current.startY;
      
      setSize({
        width: Math.max(400, Math.min(window.innerWidth - 48, resizeRef.current.startW + deltaX)),
        height: Math.max(300, Math.min(window.innerHeight - 48, resizeRef.current.startH + deltaY)),
      });
    };

    const handleMouseUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const enabledCount = prompts.filter(p => p.enabled && p.prompt.trim()).length;
  const newSectionsCount = prompts.filter(p => p.isNew && p.enabled).length;

  // Generate button text based on what will happen
  const getApproveButtonText = () => {
    if (newSectionsCount > 0) {
      const promptCount = enabledCount;
      return `Create ${newSectionsCount} Section${newSectionsCount !== 1 ? 's' : ''} & Queue ${promptCount} Prompt${promptCount !== 1 ? 's' : ''}`;
    }
    return `Queue ${enabledCount} Prompt${enabledCount !== 1 ? 's' : ''}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="flex flex-col overflow-hidden"
        style={{ 
          width: size.width, 
          height: size.height, 
          maxWidth: '95vw', 
          maxHeight: '95vh' 
        }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Document Plan
          </DialogTitle>
          <DialogDescription>
            {newSectionsCount > 0 
              ? `${newSectionsCount} new sections will be created. Review and edit the titles and prompts below.`
              : 'Review and edit the AI-generated prompts for each section. Enable or disable sections as needed.'
            }
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4 py-2">
            {prompts.map((sectionPrompt, index) => (
              <div
                key={sectionPrompt.sectionId || `new-${index}`}
                className={`p-3 rounded-lg border transition-colors ${
                  sectionPrompt.enabled
                    ? sectionPrompt.isNew 
                      ? 'border-green-500/30 bg-green-500/5'
                      : 'border-primary/30 bg-primary/5'
                    : 'border-muted bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`section-${sectionPrompt.sectionId || index}`}
                    checked={sectionPrompt.enabled}
                    onCheckedChange={() => handleToggleEnabled(index)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <Label
                        htmlFor={`section-${sectionPrompt.sectionId || index}`}
                        className="font-medium text-sm cursor-pointer flex-1"
                      >
                        {sectionPrompt.isNew ? (
                          <input
                            type="text"
                            value={sectionPrompt.sectionTitle}
                            onChange={(e) => handleTitleChange(index, e.target.value)}
                            className="bg-transparent border-none outline-none w-full font-medium text-sm focus:ring-1 focus:ring-primary/30 rounded px-1 -mx-1"
                            placeholder="Section title..."
                            disabled={!sectionPrompt.enabled}
                          />
                        ) : (
                          <>
                            Section {index + 1}: {sectionPrompt.sectionTitle.slice(0, 50)}
                            {sectionPrompt.sectionTitle.length > 50 && '...'}
                          </>
                        )}
                      </Label>
                      {sectionPrompt.isNew && (
                        <Badge variant="secondary" className="bg-green-500/20 text-green-700 dark:text-green-300 gap-1 text-[10px] h-5">
                          <Plus className="h-3 w-3" />
                          To Be Inserted
                        </Badge>
                      )}
                    </div>
                    <Textarea
                      value={sectionPrompt.prompt}
                      onChange={(e) => handlePromptChange(index, e.target.value)}
                      placeholder="Enter a prompt for this section..."
                      className="min-h-[80px] text-sm resize-none"
                      disabled={!sectionPrompt.enabled}
                    />
                  </div>
                </div>
              </div>
            ))}

            {prompts.length === 0 && (
              <div className="text-center text-muted-foreground py-8">
                No section prompts generated
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" onClick={() => handleApprove(false)} disabled={enabledCount === 0}>
                <ListPlus className="h-4 w-4 mr-1" />
                Queue {enabledCount} Prompt{enabledCount !== 1 ? 's' : ''}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Queue prompts for manual execution later</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button onClick={() => handleApprove(true)} disabled={enabledCount === 0}>
                <Zap className="h-4 w-4 mr-1" />
                Auto-Write Document
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p>Automatically generate content for all sections</p>
            </TooltipContent>
          </Tooltip>
        </div>

        {/* Resize handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground transition-colors"
          title="Drag to resize"
        >
          <GripVertical className="h-3 w-3 rotate-[-45deg]" />
        </div>
      </DialogContent>
    </Dialog>
  );
}
