-- Allow users to view profiles by pairing code for pairing functionality
CREATE POLICY "Users can view profiles by pairing code" 
ON public.profiles 
FOR SELECT 
USING (pairing_code IS NOT NULL AND role = 'rider');