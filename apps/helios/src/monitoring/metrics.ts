/**
 * HELIOS Metrics for Prometheus
 */

// Simple counter implementation (replace with prom-client in production)
class Counter {
  private value = 0;
  private labels: Map<string, number> = new Map();

  constructor(
    public name: string,
    public help: string,
    public labelNames: string[] = []
  ) {}

  inc(labels?: Record<string, string>, value = 1) {
    const key = labels ? JSON.stringify(labels) : '';
    this.labels.set(key, (this.labels.get(key) || 0) + value);
    this.value += value;
  }

  get() {
    return this.value;
  }

  getLabels() {
    return this.labels;
  }
}

class Histogram {
  private buckets: Map<number, number> = new Map();
  private sum = 0;
  private count = 0;

  constructor(
    public name: string,
    public help: string,
    public labelNames: string[] = [],
    public bucketBoundaries: number[] = [0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10]
  ) {
    for (const b of bucketBoundaries) {
      this.buckets.set(b, 0);
    }
  }

  observe(_labels: Record<string, string> | undefined, value: number) {
    this.sum += value;
    this.count++;
    for (const [bucket, count] of this.buckets) {
      if (value <= bucket) {
        this.buckets.set(bucket, count + 1);
      }
    }
  }
}

// Define metrics
export const metrics = {
  // Session metrics
  sessionsCreated: new Counter(
    'helios_sessions_created_total',
    'Total number of HELIOS sessions created',
    ['language']
  ),

  sessionsEscalated: new Counter(
    'helios_sessions_escalated_total',
    'Total number of sessions escalated to emergency',
    ['reason', 'language']
  ),

  sessionsCompleted: new Counter(
    'helios_sessions_completed_total',
    'Total number of sessions completed',
    ['disposition', 'language']
  ),

  // Message metrics
  messagesProcessed: new Counter(
    'helios_messages_processed_total',
    'Total messages processed',
    ['language']
  ),

  messageLatency: new Histogram(
    'helios_message_latency_seconds',
    'Message processing latency',
    ['agent_team'],
    [0.1, 0.5, 1, 2, 5, 10, 30]
  ),

  // Safety metrics
  redFlagsDetected: new Counter(
    'helios_red_flags_detected_total',
    'Total red flags detected',
    ['rule_id', 'severity', 'language']
  ),

  safetyChecks: new Counter(
    'helios_safety_checks_total',
    'Total safety checks performed',
    ['result']
  ),

  // Agent metrics
  agentCalls: new Counter(
    'helios_agent_calls_total',
    'Total agent invocations',
    ['agent_id', 'team']
  ),

  agentLatency: new Histogram(
    'helios_agent_latency_seconds',
    'Agent processing latency',
    ['agent_id'],
    [0.1, 0.5, 1, 2, 5, 10]
  ),

  agentTokens: new Counter(
    'helios_agent_tokens_total',
    'Total tokens used by agents',
    ['agent_id', 'model']
  ),

  // Voice metrics
  voiceProcessed: new Counter(
    'helios_voice_processed_total',
    'Total voice inputs processed',
    ['language']
  ),

  voiceLatency: new Histogram(
    'helios_voice_latency_seconds',
    'Voice processing latency',
    ['stage'],
    [0.5, 1, 2, 5, 10, 30]
  ),

  // Knowledge metrics
  knowledgeQueries: new Counter(
    'helios_knowledge_queries_total',
    'Total knowledge base queries',
    ['source', 'type']
  ),

  knowledgeConsensus: new Counter(
    'helios_knowledge_consensus_total',
    'Knowledge consensus results',
    ['achieved']
  ),

  // Triage metrics
  triageAssignments: new Counter(
    'helios_triage_assignments_total',
    'Triage level assignments',
    ['level', 'language']
  ),

  dispositions: new Counter(
    'helios_dispositions_total',
    'Final dispositions',
    ['type', 'language']
  ),

  // Error metrics
  errors: new Counter(
    'helios_errors_total',
    'Total errors',
    ['type', 'component']
  ),
};

// Metrics endpoint
export function getMetricsOutput(): string {
  const lines: string[] = [];

  for (const [_name, metric] of Object.entries(metrics)) {
    if (metric instanceof Counter) {
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} counter`);

      if (metric.labelNames.length === 0) {
        lines.push(`${metric.name} ${metric.get()}`);
      } else {
        for (const [labels, value] of metric.getLabels()) {
          if (labels) {
            lines.push(`${metric.name}${labels} ${value}`);
          } else {
            lines.push(`${metric.name} ${value}`);
          }
        }
      }
    }
  }

  return lines.join('\n');
}
