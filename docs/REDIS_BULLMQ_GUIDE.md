# Redis and BullMQ Configuration Guide

This guide provides comprehensive documentation for setting up Redis as a task queue backend and integrating BullMQ for background job processing in the SwissBrain AI platform.

## Table of Contents

1. [Overview](#overview)
2. [Redis Architecture](#redis-architecture)
3. [Redis Deployment](#redis-deployment)
4. [BullMQ Integration](#bullmq-integration)
5. [Queue Management](#queue-management)
6. [Monitoring and Alerts](#monitoring-and-alerts)
7. [Performance Optimization](#performance-optimization)
8. [Troubleshooting](#troubleshooting)

---

## Overview

### What is Redis?

Redis is an in-memory data structure store used as:
- **Database**: Fast key-value storage
- **Cache**: Application-level caching
- **Message broker**: Pub/sub messaging
- **Task queue backend**: Job queue for BullMQ

### What is BullMQ?

BullMQ is a Node.js library for creating robust and scalable task queues:
- **Job scheduling**: Delayed and recurring jobs
- **Priority queues**: Process important jobs first
- **Rate limiting**: Control job processing rate
- **Retry logic**: Automatic retry with backoff
- **Progress tracking**: Monitor job execution
- **Event system**: React to job lifecycle events

### Why Redis + BullMQ?

| Feature | Benefit |
|---------|---------|
| **Performance** | In-memory speed for queue operations |
| **Reliability** | Persistence (RDB + AOF) ensures no job loss |
| **Scalability** | Horizontal scaling with multiple workers |
| **Visibility** | Real-time monitoring and metrics |
| **Flexibility** | Support for multiple queue patterns |

---

## Redis Architecture

### Deployment Model

```
┌──────────────────────────────────────────────────────────────┐
│                    SwissBrain Namespace                      │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Redis StatefulSet                                      │ │
│  │  • Pod: redis-0                                        │ │
│  │  • Storage: 10Gi PVC (RDB + AOF persistence)          │ │
│  │  • Resources: 100m-500m CPU, 256Mi-1Gi Memory         │ │
│  │  • Config: /etc/redis/redis.conf                      │ │
│  └────────────────────────────────────────────────────────┘ │
│                              │                               │
│                              │                               │
│  ┌──────────────────┬────────┴────────┬──────────────────┐  │
│  │                  │                 │                  │  │
│  ▼                  ▼                 ▼                  ▼  │
│ ┌─────┐         ┌─────┐          ┌─────┐          ┌─────┐ │
│ │Queue│         │Queue│          │Queue│          │Queue│ │
│ │ 1   │         │ 2   │          │ 3   │          │ N   │ │
│ └─────┘         └─────┘          └─────┘          └─────┘ │
│    │               │                 │                │    │
│    └───────────────┴─────────────────┴────────────────┘    │
│                          │                                  │
│                          ▼                                  │
│              ┌────────────────────────┐                    │
│              │  BullMQ Workers        │                    │
│              │  • Concurrency: 10     │                    │
│              │  • Multiple instances  │                    │
│              └────────────────────────┘                    │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Persistence Strategy

**Dual Persistence** (RDB + AOF):

1. **RDB (Redis Database File)**:
   - Snapshots at intervals: 900s/1 change, 300s/10 changes, 60s/10000 changes
   - Fast startup and compact storage
   - File: `/data/dump.rdb`

2. **AOF (Append Only File)**:
   - Append-only log of write operations
   - Fsync: `everysec` (good balance of safety and performance)
   - File: `/data/appendonly.aof`
   - Auto-rewrite when file grows too large

**Best of both worlds**: RDB for fast restarts, AOF for durability.

---

## Redis Deployment

### Step 1: Deploy Redis StatefulSet

```bash
# Apply Redis configuration and StatefulSet
kubectl apply -f k8s/redis/redis-statefulset.yaml

# Verify deployment
kubectl get statefulset redis -n swissbrain
kubectl get pods -n swissbrain -l app=redis
kubectl get pvc -n swissbrain
kubectl get svc redis -n swissbrain
```

### Step 2: Verify Redis is Running

```bash
# Check pod status
kubectl get pod redis-0 -n swissbrain

# Check logs
kubectl logs redis-0 -n swissbrain -c redis

# Test Redis connection
kubectl exec -it redis-0 -n swissbrain -- redis-cli ping
# Should output: PONG

# Check Redis info
kubectl exec -it redis-0 -n swissbrain -- redis-cli info
```

### Step 3: Configure BullMQ Connection

```bash
# Apply BullMQ configuration
kubectl apply -f k8s/redis/bullmq-configmap.yaml

# Verify ConfigMap
kubectl get configmap bullmq-config -n swissbrain -o yaml
```

### Step 4: Set Up Monitoring

```bash
# Apply Redis monitoring
kubectl apply -f k8s/redis/redis-monitoring.yaml

# Verify ServiceMonitor
kubectl get servicemonitor redis -n swissbrain

# Check Prometheus is scraping Redis metrics
# Navigate to Prometheus UI and search for "redis_"
```

---

## BullMQ Integration

### Installation

```bash
npm install bullmq ioredis
```

### Basic Queue Setup

```typescript
import { Queue, Worker } from 'bullmq';

// Create queue
const queue = new Queue('my-queue', {
  connection: {
    host: 'redis.swissbrain.svc.cluster.local',
    port: 6379,
  },
});

// Add job
await queue.add('my-job', { data: 'hello' });

// Create worker
const worker = new Worker('my-queue', async (job) => {
  console.log('Processing:', job.data);
  return { success: true };
}, {
  connection: {
    host: 'redis.swissbrain.svc.cluster.local',
    port: 6379,
  },
});
```

### Queue Types

#### 1. Standard Queue

```typescript
const agentQueue = new Queue('agent-tasks', {
  connection: redisConnection,
});

await agentQueue.add('execute-task', {
  taskId: '123',
  prompt: 'Build a React app',
});
```

#### 2. Priority Queue

```typescript
// Add high-priority job
await queue.add('urgent-task', data, { priority: 1 });

// Add low-priority job
await queue.add('background-task', data, { priority: 100 });
```

#### 3. Delayed Queue

```typescript
// Execute in 1 hour
await queue.add('delayed-task', data, {
  delay: 3600000, // milliseconds
});
```

#### 4. Recurring Jobs

```typescript
// Run every day at midnight
await queue.add('daily-cleanup', data, {
  repeat: {
    pattern: '0 0 * * *',
  },
});
```

#### 5. Rate-Limited Queue

```typescript
const rateLimitedQueue = new Queue('limited-queue', {
  connection: redisConnection,
  limiter: {
    max: 100, // Max 100 jobs
    duration: 60000, // Per 60 seconds
  },
});
```

### Worker Configuration

```typescript
const worker = new Worker('agent-tasks', processor, {
  connection: redisConnection,
  concurrency: 10, // Process 10 jobs concurrently
  maxStalledCount: 3, // Retry stalled jobs 3 times
  stalledInterval: 30000, // Check every 30s
  lockDuration: 30000, // Lock job for 30s
  lockRenewTime: 15000, // Renew lock every 15s
});

// Event handlers
worker.on('completed', (job) => {
  console.log(`Job ${job.id} completed`);
});

worker.on('failed', (job, error) => {
  console.error(`Job ${job?.id} failed:`, error);
});

worker.on('progress', (job, progress) => {
  console.log(`Job ${job.id}: ${progress}%`);
});
```

### Job Options

```typescript
await queue.add('task', data, {
  // Retry configuration
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000, // Start at 1s, doubles each retry
  },

  // Timeout
  timeout: 300000, // 5 minutes

  // Cleanup
  removeOnComplete: {
    age: 86400, // Remove after 24 hours
    count: 1000, // Keep max 1000 jobs
  },
  removeOnFail: {
    age: 604800, // Keep failed jobs for 7 days
  },

  // Priority
  priority: 10,

  // Delay
  delay: 5000, // Wait 5s before processing

  // Job ID (for deduplication)
  jobId: 'unique-task-123',
});
```

---

## Queue Management

### Add Jobs

```typescript
// Single job
const job = await queue.add('task-name', { data: 'value' });

// Bulk jobs
await queue.addBulk([
  { name: 'task-1', data: { id: 1 } },
  { name: 'task-2', data: { id: 2 } },
  { name: 'task-3', data: { id: 3 } },
]);
```

### Get Queue Statistics

```typescript
const counts = await queue.getJobCounts();
console.log(counts);
// {
//   waiting: 10,
//   active: 5,
//   completed: 100,
//   failed: 2,
//   delayed: 3,
//   paused: 0
// }
```

### Retrieve Jobs

```typescript
// Get job by ID
const job = await queue.getJob('job-123');

// Get waiting jobs
const waiting = await queue.getWaiting();

// Get active jobs
const active = await queue.getActive();

// Get failed jobs
const failed = await queue.getFailed();
```

### Clean Queue

```typescript
// Remove completed jobs older than 24 hours
await queue.clean(24 * 3600 * 1000, 1000, 'completed');

// Remove failed jobs older than 7 days
await queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');
```

### Pause/Resume Queue

```typescript
// Pause queue (no new jobs processed)
await queue.pause();

// Resume queue
await queue.resume();

// Check if paused
const isPaused = await queue.isPaused();
```

### Retry Failed Jobs

```typescript
// Retry single job
const job = await queue.getJob('failed-job-id');
await job.retry();

// Retry all failed jobs
const failedJobs = await queue.getFailed();
for (const job of failedJobs) {
  await job.retry();
}
```

### Remove Jobs

```typescript
// Remove specific job
const job = await queue.getJob('job-123');
await job.remove();

// Remove all completed jobs
const completed = await queue.getCompleted();
for (const job of completed) {
  await job.remove();
}
```

---

## Monitoring and Alerts

### Redis Metrics (via Prometheus)

**Connection Metrics**:
- `redis_connected_clients`: Number of connected clients
- `redis_blocked_clients`: Clients blocked on blocking calls
- `redis_rejected_connections_total`: Rejected connections

**Memory Metrics**:
- `redis_memory_used_bytes`: Used memory
- `redis_memory_max_bytes`: Max memory limit
- `redis_memory_fragmentation_ratio`: Memory fragmentation

**Performance Metrics**:
- `redis_commands_processed_total`: Total commands processed
- `redis_keyspace_hits_total`: Successful key lookups
- `redis_keyspace_misses_total`: Failed key lookups
- `redis_slowlog_length`: Number of slow queries

**Persistence Metrics**:
- `redis_rdb_last_save_timestamp_seconds`: Last RDB save time
- `redis_aof_last_rewrite_timestamp_seconds`: Last AOF rewrite
- `redis_rdb_last_save_status`: RDB save status (1=success)

### BullMQ Metrics

**Queue Metrics** (custom implementation):
```typescript
const stats = await queue.getJobCounts();
// Export as Prometheus metrics
prometheusMetrics.setGauge('bullmq_queue_waiting', stats.waiting);
prometheusMetrics.setGauge('bullmq_queue_active', stats.active);
prometheusMetrics.setGauge('bullmq_queue_completed', stats.completed);
prometheusMetrics.setGauge('bullmq_queue_failed', stats.failed);
```

**Job Duration**:
```typescript
worker.on('completed', (job) => {
  const duration = Date.now() - job.timestamp;
  prometheusMetrics.observeHistogram('bullmq_job_duration_seconds', duration / 1000);
});
```

### Alerts

The deployment includes 10 Redis alerts:
1. **RedisDown**: Instance unavailable
2. **RedisHighMemoryUsage**: Memory > 90%
3. **RedisTooManyConnections**: Connections > 8000
4. **RedisRejectedConnections**: Rejecting connections
5. **RedisHighKeyEvictionRate**: Evicting > 100 keys/sec
6. **RedisReplicationLag**: Replica lag > 30s
7. **RedisRDBSaveFailure**: RDB save failing
8. **RedisAOFRewriteFailure**: AOF rewrite failing
9. **RedisSlowQueries**: > 10 slow queries/sec
10. **RedisHighCPUUsage**: CPU > 80%

### Grafana Dashboards

**Recommended dashboards**:
- Redis Dashboard (ID: 763)
- BullMQ Dashboard (custom)

**Key visualizations**:
- Queue depths over time
- Job processing rate
- Job failure rate
- Redis memory usage
- Redis command rate
- Slow query log

---

## Performance Optimization

### Redis Configuration

**Memory Optimization**:
```conf
maxmemory 1gb
maxmemory-policy allkeys-lru  # Evict least recently used keys
```

**Persistence Tuning**:
```conf
# RDB: Reduce snapshot frequency if writes are frequent
save 900 1
save 300 10
save 60 10000

# AOF: Balance between performance and durability
appendfsync everysec  # Good balance
# appendfsync always  # Maximum durability, slower
# appendfsync no      # Fastest, least durable
```

**Connection Limits**:
```conf
maxclients 10000
tcp-backlog 511
timeout 0  # Never close idle connections
```

### BullMQ Optimization

**Worker Concurrency**:
```typescript
// Adjust based on job type
const cpuIntensiveWorker = new Worker('cpu-tasks', processor, {
  concurrency: 4, // Lower for CPU-heavy jobs
});

const ioIntensiveWorker = new Worker('io-tasks', processor, {
  concurrency: 50, // Higher for I/O-heavy jobs
});
```

**Job Cleanup**:
```typescript
// Aggressive cleanup for high-volume queues
defaultJobOptions: {
  removeOnComplete: {
    age: 3600, // Remove after 1 hour
    count: 100,
  },
}
```

**Rate Limiting**:
```typescript
// Protect downstream services
limiter: {
  max: 1000,
  duration: 60000, // 1000 jobs per minute
}
```

### Horizontal Scaling

**Multiple Workers**:
```bash
# Deploy multiple worker pods
kubectl scale deployment agent-worker -n swissbrain --replicas=5
```

Workers automatically coordinate via Redis - jobs are distributed across all workers.

**Queue Sharding** (advanced):
```typescript
// Create multiple queues for different job types
const queues = {
  highPriority: new Queue('high-priority'),
  normal: new Queue('normal'),
  lowPriority: new Queue('low-priority'),
};

// Dedicate workers to specific queues
const highPriorityWorker = new Worker('high-priority', processor, {
  concurrency: 20,
});
```

---

## Troubleshooting

### Redis Issues

#### Connection Refused

```bash
# Check if Redis pod is running
kubectl get pod redis-0 -n swissbrain

# Check Redis logs
kubectl logs redis-0 -n swissbrain -c redis

# Test connection from another pod
kubectl run -it --rm debug \
  --image=redis:7.2-alpine \
  --restart=Never \
  -n swissbrain \
  -- redis-cli -h redis.swissbrain.svc.cluster.local ping
```

#### High Memory Usage

```bash
# Check Redis memory
kubectl exec redis-0 -n swissbrain -- redis-cli info memory

# Check for large keys
kubectl exec redis-0 -n swissbrain -- redis-cli --bigkeys

# Manually evict keys (if needed)
kubectl exec redis-0 -n swissbrain -- redis-cli FLUSHDB
```

#### Slow Queries

```bash
# Check slow log
kubectl exec redis-0 -n swissbrain -- redis-cli SLOWLOG GET 10

# Reset slow log
kubectl exec redis-0 -n swissbrain -- redis-cli SLOWLOG RESET
```

#### Persistence Failures

```bash
# Check RDB save status
kubectl exec redis-0 -n swissbrain -- redis-cli INFO persistence

# Force manual save
kubectl exec redis-0 -n swissbrain -- redis-cli BGSAVE

# Check disk space
kubectl exec redis-0 -n swissbrain -- df -h /data
```

### BullMQ Issues

#### Jobs Stuck in Waiting

```typescript
// Check queue stats
const counts = await queue.getJobCounts();
console.log(counts);

// Verify workers are running
worker.isRunning(); // Should be true

// Check if queue is paused
const isPaused = await queue.isPaused();
if (isPaused) {
  await queue.resume();
}
```

#### Jobs Failing Repeatedly

```typescript
// Get failed jobs
const failed = await queue.getFailed();
for (const job of failed) {
  console.log(`Job ${job.id} failed:`, job.failedReason);
  console.log('Job data:', job.data);
  console.log('Stack trace:', job.stacktrace);
}

// Retry with fixes
await job.retry();
```

#### Stalled Jobs

```typescript
// Stalled jobs are jobs that appear to be processing but worker died

// Get stalled jobs
const stalled = await queue.getActive();
console.log(`${stalled.length} potentially stalled jobs`);

// Workers automatically recover stalled jobs based on stalledInterval
// Adjust if needed:
new Worker('queue', processor, {
  stalledInterval: 30000, // Check every 30s
  maxStalledCount: 3, // Retry 3 times before failing
});
```

#### High Job Latency

```typescript
// Check waiting time
const waiting = await queue.getWaiting();
console.log(`${waiting.length} jobs waiting`);

// Solutions:
// 1. Increase worker concurrency
// 2. Add more worker instances
// 3. Optimize job processor
// 4. Use priority queues
```

---

## Best Practices

### Redis

1. ✅ **Use persistence**: Enable both RDB and AOF
2. ✅ **Set maxmemory**: Prevent OOM kills
3. ✅ **Monitor memory**: Alert at 80-90% usage
4. ✅ **Regular backups**: Backup RDB files
5. ✅ **Secure connection**: Use passwords in production
6. ✅ **Resource limits**: Set K8s resource requests/limits
7. ✅ **Persistent storage**: Use PVC for data persistence

### BullMQ

1. ✅ **Job idempotency**: Jobs should be safe to retry
2. ✅ **Timeout jobs**: Set reasonable timeouts
3. ✅ **Clean old jobs**: Remove completed/failed jobs regularly
4. ✅ **Monitor queues**: Track queue depths and job rates
5. ✅ **Graceful shutdown**: Close workers properly on SIGTERM
6. ✅ **Error handling**: Catch and log errors properly
7. ✅ **Progress tracking**: Update job progress for long tasks
8. ✅ **Rate limiting**: Protect downstream services
9. ✅ **Priority queues**: Use for important jobs
10. ✅ **Job deduplication**: Use jobId to prevent duplicates

---

## Additional Resources

- [Redis Documentation](https://redis.io/documentation)
- [Redis Configuration](https://redis.io/docs/manual/config/)
- [BullMQ Documentation](https://docs.bullmq.io/)
- [BullMQ Patterns](https://docs.bullmq.io/patterns/)
- [Redis Monitoring](https://redis.io/docs/manual/admin/)
- [Prometheus Redis Exporter](https://github.com/oliver006/redis_exporter)

---

## Summary

This guide provides a complete setup for Redis and BullMQ on Kubernetes:

- ✅ Redis StatefulSet with persistence (RDB + AOF)
- ✅ Redis monitoring with Prometheus + 10 alerts
- ✅ BullMQ configuration and examples
- ✅ Queue management and best practices
- ✅ Performance optimization strategies
- ✅ Comprehensive troubleshooting guide

With this setup, SwissBrain AI can handle:
- Background job processing
- Scheduled tasks
- Priority queues
- Rate-limited operations
- Distributed task execution
- Reliable job persistence

For additional help, refer to the example code in `k8s/redis/bullmq-examples.ts`.
