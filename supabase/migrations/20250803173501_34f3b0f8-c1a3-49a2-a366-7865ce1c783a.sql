-- Create function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
$$;

-- Create trigger to automatically create profile on user signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Update the generate_pairing_code function with proper search_path
CREATE OR REPLACE FUNCTION public.generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
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
$$;