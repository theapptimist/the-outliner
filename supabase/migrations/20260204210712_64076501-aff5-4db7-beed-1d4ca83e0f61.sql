-- Master Library Schema

-- 1. Create entity_visibility enum
CREATE TYPE public.entity_visibility AS ENUM ('private', 'workspace', 'public');

-- 2. Create entity_status enum for public entity moderation
CREATE TYPE public.entity_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

-- 3. Master entities table - global entity pool
CREATE TABLE public.entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  entity_type text NOT NULL, -- 'person', 'place', 'date', 'term'
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  visibility entity_visibility NOT NULL DEFAULT 'private',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Entity permissions table - explicit sharing
CREATE TABLE public.entity_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  granted_to_user_id uuid NOT NULL,
  granted_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_id, granted_to_user_id)
);

-- 5. Workspace entities - workspace-level shared libraries
CREATE TABLE public.workspace_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id text NOT NULL, -- workspace identifier
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  added_by_user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, entity_id)
);

-- 6. Public entities - curated templates + user contributions
CREATE TABLE public.public_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE UNIQUE,
  submitted_by_user_id uuid NOT NULL,
  reviewed_by_user_id uuid,
  status entity_status NOT NULL DEFAULT 'draft',
  category text, -- e.g., 'historical_figures', 'us_states', 'legal_terms'
  tags text[],
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz
);

-- 7. Document entity references - links documents to entities
CREATE TABLE public.document_entity_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL REFERENCES public.entities(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, entity_id)
);

-- Enable RLS on all tables
ALTER TABLE public.entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.public_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.document_entity_refs ENABLE ROW LEVEL SECURITY;

-- Helper function: Check if user can access an entity
CREATE OR REPLACE FUNCTION public.can_access_entity(_user_id uuid, _entity_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    -- Owner can always access
    SELECT 1 FROM public.entities WHERE id = _entity_id AND owner_id = _user_id
    UNION
    -- Explicitly shared via permissions
    SELECT 1 FROM public.entity_permissions WHERE entity_id = _entity_id AND granted_to_user_id = _user_id
    UNION
    -- Approved public entity
    SELECT 1 FROM public.public_entities pe 
    JOIN public.entities e ON e.id = pe.entity_id 
    WHERE pe.entity_id = _entity_id AND pe.status = 'approved'
  )
$$;

-- ENTITIES TABLE POLICIES

-- Owners can do everything with their own entities
CREATE POLICY "Owners can view own entities"
ON public.entities FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Users can view shared entities"
ON public.entities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.entity_permissions 
    WHERE entity_id = id AND granted_to_user_id = auth.uid()
  )
);

CREATE POLICY "Users can view approved public entities"
ON public.entities FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.public_entities 
    WHERE entity_id = id AND status = 'approved'
  )
);

CREATE POLICY "Owners can create entities"
ON public.entities FOR INSERT
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own entities"
ON public.entities FOR UPDATE
USING (owner_id = auth.uid());

CREATE POLICY "Owners can delete own entities"
ON public.entities FOR DELETE
USING (owner_id = auth.uid());

-- ENTITY_PERMISSIONS TABLE POLICIES

CREATE POLICY "Entity owners can manage permissions"
ON public.entity_permissions FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE id = entity_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Granted users can view their permissions"
ON public.entity_permissions FOR SELECT
USING (granted_to_user_id = auth.uid());

-- WORKSPACE_ENTITIES TABLE POLICIES

CREATE POLICY "Users can view workspace entities they have access to"
ON public.workspace_entities FOR SELECT
USING (
  public.can_access_entity(auth.uid(), entity_id)
);

CREATE POLICY "Entity owners can add to workspaces"
ON public.workspace_entities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE id = entity_id AND owner_id = auth.uid()
  )
);

CREATE POLICY "Entity owners can remove from workspaces"
ON public.workspace_entities FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE id = entity_id AND owner_id = auth.uid()
  )
);

-- PUBLIC_ENTITIES TABLE POLICIES

-- Everyone can view approved public entities
CREATE POLICY "Anyone can view approved public entities"
ON public.public_entities FOR SELECT
USING (status = 'approved');

-- Entity owners can submit their entities for public review
CREATE POLICY "Entity owners can submit for public"
ON public.public_entities FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.entities 
    WHERE id = entity_id AND owner_id = auth.uid()
  )
  AND submitted_by_user_id = auth.uid()
);

-- Submitters can view their own submissions
CREATE POLICY "Submitters can view own submissions"
ON public.public_entities FOR SELECT
USING (submitted_by_user_id = auth.uid());

-- Moderators can view all public entity submissions
CREATE POLICY "Moderators can view all submissions"
ON public.public_entities FOR SELECT
USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- Moderators can update status (approve/reject)
CREATE POLICY "Moderators can update submissions"
ON public.public_entities FOR UPDATE
USING (public.has_role(auth.uid(), 'moderator') OR public.has_role(auth.uid(), 'admin'));

-- Admins can delete public entities
CREATE POLICY "Admins can delete public entities"
ON public.public_entities FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- DOCUMENT_ENTITY_REFS TABLE POLICIES

CREATE POLICY "Users can view own document refs"
ON public.document_entity_refs FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can create refs to accessible entities"
ON public.document_entity_refs FOR INSERT
WITH CHECK (
  user_id = auth.uid() 
  AND public.can_access_entity(auth.uid(), entity_id)
);

CREATE POLICY "Users can delete own refs"
ON public.document_entity_refs FOR DELETE
USING (user_id = auth.uid());

-- Add updated_at trigger to entities table
CREATE TRIGGER update_entities_updated_at
BEFORE UPDATE ON public.entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();