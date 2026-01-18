import { supabase } from '@/integrations/supabase/client';
import { EntityType } from './cloudEntityStorage';

export interface EntityWithDocument {
  id: string;
  document_id: string;
  entity_type: EntityType;
  data: Record<string, unknown>;
  document_title?: string;
}

/**
 * Load all entities of a specific type across all user's documents
 * Useful for cross-document linking dialogs
 */
export async function loadAllUserEntities(
  entityType: EntityType
): Promise<EntityWithDocument[]> {
  // First get all entities of this type for the current user
  const { data: entities, error: entitiesError } = await supabase
    .from('document_entities')
    .select('*')
    .eq('entity_type', entityType);

  if (entitiesError) {
    console.error(`Failed to load all ${entityType} entities:`, entitiesError);
    return [];
  }

  if (!entities || entities.length === 0) {
    return [];
  }

  // Get unique document IDs
  const documentIds = [...new Set(entities.map(e => e.document_id))];

  // Fetch document titles
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, title')
    .in('id', documentIds);

  if (docsError) {
    console.error('Failed to load document titles:', docsError);
  }

  // Create a map of document IDs to titles
  const docTitleMap = new Map(
    (documents || []).map(d => [d.id, d.title])
  );

  // Combine entities with document titles
  return entities.map(entity => ({
    id: entity.id,
    document_id: entity.document_id,
    entity_type: entity.entity_type as EntityType,
    data: entity.data as Record<string, unknown>,
    document_title: docTitleMap.get(entity.document_id) || 'Untitled',
  }));
}

/**
 * Load all entities of any type across all user's documents
 */
export async function loadAllUserEntitiesAllTypes(): Promise<EntityWithDocument[]> {
  const { data: entities, error: entitiesError } = await supabase
    .from('document_entities')
    .select('*');

  if (entitiesError) {
    console.error('Failed to load all entities:', entitiesError);
    return [];
  }

  if (!entities || entities.length === 0) {
    return [];
  }

  // Get unique document IDs
  const documentIds = [...new Set(entities.map(e => e.document_id))];

  // Fetch document titles
  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, title')
    .in('id', documentIds);

  if (docsError) {
    console.error('Failed to load document titles:', docsError);
  }

  const docTitleMap = new Map(
    (documents || []).map(d => [d.id, d.title])
  );

  return entities.map(entity => ({
    id: entity.id,
    document_id: entity.document_id,
    entity_type: entity.entity_type as EntityType,
    data: entity.data as Record<string, unknown>,
    document_title: docTitleMap.get(entity.document_id) || 'Untitled',
  }));
}

/**
 * Get entity details by ID with document info
 */
export async function getEntityById(
  entityId: string
): Promise<EntityWithDocument | null> {
  const { data: entity, error: entityError } = await supabase
    .from('document_entities')
    .select('*')
    .eq('id', entityId)
    .maybeSingle();

  if (entityError || !entity) {
    console.error('Failed to get entity:', entityError);
    return null;
  }

  // Get document title
  const { data: doc } = await supabase
    .from('documents')
    .select('title')
    .eq('id', entity.document_id)
    .maybeSingle();

  return {
    id: entity.id,
    document_id: entity.document_id,
    entity_type: entity.entity_type as EntityType,
    data: entity.data as Record<string, unknown>,
    document_title: doc?.title || 'Untitled',
  };
}

/**
 * Get multiple entities by IDs with document info
 */
export async function getEntitiesByIds(
  entityIds: string[]
): Promise<EntityWithDocument[]> {
  if (entityIds.length === 0) return [];

  const { data: entities, error: entitiesError } = await supabase
    .from('document_entities')
    .select('*')
    .in('id', entityIds);

  if (entitiesError) {
    console.error('Failed to get entities:', entitiesError);
    return [];
  }

  if (!entities || entities.length === 0) {
    return [];
  }

  // Get unique document IDs
  const documentIds = [...new Set(entities.map(e => e.document_id))];

  // Fetch document titles
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title')
    .in('id', documentIds);

  const docTitleMap = new Map(
    (documents || []).map(d => [d.id, d.title])
  );

  return entities.map(entity => ({
    id: entity.id,
    document_id: entity.document_id,
    entity_type: entity.entity_type as EntityType,
    data: entity.data as Record<string, unknown>,
    document_title: docTitleMap.get(entity.document_id) || 'Untitled',
  }));
}
