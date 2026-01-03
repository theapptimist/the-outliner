import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sparkles, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface AIGeneratePaneProps {
  onInsertHierarchy: (items: Array<{ label: string; depth: number }>) => void;
  getDocumentContext?: () => string;
}

export function AIGeneratePane({ onInsertHierarchy, getDocumentContext }: AIGeneratePaneProps) {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast({
        title: 'Enter a prompt',
        description: 'Describe what you want to generate',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      const context = getDocumentContext?.();
      
      const { data, error } = await supabase.functions.invoke('generate-outline', {
        body: { prompt: prompt.trim(), context },
      });

      if (error) {
        throw error;
      }

      if (data.error) {
        throw new Error(data.error);
      }

      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        onInsertHierarchy(data.items);
        setPrompt('');
        toast({
          title: 'Generated',
          description: `Inserted ${data.items.length} outline item(s)`,
        });
      } else {
        toast({
          title: 'No content generated',
          description: 'Try a different prompt',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('AI generation error:', error);
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

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4" />
        <span>AI Generate</span>
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
          size="sm"
          onClick={handleGenerate}
          disabled={isLoading || !prompt.trim()}
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

      <div className="text-xs text-muted-foreground space-y-1">
        <p className="font-medium">Try prompts like:</p>
        <ul className="list-disc list-inside space-y-0.5 opacity-80">
          <li>Draft a confidentiality clause</li>
          <li>Add termination provisions</li>
          <li>Create an indemnification section</li>
          <li>Draft payment terms with net-30</li>
        </ul>
      </div>
    </div>
  );
}
