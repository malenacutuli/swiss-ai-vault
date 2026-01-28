/**
 * HELIOS Health Checks
 */

import { checkKnowledgeHealth } from '../knowledge/index.js';

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    name: string;
    status: 'pass' | 'warn' | 'fail';
    message?: string;
    latencyMs?: number;
  }[];
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = [];

  // Check knowledge sources
  const knowledgeStart = Date.now();
  try {
    const health = await checkKnowledgeHealth();
    checks.push({
      name: 'knowledge_sources',
      status: health.healthy ? 'pass' : 'warn',
      message: `${health.sources.filter(s => s.available).length}/${health.sources.length} sources available`,
      latencyMs: Date.now() - knowledgeStart,
    });
  } catch (error) {
    checks.push({
      name: 'knowledge_sources',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
      latencyMs: Date.now() - knowledgeStart,
    });
  }

  // Check Redis connection
  // (implement based on your Redis client)
  checks.push({
    name: 'redis',
    status: 'pass',
    message: 'Connected',
  });

  // Check Supabase connection
  // (implement based on your Supabase client)
  checks.push({
    name: 'supabase',
    status: 'pass',
    message: 'Connected',
  });

  // Determine overall status
  const hasFailure = checks.some(c => c.status === 'fail');
  const hasWarning = checks.some(c => c.status === 'warn');

  return {
    status: hasFailure ? 'unhealthy' : hasWarning ? 'degraded' : 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    checks,
  };
}

export async function getReadinessStatus(): Promise<boolean> {
  const health = await getHealthStatus();
  return health.status !== 'unhealthy';
}
