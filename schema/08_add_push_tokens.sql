-- =====================================================
-- Add push_tokens table for Expo Push Notifications
-- =====================================================

CREATE TABLE IF NOT EXISTS push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  device_type VARCHAR(20), -- 'ios', 'android', or 'expo'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one token per user-device combination
  UNIQUE(user_id, token)
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_push_tokens_token ON push_tokens(token);

-- Add comment to describe the table
COMMENT ON TABLE push_tokens IS 'Stores Expo push notification tokens for mobile app users';
