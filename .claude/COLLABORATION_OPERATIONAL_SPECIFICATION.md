# Collaboration System: Complete Operational Specification

**From:** Platform Technical Lead  
**Classification:** Internal Engineering Documentation  
**Purpose:** Production deployment specifications for collaboration system gaps

---

## Table of Contents

1. [Gap A: Operational Load & Limits](#gap-a-operational-load--limits)
2. [Gap B: Multi-Region & Latency Strategy](#gap-b-multi-region--latency-strategy)
3. [Gap C: Enterprise Compliance Hooks](#gap-c-enterprise-compliance-hooks)
4. [Gap D: Disaster Recovery RPO/RTO](#gap-d-disaster-recovery-rporto)
5. [Gap E: Abuse & Adversarial Collaboration](#gap-e-abuse--adversarial-collaboration)
6. [Implementation Schemas](#implementation-schemas)
7. [Monitoring & Alerting](#monitoring--alerting)

---

## Gap A: Operational Load & Limits

### A.1 Hard Limits (Enforced, Non-Negotiable)

```yaml
# =============================================================================
# HARD LIMITS - SYSTEM WILL REJECT BEYOND THESE
# =============================================================================

workspace_limits:
  max_collaborators_per_workspace:
    free_tier: 3
    pro_tier: 10
    enterprise_tier: 50
    absolute_max: 100  # Even enterprise cannot exceed
    
  max_documents_per_workspace:
    free_tier: 10
    pro_tier: 100
    enterprise_tier: 1000
    absolute_max: 10000

document_limits:
  max_document_size_bytes: 10485760  # 10 MB
  max_operations_per_document_history: 100000  # After this, compact
  max_pending_operations_per_client: 50

connection_limits:
  max_websocket_connections_per_user: 5  # Multiple tabs
  max_websocket_connections_per_workspace: 500
  websocket_idle_timeout_seconds: 300  # 5 minutes
  websocket_max_message_size_bytes: 65536  # 64 KB
```

### A.2 Soft Limits (Throttled, Not Rejected)

```yaml
# =============================================================================
# SOFT LIMITS - THROTTLING APPLIED BEYOND THESE
# =============================================================================

rate_limits:
  operations_per_second:
    per_user: 20
    per_document: 100
    per_workspace: 500
    burst_allowance: 2x  # Can burst to 2x for 5 seconds
    
  cursor_updates_per_second:
    per_user: 10
    per_document: 100
    
  prompt_requests_per_minute:
    per_user: 10
    per_workspace: 50

backpressure_thresholds:
  redis_queue_depth_warning: 1000
  redis_queue_depth_critical: 5000
  redis_queue_depth_reject: 10000
  
  websocket_send_buffer_warning: 100  # messages
  websocket_send_buffer_critical: 500
  websocket_send_buffer_drop: 1000
```

### A.3 Backpressure Behavior Under Burst Edits

```python
# =============================================================================
# BACKPRESSURE CONTROLLER
# =============================================================================

from dataclasses import dataclass
from enum import Enum
from typing import Optional
import time
import asyncio


class BackpressureLevel(Enum):
    NORMAL = "normal"           # No throttling
    ELEVATED = "elevated"       # Slight delay (10ms)
    HIGH = "high"               # Moderate delay (50ms)
    CRITICAL = "critical"       # Heavy delay (200ms)
    SHEDDING = "shedding"       # Dropping non-essential ops


@dataclass
class BackpressureState:
    """Current backpressure state for a document."""
    document_id: str
    level: BackpressureLevel
    ops_per_second: float
    queue_depth: int
    last_updated: float
    
    # Throttle delays by level
    DELAYS = {
        BackpressureLevel.NORMAL: 0,
        BackpressureLevel.ELEVATED: 0.010,    # 10ms
        BackpressureLevel.HIGH: 0.050,        # 50ms
        BackpressureLevel.CRITICAL: 0.200,    # 200ms
        BackpressureLevel.SHEDDING: 0.500,    # 500ms + drop
    }


class BackpressureController:
    """
    Controls backpressure for collaboration operations.
    
    Backpressure Strategy:
    1. Monitor ops/second and queue depth
    2. Calculate backpressure level
    3. Apply appropriate delay or shedding
    4. Notify clients of degraded mode
    """
    
    def __init__(self):
        self.states: dict[str, BackpressureState] = {}
        self.metrics = BackpressureMetrics()
        
        # Thresholds
        self.OPS_THRESHOLD_ELEVATED = 50    # ops/sec
        self.OPS_THRESHOLD_HIGH = 100
        self.OPS_THRESHOLD_CRITICAL = 200
        self.OPS_THRESHOLD_SHEDDING = 500
        
        self.QUEUE_THRESHOLD_ELEVATED = 100
        self.QUEUE_THRESHOLD_HIGH = 500
        self.QUEUE_THRESHOLD_CRITICAL = 1000
        self.QUEUE_THRESHOLD_SHEDDING = 5000
    
    def calculate_level(
        self,
        ops_per_second: float,
        queue_depth: int
    ) -> BackpressureLevel:
        """
        Calculate backpressure level based on current load.
        
        Uses the HIGHER of ops-based or queue-based level.
        """
        # Ops-based level
        if ops_per_second >= self.OPS_THRESHOLD_SHEDDING:
            ops_level = BackpressureLevel.SHEDDING
        elif ops_per_second >= self.OPS_THRESHOLD_CRITICAL:
            ops_level = BackpressureLevel.CRITICAL
        elif ops_per_second >= self.OPS_THRESHOLD_HIGH:
            ops_level = BackpressureLevel.HIGH
        elif ops_per_second >= self.OPS_THRESHOLD_ELEVATED:
            ops_level = BackpressureLevel.ELEVATED
        else:
            ops_level = BackpressureLevel.NORMAL
        
        # Queue-based level
        if queue_depth >= self.QUEUE_THRESHOLD_SHEDDING:
            queue_level = BackpressureLevel.SHEDDING
        elif queue_depth >= self.QUEUE_THRESHOLD_CRITICAL:
            queue_level = BackpressureLevel.CRITICAL
        elif queue_depth >= self.QUEUE_THRESHOLD_HIGH:
            queue_level = BackpressureLevel.HIGH
        elif queue_depth >= self.QUEUE_THRESHOLD_ELEVATED:
            queue_level = BackpressureLevel.ELEVATED
        else:
            queue_level = BackpressureLevel.NORMAL
        
        # Return higher level
        levels = list(BackpressureLevel)
        return levels[max(levels.index(ops_level), levels.index(queue_level))]
    
    async def apply_backpressure(
        self,
        document_id: str,
        operation_type: str
    ) -> tuple[bool, Optional[str]]:
        """
        Apply backpressure for an operation.
        
        Returns:
            (should_process, rejection_reason)
        """
        state = self.states.get(document_id)
        if not state:
            return (True, None)
        
        level = state.level
        delay = BackpressureState.DELAYS[level]
        
        # Apply delay
        if delay > 0:
            await asyncio.sleep(delay)
        
        # Shedding logic
        if level == BackpressureLevel.SHEDDING:
            # Drop non-essential operations
            if operation_type in ["cursor_update", "presence_update"]:
                self.metrics.record_shed(document_id, operation_type)
                return (False, "backpressure_shedding")
            
            # For essential ops, apply extra delay
            await asyncio.sleep(0.5)
        
        return (True, None)
    
    def should_notify_client(self, document_id: str) -> Optional[dict]:
        """
        Check if client should be notified of backpressure.
        
        Returns notification message if needed.
        """
        state = self.states.get(document_id)
        if not state:
            return None
        
        if state.level in [BackpressureLevel.CRITICAL, BackpressureLevel.SHEDDING]:
            return {
                "type": "backpressure_warning",
                "level": state.level.value,
                "message": "High edit activity detected. Some updates may be delayed.",
                "retry_after_ms": int(BackpressureState.DELAYS[state.level] * 1000)
            }
        
        return None


# =============================================================================
# BURST HANDLING
# =============================================================================

class BurstHandler:
    """
    Handles burst edit scenarios.
    
    Burst Detection:
    - Normal: < 20 ops/sec sustained
    - Burst: 20-100 ops/sec for < 5 seconds
    - Flood: > 100 ops/sec or burst > 5 seconds
    
    Burst Allowance:
    - Allow 2x normal rate for up to 5 seconds
    - After 5 seconds, apply throttling
    - After 10 seconds, start shedding
    """
    
    def __init__(self):
        self.burst_windows: dict[str, BurstWindow] = {}
        
        self.NORMAL_RATE = 20       # ops/sec
        self.BURST_RATE = 100       # ops/sec (max during burst)
        self.BURST_DURATION = 5.0   # seconds
        self.FLOOD_DURATION = 10.0  # seconds
    
    def record_operation(self, document_id: str, user_id: str) -> BurstStatus:
        """Record an operation and return burst status."""
        now = time.time()
        
        window = self.burst_windows.get(document_id)
        if not window:
            window = BurstWindow(document_id)
            self.burst_windows[document_id] = window
        
        window.add_operation(now, user_id)
        
        # Calculate current rate
        rate = window.get_rate(now)
        duration = window.get_burst_duration(now)
        
        if rate <= self.NORMAL_RATE:
            return BurstStatus.NORMAL
        elif rate <= self.BURST_RATE and duration <= self.BURST_DURATION:
            return BurstStatus.BURST_ALLOWED
        elif duration <= self.FLOOD_DURATION:
            return BurstStatus.THROTTLE
        else:
            return BurstStatus.FLOOD


class BurstStatus(Enum):
    NORMAL = "normal"
    BURST_ALLOWED = "burst_allowed"
    THROTTLE = "throttle"
    FLOOD = "flood"


@dataclass
class BurstWindow:
    """Sliding window for burst detection."""
    document_id: str
    operations: list = None  # (timestamp, user_id)
    burst_start: Optional[float] = None
    window_size: float = 1.0  # 1 second window
    
    def __post_init__(self):
        self.operations = []
    
    def add_operation(self, timestamp: float, user_id: str):
        self.operations.append((timestamp, user_id))
        # Trim old operations
        cutoff = timestamp - self.window_size
        self.operations = [(t, u) for t, u in self.operations if t > cutoff]
        
        # Track burst start
        if len(self.operations) > 20 and self.burst_start is None:
            self.burst_start = timestamp
    
    def get_rate(self, now: float) -> float:
        """Get current ops/second."""
        cutoff = now - self.window_size
        recent = [t for t, _ in self.operations if t > cutoff]
        return len(recent) / self.window_size
    
    def get_burst_duration(self, now: float) -> float:
        """Get duration of current burst."""
        if self.burst_start is None:
            return 0.0
        return now - self.burst_start
```

### A.4 Redis Channel Sharding Strategy

```python
# =============================================================================
# REDIS SHARDING STRATEGY
# =============================================================================

"""
Redis Pub/Sub Sharding Strategy

Problem:
- Single Redis pub/sub channel cannot scale beyond ~100k subscribers
- Hot documents create thundering herd on single channel
- Cross-region pub/sub adds latency

Solution: Consistent Hash Ring with Virtual Nodes

Architecture:
┌─────────────────────────────────────────────────────────────────┐
│                     Redis Cluster (6 nodes)                      │
├─────────────────────────────────────────────────────────────────┤
│  Shard 0    │  Shard 1    │  Shard 2    │  Shard 3    │ ...    │
│  (docs 0-X) │  (docs X-Y) │  (docs Y-Z) │  (docs Z-W) │        │
├─────────────────────────────────────────────────────────────────┤
│  Channel:   │  Channel:   │  Channel:   │  Channel:   │        │
│  collab:0:* │  collab:1:* │  collab:2:* │  collab:3:* │        │
└─────────────────────────────────────────────────────────────────┘

Channel Naming:
- collab:{shard}:doc:{doc_id}:ops     - OT operations
- collab:{shard}:doc:{doc_id}:cursor  - Cursor updates
- collab:{shard}:doc:{doc_id}:presence - Presence updates
- collab:{shard}:ws:{workspace_id}:*  - Workspace-level events
"""

import hashlib
from typing import List, Tuple
from bisect import bisect_left


class ConsistentHashRing:
    """
    Consistent hash ring for Redis shard selection.
    
    Uses virtual nodes for better distribution.
    """
    
    def __init__(self, nodes: List[str], virtual_nodes: int = 150):
        """
        Initialize hash ring.
        
        Args:
            nodes: List of Redis node identifiers (e.g., ["redis-0", "redis-1", ...])
            virtual_nodes: Number of virtual nodes per physical node
        """
        self.nodes = nodes
        self.virtual_nodes = virtual_nodes
        self.ring: List[Tuple[int, str]] = []
        
        self._build_ring()
    
    def _build_ring(self):
        """Build the hash ring with virtual nodes."""
        self.ring = []
        
        for node in self.nodes:
            for i in range(self.virtual_nodes):
                key = f"{node}:{i}"
                hash_value = self._hash(key)
                self.ring.append((hash_value, node))
        
        # Sort by hash value
        self.ring.sort(key=lambda x: x[0])
    
    def _hash(self, key: str) -> int:
        """Compute hash for a key."""
        return int(hashlib.md5(key.encode()).hexdigest(), 16)
    
    def get_node(self, key: str) -> str:
        """
        Get the node responsible for a key.
        
        Uses consistent hashing to ensure:
        - Same key always maps to same node
        - Adding/removing nodes only affects nearby keys
        """
        if not self.ring:
            raise ValueError("No nodes in ring")
        
        hash_value = self._hash(key)
        
        # Find first node with hash >= key hash
        hashes = [h for h, _ in self.ring]
        idx = bisect_left(hashes, hash_value)
        
        # Wrap around if needed
        if idx >= len(self.ring):
            idx = 0
        
        return self.ring[idx][1]
    
    def get_shard_id(self, key: str) -> int:
        """Get numeric shard ID for a key."""
        node = self.get_node(key)
        return self.nodes.index(node)


class RedisShardManager:
    """
    Manages Redis sharding for collaboration.
    
    Responsibilities:
    - Route operations to correct shard
    - Handle shard failures
    - Rebalance on topology changes
    """
    
    def __init__(self, redis_nodes: List[str]):
        self.hash_ring = ConsistentHashRing(redis_nodes)
        self.node_connections: dict[str, 'RedisConnection'] = {}
        
        # Channel prefixes
        self.OPS_CHANNEL = "collab:{shard}:doc:{doc_id}:ops"
        self.CURSOR_CHANNEL = "collab:{shard}:doc:{doc_id}:cursor"
        self.PRESENCE_CHANNEL = "collab:{shard}:doc:{doc_id}:presence"
    
    def get_ops_channel(self, document_id: str) -> str:
        """Get the operations channel for a document."""
        shard = self.hash_ring.get_shard_id(document_id)
        return self.OPS_CHANNEL.format(shard=shard, doc_id=document_id)
    
    def get_cursor_channel(self, document_id: str) -> str:
        """Get the cursor channel for a document."""
        shard = self.hash_ring.get_shard_id(document_id)
        return self.CURSOR_CHANNEL.format(shard=shard, doc_id=document_id)
    
    async def publish_operation(
        self,
        document_id: str,
        operation: dict
    ) -> int:
        """
        Publish an operation to the correct shard.
        
        Returns number of subscribers that received the message.
        """
        channel = self.get_ops_channel(document_id)
        node = self.hash_ring.get_node(document_id)
        conn = self.node_connections[node]
        
        return await conn.publish(channel, operation)
    
    async def subscribe_document(
        self,
        document_id: str,
        callback: callable
    ) -> 'Subscription':
        """Subscribe to all channels for a document."""
        shard = self.hash_ring.get_shard_id(document_id)
        node = self.hash_ring.get_node(document_id)
        conn = self.node_connections[node]
        
        channels = [
            self.get_ops_channel(document_id),
            self.get_cursor_channel(document_id),
            self.get_presence_channel(document_id)
        ]
        
        return await conn.subscribe(channels, callback)


# =============================================================================
# REDIS CLUSTER CONFIGURATION
# =============================================================================

REDIS_CLUSTER_CONFIG = {
    "cluster_mode": True,
    "nodes": [
        {"host": "redis-0.redis.svc.cluster.local", "port": 6379},
        {"host": "redis-1.redis.svc.cluster.local", "port": 6379},
        {"host": "redis-2.redis.svc.cluster.local", "port": 6379},
        {"host": "redis-3.redis.svc.cluster.local", "port": 6379},
        {"host": "redis-4.redis.svc.cluster.local", "port": 6379},
        {"host": "redis-5.redis.svc.cluster.local", "port": 6379},
    ],
    "replica_count": 1,  # 1 replica per primary
    
    # Connection pool settings
    "max_connections_per_node": 100,
    "socket_timeout": 5.0,
    "socket_connect_timeout": 2.0,
    
    # Pub/sub settings
    "pubsub_buffer_size": 10000,
    "pubsub_max_pending": 5000,
    
    # Sharding settings
    "virtual_nodes_per_shard": 150,
    "rebalance_threshold": 0.2,  # Rebalance if >20% imbalance
}
```

### A.5 WebSocket Fan-Out Limits

```python
# =============================================================================
# WEBSOCKET FAN-OUT CONTROLLER
# =============================================================================

"""
WebSocket Fan-Out Strategy

Problem:
- Broadcasting to 100 clients = 100 sends
- Hot documents with 50 collaborators = 50 sends per operation
- At 100 ops/sec = 5000 sends/sec per document

Solution: Tiered Fan-Out with Batching

Tier 1: Direct (< 10 clients)
- Send immediately to all clients
- No batching

Tier 2: Batched (10-50 clients)
- Batch operations over 50ms window
- Single broadcast per batch

Tier 3: Delegated (> 50 clients)
- Delegate to fan-out workers
- Use Redis pub/sub for distribution
"""

from dataclasses import dataclass, field
from typing import List, Set, Dict, Optional
import asyncio
import time


@dataclass
class FanOutConfig:
    """Fan-out configuration."""
    
    # Tier thresholds
    TIER_1_MAX_CLIENTS: int = 10
    TIER_2_MAX_CLIENTS: int = 50
    
    # Batching settings
    BATCH_WINDOW_MS: int = 50
    MAX_BATCH_SIZE: int = 100
    
    # Per-server limits
    MAX_WEBSOCKETS_PER_SERVER: int = 10000
    MAX_MESSAGES_PER_SECOND_PER_SERVER: int = 100000
    
    # Per-client limits
    MAX_PENDING_MESSAGES_PER_CLIENT: int = 100
    CLIENT_SLOW_THRESHOLD_MS: int = 100


class WebSocketFanOutController:
    """
    Controls WebSocket fan-out with tiered strategy.
    """
    
    def __init__(self, config: FanOutConfig = None):
        self.config = config or FanOutConfig()
        self.document_clients: Dict[str, Set[str]] = {}  # doc_id -> client_ids
        self.client_connections: Dict[str, 'WebSocketConnection'] = {}
        self.pending_batches: Dict[str, List[dict]] = {}  # doc_id -> messages
        self.batch_timers: Dict[str, asyncio.Task] = {}
        
        # Metrics
        self.messages_sent = 0
        self.messages_batched = 0
        self.messages_dropped = 0
        self.slow_clients: Set[str] = set()
    
    async def broadcast(
        self,
        document_id: str,
        message: dict,
        exclude_client: Optional[str] = None
    ) -> int:
        """
        Broadcast a message to all clients of a document.
        
        Returns number of clients that received the message.
        """
        clients = self.document_clients.get(document_id, set())
        if exclude_client:
            clients = clients - {exclude_client}
        
        client_count = len(clients)
        
        if client_count == 0:
            return 0
        
        # Tier 1: Direct send
        if client_count <= self.config.TIER_1_MAX_CLIENTS:
            return await self._direct_send(clients, message)
        
        # Tier 2: Batched send
        elif client_count <= self.config.TIER_2_MAX_CLIENTS:
            return await self._batched_send(document_id, clients, message)
        
        # Tier 3: Delegated send
        else:
            return await self._delegated_send(document_id, clients, message)
    
    async def _direct_send(
        self,
        clients: Set[str],
        message: dict
    ) -> int:
        """Direct send to all clients."""
        sent = 0
        
        tasks = []
        for client_id in clients:
            conn = self.client_connections.get(client_id)
            if conn and not conn.is_slow:
                tasks.append(self._send_to_client(conn, message))
        
        results = await asyncio.gather(*tasks, return_exceptions=True)
        sent = sum(1 for r in results if r is True)
        
        self.messages_sent += sent
        return sent
    
    async def _batched_send(
        self,
        document_id: str,
        clients: Set[str],
        message: dict
    ) -> int:
        """Batch messages and send periodically."""
        # Add to pending batch
        if document_id not in self.pending_batches:
            self.pending_batches[document_id] = []
        
        self.pending_batches[document_id].append(message)
        self.messages_batched += 1
        
        # Start batch timer if not running
        if document_id not in self.batch_timers:
            self.batch_timers[document_id] = asyncio.create_task(
                self._flush_batch(document_id, clients)
            )
        
        # Check batch size limit
        if len(self.pending_batches[document_id]) >= self.config.MAX_BATCH_SIZE:
            await self._flush_batch_now(document_id, clients)
        
        return len(clients)  # Optimistic count
    
    async def _flush_batch(
        self,
        document_id: str,
        clients: Set[str]
    ):
        """Flush batch after delay."""
        await asyncio.sleep(self.config.BATCH_WINDOW_MS / 1000)
        await self._flush_batch_now(document_id, clients)
    
    async def _flush_batch_now(
        self,
        document_id: str,
        clients: Set[str]
    ):
        """Immediately flush pending batch."""
        messages = self.pending_batches.pop(document_id, [])
        self.batch_timers.pop(document_id, None)
        
        if not messages:
            return
        
        # Send batched message
        batched_message = {
            "type": "batch",
            "messages": messages,
            "count": len(messages)
        }
        
        await self._direct_send(clients, batched_message)
    
    async def _delegated_send(
        self,
        document_id: str,
        clients: Set[str],
        message: dict
    ) -> int:
        """Delegate to fan-out workers via Redis."""
        # Publish to Redis, let fan-out workers handle distribution
        channel = f"fanout:{document_id}"
        
        fanout_message = {
            "document_id": document_id,
            "message": message,
            "client_ids": list(clients),
            "timestamp": time.time()
        }
        
        # This would be published to Redis
        # Fan-out workers subscribe and distribute
        await self._publish_to_redis(channel, fanout_message)
        
        return len(clients)  # Optimistic count
    
    async def _send_to_client(
        self,
        conn: 'WebSocketConnection',
        message: dict
    ) -> bool:
        """Send message to a single client with backpressure."""
        # Check pending queue
        if conn.pending_count >= self.config.MAX_PENDING_MESSAGES_PER_CLIENT:
            self.messages_dropped += 1
            self._mark_slow_client(conn.client_id)
            return False
        
        try:
            start = time.time()
            await conn.send(message)
            elapsed = (time.time() - start) * 1000
            
            if elapsed > self.config.CLIENT_SLOW_THRESHOLD_MS:
                self._mark_slow_client(conn.client_id)
            
            return True
        except Exception:
            return False
    
    def _mark_slow_client(self, client_id: str):
        """Mark a client as slow."""
        self.slow_clients.add(client_id)
        conn = self.client_connections.get(client_id)
        if conn:
            conn.is_slow = True


# =============================================================================
# FAN-OUT WORKER (FOR TIER 3)
# =============================================================================

class FanOutWorker:
    """
    Dedicated worker for high-volume fan-out.
    
    Runs as separate process/pod, subscribes to Redis,
    handles distribution to clients.
    """
    
    def __init__(self, worker_id: str, redis_client):
        self.worker_id = worker_id
        self.redis = redis_client
        self.local_clients: Dict[str, 'WebSocketConnection'] = {}
        
        # Each worker handles a subset of clients
        # Clients are assigned to workers via consistent hashing
    
    async def run(self):
        """Main worker loop."""
        # Subscribe to fan-out channels
        pubsub = self.redis.pubsub()
        await pubsub.psubscribe("fanout:*")
        
        async for message in pubsub.listen():
            if message["type"] == "pmessage":
                await self._handle_fanout(message)
    
    async def _handle_fanout(self, message: dict):
        """Handle a fan-out message."""
        data = message["data"]
        
        # Filter to clients this worker owns
        my_clients = [
            cid for cid in data["client_ids"]
            if cid in self.local_clients
        ]
        
        # Send to each client
        for client_id in my_clients:
            conn = self.local_clients.get(client_id)
            if conn:
                try:
                    await conn.send(data["message"])
                except Exception:
                    pass  # Client disconnected
```

### A.6 Auto-Scaling Triggers

```yaml
# =============================================================================
# AUTO-SCALING CONFIGURATION
# =============================================================================

# Kubernetes HPA for WebSocket servers
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: collab-websocket-hpa
  namespace: collaboration
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: collab-websocket
  minReplicas: 3
  maxReplicas: 50
  metrics:
    # Scale on WebSocket connections
    - type: Pods
      pods:
        metric:
          name: websocket_connections_total
        target:
          type: AverageValue
          averageValue: 5000  # Scale up at 5000 connections per pod
    
    # Scale on message throughput
    - type: Pods
      pods:
        metric:
          name: messages_per_second
        target:
          type: AverageValue
          averageValue: 50000  # Scale up at 50k msg/sec per pod
    
    # Scale on CPU
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    
    # Scale on memory
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 4
          periodSeconds: 60
        - type: Percent
          value: 100
          periodSeconds: 60
      selectPolicy: Max
    
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 2
          periodSeconds: 120
      selectPolicy: Min

---
# Prometheus alerting rules for scaling
groups:
  - name: collaboration_scaling
    rules:
      # Alert when approaching connection limit
      - alert: CollabConnectionsHigh
        expr: |
          sum(websocket_connections_total) / 
          sum(kube_deployment_spec_replicas{deployment="collab-websocket"}) 
          > 8000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "WebSocket connections approaching limit"
          description: "Average {{ $value }} connections per pod"
      
      # Alert when message throughput is high
      - alert: CollabThroughputHigh
        expr: |
          sum(rate(messages_sent_total[1m])) / 
          sum(kube_deployment_spec_replicas{deployment="collab-websocket"}) 
          > 80000
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Message throughput approaching limit"
      
      # Alert when backpressure is active
      - alert: CollabBackpressureActive
        expr: |
          sum(backpressure_level{level=~"critical|shedding"}) > 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Collaboration backpressure active"
      
      # Alert when Redis queue is deep
      - alert: CollabRedisQueueDeep
        expr: |
          max(redis_pubsub_pending_messages) > 5000
        for: 1m
        labels:
          severity: warning
        annotations:
          summary: "Redis pub/sub queue depth high"
```

---

## Gap B: Multi-Region & Latency Strategy

### B.1 Regional Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-REGION COLLABORATION                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐│
│  │   US-EAST-1     │         │   EU-WEST-1     │         │   AP-SOUTH-1    ││
│  │   (PRIMARY)     │◄───────►│   (REPLICA)     │◄───────►│   (REPLICA)     ││
│  │                 │  Async   │                 │  Async   │                 ││
│  │ ┌─────────────┐ │  Repl   │ ┌─────────────┐ │  Repl   │ ┌─────────────┐ ││
│  │ │ PostgreSQL  │ │◄───────►│ │ PostgreSQL  │ │◄───────►│ │ PostgreSQL  │ ││
│  │ │ (Primary)   │ │         │ │ (Read Rep)  │ │         │ │ (Read Rep)  │ ││
│  │ └─────────────┘ │         │ └─────────────┘ │         │ └─────────────┘ ││
│  │                 │         │                 │         │                 ││
│  │ ┌─────────────┐ │         │ ┌─────────────┐ │         │ ┌─────────────┐ ││
│  │ │ Redis       │ │◄───────►│ │ Redis       │ │◄───────►│ │ Redis       │ ││
│  │ │ (Primary)   │ │  CRDT   │ │ (Local)     │ │  CRDT   │ │ (Local)     │ ││
│  │ └─────────────┘ │  Sync   │ └─────────────┘ │  Sync   │ └─────────────┘ ││
│  │                 │         │                 │         │                 ││
│  │ ┌─────────────┐ │         │ ┌─────────────┐ │         │ ┌─────────────┐ ││
│  │ │ WS Servers  │ │         │ │ WS Servers  │ │         │ │ WS Servers  │ ││
│  │ └─────────────┘ │         │ └─────────────┘ │         │ └─────────────┘ ││
│  └─────────────────┘         └─────────────────┘         └─────────────────┘│
│                                                                              │
│  Version Assignment: PRIMARY REGION ONLY (US-EAST-1)                         │
│  OT Transformation: LOCAL (each region)                                      │
│  Conflict Resolution: PRIMARY REGION                                         │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### B.2 Collaborator Pinning Strategy

```python
# =============================================================================
# REGION PINNING STRATEGY
# =============================================================================

"""
Collaborator Pinning Rules:

1. DOCUMENT-LEVEL PINNING (Default)
   - All collaborators on a document are pinned to the document's home region
   - Document home region = region where document was created
   - Ensures strong consistency for OT

2. WORKSPACE-LEVEL PINNING (Enterprise)
   - All documents in a workspace share the same home region
   - Reduces cross-region traffic for workspace-heavy usage

3. USER-LEVEL PINNING (Not Recommended)
   - Each user connects to their nearest region
   - Requires cross-region OT synchronization
   - Only for read-heavy, low-collaboration workloads

Decision Matrix:
┌─────────────────────┬─────────────────┬─────────────────┬─────────────────┐
│ Scenario            │ Pinning         │ Latency         │ Consistency     │
├─────────────────────┼─────────────────┼─────────────────┼─────────────────┤
│ 2 users, same city  │ Document        │ <50ms           │ Strong          │
│ 2 users, same region│ Document        │ <100ms          │ Strong          │
│ 2 users, diff region│ Document        │ 100-300ms       │ Strong          │
│ 5 users, global     │ Document        │ 50-300ms        │ Strong          │
│ Read-only viewers   │ User (nearest)  │ <50ms           │ Eventual        │
└─────────────────────┴─────────────────┴─────────────────┴─────────────────┘
"""

from dataclasses import dataclass
from enum import Enum
from typing import Optional, List
import time


class PinningStrategy(Enum):
    DOCUMENT = "document"
    WORKSPACE = "workspace"
    USER = "user"


class Region(Enum):
    US_EAST_1 = "us-east-1"
    US_WEST_2 = "us-west-2"
    EU_WEST_1 = "eu-west-1"
    EU_CENTRAL_1 = "eu-central-1"
    AP_SOUTH_1 = "ap-south-1"
    AP_NORTHEAST_1 = "ap-northeast-1"


# Inter-region latencies (approximate RTT in ms)
REGION_LATENCIES = {
    (Region.US_EAST_1, Region.US_WEST_2): 70,
    (Region.US_EAST_1, Region.EU_WEST_1): 80,
    (Region.US_EAST_1, Region.EU_CENTRAL_1): 90,
    (Region.US_EAST_1, Region.AP_SOUTH_1): 200,
    (Region.US_EAST_1, Region.AP_NORTHEAST_1): 170,
    (Region.EU_WEST_1, Region.EU_CENTRAL_1): 20,
    (Region.EU_WEST_1, Region.AP_SOUTH_1): 130,
    (Region.AP_SOUTH_1, Region.AP_NORTHEAST_1): 100,
    # ... symmetric pairs
}


@dataclass
class CollaboratorPinning:
    """Pinning configuration for a collaborator."""
    user_id: str
    document_id: str
    pinned_region: Region
    strategy: PinningStrategy
    latency_to_home: int  # ms
    is_degraded: bool  # True if latency > threshold


class RegionPinningManager:
    """
    Manages region pinning for collaborators.
    """
    
    def __init__(self):
        self.document_regions: dict[str, Region] = {}
        self.workspace_regions: dict[str, Region] = {}
        self.user_regions: dict[str, Region] = {}
        
        # Thresholds
        self.LATENCY_WARNING_MS = 150
        self.LATENCY_DEGRADED_MS = 300
    
    def get_pinned_region(
        self,
        user_id: str,
        document_id: str,
        workspace_id: str,
        user_region: Region,
        strategy: PinningStrategy = PinningStrategy.DOCUMENT
    ) -> CollaboratorPinning:
        """
        Determine the pinned region for a collaborator.
        """
        if strategy == PinningStrategy.DOCUMENT:
            home_region = self.document_regions.get(document_id, Region.US_EAST_1)
        elif strategy == PinningStrategy.WORKSPACE:
            home_region = self.workspace_regions.get(workspace_id, Region.US_EAST_1)
        else:  # USER
            home_region = user_region
        
        # Calculate latency
        latency = self._get_latency(user_region, home_region)
        is_degraded = latency > self.LATENCY_DEGRADED_MS
        
        return CollaboratorPinning(
            user_id=user_id,
            document_id=document_id,
            pinned_region=home_region,
            strategy=strategy,
            latency_to_home=latency,
            is_degraded=is_degraded
        )
    
    def _get_latency(self, from_region: Region, to_region: Region) -> int:
        """Get latency between two regions."""
        if from_region == to_region:
            return 10  # Same region
        
        key = (from_region, to_region)
        reverse_key = (to_region, from_region)
        
        return REGION_LATENCIES.get(key) or REGION_LATENCIES.get(reverse_key) or 200
    
    def should_warn_user(self, pinning: CollaboratorPinning) -> Optional[str]:
        """Check if user should be warned about latency."""
        if pinning.latency_to_home > self.LATENCY_DEGRADED_MS:
            return (
                f"High latency detected ({pinning.latency_to_home}ms). "
                f"Collaboration may feel sluggish. "
                f"Consider asking the document owner to move the document closer to your region."
            )
        elif pinning.latency_to_home > self.LATENCY_WARNING_MS:
            return (
                f"Moderate latency detected ({pinning.latency_to_home}ms). "
                f"Some delay may be noticeable."
            )
        return None
```

### B.3 OT Consistency with High Latency

```python
# =============================================================================
# HIGH-LATENCY OT HANDLING
# =============================================================================

"""
OT Consistency Under High Latency (>100ms RTT)

Problem:
- User A (US) and User B (Asia) collaborate
- RTT between them: 200ms
- User A types, User B types simultaneously
- Operations cross in flight

Solution: Version Vector + Buffered Acknowledgment

1. Each operation carries a version vector
2. Server assigns canonical version (PRIMARY REGION ONLY)
3. Clients buffer operations until acknowledged
4. Transformation happens at server AND client

Timeline Example:
┌─────────────────────────────────────────────────────────────────────────────┐
│ Time    │ User A (US)           │ Server (US)           │ User B (Asia)     │
├─────────┼───────────────────────┼───────────────────────┼───────────────────┤
│ T+0     │ Types "Hello"         │                       │                   │
│ T+10    │ Sends op (v=5)        │                       │ Types "World"     │
│ T+20    │                       │ Receives A's op       │ Sends op (v=5)    │
│ T+30    │                       │ Assigns v=6           │                   │
│ T+40    │ Receives ack (v=6)    │ Broadcasts to B       │                   │
│ T+120   │                       │ Receives B's op (v=5) │                   │
│ T+130   │                       │ Transforms B vs A     │                   │
│ T+140   │                       │ Assigns v=7           │                   │
│ T+150   │ Receives B' (v=7)     │ Broadcasts to A       │                   │
│ T+240   │                       │                       │ Receives A (v=6)  │
│ T+250   │                       │                       │ Receives ack (v=7)│
│ T+260   │                       │                       │ Applies A, then B'│
└─────────┴───────────────────────┴───────────────────────┴───────────────────┘

Key Invariants:
1. Server assigns ALL versions (single source of truth)
2. Clients apply operations in version order
3. Clients buffer unacknowledged operations
4. Transformation is deterministic
"""


class HighLatencyOTHandler:
    """
    Handles OT under high-latency conditions.
    """
    
    def __init__(self, is_primary_region: bool):
        self.is_primary_region = is_primary_region
        self.version_assigner = VersionAssigner() if is_primary_region else None
        
        # Client state
        self.pending_operations: List[OperationBatch] = []
        self.acknowledged_version: int = 0
        self.local_version: int = 0
    
    async def handle_local_operation(
        self,
        operation: OperationBatch
    ) -> None:
        """
        Handle a locally-generated operation.
        
        1. Apply optimistically to local state
        2. Add to pending queue
        3. Send to server
        4. Wait for acknowledgment
        """
        # Apply locally
        self.local_version += 1
        operation.version = self.acknowledged_version  # Base version
        
        # Add to pending
        self.pending_operations.append(operation)
        
        # Send to server (non-blocking)
        await self._send_to_server(operation)
    
    async def handle_server_operation(
        self,
        operation: OperationBatch
    ) -> OperationBatch:
        """
        Handle an operation received from server.
        
        1. If it's our own operation, remove from pending
        2. If it's another user's operation, transform against pending
        3. Apply to local state
        """
        # Check if this is acknowledgment of our operation
        if operation.user_id == self.user_id:
            self._handle_acknowledgment(operation)
            return operation
        
        # Transform against all pending operations
        transformed = operation
        for pending in self.pending_operations:
            _, transformed = self.transformer.transform_batch(
                pending, transformed, priority="left"
            )
        
        # Apply transformed operation
        self.acknowledged_version = operation.version
        
        return transformed
    
    def _handle_acknowledgment(self, operation: OperationBatch):
        """Handle acknowledgment of our operation."""
        # Remove from pending
        self.pending_operations = [
            op for op in self.pending_operations
            if op.id != operation.id
        ]
        
        # Update acknowledged version
        self.acknowledged_version = operation.version


class VersionAssigner:
    """
    Assigns canonical versions to operations.
    
    ONLY runs in PRIMARY REGION.
    """
    
    def __init__(self):
        self.current_version: dict[str, int] = {}  # document_id -> version
        self._lock = asyncio.Lock()
    
    async def assign_version(
        self,
        document_id: str,
        operation: OperationBatch
    ) -> int:
        """
        Assign the next version to an operation.
        
        This is the ONLY place versions are assigned.
        """
        async with self._lock:
            current = self.current_version.get(document_id, 0)
            new_version = current + 1
            self.current_version[document_id] = new_version
            
            operation.version = new_version
            return new_version
```

### B.4 What Breaks First Under Cross-Region Latency

```python
# =============================================================================
# LATENCY FAILURE MODES
# =============================================================================

"""
What Breaks First Under Cross-Region Latency

Ordered by likelihood of failure:

1. USER EXPERIENCE (First to degrade)
   - Threshold: >100ms RTT
   - Symptom: Typing feels "laggy"
   - Mitigation: Local echo, optimistic updates
   - Not a system failure, but users complain

2. CURSOR SYNCHRONIZATION (Second to degrade)
   - Threshold: >150ms RTT
   - Symptom: Cursors jump around, appear in wrong positions
   - Mitigation: Reduce cursor update frequency, interpolation
   - Annoying but not critical

3. PROMPT LOCK CONTENTION (Third to degrade)
   - Threshold: >200ms RTT
   - Symptom: Lock acquisition takes too long, timeouts
   - Mitigation: Increase lock TTL, add lock queuing
   - Can block agent execution

4. OPERATION ORDERING (Fourth to degrade)
   - Threshold: >300ms RTT
   - Symptom: Operations arrive out of order frequently
   - Mitigation: Buffering, version vectors
   - Requires careful handling

5. VERSION ASSIGNMENT BOTTLENECK (Fifth to degrade)
   - Threshold: >500ms RTT to primary region
   - Symptom: Version assignment becomes bottleneck
   - Mitigation: Regional version pre-allocation
   - Rare but serious

6. SPLIT BRAIN (Catastrophic failure)
   - Threshold: Network partition
   - Symptom: Two regions assign conflicting versions
   - Mitigation: NEVER allow non-primary to assign versions
   - Must be prevented at all costs
"""


@dataclass
class LatencyDegradation:
    """Describes degradation at a latency threshold."""
    threshold_ms: int
    component: str
    symptom: str
    mitigation: str
    severity: str  # "cosmetic", "annoying", "blocking", "critical"


LATENCY_DEGRADATIONS = [
    LatencyDegradation(
        threshold_ms=100,
        component="user_experience",
        symptom="Typing feels laggy, edits appear delayed",
        mitigation="Local echo, optimistic updates, show 'syncing' indicator",
        severity="cosmetic"
    ),
    LatencyDegradation(
        threshold_ms=150,
        component="cursor_sync",
        symptom="Remote cursors jump, appear in wrong positions",
        mitigation="Reduce cursor update frequency to 5/sec, add interpolation",
        severity="annoying"
    ),
    LatencyDegradation(
        threshold_ms=200,
        component="prompt_lock",
        symptom="Lock acquisition timeouts, prompts fail to start",
        mitigation="Increase lock TTL to 60s, add lock queue with FIFO ordering",
        severity="blocking"
    ),
    LatencyDegradation(
        threshold_ms=300,
        component="operation_ordering",
        symptom="Operations arrive out of order, require frequent reordering",
        mitigation="Increase buffer size, use version vectors, add reorder window",
        severity="blocking"
    ),
    LatencyDegradation(
        threshold_ms=500,
        component="version_assignment",
        symptom="Version assignment becomes bottleneck, throughput drops",
        mitigation="Pre-allocate version ranges to regions, batch assignments",
        severity="critical"
    ),
]


class LatencyMonitor:
    """
    Monitors latency and applies mitigations.
    """
    
    def __init__(self):
        self.current_latency: dict[str, int] = {}  # user_id -> latency_ms
        self.degradation_state: dict[str, List[str]] = {}  # user_id -> active mitigations
    
    def update_latency(self, user_id: str, latency_ms: int):
        """Update measured latency for a user."""
        self.current_latency[user_id] = latency_ms
        self._apply_mitigations(user_id, latency_ms)
    
    def _apply_mitigations(self, user_id: str, latency_ms: int):
        """Apply appropriate mitigations based on latency."""
        mitigations = []
        
        for degradation in LATENCY_DEGRADATIONS:
            if latency_ms >= degradation.threshold_ms:
                mitigations.append(degradation.component)
        
        self.degradation_state[user_id] = mitigations
        
        # Apply specific mitigations
        if "cursor_sync" in mitigations:
            self._reduce_cursor_frequency(user_id)
        
        if "prompt_lock" in mitigations:
            self._extend_lock_ttl(user_id)
        
        if "operation_ordering" in mitigations:
            self._increase_buffer_size(user_id)
    
    def get_user_config(self, user_id: str) -> dict:
        """Get configuration adjusted for user's latency."""
        latency = self.current_latency.get(user_id, 50)
        
        return {
            "cursor_update_interval_ms": 200 if latency > 150 else 100,
            "operation_buffer_size": 50 if latency > 300 else 20,
            "lock_ttl_seconds": 60 if latency > 200 else 30,
            "show_sync_indicator": latency > 100,
            "enable_local_echo": latency > 100,
        }
```

---

## Gap C: Enterprise Compliance Hooks

### C.1 Audit Log Schema

```sql
-- =============================================================================
-- IMMUTABLE AUDIT LOG SCHEMA
-- =============================================================================

-- Main audit log table (append-only, immutable)
CREATE TABLE compliance.audit_log (
    -- Identity
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sequence_id BIGSERIAL NOT NULL,  -- Monotonic, gap-free
    
    -- Timing
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    server_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- Actor
    actor_type VARCHAR(20) NOT NULL,  -- 'user', 'system', 'agent', 'api_key'
    actor_id UUID,
    actor_email VARCHAR(255),
    actor_ip INET,
    actor_user_agent TEXT,
    actor_session_id UUID,
    
    -- Target
    target_type VARCHAR(50) NOT NULL,  -- 'document', 'workspace', 'user', 'org', 'run', 'billing'
    target_id UUID,
    target_name VARCHAR(255),
    
    -- Organization context
    org_id UUID NOT NULL,
    workspace_id UUID,
    
    -- Event details
    event_category VARCHAR(50) NOT NULL,  -- 'collaboration', 'auth', 'billing', 'admin', 'data'
    event_action VARCHAR(100) NOT NULL,   -- 'document.edit', 'user.login', 'billing.charge'
    event_outcome VARCHAR(20) NOT NULL,   -- 'success', 'failure', 'denied', 'error'
    
    -- Event data (JSONB for flexibility)
    event_data JSONB NOT NULL DEFAULT '{}',
    
    -- Change tracking
    previous_state JSONB,
    new_state JSONB,
    
    -- Compliance metadata
    data_classification VARCHAR(20),  -- 'public', 'internal', 'confidential', 'restricted'
    retention_policy VARCHAR(50),     -- 'standard', 'legal_hold', 'extended', 'permanent'
    gdpr_relevant BOOLEAN DEFAULT FALSE,
    pii_accessed BOOLEAN DEFAULT FALSE,
    
    -- Integrity
    checksum VARCHAR(64) NOT NULL,  -- SHA-256 of event data
    previous_checksum VARCHAR(64),  -- Chain integrity
    
    -- Constraints
    CONSTRAINT audit_log_actor_type_check CHECK (
        actor_type IN ('user', 'system', 'agent', 'api_key', 'anonymous')
    ),
    CONSTRAINT audit_log_outcome_check CHECK (
        event_outcome IN ('success', 'failure', 'denied', 'error', 'partial')
    )
);

-- Indexes for efficient querying
CREATE INDEX idx_audit_log_org_time ON compliance.audit_log(org_id, event_time DESC);
CREATE INDEX idx_audit_log_actor ON compliance.audit_log(actor_id, event_time DESC);
CREATE INDEX idx_audit_log_target ON compliance.audit_log(target_type, target_id, event_time DESC);
CREATE INDEX idx_audit_log_category ON compliance.audit_log(event_category, event_action);
CREATE INDEX idx_audit_log_sequence ON compliance.audit_log(sequence_id);
CREATE INDEX idx_audit_log_retention ON compliance.audit_log(retention_policy) WHERE retention_policy != 'standard';
CREATE INDEX idx_audit_log_legal_hold ON compliance.audit_log(org_id) WHERE retention_policy = 'legal_hold';

-- Prevent updates and deletes (immutable)
CREATE OR REPLACE FUNCTION compliance.prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit log is immutable. Updates and deletes are not allowed.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_immutable
    BEFORE UPDATE OR DELETE ON compliance.audit_log
    FOR EACH ROW
    EXECUTE FUNCTION compliance.prevent_audit_modification();

-- =============================================================================
-- AUDIT EVENT TYPES (SOC2 COMPLIANT)
-- =============================================================================

-- Authentication events
INSERT INTO compliance.audit_event_types (category, action, description, soc2_control) VALUES
('auth', 'user.login', 'User logged in', 'CC6.1'),
('auth', 'user.logout', 'User logged out', 'CC6.1'),
('auth', 'user.login_failed', 'Failed login attempt', 'CC6.1'),
('auth', 'user.mfa_enabled', 'MFA enabled', 'CC6.1'),
('auth', 'user.mfa_disabled', 'MFA disabled', 'CC6.1'),
('auth', 'user.password_changed', 'Password changed', 'CC6.1'),
('auth', 'user.password_reset', 'Password reset requested', 'CC6.1'),
('auth', 'session.created', 'Session created', 'CC6.1'),
('auth', 'session.expired', 'Session expired', 'CC6.1'),
('auth', 'session.revoked', 'Session revoked', 'CC6.1'),
('auth', 'api_key.created', 'API key created', 'CC6.1'),
('auth', 'api_key.revoked', 'API key revoked', 'CC6.1');

-- Collaboration events
INSERT INTO compliance.audit_event_types (category, action, description, soc2_control) VALUES
('collaboration', 'document.created', 'Document created', 'CC6.2'),
('collaboration', 'document.edited', 'Document edited', 'CC6.2'),
('collaboration', 'document.deleted', 'Document deleted', 'CC6.2'),
('collaboration', 'document.shared', 'Document shared', 'CC6.2'),
('collaboration', 'document.unshared', 'Document sharing removed', 'CC6.2'),
('collaboration', 'document.exported', 'Document exported', 'CC6.2'),
('collaboration', 'document.downloaded', 'Document downloaded', 'CC6.2'),
('collaboration', 'workspace.member_added', 'Member added to workspace', 'CC6.2'),
('collaboration', 'workspace.member_removed', 'Member removed from workspace', 'CC6.2'),
('collaboration', 'workspace.role_changed', 'Member role changed', 'CC6.2'),
('collaboration', 'prompt.submitted', 'Prompt submitted', 'CC6.2'),
('collaboration', 'prompt.approved', 'Prompt approved by owner', 'CC6.2'),
('collaboration', 'prompt.rejected', 'Prompt rejected by owner', 'CC6.2');

-- Data access events
INSERT INTO compliance.audit_event_types (category, action, description, soc2_control) VALUES
('data', 'pii.accessed', 'PII data accessed', 'CC6.5'),
('data', 'pii.exported', 'PII data exported', 'CC6.5'),
('data', 'data.bulk_export', 'Bulk data export', 'CC6.5'),
('data', 'data.deleted', 'Data deleted', 'CC6.5'),
('data', 'backup.created', 'Backup created', 'CC6.5'),
('data', 'backup.restored', 'Backup restored', 'CC6.5');

-- Admin events
INSERT INTO compliance.audit_event_types (category, action, description, soc2_control) VALUES
('admin', 'org.settings_changed', 'Organization settings changed', 'CC6.6'),
('admin', 'org.billing_updated', 'Billing information updated', 'CC6.6'),
('admin', 'user.created', 'User created', 'CC6.6'),
('admin', 'user.deleted', 'User deleted', 'CC6.6'),
('admin', 'user.suspended', 'User suspended', 'CC6.6'),
('admin', 'user.role_changed', 'User role changed', 'CC6.6'),
('admin', 'policy.created', 'Policy created', 'CC6.6'),
('admin', 'policy.updated', 'Policy updated', 'CC6.6'),
('admin', 'legal_hold.applied', 'Legal hold applied', 'CC6.6'),
('admin', 'legal_hold.released', 'Legal hold released', 'CC6.6');

-- Billing events
INSERT INTO compliance.audit_event_types (category, action, description, soc2_control) VALUES
('billing', 'charge.created', 'Charge created', 'CC6.7'),
('billing', 'charge.refunded', 'Charge refunded', 'CC6.7'),
('billing', 'subscription.created', 'Subscription created', 'CC6.7'),
('billing', 'subscription.cancelled', 'Subscription cancelled', 'CC6.7'),
('billing', 'credits.purchased', 'Credits purchased', 'CC6.7'),
('billing', 'credits.consumed', 'Credits consumed', 'CC6.7');
```

### C.2 Legal Hold Implementation

```python
# =============================================================================
# LEGAL HOLD IMPLEMENTATION
# =============================================================================

"""
Legal Hold Requirements:

1. Prevent deletion of documents under hold
2. Prevent modification of audit logs under hold
3. Preserve all versions of documents
4. Track who applied/released hold
5. Support multiple concurrent holds
6. Notify affected users
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
from enum import Enum
import uuid


class LegalHoldStatus(Enum):
    ACTIVE = "active"
    RELEASED = "released"
    EXPIRED = "expired"


@dataclass
class LegalHold:
    """Legal hold record."""
    id: str
    org_id: str
    matter_id: str  # External legal matter reference
    matter_name: str
    
    # Scope
    scope_type: str  # 'org', 'workspace', 'user', 'document', 'date_range'
    scope_ids: List[str]  # IDs of affected entities
    
    # Date range (if applicable)
    date_range_start: Optional[datetime]
    date_range_end: Optional[datetime]
    
    # Status
    status: LegalHoldStatus
    applied_at: datetime
    applied_by: str  # User ID
    released_at: Optional[datetime]
    released_by: Optional[str]
    
    # Metadata
    custodians: List[str]  # User IDs of custodians
    notes: str
    external_counsel: Optional[str]


class LegalHoldManager:
    """
    Manages legal holds for compliance.
    """
    
    def __init__(self, db, audit_logger):
        self.db = db
        self.audit = audit_logger
    
    async def apply_hold(
        self,
        org_id: str,
        matter_id: str,
        matter_name: str,
        scope_type: str,
        scope_ids: List[str],
        applied_by: str,
        custodians: List[str],
        notes: str = "",
        date_range_start: Optional[datetime] = None,
        date_range_end: Optional[datetime] = None
    ) -> LegalHold:
        """
        Apply a legal hold.
        
        Effects:
        1. Mark all affected documents as held
        2. Disable deletion for affected documents
        3. Preserve all versions
        4. Notify custodians
        5. Log to audit trail
        """
        hold = LegalHold(
            id=str(uuid.uuid4()),
            org_id=org_id,
            matter_id=matter_id,
            matter_name=matter_name,
            scope_type=scope_type,
            scope_ids=scope_ids,
            date_range_start=date_range_start,
            date_range_end=date_range_end,
            status=LegalHoldStatus.ACTIVE,
            applied_at=datetime.utcnow(),
            applied_by=applied_by,
            released_at=None,
            released_by=None,
            custodians=custodians,
            notes=notes,
            external_counsel=None
        )
        
        # Save hold
        await self._save_hold(hold)
        
        # Mark affected documents
        affected_docs = await self._get_affected_documents(hold)
        await self._mark_documents_held(affected_docs, hold.id)
        
        # Update audit log retention
        await self._update_audit_retention(hold)
        
        # Notify custodians
        await self._notify_custodians(hold, "applied")
        
        # Audit log
        await self.audit.log(
            event_category="admin",
            event_action="legal_hold.applied",
            actor_id=applied_by,
            target_type="legal_hold",
            target_id=hold.id,
            org_id=org_id,
            event_data={
                "matter_id": matter_id,
                "matter_name": matter_name,
                "scope_type": scope_type,
                "scope_count": len(scope_ids),
                "affected_documents": len(affected_docs)
            },
            retention_policy="legal_hold"
        )
        
        return hold
    
    async def release_hold(
        self,
        hold_id: str,
        released_by: str,
        reason: str
    ) -> LegalHold:
        """
        Release a legal hold.
        
        Effects:
        1. Mark hold as released
        2. Re-enable deletion for documents (if no other holds)
        3. Notify custodians
        4. Log to audit trail
        """
        hold = await self._get_hold(hold_id)
        
        if hold.status != LegalHoldStatus.ACTIVE:
            raise ValueError(f"Hold {hold_id} is not active")
        
        # Update hold
        hold.status = LegalHoldStatus.RELEASED
        hold.released_at = datetime.utcnow()
        hold.released_by = released_by
        
        await self._save_hold(hold)
        
        # Check if documents have other holds
        affected_docs = await self._get_affected_documents(hold)
        for doc_id in affected_docs:
            other_holds = await self._get_active_holds_for_document(doc_id)
            if not other_holds:
                await self._unmark_document_held(doc_id)
        
        # Notify custodians
        await self._notify_custodians(hold, "released")
        
        # Audit log
        await self.audit.log(
            event_category="admin",
            event_action="legal_hold.released",
            actor_id=released_by,
            target_type="legal_hold",
            target_id=hold.id,
            org_id=hold.org_id,
            event_data={
                "matter_id": hold.matter_id,
                "reason": reason,
                "held_duration_days": (hold.released_at - hold.applied_at).days
            },
            retention_policy="legal_hold"
        )
        
        return hold
    
    async def check_deletion_allowed(
        self,
        document_id: str
    ) -> tuple[bool, Optional[str]]:
        """
        Check if a document can be deleted.
        
        Returns:
            (allowed, reason)
        """
        holds = await self._get_active_holds_for_document(document_id)
        
        if holds:
            hold_names = [h.matter_name for h in holds]
            return (False, f"Document is under legal hold: {', '.join(hold_names)}")
        
        return (True, None)


# =============================================================================
# LEGAL HOLD DATABASE SCHEMA
# =============================================================================

LEGAL_HOLD_SCHEMA = """
-- Legal holds table
CREATE TABLE compliance.legal_holds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id),
    matter_id VARCHAR(100) NOT NULL,
    matter_name VARCHAR(255) NOT NULL,
    
    -- Scope
    scope_type VARCHAR(20) NOT NULL,
    scope_ids UUID[] NOT NULL,
    date_range_start TIMESTAMPTZ,
    date_range_end TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    applied_by UUID NOT NULL REFERENCES users(id),
    released_at TIMESTAMPTZ,
    released_by UUID REFERENCES users(id),
    
    -- Metadata
    custodians UUID[] NOT NULL DEFAULT '{}',
    notes TEXT,
    external_counsel VARCHAR(255),
    
    CONSTRAINT legal_holds_status_check CHECK (
        status IN ('active', 'released', 'expired')
    ),
    CONSTRAINT legal_holds_scope_type_check CHECK (
        scope_type IN ('org', 'workspace', 'user', 'document', 'date_range')
    )
);

CREATE INDEX idx_legal_holds_org ON compliance.legal_holds(org_id);
CREATE INDEX idx_legal_holds_status ON compliance.legal_holds(status) WHERE status = 'active';
CREATE INDEX idx_legal_holds_matter ON compliance.legal_holds(matter_id);

-- Documents under hold (junction table)
CREATE TABLE compliance.documents_held (
    document_id UUID NOT NULL REFERENCES documents(id),
    hold_id UUID NOT NULL REFERENCES compliance.legal_holds(id),
    held_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    PRIMARY KEY (document_id, hold_id)
);

CREATE INDEX idx_documents_held_document ON compliance.documents_held(document_id);

-- Prevent deletion of held documents
CREATE OR REPLACE FUNCTION compliance.check_document_deletion()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM compliance.documents_held dh
        JOIN compliance.legal_holds lh ON dh.hold_id = lh.id
        WHERE dh.document_id = OLD.id AND lh.status = 'active'
    ) THEN
        RAISE EXCEPTION 'Cannot delete document under legal hold';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_held_document_deletion
    BEFORE DELETE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION compliance.check_document_deletion();
"""
```

### C.3 Data Retention Policies

```python
# =============================================================================
# DATA RETENTION POLICIES
# =============================================================================

"""
Retention Policy Hierarchy:

1. Legal Hold (highest priority)
   - Overrides all other policies
   - No automatic deletion
   - Manual release required

2. Regulatory Requirement
   - SOC2: 7 years for audit logs
   - GDPR: Varies by data type
   - HIPAA: 6 years
   - Financial: 7 years

3. Organization Policy
   - Custom per-org settings
   - Cannot be shorter than regulatory

4. Default Policy
   - Documents: 2 years after last access
   - Audit logs: 7 years
   - Collaboration history: 1 year
   - Deleted items: 30 days (soft delete)
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Optional, List
from enum import Enum


class RetentionPeriod(Enum):
    DAYS_30 = 30
    DAYS_90 = 90
    YEARS_1 = 365
    YEARS_2 = 730
    YEARS_5 = 1825
    YEARS_7 = 2555
    PERMANENT = -1


@dataclass
class RetentionPolicy:
    """Retention policy configuration."""
    id: str
    org_id: str
    name: str
    
    # Data types covered
    data_types: List[str]  # 'documents', 'audit_logs', 'collaboration_history', etc.
    
    # Retention periods
    active_retention: RetentionPeriod  # While in use
    archive_retention: RetentionPeriod  # After archival
    deleted_retention: RetentionPeriod  # After soft delete
    
    # Triggers
    retention_start: str  # 'creation', 'last_access', 'last_modified', 'deletion'
    
    # Actions
    archive_action: str  # 'compress', 'move_cold_storage', 'none'
    delete_action: str   # 'hard_delete', 'anonymize', 'none'
    
    # Compliance
    regulatory_basis: Optional[str]  # 'SOC2', 'GDPR', 'HIPAA', etc.
    is_mandatory: bool  # Cannot be shortened by org


# Default policies
DEFAULT_POLICIES = {
    "documents": RetentionPolicy(
        id="default_documents",
        org_id="*",
        name="Default Document Retention",
        data_types=["documents"],
        active_retention=RetentionPeriod.YEARS_2,
        archive_retention=RetentionPeriod.YEARS_5,
        deleted_retention=RetentionPeriod.DAYS_30,
        retention_start="last_access",
        archive_action="move_cold_storage",
        delete_action="hard_delete",
        regulatory_basis=None,
        is_mandatory=False
    ),
    
    "audit_logs": RetentionPolicy(
        id="default_audit_logs",
        org_id="*",
        name="Audit Log Retention (SOC2)",
        data_types=["audit_logs"],
        active_retention=RetentionPeriod.YEARS_7,
        archive_retention=RetentionPeriod.PERMANENT,
        deleted_retention=RetentionPeriod.PERMANENT,
        retention_start="creation",
        archive_action="compress",
        delete_action="none",  # Never delete
        regulatory_basis="SOC2",
        is_mandatory=True
    ),
    
    "collaboration_history": RetentionPolicy(
        id="default_collab_history",
        org_id="*",
        name="Collaboration History Retention",
        data_types=["collaboration_history", "ot_operations"],
        active_retention=RetentionPeriod.YEARS_1,
        archive_retention=RetentionPeriod.YEARS_2,
        deleted_retention=RetentionPeriod.DAYS_90,
        retention_start="creation",
        archive_action="compress",
        delete_action="anonymize",
        regulatory_basis=None,
        is_mandatory=False
    ),
    
    "billing_records": RetentionPolicy(
        id="default_billing",
        org_id="*",
        name="Billing Records Retention",
        data_types=["billing_ledger", "invoices", "payments"],
        active_retention=RetentionPeriod.YEARS_7,
        archive_retention=RetentionPeriod.PERMANENT,
        deleted_retention=RetentionPeriod.PERMANENT,
        retention_start="creation",
        archive_action="compress",
        delete_action="none",
        regulatory_basis="Financial",
        is_mandatory=True
    ),
}


class RetentionManager:
    """
    Manages data retention policies.
    """
    
    def __init__(self, db, audit_logger):
        self.db = db
        self.audit = audit_logger
        self.policies: dict[str, RetentionPolicy] = {}
    
    async def get_effective_policy(
        self,
        org_id: str,
        data_type: str
    ) -> RetentionPolicy:
        """
        Get the effective retention policy for a data type.
        
        Priority:
        1. Legal hold (if active)
        2. Org-specific policy
        3. Default policy
        """
        # Check for legal hold
        if await self._has_legal_hold(org_id, data_type):
            return self._get_legal_hold_policy()
        
        # Check for org-specific policy
        org_policy = await self._get_org_policy(org_id, data_type)
        if org_policy:
            return org_policy
        
        # Return default
        return DEFAULT_POLICIES.get(data_type, DEFAULT_POLICIES["documents"])
    
    async def apply_retention(
        self,
        org_id: str,
        data_type: str,
        dry_run: bool = True
    ) -> dict:
        """
        Apply retention policy to data.
        
        Returns summary of actions taken.
        """
        policy = await self.get_effective_policy(org_id, data_type)
        
        results = {
            "policy": policy.name,
            "archived": 0,
            "deleted": 0,
            "anonymized": 0,
            "skipped_legal_hold": 0,
            "errors": []
        }
        
        # Get items to process
        items = await self._get_items_for_retention(org_id, data_type, policy)
        
        for item in items:
            # Check legal hold
            if await self._is_under_legal_hold(item.id):
                results["skipped_legal_hold"] += 1
                continue
            
            # Determine action
            action = self._determine_action(item, policy)
            
            if not dry_run:
                try:
                    if action == "archive":
                        await self._archive_item(item)
                        results["archived"] += 1
                    elif action == "delete":
                        await self._delete_item(item)
                        results["deleted"] += 1
                    elif action == "anonymize":
                        await self._anonymize_item(item)
                        results["anonymized"] += 1
                except Exception as e:
                    results["errors"].append(str(e))
        
        # Audit log
        await self.audit.log(
            event_category="data",
            event_action="retention.applied",
            org_id=org_id,
            event_data={
                "data_type": data_type,
                "policy": policy.name,
                "dry_run": dry_run,
                "results": results
            }
        )
        
        return results
```

### C.4 Right to Be Forgotten (RTBF) with Collaboration History

```python
# =============================================================================
# RIGHT TO BE FORGOTTEN (RTBF) IMPLEMENTATION
# =============================================================================

"""
RTBF Challenges with Collaboration:

1. User's edits are interleaved with others' edits
2. Deleting user's operations breaks OT history
3. Other users' content may reference deleted user
4. Audit logs must be preserved (anonymized)

Solution: Anonymization, not deletion

1. Replace user identity with anonymous placeholder
2. Preserve operation structure for OT integrity
3. Remove PII from content where possible
4. Maintain audit trail with anonymized actor
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
import hashlib
import re


@dataclass
class RTBFRequest:
    """Right to be forgotten request."""
    id: str
    user_id: str
    user_email: str
    org_id: str
    
    # Request details
    requested_at: datetime
    requested_by: str  # User ID or 'self'
    reason: str
    
    # Scope
    scope: str  # 'full', 'org_only', 'data_only'
    
    # Status
    status: str  # 'pending', 'processing', 'completed', 'rejected', 'blocked'
    blocked_reason: Optional[str]  # e.g., 'legal_hold'
    
    # Processing
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    processed_by: Optional[str]
    
    # Results
    items_processed: int
    items_anonymized: int
    items_deleted: int
    items_blocked: int


class RTBFProcessor:
    """
    Processes Right to Be Forgotten requests.
    """
    
    def __init__(self, db, audit_logger):
        self.db = db
        self.audit = audit_logger
        
        # Anonymous placeholder
        self.ANONYMOUS_USER_ID = "00000000-0000-0000-0000-000000000000"
        self.ANONYMOUS_EMAIL = "deleted-user@anonymous.local"
        self.ANONYMOUS_NAME = "[Deleted User]"
    
    async def process_request(
        self,
        request: RTBFRequest
    ) -> RTBFRequest:
        """
        Process an RTBF request.
        
        Steps:
        1. Check for blockers (legal hold, active subscription)
        2. Anonymize user profile
        3. Anonymize collaboration history
        4. Anonymize audit logs
        5. Delete non-essential data
        6. Generate compliance report
        """
        # Check blockers
        blocker = await self._check_blockers(request)
        if blocker:
            request.status = "blocked"
            request.blocked_reason = blocker
            return request
        
        request.status = "processing"
        request.started_at = datetime.utcnow()
        
        try:
            # 1. Anonymize user profile
            await self._anonymize_user_profile(request.user_id)
            
            # 2. Anonymize collaboration history
            collab_count = await self._anonymize_collaboration_history(request.user_id)
            request.items_anonymized += collab_count
            
            # 3. Anonymize audit logs
            audit_count = await self._anonymize_audit_logs(request.user_id)
            request.items_anonymized += audit_count
            
            # 4. Delete non-essential data
            deleted_count = await self._delete_non_essential_data(request.user_id)
            request.items_deleted += deleted_count
            
            # 5. Revoke all sessions and API keys
            await self._revoke_access(request.user_id)
            
            request.status = "completed"
            request.completed_at = datetime.utcnow()
            
        except Exception as e:
            request.status = "error"
            request.blocked_reason = str(e)
        
        # Generate compliance report
        await self._generate_compliance_report(request)
        
        return request
    
    async def _anonymize_collaboration_history(
        self,
        user_id: str
    ) -> int:
        """
        Anonymize user's collaboration history.
        
        Strategy:
        1. Replace user_id with anonymous ID
        2. Keep operation structure intact (for OT)
        3. Remove any PII from operation content
        """
        count = 0
        
        # Anonymize OT operations
        result = await self.db.execute("""
            UPDATE collab.operation_history
            SET 
                user_id = $1,
                -- Anonymize any PII in operation data
                operations = collab.anonymize_operations(operations, $2)
            WHERE user_id = $2
            RETURNING id
        """, self.ANONYMOUS_USER_ID, user_id)
        count += len(result)
        
        # Anonymize cursor history
        await self.db.execute("""
            DELETE FROM collab.active_cursors
            WHERE user_id = $1
        """, user_id)
        
        # Anonymize presence history
        await self.db.execute("""
            UPDATE collab.presence_history
            SET user_id = $1
            WHERE user_id = $2
        """, self.ANONYMOUS_USER_ID, user_id)
        
        # Anonymize workspace memberships
        await self.db.execute("""
            UPDATE collab.workspace_permissions
            SET 
                user_id = $1,
                invited_by = CASE WHEN invited_by = $2 THEN $1 ELSE invited_by END
            WHERE user_id = $2
        """, self.ANONYMOUS_USER_ID, user_id)
        
        return count
    
    async def _anonymize_audit_logs(
        self,
        user_id: str
    ) -> int:
        """
        Anonymize audit logs.
        
        Strategy:
        1. Replace actor_id with anonymous ID
        2. Remove actor_email, actor_ip, actor_user_agent
        3. Keep event structure for compliance
        4. Add anonymization marker
        """
        result = await self.db.execute("""
            UPDATE compliance.audit_log
            SET 
                actor_id = $1,
                actor_email = $2,
                actor_ip = NULL,
                actor_user_agent = NULL,
                event_data = event_data || '{"anonymized": true, "anonymized_at": $3}'::jsonb
            WHERE actor_id = $4
            RETURNING id
        """, 
            self.ANONYMOUS_USER_ID,
            self.ANONYMOUS_EMAIL,
            datetime.utcnow().isoformat(),
            user_id
        )
        
        return len(result)
    
    async def _check_blockers(
        self,
        request: RTBFRequest
    ) -> Optional[str]:
        """Check for conditions that block RTBF."""
        
        # Check legal hold
        holds = await self.db.execute("""
            SELECT lh.matter_name
            FROM compliance.legal_holds lh
            WHERE lh.status = 'active'
            AND (
                $1 = ANY(lh.custodians)
                OR EXISTS (
                    SELECT 1 FROM collab.workspace_permissions wp
                    JOIN compliance.documents_held dh ON dh.document_id = wp.document_id
                    WHERE wp.user_id = $1 AND dh.hold_id = lh.id
                )
            )
        """, request.user_id)
        
        if holds:
            return f"User is subject to legal hold: {holds[0]['matter_name']}"
        
        # Check active subscription (billing requirement)
        subscription = await self.db.execute("""
            SELECT id FROM billing.subscriptions
            WHERE user_id = $1 AND status = 'active'
        """, request.user_id)
        
        if subscription:
            return "User has active subscription. Cancel subscription first."
        
        # Check pending charges
        pending = await self.db.execute("""
            SELECT id FROM billing.billing_ledger
            WHERE user_id = $1 AND status = 'pending'
        """, request.user_id)
        
        if pending:
            return "User has pending charges. Resolve billing first."
        
        return None


# =============================================================================
# ANONYMIZATION SQL FUNCTION
# =============================================================================

ANONYMIZE_OPERATIONS_SQL = """
CREATE OR REPLACE FUNCTION collab.anonymize_operations(
    operations JSONB,
    user_id UUID
) RETURNS JSONB AS $$
DECLARE
    result JSONB;
    op JSONB;
    new_ops JSONB := '[]'::JSONB;
BEGIN
    -- Iterate through operations
    FOR op IN SELECT * FROM jsonb_array_elements(operations)
    LOOP
        -- Remove any PII patterns from text content
        IF op ? 'text' THEN
            op := jsonb_set(
                op,
                '{text}',
                to_jsonb(
                    regexp_replace(
                        op->>'text',
                        -- Email pattern
                        '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
                        '[REDACTED_EMAIL]',
                        'g'
                    )
                )
            );
            op := jsonb_set(
                op,
                '{text}',
                to_jsonb(
                    regexp_replace(
                        op->>'text',
                        -- Phone pattern
                        '\+?[0-9]{1,4}?[-.\s]?\(?[0-9]{1,3}?\)?[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,4}[-.\s]?[0-9]{1,9}',
                        '[REDACTED_PHONE]',
                        'g'
                    )
                )
            );
        END IF;
        
        new_ops := new_ops || op;
    END LOOP;
    
    RETURN new_ops;
END;
$$ LANGUAGE plpgsql;
"""
```

---

## Gap D: Disaster Recovery RPO/RTO

### D.1 Recovery Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DISASTER RECOVERY ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SOURCE OF TRUTH HIERARCHY:                                                  │
│                                                                              │
│  1. PostgreSQL (Primary)     ─── Authoritative for all persistent state     │
│     └── Documents, Users, Orgs, Billing, Audit Logs                         │
│                                                                              │
│  2. Redis (Ephemeral)        ─── Authoritative for real-time state          │
│     └── Active sessions, Cursors, Presence, Pub/Sub                         │
│     └── CAN BE REBUILT from PostgreSQL                                      │
│                                                                              │
│  3. S3 (Durable)             ─── Authoritative for file storage             │
│     └── Attachments, Exports, Backups                                       │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  RECOVERY TARGETS:                                                           │
│                                                                              │
│  ┌─────────────────────┬──────────┬──────────┬─────────────────────────────┐│
│  │ Component           │ RPO      │ RTO      │ Recovery Method             ││
│  ├─────────────────────┼──────────┼──────────┼─────────────────────────────┤│
│  │ Collaboration State │ 0        │ 5 min    │ Replay from OT ops table    ││
│  │ Pending Prompts     │ 0        │ 5 min    │ Replay from pending_prompts ││
│  │ Billing Attribution │ 0        │ 10 min   │ Replay from billing_ledger  ││
│  │ User Sessions       │ 5 min    │ 2 min    │ Re-authenticate             ││
│  │ Cursor Positions    │ N/A      │ Instant  │ Clients resend              ││
│  │ Presence            │ N/A      │ Instant  │ Clients reconnect           ││
│  │ Documents           │ 0        │ 5 min    │ PostgreSQL restore          ││
│  │ Audit Logs          │ 0        │ 30 min   │ PostgreSQL restore          ││
│  └─────────────────────┴──────────┴──────────┴─────────────────────────────┘│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### D.2 Redis Loss Recovery

```python
# =============================================================================
# REDIS LOSS RECOVERY PROCEDURE
# =============================================================================

"""
Redis Full Loss Recovery

Scenario: All Redis nodes are lost (data center failure, corruption, etc.)

Impact:
- Active WebSocket connections: LOST (clients must reconnect)
- Cursor positions: LOST (clients resend on reconnect)
- Presence data: LOST (rebuilt on reconnect)
- Pub/sub channels: LOST (rebuilt on reconnect)
- Session cache: LOST (re-authenticate or rebuild from DB)
- Rate limit counters: LOST (reset to zero)
- Prompt locks: LOST (must re-acquire)

Recovery Steps:
1. Deploy new Redis cluster
2. Warm up session cache from PostgreSQL
3. Rebuild rate limit state (conservative)
4. Notify clients to reconnect
5. Clients resend cursor/presence on reconnect
6. Prompt locks re-acquired on demand

RPO: 0 (all persistent state in PostgreSQL)
RTO: 5 minutes (new cluster + warm-up)
"""

from dataclasses import dataclass
from datetime import datetime
from typing import List, Optional
import asyncio


@dataclass
class RecoveryStatus:
    """Status of recovery operation."""
    phase: str
    started_at: datetime
    completed_at: Optional[datetime]
    items_processed: int
    errors: List[str]


class RedisRecoveryManager:
    """
    Manages recovery from Redis loss.
    """
    
    def __init__(self, postgres, new_redis):
        self.postgres = postgres
        self.redis = new_redis
        self.status = RecoveryStatus(
            phase="initializing",
            started_at=datetime.utcnow(),
            completed_at=None,
            items_processed=0,
            errors=[]
        )
    
    async def execute_full_recovery(self) -> RecoveryStatus:
        """
        Execute full Redis recovery procedure.
        
        Order matters:
        1. Session cache (users can authenticate)
        2. Document state (collaboration can resume)
        3. Rate limits (protection restored)
        4. Notify clients
        """
        try:
            # Phase 1: Warm session cache
            self.status.phase = "warming_session_cache"
            await self._warm_session_cache()
            
            # Phase 2: Rebuild document state
            self.status.phase = "rebuilding_document_state"
            await self._rebuild_document_state()
            
            # Phase 3: Initialize rate limits
            self.status.phase = "initializing_rate_limits"
            await self._initialize_rate_limits()
            
            # Phase 4: Notify clients
            self.status.phase = "notifying_clients"
            await self._notify_clients_reconnect()
            
            self.status.phase = "completed"
            self.status.completed_at = datetime.utcnow()
            
        except Exception as e:
            self.status.errors.append(str(e))
            self.status.phase = "failed"
        
        return self.status
    
    async def _warm_session_cache(self):
        """
        Rebuild session cache from PostgreSQL.
        
        Only active sessions (not expired) are loaded.
        """
        sessions = await self.postgres.fetch("""
            SELECT 
                s.id,
                s.user_id,
                s.token_hash,
                s.expires_at,
                u.email,
                u.role
            FROM auth.sessions s
            JOIN users u ON s.user_id = u.id
            WHERE s.expires_at > NOW()
            AND s.revoked_at IS NULL
        """)
        
        pipeline = self.redis.pipeline()
        
        for session in sessions:
            # Session lookup by token
            key = f"session:{session['token_hash']}"
            pipeline.hset(key, mapping={
                "user_id": str(session['user_id']),
                "email": session['email'],
                "role": session['role']
            })
            pipeline.expireat(key, session['expires_at'])
            
            self.status.items_processed += 1
        
        await pipeline.execute()
    
    async def _rebuild_document_state(self):
        """
        Rebuild document state from PostgreSQL.
        
        For each active document:
        1. Load current version
        2. Set version counter in Redis
        3. Initialize pub/sub channels
        """
        # Get documents with recent activity
        documents = await self.postgres.fetch("""
            SELECT 
                d.id,
                d.version,
                d.workspace_id
            FROM documents d
            WHERE d.updated_at > NOW() - INTERVAL '24 hours'
        """)
        
        pipeline = self.redis.pipeline()
        
        for doc in documents:
            # Version counter
            key = f"doc:{doc['id']}:version"
            pipeline.set(key, doc['version'])
            
            # Initialize empty presence set
            presence_key = f"doc:{doc['id']}:presence"
            pipeline.delete(presence_key)  # Clear any stale data
            
            self.status.items_processed += 1
        
        await pipeline.execute()
    
    async def _initialize_rate_limits(self):
        """
        Initialize rate limit counters.
        
        Strategy: Start with conservative limits
        - Set all counters to 50% of limit
        - Allows immediate use while preventing abuse
        - Counters naturally decay over time
        """
        # Get active organizations
        orgs = await self.postgres.fetch("""
            SELECT id, tier FROM organizations WHERE status = 'active'
        """)
        
        pipeline = self.redis.pipeline()
        
        for org in orgs:
            # Set conservative rate limit (50% of max)
            tier_limits = self._get_tier_limits(org['tier'])
            
            for limit_type, max_value in tier_limits.items():
                key = f"ratelimit:{org['id']}:{limit_type}"
                # Start at 50% to allow immediate use
                pipeline.set(key, max_value // 2)
                pipeline.expire(key, 60)  # 1 minute window
            
            self.status.items_processed += 1
        
        await pipeline.execute()
    
    async def _notify_clients_reconnect(self):
        """
        Notify all clients to reconnect.
        
        This is done via:
        1. API endpoint returns 503 with Retry-After
        2. WebSocket servers close connections with reconnect code
        3. Clients automatically reconnect
        """
        # Publish reconnect message to all WebSocket servers
        await self.redis.publish("system:reconnect", {
            "reason": "redis_recovery",
            "reconnect_delay_ms": 1000,
            "message": "Service recovered. Please reconnect."
        })
    
    def _get_tier_limits(self, tier: str) -> dict:
        """Get rate limits for a tier."""
        limits = {
            "free": {
                "ops_per_minute": 100,
                "prompts_per_minute": 5
            },
            "pro": {
                "ops_per_minute": 1000,
                "prompts_per_minute": 50
            },
            "enterprise": {
                "ops_per_minute": 10000,
                "prompts_per_minute": 500
            }
        }
        return limits.get(tier, limits["free"])
```

### D.3 OT Replay Semantics

```python
# =============================================================================
# OT REPLAY FROM POSTGRESQL
# =============================================================================

"""
OT Replay Semantics

When to replay:
1. Redis loss (rebuild document state)
2. Client reconnection (sync missed operations)
3. Audit/debugging (reconstruct document at point in time)

Replay Invariants:
1. Operations MUST be replayed in version order
2. Each operation MUST be applied exactly once
3. Final state MUST match stored document content
4. Checksum verification at end

Replay Order:
1. Load document at checkpoint (or empty if no checkpoint)
2. Load operations from checkpoint version to target version
3. Apply operations in version order
4. Verify checksum matches
"""

from dataclasses import dataclass
from typing import List, Optional, Tuple
import hashlib


@dataclass
class ReplayResult:
    """Result of OT replay operation."""
    document_id: str
    start_version: int
    end_version: int
    operations_applied: int
    final_content: str
    checksum_valid: bool
    expected_checksum: str
    actual_checksum: str


class OTReplayEngine:
    """
    Replays OT operations from PostgreSQL.
    """
    
    def __init__(self, postgres):
        self.postgres = postgres
        self.transformer = OTTransformer()
    
    async def replay_to_version(
        self,
        document_id: str,
        target_version: int
    ) -> ReplayResult:
        """
        Replay operations to reach a specific version.
        
        Algorithm:
        1. Find nearest checkpoint <= target_version
        2. Load operations from checkpoint to target
        3. Apply operations in order
        4. Verify checksum
        """
        # Find nearest checkpoint
        checkpoint = await self._find_checkpoint(document_id, target_version)
        
        if checkpoint:
            start_version = checkpoint['version']
            content = checkpoint['content']
        else:
            start_version = 0
            content = ""
        
        # Load operations
        operations = await self._load_operations(
            document_id,
            start_version,
            target_version
        )
        
        # Apply operations in order
        for op_batch in operations:
            content = self._apply_batch(content, op_batch)
        
        # Get expected checksum
        expected = await self._get_expected_checksum(document_id, target_version)
        actual = self._compute_checksum(content)
        
        return ReplayResult(
            document_id=document_id,
            start_version=start_version,
            end_version=target_version,
            operations_applied=len(operations),
            final_content=content,
            checksum_valid=(expected == actual),
            expected_checksum=expected,
            actual_checksum=actual
        )
    
    async def replay_full_document(
        self,
        document_id: str
    ) -> ReplayResult:
        """Replay all operations to get current document state."""
        # Get current version
        current = await self.postgres.fetchrow("""
            SELECT version FROM documents WHERE id = $1
        """, document_id)
        
        return await self.replay_to_version(document_id, current['version'])
    
    async def rebuild_redis_state(
        self,
        document_id: str,
        redis
    ) -> None:
        """
        Rebuild Redis state for a document from PostgreSQL.
        
        Used after Redis loss or for consistency repair.
        """
        # Replay to current version
        result = await self.replay_full_document(document_id)
        
        if not result.checksum_valid:
            raise ValueError(
                f"Checksum mismatch for document {document_id}. "
                f"Expected {result.expected_checksum}, got {result.actual_checksum}"
            )
        
        # Set Redis state
        pipeline = redis.pipeline()
        
        # Version counter
        pipeline.set(f"doc:{document_id}:version", result.end_version)
        
        # Content cache (optional, for fast access)
        pipeline.set(f"doc:{document_id}:content", result.final_content)
        pipeline.expire(f"doc:{document_id}:content", 3600)  # 1 hour cache
        
        await pipeline.execute()
    
    async def _find_checkpoint(
        self,
        document_id: str,
        target_version: int
    ) -> Optional[dict]:
        """Find the nearest checkpoint at or before target version."""
        return await self.postgres.fetchrow("""
            SELECT version, content, content_hash
            FROM ot.document_checkpoints
            WHERE document_id = $1 AND version <= $2
            ORDER BY version DESC
            LIMIT 1
        """, document_id, target_version)
    
    async def _load_operations(
        self,
        document_id: str,
        start_version: int,
        end_version: int
    ) -> List[dict]:
        """Load operations in version order."""
        return await self.postgres.fetch("""
            SELECT version, operations, user_id, timestamp
            FROM ot.operation_history
            WHERE document_id = $1
            AND version > $2
            AND version <= $3
            ORDER BY version ASC
        """, document_id, start_version, end_version)
    
    def _apply_batch(self, content: str, batch: dict) -> str:
        """Apply an operation batch to content."""
        operations = batch['operations']
        
        # Apply operations in reverse order (to maintain positions)
        for op in reversed(operations):
            if op['type'] == 'insert':
                content = content[:op['position']] + op['text'] + content[op['position']:]
            elif op['type'] == 'delete':
                content = content[:op['position']] + content[op['position'] + op['count']:]
        
        return content
    
    def _compute_checksum(self, content: str) -> str:
        """Compute content checksum."""
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def _get_expected_checksum(
        self,
        document_id: str,
        version: int
    ) -> str:
        """Get expected checksum for a version."""
        result = await self.postgres.fetchrow("""
            SELECT content_hash FROM documents
            WHERE id = $1
        """, document_id)
        return result['content_hash'] if result else ""
```

### D.4 RPO/RTO Summary Table

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RPO/RTO SUMMARY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────┬──────────┬──────────┬─────────────────────────────┐│
│  │ Data Type           │ RPO      │ RTO      │ Notes                       ││
│  ├─────────────────────┼──────────┼──────────┼─────────────────────────────┤│
│  │ COLLABORATION STATE │          │          │                             ││
│  │ ├─ Document content │ 0        │ 5 min    │ PostgreSQL is source        ││
│  │ ├─ OT operations    │ 0        │ 5 min    │ Replay from ops table       ││
│  │ ├─ Pending prompts  │ 0        │ 5 min    │ Stored in PostgreSQL        ││
│  │ └─ Prompt locks     │ 30 sec   │ Instant  │ Re-acquire on demand        ││
│  ├─────────────────────┼──────────┼──────────┼─────────────────────────────┤│
│  │ EPHEMERAL STATE     │          │          │                             ││
│  │ ├─ Cursor positions │ N/A      │ Instant  │ Clients resend              ││
│  │ ├─ Presence         │ N/A      │ Instant  │ Rebuilt on reconnect        ││
│  │ └─ WebSocket conns  │ N/A      │ 2 min    │ Clients reconnect           ││
│  ├─────────────────────┼──────────┼──────────┼─────────────────────────────┤│
│  │ BILLING             │          │          │                             ││
│  │ ├─ Ledger entries   │ 0        │ 10 min   │ PostgreSQL is source        ││
│  │ ├─ Credit balance   │ 0        │ 10 min   │ Computed from ledger        ││
│  │ └─ In-flight charges│ 0        │ 10 min   │ Idempotency keys preserved  ││
│  ├─────────────────────┼──────────┼──────────┼─────────────────────────────┤│
│  │ AUTH                │          │          │                             ││
│  │ ├─ User accounts    │ 0        │ 5 min    │ PostgreSQL is source        ││
│  │ ├─ Sessions         │ 5 min    │ 2 min    │ Re-authenticate             ││
│  │ └─ API keys         │ 0        │ 5 min    │ PostgreSQL is source        ││
│  ├─────────────────────┼──────────┼──────────┼─────────────────────────────┤│
│  │ COMPLIANCE          │          │          │                             ││
│  │ ├─ Audit logs       │ 0        │ 30 min   │ PostgreSQL is source        ││
│  │ ├─ Legal holds      │ 0        │ 30 min   │ PostgreSQL is source        ││
│  │ └─ Retention policy │ 0        │ 30 min   │ PostgreSQL is source        ││
│  └─────────────────────┴──────────┴──────────┴─────────────────────────────┘│
│                                                                              │
│  KEY INSIGHT: PostgreSQL is the source of truth for ALL persistent state.   │
│  Redis is a cache/ephemeral store that can be fully rebuilt from PostgreSQL.│
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Gap E: Abuse & Adversarial Collaboration

### E.1 Edit Flood Detection

```python
# =============================================================================
# EDIT FLOOD DETECTION AND MITIGATION
# =============================================================================

"""
Edit Flood Attack Vectors:

1. Single user rapid-fire edits
   - Goal: Overwhelm server, degrade experience for others
   - Detection: Ops/second per user
   - Mitigation: Per-user rate limiting

2. Coordinated multi-user flood
   - Goal: Overwhelm document, bypass per-user limits
   - Detection: Ops/second per document
   - Mitigation: Per-document rate limiting

3. Bot/script attacks
   - Goal: Automated abuse
   - Detection: Pattern analysis, lack of human timing
   - Mitigation: CAPTCHA, behavioral analysis

4. Large operation attacks
   - Goal: Memory exhaustion via huge inserts
   - Detection: Operation size
   - Mitigation: Size limits, chunking
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import List, Optional, Tuple
from enum import Enum
import asyncio
import statistics


class ThreatLevel(Enum):
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class FloodDetectionResult:
    """Result of flood detection analysis."""
    threat_level: ThreatLevel
    threat_type: str
    confidence: float
    evidence: List[str]
    recommended_action: str
    throttle_duration_seconds: int


class EditFloodDetector:
    """
    Detects edit flood attacks.
    """
    
    def __init__(self, redis):
        self.redis = redis
        
        # Detection thresholds
        self.USER_OPS_PER_SECOND_WARNING = 10
        self.USER_OPS_PER_SECOND_CRITICAL = 50
        
        self.DOC_OPS_PER_SECOND_WARNING = 50
        self.DOC_OPS_PER_SECOND_CRITICAL = 200
        
        self.OP_SIZE_WARNING = 10000  # 10 KB
        self.OP_SIZE_CRITICAL = 100000  # 100 KB
        
        # Behavioral thresholds
        self.MIN_HUMAN_INTERVAL_MS = 50  # Humans can't type faster than 50ms
        self.BOT_PATTERN_THRESHOLD = 0.9  # 90% identical intervals = bot
    
    async def analyze_operation(
        self,
        user_id: str,
        document_id: str,
        operation: dict,
        timestamp: float
    ) -> FloodDetectionResult:
        """
        Analyze an operation for flood patterns.
        """
        evidence = []
        threat_level = ThreatLevel.NONE
        threat_type = "none"
        
        # Check 1: User rate
        user_rate = await self._get_user_rate(user_id)
        if user_rate > self.USER_OPS_PER_SECOND_CRITICAL:
            threat_level = ThreatLevel.CRITICAL
            threat_type = "user_flood"
            evidence.append(f"User rate: {user_rate} ops/sec (critical: {self.USER_OPS_PER_SECOND_CRITICAL})")
        elif user_rate > self.USER_OPS_PER_SECOND_WARNING:
            threat_level = max(threat_level, ThreatLevel.MEDIUM)
            threat_type = "user_flood"
            evidence.append(f"User rate: {user_rate} ops/sec (warning: {self.USER_OPS_PER_SECOND_WARNING})")
        
        # Check 2: Document rate
        doc_rate = await self._get_document_rate(document_id)
        if doc_rate > self.DOC_OPS_PER_SECOND_CRITICAL:
            threat_level = ThreatLevel.CRITICAL
            threat_type = "coordinated_flood"
            evidence.append(f"Document rate: {doc_rate} ops/sec (critical: {self.DOC_OPS_PER_SECOND_CRITICAL})")
        elif doc_rate > self.DOC_OPS_PER_SECOND_WARNING:
            threat_level = max(threat_level, ThreatLevel.MEDIUM)
            threat_type = "coordinated_flood"
            evidence.append(f"Document rate: {doc_rate} ops/sec (warning: {self.DOC_OPS_PER_SECOND_WARNING})")
        
        # Check 3: Operation size
        op_size = self._get_operation_size(operation)
        if op_size > self.OP_SIZE_CRITICAL:
            threat_level = ThreatLevel.CRITICAL
            threat_type = "large_operation"
            evidence.append(f"Operation size: {op_size} bytes (critical: {self.OP_SIZE_CRITICAL})")
        elif op_size > self.OP_SIZE_WARNING:
            threat_level = max(threat_level, ThreatLevel.MEDIUM)
            threat_type = "large_operation"
            evidence.append(f"Operation size: {op_size} bytes (warning: {self.OP_SIZE_WARNING})")
        
        # Check 4: Bot pattern
        is_bot, bot_confidence = await self._detect_bot_pattern(user_id)
        if is_bot:
            threat_level = ThreatLevel.HIGH
            threat_type = "bot_detected"
            evidence.append(f"Bot pattern detected (confidence: {bot_confidence:.2f})")
        
        # Determine action
        action, throttle = self._determine_action(threat_level, threat_type)
        
        return FloodDetectionResult(
            threat_level=threat_level,
            threat_type=threat_type,
            confidence=0.9 if evidence else 0.0,
            evidence=evidence,
            recommended_action=action,
            throttle_duration_seconds=throttle
        )
    
    async def _get_user_rate(self, user_id: str) -> float:
        """Get user's operations per second."""
        key = f"flood:user:{user_id}:ops"
        count = await self.redis.get(key) or 0
        return int(count)
    
    async def _get_document_rate(self, document_id: str) -> float:
        """Get document's operations per second."""
        key = f"flood:doc:{document_id}:ops"
        count = await self.redis.get(key) or 0
        return int(count)
    
    def _get_operation_size(self, operation: dict) -> int:
        """Get operation size in bytes."""
        import json
        return len(json.dumps(operation).encode())
    
    async def _detect_bot_pattern(
        self,
        user_id: str
    ) -> Tuple[bool, float]:
        """
        Detect bot-like behavior patterns.
        
        Bots typically have:
        - Very consistent timing between operations
        - Timing below human capability
        - No variation in operation patterns
        """
        # Get recent operation timestamps
        key = f"flood:user:{user_id}:timestamps"
        timestamps = await self.redis.lrange(key, 0, 99)
        
        if len(timestamps) < 10:
            return (False, 0.0)
        
        # Calculate intervals
        timestamps = [float(t) for t in timestamps]
        intervals = [timestamps[i] - timestamps[i+1] for i in range(len(timestamps)-1)]
        
        # Check for inhuman speed
        min_interval = min(intervals) * 1000  # Convert to ms
        if min_interval < self.MIN_HUMAN_INTERVAL_MS:
            return (True, 0.95)
        
        # Check for bot-like consistency
        if len(intervals) >= 5:
            std_dev = statistics.stdev(intervals)
            mean = statistics.mean(intervals)
            cv = std_dev / mean if mean > 0 else 0  # Coefficient of variation
            
            # Humans have CV > 0.3, bots have CV < 0.1
            if cv < 0.1:
                return (True, 0.9)
        
        return (False, 0.0)
    
    def _determine_action(
        self,
        threat_level: ThreatLevel,
        threat_type: str
    ) -> Tuple[str, int]:
        """Determine mitigation action."""
        actions = {
            ThreatLevel.NONE: ("none", 0),
            ThreatLevel.LOW: ("warn", 0),
            ThreatLevel.MEDIUM: ("throttle", 5),
            ThreatLevel.HIGH: ("throttle", 30),
            ThreatLevel.CRITICAL: ("block", 300),
        }
        return actions.get(threat_level, ("none", 0))


class FloodMitigator:
    """
    Applies flood mitigation actions.
    """
    
    def __init__(self, redis, audit_logger):
        self.redis = redis
        self.audit = audit_logger
    
    async def apply_mitigation(
        self,
        user_id: str,
        document_id: str,
        detection: FloodDetectionResult
    ) -> None:
        """Apply mitigation based on detection result."""
        
        if detection.recommended_action == "none":
            return
        
        elif detection.recommended_action == "warn":
            await self._send_warning(user_id, detection)
        
        elif detection.recommended_action == "throttle":
            await self._apply_throttle(
                user_id,
                document_id,
                detection.throttle_duration_seconds
            )
        
        elif detection.recommended_action == "block":
            await self._apply_block(
                user_id,
                document_id,
                detection.throttle_duration_seconds
            )
        
        # Audit log
        await self.audit.log(
            event_category="security",
            event_action=f"flood.{detection.recommended_action}",
            actor_id=user_id,
            target_type="document",
            target_id=document_id,
            event_data={
                "threat_level": detection.threat_level.value,
                "threat_type": detection.threat_type,
                "evidence": detection.evidence,
                "duration_seconds": detection.throttle_duration_seconds
            }
        )
    
    async def _apply_throttle(
        self,
        user_id: str,
        document_id: str,
        duration_seconds: int
    ) -> None:
        """Apply throttling to a user."""
        key = f"throttle:user:{user_id}:doc:{document_id}"
        await self.redis.setex(key, duration_seconds, "throttled")
    
    async def _apply_block(
        self,
        user_id: str,
        document_id: str,
        duration_seconds: int
    ) -> None:
        """Block a user from a document."""
        key = f"block:user:{user_id}:doc:{document_id}"
        await self.redis.setex(key, duration_seconds, "blocked")
    
    async def is_throttled(
        self,
        user_id: str,
        document_id: str
    ) -> Tuple[bool, Optional[int]]:
        """Check if user is throttled."""
        key = f"throttle:user:{user_id}:doc:{document_id}"
        ttl = await self.redis.ttl(key)
        return (ttl > 0, ttl if ttl > 0 else None)
    
    async def is_blocked(
        self,
        user_id: str,
        document_id: str
    ) -> Tuple[bool, Optional[int]]:
        """Check if user is blocked."""
        key = f"block:user:{user_id}:doc:{document_id}"
        ttl = await self.redis.ttl(key)
        return (ttl > 0, ttl if ttl > 0 else None)
```

### E.2 Prompt Spam Mitigation

```python
# =============================================================================
# PROMPT SPAM MITIGATION
# =============================================================================

"""
Prompt Spam Attack Vectors:

1. Rapid prompt submission
   - Goal: Exhaust owner's credits
   - Detection: Prompts/minute per user
   - Mitigation: Per-user prompt limits

2. Owner offline exploitation
   - Goal: Queue expensive prompts while owner can't approve
   - Detection: Queue depth + owner offline
   - Mitigation: Queue limits, auto-reject after threshold

3. Prompt content abuse
   - Goal: Submit malicious/expensive prompts
   - Detection: Content analysis, cost estimation
   - Mitigation: Content filtering, cost caps
"""

@dataclass
class PromptSpamConfig:
    """Configuration for prompt spam mitigation."""
    
    # Per-user limits
    prompts_per_minute_per_user: int = 5
    prompts_per_hour_per_user: int = 30
    prompts_per_day_per_user: int = 100
    
    # Per-workspace limits
    prompts_per_minute_per_workspace: int = 20
    pending_prompts_max_per_workspace: int = 50
    
    # Owner offline limits
    pending_prompts_max_when_owner_offline: int = 10
    auto_reject_after_hours_offline: int = 24
    
    # Cost limits
    max_estimated_cost_per_prompt: float = 10.0  # $10
    max_pending_cost_per_workspace: float = 100.0  # $100


class PromptSpamMitigator:
    """
    Mitigates prompt spam attacks.
    """
    
    def __init__(self, redis, config: PromptSpamConfig = None):
        self.redis = redis
        self.config = config or PromptSpamConfig()
    
    async def check_prompt_allowed(
        self,
        user_id: str,
        workspace_id: str,
        owner_id: str,
        estimated_cost: float
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if a prompt submission is allowed.
        
        Returns:
            (allowed, rejection_reason)
        """
        # Check 1: Per-user rate limits
        user_minute = await self._get_user_prompts(user_id, "minute")
        if user_minute >= self.config.prompts_per_minute_per_user:
            return (False, f"Rate limit: {self.config.prompts_per_minute_per_user} prompts/minute")
        
        user_hour = await self._get_user_prompts(user_id, "hour")
        if user_hour >= self.config.prompts_per_hour_per_user:
            return (False, f"Rate limit: {self.config.prompts_per_hour_per_user} prompts/hour")
        
        user_day = await self._get_user_prompts(user_id, "day")
        if user_day >= self.config.prompts_per_day_per_user:
            return (False, f"Rate limit: {self.config.prompts_per_day_per_user} prompts/day")
        
        # Check 2: Per-workspace limits
        ws_minute = await self._get_workspace_prompts(workspace_id, "minute")
        if ws_minute >= self.config.prompts_per_minute_per_workspace:
            return (False, "Workspace rate limit exceeded")
        
        # Check 3: Pending queue depth
        pending = await self._get_pending_prompts(workspace_id)
        if pending >= self.config.pending_prompts_max_per_workspace:
            return (False, "Too many pending prompts in workspace")
        
        # Check 4: Owner offline check
        owner_online = await self._is_owner_online(owner_id)
        if not owner_online:
            if pending >= self.config.pending_prompts_max_when_owner_offline:
                return (False, "Owner offline, queue full")
            
            offline_hours = await self._get_owner_offline_hours(owner_id)
            if offline_hours >= self.config.auto_reject_after_hours_offline:
                return (False, f"Owner offline for {offline_hours} hours")
        
        # Check 5: Cost limits
        if estimated_cost > self.config.max_
