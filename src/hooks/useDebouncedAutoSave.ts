import { useRef, useEffect, useCallback } from 'react';
import { DocumentState } from '@/types/document';
import { saveCloudDocument } from '@/lib/cloudDocumentStorage';

interface UseDebouncedAutoSaveOptions {
  document: DocumentState | null;
  userId: string | undefined;
  enabled?: boolean;
  delayMs?: number;
  onSaveStart?: () => void;
  onSaveComplete?: () => void;
  onSaveError?: (error: Error) => void;
}

/**
 * Hook for debounced auto-saving of documents.
 * Saves are debounced to prevent excessive API calls during rapid edits.
 */
export function useDebouncedAutoSave({
  document,
  userId,
  enabled = true,
  delayMs = 3000, // 3 second debounce
  onSaveStart,
  onSaveComplete,
  onSaveError,
}: UseDebouncedAutoSaveOptions) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDocRef = useRef<DocumentState | null>(null);
  const isSavingRef = useRef(false);
  const lastSavedJsonRef = useRef<string>('');

  // Track the document for pending saves
  useEffect(() => {
    if (!enabled || !document || !userId) return;

    const currentJson = JSON.stringify({
      content: document.content,
      hierarchyBlocks: document.hierarchyBlocks,
      meta: { title: document.meta.title, isMaster: document.meta.isMaster },
    });

    // Skip if nothing changed
    if (currentJson === lastSavedJsonRef.current) return;

    pendingDocRef.current = document;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Schedule save
    timeoutRef.current = setTimeout(async () => {
      const docToSave = pendingDocRef.current;
      if (!docToSave || isSavingRef.current) return;

      isSavingRef.current = true;
      onSaveStart?.();

      try {
        await saveCloudDocument(docToSave, userId);
        lastSavedJsonRef.current = currentJson;
        onSaveComplete?.();
      } catch (e) {
        console.error('[AutoSave] Failed:', e);
        onSaveError?.(e instanceof Error ? e : new Error('Auto-save failed'));
      } finally {
        isSavingRef.current = false;
        pendingDocRef.current = null;
      }
    }, delayMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [document, userId, enabled, delayMs, onSaveStart, onSaveComplete, onSaveError]);

  // Flush pending saves immediately (e.g., before navigation)
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    const docToSave = pendingDocRef.current;
    if (!docToSave || !userId || isSavingRef.current) return;

    isSavingRef.current = true;
    try {
      await saveCloudDocument(docToSave, userId);
      pendingDocRef.current = null;
    } catch (e) {
      console.error('[AutoSave] Flush failed:', e);
    } finally {
      isSavingRef.current = false;
    }
  }, [userId]);

  // Cancel pending saves
  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    pendingDocRef.current = null;
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      // Best-effort save on unmount
      const docToSave = pendingDocRef.current;
      if (docToSave && userId) {
        saveCloudDocument(docToSave, userId).catch(() => {});
      }
    };
  }, [userId]);

  return { flush, cancel, isSaving: isSavingRef.current };
}
