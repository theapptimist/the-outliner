import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Send, Wand2, ListPlus, FileText, RefreshCw, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { useDocumentContext } from './context/DocumentContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  generatedItems?: Array<{ label: string; depth: number }>;
}

interface SectionAIChatProps {
  sectionId: string;
  sectionLabel: string;
  sectionContent: string;
  documentContext?: string;
  onInsertContent: (items: Array<{ label: string; depth: number }>) => void;
}

const QUICK_ACTIONS = [
  { id: 'expand', label: 'Expand', icon: ListPlus, prompt: 'Expand this section with more detailed sub-items' },
  { id: 'summarize', label: 'Summarize', icon: FileText, prompt: 'Summarize the key points of this section' },
  { id: 'refine', label: 'Refine', icon: RefreshCw, prompt: 'Refine and improve the language of this section' },
];

export function SectionAIChat({
  sectionId,
  sectionLabel,
  sectionContent,
  documentContext,
  onInsertContent,
}: SectionAIChatProps) {
  const { document } = useDocumentContext();
  const documentId = document?.meta?.id || 'unknown';
  
  const [messages, setMessages] = useSessionStorage<ChatMessage[]>(
    `section-chat:${documentId}:${sectionId}`,
    []
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (userMessage: string, operation: string = 'chat') => {
    if (!userMessage.trim() && operation === 'chat') return;
    
    const messageId = crypto.randomUUID();
    const userMsg: ChatMessage = {
      id: messageId,
      role: 'user',
      content: userMessage || `[${operation}]`,
      timestamp: new Date(),
    };
    
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await supabase.functions.invoke('section-ai-chat', {
        body: {
          operation,
          sectionLabel,
          sectionContent,
          documentContext,
          userMessage,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to get AI response');
      }

      const data = response.data;
      
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || data.content || '',
        timestamp: new Date(),
        generatedItems: data.items,
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Section AI Chat error:', error);
      toast.error('Failed to get AI response. Please try again.');
      
      // Remove the user message on error
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } finally {
      setIsLoading(false);
    }
  }, [sectionLabel, sectionContent, documentContext, setMessages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, 'chat');
  };

  const handleQuickAction = (action: typeof QUICK_ACTIONS[0]) => {
    sendMessage(action.prompt, action.id);
  };

  const handleInsertItems = (items: Array<{ label: string; depth: number }>) => {
    onInsertContent(items);
    toast.success(`Inserted ${items.length} items into section`);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-[200px] max-h-[300px]">
      {/* Quick Actions */}
      <div className="flex gap-1 mb-2 flex-wrap">
        {QUICK_ACTIONS.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            size="sm"
            onClick={() => handleQuickAction(action)}
            disabled={isLoading}
            className="h-6 px-2 text-xs gap-1 bg-foreground/5 hover:bg-foreground/10"
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </Button>
        ))}
      </div>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto mb-2 space-y-2 pr-1"
      >
        {messages.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-4 italic">
            Ask AI about "{sectionLabel.slice(0, 30)}{sectionLabel.length > 30 ? '...' : ''}"
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "text-xs p-2 rounded",
                msg.role === 'user' 
                  ? "bg-primary/10 text-primary ml-4" 
                  : "bg-foreground/5 text-foreground mr-4"
              )}
            >
              <div className="whitespace-pre-wrap">{msg.content}</div>
              
              {/* Generated items with insert button */}
              {msg.generatedItems && msg.generatedItems.length > 0 && (
                <div className="mt-2 pt-2 border-t border-foreground/10">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">
                      {msg.generatedItems.length} items generated
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleInsertItems(msg.generatedItems!)}
                      className="h-5 px-2 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                    >
                      <Plus className="w-3 h-3" />
                      Insert
                    </Button>
                  </div>
                  <div className="bg-background/50 rounded p-1.5 max-h-24 overflow-y-auto">
                    {msg.generatedItems.map((item, idx) => (
                      <div 
                        key={idx} 
                        className="text-[10px] font-mono text-muted-foreground"
                        style={{ paddingLeft: `${item.depth * 12}px` }}
                      >
                        • {item.label.slice(0, 60)}{item.label.length > 60 ? '...' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
            <Loader2 className="w-3 h-3 animate-spin" />
            Thinking...
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex gap-1">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about "${sectionLabel.slice(0, 20)}..."`}
          disabled={isLoading}
          className="flex-1 min-h-[32px] h-8 py-1.5 px-2 text-xs resize-none bg-foreground/5 border-foreground/10 focus:border-primary/30"
          rows={1}
        />
        <Button
          type="submit"
          size="sm"
          disabled={isLoading || !input.trim()}
          className="h-8 w-8 p-0"
        >
          {isLoading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
        </Button>
      </form>
    </div>
  );
}
