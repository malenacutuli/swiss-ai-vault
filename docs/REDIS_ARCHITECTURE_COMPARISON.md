# Redis Architecture Comparison: SwissBrain vs. Manus Enterprise Spec

## Executive Summary

| Aspect | SwissBrain Current | Manus Spec | Recommendation |
|--------|-------------------|------------|----------------|
| **Provider** | Upstash (managed) | Self-hosted K8s | Keep Upstash (cost-effective, Swiss compliance) |
| **Queue Library** | Custom Python | BullMQ (Node.js) | Consider BullMQ or keep Python with improvements |
| **Clustering** | None | 6-node cluster | Not needed at current scale |
| **Priority Queues** | Basic (2 levels) | 6 priority levels | Expand to 4 levels |
| **Connection Pooling** | None | generic-pool | Add connection pooling |
| **Monitoring** | Basic heartbeat | Full Prometheus | Add Redis metrics |
| **Security** | Single password | ACL-based | Keep current (Upstash handles) |

---

## 1. Current SwissBrain Implementation

### Queue Structure
```
jobs:pending        - Standard priority jobs
jobs:high_priority  - High priority jobs
jobs:processing     - Currently executing jobs
jobs:retry          - Jobs awaiting retry
jobs:failed         - Dead letter queue (DLQ)
```

### Code: `app/worker/job_queue.py`
```python
class JobQueue:
    """Custom Redis queue with priority, retry, DLQ support"""

    QUEUE_PENDING = "jobs:pending"
    QUEUE_HIGH_PRIORITY = "jobs:high_priority"
    QUEUE_PROCESSING = "jobs:processing"
    QUEUE_RETRY = "jobs:retry"
    QUEUE_FAILED = "jobs:failed"

    MAX_RETRIES = 3
    RETRY_DELAYS = [30, 60, 120]  # Exponential backoff
```

### Strengths
- Simple, lightweight implementation
- Works with Upstash serverless Redis
- Automatic TLS handling
- Low operational overhead

### Weaknesses
- No connection pooling (creates new connections)
- Limited priority levels (only 2)
- No job scheduling/delayed jobs
- No built-in metrics
- No rate limiting

---

## 2. Manus Enterprise Spec Analysis

### What They Recommend

#### Redis Cluster (6 nodes)
```yaml
# 3 primaries + 3 replicas for HA
replicas: 6
cluster-enabled: yes
cluster-replica-validity-factor: 10
```

**Our Assessment**: **NOT NEEDED**
- Upstash provides managed HA
- Our volume doesn't justify cluster complexity
- Cost: ~$1000/month for 6x32GB nodes vs. ~$50/month Upstash

#### BullMQ Priority Queues
```typescript
// Manus: 6 priority levels
const queues = [
  'tasks:critical',    // P0: 10s timeout
  'tasks:high',        // P1: 30s timeout
  'tasks:normal',      // P2: 2min timeout
  'tasks:low',         // P3: 5min timeout
  'tasks:batch',       // P4: 30min timeout
  'tasks:scheduled'    // P5: Cron jobs
];
```

**Our Assessment**: **ADOPT (partially)**
- Expand from 2 to 4 priority levels
- Add scheduling support for recurring tasks

#### Connection Pooling
```typescript
// Manus: generic-pool with health checks
const factory = {
  create: async () => new Redis.Cluster(nodes, opts),
  destroy: async (client) => client.disconnect(),
  validate: async (client) => client.ping() === 'PONG'
};
```

**Our Assessment**: **ADOPT**
- Add connection pooling to reduce connection overhead
- Implement health check validation

#### ACL Security
```acl
user admin on >password ~* &* +@all
user worker on >password ~bull:* +@read +@write -@admin
user api on >password ~bull:* +lpush +rpush -@admin
```

**Our Assessment**: **NOT NEEDED**
- Upstash handles security at API level
- Single service role key is sufficient for our architecture

---

## 3. Recommended Improvements for SwissBrain

### Priority 1: Connection Pooling (Immediate)

```python
# app/redis/pool.py
from redis import ConnectionPool, Redis

class RedisPool:
    _pools = {}

    @classmethod
    def get_connection(cls, purpose: str = 'default') -> Redis:
        if purpose not in cls._pools:
            settings = get_settings()
            cls._pools[purpose] = ConnectionPool.from_url(
                settings.redis_url,
                max_connections=10,
                decode_responses=True,
                ssl_cert_reqs='none' if 'upstash' in settings.redis_url else None
            )
        return Redis(connection_pool=cls._pools[purpose])
```

### Priority 2: Expanded Priority Queues

```python
# Expand queue structure
QUEUES = {
    'critical': {'name': 'jobs:critical', 'timeout': 30, 'weight': 4},
    'high':     {'name': 'jobs:high',     'timeout': 120, 'weight': 3},
    'normal':   {'name': 'jobs:normal',   'timeout': 300, 'weight': 2},
    'low':      {'name': 'jobs:low',      'timeout': 600, 'weight': 1},
}
```

### Priority 3: Basic Metrics

```python
# Worker metrics to Redis
async def report_metrics(self):
    metrics = {
        'worker_id': self.worker_id,
        'jobs_processed': self.jobs_processed,
        'jobs_failed': self.jobs_failed,
        'avg_processing_time_ms': self.avg_processing_time,
        'memory_mb': get_memory_usage(),
        'timestamp': datetime.utcnow().isoformat()
    }
    self.redis.hset('worker:metrics', self.worker_id, json.dumps(metrics))
    self.redis.expire('worker:metrics', 300)  # 5 min TTL
```

### Priority 4: Delayed/Scheduled Jobs

```python
# Add scheduled job support using Redis sorted sets
QUEUE_SCHEDULED = "jobs:scheduled"

async def schedule_job(self, job_data: dict, run_at: datetime):
    """Schedule a job for future execution"""
    score = run_at.timestamp()
    self.redis.zadd(QUEUE_SCHEDULED, {json.dumps(job_data): score})

async def check_scheduled(self):
    """Move due jobs to pending queue"""
    now = datetime.utcnow().timestamp()
    due_jobs = self.redis.zrangebyscore(QUEUE_SCHEDULED, 0, now)
    for job in due_jobs:
        self.redis.lpush(QUEUE_PENDING, job)
        self.redis.zrem(QUEUE_SCHEDULED, job)
```

---

## 4. What NOT to Adopt from Manus

### 1. Self-Hosted Redis Cluster
- **Why Not**: Operational complexity, cost, Upstash handles HA
- **Keep**: Upstash managed Redis

### 2. BullMQ (Node.js)
- **Why Not**: Would require rewriting worker in TypeScript
- **Keep**: Python worker with improvements

### 3. TLS Client Certificates
- **Why Not**: Upstash handles TLS automatically
- **Keep**: Simple password authentication

### 4. Complex ACL System
- **Why Not**: Single service context, no multi-tenant needs
- **Keep**: Service role key approach

---

## 5. Migration Path

### Phase 1 (Now - Working)
- [x] Basic queue with retry/DLQ
- [x] TLS via Upstash
- [x] Worker heartbeat

### Phase 2 (Next Sprint)
- [ ] Connection pooling
- [ ] Expanded priority levels (4)
- [ ] Basic metrics reporting

### Phase 3 (Future)
- [ ] Scheduled/delayed jobs
- [ ] Prometheus metrics exporter
- [ ] Rate limiting per user

---

## 6. Cost Comparison

| Setup | Monthly Cost | Ops Effort |
|-------|-------------|------------|
| **Upstash Pro** | ~$50-100 | Minimal |
| **Self-Hosted 6-node** | ~$1000+ | High |

**Recommendation**: Stay with Upstash until > 100K jobs/day

---

## 7. Conclusion

The Manus spec is designed for massive scale (millions of jobs/day). SwissBrain's current needs are better served by:

1. **Keep Upstash** - Cost-effective, Swiss-compliant, managed HA
2. **Improve Python queue** - Add pooling, metrics, priorities
3. **Skip clustering** - Not needed at current scale
4. **Skip BullMQ migration** - Would require full rewrite

The current architecture with incremental improvements is the right path.
