import { useCallback, useEffect, useMemo, useState } from 'react';

export interface GenerationOptions {
  includeCitations: boolean;
  historicalDetail: boolean;
  outputFormat: 'outline' | 'prose';
  closePanelsAfterGeneration: boolean;
}

interface QueuedPrompt {
  prompt: string;
  queuedAt: string;
  autoExecute?: boolean;  // triggers immediate execution when panel opens
  executionIndex?: number; // For staggered execution ordering
  generationOptions?: GenerationOptions; // AI generation options
}

const QUEUE_KEY_PREFIX = 'section-prompt-queue';

// Simple event emitter for prompt queue changes
const listeners = new Set<() => void>();
const notifyListeners = () => {
  listeners.forEach(fn => fn());
};

/**
 * Hook for managing queued AI prompts per section.
 * Prompts are stored in sessionStorage and persist until the tab closes.
 */
export function useSectionPromptQueue(documentId: string) {
  // Version counter to trigger re-renders when queue changes
  const [version, setVersion] = useState(0);
  
  // Subscribe to changes from other components
  useEffect(() => {
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const buildKey = useCallback((sectionId: string) => {
    return `${QUEUE_KEY_PREFIX}:${documentId}:${sectionId}`;
  }, [documentId]);

  const getQueuedPrompt = useCallback((sectionId: string): string | null => {
    try {
      const key = buildKey(sectionId);
      const stored = sessionStorage.getItem(key);
      if (!stored) return null;
      
      const parsed: QueuedPrompt = JSON.parse(stored);
      return parsed.prompt || null;
    } catch {
      return null;
    }
  }, [buildKey]);

  /**
   * Get the full queued prompt data including autoExecute flag
   */
  const getQueuedPromptData = useCallback((sectionId: string): QueuedPrompt | null => {
    try {
      const key = buildKey(sectionId);
      const stored = sessionStorage.getItem(key);
      if (!stored) return null;
      
      return JSON.parse(stored) as QueuedPrompt;
    } catch {
      return null;
    }
  }, [buildKey]);

  const setQueuedPrompt = useCallback((sectionId: string, prompt: string) => {
    try {
      const key = buildKey(sectionId);
      const data: QueuedPrompt = {
        prompt,
        queuedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(key, JSON.stringify(data));
      notifyListeners();
    } catch (e) {
      console.warn('Failed to queue prompt:', e);
    }
  }, [buildKey]);

  const clearQueuedPrompt = useCallback((sectionId: string) => {
    try {
      const key = buildKey(sectionId);
      sessionStorage.removeItem(key);
      notifyListeners();
    } catch {
      // Ignore errors
    }
  }, [buildKey]);

  /**
   * Clear only the autoExecute flag, keeping the prompt for display
   */
  const clearAutoExecuteFlag = useCallback((sectionId: string) => {
    try {
      const key = buildKey(sectionId);
      const stored = sessionStorage.getItem(key);
      if (!stored) return;
      
      const parsed: QueuedPrompt = JSON.parse(stored);
      if (parsed.autoExecute) {
        parsed.autoExecute = false;
        sessionStorage.setItem(key, JSON.stringify(parsed));
        notifyListeners();
      }
    } catch {
      // Ignore errors
    }
  }, [buildKey]);

  const hasQueuedPrompt = useCallback((sectionId: string): boolean => {
    return getQueuedPrompt(sectionId) !== null;
  }, [getQueuedPrompt]);

  /**
   * Queue multiple prompts at once (for document planning).
   * Optionally clears existing queued prompts first.
   */
  const queueMultiplePrompts = useCallback((
    prompts: Array<{ sectionId: string; prompt: string }>,
    clearExisting: boolean = true
  ) => {
    if (clearExisting) {
      // Clear all existing prompts for this document
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(`${QUEUE_KEY_PREFIX}:${documentId}:`)) {
          sessionStorage.removeItem(key);
        }
      }
    }

    // Queue new prompts
    for (const { sectionId, prompt } of prompts) {
      if (prompt.trim()) {
        const key = buildKey(sectionId);
        const data: QueuedPrompt = {
          prompt,
          queuedAt: new Date().toISOString(),
        };
        sessionStorage.setItem(key, JSON.stringify(data));
      }
    }
    
    // Notify all listeners at once
    notifyListeners();
  }, [documentId, buildKey]);

  /**
   * Queue multiple prompts with autoExecute flag enabled.
   * Used for Auto-Write mode where panels auto-execute their prompts on open.
   */
  const queueMultiplePromptsWithAutoExecute = useCallback((
    prompts: Array<{ sectionId: string; prompt: string }>,
    options?: GenerationOptions,
    clearExisting: boolean = true
  ) => {
    if (clearExisting) {
      // Clear all existing prompts for this document
      for (let i = sessionStorage.length - 1; i >= 0; i--) {
        const key = sessionStorage.key(i);
        if (key?.startsWith(`${QUEUE_KEY_PREFIX}:${documentId}:`)) {
          sessionStorage.removeItem(key);
        }
      }
    }

    // Queue new prompts with autoExecute flag and execution index for staggering
    prompts.forEach(({ sectionId, prompt }, index) => {
      if (prompt.trim()) {
        const key = buildKey(sectionId);
        const data: QueuedPrompt = {
          prompt,
          queuedAt: new Date().toISOString(),
          autoExecute: true,
          executionIndex: index,
          generationOptions: options,
        };
        sessionStorage.setItem(key, JSON.stringify(data));
      }
    });
    
    // Notify all listeners at once
    notifyListeners();
  }, [documentId, buildKey]);

  // Include version in the dependency to ensure consumers re-render
  return useMemo(() => ({
    getQueuedPrompt,
    getQueuedPromptData,
    setQueuedPrompt,
    clearQueuedPrompt,
    clearAutoExecuteFlag,
    hasQueuedPrompt,
    queueMultiplePrompts,
    queueMultiplePromptsWithAutoExecute,
    _version: version, // Hidden prop to ensure reactivity
  }), [getQueuedPrompt, getQueuedPromptData, setQueuedPrompt, clearQueuedPrompt, clearAutoExecuteFlag, hasQueuedPrompt, queueMultiplePrompts, queueMultiplePromptsWithAutoExecute, version]);
}
