import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type { EntityType as MasterEntityType } from '@/hooks/useMasterEntities';

// Map from document entity types to master entity types
const ENTITY_TYPE_MAP: Record<string, MasterEntityType> = {
  person: 'people',
  place: 'places',
  date: 'dates',
  term: 'terms',
};

interface DocumentEntity {
  id: string;
  document_id: string;
  user_id: string;
  entity_type: string;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

interface MigrationEntity {
  entity_type: MasterEntityType;
  data: Record<string, unknown>;
  key: string;
  source_document_id: string;
}

interface MigrationResult {
  success: boolean;
  migratedCount: number;
  skippedCount: number;
  errorCount: number;
  errors: string[];
}

/**
 * Migrate all document entities to the Master Library (entities table)
 * This is a one-time bulk migration that:
 * 1. Loads all entities from document_entities for the user
 * 2. Creates corresponding entries in the entities table
 * 3. Deduplicates by name/term to avoid creating duplicates
 */
export async function migrateDocumentEntitiesToMaster(userId: string): Promise<MigrationResult> {
  const result: MigrationResult = {
    success: false,
    migratedCount: 0,
    skippedCount: 0,
    errorCount: 0,
    errors: [],
  };

  try {
    // 1. Load all document entities for this user
    const { data: docEntities, error: loadError } = await supabase
      .from('document_entities')
      .select('*')
      .eq('user_id', userId);

    if (loadError) {
      result.errors.push(`Failed to load document entities: ${loadError.message}`);
      return result;
    }

    if (!docEntities || docEntities.length === 0) {
      result.success = true;
      return result;
    }

    // 2. Load existing master entities to avoid duplicates
    const { data: existingMaster, error: existingError } = await supabase
      .from('entities')
      .select('id, entity_type, data')
      .eq('owner_id', userId);

    if (existingError) {
      result.errors.push(`Failed to load existing master entities: ${existingError.message}`);
      return result;
    }

    // Build a set of existing entity keys for deduplication
    const existingKeys = new Set<string>();
    (existingMaster || []).forEach(e => {
      const data = e.data as Record<string, unknown>;
      const key = getEntityKey(e.entity_type, data);
      if (key) existingKeys.add(key);
    });

    // 3. Group and deduplicate document entities
    const toMigrate: MigrationEntity[] = [];
    const seenKeys = new Set<string>();

    for (const docEntity of docEntities as DocumentEntity[]) {
      const masterType = ENTITY_TYPE_MAP[docEntity.entity_type];
      if (!masterType) {
        result.skippedCount++;
        continue;
      }

      const data = docEntity.data;
      const key = getEntityKey(masterType, data);
      
      if (!key) {
        result.skippedCount++;
        continue;
      }

      // Skip if already in master or already seen in this batch
      if (existingKeys.has(key) || seenKeys.has(key)) {
        result.skippedCount++;
        continue;
      }

      seenKeys.add(key);
      toMigrate.push({ 
        entity_type: masterType, 
        data, 
        key, 
        source_document_id: docEntity.document_id 
      });
    }

    // 4. Insert new master entities
    if (toMigrate.length > 0) {
      const rows = toMigrate.map(item => ({
        owner_id: userId,
        entity_type: item.entity_type,
        data: item.data as Json,
        visibility: 'private' as const,
        source_document_id: item.source_document_id,
      }));

      const { error: insertError } = await supabase
        .from('entities')
        .insert(rows);

      if (insertError) {
        result.errors.push(`Failed to insert master entities: ${insertError.message}`);
        result.errorCount = toMigrate.length;
        return result;
      }

      result.migratedCount = toMigrate.length;
    }

    result.success = true;
    return result;
  } catch (e) {
    result.errors.push(`Unexpected error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return result;
  }
}

/**
 * Get a unique key for an entity based on its type and identifying fields
 */
function getEntityKey(entityType: string, data: Record<string, unknown>): string | null {
  switch (entityType) {
    case 'people':
    case 'person':
      return data.name ? `people:${String(data.name).toLowerCase().trim()}` : null;
    case 'places':
    case 'place':
      return data.name ? `places:${String(data.name).toLowerCase().trim()}` : null;
    case 'dates':
    case 'date':
      return data.rawText ? `dates:${String(data.rawText).toLowerCase().trim()}` : null;
    case 'terms':
    case 'term':
      return data.term ? `terms:${String(data.term).toLowerCase().trim()}` : null;
    default:
      return null;
  }
}

/**
 * Check if migration is needed (user has document entities but no master entities)
 */
export async function checkMigrationNeeded(userId: string): Promise<{
  needed: boolean;
  documentEntityCount: number;
  masterEntityCount: number;
  backfillNeeded: boolean;
  backfillCount: number;
}> {
  const [docResult, masterResult, backfillResult] = await Promise.all([
    supabase
      .from('document_entities')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId),
    supabase
      .from('entities')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .is('source_document_id', null),
  ]);

  const masterCount = masterResult.count || 0;
  const backfillCount = backfillResult.count || 0;

  return {
    needed: (docResult.count || 0) > 0 && masterCount === 0,
    documentEntityCount: docResult.count || 0,
    masterEntityCount: masterCount,
    backfillNeeded: masterCount > 0 && backfillCount > 0,
    backfillCount,
  };
}

/**
 * Backfill source_document_id for existing master entities by matching to document_entities
 */
export async function backfillSourceDocumentIds(userId: string): Promise<{
  success: boolean;
  updatedCount: number;
  errors: string[];
}> {
  const result = { success: false, updatedCount: 0, errors: [] as string[] };

  try {
    // 1. Get master entities without source_document_id
    const { data: masterEntities, error: masterError } = await supabase
      .from('entities')
      .select('id, entity_type, data')
      .eq('owner_id', userId)
      .is('source_document_id', null);

    if (masterError) {
      result.errors.push(`Failed to load master entities: ${masterError.message}`);
      return result;
    }

    if (!masterEntities || masterEntities.length === 0) {
      result.success = true;
      return result;
    }

    // 2. Get all document entities to match against
    const { data: docEntities, error: docError } = await supabase
      .from('document_entities')
      .select('id, document_id, entity_type, data')
      .eq('user_id', userId);

    if (docError) {
      result.errors.push(`Failed to load document entities: ${docError.message}`);
      return result;
    }

    if (!docEntities || docEntities.length === 0) {
      result.success = true;
      return result;
    }

    // 3. Build a map from entity key to document_id (use first match)
    const keyToDocId = new Map<string, string>();
    for (const de of docEntities) {
      const masterType = ENTITY_TYPE_MAP[de.entity_type];
      if (!masterType) continue;
      const key = getEntityKey(masterType, de.data as Record<string, unknown>);
      if (key && !keyToDocId.has(key)) {
        keyToDocId.set(key, de.document_id);
      }
    }

    // 4. Match master entities to their source documents
    const updates: { id: string; source_document_id: string }[] = [];
    for (const me of masterEntities) {
      const key = getEntityKey(me.entity_type, me.data as Record<string, unknown>);
      if (key) {
        const docId = keyToDocId.get(key);
        if (docId) {
          updates.push({ id: me.id, source_document_id: docId });
        }
      }
    }

    // 5. Perform updates
    for (const update of updates) {
      const { error: updateError } = await supabase
        .from('entities')
        .update({ source_document_id: update.source_document_id })
        .eq('id', update.id);

      if (updateError) {
        result.errors.push(`Failed to update entity ${update.id}: ${updateError.message}`);
      } else {
        result.updatedCount++;
      }
    }

    result.success = result.errors.length === 0;
    return result;
  } catch (e) {
    result.errors.push(`Unexpected error: ${e instanceof Error ? e.message : 'Unknown error'}`);
    return result;
  }
}
