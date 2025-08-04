-- Enable realtime for requests table
ALTER TABLE public.requests REPLICA IDENTITY FULL;

-- Add requests table to realtime publication  
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;