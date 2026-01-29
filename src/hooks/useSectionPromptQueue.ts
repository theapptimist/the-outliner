import { useCallback, useMemo } from 'react';

interface QueuedPrompt {
  prompt: string;
  queuedAt: string;
}

const QUEUE_KEY_PREFIX = 'section-prompt-queue';

/**
 * Hook for managing queued AI prompts per section.
 * Prompts are stored in sessionStorage and persist until the tab closes.
 */
export function useSectionPromptQueue(documentId: string) {
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

  const setQueuedPrompt = useCallback((sectionId: string, prompt: string) => {
    try {
      const key = buildKey(sectionId);
      const data: QueuedPrompt = {
        prompt,
        queuedAt: new Date().toISOString(),
      };
      sessionStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to queue prompt:', e);
    }
  }, [buildKey]);

  const clearQueuedPrompt = useCallback((sectionId: string) => {
    try {
      const key = buildKey(sectionId);
      sessionStorage.removeItem(key);
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
        setQueuedPrompt(sectionId, prompt);
      }
    }
  }, [documentId, setQueuedPrompt]);

  return useMemo(() => ({
    getQueuedPrompt,
    setQueuedPrompt,
    clearQueuedPrompt,
    hasQueuedPrompt,
    queueMultiplePrompts,
  }), [getQueuedPrompt, setQueuedPrompt, clearQueuedPrompt, hasQueuedPrompt, queueMultiplePrompts]);
}
