import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { normalizeEntityName } from '@/lib/entityNameUtils';

export interface EntityDocumentInfo {
  id: string;
  title: string;
}

export interface DocumentSnippet {
  text: string;
  nodeLabel?: string;
  blockId?: string;
  nodeId?: string;
}

export type EntityType = 'people' | 'places' | 'dates' | 'terms';

export interface SnippetSearchInput {
  entityType: EntityType;
  text: string;
}

// Max snippets to return per search to keep UI usable
const MAX_SNIPPETS_PER_DOCUMENT = 10;
const MAX_SNIPPETS_PER_NODE = 2;

// Extract plain text from TipTap JSON content
function extractPlainText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) {
    return content.content.map(extractPlainText).join(' ');
  }
  return '';
}

// Escape special regex characters
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Create a matcher based on entity type:
 * - terms: word-boundary regex (case-insensitive)
 * - dates: simple substring match
 * - people/places: normalized matching
 */
function createMatcher(input: SnippetSearchInput): (text: string) => { index: number; length: number }[] {
  const { entityType, text: searchText } = input;
  
  console.log('[createMatcher] Creating matcher', { entityType, searchText });
  
  if (entityType === 'terms') {
    // Word-boundary regex like TermHighlightPlugin
    const regex = new RegExp(`\\b${escapeRegex(searchText)}\\b`, 'gi');
    return (text: string) => {
      const matches: { index: number; length: number }[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push({ index: match.index, length: match[0].length });
      }
      regex.lastIndex = 0; // Reset for next call
      return matches;
    };
  }
  
  if (entityType === 'dates') {
    // Simple substring match (dates may have various formats)
    const searchLower = searchText.toLowerCase();
    return (text: string) => {
      const matches: { index: number; length: number }[] = [];
      const textLower = text.toLowerCase();
      let idx = 0;
      while ((idx = textLower.indexOf(searchLower, idx)) !== -1) {
        matches.push({ index: idx, length: searchText.length });
        idx += 1;
      }
      return matches;
    };
  }
  
  // people/places: normalized matching - simpler approach
  // Use case-insensitive substring search as fallback if normalized fails
  const normalizedSearch = normalizeEntityName(searchText).toLowerCase();
  const searchLower = searchText.toLowerCase();
  
  return (text: string) => {
    const matches: { index: number; length: number }[] = [];
    const textLower = text.toLowerCase();
    
    // Try direct substring match first (most common case)
    let idx = 0;
    while ((idx = textLower.indexOf(searchLower, idx)) !== -1) {
      matches.push({ index: idx, length: searchText.length });
      idx += 1;
    }
    
    // If no direct match, try normalized matching
    if (matches.length === 0 && normalizedSearch !== searchLower) {
      const normalizedText = normalizeEntityName(text).toLowerCase();
      let searchStart = 0;
      while (true) {
        const normalizedIndex = normalizedText.indexOf(normalizedSearch, searchStart);
        if (normalizedIndex === -1) break;
        
        // For normalized matches, use approximate position
        matches.push({ index: normalizedIndex, length: normalizedSearch.length });
        searchStart = normalizedIndex + 1;
      }
    }
    
    return matches;
  };
}

// Find snippets containing a search term in hierarchy blocks
function findSnippetsInHierarchy(
  hierarchyBlocks: Record<string, any>,
  input: SnippetSearchInput
): DocumentSnippet[] {
  const snippets: DocumentSnippet[] = [];
  const matcher = createMatcher(input);
  const nodeSnippetCounts = new Map<string, number>();

  function scanNode(node: any, blockId: string) {
    const nodeKey = `${blockId}:${node.id}`;
    const currentCount = nodeSnippetCounts.get(nodeKey) || 0;
    
    if (currentCount >= MAX_SNIPPETS_PER_NODE) {
      // Skip this node, but still check children
      if (Array.isArray(node.children)) {
        node.children.forEach((child: any) => scanNode(child, blockId));
      }
      return;
    }
    
    // Check label
    if (node.label) {
      const matches = matcher(node.label);
      for (const match of matches) {
        if (snippets.length >= MAX_SNIPPETS_PER_DOCUMENT) return;
        if ((nodeSnippetCounts.get(nodeKey) || 0) >= MAX_SNIPPETS_PER_NODE) break;
        
        const start = Math.max(0, match.index - 40);
        const end = Math.min(node.label.length, match.index + match.length + 40);
        let snippet = node.label.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < node.label.length) snippet = snippet + '...';
        
        snippets.push({
          text: snippet,
          nodeLabel: node.label.substring(0, 50),
          blockId,
          nodeId: node.id,
        });
        nodeSnippetCounts.set(nodeKey, (nodeSnippetCounts.get(nodeKey) || 0) + 1);
      }
    }

    // Check content
    if (node.content) {
      const plainText = extractPlainText(node.content);
      const matches = matcher(plainText);
      for (const match of matches) {
        if (snippets.length >= MAX_SNIPPETS_PER_DOCUMENT) return;
        if ((nodeSnippetCounts.get(nodeKey) || 0) >= MAX_SNIPPETS_PER_NODE) break;
        
        const start = Math.max(0, match.index - 40);
        const end = Math.min(plainText.length, match.index + match.length + 40);
        let snippet = plainText.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < plainText.length) snippet = snippet + '...';
        
        snippets.push({
          text: snippet,
          nodeLabel: node.label?.substring(0, 50),
          blockId,
          nodeId: node.id,
        });
        nodeSnippetCounts.set(nodeKey, (nodeSnippetCounts.get(nodeKey) || 0) + 1);
      }
    }

    // Recurse into children
    if (Array.isArray(node.children)) {
      node.children.forEach((child: any) => scanNode(child, blockId));
    }
  }

  Object.entries(hierarchyBlocks).forEach(([blockId, block]) => {
    if (snippets.length >= MAX_SNIPPETS_PER_DOCUMENT) return;
    const tree = (block as any)?.tree;
    if (Array.isArray(tree)) {
      tree.forEach(node => scanNode(node, blockId));
    }
  });

  return snippets;
}

// Find snippets in TipTap content
function findSnippetsInContent(content: any, input: SnippetSearchInput): DocumentSnippet[] {
  const snippets: DocumentSnippet[] = [];
  const matcher = createMatcher(input);
  const plainText = extractPlainText(content);
  const matches = matcher(plainText);
  
  for (const match of matches) {
    if (snippets.length >= MAX_SNIPPETS_PER_DOCUMENT) break;
    
    const start = Math.max(0, match.index - 40);
    const end = Math.min(plainText.length, match.index + match.length + 40);
    let snippet = plainText.substring(start, end);
    if (start > 0) snippet = '...' + snippet;
    if (end < plainText.length) snippet = snippet + '...';
    
    snippets.push({ text: snippet });
  }

  return snippets;
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
    
    console.log('[useEntityDocuments] fetchSnippetsForDocument', { documentId, input, cacheKey });
    
    // Check cache first
    if (snippetCache.has(cacheKey)) {
      const cached = snippetCache.get(cacheKey) || [];
      console.log('[useEntityDocuments] Returning from cache:', cached.length, 'snippets');
      return cached;
    }

    // Mark as loading
    setSnippetLoading(prev => new Set(prev).add(cacheKey));

    try {
      // Fetch document content
      const { data: doc, error } = await supabase
        .from('documents')
        .select('content, hierarchy_blocks')
        .eq('id', documentId)
        .single();

      if (error || !doc) {
        console.error('[useEntityDocuments] Error fetching document:', error);
        return [];
      }

      console.log('[useEntityDocuments] Document fetched', { 
        hasContent: !!doc.content, 
        hasHierarchyBlocks: !!doc.hierarchy_blocks,
        hierarchyBlockKeys: doc.hierarchy_blocks ? Object.keys(doc.hierarchy_blocks as object) : []
      });

      const snippets: DocumentSnippet[] = [];

      // Find snippets in hierarchy blocks
      if (doc.hierarchy_blocks) {
        const hierarchyBlocks = doc.hierarchy_blocks as Record<string, any>;
        const hierarchySnippets = findSnippetsInHierarchy(hierarchyBlocks, input);
        console.log('[useEntityDocuments] Found', hierarchySnippets.length, 'snippets in hierarchy');
        snippets.push(...hierarchySnippets);
      }

      // Find snippets in content (cap total at MAX_SNIPPETS_PER_DOCUMENT)
      if (doc.content && snippets.length < MAX_SNIPPETS_PER_DOCUMENT) {
        const contentSnippets = findSnippetsInContent(doc.content, input);
        console.log('[useEntityDocuments] Found', contentSnippets.length, 'snippets in content');
        const remaining = MAX_SNIPPETS_PER_DOCUMENT - snippets.length;
        snippets.push(...contentSnippets.slice(0, remaining));
      }

      console.log('[useEntityDocuments] Total snippets:', snippets.length);

      // Update cache
      setSnippetCache(prev => new Map(prev).set(cacheKey, snippets));
      return snippets;
    } finally {
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
    const key = typeof input === 'string' ? `${documentId}:${input}` : `${documentId}:${input.entityType}:${input.text}`;
    return snippetLoading.has(key);
  }, [snippetLoading]);
  const getSnippetsFromCache = useCallback((documentId: string, input: SnippetSearchInput | string) => {
    const key = typeof input === 'string' ? `${documentId}:${input}` : `${documentId}:${input.entityType}:${input.text}`;
    return snippetCache.get(key);
  }, [snippetCache]);

  return {
    fetchDocumentsForEntity,
    fetchSnippetsForDocument,
    isLoading,
    getFromCache,
    isSnippetLoading,
    getSnippetsFromCache,
  };
}

