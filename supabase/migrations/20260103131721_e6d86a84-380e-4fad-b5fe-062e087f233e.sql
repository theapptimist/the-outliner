-- Create prompts table for storing AI generation history
CREATE TABLE public.prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  title TEXT,
  category TEXT,
  items_generated INTEGER DEFAULT 0,
  terms_extracted INTEGER DEFAULT 0,
  document_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.prompts ENABLE ROW LEVEL SECURITY;

-- Users can only view their own prompts
CREATE POLICY "Users can view their own prompts"
ON public.prompts
FOR SELECT
USING (auth.uid() = user_id);

-- Users can create their own prompts
CREATE POLICY "Users can create their own prompts"
ON public.prompts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can delete their own prompts
CREATE POLICY "Users can delete their own prompts"
ON public.prompts
FOR DELETE
USING (auth.uid() = user_id);

-- Add index for faster queries by user
CREATE INDEX idx_prompts_user_id ON public.prompts(user_id);

-- Add index for recent prompts
CREATE INDEX idx_prompts_created_at ON public.prompts(created_at DESC);