import { Expo } from 'expo-server-sdk';
import db from '../models/db.js';

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
            console.log(`Token ${validMessages[index].to} is no longer valid, removing from database`);
            this.removeInvalidToken(validMessages[index].to).catch(err => {
              console.error('Error removing invalid token:', err);
            });
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
          trackingNumber: shipment.tracking_number,
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
   * Send notification to a single user about package status
   */
  async sendPackageStatusNotification(userId, shipment, packageStatus) {
    try {
      const tokens = await this.getUserPushTokens(userId);

      if (tokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return;
      }

      const { title, body, emoji } = this.getPackageStatusMessage(packageStatus, shipment);

      const messages = tokens.map(token => ({
        to: token.token,
        sound: 'default',
        title: `${emoji} ${title}`,
        body,
        data: {
          type: 'package-status',
          shipmentId: shipment.id,
          trackingNumber: shipment.tracking_number,
          packageStatus,
        },
        channelId: 'shipment-updates',
        priority: 'high',
      }));

      return await this.sendPushNotifications(messages);
    } catch (error) {
      console.error('Error sending package status notification:', error);
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
          trackingNumber: shipment.tracking_number,
          estimatedMinutes,
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
   * Get status message for shipment status notification
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
   * Get status message for package status notification
   */
  getPackageStatusMessage(packageStatus, shipment) {
    const trackingNumber = shipment.tracking_number || 'Your package';

    switch (packageStatus) {
      case 'out_for_delivery':
        return {
          emoji: '🚚',
          title: 'Out for Delivery',
          body: `${trackingNumber} is out for delivery and will arrive soon!`,
        };
      case 'in_transit':
        return {
          emoji: '📦',
          title: 'In Transit',
          body: `${trackingNumber} is on its way to the delivery location.`,
        };
      case 'delivered':
        return {
          emoji: '✅',
          title: 'Delivered!',
          body: `${trackingNumber} has been delivered successfully.`,
        };
      case 'exceptions':
        return {
          emoji: '⚠️',
          title: 'Delivery Exception',
          body: `There was an issue with ${trackingNumber}. Please check the details.`,
        };
      default:
        return {
          emoji: '📦',
          title: 'Package Update',
          body: `Update for ${trackingNumber}`,
        };
    }
  }

  /**
   * Get all push tokens for a user
   */
  async getUserPushTokens(userId) {
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
    try {
      await db.query('DELETE FROM push_tokens WHERE token = $1', [token]);
      console.log(`Removed invalid token: ${token}`);
    } catch (error) {
      console.error('Error removing invalid token:', error);
    }
  }
}

export default new PushNotificationService();
