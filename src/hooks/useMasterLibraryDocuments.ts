import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Json } from '@/integrations/supabase/types';

export interface DocumentWithEntityCount {
  id: string;
  title: string;
  entityCount: number;
  folder_id: string | null;
}

// Check if hierarchy blocks have any non-empty nodes
function hasNonEmptyNodes(nodes: any[]): boolean {
  if (!Array.isArray(nodes) || nodes.length === 0) return false;
  
  return nodes.some(node => {
    const label = node.label?.trim?.() || '';
    if (label.length > 0) return true;
    if (Array.isArray(node.children) && hasNonEmptyNodes(node.children)) return true;
    return false;
  });
}

// Parse hierarchy blocks from JSON
function parseHierarchyBlocks(json: Json | null): Record<string, any> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) return {};
  return json as Record<string, any>;
}

// Check if a document is empty (no meaningful content)
function isDocumentEmpty(content: Json | null, hierarchyBlocks: Json | null): boolean {
  const blocks = parseHierarchyBlocks(hierarchyBlocks);
  
  // Check hierarchy blocks for content
  const hasHierarchyContent = Object.values(blocks).some(block => {
    const tree = (block as any)?.tree;
    return hasNonEmptyNodes(tree);
  });
  
  if (hasHierarchyContent) return false;

  // Check TipTap content
  if (!content || typeof content !== 'object') return true;
  
  const docContent = (content as any).content;
  if (!Array.isArray(docContent)) return true;
  
  const hasRealContent = docContent.some((node: any) => {
    if (node.type === 'hierarchyBlock') return false;
    if (node.type === 'paragraph') {
      return node.content && node.content.length > 0;
    }
    return node.type !== 'paragraph';
  });
  
  return !hasRealContent;
}

/**
 * Hook to fetch documents that have entities in the Master Library
 * Filters out empty documents (no meaningful content)
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
        .select('id, title, folder_id, content, hierarchy_blocks')
        .in('id', docIds);

      if (docsError) throw docsError;

      // Merge with counts and filter out empty documents
      const result: DocumentWithEntityCount[] = (docs || [])
        .filter(doc => !isDocumentEmpty(doc.content, doc.hierarchy_blocks))
        .map(doc => ({
          id: doc.id,
          title: doc.title,
          entityCount: countMap.get(doc.id) || 0,
          folder_id: doc.folder_id,
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
