import React, { useState, useRef, useCallback, useMemo } from 'react';
import { 
  Sparkles, 
  Send, 
  Square, 
  Loader2,
  FileText,
  Wand2,
  ListTree,
  Maximize2,
  Minimize2,
  BookOpen,
  CheckCircle2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useDocumentContext } from './context/DocumentContext';
import { getFullDocumentText } from '@/lib/documentContentExtractor';
import { HierarchyNode } from '@/types/node';
import { toast } from 'sonner';

interface DocumentAIPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  toolCall?: {
    name: string;
    arguments: any;
    applied?: boolean;
  };
}

export function DocumentAIPanel({ isOpen, onClose }: DocumentAIPanelProps) {
  const { document, hierarchyBlocks, citationDefinitions, setCitationDefinition, setDisplayOptions, displayOptions } = useDocumentContext();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Extract document content for context
  const documentContext = useMemo(() => {
    if (!hierarchyBlocks) return '';
    
    // Convert hierarchyBlocks to the format expected by getFullDocumentText
    const blocksAsNodes: Record<string, HierarchyNode[]> = {};
    for (const [id, block] of Object.entries(hierarchyBlocks)) {
      if (block && typeof block === 'object' && 'tree' in block) {
        blocksAsNodes[id] = (block as { tree: HierarchyNode[] }).tree;
      }
    }
    
    return getFullDocumentText(blocksAsNodes, document?.content, 16000);
  }, [hierarchyBlocks, document?.content]);

  // Apply citation updates from tool call
  const applyCitations = useCallback((citations: Record<string, string>) => {
    // Enable End Notes display if not already enabled
    if (!displayOptions.showEndNotes) {
      setDisplayOptions({ ...displayOptions, showEndNotes: true });
    }
    
    // Apply each citation
    for (const [marker, text] of Object.entries(citations)) {
      setCitationDefinition(marker, text);
    }
    
    toast.success(`Updated ${Object.keys(citations).length} citation(s)`);
  }, [setCitationDefinition, setDisplayOptions, displayOptions]);

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/document-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [...messages, userMessage],
            documentTitle: document?.meta?.title || 'Untitled Document',
            documentContext,
            existingCitations: citationDefinitions,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get AI response');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let assistantContent = '';
      let buffer = '';
      let toolCallData: { name: string; arguments: string } | null = null;

      // Add empty assistant message
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            
            try {
              const parsed = JSON.parse(data);
              const delta = parsed.choices?.[0]?.delta;
              
              // Handle regular content
              if (delta?.content) {
                assistantContent += delta.content;
                setMessages(prev => {
                  const updated = [...prev];
                  if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                    updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  }
                  return updated;
                });
              }
              
              // Handle tool calls
              if (delta?.tool_calls) {
                for (const toolCall of delta.tool_calls) {
                  if (toolCall.function?.name) {
                    toolCallData = { name: toolCall.function.name, arguments: '' };
                  }
                  if (toolCall.function?.arguments && toolCallData) {
                    toolCallData.arguments += toolCall.function.arguments;
                  }
                }
              }
            } catch {
              // Ignore parse errors for partial JSON
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.startsWith('data: ')) {
        const data = buffer.slice(6).trim();
        if (data !== '[DONE]') {
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta;
            if (delta?.content) {
              assistantContent += delta.content;
            }
            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (toolCall.function?.name) {
                  toolCallData = { name: toolCall.function.name, arguments: '' };
                }
                if (toolCall.function?.arguments && toolCallData) {
                  toolCallData.arguments += toolCall.function.arguments;
                }
              }
            }
          } catch {
            // Ignore
          }
        }
      }

      // If we got a tool call, process it
      if (toolCallData && toolCallData.name === 'update_citations') {
        try {
          const args = JSON.parse(toolCallData.arguments);
          const { citations, summary } = args;
          
          // Apply the citations
          applyCitations(citations);
          
          // Update the message to show what was done
          setMessages(prev => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
              updated[updated.length - 1] = {
                role: 'assistant',
                content: summary || `Updated ${Object.keys(citations).length} citation(s).`,
                toolCall: {
                  name: 'update_citations',
                  arguments: args,
                  applied: true,
                },
              };
            }
            return updated;
          });
        } catch (e) {
          console.error('Failed to parse tool call arguments:', e);
          setMessages(prev => {
            const updated = [...prev];
            if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
              updated[updated.length - 1] = {
                role: 'assistant',
                content: assistantContent || 'I tried to update the citations but encountered an error.',
              };
            }
            return updated;
          });
        }
      } else if (!assistantContent) {
        // No content and no tool call - something went wrong
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1] = {
              role: 'assistant',
              content: 'I received an empty response. Please try again.',
            };
          }
          return updated;
        });
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        setMessages(prev => {
          const updated = [...prev];
          if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
            updated[updated.length - 1].content += ' [cancelled]';
          }
          return updated;
        });
      } else {
        console.error('AI chat error:', error);
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: `Sorry, I encountered an error: ${(error as Error).message}` 
        }]);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [input, isLoading, messages, document?.meta?.title, documentContext, citationDefinitions, applyCitations]);

  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort();
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const handleQuickAction = useCallback((prompt: string) => {
    setInput(prompt);
  }, []);

  const quickActions = [
    { icon: FileText, label: 'Summarize', prompt: 'Summarize this document concisely' },
    { icon: Wand2, label: 'Improve', prompt: 'Suggest improvements for this document' },
    { icon: ListTree, label: 'Outline', prompt: 'Analyze the structure of this document' },
    { icon: BookOpen, label: 'Redo Footnotes', prompt: 'Please redo all the footnotes/citations for this document based on its content. Generate appropriate bibliographic references.' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent 
        className={cn(
          "flex flex-col",
          isFullscreen 
            ? "!fixed !inset-4 !max-w-none !max-h-none !w-auto !h-auto !translate-x-0 !translate-y-0 !top-4 !left-4" 
            : "max-w-lg max-h-[80vh]"
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Document AI
            </DialogTitle>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsFullscreen(!isFullscreen)}
              >
                {isFullscreen ? (
                  <Minimize2 className="h-4 w-4" />
                ) : (
                  <Maximize2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* Quick Actions */}
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-2 px-1">
            {quickActions.map((action) => (
              <Button
                key={action.label}
                variant="outline"
                size="sm"
                className="gap-1.5 text-xs"
                onClick={() => handleQuickAction(action.prompt)}
              >
                <action.icon className="h-3 w-3" />
                {action.label}
              </Button>
            ))}
          </div>
        )}

        {/* Messages */}
        <ScrollArea className={cn(
          "flex-1 pr-4",
          isFullscreen ? "min-h-0" : "min-h-[200px] max-h-[400px]"
        )}>
          <div className="space-y-4 py-2">
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-8">
                <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>Ask me anything about your document</p>
                <p className="text-xs mt-1">I can help summarize, improve, or update footnotes</p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-2",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                      message.role === 'user'
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    {message.toolCall?.applied && (
                      <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400 mb-1.5 pb-1.5 border-b border-current/20">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Citations updated</span>
                      </div>
                    )}
                    <div className="whitespace-pre-wrap">
                      {message.content || (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Input */}
        <div className="flex-shrink-0 flex gap-2 pt-2 border-t">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your document..."
            className="min-h-[60px] resize-none text-sm"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              variant="destructive"
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={handleStop}
            >
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              size="icon"
              className="h-10 w-10 flex-shrink-0"
              onClick={handleSend}
              disabled={!input.trim()}
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}