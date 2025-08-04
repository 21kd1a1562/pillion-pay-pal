-- Enable realtime for requests table
ALTER TABLE public.requests REPLICA IDENTITY FULL;

-- Add requests table to realtime publication
SELECT cron.schedule('add_requests_to_realtime', '* * * * *', 'INSERT INTO supabase_realtime.subscription (subscription_id, entity, filters, claims, created_at) VALUES (gen_random_uuid(), ''public.requests'', ''[]'', ''{"role": "authenticated"}'', now()) ON CONFLICT DO NOTHING;');

-- Alternative approach - directly add to publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.requests;