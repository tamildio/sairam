-- Add receipts_count field to rent_receipts table
ALTER TABLE rent_receipts 
ADD COLUMN receipts_count INTEGER DEFAULT NULL;

-- Add comment to explain the field
COMMENT ON COLUMN rent_receipts.receipts_count IS 'Number of tenant receipts used for aggregation in Tenant EB Used records';
