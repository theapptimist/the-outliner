-- Add source_document_id to entities table to track where entities originated from
ALTER TABLE public.entities 
ADD COLUMN IF NOT EXISTS source_document_id uuid REFERENCES public.documents(id) ON DELETE SET NULL;

-- Create an index for efficient filtering by source document
CREATE INDEX IF NOT EXISTS idx_entities_source_document 
ON public.entities(source_document_id) 
WHERE source_document_id IS NOT NULL;