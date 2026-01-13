# Redis and BullMQ Configuration

This directory contains Kubernetes manifests and configuration for deploying Redis as a task queue backend for BullMQ.

## Quick Start

### Deploy Redis

```bash
# Deploy Redis StatefulSet
kubectl apply -f redis-statefulset.yaml

# Verify deployment
kubectl get statefulset redis -n swissbrain
kubectl get pod redis-0 -n swissbrain
kubectl get pvc -n swissbrain
kubectl get svc redis -n swissbrain

# Test connection
kubectl exec -it redis-0 -n swissbrain -- redis-cli ping
```

### Configure BullMQ

```bash
# Apply BullMQ configuration
kubectl apply -f bullmq-configmap.yaml

# Verify
kubectl get configmap bullmq-config -n swissbrain
```

### Set Up Monitoring

```bash
# Deploy Redis monitoring
kubectl apply -f redis-monitoring.yaml

# Verify
kubectl get servicemonitor redis -n swissbrain
kubectl get prometheusrule redis-alerts -n swissbrain
```

## Files

| File | Description |
|------|-------------|
| `redis-statefulset.yaml` | Redis StatefulSet with persistence, services, ConfigMap |
| `redis-monitoring.yaml` | ServiceMonitor and PrometheusRule for Redis |
| `bullmq-configmap.yaml` | BullMQ connection and queue configuration |
| `bullmq-examples.ts` | TypeScript examples for BullMQ integration |
| `README.md` | This file |

## Architecture

- **StatefulSet**: 1 replica with persistent storage (10Gi PVC)
- **Persistence**: RDB + AOF for maximum durability
- **Resources**: 100m-500m CPU, 256Mi-1Gi memory
- **Monitoring**: Redis exporter sidecar + Prometheus scraping
- **Services**: ClusterIP (redis) + Headless (redis-headless)

## Configuration

### Redis Settings

Key configuration in redis.conf:

```conf
# Persistence
save 900 1          # Save after 15 min if 1 key changed
save 300 10         # Save after 5 min if 10 keys changed
save 60 10000       # Save after 1 min if 10000 keys changed
appendonly yes      # Enable AOF
appendfsync everysec # Fsync every second

# Memory
maxmemory 1gb
maxmemory-policy allkeys-lru

# Limits
maxclients 10000
```

### BullMQ Connection

Default connection from ConfigMap:

```json
{
  "host": "redis.swissbrain.svc.cluster.local",
  "port": 6379,
  "maxRetriesPerRequest": 3,
  "retryStrategy": "exponential"
}
```

## Usage

### In Your Application

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

See `bullmq-examples.ts` for comprehensive examples.

## Monitoring

### Redis Metrics

Available at: `http://redis.swissbrain.svc.cluster.local:9121/metrics`

Key metrics:
- `redis_up`: Redis availability
- `redis_connected_clients`: Number of clients
- `redis_memory_used_bytes`: Memory usage
- `redis_commands_processed_total`: Commands executed
- `redis_keyspace_hits_total`: Cache hits
- `redis_keyspace_misses_total`: Cache misses

### Alerts

10 PrometheusRule alerts configured:
- RedisDown
- RedisHighMemoryUsage
- RedisTooManyConnections
- RedisRejectedConnections
- RedisHighKeyEvictionRate
- RedisReplicationLag
- RedisRDBSaveFailure
- RedisAOFRewriteFailure
- RedisSlowQueries
- RedisHighCPUUsage

## Management

### Common Commands

```bash
# Connect to Redis CLI
kubectl exec -it redis-0 -n swissbrain -- redis-cli

# Check info
kubectl exec -it redis-0 -n swissbrain -- redis-cli info

# Check memory
kubectl exec -it redis-0 -n swissbrain -- redis-cli info memory

# Check slow log
kubectl exec -it redis-0 -n swissbrain -- redis-cli slowlog get 10

# Flush database (DANGEROUS!)
kubectl exec -it redis-0 -n swissbrain -- redis-cli flushdb

# Get specific key
kubectl exec -it redis-0 -n swissbrain -- redis-cli get mykey

# Check keys
kubectl exec -it redis-0 -n swissbrain -- redis-cli keys "bull:*"
```

### Backup and Restore

```bash
# Trigger manual backup
kubectl exec -it redis-0 -n swissbrain -- redis-cli bgsave

# Copy RDB file from pod
kubectl cp swissbrain/redis-0:/data/dump.rdb ./dump.rdb

# Copy RDB file to pod
kubectl cp ./dump.rdb swissbrain/redis-0:/data/dump.rdb

# Restart Redis to load backup
kubectl delete pod redis-0 -n swissbrain
```

## Troubleshooting

### Redis Pod Not Starting

```bash
# Check pod status
kubectl get pod redis-0 -n swissbrain

# Describe pod
kubectl describe pod redis-0 -n swissbrain

# Check logs
kubectl logs redis-0 -n swissbrain -c redis
kubectl logs redis-0 -n swissbrain -c redis-exporter
```

### Connection Issues

```bash
# Test from debug pod
kubectl run -it --rm debug \
  --image=redis:7.2-alpine \
  --restart=Never \
  -n swissbrain \
  -- redis-cli -h redis.swissbrain.svc.cluster.local ping

# Check service
kubectl get svc redis -n swissbrain
kubectl describe svc redis -n swissbrain

# Check endpoints
kubectl get endpoints redis -n swissbrain
```

### High Memory Usage

```bash
# Check memory
kubectl exec redis-0 -n swissbrain -- redis-cli info memory

# Find large keys
kubectl exec redis-0 -n swissbrain -- redis-cli --bigkeys

# Check eviction stats
kubectl exec redis-0 -n swissbrain -- redis-cli info stats | grep evicted
```

### Persistence Issues

```bash
# Check persistence status
kubectl exec redis-0 -n swissbrain -- redis-cli info persistence

# Check PVC
kubectl get pvc -n swissbrain
kubectl describe pvc redis-data-redis-0 -n swissbrain

# Check disk space
kubectl exec redis-0 -n swissbrain -- df -h /data
```

## Scaling

### Vertical Scaling

Update resources in `redis-statefulset.yaml`:

```yaml
resources:
  requests:
    cpu: 250m      # Increase from 100m
    memory: 512Mi  # Increase from 256Mi
  limits:
    cpu: 1000m     # Increase from 500m
    memory: 2Gi    # Increase from 1Gi
```

### Storage Expansion

```bash
# Edit PVC (if storage class supports expansion)
kubectl edit pvc redis-data-redis-0 -n swissbrain

# Change: storage: 10Gi → storage: 20Gi
```

### Redis Cluster (Advanced)

For high availability, consider Redis Cluster or Redis Sentinel.
See: https://redis.io/docs/manual/scaling/

## Security

### Current Security

- ✅ Non-root user (UID 999)
- ✅ Read-only root filesystem for exporter
- ✅ All capabilities dropped
- ✅ Persistent storage with proper permissions
- ❌ No authentication (password not set)

### Adding Password Protection

1. Create secret:
```bash
kubectl create secret generic redis-password \
  --from-literal=password=$(openssl rand -base64 32) \
  -n swissbrain
```

2. Update redis.conf in ConfigMap:
```conf
requirepass <password>
```

3. Update connection config to include password

## Performance

### Current Configuration

- **Persistence**: RDB + AOF (balanced)
- **Memory policy**: allkeys-lru (evict least recently used)
- **Max memory**: 1GB
- **Max clients**: 10,000

### Optimization Tips

1. **For high write throughput**: Adjust AOF fsync
   ```conf
   appendfsync no  # Faster, less durable
   ```

2. **For read-heavy workloads**: Increase memory
   ```yaml
   maxmemory 2gb
   ```

3. **For low latency**: Disable persistence (not recommended)

4. **For high concurrency**: Increase max clients
   ```conf
   maxclients 50000
   ```

## Documentation

For detailed information, see:
- [Redis and BullMQ Guide](../../docs/REDIS_BULLMQ_GUIDE.md)
- [BullMQ Examples](bullmq-examples.ts)
- [Redis Documentation](https://redis.io/documentation)
- [BullMQ Documentation](https://docs.bullmq.io/)

## Support

For issues or questions:
1. Check logs: `kubectl logs redis-0 -n swissbrain`
2. Review Redis info: `kubectl exec redis-0 -n swissbrain -- redis-cli info`
3. Check Prometheus metrics and alerts
4. Refer to troubleshooting section above
