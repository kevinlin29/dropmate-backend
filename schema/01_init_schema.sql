-- =====================================================
-- DropMate Database Schema
-- =====================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- Core Tables
-- =====================================================

-- Users table (for authentication)
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'customer', -- customer, driver, admin
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Drivers
CREATE TABLE IF NOT EXISTS drivers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    vehicle_type VARCHAR(100),
    license_number VARCHAR(100),
    status VARCHAR(50) DEFAULT 'offline', -- offline, available, on_delivery
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER REFERENCES customers(id) ON DELETE CASCADE,
    total_amount DECIMAL(10, 2),
    status VARCHAR(50) DEFAULT 'pending', -- pending, confirmed, shipped, delivered
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Shipments (packages)
CREATE TABLE IF NOT EXISTS shipments (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    driver_id INTEGER REFERENCES drivers(id) ON DELETE SET NULL,
    tracking_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, assigned, in_transit, delivered
    pickup_address TEXT,
    delivery_address TEXT,
    pickup_latitude DECIMAL(10, 8),
    pickup_longitude DECIMAL(11, 8),
    delivery_latitude DECIMAL(10, 8),
    delivery_longitude DECIMAL(11, 8),
    sender_name VARCHAR(255),
    sender_phone VARCHAR(50),
    receiver_name VARCHAR(255),
    receiver_phone VARCHAR(50),
    package_weight DECIMAL(10, 2),
    package_description TEXT,
    package_details JSONB DEFAULT '{}'::jsonb,
    deleted_at TIMESTAMP DEFAULT NULL,
    deleted_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index for quick lookup by driver
CREATE INDEX IF NOT EXISTS idx_shipments_driver_id ON shipments(driver_id);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking_number ON shipments(tracking_number);
CREATE INDEX IF NOT EXISTS idx_shipments_pickup_location ON shipments(pickup_latitude, pickup_longitude);
CREATE INDEX IF NOT EXISTS idx_shipments_delivery_location ON shipments(delivery_latitude, delivery_longitude);
CREATE INDEX IF NOT EXISTS idx_shipments_deleted_at ON shipments(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_shipments_sender_phone ON shipments(sender_phone);
CREATE INDEX IF NOT EXISTS idx_shipments_receiver_phone ON shipments(receiver_phone);
CREATE INDEX IF NOT EXISTS idx_shipments_sender_name ON shipments(sender_name);
CREATE INDEX IF NOT EXISTS idx_shipments_receiver_name ON shipments(receiver_name);

-- =====================================================
-- Event/Tracking Tables (Partitioned for scalability)
-- =====================================================

-- Driver Location Events (high-frequency writes)
CREATE TABLE IF NOT EXISTS driver_location_events (
    id BIGSERIAL,
    driver_id INTEGER NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    accuracy DECIMAL(6, 2), -- in meters
    occurred_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX IF NOT EXISTS idx_driver_location_driver_time
    ON driver_location_events(driver_id, occurred_at DESC);

-- Shipment Events (status changes, milestones)
CREATE TABLE IF NOT EXISTS shipment_events (
    id BIGSERIAL,
    shipment_id INTEGER NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- assigned, picked_up, in_transit, delivered
    description TEXT,
    created_by_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    from_status VARCHAR(50),
    to_status VARCHAR(50),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    metadata JSONB DEFAULT '{}'::jsonb,
    occurred_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

CREATE INDEX IF NOT EXISTS idx_shipment_events_shipment_time
    ON shipment_events(shipment_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_shipment_events_user
    ON shipment_events(created_by_user_id);

-- Webhook Events (for external integrations)
CREATE TABLE IF NOT EXISTS webhook_events (
    id BIGSERIAL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB,
    status VARCHAR(50) DEFAULT 'pending',
    occurred_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- Ad Impressions (if needed for analytics)
CREATE TABLE IF NOT EXISTS ad_impressions (
    id BIGSERIAL,
    ad_id INTEGER,
    user_id INTEGER,
    occurred_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (id, occurred_at)
) PARTITION BY RANGE (occurred_at);

-- =====================================================
-- Messages (for customer-driver communication)
-- =====================================================

CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    shipment_id INTEGER REFERENCES shipments(id) ON DELETE CASCADE,
    message TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_shipment ON messages(shipment_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_id, read);
