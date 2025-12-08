/**
 * Scaling Monitor Service
 * Watches Kubernetes HPA events and sends email notifications
 */
import express from 'express';
import dotenv from 'dotenv';
import { K8sWatcher } from './k8sWatcher.js';
import { EmailService } from './emailService.js';
import { DeduplicationService } from './deduplicationService.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8083;

// Configuration
const K8S_NAMESPACE = process.env.K8S_NAMESPACE || 'dropmate';
const WATCHED_HPAS = (process.env.WATCHED_HPAS || 'core-api-hpa,location-service-hpa,notification-service-hpa')
  .split(',')
  .map(hpa => hpa.trim())
  .filter(hpa => hpa.length > 0);
const DEDUP_WINDOW_MINUTES = parseInt(process.env.DEDUP_WINDOW_MINUTES || '5');

console.log('🚀 Starting DropMate Scaling Monitor Service...');
console.log(`   Node Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`   Port: ${PORT}`);
console.log(`   Kubernetes Namespace: ${K8S_NAMESPACE}`);
console.log(`   Watched HPAs: ${WATCHED_HPAS.join(', ')}`);
console.log(`   Deduplication Window: ${DEDUP_WINDOW_MINUTES} minutes`);

// Initialize services
let emailService;
let dedupService;
let k8sWatcher;

try {
  emailService = new EmailService();
  dedupService = new DeduplicationService(DEDUP_WINDOW_MINUTES);
  k8sWatcher = new K8sWatcher({
    namespace: K8S_NAMESPACE,
    hpaNames: WATCHED_HPAS,
    emailService,
    dedupService
  });
} catch (error) {
  console.error('❌ Failed to initialize services:', error);
  process.exit(1);
}

// Health check endpoint
app.get('/health', (req, res) => {
  const health = {
    status: 'healthy',
    service: 'scaling-monitor-service',
    checks: {
      k8sConnection: k8sWatcher.isConnected(),
      sendgridConfigured: !!process.env.SENDGRID_API_KEY,
      adminEmailsConfigured: !!process.env.ADMIN_EMAILS,
      watcherRunning: k8sWatcher.isWatching(),
      lastEventReceived: k8sWatcher.getLastEventTime(),
      eventsProcessed: k8sWatcher.getEventCount()
    },
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime())
  };

  // If any critical check fails, return 503
  const isHealthy = health.checks.sendgridConfigured &&
                    health.checks.adminEmailsConfigured &&
                    health.checks.watcherRunning;

  const statusCode = isHealthy ? 200 : 503;
  res.status(statusCode).json(health);
});

// Stats endpoint
app.get('/stats', (req, res) => {
  const emailStats = emailService.getStats();
  const dedupStats = {
    recentEvents: dedupService.getRecentEvents(),
    dedupCount: dedupService.getDedupCount()
  };

  res.json({
    service: 'scaling-monitor-service',
    uptime: Math.floor(process.uptime()),

    // Event statistics
    events: {
      total: k8sWatcher.getEventCount(),
      scaleUp: k8sWatcher.getScaleUpCount(),
      scaleDown: k8sWatcher.getScaleDownCount(),
      emailsSent: emailStats.sentCount,
      emailsFailed: emailStats.failedCount,
      deduplicated: dedupStats.dedupCount
    },

    // Recent events
    recentEvents: dedupStats.recentEvents,

    // Watched HPAs current state
    watchedHPAs: k8sWatcher.getWatchedHPAs(),

    // Configuration
    config: {
      namespace: K8S_NAMESPACE,
      watchedHPANames: WATCHED_HPAS,
      dedupWindowMinutes: DEDUP_WINDOW_MINUTES,
      adminEmailCount: emailStats.adminEmails.length,
      senderEmail: emailStats.senderEmail
    },

    // Status
    status: {
      watching: k8sWatcher.isWatching(),
      connected: k8sWatcher.isConnected(),
      lastEventTime: k8sWatcher.getLastEventTime()
    },

    timestamp: new Date().toISOString()
  });
});

// Start HTTP server
const server = app.listen(PORT, () => {
  console.log(`✅ HTTP server started on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Stats: http://localhost:${PORT}/stats`);
});

// Start K8s watcher
(async () => {
  try {
    await k8sWatcher.start();
  } catch (error) {
    console.error('❌ Failed to start K8s watcher:', error);
    process.exit(1);
  }
})();

// Periodic cleanup of deduplication cache (every hour)
setInterval(() => {
  dedupService.cleanup();
}, 60 * 60 * 1000);

// Graceful shutdown
const shutdown = async (signal) => {
  console.log(`\n👋 Received ${signal}, shutting down gracefully...`);

  // Stop accepting new requests
  server.close(() => {
    console.log('✅ HTTP server closed');
  });

  // Stop K8s watcher
  await k8sWatcher.stop();
  console.log('✅ K8s watcher stopped');

  // Final stats
  console.log('\n📊 Final Statistics:');
  console.log(`   Events Processed: ${k8sWatcher.getEventCount()}`);
  console.log(`   Scale Ups: ${k8sWatcher.getScaleUpCount()}`);
  console.log(`   Scale Downs: ${k8sWatcher.getScaleDownCount()}`);
  console.log(`   Emails Sent: ${emailService.getSentCount()}`);
  console.log(`   Emails Failed: ${emailService.getFailedCount()}`);
  console.log(`   Deduplicated: ${dedupService.getDedupCount()}`);

  console.log('\n✅ Shutdown complete');
  process.exit(0);
};

// Handle shutdown signals
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  shutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  shutdown('unhandledRejection');
});

console.log('\n✅ Scaling Monitor Service is running');
console.log('   Watching for HPA scaling events...\n');
