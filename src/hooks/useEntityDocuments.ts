import { useState, useCallback, useRef } from 'react';
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

// Timeout for snippet fetching (15 seconds - gives more room for network latency)
const SNIPPET_FETCH_TIMEOUT_MS = 15000;

// Shorter timeout for background pre-caching (don't block too long)
const PRECACHE_TIMEOUT_MS = 8000;

// Sentinel snippet for timeout/error states
const TIMEOUT_SNIPPET: DocumentSnippet = {
  text: '⏱️ Snippet extraction timed out. Click to retry.',
};

const ERROR_SNIPPET: DocumentSnippet = {
  text: '⚠️ Could not extract snippets from this document.',
};

// Item for pre-cache queue
export interface PrecacheItem {
  documentId: string;
  input: SnippetSearchInput;
}

/**
 * Hook to fetch documents that contain references to entities from the Master Library
 * Uses the document_entity_refs junction table and source_document_id
 */
export function useEntityDocuments() {
  const [cache, setCache] = useState<Map<string, EntityDocumentInfo[]>>(new Map());
  const [loading, setLoading] = useState<Set<string>>(new Set());
  const [snippetCache, setSnippetCache] = useState<Map<string, DocumentSnippet[]>>(new Map());
  const [snippetLoading, setSnippetLoading] = useState<Set<string>>(new Set());
  
  // Track what we're pre-caching to avoid duplicates
  const precacheInProgress = useRef<Set<string>>(new Set());

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
      const t0 = performance.now();
      console.log('[snippets] Starting fetch for', documentId, input.text);
      
      // Wrap the entire operation in a timeout
      const snippets = await withTimeout(
        (async (): Promise<DocumentSnippet[]> => {
          // 1) Fetch hierarchy blocks first (usually smaller/faster)
          const t1 = performance.now();
          let hier: { hierarchy_blocks: any } | null = null;
          try {
            const { data, error: hierError } = await supabase
              .from('documents')
              .select('hierarchy_blocks')
              .eq('id', documentId)
              .single();
            hier = data;
            console.log(`[snippets] hierarchy fetch: ${Math.round(performance.now() - t1)}ms`);
            if (hierError) {
              console.error('[useEntityDocuments] Error fetching hierarchy blocks:', hierError);
            }
          } catch (fetchError) {
            console.error('[snippets] hierarchy fetch failed:', fetchError);
          }

          const result: DocumentSnippet[] = [];

          if (hier?.hierarchy_blocks) {
            const t2 = performance.now();
            try {
              const hierarchyBlocks = hier.hierarchy_blocks as Record<string, any>;
              const hierarchySnippets = findSnippetsInHierarchy(hierarchyBlocks, input);
              result.push(...hierarchySnippets);
              console.log(`[snippets] hierarchy scan: ${Math.round(performance.now() - t2)}ms, found ${hierarchySnippets.length}`);
            } catch (e) {
              console.error('[useEntityDocuments] Error scanning hierarchy:', e);
            }
          }

          // If we got at least 1 snippet from hierarchy, return early (skip content fetch)
          if (result.length > 0) {
            console.log(`[snippets] returning early with ${result.length} hierarchy snippets`);
            return result;
          }

          // 2) Only fetch + scan full editor content if we still need more
          if (result.length < 10) {
            const t3 = performance.now();
            try {
              const { data: body, error: bodyError } = await supabase
                .from('documents')
                .select('content')
                .eq('id', documentId)
                .single();
              console.log(`[snippets] content fetch: ${Math.round(performance.now() - t3)}ms`);

              if (bodyError) {
                console.error('[useEntityDocuments] Error fetching document content:', bodyError);
                return result;
              }

              if (body?.content) {
                const t4 = performance.now();
                try {
                  const contentSnippets = findSnippetsInContent(body.content, input, result.length);
                  result.push(...contentSnippets);
                  console.log(`[snippets] content scan: ${Math.round(performance.now() - t4)}ms, found ${contentSnippets.length}`);
                } catch (e) {
                  console.error('[useEntityDocuments] Error scanning content:', e);
                }
              }
            } catch (contentFetchError) {
              console.error('[snippets] content fetch failed:', contentFetchError);
            }
          }

          console.log(`[snippets] total time: ${Math.round(performance.now() - t0)}ms, total snippets: ${result.length}`);
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

  /**
   * Pre-cache snippets for multiple documents in the background.
   * Called when Master Library opens to warm the cache for instant clicks.
   * Uses a shorter timeout and doesn't block the UI.
   */
  const precacheSnippets = useCallback(async (items: PrecacheItem[]) => {
    // Filter out items already cached or in-progress
    const itemsToFetch = items.filter(item => {
      const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
      const alreadyCached = snippetCache.has(cacheKey);
      const alreadyInProgress = precacheInProgress.current.has(cacheKey);
      return !alreadyCached && !alreadyInProgress;
    });

    if (itemsToFetch.length === 0) {
      console.log('[snippets] precache: all items already cached or in-progress');
      return;
    }

    console.log(`[snippets] precache: starting ${itemsToFetch.length} items`);

    // Mark all as in-progress
    itemsToFetch.forEach(item => {
      const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
      precacheInProgress.current.add(cacheKey);
    });

    // Fetch in parallel with shorter timeout (don't block UI)
    const results = await Promise.allSettled(
      itemsToFetch.map(async (item) => {
        const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
        
        try {
          const snippets = await withTimeout(
            (async (): Promise<DocumentSnippet[]> => {
              // Only fetch hierarchy blocks for pre-cache (faster)
              const { data: hier } = await supabase
                .from('documents')
                .select('hierarchy_blocks')
                .eq('id', item.documentId)
                .single();

              if (!hier?.hierarchy_blocks) return [];
              
              const hierarchyBlocks = hier.hierarchy_blocks as Record<string, any>;
              return findSnippetsInHierarchy(hierarchyBlocks, item.input);
            })(),
            PRECACHE_TIMEOUT_MS,
            'Precache timed out'
          );

          // Update cache
          setSnippetCache(prev => new Map(prev).set(cacheKey, snippets));
          return { cacheKey, snippets };
        } catch (error) {
          // Silently fail for precache - don't pollute cache with error sentinels
          console.log(`[snippets] precache failed for ${item.documentId}:`, error);
          return { cacheKey, snippets: [] };
        } finally {
          precacheInProgress.current.delete(cacheKey);
        }
      })
    );

    const successCount = results.filter(r => r.status === 'fulfilled').length;
    console.log(`[snippets] precache: completed ${successCount}/${itemsToFetch.length}`);
  }, [snippetCache]);

  return {
    fetchDocumentsForEntity,
    fetchSnippetsForDocument,
    isLoading,
    getFromCache,
    isSnippetLoading,
    getSnippetsFromCache,
    clearSnippetCache,
    precacheSnippets,
  };
}
