import { useState, useEffect, useCallback } from 'react';
import { getEntityRelationships, EntityRelationship } from '@/lib/cloudEntityRelationshipStorage';

interface RelationshipCounts {
  [entityId: string]: number;
}

/**
 * Hook to load relationship counts for a list of entity IDs
 */
export function useEntityRelationshipCounts(entityIds: string[]) {
  const [counts, setCounts] = useState<RelationshipCounts>({});
  const [loading, setLoading] = useState(false);

  const loadCounts = useCallback(async () => {
    if (entityIds.length === 0) {
      setCounts({});
      return;
    }

    setLoading(true);
    try {
      const results: RelationshipCounts = {};
      
      // Load relationships for each entity in parallel
      await Promise.all(
        entityIds.map(async (id) => {
          const relationships = await getEntityRelationships(id);
          results[id] = relationships.length;
        })
      );

      setCounts(results);
    } catch (error) {
      console.error('Failed to load relationship counts:', error);
    } finally {
      setLoading(false);
    }
  }, [entityIds.join(',')]); // Use joined string to compare arrays

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const refresh = useCallback(() => {
    loadCounts();
  }, [loadCounts]);

  return { counts, loading, refresh };
}

/**
 * Hook to load full relationships for a single entity
 */
export function useEntityRelationships(entityId: string | null) {
  const [relationships, setRelationships] = useState<EntityRelationship[]>([]);
  const [loading, setLoading] = useState(false);

  const loadRelationships = useCallback(async () => {
    if (!entityId) {
      setRelationships([]);
      return;
    }

    setLoading(true);
    try {
      const data = await getEntityRelationships(entityId);
      setRelationships(data);
    } catch (error) {
      console.error('Failed to load relationships:', error);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    loadRelationships();
  }, [loadRelationships]);

  const refresh = useCallback(() => {
    loadRelationships();
  }, [loadRelationships]);

  return { relationships, loading, refresh };
}
