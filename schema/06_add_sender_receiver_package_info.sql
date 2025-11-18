-- =====================================================
-- Add sender, receiver, and package information to shipments
-- =====================================================

-- Add sender information
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS sender_phone VARCHAR(50);

-- Add receiver information
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS receiver_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS receiver_phone VARCHAR(50);

-- Add package details
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS package_weight DECIMAL(10,2), -- in kilograms
ADD COLUMN IF NOT EXISTS package_description TEXT,
ADD COLUMN IF NOT EXISTS package_details JSONB DEFAULT '{}'::jsonb;

-- Create indexes for searching by sender/receiver
CREATE INDEX IF NOT EXISTS idx_shipments_sender_phone ON shipments(sender_phone);
CREATE INDEX IF NOT EXISTS idx_shipments_receiver_phone ON shipments(receiver_phone);
CREATE INDEX IF NOT EXISTS idx_shipments_sender_name ON shipments(sender_name);
CREATE INDEX IF NOT EXISTS idx_shipments_receiver_name ON shipments(receiver_name);

-- Add comments for documentation
COMMENT ON COLUMN shipments.sender_name IS 'Full name of the package sender';
COMMENT ON COLUMN shipments.sender_phone IS 'Contact phone number of sender';
COMMENT ON COLUMN shipments.receiver_name IS 'Full name of the package receiver';
COMMENT ON COLUMN shipments.receiver_phone IS 'Contact phone number of receiver';
COMMENT ON COLUMN shipments.package_weight IS 'Package weight in kilograms';
COMMENT ON COLUMN shipments.package_description IS 'Description of package contents and handling instructions';
COMMENT ON COLUMN shipments.package_details IS 'Additional package metadata (dimensions, fragile, etc.) in JSON format';
