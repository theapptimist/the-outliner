import { supabase } from '@/integrations/supabase/client';

export interface EntityRelationship {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  user_id: string;
  relationship_type: string;
  description: string | null;
  created_at: string;
}

// Common relationship types for suggestions
export const COMMON_RELATIONSHIP_TYPES = [
  'lived in',
  'worked at',
  'born in',
  'died in',
  'married to',
  'child of',
  'parent of',
  'sibling of',
  'associated with',
  'defined by',
  'referenced in',
  'related to',
  'part of',
  'owner of',
  'member of',
  'created by',
  'located in',
  'occurred at',
  'before',
  'after',
  'during',
] as const;

export type CommonRelationshipType = typeof COMMON_RELATIONSHIP_TYPES[number];

/**
 * Create a relationship between two entities
 */
export async function createEntityRelationship(
  sourceEntityId: string,
  targetEntityId: string,
  relationshipType: string,
  userId: string,
  description?: string
): Promise<EntityRelationship | null> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .insert({
      source_entity_id: sourceEntityId,
      target_entity_id: targetEntityId,
      relationship_type: relationshipType,
      user_id: userId,
      description: description || null,
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create entity relationship:', error);
    return null;
  }

  return data;
}

/**
 * Get all relationships for an entity (both as source and target)
 */
export async function getEntityRelationships(
  entityId: string
): Promise<EntityRelationship[]> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select('*')
    .or(`source_entity_id.eq.${entityId},target_entity_id.eq.${entityId}`)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get entity relationships:', error);
    return [];
  }

  return data || [];
}

/**
 * Get relationships where entity is the source
 */
export async function getOutgoingRelationships(
  entityId: string
): Promise<EntityRelationship[]> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select('*')
    .eq('source_entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get outgoing relationships:', error);
    return [];
  }

  return data || [];
}

/**
 * Get relationships where entity is the target
 */
export async function getIncomingRelationships(
  entityId: string
): Promise<EntityRelationship[]> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select('*')
    .eq('target_entity_id', entityId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get incoming relationships:', error);
    return [];
  }

  return data || [];
}

/**
 * Update a relationship
 */
export async function updateEntityRelationship(
  relationshipId: string,
  updates: {
    relationship_type?: string;
    description?: string | null;
  }
): Promise<EntityRelationship | null> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .update(updates)
    .eq('id', relationshipId)
    .select()
    .single();

  if (error) {
    console.error('Failed to update entity relationship:', error);
    return null;
  }

  return data;
}

/**
 * Delete a relationship
 */
export async function deleteEntityRelationship(
  relationshipId: string
): Promise<boolean> {
  const { error } = await supabase
    .from('entity_relationships')
    .delete()
    .eq('id', relationshipId);

  if (error) {
    console.error('Failed to delete entity relationship:', error);
    return false;
  }

  return true;
}

/**
 * Get all relationships for a user
 */
export async function getAllUserRelationships(
  userId: string
): Promise<EntityRelationship[]> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to get all user relationships:', error);
    return [];
  }

  return data || [];
}

/**
 * Get all unique relationship types used by a user (for autocomplete)
 */
export async function getUserRelationshipTypes(
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select('relationship_type')
    .eq('user_id', userId);

  if (error) {
    console.error('Failed to get user relationship types:', error);
    return [];
  }

  const uniqueTypes = [...new Set((data || []).map(r => r.relationship_type))];
  return uniqueTypes;
}

/**
 * Check if a relationship exists between two entities
 */
export async function relationshipExists(
  sourceEntityId: string,
  targetEntityId: string,
  relationshipType: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from('entity_relationships')
    .select('id')
    .eq('source_entity_id', sourceEntityId)
    .eq('target_entity_id', targetEntityId)
    .eq('relationship_type', relationshipType)
    .maybeSingle();

  if (error) {
    console.error('Failed to check relationship existence:', error);
    return false;
  }

  return data !== null;
}
