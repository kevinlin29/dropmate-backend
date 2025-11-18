-- =====================================================
-- Add soft delete support to shipments table
-- =====================================================

-- Add deleted_at column for soft deletes
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL;

-- Add deleted_by_user_id to track who deleted it
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS deleted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Create index for filtering out deleted shipments (for performance)
CREATE INDEX IF NOT EXISTS idx_shipments_deleted_at
    ON shipments(deleted_at) WHERE deleted_at IS NULL;

-- Add comments
COMMENT ON COLUMN shipments.deleted_at IS 'Timestamp when shipment was soft deleted (NULL = not deleted)';
COMMENT ON COLUMN shipments.deleted_by_user_id IS 'User who deleted the shipment (customer or admin)';
