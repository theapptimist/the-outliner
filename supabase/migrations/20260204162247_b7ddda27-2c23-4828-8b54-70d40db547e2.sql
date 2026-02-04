-- Add start_with_outline column to user_settings
ALTER TABLE public.user_settings
ADD COLUMN start_with_outline boolean NOT NULL DEFAULT true;