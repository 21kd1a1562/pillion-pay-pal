-- Allow partners to view their paired rider's settings
CREATE POLICY "Partners can view paired rider settings" 
ON public.settings 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = auth.uid() 
    AND role = 'partner' 
    AND paired_rider_id = settings.rider_id
  )
);