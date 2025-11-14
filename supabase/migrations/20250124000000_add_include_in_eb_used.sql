-- Add include_in_eb_used field to rent_receipts table
ALTER TABLE rent_receipts 
ADD COLUMN IF NOT EXISTS include_in_eb_used BOOLEAN DEFAULT true;

-- Set default value for existing records (all existing receipts should be included)
UPDATE rent_receipts 
SET include_in_eb_used = true 
WHERE include_in_eb_used IS NULL;

-- Add comment to document the column
COMMENT ON COLUMN rent_receipts.include_in_eb_used IS 'Whether this receipt should be included in Tenant EB Used calculation. Defaults to true.';



