import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { MasterEntity, EntityType } from './useMasterEntities';
import type { Json } from '@/integrations/supabase/types';

export type EntityStatus = 'draft' | 'pending' | 'approved' | 'rejected';

export interface PublicEntitySubmission {
  id: string;
  entity_id: string;
  submitted_by_user_id: string;
  reviewed_by_user_id: string | null;
  status: EntityStatus;
  submitted_at: string;
  reviewed_at: string | null;
  tags: string[] | null;
  category: string | null;
}

export interface PublicEntityWithData extends PublicEntitySubmission {
  entity: MasterEntity;
}

interface UsePublicEntitiesOptions {
  entityType?: EntityType;
  category?: string;
  status?: EntityStatus;
}

export function usePublicEntities(options: UsePublicEntitiesOptions = {}) {
  const { entityType, category, status = 'approved' } = options;
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [publicEntities, setPublicEntities] = useState<PublicEntityWithData[]>([]);
  const [mySubmissions, setMySubmissions] = useState<PublicEntitySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Fetch approved public entities
  const fetchPublicEntities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // First get public entity records
      let query = supabase
        .from('public_entities')
        .select('*')
        .eq('status', status);

      if (category) {
        query = query.eq('category', category);
      }

      const { data: publicRecords, error: publicError } = await query
        .order('submitted_at', { ascending: false });

      if (publicError) throw publicError;

      if (!publicRecords || publicRecords.length === 0) {
        setPublicEntities([]);
        setLoading(false);
        return;
      }

      // Get the actual entity data
      const entityIds = publicRecords.map(p => p.entity_id);
      let entitiesQuery = supabase
        .from('entities')
        .select('*')
        .in('id', entityIds);

      if (entityType) {
        entitiesQuery = entitiesQuery.eq('entity_type', entityType);
      }

      const { data: entities, error: entitiesError } = await entitiesQuery;

      if (entitiesError) throw entitiesError;

      // Merge the data
      const merged: PublicEntityWithData[] = publicRecords
        .map(pub => {
          const entity = entities?.find(e => e.id === pub.entity_id);
          if (!entity) return null;
          
          return {
            ...pub,
            status: pub.status as EntityStatus,
            entity: {
              ...entity,
              entity_type: entity.entity_type as EntityType,
              visibility: entity.visibility as MasterEntity['visibility'],
              data: entity.data as MasterEntity['data'],
              source_document_id: entity.source_document_id ?? null,
            } as MasterEntity,
          };
        })
        .filter((item): item is PublicEntityWithData => item !== null);

      setPublicEntities(merged);
    } catch (err) {
      console.error('[usePublicEntities] Error fetching public entities:', err);
      setError(err instanceof Error ? err : new Error('Failed to fetch public entities'));
    } finally {
      setLoading(false);
    }
  }, [status, category, entityType]);

  // Fetch user's own submissions
  const fetchMySubmissions = useCallback(async () => {
    if (!user) {
      setMySubmissions([]);
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('public_entities')
        .select('*')
        .eq('submitted_by_user_id', user.id)
        .order('submitted_at', { ascending: false });

      if (fetchError) throw fetchError;

      setMySubmissions((data || []).map(row => ({
        ...row,
        status: row.status as EntityStatus,
      })));
    } catch (err) {
      console.error('[usePublicEntities] Error fetching submissions:', err);
    }
  }, [user]);

  // Submit entity for public approval
  const submitForPublic = useCallback(async (
    entityId: string,
    tags?: string[],
    category?: string
  ): Promise<PublicEntitySubmission | null> => {
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return null;
    }

    try {
      // Check if already submitted
      const { data: existing } = await supabase
        .from('public_entities')
        .select('id, status')
        .eq('entity_id', entityId)
        .maybeSingle();

      if (existing) {
        toast({ 
          title: 'Already submitted', 
          description: `Status: ${existing.status}` 
        });
        return null;
      }

      const { data: submission, error: insertError } = await supabase
        .from('public_entities')
        .insert({
          entity_id: entityId,
          submitted_by_user_id: user.id,
          status: 'pending',
          tags: tags || null,
          category: category || null,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Update entity visibility to public
      await supabase
        .from('entities')
        .update({ visibility: 'public' as const })
        .eq('id', entityId)
        .eq('owner_id', user.id);

      const parsed: PublicEntitySubmission = {
        ...submission,
        status: submission.status as EntityStatus,
      };

      setMySubmissions(prev => [parsed, ...prev]);
      toast({ title: 'Submitted for review' });
      return parsed;
    } catch (err) {
      console.error('[usePublicEntities] Error submitting:', err);
      toast({ title: 'Failed to submit', variant: 'destructive' });
      return null;
    }
  }, [user, toast]);

  // Review a submission (moderator/admin only)
  const reviewSubmission = useCallback(async (
    submissionId: string,
    newStatus: 'approved' | 'rejected'
  ): Promise<boolean> => {
    if (!user) return false;

    try {
      const { error: updateError } = await supabase
        .from('public_entities')
        .update({
          status: newStatus,
          reviewed_by_user_id: user.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      if (updateError) throw updateError;

      toast({ title: `Submission ${newStatus}` });
      await fetchPublicEntities();
      return true;
    } catch (err) {
      console.error('[usePublicEntities] Error reviewing:', err);
      toast({ title: 'Failed to review', variant: 'destructive' });
      return false;
    }
  }, [user, toast, fetchPublicEntities]);

  // Import a public entity to user's library (creates a reference)
  const importToDocument = useCallback(async (
    entityId: string,
    documentId: string
  ): Promise<boolean> => {
    if (!user) {
      toast({ title: 'Not authenticated', variant: 'destructive' });
      return false;
    }

    try {
      // Check if already referenced
      const { data: existing } = await supabase
        .from('document_entity_refs')
        .select('id')
        .eq('document_id', documentId)
        .eq('entity_id', entityId)
        .maybeSingle();

      if (existing) {
        toast({ title: 'Already in document' });
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

      toast({ title: 'Added to document' });
      return true;
    } catch (err) {
      console.error('[usePublicEntities] Error importing:', err);
      toast({ title: 'Failed to import', variant: 'destructive' });
      return false;
    }
  }, [user, toast]);

  useEffect(() => {
    fetchPublicEntities();
    fetchMySubmissions();
  }, [fetchPublicEntities, fetchMySubmissions]);

  return {
    publicEntities,
    mySubmissions,
    loading,
    error,
    refresh: fetchPublicEntities,
    refreshMySubmissions: fetchMySubmissions,
    submitForPublic,
    reviewSubmission,
    importToDocument,
  };
}
