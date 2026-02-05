import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DocumentSnippet,
  EntityType,
  SnippetSearchInput,
  findSnippetsInHierarchy,
  findSnippetsInContent,
  withTimeout,
} from '@/lib/snippetExtractor';

// Re-export types for backwards compatibility
export type { DocumentSnippet, EntityType, SnippetSearchInput };

export interface EntityDocumentInfo {
  id: string;
  title: string;
}

// Timeout for snippet fetching (10 seconds)
const SNIPPET_FETCH_TIMEOUT_MS = 10000;

// Sentinel snippet for timeout/error states
const TIMEOUT_SNIPPET: DocumentSnippet = {
  text: '⏱️ Snippet extraction timed out. Click to retry.',
};

const ERROR_SNIPPET: DocumentSnippet = {
  text: '⚠️ Could not extract snippets from this document.',
};

/**
 * Hook to fetch documents that contain references to entities from the Master Library
 * Uses the document_entity_refs junction table and source_document_id
 */
export function useEntityDocuments() {
  const [cache, setCache] = useState<Map<string, EntityDocumentInfo[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [snippetCache, setSnippetCache] = useState<Map<string, DocumentSnippet[]>>(new Map());
  const [snippetLoading, setSnippetLoading] = useState<Set<string>>(new Set());

  const fetchDocumentsForEntity = useCallback(async (
    entityId: string,
    sourceDocumentId?: string | null
  ): Promise<EntityDocumentInfo[]> => {
    // Check cache first
    if (cache.has(entityId)) {
      return cache.get(entityId) || [];
    }

    // Mark as loading
    setLoading(prev => new Set(prev).add(entityId));

    try {
      const documentIds = new Set<string>();

      // Add source document if exists
      if (sourceDocumentId) {
        documentIds.add(sourceDocumentId);
      }

      // Fetch from document_entity_refs
      const { data: refs, error: refsError } = await supabase
        .from('document_entity_refs')
        .select('document_id')
        .eq('entity_id', entityId);

      if (!refsError && refs) {
        refs.forEach(ref => documentIds.add(ref.document_id));
      }

      if (documentIds.size === 0) {
        setCache(prev => new Map(prev).set(entityId, []));
        return [];
      }

      // Fetch document titles
      const { data: docs, error: docsError } = await supabase
        .from('documents')
        .select('id, title')
        .in('id', Array.from(documentIds));

      if (docsError) {
        console.error('[useEntityDocuments] Error fetching documents:', docsError);
        return [];
      }

      const result: EntityDocumentInfo[] = (docs || []).map(doc => ({
        id: doc.id,
        title: doc.title,
      }));

      // Update cache
      setCache(prev => new Map(prev).set(entityId, result));
      return result;
    } finally {
      setLoading(prev => {
        const next = new Set(prev);
        next.delete(entityId);
        return next;
      });
    }
  }, [cache]);

  const fetchSnippetsForDocument = useCallback(async (
    documentId: string,
    input: SnippetSearchInput
  ): Promise<DocumentSnippet[]> => {
    const cacheKey = `${documentId}:${input.entityType}:${input.text}`;
    
    // Check cache first
    if (snippetCache.has(cacheKey)) {
      return snippetCache.get(cacheKey) || [];
    }

    // Mark as loading
    setSnippetLoading(prev => new Set(prev).add(cacheKey));

    try {
      // Wrap the entire operation in a timeout
      const snippets = await withTimeout(
        (async (): Promise<DocumentSnippet[]> => {
          // 1) Fetch + scan hierarchy blocks first (usually smaller/faster)
          const { data: hier, error: hierError } = await supabase
            .from('documents')
            .select('hierarchy_blocks')
            .eq('id', documentId)
            .single();

          if (hierError) {
            console.error('[useEntityDocuments] Error fetching hierarchy blocks:', hierError);
          }

          const result: DocumentSnippet[] = [];

          if (hier?.hierarchy_blocks) {
            try {
              const hierarchyBlocks = hier.hierarchy_blocks as Record<string, any>;
              const hierarchySnippets = findSnippetsInHierarchy(hierarchyBlocks, input);
              result.push(...hierarchySnippets);
            } catch (e) {
              console.error('[useEntityDocuments] Error scanning hierarchy:', e);
            }
          }

          // 2) Only fetch + scan full editor content if we still need more
          if (result.length < 10) {
            const { data: body, error: bodyError } = await supabase
              .from('documents')
              .select('content')
              .eq('id', documentId)
              .single();

            if (bodyError) {
              console.error('[useEntityDocuments] Error fetching document content:', bodyError);
              return result;
            }

            if (body?.content) {
              try {
                const contentSnippets = findSnippetsInContent(body.content, input, result.length);
                result.push(...contentSnippets);
              } catch (e) {
                console.error('[useEntityDocuments] Error scanning content:', e);
              }
            }
          }

          return result;
        })(),
        SNIPPET_FETCH_TIMEOUT_MS,
        'Snippet extraction timed out'
      );

      // Update cache
      setSnippetCache(prev => new Map(prev).set(cacheKey, snippets));
      return snippets;
      
    } catch (error) {
      console.error('[useEntityDocuments] Snippet fetch error:', error);
      
      // Determine the appropriate error snippet
      const isTimeout = error instanceof Error && error.message.includes('timed out');
      const errorResult = [isTimeout ? TIMEOUT_SNIPPET : ERROR_SNIPPET];
      
      // Cache the error result so clicking again will show the error
      // (user can clear cache by closing and reopening the dialog)
      setSnippetCache(prev => new Map(prev).set(cacheKey, errorResult));
      return errorResult;
      
    } finally {
      // ALWAYS clear loading state
      setSnippetLoading(prev => {
        const next = new Set(prev);
        next.delete(cacheKey);
        return next;
      });
    }
  }, [snippetCache]);

  const isLoading = useCallback((entityId: string) => loading.has(entityId), [loading]);
  const getFromCache = useCallback((entityId: string) => cache.get(entityId), [cache]);
  
  const isSnippetLoading = useCallback((documentId: string, input: SnippetSearchInput | string) => {
    const key = typeof input === 'string' 
      ? `${documentId}:${input}` 
      : `${documentId}:${input.entityType}:${input.text}`;
    return snippetLoading.has(key);
  }, [snippetLoading]);
  
  const getSnippetsFromCache = useCallback((documentId: string, input: SnippetSearchInput | string) => {
    const key = typeof input === 'string' 
      ? `${documentId}:${input}` 
      : `${documentId}:${input.entityType}:${input.text}`;
    return snippetCache.get(key);
  }, [snippetCache]);

  // Method to clear snippet cache for retry
  const clearSnippetCache = useCallback((documentId: string, input: SnippetSearchInput) => {
    const cacheKey = `${documentId}:${input.entityType}:${input.text}`;
    setSnippetCache(prev => {
      const next = new Map(prev);
      next.delete(cacheKey);
      return next;
    });
  }, []);

  return {
    fetchDocumentsForEntity,
    fetchSnippetsForDocument,
    isLoading,
    getFromCache,
    isSnippetLoading,
    getSnippetsFromCache,
    clearSnippetCache,
  };
}
