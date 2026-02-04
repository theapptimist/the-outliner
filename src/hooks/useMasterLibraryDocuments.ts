import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface DocumentWithEntityCount {
  id: string;
  title: string;
  entityCount: number;
}

/**
 * Hook to fetch documents that have entities in the Master Library
 */
export function useMasterLibraryDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentWithEntityCount[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDocuments = useCallback(async () => {
    if (!user) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      // Get all entities with source_document_id for this user
      const { data: entities, error: entitiesError } = await supabase
        .from('entities')
        .select('source_document_id')
        .eq('owner_id', user.id)
        .not('source_document_id', 'is', null);

      if (entitiesError) throw entitiesError;

      // Count entities per document
      const countMap = new Map<string, number>();
      (entities || []).forEach(e => {
        if (e.source_document_id) {
          countMap.set(e.source_document_id, (countMap.get(e.source_document_id) || 0) + 1);
        }
      });

      if (countMap.size === 0) {
        setDocuments([]);
        setLoading(false);
        return;
      }

      // Fetch document titles
      const docIds = Array.from(countMap.keys());
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', docIds);

      if (docsError) throw docsError;

      // Merge with counts
      const result: DocumentWithEntityCount[] = (docs || [])
        .map(doc => ({
          id: doc.id,
          title: doc.title,
          entityCount: countMap.get(doc.id) || 0,
        }))
        .sort((a, b) => b.entityCount - a.entityCount);

      setDocuments(result);
    } catch (err) {
      console.error('[useMasterLibraryDocuments] Error:', err);
      setDocuments([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDocuments();
  }, [fetchDocuments]);

  return { documents, loading, refresh: fetchDocuments };
}
