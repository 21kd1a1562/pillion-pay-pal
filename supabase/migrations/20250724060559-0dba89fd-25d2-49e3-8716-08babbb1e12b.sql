-- Add paired_rider_id column to profiles table for partner accounts
ALTER TABLE public.profiles 
ADD COLUMN paired_rider_id UUID REFERENCES auth.users(id);