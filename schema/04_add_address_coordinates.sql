-- =====================================================
-- Add coordinate fields to shipments for better routing
-- =====================================================

-- Add pickup coordinates
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(11, 8);

-- Add delivery coordinates
ALTER TABLE shipments
ADD COLUMN IF NOT EXISTS delivery_latitude DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS delivery_longitude DECIMAL(11, 8);

-- Create indexes for spatial queries (useful for finding nearby shipments)
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_location
    ON shipments(pickup_latitude, pickup_longitude);

CREATE INDEX IF NOT EXISTS idx_shipments_delivery_location
    ON shipments(delivery_latitude, delivery_longitude);

-- Add comments
COMMENT ON COLUMN shipments.pickup_latitude IS 'Pickup location latitude from Google Maps';
COMMENT ON COLUMN shipments.pickup_longitude IS 'Pickup location longitude from Google Maps';
COMMENT ON COLUMN shipments.delivery_latitude IS 'Delivery location latitude from Google Maps';
COMMENT ON COLUMN shipments.delivery_longitude IS 'Delivery location longitude from Google Maps';
