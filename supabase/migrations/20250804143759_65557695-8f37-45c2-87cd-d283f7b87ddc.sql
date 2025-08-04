-- Phase 1: Fix database function search paths for security
-- Update handle_new_user function with secure search path
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, email, role, pairing_code)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'rider')::user_role,
    CASE 
      WHEN COALESCE(NEW.raw_user_meta_data ->> 'role', 'rider') = 'rider' 
      THEN generate_pairing_code() 
      ELSE NULL 
    END
  );
  RETURN NEW;
END;
$function$;

-- Update generate_pairing_code function with secure search path
CREATE OR REPLACE FUNCTION public.generate_pairing_code()
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = 'public'
AS $function$
DECLARE
  code TEXT;
BEGIN
  -- Generate a 6-character alphanumeric code
  code := upper(substring(md5(random()::text) from 1 for 6));
  
  -- Ensure uniqueness by checking against existing codes
  WHILE EXISTS (SELECT 1 FROM profiles WHERE pairing_code = code) LOOP
    code := upper(substring(md5(random()::text) from 1 for 6));
  END LOOP;
  
  RETURN code;
END;
$function$;

-- Phase 3: Add input validation constraints
-- Add check constraints for data validation
ALTER TABLE public.settings 
ADD CONSTRAINT check_daily_petrol_cost_positive 
CHECK (daily_petrol_cost >= 0 AND daily_petrol_cost <= 10000);

ALTER TABLE public.attendance 
ADD CONSTRAINT check_attendance_amount_positive 
CHECK (amount >= 0 AND amount <= 10000);

ALTER TABLE public.attendance 
ADD CONSTRAINT check_attendance_status_valid 
CHECK (status IN ('present', 'absent', 'partial'));

-- Add constraint for pairing code format (6 alphanumeric characters)
ALTER TABLE public.profiles 
ADD CONSTRAINT check_pairing_code_format 
CHECK (pairing_code IS NULL OR (pairing_code ~ '^[A-Z0-9]{6}$'));

-- Phase 4: Enhance RLS policies with better security
-- Add rate limiting consideration by adding created_at checks for pairing attempts
-- Drop and recreate the pairing code policy with additional security
DROP POLICY IF EXISTS "Users can view profiles by pairing code" ON public.profiles;

CREATE POLICY "Users can view profiles by pairing code" 
ON public.profiles 
FOR SELECT 
USING (
  pairing_code IS NOT NULL 
  AND role = 'rider'::user_role
  AND created_at > (now() - interval '30 days') -- Only allow pairing with recent accounts
);