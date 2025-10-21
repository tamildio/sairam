-- Make received_date nullable since payment may be recorded later
ALTER TABLE public.rent_receipts 
ALTER COLUMN received_date DROP NOT NULL;