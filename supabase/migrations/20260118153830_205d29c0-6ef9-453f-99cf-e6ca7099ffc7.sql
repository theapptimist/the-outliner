-- Create document_entities table for persisting People, Places, Dates, and Terms
CREATE TABLE public.document_entities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('person', 'place', 'date', 'term')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast queries by document and type
CREATE INDEX idx_document_entities_doc_type ON public.document_entities(document_id, entity_type);

-- Create index for user queries
CREATE INDEX idx_document_entities_user ON public.document_entities(user_id);

-- Enable Row Level Security
ALTER TABLE public.document_entities ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own entities
CREATE POLICY "Users can view their own entities"
ON public.document_entities
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own entities"
ON public.document_entities
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own entities"
ON public.document_entities
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own entities"
ON public.document_entities
FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for automatic timestamp updates
CREATE TRIGGER update_document_entities_updated_at
BEFORE UPDATE ON public.document_entities
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();