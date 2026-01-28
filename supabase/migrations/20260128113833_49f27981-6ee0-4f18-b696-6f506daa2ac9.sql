-- Create table for user outline style preferences
CREATE TABLE public.user_style_preferences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  custom_styles JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_style_id TEXT,
  current_mixed_config JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT user_style_preferences_user_id_key UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.user_style_preferences ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own style preferences"
ON public.user_style_preferences
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own style preferences"
ON public.user_style_preferences
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own style preferences"
ON public.user_style_preferences
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own style preferences"
ON public.user_style_preferences
FOR DELETE
USING (auth.uid() = user_id);

-- Add trigger for updated_at
CREATE TRIGGER update_user_style_preferences_updated_at
BEFORE UPDATE ON public.user_style_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();