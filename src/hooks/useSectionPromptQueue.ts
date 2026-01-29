import { useCallback, useMemo, useState } from 'react';

interface QueuedPrompt {
  prompt: string;
  queuedAt: string;
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
  useState(() => {
    const listener = () => setVersion(v => v + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  });

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

  // Include version in the dependency to ensure consumers re-render
  return useMemo(() => ({
    getQueuedPrompt,
    setQueuedPrompt,
    clearQueuedPrompt,
    hasQueuedPrompt,
    queueMultiplePrompts,
    _version: version, // Hidden prop to ensure reactivity
  }), [getQueuedPrompt, setQueuedPrompt, clearQueuedPrompt, hasQueuedPrompt, queueMultiplePrompts, version]);
}
