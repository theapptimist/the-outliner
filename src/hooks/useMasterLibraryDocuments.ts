import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DocumentWithEntityCount {
  id: string;
  title: string;
  entityCount: number;
  folder_id: string | null;
}

/**
 * Hook to fetch documents that have entities in the Master Library
 * Uses LIGHTWEIGHT query (no content/hierarchy_blocks) for fast loading
 */
export function useMasterLibraryDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithEntityCount[]>([]);
  const [loading, setLoading] = useState(true);

  // Fetch documents - supports AbortSignal for cancellation
  const fetchDocuments = useCallback(async (signal?: AbortSignal) => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    const flowId = `lib-docs-hook-${Date.now()}`;
    console.log(`[useMasterLibraryDocuments:${flowId}] Starting fetch`);
    const startTime = performance.now();

    setLoading(true);

    try {
      // Get all entities with source_document_id for this user
      let entitiesQuery = supabase
        .from('entities')
        .select('source_document_id')
        .eq('owner_id', user.id)
        .not('source_document_id', 'is', null);

      if (signal) {
        entitiesQuery = entitiesQuery.abortSignal(signal);
      }

      const { data: entities, error: entitiesError } = await entitiesQuery;

      // Don't update state if request was aborted - but always clear loading
      if (signal?.aborted) {
        console.log(`[useMasterLibraryDocuments:${flowId}] Aborted during entities fetch`);
        setLoading(false);
        return;
      }

      if (entitiesError) throw entitiesError;

      // Count entities per document
      const countMap = new Map<string, number>();
      (entities || []).forEach(e => {
        if (e.source_document_id) {
          countMap.set(e.source_document_id, (countMap.get(e.source_document_id) || 0) + 1);
        }
      });

      if (countMap.size === 0) {
        console.log(`[useMasterLibraryDocuments:${flowId}] No documents with entities`);
        setDocuments([]);
        setLoading(false);
        return;
      }

      // Fetch document titles - LIGHTWEIGHT, no content/hierarchy_blocks
      const docIds = Array.from(countMap.keys());
      let docsQuery = supabase
        .from('documents')
        .select('id, title, folder_id')
        .in('id', docIds);

      if (signal) {
        docsQuery = docsQuery.abortSignal(signal);
      }

      const { data: docs, error: docsError } = await docsQuery;

      // Don't update state if request was aborted - but always clear loading
      if (signal?.aborted) {
        console.log(`[useMasterLibraryDocuments:${flowId}] Aborted during docs fetch`);
        setLoading(false);
        return;
      }

      if (docsError) throw docsError;

      const duration = Math.round(performance.now() - startTime);
      console.log(`[useMasterLibraryDocuments:${flowId}] Completed in ${duration}ms, ${docs?.length || 0} docs`);

      // Merge with counts - no empty filtering needed since these docs have entities
      const result: DocumentWithEntityCount[] = (docs || [])
        .map(doc => ({
          id: doc.id,
          title: doc.title,
          entityCount: countMap.get(doc.id) || 0,
          folder_id: doc.folder_id,
        }))
        .sort((a, b) => b.entityCount - a.entityCount);

      setDocuments(result);
    } catch (err) {
      // Always clear loading, even on error
      console.error('[useMasterLibraryDocuments] Error:', err);
      setDocuments([]);
    } finally {
      // ALWAYS clear loading - prevents stuck spinners
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, refresh: fetchDocuments };
}
