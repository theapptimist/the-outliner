-- Add is_master column to documents table
ALTER TABLE public.documents ADD COLUMN is_master boolean DEFAULT false;