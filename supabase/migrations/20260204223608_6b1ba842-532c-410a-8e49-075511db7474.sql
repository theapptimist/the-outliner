-- Fix infinite recursion in entities RLS policies
-- The issue is that the policies reference themselves incorrectly

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can view approved public entities" ON public.entities;
DROP POLICY IF EXISTS "Users can view shared entities" ON public.entities;

-- Recreate with correct references
CREATE POLICY "Users can view approved public entities" 
ON public.entities 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM public.public_entities pe
  WHERE pe.entity_id = entities.id AND pe.status = 'approved'::entity_status
));

CREATE POLICY "Users can view shared entities" 
ON public.entities 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM public.entity_permissions ep
  WHERE ep.entity_id = entities.id AND ep.granted_to_user_id = auth.uid()
));