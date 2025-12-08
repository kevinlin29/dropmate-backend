/**
 * Kubernetes HPA Watcher
 * Watches HPA events and triggers email notifications
 */
import * as k8s from '@kubernetes/client-node';
import { MetricsCollector } from './metricsCollector.js';

export class K8sWatcher {
  constructor(options) {
    this.namespace = options.namespace || 'dropmate';
    this.hpaNames = options.hpaNames || [];
    this.emailService = options.emailService;
    this.dedupService = options.dedupService;

    // Initialize Kubernetes client
    this.kc = new k8s.KubeConfig();
    try {
      // Load from default kubeconfig (in-cluster or local)
      this.kc.loadFromDefault();
    } catch (error) {
      console.error('❌ Failed to load Kubernetes config:', error.message);
      throw error;
    }

    this.coreApi = this.kc.makeApiClient(k8s.CoreV1Api);
    this.autoscalingApi = this.kc.makeApiClient(k8s.AutoscalingV2Api);
    this.metricsClient = new k8s.Metrics(this.kc);

    this.metricsCollector = new MetricsCollector({
      coreApi: this.coreApi,
      autoscalingApi: this.autoscalingApi,
      metricsClient: this.metricsClient
    });

    // Tracking
    this.watching = false;
    this.connected = false;
    this.eventCount = 0;
    this.scaleUpCount = 0;
    this.scaleDownCount = 0;
    this.lastEventTime = null;
    this.hpaStates = new Map(); // Track HPA states to detect changes

    console.log(`🔍 K8s Watcher initialized`);
    console.log(`   Namespace: ${this.namespace}`);
    console.log(`   Watching HPAs: ${this.hpaNames.join(', ')}`);
  }

  /**
   * Start watching HPA events
   */
  async start() {
    console.log('🚀 Starting K8s HPA watcher...');
    this.watching = true;

    // Initial HPA state fetch
    await this.initializeHPAStates();

    // Start watching with auto-reconnect
    while (this.watching) {
      try {
        await this.watchHPAs();
      } catch (error) {
        console.error('❌ Watch connection failed:', error.message);
        this.connected = false;
        console.log('🔄 Reconnecting in 5 seconds...');
        await this.sleep(5000);
      }
    }
  }

  /**
   * Stop watching
   */
  async stop() {
    console.log('🛑 Stopping K8s HPA watcher...');
    this.watching = false;
    this.connected = false;
  }

  /**
   * Initialize HPA states by fetching current values
   */
  async initializeHPAStates() {
    console.log('📊 Fetching initial HPA states...');

    for (const hpaName of this.hpaNames) {
      try {
        const response = await this.autoscalingApi.readNamespacedHorizontalPodAutoscaler(
          hpaName,
          this.namespace
        );
        const hpa = response.body;

        this.hpaStates.set(hpaName, {
          currentReplicas: hpa.status.currentReplicas || 0,
          desiredReplicas: hpa.status.desiredReplicas || 0,
          minReplicas: hpa.spec.minReplicas || 1,
          maxReplicas: hpa.spec.maxReplicas || 10
        });

        console.log(`   ${hpaName}: ${hpa.status.currentReplicas} replicas`);
      } catch (error) {
        console.warn(`   ⚠️  Could not fetch ${hpaName}:`, error.message);
      }
    }
  }

  /**
   * Watch HPA resources
   */
  async watchHPAs() {
    return new Promise(async (resolve, reject) => {
      const watch = new k8s.Watch(this.kc);
      const path = `/apis/autoscaling/v2/namespaces/${this.namespace}/horizontalpodautoscalers`;

      console.log('🔌 Connecting to K8s API for HPA watch...');

      try {
        const req = await watch.watch(
          path,
          {},
          async (type, apiObj) => {
            this.connected = true;
            await this.handleHPAEvent(type, apiObj);
          },
          (err) => {
            this.connected = false;
            if (err) {
              console.error('❌ Watch connection error:', err.message);
              reject(err); // Will trigger reconnect
            } else {
              console.log('👋 Watch connection closed by server');
              reject(new Error('Watch connection closed'));
            }
          }
        );
        this.connected = true;
        console.log('✅ Watch connection established and monitoring events');
        // Note: This promise only resolves when the done callback is called
      } catch (error) {
        this.connected = false;
        console.error('❌ Watch setup failed:', error.message);
        reject(error);
      }
    });
  }

  /**
   * Handle HPA event from K8s watch
   * @param {string} type - Event type (ADDED, MODIFIED, DELETED)
   * @param {Object} hpa - HPA object
   */
  async handleHPAEvent(type, hpa) {
    try {
      const hpaName = hpa.metadata.name;

      // Only process HPAs we're interested in
      if (!this.hpaNames.includes(hpaName)) {
        return;
      }

      // Only process MODIFIED events (where replica counts change)
      if (type !== 'MODIFIED') {
        return;
      }

      const currentReplicas = hpa.status.currentReplicas || 0;
      const desiredReplicas = hpa.status.desiredReplicas || 0;

      // Get previous state
      const previousState = this.hpaStates.get(hpaName);

      if (!previousState) {
        // First time seeing this HPA, just record state
        this.hpaStates.set(hpaName, {
          currentReplicas,
          desiredReplicas,
          minReplicas: hpa.spec.minReplicas,
          maxReplicas: hpa.spec.maxReplicas
        });
        return;
      }

      // Check if currentReplicas actually changed
      if (previousState.currentReplicas === currentReplicas) {
        // Update desired replicas but don't trigger notification
        this.hpaStates.set(hpaName, {
          currentReplicas,
          desiredReplicas,
          minReplicas: hpa.spec.minReplicas,
          maxReplicas: hpa.spec.maxReplicas
        });
        return;
      }

      // Replicas changed - this is a scaling event!
      console.log(`📊 Scaling event detected: ${hpaName}`);
      console.log(`   Previous: ${previousState.currentReplicas} replicas`);
      console.log(`   Current:  ${currentReplicas} replicas`);

      // Update state
      this.hpaStates.set(hpaName, {
        currentReplicas,
        desiredReplicas,
        minReplicas: hpa.spec.minReplicas,
        maxReplicas: hpa.spec.maxReplicas
      });

      // Check deduplication
      const serviceName = hpaName.replace('-hpa', '');
      if (!this.dedupService.shouldSendNotification(serviceName, currentReplicas)) {
        console.log(`🔕 Notification skipped due to deduplication: ${serviceName}`);
        return;
      }

      // Collect metrics and pod status
      console.log(`📈 Collecting metrics for ${hpaName}...`);
      const scalingEvent = await this.metricsCollector.collectScalingMetrics(
        hpaName,
        this.namespace,
        hpa
      );

      // Override old replicas with our tracked value
      scalingEvent.oldReplicas = previousState.currentReplicas;
      scalingEvent.newReplicas = currentReplicas;

      // Send email notification
      console.log(`📧 Sending email notification for ${serviceName}...`);
      const emailSent = await this.emailService.sendScalingAlert(scalingEvent);

      if (emailSent) {
        // Record event in deduplication service
        this.dedupService.recordEvent(serviceName, currentReplicas);

        // Update statistics
        this.eventCount++;
        this.lastEventTime = new Date().toISOString();

        if (currentReplicas > previousState.currentReplicas) {
          this.scaleUpCount++;
        } else {
          this.scaleDownCount++;
        }

        console.log(`✅ Scaling event processed successfully: ${serviceName}`);
      } else {
        console.error(`❌ Failed to send email for ${serviceName}`);
      }
    } catch (error) {
      console.error('❌ Error handling HPA event:', error);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Check if watcher is running
   */
  isWatching() {
    return this.watching;
  }

  /**
   * Check if connected to K8s API
   */
  isConnected() {
    return this.connected;
  }

  /**
   * Get event count
   */
  getEventCount() {
    return this.eventCount;
  }

  /**
   * Get scale up count
   */
  getScaleUpCount() {
    return this.scaleUpCount;
  }

  /**
   * Get scale down count
   */
  getScaleDownCount() {
    return this.scaleDownCount;
  }

  /**
   * Get last event time
   */
  getLastEventTime() {
    return this.lastEventTime;
  }

  /**
   * Get watched HPAs
   */
  getWatchedHPAs() {
    const hpas = [];
    this.hpaStates.forEach((state, name) => {
      hpas.push({
        name,
        ...state
      });
    });
    return hpas;
  }

  /**
   * Get current HPA states
   */
  getCurrentStates() {
    const states = {};
    this.hpaStates.forEach((state, name) => {
      states[name] = state;
    });
    return states;
  }
}
