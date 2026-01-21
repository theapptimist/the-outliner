import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';
import { withRetry } from './fetchWithRetry';

export type EntityType = 'person' | 'place' | 'date' | 'term';

export interface CloudEntity {
  id: string;
  document_id: string;
  user_id: string;
  entity_type: EntityType;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/**
 * Load all entities of a specific type for a document
 */
export async function loadEntities<T>(
  documentId: string,
  entityType: EntityType
): Promise<T[]> {
  return withRetry(async () => {
    const { data, error } = await supabase
      .from('document_entities')
      .select('*')
      .eq('document_id', documentId)
      .eq('entity_type', entityType);

    if (error) {
      console.error(`Failed to load ${entityType} entities:`, error);
      throw error;
    }

    // Extract the data field from each row and cast to T
    return (data || []).map(row => ({
      ...(row.data as Record<string, unknown>),
      id: row.id, // Use the database ID as the entity ID
    })) as T[];
  });
}

/**
 * Load all entities of a specific type for multiple documents (for aggregation)
 */
export async function loadEntitiesForDocuments<T>(
  documentIds: string[],
  entityType: EntityType
): Promise<Array<T & { sourceDocId: string }>> {
  if (documentIds.length === 0) return [];

  return withRetry(async () => {
    const { data, error } = await supabase
      .from('document_entities')
      .select('*')
      .in('document_id', documentIds)
      .eq('entity_type', entityType);

    if (error) {
      console.error(`Failed to load ${entityType} entities for aggregation:`, error);
      throw error;
    }

    return (data || []).map(row => ({
      ...(row.data as Record<string, unknown>),
      id: row.id,
      sourceDocId: row.document_id,
    })) as unknown as Array<T & { sourceDocId: string }>;
  });
}

/**
 * Save a single entity (upsert)
 */
export async function saveEntity<T extends { id: string }>(
  documentId: string,
  entityType: EntityType,
  entity: T,
  userId: string
): Promise<T | null> {
  // Remove the id from data since it's stored at the row level
  const { id, ...entityData } = entity;

  const { data, error } = await supabase
    .from('document_entities')
    .upsert({
      id,
      document_id: documentId,
      user_id: userId,
      entity_type: entityType,
      data: entityData as unknown as Json,
    }, { onConflict: 'id' })
    .select()
    .single();

  if (error) {
    console.error(`Failed to save ${entityType} entity:`, error);
    return null;
  }

  return {
    ...(data.data as Record<string, unknown>),
    id: data.id,
  } as T;
}

/**
 * Save multiple entities at once (batch upsert)
 */
export async function saveEntities<T extends { id: string }>(
  documentId: string,
  entityType: EntityType,
  entities: T[],
  userId: string
): Promise<boolean> {
  if (entities.length === 0) return true;

  const rows = entities.map(entity => {
    const { id, ...entityData } = entity;
    return {
      id,
      document_id: documentId,
      user_id: userId,
      entity_type: entityType,
      data: entityData as unknown as Json,
    };
  });

  const { error } = await supabase
    .from('document_entities')
    .upsert(rows, { onConflict: 'id' });

  if (error) {
    console.error(`Failed to save ${entityType} entities:`, error);
    return false;
  }

  return true;
}

/**
 * Delete a single entity
 */
export async function deleteEntity(entityId: string): Promise<boolean> {
  const { error } = await supabase
    .from('document_entities')
    .delete()
    .eq('id', entityId);

  if (error) {
    console.error('Failed to delete entity:', error);
    return false;
  }

  return true;
}

/**
 * Delete all entities of a specific type for a document
 */
export async function deleteAllEntities(
  documentId: string,
  entityType: EntityType
): Promise<boolean> {
  const { error } = await supabase
    .from('document_entities')
    .delete()
    .eq('document_id', documentId)
    .eq('entity_type', entityType);

  if (error) {
    console.error(`Failed to delete all ${entityType} entities:`, error);
    return false;
  }

  return true;
}

/**
 * Migrate entities from localStorage to cloud storage
 * Returns true if migration was performed, false if skipped (already exists in cloud)
 */
export async function migrateLocalToCloud<T extends { id: string }>(
  documentId: string,
  entityType: EntityType,
  localStorageKey: string,
  userId: string,
  deserialize?: (json: string) => T[]
): Promise<{ migrated: boolean; entities: T[] }> {
  // First check if cloud already has entities for this document
  const cloudEntities = await loadEntities<T>(documentId, entityType);
  
  if (cloudEntities.length > 0) {
    // Cloud already has data, skip migration
    return { migrated: false, entities: cloudEntities };
  }

  // Check localStorage for existing data
  const STORAGE_PREFIX = 'outliner-session';
  const storageKey = `${STORAGE_PREFIX}:${localStorageKey}`;
  const localData = localStorage.getItem(storageKey);

  if (!localData) {
    // No local data to migrate
    return { migrated: false, entities: [] };
  }

  try {
    const localEntities: T[] = deserialize 
      ? deserialize(localData)
      : JSON.parse(localData);

    if (localEntities.length === 0) {
      return { migrated: false, entities: [] };
    }

    // Save to cloud
    const success = await saveEntities(documentId, entityType, localEntities, userId);

    if (success) {
      // Clear localStorage after successful migration
      localStorage.removeItem(storageKey);
      console.log(`Migrated ${localEntities.length} ${entityType} entities from local to cloud`);
      return { migrated: true, entities: localEntities };
    }
  } catch (e) {
    console.warn(`Failed to migrate ${entityType} from localStorage:`, e);
  }

  return { migrated: false, entities: [] };
}
