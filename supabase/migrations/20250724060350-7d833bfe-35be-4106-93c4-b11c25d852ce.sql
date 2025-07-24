-- Add pairing_code column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN pairing_code TEXT UNIQUE;

-- Create a function to generate unique pairing codes
CREATE OR REPLACE FUNCTION generate_pairing_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
    code_exists BOOLEAN := TRUE;
BEGIN
    WHILE code_exists LOOP
        result := '';
        FOR i IN 1..6 LOOP
            result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
        END LOOP;
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM public.profiles WHERE pairing_code = result) INTO code_exists;
    END LOOP;
    
    RETURN result;
END;
$$;

-- Add a trigger to automatically generate pairing codes for new users
CREATE OR REPLACE FUNCTION set_pairing_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.pairing_code IS NULL THEN
        NEW.pairing_code := generate_pairing_code();
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER set_pairing_code_trigger
    BEFORE INSERT ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION set_pairing_code();

-- Generate pairing codes for existing users
UPDATE public.profiles 
SET pairing_code = generate_pairing_code() 
WHERE pairing_code IS NULL;