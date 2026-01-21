import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  deleteAllEntities,
  migrateLocalToCloud,
  saveEntities,
  EntityType,
} from '@/lib/cloudEntityStorage';
import { toast } from 'sonner';

const STORAGE_PREFIX = 'outliner-session';

interface UseCloudEntitiesOptions<T> {
  documentId: string;
  entityType: EntityType;
  /**
   * The logical key (without STORAGE_PREFIX). Example: `tagged-people:${documentId}`
   */
  localStorageKey: string;
  deserialize?: (json: string) => T[];
}

function getPrefixedStorageKey(localStorageKey: string) {
  return `${STORAGE_PREFIX}:${localStorageKey}`;
}

function loadFromLocal<T>(localStorageKey: string, deserialize?: (json: string) => T[]): T[] {
  try {
    const raw = localStorage.getItem(getPrefixedStorageKey(localStorageKey));
    if (!raw) return [];
    return deserialize ? deserialize(raw) : (JSON.parse(raw) as T[]);
  } catch {
    return [];
  }
}

function saveToLocal<T>(localStorageKey: string, entities: T[]) {
  try {
    localStorage.setItem(getPrefixedStorageKey(localStorageKey), JSON.stringify(entities));
  } catch {
    // ignore
  }
}

function clearLocal(localStorageKey: string) {
  try {
    localStorage.removeItem(getPrefixedStorageKey(localStorageKey));
  } catch {
    // ignore
  }
}

/**
 * Hook for managing cloud-persisted entities with auto-save and migration.
 * Also maintains a localStorage mirror for resilience (prevents "lost tiles" if load/save fails).
 */
export function useCloudEntities<T extends { id: string }>({
  documentId,
  entityType,
  localStorageKey,
  deserialize,
}: UseCloudEntitiesOptions<T>) {
  const { user } = useAuth();
  const [entities, setEntities] = useState<T[]>(() => loadFromLocal<T>(localStorageKey, deserialize));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Track pending saves for debouncing
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingEntitiesRef = useRef<T[] | null>(null);
  const lastSavedRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Track the last loaded documentId to detect changes
  const lastDocIdRef = useRef<string | null>(null);

  // Load entities on mount and handle migration
  useEffect(() => {
    mountedRef.current = true;
    
    // Detect if this is a document switch (not initial mount)
    const isDocumentChange = lastDocIdRef.current !== null && lastDocIdRef.current !== documentId;
    lastDocIdRef.current = documentId;

    async function loadAndMigrate() {
      setLoading(true);
      setError(null);

      // If we don't have a user yet (auth still loading), show local mirror (if any)
      if (!user?.id || !documentId) {
        const local = loadFromLocal<T>(localStorageKey, deserialize);
        if (mountedRef.current) {
          setEntities(local);
        }
        setLoading(false);
        return;
      }

      try {
        // Try migration first (will skip if cloud already has data)
        const { entities: loadedEntities } = await migrateLocalToCloud<T>(
          documentId,
          entityType,
          localStorageKey,
          user.id,
          deserialize
        );

        // If switching documents and cloud is empty, DON'T fall back to local
        // (the new document genuinely has no entities)
        // Only use local fallback on initial load of same document
        const fallbackLocal = loadedEntities.length === 0 && !isDocumentChange
          ? loadFromLocal<T>(localStorageKey, deserialize)
          : loadedEntities;

        if (mountedRef.current) {
          setEntities(fallbackLocal);
          lastSavedRef.current = JSON.stringify(fallbackLocal);
        }
      } catch (e) {
        console.error(`Failed to load ${entityType} entities:`, e);
        if (mountedRef.current) {
          setError(e instanceof Error ? e : new Error('Failed to load entities'));
          // On error during document switch, start fresh; otherwise fall back to local
          setEntities(isDocumentChange ? [] : loadFromLocal<T>(localStorageKey, deserialize));
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadAndMigrate();

    return () => {
      mountedRef.current = false;
    };
  }, [documentId, entityType, localStorageKey, user?.id, deserialize]);

  // Debounced auto-save
  const saveToCloud = useCallback(async (entitiesToSave: T[]) => {
    if (!user?.id || !documentId) return;

    const currentJson = JSON.stringify(entitiesToSave);
    if (currentJson === lastSavedRef.current) return;

    try {
      const success = await saveEntities(documentId, entityType, entitiesToSave, user.id);
      if (success) {
        lastSavedRef.current = currentJson;
      } else {
        toast.error(`Failed to save ${entityType}s`);
      }
    } catch (e) {
      console.error(`Failed to save ${entityType} entities:`, e);
      toast.error(`Failed to save ${entityType}s`);
    }
  }, [documentId, entityType, user?.id]);

  // Wrapped setEntities that triggers auto-save
  const setEntitiesWithSave = useCallback((
    action: T[] | ((prev: T[]) => T[])
  ) => {
    setEntities(prev => {
      const newEntities = typeof action === 'function' ? action(prev) : action;

      // Always write-through to local mirror immediately (resilience)
      saveToLocal(localStorageKey, newEntities);

      // Schedule debounced cloud save
      pendingEntitiesRef.current = newEntities;

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        if (pendingEntitiesRef.current) {
          saveToCloud(pendingEntitiesRef.current);
          pendingEntitiesRef.current = null;
        }
      }, 1500); // 1.5 second debounce

      return newEntities;
    });
  }, [localStorageKey, saveToCloud]);

  // Clear all entities
  const clearAll = useCallback(async () => {
    clearLocal(localStorageKey);

    if (!user?.id || !documentId) {
      setEntities([]);
      lastSavedRef.current = '[]';
      return true;
    }

    try {
      const success = await deleteAllEntities(documentId, entityType);
      if (success) {
        setEntities([]);
        lastSavedRef.current = '[]';
        return true;
      }
    } catch (e) {
      console.error(`Failed to clear ${entityType} entities:`, e);
    }
    return false;
  }, [documentId, entityType, localStorageKey, user?.id]);

  // Force save now (flush pending changes)
  const flushSave = useCallback(async () => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    if (pendingEntitiesRef.current) {
      await saveToCloud(pendingEntitiesRef.current);
      pendingEntitiesRef.current = null;
    }
  }, [saveToCloud]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      // Flush pending saves on unmount (best-effort)
      if (pendingEntitiesRef.current && user?.id && documentId) {
        saveEntities(documentId, entityType, pendingEntitiesRef.current, user.id);
      }
    };
  }, [documentId, entityType, user?.id]);

  return {
    entities,
    setEntities: setEntitiesWithSave,
    loading,
    error,
    clearAll,
    flushSave,
  };
}
