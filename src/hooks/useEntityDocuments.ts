import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

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

// Find snippets containing a search term in hierarchy blocks
function findSnippetsInHierarchy(
  hierarchyBlocks: Record<string, any>,
  searchTerm: string
): DocumentSnippet[] {
  const snippets: DocumentSnippet[] = [];
  const termLower = searchTerm.toLowerCase();
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'gi');

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  function scanNode(node: any, blockId: string) {
    // Check label
    if (node.label && wordBoundaryRegex.test(node.label)) {
      const match = node.label.match(wordBoundaryRegex);
      if (match) {
        // Create a snippet around the match
        const idx = node.label.toLowerCase().indexOf(termLower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(node.label.length, idx + searchTerm.length + 40);
        let snippet = node.label.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < node.label.length) snippet = snippet + '...';
        
        snippets.push({
          text: snippet,
          nodeLabel: node.label.substring(0, 50),
          blockId,
          nodeId: node.id,
        });
      }
    }

    // Check content
    if (node.content) {
      const plainText = extractPlainText(node.content);
      if (wordBoundaryRegex.test(plainText)) {
        const idx = plainText.toLowerCase().indexOf(termLower);
        const start = Math.max(0, idx - 40);
        const end = Math.min(plainText.length, idx + searchTerm.length + 40);
        let snippet = plainText.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < plainText.length) snippet = snippet + '...';
        
        snippets.push({
          text: snippet,
          nodeLabel: node.label?.substring(0, 50),
          blockId,
          nodeId: node.id,
        });
      }
    }

    // Recurse into children
    if (Array.isArray(node.children)) {
      node.children.forEach((child: any) => scanNode(child, blockId));
    }
  }

  Object.entries(hierarchyBlocks).forEach(([blockId, block]) => {
    const tree = (block as any)?.tree;
    if (Array.isArray(tree)) {
      tree.forEach(node => scanNode(node, blockId));
    }
  });

  return snippets;
}

// Find snippets in TipTap content
function findSnippetsInContent(content: any, searchTerm: string): DocumentSnippet[] {
  const snippets: DocumentSnippet[] = [];
  const termLower = searchTerm.toLowerCase();
  const wordBoundaryRegex = new RegExp(`\\b${escapeRegex(searchTerm)}\\b`, 'gi');

  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  const plainText = extractPlainText(content);
  let match;
  while ((match = wordBoundaryRegex.exec(plainText)) !== null) {
    const idx = match.index;
    const start = Math.max(0, idx - 40);
    const end = Math.min(plainText.length, idx + searchTerm.length + 40);
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
    entityName: string
  ): Promise<DocumentSnippet[]> => {
    const cacheKey = `${documentId}:${entityName}`;
    
    // Check cache first
    if (snippetCache.has(cacheKey)) {
      return snippetCache.get(cacheKey) || [];
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

      const snippets: DocumentSnippet[] = [];

      // Find snippets in hierarchy blocks
      if (doc.hierarchy_blocks) {
        const hierarchyBlocks = doc.hierarchy_blocks as Record<string, any>;
        snippets.push(...findSnippetsInHierarchy(hierarchyBlocks, entityName));
      }

      // Find snippets in content
      if (doc.content) {
        snippets.push(...findSnippetsInContent(doc.content, entityName));
      }

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
  const isSnippetLoading = useCallback((documentId: string, entityName: string) => 
    snippetLoading.has(`${documentId}:${entityName}`), [snippetLoading]);
  const getSnippetsFromCache = useCallback((documentId: string, entityName: string) => 
    snippetCache.get(`${documentId}:${entityName}`), [snippetCache]);

  return {
    fetchDocumentsForEntity,
    fetchSnippetsForDocument,
    isLoading,
    getFromCache,
    isSnippetLoading,
    getSnippetsFromCache,
  };
}

