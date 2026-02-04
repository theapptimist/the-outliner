-- Fix circular RLS recursion between entities and entity_permissions
-- The entity_permissions policy queries entities, which queries entity_permissions

-- Create a security definer function to check entity ownership without RLS
CREATE OR REPLACE FUNCTION public.is_entity_owner(_entity_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.entities
    WHERE id = _entity_id AND owner_id = _user_id
  )
$$;

-- Drop the problematic entity_permissions policy
DROP POLICY IF EXISTS "Entity owners can manage permissions" ON public.entity_permissions;

-- Recreate using the security definer function to avoid recursion
CREATE POLICY "Entity owners can manage permissions" 
ON public.entity_permissions 
FOR ALL 
USING (public.is_entity_owner(entity_id, auth.uid()))
WITH CHECK (public.is_entity_owner(entity_id, auth.uid()));