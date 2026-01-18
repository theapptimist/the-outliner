-- Create entity_links table for cross-document identity
-- Links two entities as representing the same real-world entity
CREATE TABLE public.entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES public.document_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.document_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate links (both directions)
  CONSTRAINT unique_entity_link UNIQUE (source_entity_id, target_entity_id),
  -- Prevent self-links
  CONSTRAINT no_self_link CHECK (source_entity_id != target_entity_id)
);

-- Create entity_relationships table for entity-to-entity connections
-- Represents relationships like "Person lived in Place"
CREATE TABLE public.entity_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_entity_id UUID NOT NULL REFERENCES public.document_entities(id) ON DELETE CASCADE,
  target_entity_id UUID NOT NULL REFERENCES public.document_entities(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  relationship_type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Prevent duplicate relationships of same type
  CONSTRAINT unique_relationship UNIQUE (source_entity_id, target_entity_id, relationship_type)
);

-- Enable RLS on both tables
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entity_relationships ENABLE ROW LEVEL SECURITY;

-- RLS policies for entity_links
CREATE POLICY "Users can view their own entity links"
ON public.entity_links
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own entity links"
ON public.entity_links
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entity links"
ON public.entity_links
FOR DELETE
USING (auth.uid() = user_id);

-- RLS policies for entity_relationships
CREATE POLICY "Users can view their own entity relationships"
ON public.entity_relationships
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own entity relationships"
ON public.entity_relationships
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entity relationships"
ON public.entity_relationships
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entity relationships"
ON public.entity_relationships
FOR DELETE
USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX idx_entity_links_source ON public.entity_links(source_entity_id);
CREATE INDEX idx_entity_links_target ON public.entity_links(target_entity_id);
CREATE INDEX idx_entity_links_user ON public.entity_links(user_id);

CREATE INDEX idx_entity_relationships_source ON public.entity_relationships(source_entity_id);
CREATE INDEX idx_entity_relationships_target ON public.entity_relationships(target_entity_id);
CREATE INDEX idx_entity_relationships_user ON public.entity_relationships(user_id);