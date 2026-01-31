import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Send, ListPlus, FileText, RefreshCw, Plus, ClipboardList, Sparkles, History, MessageSquare, Square } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSessionStorage } from '@/hooks/useSessionStorage';
import { useDocumentContext } from './context/DocumentContext';
import { useSectionPromptQueue } from '@/hooks/useSectionPromptQueue';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DocumentPlanDialog, SectionPrompt } from './DocumentPlanDialog';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';

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
  /** Callback to programmatically open multiple section panels (for Auto-Write cascade) */
  onOpenSectionPanels?: (sectionIds: string[]) => void;
  /** Whether the panel is in fullscreen mode */
  isFullscreen?: boolean;
}

// Actions for Prompt tab (outline generation focused)
const PROMPT_ACTIONS = [
  { id: 'expand', label: 'Expand', icon: ListPlus, prompt: 'Expand this section with more detailed sub-items' },
  { id: 'summarize', label: 'Summarize', icon: FileText, prompt: 'Summarize the key points of this section' },
];

// Actions for Chat tab (refinement focused)
const CHAT_ACTIONS = [
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
  onOpenSectionPanels,
  isFullscreen = false,
}: SectionAIChatProps) {
  const { document } = useDocumentContext();
  const documentId = document?.meta?.id || 'unknown';
  
  const [messages, setMessages] = useSessionStorage<ChatMessage[]>(
    `section-chat:${documentId}:${sectionId}`,
    []
  );
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Tab state for Prompt/Chat views
  const [activeTab, setActiveTab] = useState<'prompt' | 'chat'>('chat');

  // Document plan dialog state
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [generatedPlan, setGeneratedPlan] = useState<SectionPrompt[]>([]);

  // Prompt queue management
  const promptQueue = useSectionPromptQueue(documentId);
  const [queuedPrompt, setQueuedPrompt] = useState<string | null>(null);

  // Auto-write progress state
  const [autoWriteProgress, setAutoWriteProgress] = useState<{ current: number; total: number; currentSection: string } | null>(null);

  // Track if we've already auto-executed to prevent re-triggering
  const hasAutoExecutedRef = useRef(false);

  // Load queued prompt on component mount (handles panel reopen)
  useEffect(() => {
    const queuedData = promptQueue.getQueuedPromptData(sectionId);
    if (queuedData?.prompt) {
      setQueuedPrompt(queuedData.prompt);
      setInput(queuedData.prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run on mount only - ensures prompt reloads when panel reopens

  // Also reload when sectionId changes (handles switching sections)
  useEffect(() => {
    const queuedData = promptQueue.getQueuedPromptData(sectionId);
    if (queuedData?.prompt) {
      setQueuedPrompt(queuedData.prompt);
      setInput(queuedData.prompt);
    } else {
      setQueuedPrompt(null);
    }
  }, [sectionId, promptQueue]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async (userMessage: string, operation: string = 'chat', autoInsert: boolean = false) => {
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

    // Create abort controller for this request
    abortControllerRef.current = new AbortController();

    // Clear queued prompt if we're sending it
    if (queuedPrompt && userMessage === queuedPrompt) {
      promptQueue.clearQueuedPrompt(sectionId);
      setQueuedPrompt(null);
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/section-ai-chat`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            operation,
            sectionLabel,
            sectionContent,
            documentContext,
            userMessage,
          }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        throw new Error('Failed to get AI response');
      }

      const data = await response.json();
      
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: data.message || data.content || '',
        timestamp: new Date(),
        generatedItems: data.items,
      };
      
      setMessages(prev => [...prev, assistantMsg]);
      
      // Auto-insert generated items (for multi-window cascade)
      if (autoInsert && data?.items && Array.isArray(data.items) && data.items.length > 0) {
        onInsertContent(data.items);
        toast.success(`Inserted ${data.items.length} items into "${sectionLabel.slice(0, 20)}..."`);
      }
    } catch (error) {
      // Don't show error toast if request was aborted
      if (error instanceof Error && error.name === 'AbortError') {
        toast.info('AI generation stopped');
        return;
      }
      
      console.error('Section AI Chat error:', error);
      toast.error('Failed to get AI response. Please try again.');
      
      // Remove the user message on error
      setMessages(prev => prev.filter(m => m.id !== messageId));
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, [sectionLabel, sectionContent, documentContext, setMessages, queuedPrompt, promptQueue, sectionId, onInsertContent]);

  const handleStop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Auto-execute when panel opens with queued auto-execute prompt
  // This creates the "True Multi-Window" cascade effect
  useEffect(() => {
    if (hasAutoExecutedRef.current) return;
    
    const queuedData = promptQueue.getQueuedPromptData(sectionId);
    if (queuedData?.autoExecute && queuedData.prompt) {
      hasAutoExecutedRef.current = true;
      
      // Clear the autoExecute flag to prevent re-triggering
      promptQueue.clearAutoExecuteFlag(sectionId);
      
      // Stagger execution based on executionIndex to create a visible wave effect
      const delay = (queuedData.executionIndex || 0) * 300;
      
      setTimeout(() => {
        // Auto-send the message with 'expand' operation AND auto-insert the results
        sendMessage(queuedData.prompt, 'expand', true);
      }, delay);
    }
  }, [sectionId, promptQueue, sendMessage]);

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
    
    if (autoExecute && onOpenSectionPanels) {
      // TRUE MULTI-WINDOW CASCADE: Queue prompts with autoExecute flag
      // Then open all section panels - each will independently execute its prompt
      
      // CRITICAL: Wait for React to commit state updates from section creation
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Queue all prompts with autoExecute flag - each panel will auto-trigger
      promptQueue.queueMultiplePromptsWithAutoExecute(
        allPromptsToQueue.map(p => ({ sectionId: p.sectionId, prompt: p.prompt }))
      );
      
      // Open ALL section panels at once - creates a visible cascade effect
      onOpenSectionPanels(allPromptsToQueue.map(p => p.sectionId));
      
      toast.info(`Opening ${allPromptsToQueue.length} AI windows for auto-write...`);
    } else if (autoExecute && onInsertSectionContent) {
      // Fallback: old sequential mode if onOpenSectionPanels not available
      await new Promise(resolve => setTimeout(resolve, 150));
      
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
          const response = await supabase.functions.invoke('section-ai-chat', {
            body: {
              operation: 'expand',
              sectionLabel: sectionTitle,
              sectionContent: '',
              documentContext,
              userMessage: prompt,
            },
          });
          
          if (response.error) {
            console.error(`Error generating content for ${sectionTitle}:`, response.error);
            continue;
          }
          
          const data = response.data;
          
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
        
        // Open all section panels that have queued prompts
        const sectionIdsToOpen = allPromptsToQueue.map(p => p.sectionId);
        if (onOpenSectionPanels && sectionIdsToOpen.length > 0) {
          onOpenSectionPanels(sectionIdsToOpen);
        }
      }
      
      const newCount = createdSectionPrompts.length;
      const totalCount = allPromptsToQueue.length;
      
      if (newCount > 0) {
        toast.success(`Created ${newCount} sections and queued ${totalCount} prompts`);
      } else {
        toast.success(`Queued ${totalCount} prompts for sections`);
      }
    }
  }, [promptQueue, onCreateSection, onUpdateSectionLabel, onInsertSectionContent, onOpenSectionPanels, allSections, documentContext]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input, 'chat');
  };

  const handleQuickAction = (action: { id: string; label: string; prompt: string }) => {
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

  // Extract prompt history from user messages
  const promptHistory = useMemo(() => {
    return messages
      .filter(m => m.role === 'user')
      .reverse() // Most recent first
      .map(m => ({
        id: m.id,
        content: m.content,
        timestamp: m.timestamp,
      }));
  }, [messages]);

  const handleUsePrompt = (prompt: string) => {
    setInput(prompt);
    setActiveTab('chat');
    textareaRef.current?.focus();
  };

  return (
    <div className={cn(
      "flex flex-col h-full",
      isFullscreen ? "min-h-0 max-h-full" : "min-h-[200px] max-h-[350px]"
    )}>
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

      {/* Tab Header */}
      <div className="flex items-center gap-1 mb-2 border-b border-foreground/10 pb-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab('prompt')}
          className={cn(
            "h-6 px-2 text-xs gap-1.5",
            activeTab === 'prompt' 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Sparkles className="w-3 h-3" />
          Prompt
          {queuedPrompt && (
            <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
          )}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setActiveTab('chat')}
          className={cn(
            "h-6 px-2 text-xs gap-1.5",
            activeTab === 'chat' 
              ? "bg-primary/10 text-primary" 
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MessageSquare className="w-3 h-3" />
          Chat
          {messages.length > 0 && (
            <span className="text-[10px] text-muted-foreground">({messages.length})</span>
          )}
        </Button>
      </div>

      {/* Tab Content */}
      {activeTab === 'prompt' ? (
        /* Prompt Tab */
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Quick Actions for Prompt Tab */}
          <div className="flex gap-1 mb-2 flex-wrap">
            {PROMPT_ACTIONS.map((action) => (
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
            
            {/* Plan Section button - for non-first sections */}
            {!isFirstSection && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => sendMessage('Plan the structure and sub-sections for this section. Suggest key points to cover and how to organize them.', 'plan-section')}
                disabled={isLoading}
                className="h-6 px-2 text-xs gap-1 bg-primary/10 hover:bg-primary/20 text-primary"
              >
                <ClipboardList className="w-3 h-3" />
                Plan Section
              </Button>
            )}
          </div>

          {/* Current Queued Prompt */}
          {queuedPrompt && (
            <div className="mb-3 p-3 rounded-lg border border-primary/30 bg-primary/5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-medium text-primary uppercase tracking-wide">
                  Current Prompt
                </span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleUsePrompt(queuedPrompt)}
                    className="h-5 px-2 text-[10px] text-primary hover:bg-primary/20"
                  >
                    Use
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      promptQueue.clearQueuedPrompt(sectionId);
                      setQueuedPrompt(null);
                      setInput('');
                    }}
                    className="h-5 px-2 text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    Clear
                  </Button>
                </div>
              </div>
              <div className="text-xs text-foreground whitespace-pre-wrap max-h-20 overflow-y-auto">
                {queuedPrompt}
              </div>
            </div>
          )}

          {/* Prompt History */}
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center gap-1.5 mb-2">
              <History className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                History
              </span>
            </div>
            
            {promptHistory.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4 italic">
                No prompts sent yet
              </div>
            ) : (
              <ScrollArea className="flex-1">
                <div className="space-y-1.5 pr-2">
                  {promptHistory.map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => handleUsePrompt(prompt.content)}
                      className="w-full text-left p-2 rounded bg-foreground/5 hover:bg-foreground/10 transition-colors group"
                    >
                      <div className="text-xs text-foreground line-clamp-2">
                        {prompt.content}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1 flex items-center justify-between">
                        <span>
                          {new Date(prompt.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <span className="opacity-0 group-hover:opacity-100 text-primary transition-opacity">
                          Click to use
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>
        </div>
      ) : (
        /* Chat Tab */
        <>
          {/* Quick Actions for Chat Tab */}
          <div className="flex gap-1 mb-2 flex-wrap">
            {CHAT_ACTIONS.map((action) => (
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

          {/* Messages */}
          <div 
            ref={scrollRef}
            className="flex-1 overflow-y-auto mb-2 space-y-2 pr-1 min-h-0"
          >
            {messages.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-2 italic">
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
        </>
      )}

      {/* Input - Always visible */}
      <form onSubmit={handleSubmit} className="flex gap-1 items-end mt-auto">
        <Textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Ask about "${sectionLabel.slice(0, 20)}..."`}
          disabled={isLoading}
          className="flex-1 min-h-[80px] max-h-[160px] py-2 px-3 text-sm resize-y bg-foreground/5 border-foreground/10 focus:border-primary/30"
          rows={4}
        />
        {isLoading ? (
          <Button
            type="button"
            size="icon"
            variant="destructive"
            onClick={handleStop}
            className="h-6 w-6 p-0 shrink-0"
            title="Stop generation"
          >
            <Square className="w-2.5 h-2.5 fill-current" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim()}
            className="h-6 w-6 p-0 shrink-0"
          >
            <Send className="w-3 h-3" />
          </Button>
        )}
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
