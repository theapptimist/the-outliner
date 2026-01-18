import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  loadEntities, 
  saveEntities, 
  deleteAllEntities,
  migrateLocalToCloud,
  EntityType 
} from '@/lib/cloudEntityStorage';
import { toast } from 'sonner';

interface UseCloudEntitiesOptions<T> {
  documentId: string;
  entityType: EntityType;
  localStorageKey: string;
  deserialize?: (json: string) => T[];
}

/**
 * Hook for managing cloud-persisted entities with auto-save and migration
 */
export function useCloudEntities<T extends { id: string }>({
  documentId,
  entityType,
  localStorageKey,
  deserialize,
}: UseCloudEntitiesOptions<T>) {
  const { user } = useAuth();
  const [entities, setEntities] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  // Track pending saves for debouncing
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pendingEntitiesRef = useRef<T[] | null>(null);
  const lastSavedRef = useRef<string>('');
  const mountedRef = useRef(true);

  // Load entities on mount and handle migration
  useEffect(() => {
    mountedRef.current = true;
    
    async function loadAndMigrate() {
      if (!user?.id || !documentId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // Try migration first (will skip if cloud already has data)
        const { entities: loadedEntities } = await migrateLocalToCloud<T>(
          documentId,
          entityType,
          localStorageKey,
          user.id,
          deserialize
        );

        if (mountedRef.current) {
          setEntities(loadedEntities);
          lastSavedRef.current = JSON.stringify(loadedEntities);
        }
      } catch (e) {
        console.error(`Failed to load ${entityType} entities:`, e);
        if (mountedRef.current) {
          setError(e instanceof Error ? e : new Error('Failed to load entities'));
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
      
      // Schedule debounced save
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
  }, [saveToCloud]);

  // Clear all entities
  const clearAll = useCallback(async () => {
    if (!user?.id || !documentId) return false;

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
  }, [documentId, entityType, user?.id]);

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
      // Flush pending saves on unmount
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
