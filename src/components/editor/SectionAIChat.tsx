import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ListPlus, FileText, RefreshCw, Plus, ClipboardList, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { useDocumentContext } from './context/DocumentContext';
import { useSectionPromptQueue } from '@/hooks/useSectionPromptQueue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DocumentPlanDialog, SectionPrompt } from './DocumentPlanDialog';
import { Progress } from '@/components/ui/progress';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  generatedItems?: Array<{ label: string; depth: number }>;
}

interface SectionInfo {
  id: string;
  title: string;
}

interface SectionAIChatProps {
  sectionId: string;
  sectionLabel: string;
  sectionContent: string;
  documentContext?: string;
  onInsertContent: (items: Array<{ label: string; depth: number }>) => void;
  /** Whether this is the first section (enables "Plan Doc" feature) */
  isFirstSection?: boolean;
  /** All sections in the document (for document planning) */
  allSections?: SectionInfo[];
  /** Callback to create a new depth-0 section after a given node, returns the new section's ID */
  onCreateSection?: (title: string, afterId?: string | null) => string | undefined;
  /** Callback to update an existing section's label */
  onUpdateSectionLabel?: (sectionId: string, newLabel: string) => void;
  /** Callback to insert AI-generated content into a specific section */
  onInsertSectionContent?: (sectionId: string, items: Array<{ label: string; depth: number }>) => void;
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
  isFirstSection = false,
  allSections = [],
  onCreateSection,
  onUpdateSectionLabel,
  onInsertSectionContent,
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

  // Document plan dialog state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<SectionPrompt[]>([]);

  // Prompt queue management
  const promptQueue = useSectionPromptQueue(documentId);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

  // Auto-write progress state
  const [autoWriteProgress, setAutoWriteProgress] = useState<{ current: number; total: number; currentSection: string } | null>(null);

  // Check for queued prompt on mount and when sectionId changes
  useEffect(() => {
    const queued = promptQueue.getQueuedPrompt(sectionId);
    if (queued) {
      setQueuedPrompt(queued);
      setInput(queued);
    }
  }, [sectionId, promptQueue]);

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

    // Clear queued prompt if we're sending it
    if (queuedPrompt && userMessage === queuedPrompt) {
      promptQueue.clearQueuedPrompt(sectionId);
      setQueuedPrompt(null);
    }

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
  }, [sectionLabel, sectionContent, documentContext, setMessages, queuedPrompt, promptQueue, sectionId]);

  const handlePlanDocument = useCallback(async () => {
    if (allSections.length === 0 && !input.trim()) {
      toast.error('Please describe your document topic in the input field first.');
      return;
    }

    setIsLoading(true);
    
    try {
      const response = await supabase.functions.invoke('section-ai-chat', {
        body: {
          operation: 'plan-document',
          sectionLabel,
          sectionContent,
          documentContext,
          userMessage: input || 'Generate a document structure for this topic.',
          sectionList: allSections,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Failed to generate document plan');
      }

      const data = response.data;
      
      // Handle "new sections" response (AI is creating new sections)
      if (data.newSections && Array.isArray(data.newSections)) {
        const planPrompts: SectionPrompt[] = data.newSections.map((ns: { title: string; prompt: string; isNew: boolean }) => ({
          sectionId: null, // Will be assigned when section is created
          sectionTitle: ns.title,
          prompt: ns.prompt,
          enabled: true,
          isNew: true,
        }));
        
        // Add AI message about the plan FIRST (before opening dialog)
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message || `Generated ${planPrompts.length} new sections. Review them and click approve to create them.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        
        // Then set dialog state (in a microtask to ensure messages state is committed)
        setTimeout(() => {
          setGeneratedPlan(planPrompts);
          setPlanDialogOpen(true);
        }, 0);
      }
      // Handle "existing sections" response (AI is generating prompts for existing sections)
      else if (data.sectionPrompts && Array.isArray(data.sectionPrompts)) {
        const planPrompts: SectionPrompt[] = data.sectionPrompts.map((sp: { sectionId: string; sectionTitle: string; prompt: string; isNew?: boolean }) => ({
          sectionId: sp.sectionId,
          sectionTitle: sp.sectionTitle,
          prompt: sp.prompt,
          enabled: true,
          isNew: false,
        }));
        
        // Add AI message about the plan FIRST
        const assistantMsg: ChatMessage = {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.message || `Generated ${planPrompts.length} section prompts. Click "Review & Edit" to customize them.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMsg]);
        
        // Then set dialog state
        setTimeout(() => {
          setGeneratedPlan(planPrompts);
          setPlanDialogOpen(true);
        }, 0);
      } else {
        toast.error('Failed to parse document plan');
      }
    } catch (error) {
      console.error('Document planning error:', error);
      toast.error('Failed to generate document plan. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [allSections, sectionLabel, sectionContent, documentContext, input, setMessages]);

  const handleApproveplan = useCallback(async (prompts: SectionPrompt[], autoExecute: boolean) => {
    const newSections = prompts.filter(p => p.isNew && p.enabled && p.prompt.trim());
    const existingSections = prompts.filter(p => !p.isNew && p.enabled && p.prompt.trim());
    
    // Phase 1: Handle sections - create/update them first
    const createdSectionPrompts: Array<{ sectionId: string; sectionTitle: string; prompt: string }> = [];
    
    // Check if the first section (where Plan Doc was triggered) is empty
    const firstSection = allSections.length > 0 ? allSections[0] : null;
    const isFirstSectionEmpty = firstSection && (!firstSection.title || firstSection.title.trim() === '');
    
    let insertAfterId: string | null = firstSection?.id || null;
    let sectionsToCreate = newSections;
    
    // If first section is empty and we have new sections, UPDATE section 1 with the first generated section
    if (isFirstSectionEmpty && newSections.length > 0 && firstSection) {
      const firstNewSection = newSections[0];
      
      // Update section 1's label instead of creating a new section
      if (onUpdateSectionLabel) {
        onUpdateSectionLabel(firstSection.id, firstNewSection.sectionTitle);
      }
      
      // Track the prompt for section 1
      createdSectionPrompts.push({ sectionId: firstSection.id, sectionTitle: firstNewSection.sectionTitle, prompt: firstNewSection.prompt });
      
      // Skip the first section since we updated section 1
      sectionsToCreate = newSections.slice(1);
    }
    
    // Create remaining new sections after section 1
    for (const section of sectionsToCreate) {
      if (onCreateSection) {
        const newId = onCreateSection(section.sectionTitle, insertAfterId);
        if (newId) {
          createdSectionPrompts.push({ sectionId: newId, sectionTitle: section.sectionTitle, prompt: section.prompt });
          // Next section should be inserted after THIS one
          insertAfterId = newId;
        }
      }
    }
    
    // Phase 2: Build complete list of prompts (new + existing)
    const allPromptsToQueue = [
      ...createdSectionPrompts,
      ...existingSections.map(p => ({ sectionId: p.sectionId!, sectionTitle: p.sectionTitle, prompt: p.prompt })),
    ];
    
    setPlanDialogOpen(false);
    
    if (autoExecute && onInsertSectionContent) {
      // CRITICAL: Wait for React to commit state updates from section creation
      // This ensures the tree has the new sections before we try to insert content
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Auto-execute mode: run prompts sequentially and insert content
      setAutoWriteProgress({ current: 0, total: allPromptsToQueue.length, currentSection: '' });
      
      let successCount = 0;
      
      for (let i = 0; i < allPromptsToQueue.length; i++) {
        const { sectionId: targetSectionId, sectionTitle, prompt } = allPromptsToQueue[i];
        
        setAutoWriteProgress({ 
          current: i, 
          total: allPromptsToQueue.length, 
          currentSection: sectionTitle 
        });
        
        try {
          // Call the AI to generate content for this section
          const response = await supabase.functions.invoke('section-ai-chat', {
            body: {
              operation: 'expand',
              sectionLabel: sectionTitle,
              sectionContent: '', // Empty - we're generating initial content
              documentContext,
              userMessage: prompt,
            },
          });
          
          if (response.error) {
            console.error(`Error generating content for ${sectionTitle}:`, response.error);
            continue;
          }
          
          const data = response.data;
          
          // Insert the generated items into the section
          if (data?.items && Array.isArray(data.items) && data.items.length > 0) {
            onInsertSectionContent(targetSectionId, data.items);
            successCount++;
          }
        } catch (error) {
          console.error(`Error processing section ${sectionTitle}:`, error);
        }
      }
      
      setAutoWriteProgress(null);
      
      if (successCount > 0) {
        toast.success(`Generated content for ${successCount} section${successCount !== 1 ? 's' : ''}`);
      } else {
        toast.error('Failed to generate content. Please try again.');
      }
    } else {
      // Queue-only mode: queue prompts for manual execution
      if (allPromptsToQueue.length > 0) {
        promptQueue.queueMultiplePrompts(allPromptsToQueue.map(p => ({ sectionId: p.sectionId, prompt: p.prompt })));
      }
      
      const newCount = createdSectionPrompts.length;
      const totalCount = allPromptsToQueue.length;
      
      if (newCount > 0) {
        toast.success(`Created ${newCount} sections and queued ${totalCount} prompts`);
      } else {
        toast.success(`Queued ${totalCount} prompts for sections`);
      }
    }
  }, [promptQueue, onCreateSection, onUpdateSectionLabel, onInsertSectionContent, allSections, documentContext]);

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
      {/* Auto-Write Progress Indicator */}
      {autoWriteProgress && (
        <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <div className="flex-1">
              <div className="text-xs font-medium text-foreground">
                Writing document...
              </div>
              <div className="text-[10px] text-muted-foreground">
                Section {autoWriteProgress.current + 1} of {autoWriteProgress.total}: {autoWriteProgress.currentSection.slice(0, 40)}{autoWriteProgress.currentSection.length > 40 ? '...' : ''}
              </div>
            </div>
          </div>
          <Progress 
            value={((autoWriteProgress.current) / autoWriteProgress.total) * 100} 
            className="h-1.5"
          />
        </div>
      )}

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
        
        {/* Plan Doc button - only for first section */}
        {isFirstSection && allSections.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePlanDocument}
            disabled={isLoading}
            className="h-6 px-2 text-xs gap-1 bg-primary/10 hover:bg-primary/20 text-primary"
          >
            <ClipboardList className="w-3 h-3" />
            Plan Doc
          </Button>
        )}
      </div>

      {/* Queued prompt indicator */}
      {queuedPrompt && (
        <div className="mb-2 px-2 py-1 rounded bg-primary/10 border border-primary/20 flex items-center gap-2">
          <Sparkles className="w-3 h-3 text-primary" />
          <span className="text-[10px] text-primary flex-1 truncate">
            Queued prompt ready
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              promptQueue.clearQueuedPrompt(sectionId);
              setQueuedPrompt(null);
              setInput('');
            }}
            className="h-4 px-1 text-[10px] text-muted-foreground hover:text-foreground"
          >
            Clear
          </Button>
        </div>
      )}

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

      {/* Document Plan Dialog */}
      <DocumentPlanDialog
        open={planDialogOpen}
        onOpenChange={setPlanDialogOpen}
        sectionPrompts={generatedPlan}
        onApprove={handleApproveplan}
        onCancel={() => setPlanDialogOpen(false)}
      />
    </div>
  );
}
