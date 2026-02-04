import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { MasterEntity, EntityType } from './useMasterEntities';

export interface DocumentEntityRef {
  id: string;
  document_id: string;
  entity_id: string;
  user_id: string;
  created_at: string;
}

export interface DocumentEntityWithData extends DocumentEntityRef {
  entity: MasterEntity;
}

interface UseDocumentEntityRefsOptions {
  documentId: string;
  entityType?: EntityType;
}

export function useDocumentEntityRefs(options: UseDocumentEntityRefsOptions) {
  const { documentId, entityType } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [refs, setRefs] = useState<DocumentEntityWithData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch entity references for a document
  const fetchRefs = useCallback(async () => {
    if (!user || !documentId) {
      setRefs([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Get references
      const { data: refData, error: refError } = await supabase
        .from('document_entity_refs')
        .select('*')
        .eq('document_id', documentId)
        .eq('user_id', user.id);

      if (refError) throw refError;

      if (!refData || refData.length === 0) {
        setRefs([]);
        setLoading(false);
        return;
      }

      // Get entity data for all refs
      const entityIds = refData.map(r => r.entity_id);
      let entitiesQuery = supabase
        .from('entities')
        .select('*')
        .in('id', entityIds);

      if (entityType) {
        entitiesQuery = entitiesQuery.eq('entity_type', entityType);
      }

      const { data: entities, error: entitiesError } = await entitiesQuery;

      if (entitiesError) throw entitiesError;

      // Merge refs with entity data
      const merged: DocumentEntityWithData[] = refData
        .map(ref => {
          const entity = entities?.find(e => e.id === ref.entity_id);
          if (!entity) return null;
          
          // Filter by entity type if specified
          if (entityType && entity.entity_type !== entityType) return null;
          
          return {
            ...ref,
            entity: {
              ...entity,
              entity_type: entity.entity_type as EntityType,
              visibility: entity.visibility as MasterEntity['visibility'],
              data: entity.data as MasterEntity['data'],
              source_document_id: entity.source_document_id ?? null,
            } as MasterEntity,
          };
        })
        .filter((item): item is DocumentEntityWithData => item !== null);

      setRefs(merged);
    } catch (err) {
      console.error('[useDocumentEntityRefs] Error fetching refs:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch entity refs'));
    } finally {
      setLoading(false);
    }
  }, [user, documentId, entityType]);

  // Add a reference to an entity
  const addRef = useCallback(async (entityId: string): Promise<boolean> => {
    if (!user || !documentId) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return false;
    }

    try {
      // Check if already exists
      const { data: existing } = await supabase
        .from('document_entity_refs')
        .select('id')
        .eq('document_id', documentId)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (existing) {
        toast({ title: 'Entity already in document' });
        return false;
      }

      const { error: insertError } = await supabase
        .from('document_entity_refs')
        .insert({
          document_id: documentId,
          entity_id: entityId,
          user_id: user.id,
        });

      if (insertError) throw insertError;

      // Refresh to get the full data
      await fetchRefs();
      return true;
    } catch (err) {
      console.error('[useDocumentEntityRefs] Error adding ref:', err);
      toast({ title: 'Failed to add entity', variant: 'destructive' });
      return false;
    }
  }, [user, documentId, toast, fetchRefs]);

  // Remove a reference
  const removeRef = useCallback(async (refId: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: deleteError } = await supabase
        .from('document_entity_refs')
        .delete()
        .eq('id', refId)
        .eq('user_id', user.id);

      if (deleteError) throw deleteError;

      setRefs(prev => prev.filter(r => r.id !== refId));
      return true;
    } catch (err) {
      console.error('[useDocumentEntityRefs] Error removing ref:', err);
      toast({ title: 'Failed to remove entity', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  useEffect(() => {
    fetchRefs();
  }, [fetchRefs]);

  return {
    refs,
    loading,
    error,
    refresh: fetchRefs,
    addRef,
    removeRef,
  };
}
