import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sparkles, Check, X } from 'lucide-react';

export interface SectionPrompt {
  sectionId: string;
  sectionTitle: string;
  prompt: string;
  enabled: boolean;
}

interface DocumentPlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sectionPrompts: SectionPrompt[];
  onApprove: (prompts: SectionPrompt[]) => void;
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

  // Reset when dialog opens with new prompts
  useEffect(() => {
    if (open) {
      setPrompts(initialPrompts);
    }
  }, [open, initialPrompts]);

  const handlePromptChange = (sectionId: string, newPrompt: string) => {
    setPrompts(prev =>
      prev.map(p => (p.sectionId === sectionId ? { ...p, prompt: newPrompt } : p))
    );
  };

  const handleToggleEnabled = (sectionId: string) => {
    setPrompts(prev =>
      prev.map(p => (p.sectionId === sectionId ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const handleApprove = () => {
    const enabledPrompts = prompts.filter(p => p.enabled && p.prompt.trim());
    onApprove(enabledPrompts);
    onOpenChange(false);
  };

  const handleCancel = () => {
    onCancel();
    onOpenChange(false);
  };

  const enabledCount = prompts.filter(p => p.enabled && p.prompt.trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Document Plan
          </DialogTitle>
          <DialogDescription>
            Review and edit the AI-generated prompts for each section. Enable or disable sections as needed.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="flex-1 pr-4 -mr-4">
          <div className="space-y-4 py-2">
            {prompts.map((sectionPrompt, index) => (
              <div
                key={sectionPrompt.sectionId}
                className={`p-3 rounded-lg border transition-colors ${
                  sectionPrompt.enabled
                    ? 'border-primary/30 bg-primary/5'
                    : 'border-muted bg-muted/30 opacity-60'
                }`}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    id={`section-${sectionPrompt.sectionId}`}
                    checked={sectionPrompt.enabled}
                    onCheckedChange={() => handleToggleEnabled(sectionPrompt.sectionId)}
                    className="mt-1"
                  />
                  <div className="flex-1 space-y-2">
                    <Label
                      htmlFor={`section-${sectionPrompt.sectionId}`}
                      className="font-medium text-sm cursor-pointer"
                    >
                      Section {index + 1}: {sectionPrompt.sectionTitle.slice(0, 50)}
                      {sectionPrompt.sectionTitle.length > 50 && '...'}
                    </Label>
                    <Textarea
                      value={sectionPrompt.prompt}
                      onChange={(e) => handlePromptChange(sectionPrompt.sectionId, e.target.value)}
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

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={enabledCount === 0}>
            <Check className="h-4 w-4 mr-1" />
            Queue {enabledCount} Prompt{enabledCount !== 1 ? 's' : ''}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
