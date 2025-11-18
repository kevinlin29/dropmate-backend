-- =====================================================
-- Add missing columns to shipment_events table
-- =====================================================

-- Add created_by_user_id column
ALTER TABLE shipment_events
ADD COLUMN IF NOT EXISTS created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- Add from_status column
ALTER TABLE shipment_events
ADD COLUMN IF NOT EXISTS from_status VARCHAR(50);

-- Add to_status column
ALTER TABLE shipment_events
ADD COLUMN IF NOT EXISTS to_status VARCHAR(50);

-- Add metadata column for additional contextual information
ALTER TABLE shipment_events
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Create index for faster queries by user
CREATE INDEX IF NOT EXISTS idx_shipment_events_user
    ON shipment_events(created_by_user_id);

-- Add comments to explain the columns
COMMENT ON COLUMN shipment_events.created_by_user_id IS 'ID of the user who triggered this event (driver or customer)';
COMMENT ON COLUMN shipment_events.from_status IS 'Previous status of the shipment before this event';
COMMENT ON COLUMN shipment_events.to_status IS 'New status of the shipment after this event';
COMMENT ON COLUMN shipment_events.metadata IS 'Additional contextual data for the event (JSON format)';
