/**
 * Email Service
 * Handles sending emails via SendGrid
 */
import sgMail from '@sendgrid/mail';
import { generateScalingEmailHTML, generateScalingEmailText } from './templates/scalingEmail.js';

export class EmailService {
  constructor() {
    this.initialized = false;
    this.sentCount = 0;
    this.failedCount = 0;

    // Initialize SendGrid
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.error('❌ SENDGRID_API_KEY not configured');
      return;
    }

    sgMail.setApiKey(apiKey);
    this.initialized = true;

    // Parse admin emails
    this.adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (this.adminEmails.length === 0) {
      console.warn('⚠️  No admin emails configured in ADMIN_EMAILS');
    }

    this.senderEmail = process.env.SENDGRID_SENDER_EMAIL || 'noreply@dropmate.com';

    console.log(`📧 Email service initialized`);
    console.log(`   Sender: ${this.senderEmail}`);
    console.log(`   Recipients: ${this.adminEmails.join(', ')}`);
  }

  /**
   * Sleep utility for retry logic
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send scaling alert email
   * @param {Object} scalingEvent - Scaling event data
   * @returns {Promise<boolean>} - true if sent successfully
   */
  async sendScalingAlert(scalingEvent) {
    if (!this.initialized) {
      console.error('❌ Email service not initialized');
      this.failedCount++;
      return false;
    }

    if (this.adminEmails.length === 0) {
      console.error('❌ No admin emails configured');
      this.failedCount++;
      return false;
    }

    const isScaleUp = scalingEvent.newReplicas > scalingEvent.oldReplicas;
    const emoji = isScaleUp ? '🚀' : '📉';
    const eventType = isScaleUp ? 'Scale Up' : 'Scale Down';

    const msg = {
      to: this.adminEmails,
      from: this.senderEmail,
      subject: `${emoji} ${eventType}: ${scalingEvent.serviceName} (${scalingEvent.namespace})`,
      text: generateScalingEmailText(scalingEvent),
      html: generateScalingEmailHTML(scalingEvent),
    };

    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        await sgMail.send(msg);
        this.sentCount++;
        console.log(`✅ Email sent successfully: ${scalingEvent.serviceName} (${scalingEvent.oldReplicas} → ${scalingEvent.newReplicas})`);
        console.log(`   Recipients: ${this.adminEmails.join(', ')}`);
        return true;
      } catch (error) {
        attempt++;

        // Rate limiting (HTTP 429)
        if (error.code === 429) {
          const backoffMs = Math.pow(2, attempt) * 1000;
          console.log(`⏳ SendGrid rate limited, retrying in ${backoffMs}ms... (attempt ${attempt}/${maxRetries})`);
          await this.sleep(backoffMs);
          continue;
        }

        // Other errors
        console.error(`❌ Failed to send email (attempt ${attempt}/${maxRetries}):`, {
          message: error.message,
          code: error.code,
          response: error.response?.body
        });

        // If not rate limit and not last attempt, wait a bit before retry
        if (attempt < maxRetries) {
          await this.sleep(1000);
        }
      }
    }

    // All retries failed
    this.failedCount++;
    console.error(`❌ Email send failed after ${maxRetries} attempts for ${scalingEvent.serviceName}`);

    // Log failed email details for debugging
    this.logFailedEmail(scalingEvent);

    return false;
  }

  /**
   * Log failed email for debugging
   */
  logFailedEmail(scalingEvent) {
    console.error('Failed email details:', {
      service: scalingEvent.serviceName,
      namespace: scalingEvent.namespace,
      replicaChange: `${scalingEvent.oldReplicas} → ${scalingEvent.newReplicas}`,
      trigger: scalingEvent.trigger,
      timestamp: scalingEvent.timestamp,
      recipients: this.adminEmails
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      sentCount: this.sentCount,
      failedCount: this.failedCount,
      adminEmails: this.adminEmails,
      senderEmail: this.senderEmail,
      initialized: this.initialized
    };
  }

  /**
   * Get sent count
   */
  getSentCount() {
    return this.sentCount;
  }

  /**
   * Get failed count
   */
  getFailedCount() {
    return this.failedCount;
  }
}
