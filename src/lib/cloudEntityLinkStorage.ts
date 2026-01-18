import { supabase } from '@/integrations/supabase/client';

export interface EntityLink {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  user_id: string;
  created_at: string;
}

/**
 * Create a link between two entities (same real-world entity across documents)
 */
export async function createEntityLink(
  sourceEntityId: string,
  targetEntityId: string,
  userId: string
): Promise<EntityLink | null> {
  const { data, error } = await supabase
    .from('entity_links')
    .insert({
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      user_id: userId,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create entity link:', error);
    return null;
  }

  return data;
}

/**
 * Get all entities linked to a given entity (in either direction)
 */
export async function getLinkedEntities(entityId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('entity_links')
    .select('source_entity_id, target_entity_id')
    .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`);

  if (error) {
    console.error('Failed to get linked entities:', error);
    return [];
  }

  // Extract the "other" entity ID from each link
  const linkedIds = (data || []).map(link => 
    link.source_entity_id === entityId ? link.target_entity_id : link.source_entity_id
  );

  return linkedIds;
}

/**
 * Get all links for an entity
 */
export async function getEntityLinks(entityId: string): Promise<EntityLink[]> {
  const { data, error } = await supabase
    .from('entity_links')
    .select('*')
    .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`);

  if (error) {
    console.error('Failed to get entity links:', error);
    return [];
  }

  return data || [];
}

/**
 * Delete a link between two entities
 */
export async function deleteEntityLink(linkId: string): Promise<boolean> {
  const { error } = await supabase
    .from('entity_links')
    .delete()
    .eq('id', linkId);

  if (error) {
    console.error('Failed to delete entity link:', error);
    return false;
  }

  return true;
}

/**
 * Unlink two specific entities
 */
export async function unlinkEntities(
  entityId1: string,
  entityId2: string
): Promise<boolean> {
  const { error } = await supabase
    .from('entity_links')
    .delete()
    .or(
      `and(source_entity_id.eq.${entityId1},target_entity_id.eq.${entityId2}),` +
      `and(source_entity_id.eq.${entityId2},target_entity_id.eq.${entityId1})`
    );

  if (error) {
    console.error('Failed to unlink entities:', error);
    return false;
  }

  return true;
}

/**
 * Check if two entities are linked
 */
export async function areEntitiesLinked(
  entityId1: string,
  entityId2: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('entity_links')
    .select('id')
    .or(
      `and(source_entity_id.eq.${entityId1},target_entity_id.eq.${entityId2}),` +
      `and(source_entity_id.eq.${entityId2},target_entity_id.eq.${entityId1})`
    )
    .maybeSingle();

  if (error) {
    console.error('Failed to check entity link:', error);
    return false;
  }

  return data !== null;
}

/**
 * Get all links for a user (for displaying in a relationships view)
 */
export async function getAllUserEntityLinks(userId: string): Promise<EntityLink[]> {
  const { data, error } = await supabase
    .from('entity_links')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get all user entity links:', error);
    return [];
  }

  return data || [];
}
