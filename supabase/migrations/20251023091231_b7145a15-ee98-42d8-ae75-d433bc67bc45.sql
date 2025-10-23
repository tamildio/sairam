-- Remove public RLS policies and make database private
-- This protects tenant financial data from unauthorized access

-- Drop all existing public policies
DROP POLICY IF EXISTS "Allow public read access" ON public.rent_receipts;
DROP POLICY IF EXISTS "Allow public insert access" ON public.rent_receipts;
DROP POLICY IF EXISTS "Allow public update access" ON public.rent_receipts;
DROP POLICY IF EXISTS "Allow public delete access" ON public.rent_receipts;

-- RLS is still enabled, but with no policies, all access is blocked
-- Access will now only be possible through authenticated edge functions