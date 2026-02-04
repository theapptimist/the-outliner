import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { Json } from '@/integrations/supabase/types';

export type MasterEntityType = 'people' | 'places' | 'dates' | 'terms';

interface EntityData {
  name?: string;
  term?: string;
  definition?: string;
  role?: string;
  description?: string;
  significance?: string;
  date?: string;
  rawText?: string;
  [key: string]: unknown;
}

/**
 * Hook to sync entities to the Master Library (entities table)
 * This ensures every entity created also gets added to the global library
 */
export function useMasterEntitySync() {
  const { user } = useAuth();

  /**
   * Sync an entity to the Master Library if it doesn't already exist
   * Returns true if synced successfully, false if skipped (already exists)
   */
  const syncToMaster = useCallback(async (
    entityType: MasterEntityType,
    data: EntityData,
    sourceDocumentId?: string
  ): Promise<boolean> => {
    if (!user?.id) return false;

    try {
      // Get the unique key for this entity
      const key = getEntityKey(entityType, data);
      if (!key) return false;

      // Check if entity already exists in master
      const { data: existing, error: checkError } = await supabase
        .from('entities')
        .select('id')
        .eq('owner_id', user.id)
        .eq('entity_type', entityType);

      if (checkError) {
        console.error('[useMasterEntitySync] Error checking existing:', checkError);
        return false;
      }

      // Check by key in the data
      const alreadyExists = (existing || []).some(e => {
        // We need to fetch the data to compare - for now, skip if ANY of this type exists
        // This is a simplified check; for production we'd want to compare the actual key
        return false; // Let the DB handle duplicates
      });

      // For a proper dedup check, query with the specific data
      const nameField = entityType === 'terms' ? 'term' 
        : entityType === 'dates' ? 'rawText' 
        : 'name';
      const nameValue = data[nameField];
      
      if (nameValue) {
        const { data: existingWithName } = await supabase
          .from('entities')
          .select('id')
          .eq('owner_id', user.id)
          .eq('entity_type', entityType)
          .contains('data', { [nameField]: nameValue });

        if (existingWithName && existingWithName.length > 0) {
          // Already exists, skip
          return false;
        }
      }

      // Insert new master entity
      const { error: insertError } = await supabase
        .from('entities')
        .insert({
          owner_id: user.id,
          entity_type: entityType,
          data: data as Json,
          visibility: 'private',
          source_document_id: sourceDocumentId || null,
        });

      if (insertError) {
        console.error('[useMasterEntitySync] Error inserting:', insertError);
        return false;
      }

      return true;
    } catch (e) {
      console.error('[useMasterEntitySync] Error:', e);
      return false;
    }
  }, [user?.id]);

  return { syncToMaster };
}

function getEntityKey(entityType: MasterEntityType, data: EntityData): string | null {
  switch (entityType) {
    case 'people':
      return data.name ? `people:${data.name.toLowerCase().trim()}` : null;
    case 'places':
      return data.name ? `places:${data.name.toLowerCase().trim()}` : null;
    case 'dates':
      return data.rawText ? `dates:${data.rawText.toLowerCase().trim()}` : null;
    case 'terms':
      return data.term ? `terms:${data.term.toLowerCase().trim()}` : null;
    default:
      return null;
  }
}
