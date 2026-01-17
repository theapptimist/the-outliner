import { supabase } from '@/integrations/supabase/client';
import { DocumentState, createEmptyDocument, HierarchyBlockData } from '@/types/document';
import { Json } from '@/integrations/supabase/types';

export interface CloudDocumentMetadata {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
}

// Type guard + migration helper to safely convert stored JSON into HierarchyBlockData.
// Supports legacy shape where a block value was stored as HierarchyNode[] directly.
function parseHierarchyBlocks(json: Json | null): Record<string, HierarchyBlockData> {
  if (!json || typeof json !== 'object' || Array.isArray(json)) {
    return {};
  }

  const obj = json as Record<string, unknown>;
  const blocks: Record<string, HierarchyBlockData> = {};

  for (const [blockId, value] of Object.entries(obj)) {
    // Legacy: { [blockId]: HierarchyNode[] }
    if (Array.isArray(value)) {
      blocks[blockId] = { id: blockId, tree: value as any };
      continue;
    }

    // Current: { [blockId]: { id: string; tree: HierarchyNode[] } }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      const tree = v.tree;
      if (Array.isArray(tree)) {
        blocks[blockId] = {
          id: (typeof v.id === 'string' ? v.id : blockId) as string,
          tree: tree as any,
        };
      }
    }
  }

  return blocks;
}

// List all documents for the current user
export async function listCloudDocuments(): Promise<CloudDocumentMetadata[]> {
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('[CloudStorage] Failed to list documents:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    title: d.title,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

// Load a specific document
export async function loadCloudDocument(id: string): Promise<DocumentState | null> {
  const { data, error } = await supabase
    .from('documents')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !data) {
    console.error('[CloudStorage] Failed to load document:', error);
    return null;
  }

  // Track "recent" by opens (not just saves)
  addToRecentCloudDocuments(data.id);

  return {
    meta: {
      id: data.id,
      title: data.title,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      isMaster: data.is_master ?? false,
    },
    content: data.content || {},
    hierarchyBlocks: parseHierarchyBlocks(data.hierarchy_blocks),
  };
}

// Save a document (upsert)
export async function saveCloudDocument(doc: DocumentState, userId: string): Promise<DocumentState> {
  const now = new Date().toISOString();
  
  // Check if document exists
  const { data: existing } = await supabase
    .from('documents')
    .select('id')
    .eq('id', doc.meta.id)
    .maybeSingle();

  let result;
  
  if (existing) {
    // Update existing document
    const { data, error } = await supabase
      .from('documents')
      .update({
        title: doc.meta.title,
        content: doc.content as unknown as Json,
        hierarchy_blocks: doc.hierarchyBlocks as unknown as Json,
        updated_at: now,
        is_master: doc.meta.isMaster ?? false,
      })
      .eq('id', doc.meta.id)
      .select()
      .single();
      
    if (error) {
      console.error('[CloudStorage] Failed to update document:', error);
      throw error;
    }
    result = data;
  } else {
    // Insert new document
    const { data, error } = await supabase
      .from('documents')
      .insert({
        id: doc.meta.id,
        user_id: userId,
        title: doc.meta.title,
        content: doc.content as unknown as Json,
        hierarchy_blocks: doc.hierarchyBlocks as unknown as Json,
        created_at: doc.meta.createdAt,
        updated_at: now,
        is_master: doc.meta.isMaster ?? false,
      })
      .select()
      .single();
      
    if (error) {
      console.error('[CloudStorage] Failed to insert document:', error);
      throw error;
    }
    result = data;
  }

  console.log('[CloudStorage] Saved document:', doc.meta.id, doc.meta.title);

  return {
    ...doc,
    meta: {
      ...doc.meta,
      updatedAt: result.updated_at,
      isMaster: result.is_master ?? false,
    },
  };
}

// Delete a document
export async function deleteCloudDocument(id: string): Promise<void> {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('[CloudStorage] Failed to delete document:', error);
    throw error;
  }
}

// Create a new document
export async function createCloudDocument(userId: string, title: string = 'Untitled'): Promise<DocumentState> {
  const doc = createEmptyDocument();
  doc.meta.title = title;
  
  return saveCloudDocument(doc, userId);
}

const RECENT_CLOUD_KEY = 'outliner:recent-cloud';
const MAX_RECENT = 5;

function getRecentCloudIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_CLOUD_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

function addToRecentCloudDocuments(id: string) {
  const recent = getRecentCloudIds().filter(r => r !== id);
  recent.unshift(id);
  try {
    localStorage.setItem(RECENT_CLOUD_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch {
    // ignore
  }
}

// Get recent documents (last opened). Falls back to "last updated" if no recent list exists.
export async function getRecentCloudDocuments(): Promise<CloudDocumentMetadata[]> {
  const recentIds = getRecentCloudIds();

  if (recentIds.length > 0) {
    const { data, error } = await supabase
      .from('documents')
      .select('id, title, created_at, updated_at')
      .in('id', recentIds);

    if (error) {
      console.error('[CloudStorage] Failed to get recent documents:', error);
      return [];
    }

    const byId = new Map(data.map(d => [d.id, d]));
    return recentIds
      .map(id => byId.get(id))
      .filter((d): d is NonNullable<typeof d> => Boolean(d))
      .map(d => ({
        id: d.id,
        title: d.title,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
      }));
  }

  // Fallback: most recently updated
  const { data, error } = await supabase
    .from('documents')
    .select('id, title, created_at, updated_at')
    .order('updated_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error('[CloudStorage] Failed to get recent documents:', error);
    return [];
  }

  return data.map(d => ({
    id: d.id,
    title: d.title,
    createdAt: d.created_at,
    updatedAt: d.updated_at,
  }));
}

// Export document as JSON file
export function exportCloudDocument(doc: DocumentState): void {
  const blob = new Blob([JSON.stringify(doc, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${doc.meta.title || 'document'}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Import document from file
export async function importCloudDocument(file: File, userId: string): Promise<DocumentState> {
  const text = await file.text();
  const doc = JSON.parse(text) as DocumentState;
  
  // Generate new ID to avoid conflicts
  const newDoc: DocumentState = {
    ...doc,
    meta: {
      ...doc.meta,
      id: crypto.randomUUID(),
      title: doc.meta.title + ' (imported)',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  };
  
  return saveCloudDocument(newDoc, userId);
}
