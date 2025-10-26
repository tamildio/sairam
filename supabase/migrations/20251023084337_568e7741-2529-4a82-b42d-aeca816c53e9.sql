-- Add UPDATE and DELETE policies for rent_receipts table
-- This enables the payment recording feature and allows data management

CREATE POLICY "Allow public update access"
ON public.rent_receipts
FOR UPDATE
USING (true)
WITH CHECK (true);

CREATE POLICY "Allow public delete access"
ON public.rent_receipts
FOR DELETE
USING (true);