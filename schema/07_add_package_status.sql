-- =====================================================
-- Add package_status field to track delivery state
-- =====================================================

-- Add package_status column to shipments table
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS package_status VARCHAR(50) DEFAULT NULL;

-- Add comment to describe the field
COMMENT ON COLUMN shipments.package_status IS 'Optional field tracking package delivery state: out_for_delivery, in_transit, delivered, exceptions';

-- Create index for filtering by package status
CREATE INDEX IF NOT EXISTS idx_shipments_package_status ON shipments(package_status) WHERE package_status IS NOT NULL;
