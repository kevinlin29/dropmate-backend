/**
 * Deduplication Service
 * Prevents duplicate email notifications within a configurable time window
 */
export class DeduplicationService {
  constructor(windowMinutes = 5) {
    this.recentEvents = new Map(); // serviceName -> { replicas, timestamp }
    this.DEDUP_WINDOW_MS = windowMinutes * 60 * 1000;
    this.dedupCount = 0;
  }

  /**
   * Check if a notification should be sent for this event
   * @param {string} serviceName - Name of the service (e.g., 'core-api')
   * @param {number} currentReplicas - Current replica count
   * @returns {boolean} - true if notification should be sent
   */
  shouldSendNotification(serviceName, currentReplicas) {
    const recent = this.recentEvents.get(serviceName);

    // First event for this service
    if (!recent) {
      return true;
    }

    const timeSinceLastEmail = Date.now() - recent.timestamp;
    const replicaChanged = recent.replicas !== currentReplicas;

    // If replicas changed
    if (replicaChanged) {
      const replicaDelta = Math.abs(currentReplicas - recent.replicas);

      // Outside dedup window - always send
      if (timeSinceLastEmail > this.DEDUP_WINDOW_MS) {
        return true;
      }

      // Significant change (≥2 replicas) - send immediately even within window
      if (replicaDelta >= 2) {
        console.log(`⚡ Significant replica change detected (delta: ${replicaDelta}), bypassing dedup window`);
        return true;
      }

      // Minor change within window - skip
      this.dedupCount++;
      console.log(`🔕 Skipping notification for ${serviceName}: minor change within dedup window`);
      return false;
    }

    // No change in replicas
    return false;
  }

  /**
   * Record an event after notification is sent
   * @param {string} serviceName - Name of the service
   * @param {number} replicas - Replica count
   */
  recordEvent(serviceName, replicas) {
    this.recentEvents.set(serviceName, {
      replicas,
      timestamp: Date.now()
    });
  }

  /**
   * Get recent events for debugging/stats
   * @returns {Array} - Array of recent events
   */
  getRecentEvents() {
    const events = [];
    this.recentEvents.forEach((data, serviceName) => {
      events.push({
        serviceName,
        replicas: data.replicas,
        timestamp: new Date(data.timestamp).toISOString(),
        minutesAgo: Math.floor((Date.now() - data.timestamp) / 60000)
      });
    });
    return events;
  }

  /**
   * Get count of deduplicated events
   * @returns {number}
   */
  getDedupCount() {
    return this.dedupCount;
  }

  /**
   * Clear old events (cleanup for long-running service)
   */
  cleanup() {
    const now = Date.now();
    const maxAge = this.DEDUP_WINDOW_MS * 2; // Keep for 2x the window

    let cleanedCount = 0;
    this.recentEvents.forEach((data, serviceName) => {
      if (now - data.timestamp > maxAge) {
        this.recentEvents.delete(serviceName);
        cleanedCount++;
      }
    });

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} old events from deduplication cache`);
    }
  }
}
