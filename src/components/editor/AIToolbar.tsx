import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  Sparkles, 
  Loader2, 
  ChevronsDown, 
  ChevronsUp, 
  LayoutList,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useEditorContext } from './EditorContext';
import { extractDefinedTermsFromItems } from '@/lib/termScanner';
import { cn } from '@/lib/utils';

interface AIToolbarProps {
  collapsed?: boolean;
  /** Insert hierarchy handler from EditorContext */
  onInsertHierarchy: (items: Array<{ label: string; depth: number }>) => void;
  /** Get document context for AI generation */
  getDocumentContext?: () => string;
  /** Panel cascade controls */
  openPanelCount: number;
  totalSectionCount: number;
  onOpenAllPanels: () => void;
  onCloseAllPanels: () => void;
}

type GenerateStatus = 'idle' | 'clicked' | 'requesting' | 'success' | 'error';

export function AIToolbar({
  collapsed = false,
  onInsertHierarchy,
  getDocumentContext,
  openPanelCount,
  totalSectionCount,
  onOpenAllPanels,
  onCloseAllPanels,
}: AIToolbarProps) {
  const { addExtractedTerms } = useEditorContext();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<GenerateStatus>('idle');

  const allPanelsOpen = totalSectionCount > 0 && openPanelCount >= totalSectionCount;
  const hasSections = totalSectionCount > 0;

  const handleGenerate = useCallback(async () => {
    setStatus('clicked');

    if (!prompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Describe what you want to generate',
        variant: 'destructive',
      });
      setStatus('idle');
      return;
    }

    setIsLoading(true);
    setStatus('requesting');

    try {
      const context = getDocumentContext?.();
      
      const timeoutMs = 30000;
      const fetchPromise = supabase.functions.invoke('generate-outline', {
        body: { prompt: prompt.trim(), context },
      });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), timeoutMs)
      );
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);

      if (error) throw error;
      if (data.error) throw new Error(data.error);

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const stripOutlinePrefix = (label: string) => {
          const s = (label ?? '').trimStart();
          return s.replace(/^((?:\(?\d+\)?|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\s*[\.)])+\s+/u, '').trimStart();
        };

        const sanitizedItems = data.items.map((it: any) => ({
          ...it,
          label: typeof it?.label === 'string' ? stripOutlinePrefix(it.label) : it?.label,
        }));

        setStatus('success');
        onInsertHierarchy(sanitizedItems);

        const extractedTerms = extractDefinedTermsFromItems(sanitizedItems);
        if (extractedTerms.length > 0 && addExtractedTerms) {
          addExtractedTerms(extractedTerms);
        }

        setPrompt('');
        toast({
          title: 'Generated',
          description: `Inserted ${sanitizedItems.length} outline item(s)${extractedTerms.length > 0 ? ` with ${extractedTerms.length} defined term(s)` : ''}`,
        });
      } else {
        setStatus('error');
        toast({
          title: 'No content generated',
          description: 'Try a different prompt',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setStatus('error');
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [prompt, onInsertHierarchy, getDocumentContext, addExtractedTerms]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleGenerate();
    }
  }, [handleGenerate]);

  const examplePrompts = [
    'Draft a confidentiality clause',
    'Add termination provisions',
    'Create an indemnification section',
  ];

  if (collapsed) {
    return (
      <div className="p-2 space-y-2">
        <div className="flex flex-col items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div data-allow-pointer className="p-3 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>AI Command Center</span>
      </div>

      {/* Section Panels Section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Section Panels
          </div>
          {hasSections && (
            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted/50 text-xs font-mono">
              <LayoutList className="h-3 w-3" />
              <span>{openPanelCount}/{totalSectionCount}</span>
            </div>
          )}
        </div>
        
        {hasSections ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 justify-center gap-1.5",
                allPanelsOpen && "opacity-50"
              )}
              onClick={onOpenAllPanels}
              disabled={allPanelsOpen}
            >
              <ChevronsDown className="h-3.5 w-3.5" />
              <span>Open All</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                "flex-1 justify-center gap-1.5",
                openPanelCount === 0 && "opacity-50"
              )}
              onClick={onCloseAllPanels}
              disabled={openPanelCount === 0}
            >
              <ChevronsUp className="h-3.5 w-3.5" />
              <span>Close All</span>
            </Button>
          </div>
        ) : (
          <div className="text-xs text-muted-foreground/70 italic px-1">
            No sections yet. Create an outline first.
          </div>
        )}
      </div>

      <Separator className="opacity-50" />

      {/* Quick Generate Section */}
      <div className="space-y-3">
        <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Quick Generate
        </div>
        
        <Textarea
          data-allow-pointer
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Draft a confidentiality clause..."
          className="min-h-[80px] text-sm resize-none"
          disabled={isLoading}
        />
        
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">
            {isLoading ? 'Generating...' : 'Ctrl+Enter'}
          </span>
          <Button
            data-allow-pointer
            size="sm"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-1" />
                Generate
              </>
            )}
          </Button>
        </div>

        {/* Example prompts */}
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Try a prompt:</p>
          <div className="flex flex-wrap gap-1">
            {examplePrompts.map((example) => (
              <button
                key={example}
                type="button"
                data-allow-pointer
                onClick={() => setPrompt(example)}
                className="px-2 py-1 rounded-md bg-muted hover:bg-accent text-xs transition-colors text-left"
              >
                {example}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIToolbar;
