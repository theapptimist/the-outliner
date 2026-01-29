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
import { Sparkles, Check, X, GripVertical } from 'lucide-react';

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
  const [size, setSize] = useState({ width: 672, height: 600 }); // Default max-w-2xl = 672px
  const resizeRef = useRef<{ startX: number; startY: number; startW: number; startH: number } | null>(null);

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

        <div className="flex items-center justify-end gap-2 pt-4 border-t">
          <Button variant="ghost" onClick={handleCancel}>
            <X className="h-4 w-4 mr-1" />
            Cancel
          </Button>
          <Button onClick={handleApprove} disabled={enabledCount === 0}>
            <Check className="h-4 w-4 mr-1" />
            Queue {enabledCount} Prompt{enabledCount !== 1 ? 's' : ''}
          </Button>
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
