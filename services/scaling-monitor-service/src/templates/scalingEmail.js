/**
 * Scaling Email Template Generator
 * Generates professional HTML emails for scaling notifications
 */

/**
 * Generate HTML email for scaling events
 * @param {Object} event - Scaling event data
 * @returns {string} - HTML email content
 */
export function generateScalingEmailHTML(event) {
  const isScaleUp = event.newReplicas > event.oldReplicas;
  const color = isScaleUp ? '#10b981' : '#f59e0b'; // green : orange
  const emoji = isScaleUp ? '🚀' : '📉';
  const eventType = isScaleUp ? 'Scale Up' : 'Scale Down';
  const delta = event.newReplicas - event.oldReplicas;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emoji} ${eventType}: ${event.serviceName}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #1f2937;
      margin: 0;
      padding: 0;
      background-color: #f3f4f6;
    }
    .container {
      max-width: 700px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background-color: ${color};
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 32px;
      font-weight: 700;
    }
    .header p {
      margin: 0;
      font-size: 18px;
      opacity: 0.95;
    }
    .content {
      padding: 30px 20px;
    }
    h2 {
      color: #111827;
      font-size: 20px;
      margin: 30px 0 15px 0;
      padding-bottom: 8px;
      border-bottom: 2px solid #e5e7eb;
    }
    h2:first-child {
      margin-top: 0;
    }
    .metric-table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    .metric-table td {
      padding: 12px 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .metric-table td:first-child {
      font-weight: 600;
      color: #374151;
      width: 40%;
    }
    .metric-table td:last-child {
      color: #1f2937;
    }
    .metric-table tr:last-child td {
      border-bottom: none;
    }
    .replica-change {
      display: inline-block;
      padding: 4px 12px;
      background-color: ${isScaleUp ? '#d1fae5' : '#fed7aa'};
      color: ${isScaleUp ? '#065f46' : '#92400e'};
      border-radius: 6px;
      font-weight: 600;
      font-size: 16px;
    }
    .pod-status {
      font-family: 'Courier New', Courier, monospace;
      background-color: #f9fafb;
      padding: 15px;
      border-radius: 6px;
      border-left: 4px solid ${color};
      margin: 15px 0;
      font-size: 14px;
      line-height: 1.8;
      overflow-x: auto;
    }
    .pod-line {
      display: block;
      white-space: nowrap;
    }
    .code-block {
      background-color: #1f2937;
      color: #e5e7eb;
      padding: 15px;
      border-radius: 6px;
      margin: 10px 0 20px 0;
      font-family: 'Courier New', Courier, monospace;
      font-size: 13px;
      overflow-x: auto;
      border-left: 4px solid ${color};
    }
    .footer {
      text-align: center;
      padding: 20px;
      background-color: #f9fafb;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-manual {
      background-color: #dbeafe;
      color: #1e40af;
    }
    .badge-automatic {
      background-color: #fef3c7;
      color: #92400e;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${emoji} ${eventType} Alert</h1>
      <p>${event.serviceName} - ${event.namespace}</p>
    </div>

    <div class="content">
      <h2>Scaling Event Details</h2>
      <table class="metric-table">
        <tr>
          <td>Timestamp:</td>
          <td>${event.timestamp}</td>
        </tr>
        <tr>
          <td>Replica Change:</td>
          <td>
            <span class="replica-change">${event.oldReplicas} → ${event.newReplicas} (${deltaStr})</span>
          </td>
        </tr>
        <tr>
          <td>Trigger:</td>
          <td>
            <span class="badge ${event.triggerType === 'manual' ? 'badge-manual' : 'badge-automatic'}">
              ${event.triggerType}
            </span>
            ${event.trigger}
          </td>
        </tr>
      </table>

      <h2>Resource Metrics</h2>
      <table class="metric-table">
        <tr>
          <td>CPU Utilization:</td>
          <td><strong>${event.metrics.cpu}</strong> ${event.metrics.cpuTarget ? `(Target: ${event.metrics.cpuTarget}%)` : ''}</td>
        </tr>
        <tr>
          <td>Memory Utilization:</td>
          <td><strong>${event.metrics.memory}</strong> ${event.metrics.memoryTarget ? `(Target: ${event.metrics.memoryTarget}%)` : ''}</td>
        </tr>
        <tr>
          <td>Current Replicas:</td>
          <td><strong>${event.metrics.currentReplicas}</strong></td>
        </tr>
        <tr>
          <td>Desired Replicas:</td>
          <td><strong>${event.metrics.desiredReplicas}</strong></td>
        </tr>
        <tr>
          <td>Max Replicas:</td>
          <td><strong>${event.metrics.maxReplicas}</strong></td>
        </tr>
      </table>

      <h2>Pod Status</h2>
      <div class="pod-status">
        ${event.pods.map(pod => `<span class="pod-line">${pod.ready ? '✅' : '🔄'} ${pod.name.padEnd(45, ' ')} ${pod.status}</span>`).join('<br>')}
      </div>

      <h2>Quick Actions</h2>

      <h3 style="color: #374151; font-size: 16px; margin: 15px 0 8px 0;">View Logs:</h3>
      <div class="code-block">kubectl logs -n ${event.namespace} -l app=${event.appLabel} --tail=100</div>

      <h3 style="color: #374151; font-size: 16px; margin: 15px 0 8px 0;">Check HPA Status:</h3>
      <div class="code-block">kubectl get hpa ${event.hpaName} -n ${event.namespace}</div>

      <h3 style="color: #374151; font-size: 16px; margin: 15px 0 8px 0;">Check Pod Details:</h3>
      <div class="code-block">kubectl get pods -n ${event.namespace} -l app=${event.appLabel}</div>

      ${isScaleUp ? `
      <h3 style="color: #374151; font-size: 16px; margin: 15px 0 8px 0;">Scale Down (if needed):</h3>
      <div class="code-block">./scale-down.sh</div>
      ` : ''}

      <h3 style="color: #374151; font-size: 16px; margin: 15px 0 8px 0;">View Pod Resource Usage:</h3>
      <div class="code-block">kubectl top pods -n ${event.namespace} -l app=${event.appLabel}</div>
    </div>

    <div class="footer">
      <p><strong>Generated by DropMate Scaling Monitor Service</strong></p>
      <p style="margin-top: 5px; font-size: 12px;">This is an automated notification. Do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

/**
 * Generate plain text version (fallback for email clients that don't support HTML)
 * @param {Object} event - Scaling event data
 * @returns {string} - Plain text email content
 */
export function generateScalingEmailText(event) {
  const isScaleUp = event.newReplicas > event.oldReplicas;
  const emoji = isScaleUp ? '🚀' : '📉';
  const eventType = isScaleUp ? 'SCALE UP' : 'SCALE DOWN';
  const delta = event.newReplicas - event.oldReplicas;
  const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;

  let text = `
${emoji} ${eventType} ALERT: ${event.serviceName}

Namespace: ${event.namespace}
Timestamp: ${event.timestamp}

SCALING EVENT
-------------
Replica Change: ${event.oldReplicas} → ${event.newReplicas} (${deltaStr})
Trigger: ${event.trigger}

RESOURCE METRICS
----------------
CPU Utilization: ${event.metrics.cpu} ${event.metrics.cpuTarget ? `(Target: ${event.metrics.cpuTarget}%)` : ''}
Memory Utilization: ${event.metrics.memory} ${event.metrics.memoryTarget ? `(Target: ${event.metrics.memoryTarget}%)` : ''}
Current Replicas: ${event.metrics.currentReplicas}
Desired Replicas: ${event.metrics.desiredReplicas}
Max Replicas: ${event.metrics.maxReplicas}

POD STATUS
----------
`;

  event.pods.forEach(pod => {
    text += `${pod.ready ? '✅' : '🔄'} ${pod.name} - ${pod.status}\n`;
  });

  text += `
QUICK ACTIONS
-------------
View Logs:
  kubectl logs -n ${event.namespace} -l app=${event.appLabel} --tail=100

Check HPA Status:
  kubectl get hpa ${event.hpaName} -n ${event.namespace}

Check Pod Details:
  kubectl get pods -n ${event.namespace} -l app=${event.appLabel}
`;

  if (isScaleUp) {
    text += `
Scale Down (if needed):
  ./scale-down.sh
`;
  }

  text += `
View Pod Resource Usage:
  kubectl top pods -n ${event.namespace} -l app=${event.appLabel}

---
Generated by DropMate Scaling Monitor Service
This is an automated notification.
`;

  return text.trim();
}
