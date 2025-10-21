-- Create rent_receipts table to store receipt history
CREATE TABLE public.rent_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_date DATE NOT NULL,
  tenant_name TEXT NOT NULL,
  eb_reading_last_month DECIMAL NOT NULL,
  eb_reading_this_month DECIMAL NOT NULL,
  eb_rate_per_unit DECIMAL NOT NULL,
  units_consumed DECIMAL NOT NULL,
  eb_charges DECIMAL NOT NULL,
  rent_amount DECIMAL NOT NULL,
  total_amount DECIMAL NOT NULL,
  received_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.rent_receipts ENABLE ROW LEVEL SECURITY;

-- Create policy to allow anyone to read receipts (no authentication required)
CREATE POLICY "Allow public read access"
  ON public.rent_receipts
  FOR SELECT
  USING (true);

-- Create policy to allow anyone to insert receipts (no authentication required)
CREATE POLICY "Allow public insert access"
  ON public.rent_receipts
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries on created_at
CREATE INDEX idx_rent_receipts_created_at ON public.rent_receipts(created_at DESC);