import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  DocumentSnippet,
  EntityType,
  SnippetSearchInput,
  findSnippetsInHierarchy,
  findSnippetsInContent,
} from '@/lib/snippetExtractor';
import {
  abortableFetchRow,
  abortableFetchRows,
  FetchErrorType,
} from '@/lib/abortableFetch';

// Re-export types for backwards compatibility
export type { DocumentSnippet, EntityType, SnippetSearchInput };

export interface EntityDocumentInfo {
  id: string;
  title: string;
}

// Timeout for snippet fetching (15 seconds)
const SNIPPET_FETCH_TIMEOUT_MS = 15000;

// Sentinel snippets for different error states
const TIMEOUT_SNIPPET: DocumentSnippet = {
  text: '⏱️ Request timed out. Click to retry.',
};

const NETWORK_ERROR_SNIPPET: DocumentSnippet = {
  text: '🌐 Network error. Check your connection and retry.',
};

const NOT_FOUND_SNIPPET: DocumentSnippet = {
  text: '📄 Document not found or not accessible.',
};

const UNAUTHORIZED_SNIPPET: DocumentSnippet = {
  text: '🔒 Access denied. You may not have permission to view this document.',
};

const GENERIC_ERROR_SNIPPET: DocumentSnippet = {
  text: '⚠️ Could not load snippets. Click to retry.',
};

// Map error types to sentinel snippets
function getErrorSnippet(errorType: FetchErrorType): DocumentSnippet {
  switch (errorType) {
    case 'timeout':
      return TIMEOUT_SNIPPET;
    case 'network':
      return NETWORK_ERROR_SNIPPET;
    case 'not_found':
      return NOT_FOUND_SNIPPET;
    case 'unauthorized':
      return UNAUTHORIZED_SNIPPET;
    case 'aborted':
      return TIMEOUT_SNIPPET; // Treat cancelled as timeout for UI
    default:
      return GENERIC_ERROR_SNIPPET;
  }
}

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
  const [precaching, setPrecaching] = useState(false);
  
  // Track what we're pre-caching to avoid duplicates
  const precacheInProgress = useRef<Set<string>>(new Set());
  // Track active abort controllers for cleanup
  const activeControllers = useRef<Map<string, AbortController>>(new Map());

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

    // Cancel any existing request for this key
    const existingController = activeControllers.current.get(cacheKey);
    if (existingController) {
      console.log(`[snippets] Aborting existing request for ${cacheKey}`);
      existingController.abort();
    }

    // Create new controller for this request
    const controller = new AbortController();
    activeControllers.current.set(cacheKey, controller);

    // Mark as loading
    setSnippetLoading(prev => new Set(prev).add(cacheKey));

    const t0 = performance.now();
    console.log('[snippets] Starting fetch for', documentId, input.text);

    try {
      // 1) Fetch hierarchy blocks first (usually smaller/faster)
      const t1 = performance.now();
      console.log('[snippets] Fetching hierarchy_blocks...');
      
      const hierResult = await abortableFetchRow<{ hierarchy_blocks: any }>(
        'documents',
        'hierarchy_blocks',
        { id: `eq.${documentId}` },
        { timeoutMs: SNIPPET_FETCH_TIMEOUT_MS, signal: controller.signal }
      );

      console.log(`[snippets] hierarchy fetch: ${Math.round(performance.now() - t1)}ms, error=${hierResult.error}`);

      if (hierResult.error) {
        const errorSnippet = getErrorSnippet(hierResult.error);
        console.log(`[snippets] hierarchy fetch failed: ${hierResult.error} - ${hierResult.errorMessage}`);
        setSnippetCache(prev => new Map(prev).set(cacheKey, [errorSnippet]));
        return [errorSnippet];
      }

      const result: DocumentSnippet[] = [];

      if (hierResult.data?.hierarchy_blocks) {
        const t2 = performance.now();
        try {
          const hierarchyBlocks = hierResult.data.hierarchy_blocks as Record<string, any>;
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
        setSnippetCache(prev => new Map(prev).set(cacheKey, result));
        return result;
      }

      // 2) Only fetch + scan full editor content if we still need more
      if (result.length < 10) {
        const t3 = performance.now();
        console.log('[snippets] Fetching content (fallback)...');
        
        const contentResult = await abortableFetchRow<{ content: any }>(
          'documents',
          'content',
          { id: `eq.${documentId}` },
          { timeoutMs: SNIPPET_FETCH_TIMEOUT_MS, signal: controller.signal }
        );
        
        console.log(`[snippets] content fetch: ${Math.round(performance.now() - t3)}ms, error=${contentResult.error}`);

        if (contentResult.error) {
          // Already have some hierarchy snippets, don't fail completely
          if (result.length > 0) {
            console.log('[snippets] content fetch failed but have hierarchy snippets, returning those');
          } else {
            const errorSnippet = getErrorSnippet(contentResult.error);
            setSnippetCache(prev => new Map(prev).set(cacheKey, [errorSnippet]));
            return [errorSnippet];
          }
        } else if (contentResult.data?.content) {
          const t4 = performance.now();
          try {
            const contentSnippets = findSnippetsInContent(contentResult.data.content, input, result.length);
            result.push(...contentSnippets);
            console.log(`[snippets] content scan: ${Math.round(performance.now() - t4)}ms, found ${contentSnippets.length}`);
          } catch (e) {
            console.error('[useEntityDocuments] Error scanning content:', e);
          }
        }
      }

      console.log(`[snippets] total time: ${Math.round(performance.now() - t0)}ms, total snippets: ${result.length}`);
      
      // Update cache
      setSnippetCache(prev => new Map(prev).set(cacheKey, result));
      return result;
      
    } catch (error) {
      console.error('[useEntityDocuments] Unexpected snippet fetch error:', error);
      
      // Should not normally reach here since abortableFetchRow handles errors
      const errorResult = [GENERIC_ERROR_SNIPPET];
      setSnippetCache(prev => new Map(prev).set(cacheKey, errorResult));
      return errorResult;
      
    } finally {
      // Clean up controller reference
      activeControllers.current.delete(cacheKey);
      
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
    
    // Also abort any in-progress request for this key
    const existingController = activeControllers.current.get(cacheKey);
    if (existingController) {
      console.log(`[snippets] Aborting request during cache clear for ${cacheKey}`);
      existingController.abort();
      activeControllers.current.delete(cacheKey);
    }
    
    setSnippetCache(prev => {
      const next = new Map(prev);
      next.delete(cacheKey);
      return next;
    });
  }, []);

  /**
   * Pre-cache snippets for multiple documents in a SINGLE batch query.
   * This dramatically reduces network round-trips which are the bottleneck.
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
      console.log('[snippets] precache: all items already cached');
      return;
    }

    const documentIds = [...new Set(itemsToFetch.map(item => item.documentId))];
    console.log(`[snippets] precache: batch fetching ${documentIds.length} documents for ${itemsToFetch.length} items`);

    // Mark all as in-progress and set precaching state
    setPrecaching(true);
    itemsToFetch.forEach(item => {
      const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
      precacheInProgress.current.add(cacheKey);
    });

    try {
      const t0 = performance.now();

      // SINGLE batch query with abortable fetch
      const batchResult = await abortableFetchRows<{ id: string; hierarchy_blocks: any }>(
        'documents',
        'id,hierarchy_blocks',
        { column: 'id', values: documentIds },
        { timeoutMs: SNIPPET_FETCH_TIMEOUT_MS }
      );

      console.log(`[snippets] precache batch fetch: ${Math.round(performance.now() - t0)}ms for ${documentIds.length} docs`);

      if (batchResult.error) {
        console.error('[snippets] precache batch fetch error:', batchResult.error, batchResult.errorMessage);
        // Cache error sentinels so clicking doesn't trigger another long wait
        const errorSnippet = getErrorSnippet(batchResult.error);
        setSnippetCache(prev => {
          const next = new Map(prev);
          itemsToFetch.forEach(item => {
            const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
            next.set(cacheKey, [errorSnippet]);
          });
          return next;
        });
        return;
      }

      // Build a map of documentId -> hierarchy_blocks
      const docMap = new Map<string, Record<string, any>>();
      (batchResult.data || []).forEach(doc => {
        if (doc.hierarchy_blocks) {
          docMap.set(doc.id, doc.hierarchy_blocks as Record<string, any>);
        }
      });

      // Now scan each item locally (CPU, no network)
      const t1 = performance.now();
      for (const item of itemsToFetch) {
        const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
        const hierarchyBlocks = docMap.get(item.documentId);

        let snippets: DocumentSnippet[] = [];
        if (hierarchyBlocks) {
          snippets = findSnippetsInHierarchy(hierarchyBlocks, item.input);
        }

        setSnippetCache(prev => new Map(prev).set(cacheKey, snippets));
        precacheInProgress.current.delete(cacheKey);
      }
      console.log(`[snippets] precache scan: ${Math.round(performance.now() - t1)}ms for ${itemsToFetch.length} items`);

    } catch (error) {
      console.error('[snippets] precache unexpected error:', error);
      // Cache generic error sentinels
      setSnippetCache(prev => {
        const next = new Map(prev);
        itemsToFetch.forEach(item => {
          const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
          next.set(cacheKey, [GENERIC_ERROR_SNIPPET]);
        });
        return next;
      });
    } finally {
      // Always clear in-progress flags + UI state so the indicator can't get stuck
      itemsToFetch.forEach(item => {
        const cacheKey = `${item.documentId}:${item.input.entityType}:${item.input.text}`;
        precacheInProgress.current.delete(cacheKey);
      });
      setPrecaching(false);
    }
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
    isPrecaching: precaching,
  };
}
