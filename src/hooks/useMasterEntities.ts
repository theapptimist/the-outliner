import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

export type EntityVisibility = 'private' | 'workspace' | 'public';
export type EntityType = 'people' | 'places' | 'dates' | 'terms';

export interface MasterEntity {
  id: string;
  owner_id: string;
  entity_type: EntityType;
  data: {
    name?: string;
    term?: string;
    definition?: string;
    role?: string;
    description?: string;
    significance?: string;
    date?: string;
    rawText?: string;
    [key: string]: unknown;
  };
  visibility: EntityVisibility;
  created_at: string;
  updated_at: string;
}

interface UseMasterEntitiesOptions {
  entityType?: EntityType;
  includeShared?: boolean;
  includePublic?: boolean;
}

export function useMasterEntities(options: UseMasterEntitiesOptions = {}) {
  const { entityType, includeShared = false, includePublic = false } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [entities, setEntities] = useState<MasterEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch owned entities
  const fetchEntities = useCallback(async () => {
    if (!user) {
      setEntities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('entities')
        .select('*')
        .eq('owner_id', user.id);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error: fetchError } = await query.order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      const parsed = (data || []).map(row => ({
        ...row,
        entity_type: row.entity_type as EntityType,
        visibility: row.visibility as EntityVisibility,
        data: row.data as MasterEntity['data'],
      }));

      setEntities(parsed);
    } catch (err) {
      console.error('[useMasterEntities] Error fetching entities:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch entities'));
    } finally {
      setLoading(false);
    }
  }, [user, entityType]);

  // Fetch shared entities (via permissions)
  const fetchSharedEntities = useCallback(async (): Promise<MasterEntity[]> => {
    if (!user || !includeShared) return [];

    try {
      // First get entity IDs shared with this user
      const { data: permissions, error: permError } = await supabase
        .from('entity_permissions')
        .select('entity_id')
        .eq('granted_to_user_id', user.id);

      if (permError) throw permError;
      if (!permissions || permissions.length === 0) return [];

      const entityIds = permissions.map(p => p.entity_id);

      let query = supabase
        .from('entities')
        .select('*')
        .in('id', entityIds);

      if (entityType) {
        query = query.eq('entity_type', entityType);
      }

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      return (data || []).map(row => ({
        ...row,
        entity_type: row.entity_type as EntityType,
        visibility: row.visibility as EntityVisibility,
        data: row.data as MasterEntity['data'],
      }));
    } catch (err) {
      console.error('[useMasterEntities] Error fetching shared entities:', err);
      return [];
    }
  }, [user, includeShared, entityType]);

  // Create a new entity
  const createEntity = useCallback(async (
    type: EntityType,
    data: MasterEntity['data'],
    visibility: EntityVisibility = 'private'
  ): Promise<MasterEntity | null> => {
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return null;
    }

    try {
      const { data: newEntity, error: insertError } = await supabase
        .from('entities')
        .insert({
          owner_id: user.id,
          entity_type: type,
          data: data as Json,
          visibility,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      const parsed: MasterEntity = {
        ...newEntity,
        entity_type: newEntity.entity_type as EntityType,
        visibility: newEntity.visibility as EntityVisibility,
        data: newEntity.data as MasterEntity['data'],
      };

      setEntities(prev => [parsed, ...prev]);
      return parsed;
    } catch (err) {
      console.error('[useMasterEntities] Error creating entity:', err);
      toast({ title: 'Failed to create entity', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  // Update an entity
  const updateEntity = useCallback(async (
    id: string,
    updates: Partial<Pick<MasterEntity, 'data' | 'visibility'>>
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const updatePayload: { data?: Json; visibility?: EntityVisibility } = {};
      if (updates.data) updatePayload.data = updates.data as Json;
      if (updates.visibility) updatePayload.visibility = updates.visibility;

      const { error: updateError } = await supabase
        .from('entities')
        .update(updatePayload)
        .eq('id', id)
        .eq('owner_id', user.id);

      if (updateError) throw updateError;

      setEntities(prev => prev.map(e => 
        e.id === id ? { ...e, ...updates } : e
      ));

      return true;
    } catch (err) {
      console.error('[useMasterEntities] Error updating entity:', err);
      toast({ title: 'Failed to update entity', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  // Delete an entity
  const deleteEntity = useCallback(async (id: string): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: deleteError } = await supabase
        .from('entities')
        .delete()
        .eq('id', id)
        .eq('owner_id', user.id);

      if (deleteError) throw deleteError;

      setEntities(prev => prev.filter(e => e.id !== id));
      return true;
    } catch (err) {
      console.error('[useMasterEntities] Error deleting entity:', err);
      toast({ title: 'Failed to delete entity', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  useEffect(() => {
    fetchEntities();
  }, [fetchEntities]);

  return {
    entities,
    loading,
    error,
    refresh: fetchEntities,
    fetchSharedEntities,
    createEntity,
    updateEntity,
    deleteEntity,
  };
}
