/**
 * Metrics Collector
 * Collects metrics and pod status from Kubernetes
 */
export class MetricsCollector {
  constructor(k8sClients) {
    this.coreApi = k8sClients.coreApi;
    this.autoscalingApi = k8sClients.autoscalingApi;
    this.metricsClient = k8sClients.metricsClient;
  }

  /**
   * Collect comprehensive scaling metrics for an HPA event
   * @param {string} hpaName - HPA name (e.g., 'core-api-hpa')
   * @param {string} namespace - Kubernetes namespace
   * @param {Object} hpa - HPA object from K8s API
   * @returns {Object} - Metrics and pod status data
   */
  async collectScalingMetrics(hpaName, namespace, hpa) {
    try {
      // Extract service/app name from HPA name (e.g., 'core-api-hpa' → 'core-api')
      const appLabel = hpaName.replace('-hpa', '');

      // Get pod status
      const pods = await this.getPodStatus(namespace, appLabel);

      // Extract HPA metrics
      const hpaMetrics = this.extractHPAMetrics(hpa);

      // Determine trigger type
      const trigger = this.detectTrigger(hpa, hpaMetrics);

      return {
        serviceName: appLabel,
        appLabel,
        hpaName,
        namespace,
        timestamp: new Date().toISOString(),
        oldReplicas: hpa.status.currentReplicas || 0,
        newReplicas: hpa.status.desiredReplicas || hpa.status.currentReplicas || 0,
        metrics: {
          cpu: hpaMetrics.cpuUtilization,
          cpuTarget: hpaMetrics.cpuTarget,
          memory: hpaMetrics.memoryUtilization,
          memoryTarget: hpaMetrics.memoryTarget,
          currentReplicas: hpa.status.currentReplicas,
          desiredReplicas: hpa.status.desiredReplicas,
          minReplicas: hpa.spec.minReplicas,
          maxReplicas: hpa.spec.maxReplicas
        },
        trigger: trigger.description,
        triggerType: trigger.type, // 'manual' or 'automatic'
        pods
      };
    } catch (error) {
      console.error(`⚠️  Error collecting metrics for ${hpaName}:`, error.message);

      // Return partial data
      return {
        serviceName: hpaName.replace('-hpa', ''),
        appLabel: hpaName.replace('-hpa', ''),
        hpaName,
        namespace,
        timestamp: new Date().toISOString(),
        oldReplicas: hpa.status.currentReplicas || 0,
        newReplicas: hpa.status.desiredReplicas || hpa.status.currentReplicas || 0,
        metrics: {
          cpu: 'N/A',
          cpuTarget: null,
          memory: 'N/A',
          memoryTarget: null,
          currentReplicas: hpa.status.currentReplicas,
          desiredReplicas: hpa.status.desiredReplicas,
          minReplicas: hpa.spec.minReplicas,
          maxReplicas: hpa.spec.maxReplicas
        },
        trigger: 'Unable to determine (metrics unavailable)',
        triggerType: 'unknown',
        pods: []
      };
    }
  }

  /**
   * Get pod status for a service
   * @param {string} namespace - Kubernetes namespace
   * @param {string} appLabel - App label value (e.g., 'core-api')
   * @returns {Array} - Array of pod objects with status
   */
  async getPodStatus(namespace, appLabel) {
    try {
      const labelSelector = `app=${appLabel}`;
      const response = await this.coreApi.listNamespacedPod(
        namespace,
        undefined,     // pretty
        undefined,     // allowWatchBookmarks
        undefined,     // _continue
        undefined,     // fieldSelector
        labelSelector, // labelSelector - FIXED: correct position
        undefined      // limit
      );

      const pods = response.body.items.map(pod => {
        const readyCondition = pod.status.conditions?.find(c => c.type === 'Ready');
        const isReady = readyCondition?.status === 'True';

        return {
          name: pod.metadata.name,
          status: pod.status.phase,
          ready: isReady,
          restarts: pod.status.containerStatuses?.[0]?.restartCount || 0,
          age: this.calculatePodAge(pod.metadata.creationTimestamp)
        };
      });

      return pods;
    } catch (error) {
      console.warn(`⚠️  Could not fetch pod status for ${appLabel}:`, error.message);
      return [];
    }
  }

  /**
   * Extract metrics from HPA status
   * @param {Object} hpa - HPA object
   * @returns {Object} - Extracted metrics
   */
  extractHPAMetrics(hpa) {
    const metrics = {
      cpuUtilization: 'N/A',
      cpuTarget: null,
      memoryUtilization: 'N/A',
      memoryTarget: null
    };

    // Extract current metrics
    if (hpa.status.currentMetrics) {
      hpa.status.currentMetrics.forEach(metric => {
        if (metric.type === 'Resource') {
          if (metric.resource.name === 'cpu') {
            metrics.cpuUtilization = `${metric.resource.current.averageUtilization || 0}%`;
          } else if (metric.resource.name === 'memory') {
            metrics.memoryUtilization = `${metric.resource.current.averageUtilization || 0}%`;
          }
        }
      });
    }

    // Extract target metrics
    if (hpa.spec.metrics) {
      hpa.spec.metrics.forEach(metric => {
        if (metric.type === 'Resource') {
          if (metric.resource.name === 'cpu') {
            metrics.cpuTarget = metric.resource.target.averageUtilization;
          } else if (metric.resource.name === 'memory') {
            metrics.memoryTarget = metric.resource.target.averageUtilization;
          }
        }
      });
    }

    return metrics;
  }

  /**
   * Detect scaling trigger (manual vs automatic)
   * @param {Object} hpa - HPA object
   * @param {Object} hpaMetrics - Extracted HPA metrics
   * @returns {Object} - Trigger information
   */
  detectTrigger(hpa, hpaMetrics) {
    // Check if minReplicas was recently changed (indicator of manual scaling)
    const lastScaleTime = hpa.status.lastScaleTime;
    if (lastScaleTime) {
      const lastScaleMs = new Date(lastScaleTime).getTime();
      const now = Date.now();
      const timeSinceScale = now - lastScaleMs;

      // If scaled within last 30 seconds, likely manual
      if (timeSinceScale < 30000) {
        return {
          type: 'manual',
          description: 'Manual scaling (HPA minReplicas changed)'
        };
      }
    }

    // Check if CPU exceeded target
    if (hpaMetrics.cpuUtilization !== 'N/A' && hpaMetrics.cpuTarget) {
      const cpuValue = parseInt(hpaMetrics.cpuUtilization);
      if (cpuValue > hpaMetrics.cpuTarget) {
        return {
          type: 'automatic',
          description: `Automatic (CPU: ${cpuValue}% > ${hpaMetrics.cpuTarget}%)`
        };
      }
    }

    // Check if memory exceeded target
    if (hpaMetrics.memoryUtilization !== 'N/A' && hpaMetrics.memoryTarget) {
      const memValue = parseInt(hpaMetrics.memoryUtilization);
      if (memValue > hpaMetrics.memoryTarget) {
        return {
          type: 'automatic',
          description: `Automatic (Memory: ${memValue}% > ${hpaMetrics.memoryTarget}%)`
        };
      }
    }

    // Default to automatic HPA decision
    return {
      type: 'automatic',
      description: 'Automatic (HPA decision based on metrics)'
    };
  }

  /**
   * Calculate pod age in human-readable format
   * @param {string} creationTimestamp - Pod creation timestamp
   * @returns {string} - Human-readable age
   */
  calculatePodAge(creationTimestamp) {
    const created = new Date(creationTimestamp);
    const now = new Date();
    const ageMs = now - created;

    const ageMinutes = Math.floor(ageMs / 60000);
    const ageHours = Math.floor(ageMinutes / 60);
    const ageDays = Math.floor(ageHours / 24);

    if (ageDays > 0) return `${ageDays}d`;
    if (ageHours > 0) return `${ageHours}h`;
    if (ageMinutes > 0) return `${ageMinutes}m`;
    return '<1m';
  }
}
