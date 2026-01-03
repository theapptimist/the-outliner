import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useEditorContext } from './EditorContext';
import { extractDefinedTermsFromItems } from '@/lib/termScanner';

interface AIGeneratePaneProps {
  onInsertHierarchy: (items: Array<{ label: string; depth: number }>) => void;
  getDocumentContext?: () => string;
}

type GenerateStatus = 'idle' | 'clicked' | 'requesting' | 'success' | 'error';

export function AIGeneratePane({ onInsertHierarchy, getDocumentContext }: AIGeneratePaneProps) {
  const { addExtractedTerms } = useEditorContext();
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<GenerateStatus>('idle');
  const [statusDetail, setStatusDetail] = useState('');

  const handleGenerate = useCallback(async () => {
    console.log('AI Generate: click handler fired', { promptLen: prompt.length });
    setStatus('clicked');
    setStatusDetail('Click registered');

    if (!prompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Describe what you want to generate',
        variant: 'destructive',
      });
      setStatus('idle');
      setStatusDetail('');
      return;
    }

    setIsLoading(true);
    setStatus('requesting');
    setStatusDetail('Sending request...');

    try {
      const context = getDocumentContext?.();
      
      console.log('AI Generate: invoking generate-outline', { prompt: prompt.trim(), hasContext: !!context });
      
      const timeoutMs = 30000;
      const fetchPromise = supabase.functions.invoke('generate-outline', {
        body: { prompt: prompt.trim(), context },
      });
      
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out after 30 seconds')), timeoutMs)
      );
      
      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]);
      
      console.log('AI Generate: response received', { data, error });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        const stripOutlinePrefix = (label: string) => {
          // Remove common outline-style prefixes that the model sometimes includes in the label (e.g. "1.", "a)", "(i)").
          // Our renderer already generates prefixes, so keeping them causes "2. 1. Title"-style duplication.
          const s = (label ?? '').trimStart();
          return s.replace(/^((?:\(?\d+\)?|[a-zA-Z]|[ivxlcdmIVXLCDM]+)\s*[\.)])+\s+/u, '').trimStart();
        };

        const sanitizedItems = data.items.map((it: any) => ({
          ...it,
          label: typeof it?.label === 'string' ? stripOutlinePrefix(it.label) : it?.label,
        }));

        console.log('AI Generate: inserting items', { count: sanitizedItems.length });
        setStatus('success');
        setStatusDetail(`Received ${sanitizedItems.length} items`);

        // Insert the outline items
        onInsertHierarchy(sanitizedItems);

        // Extract and add any defined terms found in the generated content
        const extractedTerms = extractDefinedTermsFromItems(sanitizedItems);
        if (extractedTerms.length > 0 && addExtractedTerms) {
          addExtractedTerms(extractedTerms);
          console.log('AI Generate: extracted terms', extractedTerms);
        }

        setPrompt('');
        toast({
          title: 'Generated',
          description: `Inserted ${sanitizedItems.length} outline item(s)${extractedTerms.length > 0 ? ` with ${extractedTerms.length} defined term(s)` : ''}`,
        });
      } else {
        setStatus('error');
        setStatusDetail('No items returned');
        toast({
          title: 'No content generated',
          description: 'Try a different prompt',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
      setStatus('error');
      setStatusDetail(error instanceof Error ? error.message : 'Unknown error');
      toast({
        title: 'Generation failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  }, [prompt, onInsertHierarchy, getDocumentContext]);

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
    'Draft payment terms with net-30',
  ];

  return (
    <div data-allow-pointer className="p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>AI Generate</span>
      </div>
      
      {/* Debug status line */}
      <div className="text-xs px-2 py-1 rounded bg-muted/50 font-mono">
        Status: <span className={status === 'error' ? 'text-destructive' : status === 'success' ? 'text-green-600' : 'text-muted-foreground'}>{status}</span>
        {statusDetail && <span className="ml-1 opacity-70">({statusDetail})</span>}
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
          {isLoading ? 'Generating...' : 'Ctrl+Enter to generate'}
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

      <div className="text-xs text-muted-foreground space-y-2">
        <p className="font-medium">Try a prompt:</p>
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
  );
}
