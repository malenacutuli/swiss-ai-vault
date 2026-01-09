/**
 * AlertManager - Alerting system for critical events and thresholds
 * Supports multiple channels: email, Slack, PagerDuty, webhooks
 */

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  metric: string;
  condition: 'gt' | 'lt' | 'eq' | 'ne' | 'gte' | 'lte';
  threshold: number;
  duration: number; // seconds metric must exceed threshold
  severity: 'info' | 'warning' | 'critical';
  channels: AlertChannel[];
  enabled: boolean;
  tags?: string[];
  runbook?: string;
}

export interface AlertChannel {
  type: 'email' | 'slack' | 'pagerduty' | 'webhook';
  config: Record<string, string>;
}

export interface AlertNotification {
  id: string;
  rule: AlertRule;
  value: number;
  timestamp: Date;
  status: 'firing' | 'resolved' | 'acknowledged';
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  notes?: string;
}

interface ActiveAlert {
  rule: AlertRule;
  startedAt: number;
  value: number;
  fired: boolean;
  notificationId?: string;
}

interface AlertStats {
  totalFired: number;
  totalResolved: number;
  avgResolutionTimeMs: number;
  alertsByRule: Record<string, number>;
  alertsBySeverity: Record<string, number>;
}

// Default alert rules for Swiss Agents platform
const DEFAULT_RULES: AlertRule[] = [
  {
    id: 'high-cold-start',
    name: 'High Cold Start Rate',
    description: 'Warm pool misses are elevated, indicating capacity issues',
    metric: 'warm_pool_misses_total',
    condition: 'gt',
    threshold: 10,
    duration: 300,
    severity: 'warning',
    channels: [{ type: 'slack', config: { channel: '#alerts' } }],
    enabled: true,
    tags: ['infrastructure', 'performance'],
  },
  {
    id: 'pool-depleted',
    name: 'Warm Pool Depleted',
    description: 'Warm pool size critically low, cold starts imminent',
    metric: 'warm_pool_size',
    condition: 'lt',
    threshold: 5,
    duration: 60,
    severity: 'critical',
    channels: [
      { type: 'slack', config: { channel: '#alerts' } },
      { type: 'pagerduty', config: { serviceKey: 'xxx' } },
    ],
    enabled: true,
    tags: ['infrastructure', 'critical'],
    runbook: 'https://docs.swiss-brain.ai/runbooks/pool-depleted',
  },
  {
    id: 'high-latency',
    name: 'High API Latency',
    description: 'P95 API latency exceeds acceptable threshold',
    metric: 'api_latency_seconds_p95',
    condition: 'gt',
    threshold: 5,
    duration: 300,
    severity: 'warning',
    channels: [{ type: 'slack', config: { channel: '#alerts' } }],
    enabled: true,
    tags: ['api', 'performance'],
  },
  {
    id: 'task-failure-rate',
    name: 'High Task Failure Rate',
    description: 'Agent task failure rate exceeds 10%',
    metric: 'agent_tasks_failed_rate',
    condition: 'gt',
    threshold: 0.1,
    duration: 600,
    severity: 'critical',
    channels: [
      { type: 'slack', config: { channel: '#alerts' } },
      { type: 'email', config: { to: 'ops@swissbrain.ai' } },
    ],
    enabled: true,
    tags: ['agents', 'reliability'],
  },
  {
    id: 'ai-cost-spike',
    name: 'AI Cost Spike',
    description: 'Hourly AI costs exceed $100',
    metric: 'ai_cost_cents_hourly',
    condition: 'gt',
    threshold: 10000,
    duration: 3600,
    severity: 'warning',
    channels: [{ type: 'slack', config: { channel: '#alerts' } }],
    enabled: true,
    tags: ['billing', 'cost'],
  },
  {
    id: 'database-connections',
    name: 'Database Connection Pool Exhausted',
    description: 'Database connections nearing limit',
    metric: 'db_connections_active',
    condition: 'gt',
    threshold: 90,
    duration: 120,
    severity: 'critical',
    channels: [
      { type: 'slack', config: { channel: '#alerts' } },
      { type: 'pagerduty', config: { serviceKey: 'xxx' } },
    ],
    enabled: true,
    tags: ['database', 'infrastructure'],
  },
  {
    id: 'memory-pressure',
    name: 'High Memory Usage',
    description: 'Container memory usage above 90%',
    metric: 'container_memory_percent',
    condition: 'gt',
    threshold: 90,
    duration: 180,
    severity: 'warning',
    channels: [{ type: 'slack', config: { channel: '#alerts' } }],
    enabled: true,
    tags: ['infrastructure', 'resources'],
  },
];

export class AlertManager {
  private rules: AlertRule[];
  private activeAlerts: Map<string, ActiveAlert> = new Map();
  private alertHistory: AlertNotification[] = [];
  private evaluationInterval: ReturnType<typeof setInterval> | null = null;
  private stats: AlertStats = {
    totalFired: 0,
    totalResolved: 0,
    avgResolutionTimeMs: 0,
    alertsByRule: {},
    alertsBySeverity: { info: 0, warning: 0, critical: 0 },
  };
  private metricsProvider: ((metric: string) => Promise<number>) | null = null;
  private onAlertCallback: ((notification: AlertNotification) => void) | null = null;

  constructor(rules: AlertRule[] = DEFAULT_RULES) {
    this.rules = rules;
    console.log(`[AlertManager] Initialized with ${rules.length} rules`);
  }

  /**
   * Set metrics provider function
   */
  setMetricsProvider(provider: (metric: string) => Promise<number>): void {
    this.metricsProvider = provider;
  }

  /**
   * Set callback for alert events
   */
  onAlert(callback: (notification: AlertNotification) => void): void {
    this.onAlertCallback = callback;
  }

  /**
   * Evaluate all alert rules
   */
  async evaluate(): Promise<void> {
    for (const rule of this.rules) {
      if (!rule.enabled) continue;

      try {
        const currentValue = await this.getMetricValue(rule.metric);
        const isFiring = this.checkCondition(currentValue, rule.condition, rule.threshold);

        const alertKey = rule.id;
        const existingAlert = this.activeAlerts.get(alertKey);

        if (isFiring) {
          if (!existingAlert) {
            // Start tracking new potential alert
            this.activeAlerts.set(alertKey, {
              rule,
              startedAt: Date.now(),
              value: currentValue,
              fired: false,
            });
            console.log(`[AlertManager] Started tracking: ${rule.name}`);
          } else {
            // Update current value
            existingAlert.value = currentValue;

            // Check if duration threshold exceeded
            if (
              !existingAlert.fired &&
              Date.now() - existingAlert.startedAt >= rule.duration * 1000
            ) {
              await this.fireAlert(existingAlert);
              existingAlert.fired = true;
            }
          }
        } else {
          if (existingAlert?.fired) {
            // Alert resolved
            await this.resolveAlert(existingAlert);
          }
          this.activeAlerts.delete(alertKey);
        }
      } catch (error) {
        console.error(`[AlertManager] Error evaluating rule ${rule.id}:`, error);
      }
    }
  }

  /**
   * Get metric value from provider or simulate
   */
  private async getMetricValue(metric: string): Promise<number> {
    if (this.metricsProvider) {
      return await this.metricsProvider(metric);
    }

    // Simulate metric values for development
    const simulated: Record<string, number> = {
      warm_pool_misses_total: Math.floor(Math.random() * 15),
      warm_pool_size: Math.floor(Math.random() * 20) + 5,
      api_latency_seconds_p95: Math.random() * 3 + 0.5,
      agent_tasks_failed_rate: Math.random() * 0.15,
      ai_cost_cents_hourly: Math.floor(Math.random() * 8000),
      db_connections_active: Math.floor(Math.random() * 100),
      container_memory_percent: Math.floor(Math.random() * 100),
    };

    return simulated[metric] ?? 0;
  }

  /**
   * Check if condition is met
   */
  private checkCondition(
    value: number,
    condition: AlertRule['condition'],
    threshold: number
  ): boolean {
    switch (condition) {
      case 'gt':
        return value > threshold;
      case 'lt':
        return value < threshold;
      case 'gte':
        return value >= threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      case 'ne':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Fire an alert
   */
  private async fireAlert(alert: ActiveAlert): Promise<void> {
    const notification: AlertNotification = {
      id: crypto.randomUUID(),
      rule: alert.rule,
      value: alert.value,
      timestamp: new Date(),
      status: 'firing',
    };

    alert.notificationId = notification.id;
    this.alertHistory.push(notification);

    // Update stats
    this.stats.totalFired++;
    this.stats.alertsByRule[alert.rule.id] =
      (this.stats.alertsByRule[alert.rule.id] || 0) + 1;
    this.stats.alertsBySeverity[alert.rule.severity]++;

    console.log(
      `[AlertManager] ALERT FIRED: ${alert.rule.name} (${alert.rule.severity}) - Value: ${alert.value}`
    );

    // Send to channels
    for (const channel of alert.rule.channels) {
      await this.sendToChannel(channel, notification);
    }

    // Notify callback
    if (this.onAlertCallback) {
      this.onAlertCallback(notification);
    }
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(alert: ActiveAlert): Promise<void> {
    const notification = this.alertHistory.find(
      (n) => n.id === alert.notificationId
    );

    if (notification) {
      notification.status = 'resolved';
      notification.resolvedAt = new Date();

      // Calculate resolution time
      const resolutionTime =
        notification.resolvedAt.getTime() - notification.timestamp.getTime();

      // Update avg resolution time
      this.stats.totalResolved++;
      this.stats.avgResolutionTimeMs =
        (this.stats.avgResolutionTimeMs * (this.stats.totalResolved - 1) +
          resolutionTime) /
        this.stats.totalResolved;

      console.log(
        `[AlertManager] ALERT RESOLVED: ${alert.rule.name} (after ${Math.round(resolutionTime / 1000)}s)`
      );

      // Send resolution notification
      for (const channel of alert.rule.channels) {
        await this.sendResolutionToChannel(channel, notification);
      }

      // Notify callback
      if (this.onAlertCallback) {
        this.onAlertCallback(notification);
      }
    }
  }

  /**
   * Send alert to channel
   */
  private async sendToChannel(
    channel: AlertChannel,
    notification: AlertNotification
  ): Promise<void> {
    try {
      switch (channel.type) {
        case 'slack':
          await this.sendSlackAlert(channel.config, notification);
          break;
        case 'email':
          await this.sendEmailAlert(channel.config, notification);
          break;
        case 'pagerduty':
          await this.sendPagerDutyAlert(channel.config, notification);
          break;
        case 'webhook':
          await this.sendWebhookAlert(channel.config, notification);
          break;
      }
    } catch (error) {
      console.error(`[AlertManager] Failed to send to ${channel.type}:`, error);
    }
  }

  /**
   * Send resolution to channel
   */
  private async sendResolutionToChannel(
    channel: AlertChannel,
    notification: AlertNotification
  ): Promise<void> {
    // Similar to sendToChannel but with resolved status
    console.log(
      `[AlertManager] Would send resolution to ${channel.type}: ${notification.rule.name}`
    );
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(
    config: Record<string, string>,
    notification: AlertNotification
  ): Promise<void> {
    const color =
      notification.rule.severity === 'critical'
        ? '#DC2626'
        : notification.rule.severity === 'warning'
          ? '#F59E0B'
          : '#1D4E5F';

    console.log(
      `[AlertManager] Slack alert to ${config.channel}: ${notification.rule.name} (${color})`
    );

    // In production, would send to Slack webhook
    // await fetch(process.env.SLACK_WEBHOOK_URL!, { ... })
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(
    config: Record<string, string>,
    notification: AlertNotification
  ): Promise<void> {
    console.log(
      `[AlertManager] Email alert to ${config.to}: ${notification.rule.name}`
    );
    // Would call send-alert-email edge function
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(
    config: Record<string, string>,
    notification: AlertNotification
  ): Promise<void> {
    console.log(
      `[AlertManager] PagerDuty alert (service: ${config.serviceKey}): ${notification.rule.name}`
    );
    // Would call PagerDuty API
  }

  /**
   * Send webhook alert
   */
  private async sendWebhookAlert(
    config: Record<string, string>,
    notification: AlertNotification
  ): Promise<void> {
    console.log(
      `[AlertManager] Webhook alert to ${config.url}: ${notification.rule.name}`
    );
    // Would POST to webhook URL
  }

  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string, notes?: string): boolean {
    const notification = this.alertHistory.find((n) => n.id === alertId);
    if (notification && notification.status === 'firing') {
      notification.status = 'acknowledged';
      notification.acknowledgedBy = acknowledgedBy;
      notification.acknowledgedAt = new Date();
      notification.notes = notes;
      console.log(`[AlertManager] Alert acknowledged: ${alertId} by ${acknowledgedBy}`);
      return true;
    }
    return false;
  }

  /**
   * Start evaluation loop
   */
  startEvaluationLoop(intervalMs: number = 30000): void {
    if (this.evaluationInterval) {
      console.warn('[AlertManager] Evaluation loop already running');
      return;
    }

    console.log(`[AlertManager] Starting evaluation loop (${intervalMs}ms interval)`);
    this.evaluationInterval = setInterval(() => this.evaluate(), intervalMs);

    // Run initial evaluation
    this.evaluate();
  }

  /**
   * Stop evaluation loop
   */
  stopEvaluationLoop(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      console.log('[AlertManager] Evaluation loop stopped');
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): AlertNotification[] {
    return this.alertHistory.filter((n) => n.status === 'firing');
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit: number = 100): AlertNotification[] {
    return this.alertHistory.slice(-limit);
  }

  /**
   * Get alert rules
   */
  getRules(): AlertRule[] {
    return [...this.rules];
  }

  /**
   * Update a rule
   */
  updateRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.rules.find((r) => r.id === ruleId);
    if (rule) {
      Object.assign(rule, updates);
      console.log(`[AlertManager] Rule updated: ${ruleId}`);
      return true;
    }
    return false;
  }

  /**
   * Add a new rule
   */
  addRule(rule: AlertRule): void {
    this.rules.push(rule);
    console.log(`[AlertManager] Rule added: ${rule.id}`);
  }

  /**
   * Remove a rule
   */
  removeRule(ruleId: string): boolean {
    const index = this.rules.findIndex((r) => r.id === ruleId);
    if (index !== -1) {
      this.rules.splice(index, 1);
      this.activeAlerts.delete(ruleId);
      console.log(`[AlertManager] Rule removed: ${ruleId}`);
      return true;
    }
    return false;
  }

  /**
   * Get statistics
   */
  getStats(): AlertStats {
    return { ...this.stats };
  }

  /**
   * Get MTTR (Mean Time To Resolution)
   */
  getMTTR(): number {
    return this.stats.avgResolutionTimeMs;
  }

  /**
   * Format MTTR for display
   */
  formatMTTR(): string {
    const ms = this.stats.avgResolutionTimeMs;
    if (ms < 60000) {
      return `${Math.round(ms / 1000)}s`;
    } else if (ms < 3600000) {
      return `${Math.round(ms / 60000)}m`;
    } else {
      return `${(ms / 3600000).toFixed(1)}h`;
    }
  }
}

// Singleton instance
export const alertManager = new AlertManager();

// Export default rules for reference
export { DEFAULT_RULES };
