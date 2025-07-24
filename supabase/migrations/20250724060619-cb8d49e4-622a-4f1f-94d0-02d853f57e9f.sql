-- Add paired_rider_id column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN paired_rider_id UUID;