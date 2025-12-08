# Backend Push Notifications Implementation Guide

This guide covers implementing Expo Push Notifications on your Node.js/Express backend deployed on K8s.

## Overview

You need to:
1. Store device push tokens in PostgreSQL
2. Create API endpoints to register/unregister tokens
3. Send push notifications when shipment events occur
4. Handle Expo Push Notification receipts (optional but recommended)

---

## 1. Database Schema

### Add `push_tokens` table

```sql
CREATE TABLE push_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL UNIQUE,
  device_type VARCHAR(20), -- 'ios' or 'android'
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Ensure one token per user-device combination
  UNIQUE(user_id, token)
);

CREATE INDEX idx_push_tokens_user_id ON push_tokens(user_id);
CREATE INDEX idx_push_tokens_token ON push_tokens(token);
```

### Migration file example

```javascript
// migrations/YYYYMMDDHHMMSS_add_push_tokens.js
exports.up = function(knex) {
  return knex.schema.createTable('push_tokens', (table) => {
    table.increments('id').primary();
    table.integer('user_id').notNullable()
      .references('id').inTable('users').onDelete('CASCADE');
    table.string('token', 255).notNullable().unique();
    table.string('device_type', 20);
    table.timestamp('created_at').defaultTo(knex.fn.now());
    table.timestamp('updated_at').defaultTo(knex.fn.now());
    table.timestamp('last_used_at').defaultTo(knex.fn.now());

    table.unique(['user_id', 'token']);
    table.index('user_id');
    table.index('token');
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('push_tokens');
};
```

---

## 2. Install Expo Push Notification Package

```bash
npm install expo-server-sdk
```

Or add to `package.json`:
```json
{
  "dependencies": {
    "expo-server-sdk": "^3.7.0"
  }
}
```

---

## 3. Create Push Notification Service

Create `services/pushNotificationService.js`:

```javascript
const { Expo } = require('expo-server-sdk');

class PushNotificationService {
  constructor() {
    this.expo = new Expo();
  }

  /**
   * Validate if a token is a valid Expo push token
   */
  isValidToken(token) {
    return Expo.isExpoPushToken(token);
  }

  /**
   * Send push notifications to multiple devices
   * @param {Array} messages - Array of message objects
   * @returns {Promise<Array>} - Array of tickets
   */
  async sendPushNotifications(messages) {
    // Filter out invalid tokens
    const validMessages = messages.filter(msg =>
      this.isValidToken(msg.to)
    );

    if (validMessages.length === 0) {
      console.log('No valid push tokens to send to');
      return [];
    }

    // Chunk messages (Expo has a limit of 100 per request)
    const chunks = this.expo.chunkPushNotifications(validMessages);
    const tickets = [];

    try {
      for (const chunk of chunks) {
        const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
        tickets.push(...ticketChunk);
      }

      // Log any errors
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error') {
          console.error(`Error sending notification to ${validMessages[index].to}:`, ticket.message);

          // Handle invalid tokens
          if (ticket.details && ticket.details.error === 'DeviceNotRegistered') {
            console.log(`Token ${validMessages[index].to} is no longer valid, should be removed`);
            // TODO: Remove invalid token from database
          }
        }
      });

      return tickets;
    } catch (error) {
      console.error('Error sending push notifications:', error);
      throw error;
    }
  }

  /**
   * Send notification to a single user about shipment status
   */
  async sendShipmentStatusNotification(userId, shipment, status) {
    try {
      // Get user's push tokens from database
      const tokens = await this.getUserPushTokens(userId);

      if (tokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return;
      }

      const { title, body, emoji } = this.getShipmentStatusMessage(status, shipment);

      const messages = tokens.map(token => ({
        to: token.token,
        sound: 'default',
        title: `${emoji} ${title}`,
        body,
        data: {
          type: 'shipment-status',
          shipmentId: shipment.id,
          status,
        },
        channelId: 'shipment-updates', // Android only
        priority: 'high',
      }));

      return await this.sendPushNotifications(messages);
    } catch (error) {
      console.error('Error sending shipment status notification:', error);
    }
  }

  /**
   * Send driver proximity notification
   */
  async sendDriverProximityNotification(userId, shipment, estimatedMinutes) {
    try {
      const tokens = await this.getUserPushTokens(userId);

      if (tokens.length === 0) {
        return;
      }

      const messages = tokens.map(token => ({
        to: token.token,
        sound: 'default',
        title: '🚚 Driver Nearby!',
        body: `Your delivery is ${estimatedMinutes} minutes away. Get ready!`,
        data: {
          type: 'driver-proximity',
          shipmentId: shipment.id,
        },
        channelId: 'driver-proximity',
        priority: 'high',
      }));

      return await this.sendPushNotifications(messages);
    } catch (error) {
      console.error('Error sending driver proximity notification:', error);
    }
  }

  /**
   * Get status message for notification
   */
  getShipmentStatusMessage(status, shipment) {
    const trackingNumber = shipment.tracking_number || 'Your package';

    switch (status) {
      case 'pending':
        return {
          emoji: '📋',
          title: 'Order Confirmed',
          body: `${trackingNumber} has been created and is awaiting pickup.`,
        };
      case 'assigned':
        return {
          emoji: '👤',
          title: 'Driver Assigned',
          body: `A driver has been assigned to ${trackingNumber}.`,
        };
      case 'in_transit':
        return {
          emoji: '🚚',
          title: 'Package In Transit',
          body: `${trackingNumber} is on its way to you!`,
        };
      case 'delivered':
        return {
          emoji: '✅',
          title: 'Delivered!',
          body: `${trackingNumber} has been successfully delivered.`,
        };
      default:
        return {
          emoji: '📦',
          title: 'Package Update',
          body: `Status update for ${trackingNumber}`,
        };
    }
  }

  /**
   * Get all push tokens for a user
   */
  async getUserPushTokens(userId) {
    const db = require('../config/database'); // Your DB connection

    try {
      const result = await db.query(
        'SELECT token, device_type FROM push_tokens WHERE user_id = $1',
        [userId]
      );
      return result.rows;
    } catch (error) {
      console.error('Error fetching user push tokens:', error);
      return [];
    }
  }

  /**
   * Remove invalid token from database
   */
  async removeInvalidToken(token) {
    const db = require('../config/database');

    try {
      await db.query('DELETE FROM push_tokens WHERE token = $1', [token]);
      console.log(`Removed invalid token: ${token}`);
    } catch (error) {
      console.error('Error removing invalid token:', error);
    }
  }
}

module.exports = new PushNotificationService();
```

---

## 4. Create API Endpoints

Add to your user routes (`routes/users.js` or similar):

```javascript
const express = require('express');
const router = express.Router();
const pushNotificationService = require('../services/pushNotificationService');
const db = require('../config/database'); // Your DB connection
const { authenticateUser } = require('../middleware/auth'); // Your auth middleware

/**
 * Register push notification token
 * POST /api/users/me/push-token
 */
router.post('/me/push-token', authenticateUser, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id; // From auth middleware

  // Validate token format
  if (!token || !pushNotificationService.isValidToken(token)) {
    return res.status(400).json({
      error: 'Invalid push token format'
    });
  }

  try {
    // Determine device type from token
    const deviceType = token.includes('ExponentPushToken')
      ? 'expo'
      : token.startsWith('ios:') ? 'ios' : 'android';

    // Insert or update token
    await db.query(`
      INSERT INTO push_tokens (user_id, token, device_type, last_used_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (user_id, token)
      DO UPDATE SET
        last_used_at = NOW(),
        updated_at = NOW()
    `, [userId, token, deviceType]);

    res.json({
      message: 'Push token registered successfully',
      token
    });
  } catch (error) {
    console.error('Error registering push token:', error);
    res.status(500).json({
      error: 'Failed to register push token'
    });
  }
});

/**
 * Unregister push notification token
 * DELETE /api/users/me/push-token
 */
router.delete('/me/push-token', authenticateUser, async (req, res) => {
  const { token } = req.body;
  const userId = req.user.id;

  if (!token) {
    return res.status(400).json({
      error: 'Token is required'
    });
  }

  try {
    await db.query(
      'DELETE FROM push_tokens WHERE user_id = $1 AND token = $2',
      [userId, token]
    );

    res.json({
      message: 'Push token unregistered successfully'
    });
  } catch (error) {
    console.error('Error unregistering push token:', error);
    res.status(500).json({
      error: 'Failed to unregister push token'
    });
  }
});

module.exports = router;
```

---

## 5. Integrate with Shipment Status Changes

Find where you update shipment status (likely in your shipment routes), and add notification sending:

```javascript
const pushNotificationService = require('../services/pushNotificationService');

/**
 * Example: Update shipment status endpoint
 * PATCH /api/shipments/:id/status
 */
router.patch('/:id/status', authenticateDriver, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    // Update shipment in database
    const result = await db.query(
      `UPDATE shipments
       SET status = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [status, id]
    );

    const shipment = result.rows[0];

    if (!shipment) {
      return res.status(404).json({ error: 'Shipment not found' });
    }

    // Get user ID from shipment (adjust based on your schema)
    const userId = shipment.user_id || shipment.customer_id;

    // Send push notification asynchronously (don't block response)
    if (userId) {
      pushNotificationService.sendShipmentStatusNotification(
        userId,
        shipment,
        status
      ).catch(err => {
        console.error('Failed to send push notification:', err);
        // Don't fail the request if notification fails
      });
    }

    res.json({
      message: 'Shipment status updated',
      shipment
    });
  } catch (error) {
    console.error('Error updating shipment:', error);
    res.status(500).json({ error: 'Failed to update shipment' });
  }
});
```

---

## 6. Driver Proximity Detection

Add to your location update handler (in notification service or wherever you handle driver location):

```javascript
/**
 * Calculate distance between two coordinates (Haversine formula)
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Handle driver location update
 */
async function handleDriverLocationUpdate(driverId, latitude, longitude) {
  try {
    // Get active shipments for this driver
    const shipments = await db.query(`
      SELECT s.*, u.id as user_id, s.delivery_latitude, s.delivery_longitude
      FROM shipments s
      JOIN users u ON s.user_id = u.id
      WHERE s.driver_id = $1
        AND s.status IN ('assigned', 'in_transit')
        AND s.delivery_latitude IS NOT NULL
        AND s.delivery_longitude IS NOT NULL
    `, [driverId]);

    for (const shipment of shipments.rows) {
      const distance = calculateDistance(
        latitude,
        longitude,
        shipment.delivery_latitude,
        shipment.delivery_longitude
      );

      // If within 1km and haven't sent proximity notification yet
      if (distance <= 1.0) {
        // Check if we already sent proximity notification
        const sent = await checkProximityNotificationSent(shipment.id);

        if (!sent) {
          const estimatedMinutes = Math.round((distance / 30) * 60); // Assume 30 km/h

          await pushNotificationService.sendDriverProximityNotification(
            shipment.user_id,
            shipment,
            estimatedMinutes
          );

          // Mark as sent to avoid spam
          await markProximityNotificationSent(shipment.id);
        }
      }
    }
  } catch (error) {
    console.error('Error in driver location update:', error);
  }
}

// Track which shipments already got proximity notification
const proximityNotificationsSent = new Set();

async function checkProximityNotificationSent(shipmentId) {
  return proximityNotificationsSent.has(shipmentId);
}

async function markProximityNotificationSent(shipmentId) {
  proximityNotificationsSent.add(shipmentId);

  // Clear after delivery
  setTimeout(() => {
    proximityNotificationsSent.delete(shipmentId);
  }, 24 * 60 * 60 * 1000); // 24 hours
}
```

---

## 7. Environment Variables

Add to your `.env` or ConfigMap in K8s:

```bash
# No additional env vars needed for Expo Push Notifications
# The expo-server-sdk handles everything
```

---

## 8. Kubernetes Deployment

Update your K8s deployment to include the new package:

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: dropmate-api
spec:
  template:
    spec:
      containers:
      - name: api
        image: your-registry/dropmate-api:latest
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: dropmate-secrets
              key: database-url
        # Add any other env vars
```

**Deployment steps:**

```bash
# 1. Build new Docker image with updated package.json
docker build -t your-registry/dropmate-api:v2.x .

# 2. Push to registry
docker push your-registry/dropmate-api:v2.x

# 3. Update K8s deployment
kubectl set image deployment/dropmate-api api=your-registry/dropmate-api:v2.x

# 4. Run database migration
kubectl exec -it <api-pod> -- npm run migrate
# Or however you run migrations
```

---

## 9. Testing

### Test token registration:
```bash
curl -X POST https://your-api.com/api/users/me/push-token \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"token":"ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]"}'
```

### Test notification manually:
```javascript
// Add a test endpoint (remove in production)
router.post('/test-notification', authenticateUser, async (req, res) => {
  const userId = req.user.id;

  await pushNotificationService.sendPushNotifications([{
    to: req.body.token,
    title: 'Test Notification',
    body: 'This is a test from your backend!',
    data: { type: 'test' }
  }]);

  res.json({ message: 'Test notification sent' });
});
```

---

## 10. Error Handling & Monitoring

### Log invalid tokens:
```javascript
// In your push notification service, handle errors
tickets.forEach((ticket, index) => {
  if (ticket.status === 'error') {
    if (ticket.details?.error === 'DeviceNotRegistered') {
      // Token no longer valid - remove from DB
      this.removeInvalidToken(messages[index].to);
    }
  }
});
```

### Add monitoring:
```javascript
// Track notification metrics
const metrics = {
  sent: 0,
  failed: 0,
  invalidTokens: 0
};

// Log to your monitoring system (DataDog, CloudWatch, etc.)
```

---

## Summary of Changes

### Database:
- ✅ Add `push_tokens` table

### Code:
- ✅ Install `expo-server-sdk`
- ✅ Create `services/pushNotificationService.js`
- ✅ Add POST/DELETE `/api/users/me/push-token` endpoints
- ✅ Integrate with shipment status updates
- ✅ Add driver proximity detection

### Deployment:
- ✅ Rebuild Docker image
- ✅ Run database migration
- ✅ Deploy to K8s

That's it! The mobile app will automatically start receiving push notifications when shipment events occur.
