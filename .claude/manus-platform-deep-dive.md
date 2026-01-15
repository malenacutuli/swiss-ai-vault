# Comprehensive Manus Platform Deep Dive
## Real-Time Collaboration, Email Workflows & Integrations

This document provides exhaustive technical specifications for three critical Manus subsystems, extracted from actual platform behavior and architecture patterns.

---

# PART 1: REAL-TIME COLLABORATION SYSTEM

## 1.1 Concurrency Model: Hybrid OT + CRDT + Lock-Step

Manus employs a **three-tier concurrency model** optimized for different data types:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    MANUS CONCURRENCY MODEL                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 1: OPERATIONAL TRANSFORM (OT)                                   │   │
│  │ Used for: Text content, code, documents                              │   │
│  │                                                                       │   │
│  │ Properties:                                                          │   │
│  │ • Strong consistency (total ordering)                                │   │
│  │ • Server-authoritative                                               │   │
│  │ • Transform-based conflict resolution                                │   │
│  │ • Latency: 50-150ms round-trip                                       │   │
│  │                                                                       │   │
│  │ Data Types:                                                          │   │
│  │ • Slide content (text, formatting)                                   │   │
│  │ • Code blocks in notebooks                                           │   │
│  │ • Document prose                                                     │   │
│  │ • Structured JSON (schemas, configs)                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 2: CRDT (Conflict-free Replicated Data Types)                   │   │
│  │ Used for: Presence, metadata, non-critical state                     │   │
│  │                                                                       │   │
│  │ Properties:                                                          │   │
│  │ • Eventual consistency                                               │   │
│  │ • No coordination required                                           │   │
│  │ • Automatic merge (no conflicts)                                     │   │
│  │ • Latency: <20ms local, eventual sync                                │   │
│  │                                                                       │   │
│  │ CRDT Types Used:                                                     │   │
│  │ • LWW-Register: Cursor positions, selections                         │   │
│  │ • G-Counter: View counts, interaction metrics                        │   │
│  │ • OR-Set: Active collaborators, tags                                 │   │
│  │ • LWW-Map: User preferences, metadata                                │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ TIER 3: LOCK-STEP (Pessimistic Locking)                              │   │
│  │ Used for: Critical operations, destructive actions                   │   │
│  │                                                                       │   │
│  │ Properties:                                                          │   │
│  │ • Exclusive access                                                   │   │
│  │ • Blocking with timeout                                              │   │
│  │ • Prevents race conditions                                           │   │
│  │ • Latency: Variable (depends on lock acquisition)                    │   │
│  │                                                                       │   │
│  │ Operations:                                                          │   │
│  │ • Publish/deploy                                                     │   │
│  │ • Delete workspace/project                                           │   │
│  │ • Schema migrations                                                  │   │
│  │ • Billing operations                                                 │   │
│  │ • Permission changes                                                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.1.1 OT Implementation Details

```python
# ═══════════════════════════════════════════════════════════════════════════════
# OPERATIONAL TRANSFORM ENGINE
# ═══════════════════════════════════════════════════════════════════════════════

from dataclasses import dataclass
from typing import List, Optional, Union, Tuple
from enum import Enum
import json
import hashlib


class OpType(Enum):
    INSERT = "insert"
    DELETE = "delete"
    RETAIN = "retain"
    # Extended operations for rich text
    FORMAT = "format"
    EMBED = "embed"


@dataclass
class Operation:
    """Single OT operation."""
    type: OpType
    position: int
    content: Optional[str] = None  # For INSERT
    length: Optional[int] = None   # For DELETE/RETAIN
    attributes: Optional[dict] = None  # For FORMAT
    
    def to_dict(self) -> dict:
        return {
            "type": self.type.value,
            "position": self.position,
            "content": self.content,
            "length": self.length,
            "attributes": self.attributes
        }


@dataclass
class OperationBatch:
    """Batch of operations from a single client."""
    client_id: str
    base_revision: int
    operations: List[Operation]
    timestamp: float
    idempotency_key: str
    
    @property
    def hash(self) -> str:
        """Deterministic hash for deduplication."""
        content = json.dumps([op.to_dict() for op in self.operations], sort_keys=True)
        return hashlib.sha256(f"{self.client_id}:{self.base_revision}:{content}".encode()).hexdigest()[:16]


class OTServer:
    """
    Server-side Operational Transform engine.
    
    Guarantees:
    1. Total ordering of all operations
    2. Convergence: All clients reach same state
    3. Intention preservation: User intent maintained after transform
    
    Algorithm: Jupiter (Google Docs style)
    - Server maintains authoritative document state
    - Clients send operations based on their known revision
    - Server transforms against concurrent operations
    - Transformed operation broadcast to all clients
    """
    
    def __init__(self, db, pubsub):
        self.db = db
        self.pubsub = pubsub
        self._operation_cache = {}  # idempotency_key -> result
    
    async def apply_operation(
        self,
        document_id: str,
        batch: OperationBatch
    ) -> 'OperationResult':
        """
        Apply operation batch with OT transformation.
        
        Flow:
        1. Acquire document lock
        2. Load current state and revision
        3. Transform operations if needed
        4. Apply to document
        5. Persist and broadcast
        """
        
        # ─────────────────────────────────────────────────────────────────
        # IDEMPOTENCY CHECK
        # ─────────────────────────────────────────────────────────────────
        
        cache_key = f"{document_id}:{batch.idempotency_key}"
        if cache_key in self._operation_cache:
            return self._operation_cache[cache_key]
        
        # ─────────────────────────────────────────────────────────────────
        # ACQUIRE LOCK (short-lived, 5s timeout)
        # ─────────────────────────────────────────────────────────────────
        
        async with self._document_lock(document_id, timeout=5):
            # Load current document state
            doc = await self.db.get_document(document_id)
            current_revision = doc.revision
            current_content = doc.content
            
            # ─────────────────────────────────────────────────────────────
            # TRANSFORM IF NEEDED
            # ─────────────────────────────────────────────────────────────
            
            if batch.base_revision < current_revision:
                # Client is behind - need to transform
                intervening_ops = await self.db.get_operations(
                    document_id=document_id,
                    from_revision=batch.base_revision + 1,
                    to_revision=current_revision
                )
                
                transformed_ops = self._transform_batch(
                    client_ops=batch.operations,
                    server_ops=intervening_ops
                )
            elif batch.base_revision > current_revision:
                # Client ahead of server - invalid state
                raise InvalidRevisionError(
                    f"Client revision {batch.base_revision} ahead of server {current_revision}"
                )
            else:
                # Client in sync - no transform needed
                transformed_ops = batch.operations
            
            # ─────────────────────────────────────────────────────────────
            # APPLY OPERATIONS
            # ─────────────────────────────────────────────────────────────
            
            new_content = current_content
            for op in transformed_ops:
                new_content = self._apply_single_op(new_content, op)
            
            new_revision = current_revision + 1
            
            # ─────────────────────────────────────────────────────────────
            # PERSIST
            # ─────────────────────────────────────────────────────────────
            
            await self.db.update_document(
                document_id=document_id,
                content=new_content,
                revision=new_revision
            )
            
            await self.db.insert_operation_history(
                document_id=document_id,
                revision=new_revision,
                client_id=batch.client_id,
                operations=transformed_ops,
                original_operations=batch.operations,
                base_revision=batch.base_revision
            )
            
            # ─────────────────────────────────────────────────────────────
            # BROADCAST TO OTHER CLIENTS
            # ─────────────────────────────────────────────────────────────
            
            await self.pubsub.publish(
                channel=f"doc:{document_id}:ops",
                message={
                    "type": "operation",
                    "revision": new_revision,
                    "client_id": batch.client_id,
                    "operations": [op.to_dict() for op in transformed_ops],
                    "timestamp": batch.timestamp
                }
            )
            
            result = OperationResult(
                success=True,
                revision=new_revision,
                transformed_operations=transformed_ops,
                server_operations_applied=len(intervening_ops) if batch.base_revision < current_revision else 0
            )
            
            # Cache for idempotency
            self._operation_cache[cache_key] = result
            
            return result
    
    def _transform_batch(
        self,
        client_ops: List[Operation],
        server_ops: List[List[Operation]]
    ) -> List[Operation]:
        """
        Transform client operations against all server operations.
        
        Uses the transformation function:
        transform(client_op, server_op) -> (client_op', server_op')
        
        Where client_op' is the transformed client operation that achieves
        the same intent when applied after server_op.
        """
        
        transformed = list(client_ops)
        
        for server_batch in server_ops:
            for server_op in server_batch:
                transformed = [
                    self._transform_single(client_op, server_op, priority="client")
                    for client_op in transformed
                ]
        
        return transformed
    
    def _transform_single(
        self,
        client_op: Operation,
        server_op: Operation,
        priority: str = "client"
    ) -> Operation:
        """
        Transform a single client operation against a server operation.
        
        Transformation rules for INSERT/DELETE:
        
        1. INSERT vs INSERT at same position:
           - Priority determines which goes first
           - Loser's position shifts by winner's length
        
        2. INSERT vs DELETE:
           - If insert inside deleted range: insert at delete start
           - If insert after delete: shift position by -delete.length
           - If insert before delete: no change
        
        3. DELETE vs INSERT:
           - If delete range contains insert: expand delete range
           - If delete after insert: shift position by +insert.length
           - If delete before insert: no change
        
        4. DELETE vs DELETE:
           - If ranges overlap: merge/adjust
           - If disjoint: shift positions accordingly
        """
        
        # Same position INSERT conflict
        if (client_op.type == OpType.INSERT and 
            server_op.type == OpType.INSERT and
            client_op.position == server_op.position):
            
            if priority == "server":
                # Client insert moves after server insert
                return Operation(
                    type=OpType.INSERT,
                    position=client_op.position + len(server_op.content),
                    content=client_op.content,
                    attributes=client_op.attributes
                )
            else:
                # Client wins, no change needed
                return client_op
        
        # INSERT vs DELETE
        if client_op.type == OpType.INSERT and server_op.type == OpType.DELETE:
            delete_end = server_op.position + server_op.length
            
            if client_op.position <= server_op.position:
                # Insert before delete - no change
                return client_op
            elif client_op.position >= delete_end:
                # Insert after delete - shift back
                return Operation(
                    type=OpType.INSERT,
                    position=client_op.position - server_op.length,
                    content=client_op.content,
                    attributes=client_op.attributes
                )
            else:
                # Insert inside deleted range - move to delete start
                return Operation(
                    type=OpType.INSERT,
                    position=server_op.position,
                    content=client_op.content,
                    attributes=client_op.attributes
                )
        
        # DELETE vs INSERT
        if client_op.type == OpType.DELETE and server_op.type == OpType.INSERT:
            if server_op.position <= client_op.position:
                # Insert before delete - shift delete forward
                return Operation(
                    type=OpType.DELETE,
                    position=client_op.position + len(server_op.content),
                    length=client_op.length
                )
            elif server_op.position >= client_op.position + client_op.length:
                # Insert after delete - no change
                return client_op
            else:
                # Insert inside delete range - expand delete
                return Operation(
                    type=OpType.DELETE,
                    position=client_op.position,
                    length=client_op.length + len(server_op.content)
                )
        
        # DELETE vs DELETE
        if client_op.type == OpType.DELETE and server_op.type == OpType.DELETE:
            client_end = client_op.position + client_op.length
            server_end = server_op.position + server_op.length
            
            # No overlap - just shift if needed
            if client_end <= server_op.position:
                # Client delete before server delete - no change
                return client_op
            elif client_op.position >= server_end:
                # Client delete after server delete - shift back
                return Operation(
                    type=OpType.DELETE,
                    position=client_op.position - server_op.length,
                    length=client_op.length
                )
            else:
                # Overlapping deletes - compute remaining range
                new_start = min(client_op.position, server_op.position)
                new_end = max(client_end, server_end) - server_op.length
                
                if new_end <= new_start:
                    # Fully overlapped - nothing left to delete
                    return Operation(
                        type=OpType.RETAIN,
                        position=new_start,
                        length=0
                    )
                
                return Operation(
                    type=OpType.DELETE,
                    position=new_start,
                    length=new_end - new_start
                )
        
        # Default: no transformation needed
        return client_op
    
    def _apply_single_op(self, content: str, op: Operation) -> str:
        """Apply a single operation to content."""
        
        if op.type == OpType.INSERT:
            return content[:op.position] + op.content + content[op.position:]
        
        elif op.type == OpType.DELETE:
            return content[:op.position] + content[op.position + op.length:]
        
        elif op.type == OpType.RETAIN:
            return content  # No change
        
        return content
```

### 1.1.2 CRDT Implementation for Presence

```python
# ═══════════════════════════════════════════════════════════════════════════════
# CRDT PRESENCE SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

from dataclasses import dataclass, field
from typing import Dict, Set, Optional, Any
import time
import json


@dataclass
class LWWRegister:
    """
    Last-Writer-Wins Register CRDT.
    
    Used for: Cursor positions, selections, user status
    
    Properties:
    - Concurrent writes resolved by timestamp
    - Higher timestamp always wins
    - Tie-breaker: lexicographic client_id comparison
    """
    value: Any
    timestamp: float
    client_id: str
    
    def merge(self, other: 'LWWRegister') -> 'LWWRegister':
        """Merge two registers, returning the winner."""
        if other.timestamp > self.timestamp:
            return other
        elif other.timestamp == self.timestamp:
            # Tie-breaker: lexicographic client_id
            if other.client_id > self.client_id:
                return other
        return self


@dataclass
class GCounter:
    """
    Grow-only Counter CRDT.
    
    Used for: View counts, interaction metrics
    
    Properties:
    - Only increments (never decrements)
    - Each node has its own counter
    - Total = sum of all node counters
    """
    counts: Dict[str, int] = field(default_factory=dict)
    
    def increment(self, node_id: str, amount: int = 1):
        """Increment this node's counter."""
        self.counts[node_id] = self.counts.get(node_id, 0) + amount
    
    def value(self) -> int:
        """Get total count across all nodes."""
        return sum(self.counts.values())
    
    def merge(self, other: 'GCounter') -> 'GCounter':
        """Merge two counters by taking max of each node."""
        merged = GCounter()
        all_nodes = set(self.counts.keys()) | set(other.counts.keys())
        for node in all_nodes:
            merged.counts[node] = max(
                self.counts.get(node, 0),
                other.counts.get(node, 0)
            )
        return merged


@dataclass
class ORSet:
    """
    Observed-Remove Set CRDT.
    
    Used for: Active collaborators, tags, labels
    
    Properties:
    - Add and remove operations
    - Concurrent add + remove: add wins
    - Uses unique tags to track additions
    """
    elements: Dict[str, Set[str]] = field(default_factory=dict)  # element -> set of unique tags
    tombstones: Dict[str, Set[str]] = field(default_factory=dict)  # element -> removed tags
    
    def add(self, element: str, tag: str):
        """Add element with unique tag."""
        if element not in self.elements:
            self.elements[element] = set()
        self.elements[element].add(tag)
    
    def remove(self, element: str):
        """Remove element by tombstoning all its tags."""
        if element in self.elements:
            if element not in self.tombstones:
                self.tombstones[element] = set()
            self.tombstones[element].update(self.elements[element])
            del self.elements[element]
    
    def contains(self, element: str) -> bool:
        """Check if element is in set."""
        if element not in self.elements:
            return False
        # Element present if it has non-tombstoned tags
        active_tags = self.elements[element] - self.tombstones.get(element, set())
        return len(active_tags) > 0
    
    def values(self) -> Set[str]:
        """Get all elements in set."""
        return {e for e in self.elements if self.contains(e)}
    
    def merge(self, other: 'ORSet') -> 'ORSet':
        """Merge two OR-Sets."""
        merged = ORSet()
        
        # Merge elements
        all_elements = set(self.elements.keys()) | set(other.elements.keys())
        for element in all_elements:
            merged.elements[element] = (
                self.elements.get(element, set()) | 
                other.elements.get(element, set())
            )
        
        # Merge tombstones
        all_tombstoned = set(self.tombstones.keys()) | set(other.tombstones.keys())
        for element in all_tombstoned:
            merged.tombstones[element] = (
                self.tombstones.get(element, set()) |
                other.tombstones.get(element, set())
            )
        
        return merged


class PresenceManager:
    """
    Manages real-time presence using CRDTs.
    
    Features:
    - Live cursor positions
    - Selection highlights
    - User status (active, idle, away)
    - Typing indicators
    """
    
    PRESENCE_TTL = 30  # seconds before considered offline
    HEARTBEAT_INTERVAL = 5  # seconds between heartbeats
    
    def __init__(self, redis_client, pubsub):
        self.redis = redis_client
        self.pubsub = pubsub
    
    async def update_presence(
        self,
        document_id: str,
        user_id: str,
        cursor: Optional[Dict] = None,
        selection: Optional[Dict] = None,
        status: str = "active"
    ):
        """
        Update user presence in document.
        
        Uses LWW-Register semantics - last update wins.
        """
        
        timestamp = time.time()
        presence_key = f"presence:{document_id}"
        
        presence_data = {
            "user_id": user_id,
            "cursor": cursor,
            "selection": selection,
            "status": status,
            "timestamp": timestamp,
            "color": self._get_user_color(user_id),
            "name": await self._get_user_name(user_id)
        }
        
        # Store in Redis with TTL
        await self.redis.hset(
            presence_key,
            user_id,
            json.dumps(presence_data)
        )
        await self.redis.expire(presence_key, self.PRESENCE_TTL)
        
        # Broadcast to other users
        await self.pubsub.publish(
            channel=f"presence:{document_id}",
            message={
                "type": "presence_update",
                "data": presence_data
            }
        )
    
    async def get_all_presence(self, document_id: str) -> List[Dict]:
        """Get all active users in document."""
        
        presence_key = f"presence:{document_id}"
        all_presence = await self.redis.hgetall(presence_key)
        
        now = time.time()
        active_users = []
        
        for user_id, data_json in all_presence.items():
            data = json.loads(data_json)
            # Filter out stale presence
            if now - data["timestamp"] < self.PRESENCE_TTL:
                active_users.append(data)
        
        return active_users
    
    async def remove_presence(self, document_id: str, user_id: str):
        """Remove user presence (on disconnect)."""
        
        presence_key = f"presence:{document_id}"
        await self.redis.hdel(presence_key, user_id)
        
        # Broadcast removal
        await self.pubsub.publish(
            channel=f"presence:{document_id}",
            message={
                "type": "presence_remove",
                "user_id": user_id
            }
        )
    
    def _get_user_color(self, user_id: str) -> str:
        """Generate consistent color for user."""
        # Hash user_id to get consistent color
        hash_val = int(hashlib.md5(user_id.encode()).hexdigest()[:8], 16)
        colors = [
            "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
            "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
            "#BB8FCE", "#85C1E9", "#F8B500", "#00CED1"
        ]
        return colors[hash_val % len(colors)]
```

---

## 1.2 Agent Visibility to Multiple Humans

```python
# ═══════════════════════════════════════════════════════════════════════════════
# AGENT VISIBILITY MODEL
# ═══════════════════════════════════════════════════════════════════════════════

"""
AGENT VISIBILITY ARCHITECTURE

When an agent is working on a task, multiple humans may observe:
1. Task owner (always has full visibility)
2. Workspace collaborators (based on permissions)
3. Shared link viewers (read-only, limited visibility)

Visibility Levels:
- FULL: See all agent actions, reasoning, tool calls
- ACTIONS: See actions and results, not reasoning
- RESULTS: See only final outputs
- NONE: No visibility (task is private)
"""

from enum import Enum
from dataclasses import dataclass
from typing import List, Optional, Dict, Set


class VisibilityLevel(Enum):
    FULL = "full"           # Everything including reasoning
    ACTIONS = "actions"     # Actions and results only
    RESULTS = "results"     # Final outputs only
    NONE = "none"           # No access


class AgentEventType(Enum):
    # Reasoning events (FULL visibility only)
    THINKING = "thinking"
    PLANNING = "planning"
    DECISION = "decision"
    
    # Action events (ACTIONS+ visibility)
    TOOL_CALL = "tool_call"
    TOOL_RESULT = "tool_result"
    SEARCH = "search"
    BROWSE = "browse"
    CODE_EXECUTE = "code_execute"
    FILE_OPERATION = "file_operation"
    
    # Result events (RESULTS+ visibility)
    OUTPUT = "output"
    ARTIFACT = "artifact"
    COMPLETION = "completion"
    ERROR = "error"


@dataclass
class AgentEvent:
    """Event emitted by agent during execution."""
    event_type: AgentEventType
    timestamp: float
    data: Dict
    visibility_required: VisibilityLevel
    
    @classmethod
    def thinking(cls, content: str) -> 'AgentEvent':
        return cls(
            event_type=AgentEventType.THINKING,
            timestamp=time.time(),
            data={"content": content},
            visibility_required=VisibilityLevel.FULL
        )
    
    @classmethod
    def tool_call(cls, tool: str, args: Dict, result: Any) -> 'AgentEvent':
        return cls(
            event_type=AgentEventType.TOOL_CALL,
            timestamp=time.time(),
            data={"tool": tool, "args": args, "result": result},
            visibility_required=VisibilityLevel.ACTIONS
        )
    
    @classmethod
    def output(cls, content: str, artifacts: List[str] = None) -> 'AgentEvent':
        return cls(
            event_type=AgentEventType.OUTPUT,
            timestamp=time.time(),
            data={"content": content, "artifacts": artifacts or []},
            visibility_required=VisibilityLevel.RESULTS
        )


class AgentVisibilityManager:
    """
    Manages which humans can see which agent events.
    
    Architecture:
    - Agent emits events to central event bus
    - Visibility manager filters events per viewer
    - Filtered events sent via WebSocket to each viewer
    """
    
    def __init__(self, db, pubsub, permission_service):
        self.db = db
        self.pubsub = pubsub
        self.permissions = permission_service
        self._viewer_sessions: Dict[str, Set[str]] = {}  # task_id -> set of session_ids
    
    async def register_viewer(
        self,
        task_id: str,
        user_id: str,
        session_id: str
    ) -> VisibilityLevel:
        """
        Register a human viewer for a task.
        
        Returns the visibility level they're granted.
        """
        
        # Determine visibility level
        visibility = await self._determine_visibility(task_id, user_id)
        
        if visibility == VisibilityLevel.NONE:
            raise PermissionDenied(f"User {user_id} cannot view task {task_id}")
        
        # Register session
        if task_id not in self._viewer_sessions:
            self._viewer_sessions[task_id] = set()
        self._viewer_sessions[task_id].add(session_id)
        
        # Store viewer info
        await self.db.upsert_task_viewer(
            task_id=task_id,
            user_id=user_id,
            session_id=session_id,
            visibility_level=visibility,
            joined_at=time.time()
        )
        
        # Notify other viewers
        await self._broadcast_viewer_joined(task_id, user_id, visibility)
        
        return visibility
    
    async def emit_event(self, task_id: str, event: AgentEvent):
        """
        Emit an agent event, filtered by visibility.
        
        Each viewer receives only events they're allowed to see.
        """
        
        # Get all viewers and their visibility levels
        viewers = await self.db.get_task_viewers(task_id)
        
        for viewer in viewers:
            # Check if viewer can see this event
            if self._can_see_event(viewer.visibility_level, event.visibility_required):
                # Filter sensitive data if needed
                filtered_event = self._filter_event_for_visibility(
                    event, 
                    viewer.visibility_level
                )
                
                # Send to viewer's session
                await self.pubsub.publish(
                    channel=f"task:{task_id}:viewer:{viewer.session_id}",
                    message={
                        "type": "agent_event",
                        "event": filtered_event.to_dict()
                    }
                )
    
    async def _determine_visibility(
        self,
        task_id: str,
        user_id: str
    ) -> VisibilityLevel:
        """
        Determine visibility level for a user on a task.
        
        Hierarchy:
        1. Task owner -> FULL
        2. Workspace admin -> FULL
        3. Workspace member with edit -> ACTIONS
        4. Workspace member with view -> RESULTS
        5. Shared link viewer -> RESULTS (if enabled)
        6. Otherwise -> NONE
        """
        
        task = await self.db.get_task(task_id)
        
        # Owner always has full visibility
        if task.owner_id == user_id:
            return VisibilityLevel.FULL
        
        # Check workspace permissions
        workspace_role = await self.permissions.get_workspace_role(
            workspace_id=task.workspace_id,
            user_id=user_id
        )
        
        if workspace_role == "admin":
            return VisibilityLevel.FULL
        elif workspace_role == "editor":
            return VisibilityLevel.ACTIONS
        elif workspace_role == "viewer":
            return VisibilityLevel.RESULTS
        
        # Check shared link
        if task.shared_link_enabled:
            shared_access = await self.db.get_shared_link_access(task_id, user_id)
            if shared_access:
                return VisibilityLevel.RESULTS
        
        return VisibilityLevel.NONE
    
    def _can_see_event(
        self,
        viewer_level: VisibilityLevel,
        required_level: VisibilityLevel
    ) -> bool:
        """Check if viewer level can see event requiring certain level."""
        
        hierarchy = {
            VisibilityLevel.FULL: 3,
            VisibilityLevel.ACTIONS: 2,
            VisibilityLevel.RESULTS: 1,
            VisibilityLevel.NONE: 0
        }
        
        return hierarchy[viewer_level] >= hierarchy[required_level]
    
    def _filter_event_for_visibility(
        self,
        event: AgentEvent,
        visibility: VisibilityLevel
    ) -> AgentEvent:
        """Filter event data based on visibility level."""
        
        if visibility == VisibilityLevel.FULL:
            return event  # No filtering
        
        filtered_data = dict(event.data)
        
        if visibility == VisibilityLevel.ACTIONS:
            # Remove reasoning/thinking content
            if "reasoning" in filtered_data:
                filtered_data["reasoning"] = "[Hidden]"
            if "thinking" in filtered_data:
                filtered_data["thinking"] = "[Hidden]"
        
        elif visibility == VisibilityLevel.RESULTS:
            # Only keep output-related fields
            allowed_fields = {"content", "artifacts", "output", "result", "error"}
            filtered_data = {k: v for k, v in filtered_data.items() if k in allowed_fields}
        
        return AgentEvent(
            event_type=event.event_type,
            timestamp=event.timestamp,
            data=filtered_data,
            visibility_required=event.visibility_required
        )
```

---

## 1.3 Permission Model Per Collaborator

```python
# ═══════════════════════════════════════════════════════════════════════════════
# COLLABORATION PERMISSION MODEL
# ═══════════════════════════════════════════════════════════════════════════════

"""
PERMISSION HIERARCHY

Workspace Level:
├── Owner (1 per workspace)
│   └── Full control, billing, delete workspace
├── Admin
│   └── Manage members, all content, settings
├── Editor
│   └── Create/edit content, run agents
├── Viewer
│   └── Read-only access
└── Guest (via shared link)
    └── Limited read access to specific items

Resource Level Permissions:
- Tasks: view, edit, run, delete, share
- Documents: view, edit, comment, delete
- Agents: view, configure, run, delete
- Integrations: view, configure, use
"""

from enum import Enum, Flag, auto
from dataclasses import dataclass
from typing import List, Optional, Set, Dict


class Permission(Flag):
    """Fine-grained permissions as bit flags."""
    NONE = 0
    
    # Task permissions
    TASK_VIEW = auto()
    TASK_EDIT = auto()
    TASK_RUN = auto()
    TASK_DELETE = auto()
    TASK_SHARE = auto()
    
    # Document permissions
    DOC_VIEW = auto()
    DOC_EDIT = auto()
    DOC_COMMENT = auto()
    DOC_DELETE = auto()
    
    # Agent permissions
    AGENT_VIEW = auto()
    AGENT_CONFIGURE = auto()
    AGENT_RUN = auto()
    AGENT_DELETE = auto()
    
    # Integration permissions
    INTEGRATION_VIEW = auto()
    INTEGRATION_CONFIGURE = auto()
    INTEGRATION_USE = auto()
    
    # Workspace permissions
    WORKSPACE_SETTINGS = auto()
    WORKSPACE_MEMBERS = auto()
    WORKSPACE_BILLING = auto()
    WORKSPACE_DELETE = auto()
    
    # Compound permissions
    TASK_ALL = TASK_VIEW | TASK_EDIT | TASK_RUN | TASK_DELETE | TASK_SHARE
    DOC_ALL = DOC_VIEW | DOC_EDIT | DOC_COMMENT | DOC_DELETE
    AGENT_ALL = AGENT_VIEW | AGENT_CONFIGURE | AGENT_RUN | AGENT_DELETE
    INTEGRATION_ALL = INTEGRATION_VIEW | INTEGRATION_CONFIGURE | INTEGRATION_USE
    WORKSPACE_ALL = WORKSPACE_SETTINGS | WORKSPACE_MEMBERS | WORKSPACE_BILLING | WORKSPACE_DELETE


class WorkspaceRole(Enum):
    OWNER = "owner"
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"
    GUEST = "guest"


# Role -> Permission mapping
ROLE_PERMISSIONS: Dict[WorkspaceRole, Permission] = {
    WorkspaceRole.OWNER: (
        Permission.TASK_ALL | 
        Permission.DOC_ALL | 
        Permission.AGENT_ALL | 
        Permission.INTEGRATION_ALL |
        Permission.WORKSPACE_ALL
    ),
    WorkspaceRole.ADMIN: (
        Permission.TASK_ALL | 
        Permission.DOC_ALL | 
        Permission.AGENT_ALL | 
        Permission.INTEGRATION_ALL |
        Permission.WORKSPACE_SETTINGS |
        Permission.WORKSPACE_MEMBERS
    ),
    WorkspaceRole.EDITOR: (
        Permission.TASK_VIEW | Permission.TASK_EDIT | Permission.TASK_RUN | Permission.TASK_SHARE |
        Permission.DOC_VIEW | Permission.DOC_EDIT | Permission.DOC_COMMENT |
        Permission.AGENT_VIEW | Permission.AGENT_RUN |
        Permission.INTEGRATION_VIEW | Permission.INTEGRATION_USE
    ),
    WorkspaceRole.VIEWER: (
        Permission.TASK_VIEW |
        Permission.DOC_VIEW | Permission.DOC_COMMENT |
        Permission.AGENT_VIEW |
        Permission.INTEGRATION_VIEW
    ),
    WorkspaceRole.GUEST: (
        Permission.TASK_VIEW |
        Permission.DOC_VIEW
    )
}


@dataclass
class ResourcePermission:
    """Permission override for a specific resource."""
    resource_type: str  # "task", "document", "agent"
    resource_id: str
    user_id: str
    permissions: Permission
    granted_by: str
    granted_at: float
    expires_at: Optional[float] = None


class PermissionService:
    """
    Manages permissions for collaboration.
    
    Permission Resolution:
    1. Check resource-specific overrides
    2. Fall back to workspace role permissions
    3. Apply any restrictions (e.g., suspended user)
    """
    
    def __init__(self, db, cache):
        self.db = db
        self.cache = cache
    
    async def check_permission(
        self,
        user_id: str,
        workspace_id: str,
        resource_type: str,
        resource_id: str,
        required_permission: Permission
    ) -> bool:
        """
        Check if user has required permission on resource.
        
        Returns True if permitted, False otherwise.
        """
        
        # Get effective permissions
        effective = await self.get_effective_permissions(
            user_id=user_id,
            workspace_id=workspace_id,
            resource_type=resource_type,
            resource_id=resource_id
        )
        
        # Check if required permission is granted
        return (effective & required_permission) == required_permission
    
    async def get_effective_permissions(
        self,
        user_id: str,
        workspace_id: str,
        resource_type: str,
        resource_id: str
    ) -> Permission:
        """
        Get effective permissions for user on resource.
        
        Combines role permissions with resource-specific overrides.
        """
        
        # Check cache first
        cache_key = f"perm:{workspace_id}:{user_id}:{resource_type}:{resource_id}"
        cached = await self.cache.get(cache_key)
        if cached:
            return Permission(cached)
        
        # Get workspace role
        membership = await self.db.get_workspace_membership(workspace_id, user_id)
        
        if not membership or membership.status != "active":
            return Permission.NONE
        
        # Start with role permissions
        role_perms = ROLE_PERMISSIONS.get(
            WorkspaceRole(membership.role),
            Permission.NONE
        )
        
        # Check for resource-specific overrides
        override = await self.db.get_resource_permission(
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id
        )
        
        if override:
            # Check expiration
            if override.expires_at and override.expires_at < time.time():
                # Expired - remove and use role permissions
                await self.db.delete_resource_permission(override.id)
            else:
                # Apply override (union with role permissions)
                role_perms = role_perms | override.permissions
        
        # Cache for 5 minutes
        await self.cache.setex(cache_key, 300, role_perms.value)
        
        return role_perms
    
    async def grant_permission(
        self,
        granter_id: str,
        grantee_id: str,
        workspace_id: str,
        resource_type: str,
        resource_id: str,
        permissions: Permission,
        expires_in_hours: Optional[int] = None
    ) -> ResourcePermission:
        """
        Grant specific permissions to a user on a resource.
        
        Requires granter to have the permissions they're granting.
        """
        
        # Verify granter has permissions to grant
        granter_perms = await self.get_effective_permissions(
            user_id=granter_id,
            workspace_id=workspace_id,
            resource_type=resource_type,
            resource_id=resource_id
        )
        
        # Can only grant permissions you have
        if (granter_perms & permissions) != permissions:
            raise PermissionDenied("Cannot grant permissions you don't have")
        
        # Create permission record
        expires_at = None
        if expires_in_hours:
            expires_at = time.time() + (expires_in_hours * 3600)
        
        permission = ResourcePermission(
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=grantee_id,
            permissions=permissions,
            granted_by=granter_id,
            granted_at=time.time(),
            expires_at=expires_at
        )
        
        await self.db.upsert_resource_permission(permission)
        
        # Invalidate cache
        cache_key = f"perm:{workspace_id}:{grantee_id}:{resource_type}:{resource_id}"
        await self.cache.delete(cache_key)
        
        # Audit log
        await self._log_permission_change(
            action="grant",
            granter_id=granter_id,
            grantee_id=grantee_id,
            resource_type=resource_type,
            resource_id=resource_id,
            permissions=permissions
        )
        
        return permission
    
    async def revoke_permission(
        self,
        revoker_id: str,
        user_id: str,
        workspace_id: str,
        resource_type: str,
        resource_id: str,
        permissions: Permission
    ):
        """Revoke specific permissions from a user."""
        
        # Verify revoker has admin or owner role
        revoker_role = await self.db.get_workspace_role(workspace_id, revoker_id)
        if revoker_role not in [WorkspaceRole.OWNER, WorkspaceRole.ADMIN]:
            raise PermissionDenied("Only admins can revoke permissions")
        
        # Get current override
        current = await self.db.get_resource_permission(
            resource_type=resource_type,
            resource_id=resource_id,
            user_id=user_id
        )
        
        if current:
            # Remove specified permissions
            new_perms = current.permissions & ~permissions
            
            if new_perms == Permission.NONE:
                await self.db.delete_resource_permission(current.id)
            else:
                current.permissions = new_perms
                await self.db.update_resource_permission(current)
        
        # Invalidate cache
        cache_key = f"perm:{workspace_id}:{user_id}:{resource_type}:{resource_id}"
        await self.cache.delete(cache_key)
        
        # Audit log
        await self._log_permission_change(
            action="revoke",
            granter_id=revoker_id,
            grantee_id=user_id,
            resource_type=resource_type,
            resource_id=resource_id,
            permissions=permissions
        )
```

---

## 1.4 Credit Attribution Rules

```python
# ═══════════════════════════════════════════════════════════════════════════════
# CREDIT ATTRIBUTION SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

"""
CREDIT ATTRIBUTION MODEL

When multiple users collaborate on a task, credits are attributed based on:
1. Task initiator (who started the task)
2. Active contributors (who made edits during task)
3. Resource ownership (whose integrations/data were used)

Attribution Rules:
- Task credits: Charged to task initiator's account
- Integration credits: Charged to integration owner
- Shared workspace: Can configure shared billing pool
- Guest access: Charged to inviter
"""

from dataclasses import dataclass
from typing import List, Dict, Optional
from enum import Enum
from decimal import Decimal


class CreditType(Enum):
    LLM_TOKENS = "llm_tokens"
    SEARCH_QUERIES = "search_queries"
    TOOL_EXECUTIONS = "tool_executions"
    STORAGE_GB = "storage_gb"
    COMPUTE_MINUTES = "compute_minutes"


@dataclass
class CreditUsage:
    """Record of credit usage."""
    id: str
    workspace_id: str
    task_id: str
    credit_type: CreditType
    amount: Decimal
    unit_cost: Decimal
    total_cost: Decimal
    attributed_to: str  # user_id
    attribution_reason: str
    timestamp: float
    metadata: Dict


@dataclass
class AttributionRule:
    """Rule for attributing credits."""
    priority: int
    condition: str  # Expression to evaluate
    attribute_to: str  # "initiator", "integration_owner", "workspace_pool", "inviter"
    split_percentage: Optional[Decimal] = None  # For shared attribution


class CreditAttributionEngine:
    """
    Determines who pays for resource usage in collaborative scenarios.
    
    Attribution Hierarchy:
    1. Explicit attribution (user specified)
    2. Integration owner (for integration-specific costs)
    3. Task initiator (default)
    4. Workspace pool (if configured)
    """
    
    DEFAULT_RULES = [
        AttributionRule(
            priority=1,
            condition="usage.credit_type == 'INTEGRATION' and integration.owner_id != task.initiator_id",
            attribute_to="integration_owner"
        ),
        AttributionRule(
            priority=2,
            condition="workspace.shared_billing_enabled",
            attribute_to="workspace_pool"
        ),
        AttributionRule(
            priority=3,
            condition="user.is_guest",
            attribute_to="inviter"
        ),
        AttributionRule(
            priority=100,
            condition="true",  # Default fallback
            attribute_to="initiator"
        )
    ]
    
    def __init__(self, db, billing_service):
        self.db = db
        self.billing = billing_service
    
    async def attribute_usage(
        self,
        workspace_id: str,
        task_id: str,
        credit_type: CreditType,
        amount: Decimal,
        context: Dict
    ) -> CreditUsage:
        """
        Attribute credit usage to appropriate user/pool.
        
        Context should include:
        - task: Task details
        - user: Current user
        - integration: Integration used (if applicable)
        - workspace: Workspace settings
        """
        
        # Get attribution rules (workspace custom + defaults)
        rules = await self._get_attribution_rules(workspace_id)
        
        # Evaluate rules in priority order
        attributed_to = None
        attribution_reason = None
        
        for rule in sorted(rules, key=lambda r: r.priority):
            if self._evaluate_condition(rule.condition, context):
                attributed_to, attribution_reason = await self._resolve_attribution(
                    rule, context
                )
                break
        
        # Calculate cost
        unit_cost = await self.billing.get_unit_cost(credit_type)
        total_cost = amount * unit_cost
        
        # Create usage record
        usage = CreditUsage(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            task_id=task_id,
            credit_type=credit_type,
            amount=amount,
            unit_cost=unit_cost,
            total_cost=total_cost,
            attributed_to=attributed_to,
            attribution_reason=attribution_reason,
            timestamp=time.time(),
            metadata=context
        )
        
        # Persist and charge
        await self.db.insert_credit_usage(usage)
        await self.billing.charge(attributed_to, total_cost, usage)
        
        return usage
    
    async def _resolve_attribution(
        self,
        rule: AttributionRule,
        context: Dict
    ) -> tuple[str, str]:
        """Resolve who to attribute to based on rule."""
        
        if rule.attribute_to == "initiator":
            return context["task"]["initiator_id"], "Task initiator"
        
        elif rule.attribute_to == "integration_owner":
            return context["integration"]["owner_id"], f"Integration owner ({context['integration']['name']})"
        
        elif rule.attribute_to == "workspace_pool":
            workspace = context["workspace"]
            return f"pool:{workspace['id']}", "Workspace shared pool"
        
        elif rule.attribute_to == "inviter":
            user = context["user"]
            inviter = await self.db.get_user_inviter(user["id"], context["workspace"]["id"])
            return inviter["id"], f"Guest inviter ({inviter['email']})"
        
        # Fallback
        return context["task"]["initiator_id"], "Default attribution"
    
    async def get_usage_summary(
        self,
        workspace_id: str,
        user_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """Get credit usage summary for a user in workspace."""
        
        usages = await self.db.get_credit_usages(
            workspace_id=workspace_id,
            attributed_to=user_id,
            start_date=start_date,
            end_date=end_date
        )
        
        summary = {
            "total_cost": Decimal("0"),
            "by_type": {},
            "by_task": {},
            "by_day": {}
        }
        
        for usage in usages:
            summary["total_cost"] += usage.total_cost
            
            # By type
            type_key = usage.credit_type.value
            if type_key not in summary["by_type"]:
                summary["by_type"][type_key] = {"amount": Decimal("0"), "cost": Decimal("0")}
            summary["by_type"][type_key]["amount"] += usage.amount
            summary["by_type"][type_key]["cost"] += usage.total_cost
            
            # By task
            if usage.task_id not in summary["by_task"]:
                summary["by_task"][usage.task_id] = Decimal("0")
            summary["by_task"][usage.task_id] += usage.total_cost
            
            # By day
            day = datetime.fromtimestamp(usage.timestamp).strftime("%Y-%m-%d")
            if day not in summary["by_day"]:
                summary["by_day"][day] = Decimal("0")
            summary["by_day"][day] += usage.total_cost
        
        return summary
```

---

## 1.5 Audit Trail for Edits

```python
# ═══════════════════════════════════════════════════════════════════════════════
# AUDIT TRAIL SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

"""
AUDIT TRAIL ARCHITECTURE

Every edit in the collaboration system is logged with:
1. Who made the change (user or agent)
2. What was changed (before/after)
3. When it happened (timestamp)
4. Why it happened (context/reason)
5. How it was made (tool/interface)

Audit events are:
- Immutable (append-only)
- Cryptographically chained (tamper-evident)
- Queryable (indexed for search)
- Exportable (compliance reporting)
"""

from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from enum import Enum
import hashlib
import json


class AuditEventType(Enum):
    # Document events
    DOC_CREATE = "doc.create"
    DOC_EDIT = "doc.edit"
    DOC_DELETE = "doc.delete"
    DOC_RESTORE = "doc.restore"
    DOC_SHARE = "doc.share"
    
    # Task events
    TASK_CREATE = "task.create"
    TASK_UPDATE = "task.update"
    TASK_COMPLETE = "task.complete"
    TASK_CANCEL = "task.cancel"
    
    # Agent events
    AGENT_ACTION = "agent.action"
    AGENT_TOOL_CALL = "agent.tool_call"
    AGENT_OUTPUT = "agent.output"
    
    # Permission events
    PERMISSION_GRANT = "permission.grant"
    PERMISSION_REVOKE = "permission.revoke"
    MEMBER_INVITE = "member.invite"
    MEMBER_REMOVE = "member.remove"
    
    # Integration events
    INTEGRATION_CONNECT = "integration.connect"
    INTEGRATION_DISCONNECT = "integration.disconnect"
    INTEGRATION_USE = "integration.use"


class ActorType(Enum):
    USER = "user"
    AGENT = "agent"
    SYSTEM = "system"


@dataclass
class AuditEvent:
    """Immutable audit event record."""
    id: str
    workspace_id: str
    event_type: AuditEventType
    
    # Actor information
    actor_type: ActorType
    actor_id: str
    actor_name: str
    actor_ip: Optional[str]
    actor_user_agent: Optional[str]
    
    # Resource information
    resource_type: str
    resource_id: str
    resource_name: Optional[str]
    
    # Change details
    action: str
    before_state: Optional[Dict]
    after_state: Optional[Dict]
    diff: Optional[Dict]
    
    # Context
    reason: Optional[str]
    metadata: Dict
    
    # Integrity
    timestamp: float
    previous_hash: str
    event_hash: str
    
    def compute_hash(self) -> str:
        """Compute cryptographic hash of event."""
        content = json.dumps({
            "id": self.id,
            "workspace_id": self.workspace_id,
            "event_type": self.event_type.value,
            "actor_type": self.actor_type.value,
            "actor_id": self.actor_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "action": self.action,
            "before_state": self.before_state,
            "after_state": self.after_state,
            "timestamp": self.timestamp,
            "previous_hash": self.previous_hash
        }, sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


class AuditTrailService:
    """
    Manages audit trail for all collaboration events.
    
    Features:
    - Append-only event log
    - Cryptographic chaining for tamper detection
    - Rich querying and filtering
    - Export for compliance
    """
    
    def __init__(self, db, search_index):
        self.db = db
        self.search = search_index
        self._hash_cache = {}
    
    async def log_event(
        self,
        workspace_id: str,
        event_type: AuditEventType,
        actor_type: ActorType,
        actor_id: str,
        resource_type: str,
        resource_id: str,
        action: str,
        before_state: Optional[Dict] = None,
        after_state: Optional[Dict] = None,
        reason: Optional[str] = None,
        metadata: Optional[Dict] = None,
        request_context: Optional[Dict] = None
    ) -> AuditEvent:
        """
        Log an audit event.
        
        Events are chained cryptographically for tamper detection.
        """
        
        # Get actor details
        actor_name = await self._get_actor_name(actor_type, actor_id)
        
        # Get previous event hash for chaining
        previous_hash = await self._get_previous_hash(workspace_id)
        
        # Compute diff if both states provided
        diff = None
        if before_state and after_state:
            diff = self._compute_diff(before_state, after_state)
        
        # Create event
        event = AuditEvent(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            event_type=event_type,
            actor_type=actor_type,
            actor_id=actor_id,
            actor_name=actor_name,
            actor_ip=request_context.get("ip") if request_context else None,
            actor_user_agent=request_context.get("user_agent") if request_context else None,
            resource_type=resource_type,
            resource_id=resource_id,
            resource_name=await self._get_resource_name(resource_type, resource_id),
            action=action,
            before_state=before_state,
            after_state=after_state,
            diff=diff,
            reason=reason,
            metadata=metadata or {},
            timestamp=time.time(),
            previous_hash=previous_hash,
            event_hash=""  # Computed below
        )
        
        # Compute and set hash
        event.event_hash = event.compute_hash()
        
        # Persist (append-only)
        await self.db.insert_audit_event(event)
        
        # Update hash cache
        self._hash_cache[workspace_id] = event.event_hash
        
        # Index for search
        await self.search.index_audit_event(event)
        
        return event
    
    async def query_events(
        self,
        workspace_id: str,
        filters: Optional[Dict] = None,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
        actor_id: Optional[str] = None,
        resource_type: Optional[str] = None,
        resource_id: Optional[str] = None,
        event_types: Optional[List[AuditEventType]] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[AuditEvent]:
        """Query audit events with filters."""
        
        query = {"workspace_id": workspace_id}
        
        if start_time:
            query["timestamp"] = {"$gte": start_time}
        if end_time:
            query.setdefault("timestamp", {})["$lte"] = end_time
        if actor_id:
            query["actor_id"] = actor_id
        if resource_type:
            query["resource_type"] = resource_type
        if resource_id:
            query["resource_id"] = resource_id
        if event_types:
            query["event_type"] = {"$in": [et.value for et in event_types]}
        
        events = await self.db.query_audit_events(
            query=query,
            limit=limit,
            offset=offset,
            order_by="timestamp",
            order_dir="desc"
        )
        
        return events
    
    async def verify_chain_integrity(
        self,
        workspace_id: str,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None
    ) -> 'IntegrityCheckResult':
        """
        Verify the cryptographic chain integrity.
        
        Detects any tampering with audit records.
        """
        
        events = await self.db.get_audit_events_ordered(
            workspace_id=workspace_id,
            start_time=start_time,
            end_time=end_time
        )
        
        issues = []
        previous_hash = "genesis"
        
        for i, event in enumerate(events):
            # Verify previous hash chain
            if event.previous_hash != previous_hash:
                issues.append({
                    "event_id": event.id,
                    "issue": "chain_break",
                    "expected_previous": previous_hash,
                    "actual_previous": event.previous_hash,
                    "position": i
                })
            
            # Verify event hash
            computed_hash = event.compute_hash()
            if computed_hash != event.event_hash:
                issues.append({
                    "event_id": event.id,
                    "issue": "hash_mismatch",
                    "expected_hash": computed_hash,
                    "actual_hash": event.event_hash,
                    "position": i
                })
            
            previous_hash = event.event_hash
        
        return IntegrityCheckResult(
            is_valid=len(issues) == 0,
            events_checked=len(events),
            issues=issues
        )
    
    async def export_for_compliance(
        self,
        workspace_id: str,
        start_time: float,
        end_time: float,
        format: str = "json"
    ) -> bytes:
        """Export audit trail for compliance reporting."""
        
        events = await self.query_events(
            workspace_id=workspace_id,
            start_time=start_time,
            end_time=end_time,
            limit=100000  # Large limit for export
        )
        
        if format == "json":
            return json.dumps([self._event_to_dict(e) for e in events], indent=2).encode()
        
        elif format == "csv":
            import csv
            import io
            
            output = io.StringIO()
            writer = csv.writer(output)
            
            # Header
            writer.writerow([
                "timestamp", "event_type", "actor_type", "actor_id", "actor_name",
                "resource_type", "resource_id", "action", "reason"
            ])
            
            # Data
            for event in events:
                writer.writerow([
                    datetime.fromtimestamp(event.timestamp).isoformat(),
                    event.event_type.value,
                    event.actor_type.value,
                    event.actor_id,
                    event.actor_name,
                    event.resource_type,
                    event.resource_id,
                    event.action,
                    event.reason or ""
                ])
            
            return output.getvalue().encode()
        
        raise ValueError(f"Unsupported format: {format}")
    
    def _compute_diff(self, before: Dict, after: Dict) -> Dict:
        """Compute structured diff between states."""
        
        diff = {
            "added": {},
            "removed": {},
            "changed": {}
        }
        
        all_keys = set(before.keys()) | set(after.keys())
        
        for key in all_keys:
            if key not in before:
                diff["added"][key] = after[key]
            elif key not in after:
                diff["removed"][key] = before[key]
            elif before[key] != after[key]:
                diff["changed"][key] = {
                    "from": before[key],
                    "to": after[key]
                }
        
        return diff
```

---

## 1.6 Live Cursor / Presence Semantics

```python
# ═══════════════════════════════════════════════════════════════════════════════
# LIVE CURSOR AND PRESENCE SEMANTICS
# ═══════════════════════════════════════════════════════════════════════════════

"""
PRESENCE SEMANTICS

Presence State Machine:
┌─────────┐  activity   ┌─────────┐  30s idle   ┌─────────┐
│ OFFLINE │────────────▶│ ACTIVE  │────────────▶│  IDLE   │
└─────────┘             └─────────┘             └─────────┘
     ▲                       │                       │
     │                       │ 5min idle             │ activity
     │                       ▼                       │
     │                  ┌─────────┐                  │
     └──────────────────│  AWAY   │◀─────────────────┘
        disconnect      └─────────┘

Cursor Semantics:
- Position: Character offset in document
- Selection: Start and end offsets
- Color: Unique per user (deterministic from user_id)
- Label: User name shown near cursor
- Visibility: Fades after 3s of inactivity
"""

from dataclasses import dataclass
from typing import Optional, Dict, List
from enum import Enum
import asyncio


class PresenceState(Enum):
    OFFLINE = "offline"
    ACTIVE = "active"
    IDLE = "idle"
    AWAY = "away"


@dataclass
class CursorPosition:
    """Cursor position in document."""
    offset: int  # Character offset
    line: Optional[int] = None  # Line number (for code)
    column: Optional[int] = None  # Column number (for code)


@dataclass
class Selection:
    """Text selection range."""
    start: CursorPosition
    end: CursorPosition
    direction: str = "forward"  # "forward" or "backward"


@dataclass
class UserPresence:
    """Complete presence state for a user."""
    user_id: str
    user_name: str
    user_avatar: Optional[str]
    color: str
    state: PresenceState
    cursor: Optional[CursorPosition]
    selection: Optional[Selection]
    last_activity: float
    current_element: Optional[str]  # Element ID being edited
    typing: bool


class LivePresenceEngine:
    """
    Manages real-time cursor and presence for collaboration.
    
    Protocol:
    1. Client sends cursor updates on every change
    2. Server broadcasts to other clients
    3. Server tracks activity for state transitions
    4. Clients render remote cursors with labels
    """
    
    IDLE_THRESHOLD = 30  # seconds
    AWAY_THRESHOLD = 300  # 5 minutes
    CURSOR_FADE_DELAY = 3  # seconds
    BROADCAST_THROTTLE = 50  # ms
    
    def __init__(self, pubsub, db):
        self.pubsub = pubsub
        self.db = db
        self._presence_cache: Dict[str, Dict[str, UserPresence]] = {}  # doc_id -> user_id -> presence
        self._last_broadcast: Dict[str, float] = {}  # user_id -> timestamp
        self._state_timers: Dict[str, asyncio.Task] = {}  # user_id -> timer task
    
    async def update_cursor(
        self,
        document_id: str,
        user_id: str,
        cursor: CursorPosition,
        selection: Optional[Selection] = None,
        current_element: Optional[str] = None,
        typing: bool = False
    ):
        """
        Update user's cursor position.
        
        Throttled to prevent flooding.
        """
        
        now = time.time()
        
        # Throttle broadcasts
        last_broadcast = self._last_broadcast.get(user_id, 0)
        if now - last_broadcast < self.BROADCAST_THROTTLE / 1000:
            return  # Skip this update
        
        # Get or create presence
        presence = await self._get_or_create_presence(document_id, user_id)
        
        # Update presence
        presence.cursor = cursor
        presence.selection = selection
        presence.current_element = current_element
        presence.typing = typing
        presence.last_activity = now
        presence.state = PresenceState.ACTIVE
        
        # Reset state timer
        await self._reset_state_timer(document_id, user_id)
        
        # Cache update
        if document_id not in self._presence_cache:
            self._presence_cache[document_id] = {}
        self._presence_cache[document_id][user_id] = presence
        
        # Broadcast to other users
        await self._broadcast_presence(document_id, presence)
        
        self._last_broadcast[user_id] = now
    
    async def get_all_presence(self, document_id: str) -> List[UserPresence]:
        """Get all active users' presence in document."""
        
        if document_id in self._presence_cache:
            return list(self._presence_cache[document_id].values())
        
        # Load from database
        presences = await self.db.get_document_presence(document_id)
        
        # Filter out stale presence
        now = time.time()
        active = [
            p for p in presences
            if now - p.last_activity < self.AWAY_THRESHOLD
        ]
        
        return active
    
    async def user_disconnect(self, document_id: str, user_id: str):
        """Handle user disconnection."""
        
        # Update state to offline
        if document_id in self._presence_cache:
            if user_id in self._presence_cache[document_id]:
                presence = self._presence_cache[document_id][user_id]
                presence.state = PresenceState.OFFLINE
                presence.cursor = None
                presence.selection = None
                
                # Broadcast departure
                await self._broadcast_presence(document_id, presence)
                
                # Remove from cache
                del self._presence_cache[document_id][user_id]
        
        # Cancel state timer
        timer_key = f"{document_id}:{user_id}"
        if timer_key in self._state_timers:
            self._state_timers[timer_key].cancel()
            del self._state_timers[timer_key]
        
        # Update database
        await self.db.remove_document_presence(document_id, user_id)
    
    async def _reset_state_timer(self, document_id: str, user_id: str):
        """Reset the idle/away state timer."""
        
        timer_key = f"{document_id}:{user_id}"
        
        # Cancel existing timer
        if timer_key in self._state_timers:
            self._state_timers[timer_key].cancel()
        
        # Create new timer
        async def state_transition():
            await asyncio.sleep(self.IDLE_THRESHOLD)
            await self._transition_to_idle(document_id, user_id)
            
            await asyncio.sleep(self.AWAY_THRESHOLD - self.IDLE_THRESHOLD)
            await self._transition_to_away(document_id, user_id)
        
        self._state_timers[timer_key] = asyncio.create_task(state_transition())
    
    async def _transition_to_idle(self, document_id: str, user_id: str):
        """Transition user to idle state."""
        
        if document_id in self._presence_cache:
            if user_id in self._presence_cache[document_id]:
                presence = self._presence_cache[document_id][user_id]
                if presence.state == PresenceState.ACTIVE:
                    presence.state = PresenceState.IDLE
                    presence.typing = False
                    await self._broadcast_presence(document_id, presence)
    
    async def _transition_to_away(self, document_id: str, user_id: str):
        """Transition user to away state."""
        
        if document_id in self._presence_cache:
            if user_id in self._presence_cache[document_id]:
                presence = self._presence_cache[document_id][user_id]
                if presence.state in [PresenceState.ACTIVE, PresenceState.IDLE]:
                    presence.state = PresenceState.AWAY
                    presence.cursor = None  # Hide cursor when away
                    presence.selection = None
                    await self._broadcast_presence(document_id, presence)
    
    async def _broadcast_presence(self, document_id: str, presence: UserPresence):
        """Broadcast presence update to all viewers."""
        
        await self.pubsub.publish(
            channel=f"doc:{document_id}:presence",
            message={
                "type": "presence_update",
                "user_id": presence.user_id,
                "user_name": presence.user_name,
                "color": presence.color,
                "state": presence.state.value,
                "cursor": {
                    "offset": presence.cursor.offset,
                    "line": presence.cursor.line,
                    "column": presence.cursor.column
                } if presence.cursor else None,
                "selection": {
                    "start": {"offset": presence.selection.start.offset},
                    "end": {"offset": presence.selection.end.offset},
                    "direction": presence.selection.direction
                } if presence.selection else None,
                "current_element": presence.current_element,
                "typing": presence.typing,
                "timestamp": time.time()
            }
        )
```

---

## 1.7 Conflict Resolution Between Humans + Agents

```python
# ═══════════════════════════════════════════════════════════════════════════════
# HUMAN-AGENT CONFLICT RESOLUTION
# ═══════════════════════════════════════════════════════════════════════════════

"""
CONFLICT SCENARIOS

1. Simultaneous Edit Conflict
   Human and agent edit same content at same time
   Resolution: Human takes priority, agent rebases

2. Intent Conflict
   Human gives instruction that contradicts agent's current action
   Resolution: Agent pauses, asks for clarification

3. Resource Conflict
   Human and agent try to use same resource (file, API)
   Resolution: Queue with priority (human > agent)

4. Output Conflict
   Agent produces output while human is editing same area
   Resolution: Show diff, let human choose

PRIORITY HIERARCHY:
1. Human explicit action (always wins)
2. Human implicit preference (learned from history)
3. Agent action (yields to human)
4. System action (lowest priority)
"""

from dataclasses import dataclass
from typing import Optional, List, Dict, Union
from enum import Enum


class ConflictType(Enum):
    SIMULTANEOUS_EDIT = "simultaneous_edit"
    INTENT_CONFLICT = "intent_conflict"
    RESOURCE_CONFLICT = "resource_conflict"
    OUTPUT_CONFLICT = "output_conflict"


class ResolutionStrategy(Enum):
    HUMAN_WINS = "human_wins"
    AGENT_WINS = "agent_wins"
    MERGE = "merge"
    ASK_HUMAN = "ask_human"
    QUEUE = "queue"
    ABORT_AGENT = "abort_agent"


@dataclass
class Conflict:
    """Detected conflict between human and agent."""
    id: str
    conflict_type: ConflictType
    document_id: str
    
    # Parties involved
    human_id: str
    agent_id: str
    
    # Conflict details
    human_action: Dict
    agent_action: Dict
    overlap_region: Optional[Dict]  # For edit conflicts
    
    # Resolution
    suggested_resolution: ResolutionStrategy
    resolution_applied: Optional[ResolutionStrategy]
    resolved_at: Optional[float]
    resolved_by: Optional[str]


class HumanAgentConflictResolver:
    """
    Resolves conflicts between human and agent actions.
    
    Core Principle: Humans always have priority, but we try to preserve
    agent work when possible.
    """
    
    def __init__(self, db, ot_server, agent_controller):
        self.db = db
        self.ot_server = ot_server
        self.agent_controller = agent_controller
    
    async def detect_conflict(
        self,
        document_id: str,
        human_action: Dict,
        agent_action: Dict
    ) -> Optional[Conflict]:
        """
        Detect if human and agent actions conflict.
        
        Returns Conflict if detected, None otherwise.
        """
        
        # Check for simultaneous edit
        if self._is_edit_action(human_action) and self._is_edit_action(agent_action):
            overlap = self._compute_overlap(
                human_action.get("range"),
                agent_action.get("range")
            )
            
            if overlap:
                return Conflict(
                    id=str(uuid.uuid4()),
                    conflict_type=ConflictType.SIMULTANEOUS_EDIT,
                    document_id=document_id,
                    human_id=human_action["user_id"],
                    agent_id=agent_action["agent_id"],
                    human_action=human_action,
                    agent_action=agent_action,
                    overlap_region=overlap,
                    suggested_resolution=ResolutionStrategy.HUMAN_WINS
                )
        
        # Check for intent conflict
        if self._is_instruction(human_action):
            current_agent_intent = await self.agent_controller.get_current_intent(
                agent_action["agent_id"]
            )
            
            if self._intents_conflict(human_action.get("instruction"), current_agent_intent):
                return Conflict(
                    id=str(uuid.uuid4()),
                    conflict_type=ConflictType.INTENT_CONFLICT,
                    document_id=document_id,
                    human_id=human_action["user_id"],
                    agent_id=agent_action["agent_id"],
                    human_action=human_action,
                    agent_action=agent_action,
                    overlap_region=None,
                    suggested_resolution=ResolutionStrategy.ASK_HUMAN
                )
        
        return None
    
    async def resolve_conflict(
        self,
        conflict: Conflict,
        strategy: Optional[ResolutionStrategy] = None
    ) -> 'ResolutionResult':
        """
        Resolve a detected conflict.
        
        If strategy not provided, uses suggested_resolution.
        """
        
        strategy = strategy or conflict.suggested_resolution
        
        if strategy == ResolutionStrategy.HUMAN_WINS:
            return await self._resolve_human_wins(conflict)
        
        elif strategy == ResolutionStrategy.AGENT_WINS:
            return await self._resolve_agent_wins(conflict)
        
        elif strategy == ResolutionStrategy.MERGE:
            return await self._resolve_merge(conflict)
        
        elif strategy == ResolutionStrategy.ASK_HUMAN:
            return await self._resolve_ask_human(conflict)
        
        elif strategy == ResolutionStrategy.QUEUE:
            return await self._resolve_queue(conflict)
        
        elif strategy == ResolutionStrategy.ABORT_AGENT:
            return await self._resolve_abort_agent(conflict)
        
        raise ValueError(f"Unknown resolution strategy: {strategy}")
    
    async def _resolve_human_wins(self, conflict: Conflict) -> 'ResolutionResult':
        """
        Human action takes priority.
        
        Agent action is either:
        1. Rebased (transformed to apply after human action)
        2. Discarded (if incompatible)
        """
        
        # Apply human action first
        await self.ot_server.apply_operation(
            document_id=conflict.document_id,
            batch=self._action_to_batch(conflict.human_action)
        )
        
        # Try to rebase agent action
        try:
            rebased_action = self._rebase_action(
                conflict.agent_action,
                conflict.human_action
            )
            
            if rebased_action:
                # Queue rebased action for agent to review
                await self.agent_controller.queue_rebased_action(
                    agent_id=conflict.agent_id,
                    original_action=conflict.agent_action,
                    rebased_action=rebased_action,
                    reason="Rebased due to human edit"
                )
                
                return ResolutionResult(
                    success=True,
                    strategy=ResolutionStrategy.HUMAN_WINS,
                    human_action_applied=True,
                    agent_action_status="rebased",
                    message="Human edit applied. Agent action rebased for review."
                )
            
        except RebaseError:
            pass
        
        # Agent action discarded
        await self.agent_controller.notify_action_discarded(
            agent_id=conflict.agent_id,
            action=conflict.agent_action,
            reason="Conflicted with human edit"
        )
        
        return ResolutionResult(
            success=True,
            strategy=ResolutionStrategy.HUMAN_WINS,
            human_action_applied=True,
            agent_action_status="discarded",
            message="Human edit applied. Agent action discarded due to conflict."
        )
    
    async def _resolve_merge(self, conflict: Conflict) -> 'ResolutionResult':
        """
        Attempt to merge both actions.
        
        Only possible for non-overlapping or compatible changes.
        """
        
        if conflict.conflict_type != ConflictType.SIMULTANEOUS_EDIT:
            raise ValueError("Merge only supported for simultaneous edits")
        
        # Check if changes can be merged
        merge_result = self._try_merge_edits(
            conflict.human_action,
            conflict.agent_action
        )
        
        if merge_result.success:
            # Apply merged result
            await self.ot_server.apply_operation(
                document_id=conflict.document_id,
                batch=merge_result.merged_batch
            )
            
            return ResolutionResult(
                success=True,
                strategy=ResolutionStrategy.MERGE,
                human_action_applied=True,
                agent_action_status="merged",
                merged_content=merge_result.content,
                message="Both changes merged successfully."
            )
        
        # Merge failed - fall back to human wins
        return await self._resolve_human_wins(conflict)
    
    async def _resolve_ask_human(self, conflict: Conflict) -> 'ResolutionResult':
        """
        Pause agent and ask human for resolution.
        
        Used for intent conflicts where automatic resolution isn't clear.
        """
        
        # Pause agent
        await self.agent_controller.pause_agent(
            agent_id=conflict.agent_id,
            reason="Awaiting human resolution of conflict"
        )
        
        # Create resolution request
        request = await self.db.create_resolution_request(
            conflict_id=conflict.id,
            human_id=conflict.human_id,
            options=[
                {
                    "id": "continue_agent",
                    "label": "Continue with agent's approach",
                    "description": f"Agent will continue: {conflict.agent_action.get('description')}"
                },
                {
                    "id": "use_human_instruction",
                    "label": "Use my instruction instead",
                    "description": f"Agent will switch to: {conflict.human_action.get('instruction')}"
                },
                {
                    "id": "cancel_agent",
                    "label": "Cancel agent action",
                    "description": "Stop the agent and I'll handle it manually"
                }
            ]
        )
        
        return ResolutionResult(
            success=True,
            strategy=ResolutionStrategy.ASK_HUMAN,
            human_action_applied=False,
            agent_action_status="paused",
            pending_request_id=request.id,
            message="Agent paused. Please choose how to resolve the conflict."
        )
    
    async def handle_human_resolution_choice(
        self,
        request_id: str,
        choice: str,
        human_id: str
    ) -> 'ResolutionResult':
        """Handle human's choice for conflict resolution."""
        
        request = await self.db.get_resolution_request(request_id)
        conflict = await self.db.get_conflict(request.conflict_id)
        
        if choice == "continue_agent":
            # Resume agent with original intent
            await self.agent_controller.resume_agent(conflict.agent_id)
            
            return ResolutionResult(
                success=True,
                strategy=ResolutionStrategy.AGENT_WINS,
                message="Agent resumed with original approach."
            )
        
        elif choice == "use_human_instruction":
            # Update agent's intent
            await self.agent_controller.update_intent(
                agent_id=conflict.agent_id,
                new_intent=conflict.human_action.get("instruction")
            )
            await self.agent_controller.resume_agent(conflict.agent_id)
            
            return ResolutionResult(
                success=True,
                strategy=ResolutionStrategy.HUMAN_WINS,
                message="Agent updated to follow your instruction."
            )
        
        elif choice == "cancel_agent":
            # Stop agent
            await self.agent_controller.stop_agent(
                agent_id=conflict.agent_id,
                reason="Cancelled by user during conflict resolution"
            )
            
            return ResolutionResult(
                success=True,
                strategy=ResolutionStrategy.ABORT_AGENT,
                message="Agent stopped. You can continue manually."
            )
        
        raise ValueError(f"Unknown choice: {choice}")
```

---


# PART 2: EMAIL-TRIGGERED AGENT WORKFLOWS

## 2.1 Email Ingestion Pipeline Specification

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                         EMAIL INGESTION PIPELINE                                     │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Inbound   │    │  Security   │    │   Parser    │    │   Router    │          │
│  │   Gateway   │───▶│   Layer     │───▶│   Layer     │───▶│   Layer     │          │
│  │             │    │             │    │             │    │             │          │
│  │ • MX Record │    │ • SPF Check │    │ • MIME Parse│    │ • Address   │          │
│  │ • TLS Term  │    │ • DKIM Ver  │    │ • Encoding  │    │   Matching  │          │
│  │ • Rate Lim  │    │ • DMARC Pol │    │ • Attach Ex │    │ • Rule Eval │          │
│  │ • Size Lim  │    │ • Spam Scor │    │ • Thread ID │    │ • Agent Sel │          │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘          │
│         │                  │                  │                  │                  │
│         ▼                  ▼                  ▼                  ▼                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐          │
│  │   Reject    │    │  Quarantine │    │   Store     │    │   Queue     │          │
│  │   (Bounce)  │    │  (Review)   │    │   (S3)      │    │   (Task)    │          │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘          │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                           PROCESSING QUEUE                                    │   │
│  │                                                                               │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │   │
│  │  │ Dedup   │───▶│ Enrich  │───▶│ Context │───▶│ Agent   │───▶│ Reply   │    │   │
│  │  │ Check   │    │ Metadata│    │ Build   │    │ Execute │    │ Compose │    │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘    │   │
│  │                                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL INGESTION PIPELINE
# ═══════════════════════════════════════════════════════════════════════════════

from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum
import email
import hashlib
import re
from email.utils import parseaddr, parsedate_to_datetime


class EmailDisposition(Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    QUARANTINE = "quarantine"
    DEFER = "defer"


class SecurityCheckResult(Enum):
    PASS = "pass"
    FAIL = "fail"
    SOFTFAIL = "softfail"
    NEUTRAL = "neutral"
    NONE = "none"
    TEMPERROR = "temperror"
    PERMERROR = "permerror"


@dataclass
class EmailEnvelope:
    """SMTP envelope information."""
    mail_from: str
    rcpt_to: List[str]
    client_ip: str
    client_hostname: str
    helo_domain: str
    tls_version: Optional[str]
    tls_cipher: Optional[str]
    received_at: float


@dataclass
class SecurityResults:
    """Results of security checks."""
    spf: SecurityCheckResult
    spf_domain: Optional[str]
    dkim: SecurityCheckResult
    dkim_domain: Optional[str]
    dkim_selector: Optional[str]
    dmarc: SecurityCheckResult
    dmarc_policy: Optional[str]  # "none", "quarantine", "reject"
    spam_score: float  # 0-100
    spam_classification: str  # "ham", "spam", "probable_spam"
    threat_indicators: List[str]


@dataclass
class ParsedAttachment:
    """Parsed email attachment."""
    filename: str
    content_type: str
    size_bytes: int
    content_id: Optional[str]  # For inline attachments
    storage_key: str  # S3 key
    storage_url: str
    checksum: str
    is_inline: bool
    scan_result: str  # "clean", "infected", "unscannable"


@dataclass
class ParsedEmail:
    """Fully parsed email ready for processing."""
    id: str
    envelope: EmailEnvelope
    security: SecurityResults
    
    # Headers
    message_id: str
    subject: str
    from_address: str
    from_name: Optional[str]
    to_addresses: List[str]
    cc_addresses: List[str]
    reply_to: Optional[str]
    date: float
    
    # Threading
    in_reply_to: Optional[str]
    references: List[str]
    thread_id: str  # Computed thread identifier
    
    # Content
    text_body: Optional[str]
    html_body: Optional[str]
    attachments: List[ParsedAttachment]
    
    # Metadata
    raw_size_bytes: int
    raw_storage_key: str
    parsed_at: float
    
    # Routing
    matched_address: str  # Which configured address received this
    workspace_id: str
    agent_id: Optional[str]


class EmailIngestionPipeline:
    """
    Complete email ingestion pipeline.
    
    Stages:
    1. Receive: Accept SMTP connection, basic validation
    2. Security: SPF, DKIM, DMARC, spam scoring
    3. Parse: MIME parsing, attachment extraction
    4. Route: Match to workspace/agent
    5. Queue: Create task for agent processing
    """
    
    # Configuration
    MAX_EMAIL_SIZE = 25 * 1024 * 1024  # 25MB
    MAX_ATTACHMENTS = 50
    MAX_ATTACHMENT_SIZE = 20 * 1024 * 1024  # 20MB per attachment
    SPAM_THRESHOLD = 70  # Score above this is spam
    
    def __init__(
        self,
        db,
        storage,
        security_service,
        routing_service,
        task_queue,
        metrics
    ):
        self.db = db
        self.storage = storage
        self.security = security_service
        self.routing = routing_service
        self.queue = task_queue
        self.metrics = metrics
    
    async def process_inbound(
        self,
        envelope: EmailEnvelope,
        raw_data: bytes
    ) -> Tuple[EmailDisposition, Optional[str]]:
        """
        Process inbound email through full pipeline.
        
        Returns (disposition, reason/error message)
        """
        
        start_time = time.time()
        
        try:
            # ─────────────────────────────────────────────────────────────
            # STAGE 1: SIZE AND RATE LIMIT CHECK
            # ─────────────────────────────────────────────────────────────
            
            if len(raw_data) > self.MAX_EMAIL_SIZE:
                self.metrics.increment("email.rejected.size")
                return EmailDisposition.REJECT, f"552 Message too large ({len(raw_data)} bytes)"
            
            # Rate limit by sender domain
            sender_domain = self._extract_domain(envelope.mail_from)
            if await self._is_rate_limited(sender_domain):
                self.metrics.increment("email.deferred.rate_limit")
                return EmailDisposition.DEFER, "451 Too many messages, try again later"
            
            # ─────────────────────────────────────────────────────────────
            # STAGE 2: SECURITY CHECKS
            # ─────────────────────────────────────────────────────────────
            
            security_results = await self._perform_security_checks(envelope, raw_data)
            
            # Hard reject on DMARC reject policy with fail
            if (security_results.dmarc == SecurityCheckResult.FAIL and 
                security_results.dmarc_policy == "reject"):
                self.metrics.increment("email.rejected.dmarc")
                return EmailDisposition.REJECT, "550 DMARC policy violation"
            
            # Quarantine on high spam score
            if security_results.spam_score > self.SPAM_THRESHOLD:
                self.metrics.increment("email.quarantined.spam")
                await self._quarantine_email(envelope, raw_data, security_results)
                return EmailDisposition.QUARANTINE, "Quarantined due to spam score"
            
            # ─────────────────────────────────────────────────────────────
            # STAGE 3: PARSE EMAIL
            # ─────────────────────────────────────────────────────────────
            
            parsed = await self._parse_email(envelope, raw_data, security_results)
            
            # ─────────────────────────────────────────────────────────────
            # STAGE 4: ROUTE TO WORKSPACE/AGENT
            # ─────────────────────────────────────────────────────────────
            
            routing_result = await self.routing.route_email(parsed)
            
            if not routing_result.matched:
                self.metrics.increment("email.rejected.no_route")
                return EmailDisposition.REJECT, "550 No matching recipient"
            
            parsed.workspace_id = routing_result.workspace_id
            parsed.agent_id = routing_result.agent_id
            parsed.matched_address = routing_result.matched_address
            
            # ─────────────────────────────────────────────────────────────
            # STAGE 5: IDEMPOTENCY CHECK
            # ─────────────────────────────────────────────────────────────
            
            if await self._is_duplicate(parsed):
                self.metrics.increment("email.deduplicated")
                return EmailDisposition.ACCEPT, None  # Accept but don't process again
            
            # ─────────────────────────────────────────────────────────────
            # STAGE 6: STORE AND QUEUE
            # ─────────────────────────────────────────────────────────────
            
            await self._store_email(parsed)
            await self._queue_for_processing(parsed)
            
            self.metrics.increment("email.accepted")
            self.metrics.timing("email.pipeline_duration", time.time() - start_time)
            
            return EmailDisposition.ACCEPT, None
            
        except Exception as e:
            self.metrics.increment("email.error")
            logger.exception(f"Email processing error: {e}")
            return EmailDisposition.DEFER, f"451 Temporary processing error"
    
    async def _perform_security_checks(
        self,
        envelope: EmailEnvelope,
        raw_data: bytes
    ) -> SecurityResults:
        """Perform all security checks."""
        
        # SPF check
        spf_result, spf_domain = await self.security.check_spf(
            client_ip=envelope.client_ip,
            mail_from=envelope.mail_from,
            helo_domain=envelope.helo_domain
        )
        
        # DKIM check
        dkim_result, dkim_domain, dkim_selector = await self.security.check_dkim(raw_data)
        
        # DMARC check (depends on SPF and DKIM)
        dmarc_result, dmarc_policy = await self.security.check_dmarc(
            from_domain=self._extract_domain(envelope.mail_from),
            spf_result=spf_result,
            spf_domain=spf_domain,
            dkim_result=dkim_result,
            dkim_domain=dkim_domain
        )
        
        # Spam scoring
        spam_score, spam_class, threats = await self.security.score_spam(
            raw_data=raw_data,
            envelope=envelope,
            spf_result=spf_result,
            dkim_result=dkim_result
        )
        
        return SecurityResults(
            spf=spf_result,
            spf_domain=spf_domain,
            dkim=dkim_result,
            dkim_domain=dkim_domain,
            dkim_selector=dkim_selector,
            dmarc=dmarc_result,
            dmarc_policy=dmarc_policy,
            spam_score=spam_score,
            spam_classification=spam_class,
            threat_indicators=threats
        )
    
    async def _parse_email(
        self,
        envelope: EmailEnvelope,
        raw_data: bytes,
        security: SecurityResults
    ) -> ParsedEmail:
        """Parse raw email into structured format."""
        
        # Parse with email library
        msg = email.message_from_bytes(raw_data)
        
        # Extract headers
        message_id = msg.get("Message-ID", "").strip("<>")
        subject = self._decode_header(msg.get("Subject", ""))
        from_name, from_address = parseaddr(msg.get("From", ""))
        
        to_addresses = [
            parseaddr(addr)[1] 
            for addr in msg.get_all("To", [])
        ]
        cc_addresses = [
            parseaddr(addr)[1]
            for addr in msg.get_all("Cc", [])
        ]
        
        reply_to = None
        if msg.get("Reply-To"):
            reply_to = parseaddr(msg.get("Reply-To"))[1]
        
        # Parse date
        date_header = msg.get("Date")
        if date_header:
            try:
                date = parsedate_to_datetime(date_header).timestamp()
            except:
                date = time.time()
        else:
            date = time.time()
        
        # Threading headers
        in_reply_to = msg.get("In-Reply-To", "").strip("<>") or None
        references = [
            ref.strip("<>")
            for ref in msg.get("References", "").split()
        ]
        
        # Compute thread ID
        thread_id = self._compute_thread_id(message_id, in_reply_to, references, subject)
        
        # Extract body
        text_body, html_body = self._extract_body(msg)
        
        # Extract attachments
        attachments = await self._extract_attachments(msg)
        
        # Store raw email
        raw_key = f"emails/raw/{message_id}"
        await self.storage.put(raw_key, raw_data, "message/rfc822")
        
        return ParsedEmail(
            id=str(uuid.uuid4()),
            envelope=envelope,
            security=security,
            message_id=message_id,
            subject=subject,
            from_address=from_address,
            from_name=from_name,
            to_addresses=to_addresses,
            cc_addresses=cc_addresses,
            reply_to=reply_to,
            date=date,
            in_reply_to=in_reply_to,
            references=references,
            thread_id=thread_id,
            text_body=text_body,
            html_body=html_body,
            attachments=attachments,
            raw_size_bytes=len(raw_data),
            raw_storage_key=raw_key,
            parsed_at=time.time(),
            matched_address="",  # Set by router
            workspace_id="",  # Set by router
            agent_id=None  # Set by router
        )
    
    def _compute_thread_id(
        self,
        message_id: str,
        in_reply_to: Optional[str],
        references: List[str],
        subject: str
    ) -> str:
        """
        Compute thread ID for email threading.
        
        Algorithm:
        1. If references exist, use first reference (original message)
        2. Else if in_reply_to exists, use that
        3. Else use normalized subject hash
        """
        
        if references:
            return hashlib.sha256(references[0].encode()).hexdigest()[:16]
        
        if in_reply_to:
            return hashlib.sha256(in_reply_to.encode()).hexdigest()[:16]
        
        # Normalize subject (remove Re:, Fwd:, etc.)
        normalized = re.sub(r'^(Re|Fwd|Fw):\s*', '', subject, flags=re.IGNORECASE).strip()
        return hashlib.sha256(normalized.encode()).hexdigest()[:16]
```

---

## 2.2 Idempotency Model for Emails

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL IDEMPOTENCY MODEL
# ═══════════════════════════════════════════════════════════════════════════════

"""
IDEMPOTENCY GUARANTEES

Problem: Emails can be delivered multiple times due to:
1. SMTP retries (network issues)
2. Multiple MX records (load balancing)
3. Forwarding loops
4. User re-sending

Solution: Multi-layer deduplication

Layer 1: Message-ID based (exact duplicate)
Layer 2: Content hash based (same content, different Message-ID)
Layer 3: Semantic deduplication (similar intent within time window)
"""

from dataclasses import dataclass
from typing import Optional, Tuple
import hashlib


@dataclass
class IdempotencyKey:
    """Composite key for deduplication."""
    message_id_hash: str
    content_hash: str
    semantic_hash: str
    received_at: float


class EmailIdempotencyService:
    """
    Ensures emails are processed exactly once.
    
    Deduplication Layers:
    1. Message-ID: Exact RFC 5322 Message-ID match
    2. Content: Hash of normalized body + attachments
    3. Semantic: Hash of sender + subject + first N chars
    
    Time Windows:
    - Message-ID: 7 days (SMTP retry window)
    - Content: 24 hours (accidental re-send)
    - Semantic: 5 minutes (rapid re-send)
    """
    
    MESSAGE_ID_WINDOW = 7 * 24 * 3600  # 7 days
    CONTENT_WINDOW = 24 * 3600  # 24 hours
    SEMANTIC_WINDOW = 5 * 60  # 5 minutes
    
    def __init__(self, redis, db):
        self.redis = redis
        self.db = db
    
    async def check_and_record(
        self,
        email: 'ParsedEmail'
    ) -> Tuple[bool, Optional[str]]:
        """
        Check if email is duplicate and record if not.
        
        Returns (is_duplicate, duplicate_of_id)
        """
        
        keys = self._compute_keys(email)
        
        # Check Layer 1: Message-ID
        existing = await self._check_message_id(keys.message_id_hash)
        if existing:
            return True, existing
        
        # Check Layer 2: Content hash
        existing = await self._check_content_hash(keys.content_hash)
        if existing:
            return True, existing
        
        # Check Layer 3: Semantic hash (only within short window)
        existing = await self._check_semantic_hash(keys.semantic_hash)
        if existing:
            return True, existing
        
        # Not a duplicate - record all keys
        await self._record_keys(email.id, keys)
        
        return False, None
    
    def _compute_keys(self, email: 'ParsedEmail') -> IdempotencyKey:
        """Compute all idempotency keys for email."""
        
        # Layer 1: Message-ID hash
        message_id_hash = hashlib.sha256(
            email.message_id.encode()
        ).hexdigest()
        
        # Layer 2: Content hash
        content_parts = [
            email.from_address.lower(),
            self._normalize_body(email.text_body or email.html_body or ""),
            ",".join(sorted(a.checksum for a in email.attachments))
        ]
        content_hash = hashlib.sha256(
            "|".join(content_parts).encode()
        ).hexdigest()
        
        # Layer 3: Semantic hash
        semantic_parts = [
            email.from_address.lower(),
            self._normalize_subject(email.subject),
            (email.text_body or "")[:500]  # First 500 chars
        ]
        semantic_hash = hashlib.sha256(
            "|".join(semantic_parts).encode()
        ).hexdigest()
        
        return IdempotencyKey(
            message_id_hash=message_id_hash,
            content_hash=content_hash,
            semantic_hash=semantic_hash,
            received_at=time.time()
        )
    
    async def _check_message_id(self, hash: str) -> Optional[str]:
        """Check Message-ID dedup layer."""
        
        key = f"email:dedup:msgid:{hash}"
        existing = await self.redis.get(key)
        return existing.decode() if existing else None
    
    async def _check_content_hash(self, hash: str) -> Optional[str]:
        """Check content hash dedup layer."""
        
        key = f"email:dedup:content:{hash}"
        existing = await self.redis.get(key)
        return existing.decode() if existing else None
    
    async def _check_semantic_hash(self, hash: str) -> Optional[str]:
        """Check semantic hash dedup layer."""
        
        key = f"email:dedup:semantic:{hash}"
        existing = await self.redis.get(key)
        return existing.decode() if existing else None
    
    async def _record_keys(self, email_id: str, keys: IdempotencyKey):
        """Record all idempotency keys."""
        
        pipe = self.redis.pipeline()
        
        # Message-ID key (7 day TTL)
        pipe.setex(
            f"email:dedup:msgid:{keys.message_id_hash}",
            self.MESSAGE_ID_WINDOW,
            email_id
        )
        
        # Content hash key (24 hour TTL)
        pipe.setex(
            f"email:dedup:content:{keys.content_hash}",
            self.CONTENT_WINDOW,
            email_id
        )
        
        # Semantic hash key (5 minute TTL)
        pipe.setex(
            f"email:dedup:semantic:{keys.semantic_hash}",
            self.SEMANTIC_WINDOW,
            email_id
        )
        
        await pipe.execute()
        
        # Also persist to database for audit
        await self.db.insert_idempotency_record(
            email_id=email_id,
            message_id_hash=keys.message_id_hash,
            content_hash=keys.content_hash,
            semantic_hash=keys.semantic_hash,
            received_at=keys.received_at
        )
    
    def _normalize_body(self, body: str) -> str:
        """Normalize email body for hashing."""
        
        # Remove whitespace variations
        normalized = re.sub(r'\s+', ' ', body)
        # Remove common email footers
        normalized = re.sub(r'--\s*\n.*$', '', normalized, flags=re.DOTALL)
        # Remove quoted text
        normalized = re.sub(r'^>.*$', '', normalized, flags=re.MULTILINE)
        return normalized.strip().lower()
    
    def _normalize_subject(self, subject: str) -> str:
        """Normalize subject for semantic hashing."""
        
        # Remove Re:, Fwd:, etc.
        normalized = re.sub(r'^(Re|Fwd|Fw):\s*', '', subject, flags=re.IGNORECASE)
        # Remove ticket numbers, etc.
        normalized = re.sub(r'\[.*?\]', '', normalized)
        return normalized.strip().lower()
```

---

## 2.3 Attachment Parsing Rules

```python
# ═══════════════════════════════════════════════════════════════════════════════
# ATTACHMENT PARSING RULES
# ═══════════════════════════════════════════════════════════════════════════════

"""
ATTACHMENT HANDLING RULES

Allowed Types:
- Documents: pdf, doc, docx, xls, xlsx, ppt, pptx, txt, rtf, csv
- Images: jpg, jpeg, png, gif, webp, svg, bmp
- Archives: zip, tar, gz, 7z (scanned before extraction)
- Code: py, js, ts, json, xml, yaml, yml, md, html, css

Blocked Types:
- Executables: exe, dll, bat, cmd, sh, ps1, msi
- Scripts: vbs, js (standalone), jar
- Dangerous: scr, pif, application

Processing Rules:
1. Virus scan all attachments
2. Extract text from documents for context
3. OCR images if text detection enabled
4. Limit total attachment size per email
5. Store in S3 with signed URLs
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Tuple
from enum import Enum
import mimetypes
import magic


class AttachmentDisposition(Enum):
    ACCEPT = "accept"
    REJECT = "reject"
    QUARANTINE = "quarantine"


@dataclass
class AttachmentRule:
    """Rule for handling specific attachment types."""
    extensions: List[str]
    mime_types: List[str]
    disposition: AttachmentDisposition
    max_size: int  # bytes
    extract_text: bool
    ocr_enabled: bool
    scan_required: bool


class AttachmentParser:
    """
    Parses and validates email attachments.
    
    Security Measures:
    1. Extension validation
    2. MIME type validation
    3. Magic byte validation
    4. Virus scanning
    5. Size limits
    """
    
    # Attachment rules by category
    RULES = {
        "documents": AttachmentRule(
            extensions=["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "csv"],
            mime_types=[
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.*",
                "text/plain",
                "text/csv"
            ],
            disposition=AttachmentDisposition.ACCEPT,
            max_size=20 * 1024 * 1024,  # 20MB
            extract_text=True,
            ocr_enabled=False,
            scan_required=True
        ),
        "images": AttachmentRule(
            extensions=["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"],
            mime_types=["image/*"],
            disposition=AttachmentDisposition.ACCEPT,
            max_size=10 * 1024 * 1024,  # 10MB
            extract_text=False,
            ocr_enabled=True,
            scan_required=True
        ),
        "archives": AttachmentRule(
            extensions=["zip", "tar", "gz", "7z", "rar"],
            mime_types=[
                "application/zip",
                "application/x-tar",
                "application/gzip",
                "application/x-7z-compressed"
            ],
            disposition=AttachmentDisposition.ACCEPT,
            max_size=50 * 1024 * 1024,  # 50MB
            extract_text=False,
            ocr_enabled=False,
            scan_required=True  # Deep scan contents
        ),
        "code": AttachmentRule(
            extensions=["py", "js", "ts", "json", "xml", "yaml", "yml", "md", "html", "css"],
            mime_types=["text/*", "application/json", "application/xml"],
            disposition=AttachmentDisposition.ACCEPT,
            max_size=5 * 1024 * 1024,  # 5MB
            extract_text=True,
            ocr_enabled=False,
            scan_required=False
        ),
        "executables": AttachmentRule(
            extensions=["exe", "dll", "bat", "cmd", "sh", "ps1", "msi", "vbs", "jar", "scr", "pif"],
            mime_types=["application/x-executable", "application/x-msdos-program"],
            disposition=AttachmentDisposition.REJECT,
            max_size=0,
            extract_text=False,
            ocr_enabled=False,
            scan_required=False
        )
    }
    
    def __init__(self, storage, virus_scanner, text_extractor, ocr_service):
        self.storage = storage
        self.scanner = virus_scanner
        self.extractor = text_extractor
        self.ocr = ocr_service
    
    async def parse_attachments(
        self,
        email_msg,
        email_id: str
    ) -> List['ParsedAttachment']:
        """
        Parse all attachments from email message.
        
        Returns list of parsed attachments with storage URLs.
        """
        
        attachments = []
        attachment_index = 0
        total_size = 0
        
        for part in email_msg.walk():
            # Skip non-attachment parts
            if part.get_content_maintype() == 'multipart':
                continue
            
            content_disposition = part.get("Content-Disposition", "")
            
            # Check if it's an attachment or inline
            is_attachment = "attachment" in content_disposition
            is_inline = "inline" in content_disposition
            
            if not is_attachment and not is_inline:
                # Check if it's a named part (implicit attachment)
                if not part.get_filename():
                    continue
            
            # Parse attachment
            parsed = await self._parse_single_attachment(
                part=part,
                email_id=email_id,
                index=attachment_index,
                is_inline=is_inline
            )
            
            if parsed:
                total_size += parsed.size_bytes
                
                # Check total size limit
                if total_size > 100 * 1024 * 1024:  # 100MB total
                    break
                
                attachments.append(parsed)
                attachment_index += 1
            
            # Check attachment count limit
            if attachment_index >= 50:
                break
        
        return attachments
    
    async def _parse_single_attachment(
        self,
        part,
        email_id: str,
        index: int,
        is_inline: bool
    ) -> Optional['ParsedAttachment']:
        """Parse a single attachment part."""
        
        # Get filename
        filename = part.get_filename()
        if not filename:
            filename = f"attachment_{index}"
        
        # Decode filename if needed
        filename = self._decode_filename(filename)
        
        # Get content
        content = part.get_payload(decode=True)
        if not content:
            return None
        
        size = len(content)
        
        # Determine content type
        declared_type = part.get_content_type()
        detected_type = magic.from_buffer(content, mime=True)
        extension = self._get_extension(filename)
        
        # Find matching rule
        rule = self._find_rule(extension, declared_type, detected_type)
        
        if not rule:
            # Unknown type - quarantine
            rule = AttachmentRule(
                extensions=[],
                mime_types=[],
                disposition=AttachmentDisposition.QUARANTINE,
                max_size=5 * 1024 * 1024,
                extract_text=False,
                ocr_enabled=False,
                scan_required=True
            )
        
        # Check disposition
        if rule.disposition == AttachmentDisposition.REJECT:
            logger.warning(f"Rejected attachment: {filename} ({detected_type})")
            return None
        
        # Check size
        if size > rule.max_size:
            logger.warning(f"Attachment too large: {filename} ({size} bytes)")
            return None
        
        # Validate type consistency
        if not self._validate_type_consistency(declared_type, detected_type, extension):
            logger.warning(f"Type mismatch for {filename}: declared={declared_type}, detected={detected_type}")
            # Continue but flag it
        
        # Virus scan
        scan_result = "clean"
        if rule.scan_required:
            scan_result = await self.scanner.scan(content, filename)
            if scan_result == "infected":
                logger.warning(f"Infected attachment: {filename}")
                return None
        
        # Compute checksum
        checksum = hashlib.sha256(content).hexdigest()
        
        # Store in S3
        storage_key = f"emails/{email_id}/attachments/{index}_{self._safe_filename(filename)}"
        storage_url = await self.storage.put(storage_key, content, detected_type)
        
        # Extract text if enabled
        extracted_text = None
        if rule.extract_text:
            extracted_text = await self.extractor.extract(content, detected_type)
        
        # OCR if enabled and is image
        if rule.ocr_enabled and detected_type.startswith("image/"):
            ocr_text = await self.ocr.extract(content)
            if ocr_text:
                extracted_text = (extracted_text or "") + "\n" + ocr_text
        
        # Get content ID for inline attachments
        content_id = None
        if is_inline:
            content_id = part.get("Content-ID", "").strip("<>")
        
        return ParsedAttachment(
            filename=filename,
            content_type=detected_type,
            size_bytes=size,
            content_id=content_id,
            storage_key=storage_key,
            storage_url=storage_url,
            checksum=checksum,
            is_inline=is_inline,
            scan_result=scan_result,
            extracted_text=extracted_text
        )
    
    def _find_rule(
        self,
        extension: str,
        declared_type: str,
        detected_type: str
    ) -> Optional[AttachmentRule]:
        """Find matching rule for attachment."""
        
        for rule in self.RULES.values():
            # Check extension
            if extension.lower() in rule.extensions:
                return rule
            
            # Check MIME type
            for pattern in rule.mime_types:
                if pattern.endswith("*"):
                    if detected_type.startswith(pattern[:-1]):
                        return rule
                elif detected_type == pattern:
                    return rule
        
        return None
    
    def _validate_type_consistency(
        self,
        declared: str,
        detected: str,
        extension: str
    ) -> bool:
        """
        Validate that declared type, detected type, and extension are consistent.
        
        Prevents attacks like naming a .exe as .pdf.
        """
        
        # Get expected types for extension
        expected_type, _ = mimetypes.guess_type(f"file.{extension}")
        
        if expected_type:
            # Allow some flexibility (e.g., text/plain vs application/octet-stream)
            if detected.split("/")[0] != expected_type.split("/")[0]:
                return False
        
        return True
```

---

## 2.4 Thread → Task Mapping

```python
# ═══════════════════════════════════════════════════════════════════════════════
# THREAD TO TASK MAPPING
# ═══════════════════════════════════════════════════════════════════════════════

"""
THREAD-TASK MAPPING MODEL

Email threads map to agent tasks with these semantics:

1. New Thread → New Task
   - First email in thread creates new task
   - Task inherits thread subject as title
   - All subsequent emails in thread update same task

2. Reply → Task Update
   - Reply adds context to existing task
   - Agent can see full conversation history
   - May trigger re-evaluation of task

3. Forward → Task Reference
   - Forward creates reference to original task
   - New task with link to source

4. Thread Splitting
   - Subject change may split thread
   - Configurable behavior per workspace
"""

from dataclasses import dataclass
from typing import Optional, List, Dict
from enum import Enum


class ThreadAction(Enum):
    CREATE_TASK = "create_task"
    UPDATE_TASK = "update_task"
    REFERENCE_TASK = "reference_task"
    IGNORE = "ignore"


@dataclass
class ThreadMapping:
    """Mapping between email thread and task."""
    thread_id: str
    task_id: str
    workspace_id: str
    created_at: float
    last_email_at: float
    email_count: int
    status: str  # "active", "closed", "archived"


@dataclass
class TaskContext:
    """Context built from email thread for task."""
    task_id: str
    title: str
    description: str
    conversation_history: List[Dict]
    attachments: List[Dict]
    participants: List[str]
    priority: str
    labels: List[str]


class ThreadTaskMapper:
    """
    Maps email threads to agent tasks.
    
    Responsibilities:
    1. Determine if email starts new task or updates existing
    2. Build task context from thread history
    3. Handle thread splitting and merging
    4. Manage task lifecycle based on thread activity
    """
    
    def __init__(self, db, task_service):
        self.db = db
        self.tasks = task_service
    
    async def map_email_to_task(
        self,
        email: 'ParsedEmail'
    ) -> Tuple[ThreadAction, Optional[str]]:
        """
        Determine action for email and return task ID.
        
        Returns (action, task_id or None)
        """
        
        # Check for existing thread mapping
        existing_mapping = await self.db.get_thread_mapping(
            thread_id=email.thread_id,
            workspace_id=email.workspace_id
        )
        
        if existing_mapping:
            # Check if thread should be split
            if self._should_split_thread(email, existing_mapping):
                return await self._handle_thread_split(email, existing_mapping)
            
            # Check if task is still active
            task = await self.tasks.get_task(existing_mapping.task_id)
            
            if task.status in ["completed", "cancelled"]:
                # Reopen or create new?
                if self._should_reopen_task(email, task):
                    await self.tasks.reopen_task(task.id)
                    return ThreadAction.UPDATE_TASK, task.id
                else:
                    return await self._create_new_task(email)
            
            # Update existing task
            return ThreadAction.UPDATE_TASK, existing_mapping.task_id
        
        # Check if this is a forward
        if self._is_forward(email):
            return await self._handle_forward(email)
        
        # New thread - create new task
        return await self._create_new_task(email)
    
    async def _create_new_task(
        self,
        email: 'ParsedEmail'
    ) -> Tuple[ThreadAction, str]:
        """Create new task from email."""
        
        # Build initial context
        context = TaskContext(
            task_id="",  # Will be set
            title=self._extract_title(email.subject),
            description=self._build_description(email),
            conversation_history=[self._email_to_message(email)],
            attachments=[
                {"filename": a.filename, "url": a.storage_url, "type": a.content_type}
                for a in email.attachments
            ],
            participants=[email.from_address],
            priority=self._infer_priority(email),
            labels=self._extract_labels(email)
        )
        
        # Create task
        task = await self.tasks.create_task(
            workspace_id=email.workspace_id,
            agent_id=email.agent_id,
            title=context.title,
            description=context.description,
            context=context,
            source="email",
            source_id=email.id
        )
        
        context.task_id = task.id
        
        # Create thread mapping
        await self.db.create_thread_mapping(ThreadMapping(
            thread_id=email.thread_id,
            task_id=task.id,
            workspace_id=email.workspace_id,
            created_at=time.time(),
            last_email_at=email.date,
            email_count=1,
            status="active"
        ))
        
        return ThreadAction.CREATE_TASK, task.id
    
    async def update_task_with_email(
        self,
        task_id: str,
        email: 'ParsedEmail'
    ):
        """Update existing task with new email."""
        
        task = await self.tasks.get_task(task_id)
        
        # Add email to conversation history
        message = self._email_to_message(email)
        task.context.conversation_history.append(message)
        
        # Add new attachments
        for attachment in email.attachments:
            task.context.attachments.append({
                "filename": attachment.filename,
                "url": attachment.storage_url,
                "type": attachment.content_type
            })
        
        # Add new participants
        if email.from_address not in task.context.participants:
            task.context.participants.append(email.from_address)
        
        # Update task
        await self.tasks.update_task(task_id, {
            "context": task.context,
            "updated_at": time.time()
        })
        
        # Update thread mapping
        await self.db.update_thread_mapping(
            thread_id=email.thread_id,
            updates={
                "last_email_at": email.date,
                "email_count": task.context.conversation_history.length
            }
        )
        
        # Notify agent of new context
        await self.tasks.notify_context_update(task_id, {
            "type": "new_email",
            "email_id": email.id,
            "from": email.from_address,
            "subject": email.subject,
            "has_attachments": len(email.attachments) > 0
        })
    
    def _should_split_thread(
        self,
        email: 'ParsedEmail',
        mapping: ThreadMapping
    ) -> bool:
        """
        Determine if email should split into new thread.
        
        Conditions:
        1. Subject significantly changed (not just Re:/Fwd:)
        2. Long time gap (> 7 days)
        3. Different sender domain (possible forward)
        """
        
        # Check time gap
        time_gap = email.date - mapping.last_email_at
        if time_gap > 7 * 24 * 3600:  # 7 days
            return True
        
        # Check subject change
        # (would need to compare with original subject)
        
        return False
    
    def _email_to_message(self, email: 'ParsedEmail') -> Dict:
        """Convert email to conversation message format."""
        
        return {
            "id": email.id,
            "type": "email",
            "from": {
                "address": email.from_address,
                "name": email.from_name
            },
            "subject": email.subject,
            "body": email.text_body or self._html_to_text(email.html_body),
            "timestamp": email.date,
            "attachments": [
                {"filename": a.filename, "url": a.storage_url}
                for a in email.attachments
            ]
        }
    
    def _infer_priority(self, email: 'ParsedEmail') -> str:
        """Infer task priority from email."""
        
        subject_lower = email.subject.lower()
        
        if any(word in subject_lower for word in ["urgent", "asap", "critical", "emergency"]):
            return "high"
        
        if any(word in subject_lower for word in ["fyi", "low priority", "when you have time"]):
            return "low"
        
        # Check X-Priority header
        # 1-2 = high, 3 = normal, 4-5 = low
        
        return "normal"
    
    def _extract_labels(self, email: 'ParsedEmail') -> List[str]:
        """Extract labels/tags from email."""
        
        labels = []
        
        # Check for [tags] in subject
        import re
        tags = re.findall(r'\[([^\]]+)\]', email.subject)
        labels.extend(tags)
        
        # Check for #hashtags in body
        if email.text_body:
            hashtags = re.findall(r'#(\w+)', email.text_body)
            labels.extend(hashtags)
        
        return list(set(labels))
```

---

## 2.5 Reply Semantics

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL REPLY SEMANTICS
# ═══════════════════════════════════════════════════════════════════════════════

"""
REPLY BEHAVIOR MODEL

When agent completes a task triggered by email, it can:
1. Reply to sender
2. Reply-all (include CC)
3. Forward to others
4. No reply (silent completion)

Reply Content:
- Generated by agent based on task result
- Follows configured templates
- Includes relevant attachments
- Maintains thread continuity

Reply Timing:
- Immediate (task complete)
- Scheduled (batch replies)
- Conditional (only on certain outcomes)
"""

from dataclasses import dataclass
from typing import Optional, List, Dict
from enum import Enum


class ReplyMode(Enum):
    REPLY = "reply"           # Reply to sender only
    REPLY_ALL = "reply_all"   # Reply to all recipients
    FORWARD = "forward"       # Forward to specified addresses
    NONE = "none"             # No reply


class ReplyTiming(Enum):
    IMMEDIATE = "immediate"   # Send as soon as task completes
    BATCHED = "batched"       # Batch with other replies
    SCHEDULED = "scheduled"   # Send at specific time
    MANUAL = "manual"         # Require human approval


@dataclass
class ReplyConfig:
    """Configuration for email replies."""
    mode: ReplyMode
    timing: ReplyTiming
    include_attachments: bool
    include_task_link: bool
    template_id: Optional[str]
    cc_addresses: List[str]
    bcc_addresses: List[str]
    signature_id: Optional[str]


@dataclass
class ComposedReply:
    """Composed reply ready to send."""
    to_addresses: List[str]
    cc_addresses: List[str]
    bcc_addresses: List[str]
    subject: str
    text_body: str
    html_body: Optional[str]
    attachments: List[Dict]
    in_reply_to: str
    references: List[str]
    headers: Dict[str, str]


class EmailReplyService:
    """
    Manages email replies from agent tasks.
    
    Responsibilities:
    1. Determine reply recipients
    2. Compose reply content
    3. Maintain threading headers
    4. Handle reply scheduling
    5. Track delivery status
    """
    
    def __init__(self, db, template_engine, smtp_client, task_service):
        self.db = db
        self.templates = template_engine
        self.smtp = smtp_client
        self.tasks = task_service
    
    async def compose_reply(
        self,
        task_id: str,
        original_email: 'ParsedEmail',
        agent_response: str,
        config: ReplyConfig
    ) -> ComposedReply:
        """
        Compose reply email from agent response.
        
        Handles:
        - Recipient determination
        - Subject formatting
        - Body composition with template
        - Threading headers
        - Attachment inclusion
        """
        
        # Determine recipients
        to_addresses, cc_addresses = self._determine_recipients(
            original_email, config
        )
        
        # Format subject
        subject = self._format_reply_subject(original_email.subject)
        
        # Compose body
        text_body, html_body = await self._compose_body(
            agent_response=agent_response,
            original_email=original_email,
            task_id=task_id,
            config=config
        )
        
        # Prepare attachments
        attachments = []
        if config.include_attachments:
            task = await self.tasks.get_task(task_id)
            attachments = await self._prepare_attachments(task)
        
        # Build threading headers
        references = list(original_email.references)
        references.append(original_email.message_id)
        
        return ComposedReply(
            to_addresses=to_addresses,
            cc_addresses=cc_addresses + config.cc_addresses,
            bcc_addresses=config.bcc_addresses,
            subject=subject,
            text_body=text_body,
            html_body=html_body,
            attachments=attachments,
            in_reply_to=original_email.message_id,
            references=references,
            headers={
                "X-Manus-Task-ID": task_id,
                "X-Manus-Reply-Type": config.mode.value
            }
        )
    
    async def send_reply(
        self,
        reply: ComposedReply,
        config: ReplyConfig
    ) -> 'SendResult':
        """
        Send composed reply based on timing config.
        
        Returns send result with message ID and status.
        """
        
        if config.timing == ReplyTiming.IMMEDIATE:
            return await self._send_immediate(reply)
        
        elif config.timing == ReplyTiming.BATCHED:
            return await self._queue_for_batch(reply)
        
        elif config.timing == ReplyTiming.SCHEDULED:
            return await self._schedule_send(reply, config)
        
        elif config.timing == ReplyTiming.MANUAL:
            return await self._queue_for_approval(reply)
    
    async def _send_immediate(self, reply: ComposedReply) -> 'SendResult':
        """Send reply immediately."""
        
        # Build MIME message
        msg = self._build_mime_message(reply)
        
        # Send via SMTP
        try:
            result = await self.smtp.send(
                from_addr=self._get_from_address(reply),
                to_addrs=reply.to_addresses + reply.cc_addresses + reply.bcc_addresses,
                message=msg
            )
            
            # Record sent message
            await self.db.record_sent_email(
                message_id=result.message_id,
                reply=reply,
                sent_at=time.time(),
                status="sent"
            )
            
            return SendResult(
                success=True,
                message_id=result.message_id,
                status="sent"
            )
            
        except SMTPError as e:
            # Handle send failure
            await self.db.record_sent_email(
                message_id=None,
                reply=reply,
                sent_at=time.time(),
                status="failed",
                error=str(e)
            )
            
            return SendResult(
                success=False,
                message_id=None,
                status="failed",
                error=str(e)
            )
    
    def _determine_recipients(
        self,
        original: 'ParsedEmail',
        config: ReplyConfig
    ) -> Tuple[List[str], List[str]]:
        """Determine To and CC recipients."""
        
        if config.mode == ReplyMode.REPLY:
            # Reply to sender only
            to = [original.reply_to or original.from_address]
            cc = []
        
        elif config.mode == ReplyMode.REPLY_ALL:
            # Reply to sender and all recipients
            to = [original.reply_to or original.from_address]
            cc = list(set(original.to_addresses + original.cc_addresses))
            # Remove our own address
            cc = [addr for addr in cc if not self._is_our_address(addr)]
        
        elif config.mode == ReplyMode.FORWARD:
            # Forward to configured addresses
            to = config.cc_addresses
            cc = []
        
        else:
            to = []
            cc = []
        
        return to, cc
    
    def _format_reply_subject(self, original_subject: str) -> str:
        """Format reply subject line."""
        
        # Check if already has Re:
        if original_subject.lower().startswith("re:"):
            return original_subject
        
        return f"Re: {original_subject}"
    
    async def _compose_body(
        self,
        agent_response: str,
        original_email: 'ParsedEmail',
        task_id: str,
        config: ReplyConfig
    ) -> Tuple[str, Optional[str]]:
        """Compose reply body with template."""
        
        # Get template
        template = None
        if config.template_id:
            template = await self.templates.get(config.template_id)
        
        # Get signature
        signature = ""
        if config.signature_id:
            sig = await self.db.get_signature(config.signature_id)
            signature = sig.content
        
        # Build context
        context = {
            "response": agent_response,
            "original_sender": original_email.from_name or original_email.from_address,
            "original_subject": original_email.subject,
            "original_date": datetime.fromtimestamp(original_email.date).strftime("%Y-%m-%d %H:%M"),
            "task_id": task_id,
            "signature": signature
        }
        
        # Add task link if configured
        if config.include_task_link:
            context["task_link"] = f"https://app.manus.im/tasks/{task_id}"
        
        # Render template or use default
        if template:
            text_body = await self.templates.render(template.text_template, context)
            html_body = await self.templates.render(template.html_template, context) if template.html_template else None
        else:
            text_body = self._default_reply_template(context, original_email)
            html_body = None
        
        return text_body, html_body
    
    def _default_reply_template(
        self,
        context: Dict,
        original: 'ParsedEmail'
    ) -> str:
        """Default reply template."""
        
        body = context["response"]
        
        if context.get("task_link"):
            body += f"\n\n---\nTask details: {context['task_link']}"
        
        if context.get("signature"):
            body += f"\n\n{context['signature']}"
        
        # Add quoted original
        body += f"\n\n---\nOn {context['original_date']}, {context['original_sender']} wrote:\n"
        
        original_text = original.text_body or ""
        quoted = "\n".join(f"> {line}" for line in original_text.split("\n"))
        body += quoted
        
        return body
```

---

## 2.6 Security Model (Spoofing, DKIM, DMARC)

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL SECURITY MODEL
# ═══════════════════════════════════════════════════════════════════════════════

"""
EMAIL SECURITY LAYERS

1. SPF (Sender Policy Framework)
   - Validates sending server IP against DNS records
   - Prevents unauthorized servers from sending as domain

2. DKIM (DomainKeys Identified Mail)
   - Cryptographic signature on email headers/body
   - Proves email wasn't modified in transit

3. DMARC (Domain-based Message Authentication)
   - Policy layer on top of SPF and DKIM
   - Tells receivers what to do with failures

4. Additional Protections
   - Spam scoring
   - Phishing detection
   - Attachment scanning
   - Rate limiting
"""

from dataclasses import dataclass
from typing import Optional, Tuple, List
from enum import Enum
import dns.resolver
import dkim
import spf


class EmailSecurityService:
    """
    Comprehensive email security validation.
    
    Validates:
    - SPF alignment
    - DKIM signatures
    - DMARC policy compliance
    - Spam indicators
    - Phishing patterns
    """
    
    def __init__(self, dns_resolver, spam_classifier, threat_intel):
        self.dns = dns_resolver
        self.spam = spam_classifier
        self.threats = threat_intel
    
    async def check_spf(
        self,
        client_ip: str,
        mail_from: str,
        helo_domain: str
    ) -> Tuple[SecurityCheckResult, Optional[str]]:
        """
        Validate SPF record.
        
        SPF checks if the sending IP is authorized to send for the domain.
        
        Returns (result, authenticated_domain)
        """
        
        domain = self._extract_domain(mail_from)
        
        try:
            # Query SPF record
            result, explanation = spf.check2(
                i=client_ip,
                s=mail_from,
                h=helo_domain
            )
            
            result_map = {
                "pass": SecurityCheckResult.PASS,
                "fail": SecurityCheckResult.FAIL,
                "softfail": SecurityCheckResult.SOFTFAIL,
                "neutral": SecurityCheckResult.NEUTRAL,
                "none": SecurityCheckResult.NONE,
                "temperror": SecurityCheckResult.TEMPERROR,
                "permerror": SecurityCheckResult.PERMERROR
            }
            
            return result_map.get(result, SecurityCheckResult.NONE), domain
            
        except Exception as e:
            logger.error(f"SPF check error: {e}")
            return SecurityCheckResult.TEMPERROR, None
    
    async def check_dkim(
        self,
        raw_email: bytes
    ) -> Tuple[SecurityCheckResult, Optional[str], Optional[str]]:
        """
        Validate DKIM signature.
        
        DKIM uses public key cryptography to verify email authenticity.
        
        Returns (result, signing_domain, selector)
        """
        
        try:
            # Verify DKIM signature
            result = dkim.verify(raw_email)
            
            if result:
                # Extract signing domain and selector from headers
                signing_domain, selector = self._extract_dkim_info(raw_email)
                return SecurityCheckResult.PASS, signing_domain, selector
            else:
                return SecurityCheckResult.FAIL, None, None
                
        except dkim.DKIMException as e:
            logger.error(f"DKIM verification error: {e}")
            return SecurityCheckResult.TEMPERROR, None, None
        except Exception as e:
            # No DKIM signature present
            return SecurityCheckResult.NONE, None, None
    
    async def check_dmarc(
        self,
        from_domain: str,
        spf_result: SecurityCheckResult,
        spf_domain: Optional[str],
        dkim_result: SecurityCheckResult,
        dkim_domain: Optional[str]
    ) -> Tuple[SecurityCheckResult, Optional[str]]:
        """
        Evaluate DMARC policy.
        
        DMARC requires either SPF or DKIM to pass AND align with From domain.
        
        Returns (result, policy)
        """
        
        try:
            # Query DMARC record
            dmarc_record = await self._query_dmarc(from_domain)
            
            if not dmarc_record:
                return SecurityCheckResult.NONE, None
            
            # Parse DMARC policy
            policy = self._parse_dmarc_policy(dmarc_record)
            
            # Check alignment
            spf_aligned = (
                spf_result == SecurityCheckResult.PASS and
                self._domains_align(spf_domain, from_domain, policy.get("aspf", "r"))
            )
            
            dkim_aligned = (
                dkim_result == SecurityCheckResult.PASS and
                self._domains_align(dkim_domain, from_domain, policy.get("adkim", "r"))
            )
            
            # DMARC passes if either SPF or DKIM is aligned
            if spf_aligned or dkim_aligned:
                return SecurityCheckResult.PASS, policy.get("p", "none")
            else:
                return SecurityCheckResult.FAIL, policy.get("p", "none")
                
        except Exception as e:
            logger.error(f"DMARC check error: {e}")
            return SecurityCheckResult.TEMPERROR, None
    
    async def _query_dmarc(self, domain: str) -> Optional[str]:
        """Query DMARC DNS record."""
        
        try:
            # DMARC records are at _dmarc.domain.com
            answers = await self.dns.resolve(f"_dmarc.{domain}", "TXT")
            
            for rdata in answers:
                txt = rdata.to_text().strip('"')
                if txt.startswith("v=DMARC1"):
                    return txt
            
            return None
            
        except dns.resolver.NXDOMAIN:
            return None
        except Exception as e:
            logger.error(f"DMARC DNS query error: {e}")
            return None
    
    def _parse_dmarc_policy(self, record: str) -> Dict:
        """Parse DMARC record into policy dict."""
        
        policy = {}
        parts = record.split(";")
        
        for part in parts:
            part = part.strip()
            if "=" in part:
                key, value = part.split("=", 1)
                policy[key.strip()] = value.strip()
        
        return policy
    
    def _domains_align(
        self,
        authenticated_domain: Optional[str],
        from_domain: str,
        alignment_mode: str
    ) -> bool:
        """
        Check if domains align per DMARC rules.
        
        Alignment modes:
        - "s" (strict): Exact match required
        - "r" (relaxed): Organizational domain match
        """
        
        if not authenticated_domain:
            return False
        
        if alignment_mode == "s":
            # Strict: exact match
            return authenticated_domain.lower() == from_domain.lower()
        else:
            # Relaxed: organizational domain match
            auth_org = self._get_org_domain(authenticated_domain)
            from_org = self._get_org_domain(from_domain)
            return auth_org.lower() == from_org.lower()
    
    def _get_org_domain(self, domain: str) -> str:
        """
        Get organizational domain (registered domain).
        
        e.g., mail.example.com -> example.com
        """
        
        # Simple implementation - would use public suffix list in production
        parts = domain.split(".")
        if len(parts) >= 2:
            return ".".join(parts[-2:])
        return domain
    
    async def score_spam(
        self,
        raw_data: bytes,
        envelope: 'EmailEnvelope',
        spf_result: SecurityCheckResult,
        dkim_result: SecurityCheckResult
    ) -> Tuple[float, str, List[str]]:
        """
        Calculate spam score for email.
        
        Returns (score 0-100, classification, threat_indicators)
        """
        
        score = 0.0
        indicators = []
        
        # Authentication failures
        if spf_result == SecurityCheckResult.FAIL:
            score += 20
            indicators.append("spf_fail")
        elif spf_result == SecurityCheckResult.SOFTFAIL:
            score += 10
            indicators.append("spf_softfail")
        
        if dkim_result == SecurityCheckResult.FAIL:
            score += 15
            indicators.append("dkim_fail")
        elif dkim_result == SecurityCheckResult.NONE:
            score += 5
            indicators.append("no_dkim")
        
        # IP reputation
        ip_reputation = await self.threats.check_ip(envelope.client_ip)
        if ip_reputation == "blacklisted":
            score += 40
            indicators.append("ip_blacklisted")
        elif ip_reputation == "suspicious":
            score += 20
            indicators.append("ip_suspicious")
        
        # Content analysis
        content_score, content_indicators = await self.spam.analyze(raw_data)
        score += content_score
        indicators.extend(content_indicators)
        
        # Classify
        if score >= 70:
            classification = "spam"
        elif score >= 40:
            classification = "probable_spam"
        else:
            classification = "ham"
        
        return min(score, 100), classification, indicators
```

---

## 2.7 Retry Semantics for Email Delivery

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL DELIVERY RETRY SEMANTICS
# ═══════════════════════════════════════════════════════════════════════════════

"""
RETRY STRATEGY

Outbound email delivery uses exponential backoff with jitter:

Attempt 1: Immediate
Attempt 2: 1 minute
Attempt 3: 5 minutes
Attempt 4: 15 minutes
Attempt 5: 1 hour
Attempt 6: 4 hours
Attempt 7: 12 hours
Attempt 8: 24 hours (final)

Retry Conditions:
- 4xx errors: Retry (temporary failure)
- 5xx errors: Depends on specific code
- Network errors: Retry
- Timeout: Retry

Non-Retryable:
- 550 User unknown
- 552 Message too large
- 554 Transaction failed (permanent)
"""

from dataclasses import dataclass
from typing import Optional, List
from enum import Enum
import random


class DeliveryStatus(Enum):
    PENDING = "pending"
    SENDING = "sending"
    SENT = "sent"
    DEFERRED = "deferred"
    BOUNCED = "bounced"
    FAILED = "failed"


class BounceType(Enum):
    HARD = "hard"      # Permanent failure
    SOFT = "soft"      # Temporary failure
    BLOCK = "block"    # Blocked by recipient


@dataclass
class DeliveryAttempt:
    """Record of a delivery attempt."""
    attempt_number: int
    timestamp: float
    status: DeliveryStatus
    smtp_code: Optional[int]
    smtp_message: Optional[str]
    mx_host: Optional[str]
    duration_ms: int


@dataclass
class DeliveryJob:
    """Email delivery job with retry state."""
    id: str
    message_id: str
    recipient: str
    status: DeliveryStatus
    attempts: List[DeliveryAttempt]
    next_attempt_at: Optional[float]
    created_at: float
    expires_at: float  # After this, give up


class EmailDeliveryService:
    """
    Manages email delivery with retry logic.
    
    Features:
    - Exponential backoff with jitter
    - Per-recipient tracking
    - Bounce handling
    - Delivery notifications
    """
    
    # Retry schedule (seconds)
    RETRY_DELAYS = [
        0,      # Immediate
        60,     # 1 minute
        300,    # 5 minutes
        900,    # 15 minutes
        3600,   # 1 hour
        14400,  # 4 hours
        43200,  # 12 hours
        86400   # 24 hours
    ]
    
    MAX_ATTEMPTS = 8
    DELIVERY_TIMEOUT = 7 * 24 * 3600  # 7 days
    
    # Non-retryable SMTP codes
    PERMANENT_FAILURES = {
        550,  # User unknown
        551,  # User not local
        552,  # Message too large
        553,  # Mailbox name invalid
        554,  # Transaction failed
    }
    
    def __init__(self, db, smtp_pool, queue, metrics):
        self.db = db
        self.smtp = smtp_pool
        self.queue = queue
        self.metrics = metrics
    
    async def queue_delivery(
        self,
        message_id: str,
        recipients: List[str],
        message_data: bytes
    ) -> List[DeliveryJob]:
        """
        Queue message for delivery to all recipients.
        
        Creates separate job per recipient for independent retry.
        """
        
        jobs = []
        now = time.time()
        
        for recipient in recipients:
            job = DeliveryJob(
                id=str(uuid.uuid4()),
                message_id=message_id,
                recipient=recipient,
                status=DeliveryStatus.PENDING,
                attempts=[],
                next_attempt_at=now,
                created_at=now,
                expires_at=now + self.DELIVERY_TIMEOUT
            )
            
            await self.db.create_delivery_job(job)
            await self.queue.enqueue("email_delivery", job.id, delay=0)
            
            jobs.append(job)
        
        return jobs
    
    async def process_delivery(self, job_id: str):
        """
        Process a delivery job (called by queue worker).
        
        Attempts delivery and schedules retry if needed.
        """
        
        job = await self.db.get_delivery_job(job_id)
        
        if not job:
            return
        
        # Check if expired
        if time.time() > job.expires_at:
            await self._mark_failed(job, "Delivery timeout exceeded")
            return
        
        # Check attempt limit
        if len(job.attempts) >= self.MAX_ATTEMPTS:
            await self._mark_failed(job, "Maximum attempts exceeded")
            return
        
        # Attempt delivery
        job.status = DeliveryStatus.SENDING
        await self.db.update_delivery_job(job)
        
        attempt = await self._attempt_delivery(job)
        job.attempts.append(attempt)
        
        if attempt.status == DeliveryStatus.SENT:
            # Success!
            job.status = DeliveryStatus.SENT
            job.next_attempt_at = None
            await self.db.update_delivery_job(job)
            await self._notify_delivery_success(job)
            self.metrics.increment("email.delivered")
            
        elif self._should_retry(attempt):
            # Schedule retry
            delay = self._calculate_retry_delay(len(job.attempts))
            job.status = DeliveryStatus.DEFERRED
            job.next_attempt_at = time.time() + delay
            await self.db.update_delivery_job(job)
            await self.queue.enqueue("email_delivery", job.id, delay=delay)
            self.metrics.increment("email.deferred")
            
        else:
            # Permanent failure
            await self._handle_bounce(job, attempt)
            self.metrics.increment("email.bounced")
    
    async def _attempt_delivery(self, job: DeliveryJob) -> DeliveryAttempt:
        """Attempt to deliver email."""
        
        attempt_num = len(job.attempts) + 1
        start_time = time.time()
        
        try:
            # Get message data
            message = await self.db.get_message_data(job.message_id)
            
            # Resolve MX records
            mx_host = await self._resolve_mx(job.recipient)
            
            # Connect and send
            result = await self.smtp.send_to_mx(
                mx_host=mx_host,
                recipient=job.recipient,
                message=message,
                timeout=30
            )
            
            duration = int((time.time() - start_time) * 1000)
            
            return DeliveryAttempt(
                attempt_number=attempt_num,
                timestamp=time.time(),
                status=DeliveryStatus.SENT,
                smtp_code=result.code,
                smtp_message=result.message,
                mx_host=mx_host,
                duration_ms=duration
            )
            
        except SMTPResponseError as e:
            duration = int((time.time() - start_time) * 1000)
            
            return DeliveryAttempt(
                attempt_number=attempt_num,
                timestamp=time.time(),
                status=DeliveryStatus.DEFERRED if e.code < 500 else DeliveryStatus.BOUNCED,
                smtp_code=e.code,
                smtp_message=e.message,
                mx_host=mx_host if 'mx_host' in locals() else None,
                duration_ms=duration
            )
            
        except Exception as e:
            duration = int((time.time() - start_time) * 1000)
            
            return DeliveryAttempt(
                attempt_number=attempt_num,
                timestamp=time.time(),
                status=DeliveryStatus.DEFERRED,
                smtp_code=None,
                smtp_message=str(e),
                mx_host=mx_host if 'mx_host' in locals() else None,
                duration_ms=duration
            )
    
    def _should_retry(self, attempt: DeliveryAttempt) -> bool:
        """Determine if delivery should be retried."""
        
        # Network/timeout errors - always retry
        if attempt.smtp_code is None:
            return True
        
        # 4xx - temporary failure, retry
        if 400 <= attempt.smtp_code < 500:
            return True
        
        # 5xx - check if permanent
        if attempt.smtp_code in self.PERMANENT_FAILURES:
            return False
        
        # Other 5xx - might be temporary, retry a few times
        return attempt.attempt_number < 3
    
    def _calculate_retry_delay(self, attempt_count: int) -> float:
        """
        Calculate delay before next retry.
        
        Uses exponential backoff with jitter.
        """
        
        if attempt_count >= len(self.RETRY_DELAYS):
            base_delay = self.RETRY_DELAYS[-1]
        else:
            base_delay = self.RETRY_DELAYS[attempt_count]
        
        # Add jitter (±20%)
        jitter = base_delay * 0.2 * (random.random() * 2 - 1)
        
        return base_delay + jitter
    
    async def _handle_bounce(self, job: DeliveryJob, attempt: DeliveryAttempt):
        """Handle bounced email."""
        
        # Determine bounce type
        if attempt.smtp_code in [550, 551, 553]:
            bounce_type = BounceType.HARD
        elif attempt.smtp_code == 552:
            bounce_type = BounceType.SOFT
        else:
            bounce_type = BounceType.BLOCK
        
        job.status = DeliveryStatus.BOUNCED
        job.next_attempt_at = None
        await self.db.update_delivery_job(job)
        
        # Record bounce
        await self.db.record_bounce(
            recipient=job.recipient,
            bounce_type=bounce_type,
            smtp_code=attempt.smtp_code,
            smtp_message=attempt.smtp_message,
            timestamp=time.time()
        )
        
        # Notify sender
        await self._notify_bounce(job, bounce_type)
        
        # Update recipient reputation
        if bounce_type == BounceType.HARD:
            await self._mark_invalid_recipient(job.recipient)
```

---

## 2.8 Rate Limits & Abuse Prevention

```python
# ═══════════════════════════════════════════════════════════════════════════════
# EMAIL RATE LIMITS & ABUSE PREVENTION
# ═══════════════════════════════════════════════════════════════════════════════

"""
RATE LIMITING STRATEGY

Inbound Limits:
- Per sender domain: 100 emails/hour
- Per sender address: 20 emails/hour
- Per recipient: 500 emails/hour
- Global: 10,000 emails/hour

Outbound Limits:
- Per workspace: 1,000 emails/day
- Per agent: 100 emails/hour
- Per recipient domain: 50 emails/hour
- Global: 50,000 emails/day

Abuse Prevention:
- Reputation tracking per sender
- Automatic blocking of spam sources
- Content-based throttling
- Feedback loop processing
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple
from enum import Enum


class RateLimitScope(Enum):
    SENDER_DOMAIN = "sender_domain"
    SENDER_ADDRESS = "sender_address"
    RECIPIENT = "recipient"
    WORKSPACE = "workspace"
    AGENT = "agent"
    RECIPIENT_DOMAIN = "recipient_domain"
    GLOBAL = "global"


@dataclass
class RateLimitConfig:
    """Configuration for a rate limit."""
    scope: RateLimitScope
    limit: int
    window_seconds: int
    burst_limit: Optional[int] = None


class EmailRateLimiter:
    """
    Rate limiting for email operations.
    
    Uses sliding window algorithm with Redis.
    """
    
    # Inbound rate limits
    INBOUND_LIMITS = [
        RateLimitConfig(RateLimitScope.SENDER_DOMAIN, 100, 3600),      # 100/hour per domain
        RateLimitConfig(RateLimitScope.SENDER_ADDRESS, 20, 3600),      # 20/hour per address
        RateLimitConfig(RateLimitScope.RECIPIENT, 500, 3600),          # 500/hour per recipient
        RateLimitConfig(RateLimitScope.GLOBAL, 10000, 3600),           # 10k/hour global
    ]
    
    # Outbound rate limits
    OUTBOUND_LIMITS = [
        RateLimitConfig(RateLimitScope.WORKSPACE, 1000, 86400),        # 1k/day per workspace
        RateLimitConfig(RateLimitScope.AGENT, 100, 3600),              # 100/hour per agent
        RateLimitConfig(RateLimitScope.RECIPIENT_DOMAIN, 50, 3600),    # 50/hour per domain
        RateLimitConfig(RateLimitScope.GLOBAL, 50000, 86400),          # 50k/day global
    ]
    
    def __init__(self, redis):
        self.redis = redis
    
    async def check_inbound(
        self,
        sender_domain: str,
        sender_address: str,
        recipient: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check inbound rate limits.
        
        Returns (allowed, reason if blocked)
        """
        
        checks = [
            (RateLimitScope.SENDER_DOMAIN, sender_domain),
            (RateLimitScope.SENDER_ADDRESS, sender_address),
            (RateLimitScope.RECIPIENT, recipient),
            (RateLimitScope.GLOBAL, "inbound"),
        ]
        
        for scope, key in checks:
            config = self._get_config(scope, self.INBOUND_LIMITS)
            if not await self._check_limit(f"inbound:{scope.value}:{key}", config):
                return False, f"Rate limit exceeded for {scope.value}"
        
        # Increment counters
        for scope, key in checks:
            config = self._get_config(scope, self.INBOUND_LIMITS)
            await self._increment(f"inbound:{scope.value}:{key}", config)
        
        return True, None
    
    async def check_outbound(
        self,
        workspace_id: str,
        agent_id: str,
        recipient_domain: str
    ) -> Tuple[bool, Optional[str]]:
        """
        Check outbound rate limits.
        
        Returns (allowed, reason if blocked)
        """
        
        checks = [
            (RateLimitScope.WORKSPACE, workspace_id),
            (RateLimitScope.AGENT, agent_id),
            (RateLimitScope.RECIPIENT_DOMAIN, recipient_domain),
            (RateLimitScope.GLOBAL, "outbound"),
        ]
        
        for scope, key in checks:
            config = self._get_config(scope, self.OUTBOUND_LIMITS)
            if not await self._check_limit(f"outbound:{scope.value}:{key}", config):
                return False, f"Rate limit exceeded for {scope.value}"
        
        # Increment counters
        for scope, key in checks:
            config = self._get_config(scope, self.OUTBOUND_LIMITS)
            await self._increment(f"outbound:{scope.value}:{key}", config)
        
        return True, None
    
    async def _check_limit(self, key: str, config: RateLimitConfig) -> bool:
        """Check if under rate limit using sliding window."""
        
        now = time.time()
        window_start = now - config.window_seconds
        
        # Count requests in window
        count = await self.redis.zcount(
            f"ratelimit:{key}",
            window_start,
            now
        )
        
        return count < config.limit
    
    async def _increment(self, key: str, config: RateLimitConfig):
        """Increment rate limit counter."""
        
        now = time.time()
        
        # Add timestamp to sorted set
        await self.redis.zadd(
            f"ratelimit:{key}",
            {str(now): now}
        )
        
        # Remove old entries
        window_start = now - config.window_seconds
        await self.redis.zremrangebyscore(
            f"ratelimit:{key}",
            0,
            window_start
        )
        
        # Set expiry
        await self.redis.expire(
            f"ratelimit:{key}",
            config.window_seconds + 60
        )


class AbusePreventionService:
    """
    Prevents email abuse through reputation and pattern detection.
    
    Features:
    - Sender reputation tracking
    - Automatic blocking
    - Feedback loop processing
    - Anomaly detection
    """
    
    def __init__(self, db, redis, threat_intel):
        self.db = db
        self.redis = redis
        self.threats = threat_intel
    
    async def check_sender_reputation(
        self,
        sender_domain: str,
        sender_address: str,
        client_ip: str
    ) -> Tuple[bool, float, List[str]]:
        """
        Check sender reputation.
        
        Returns (allowed, reputation_score, flags)
        """
        
        flags = []
        
        # Check domain reputation
        domain_rep = await self._get_domain_reputation(sender_domain)
        if domain_rep < 0.3:
            flags.append("low_domain_reputation")
        
        # Check IP reputation
        ip_rep = await self.threats.check_ip(client_ip)
        if ip_rep == "blacklisted":
            return False, 0.0, ["ip_blacklisted"]
        elif ip_rep == "suspicious":
            flags.append("suspicious_ip")
        
        # Check for recent spam reports
        spam_rate = await self._get_spam_rate(sender_domain)
        if spam_rate > 0.1:  # >10% spam rate
            flags.append("high_spam_rate")
        
        # Calculate combined score
        score = (domain_rep * 0.4 + (1 - spam_rate) * 0.4 + 
                 (0.2 if ip_rep == "clean" else 0.1 if ip_rep == "suspicious" else 0))
        
        # Block if score too low
        if score < 0.2:
            return False, score, flags
        
        return True, score, flags
    
    async def process_feedback_loop(
        self,
        feedback_type: str,  # "abuse", "unsubscribe", "spam"
        original_message_id: str,
        reporter_email: str
    ):
        """
        Process feedback loop report.
        
        Feedback loops are reports from ISPs about spam complaints.
        """
        
        # Find original message
        message = await self.db.get_sent_message(original_message_id)
        if not message:
            return
        
        # Record feedback
        await self.db.record_feedback(
            message_id=original_message_id,
            feedback_type=feedback_type,
            reporter=reporter_email,
            timestamp=time.time()
        )
        
        # Update sender reputation
        await self._decrease_reputation(
            domain=self._extract_domain(message.from_address),
            amount=0.05 if feedback_type == "spam" else 0.02
        )
        
        # Check if should block sender
        recent_complaints = await self.db.count_recent_feedback(
            from_address=message.from_address,
            hours=24
        )
        
        if recent_complaints > 10:
            await self._block_sender(message.from_address, "excessive_complaints")
    
    async def detect_anomalies(
        self,
        workspace_id: str
    ) -> List[Dict]:
        """
        Detect anomalous email patterns.
        
        Looks for:
        - Sudden volume spikes
        - Unusual sending times
        - High bounce rates
        - Recipient pattern changes
        """
        
        anomalies = []
        
        # Get baseline metrics
        baseline = await self._get_baseline_metrics(workspace_id)
        current = await self._get_current_metrics(workspace_id)
        
        # Volume spike detection
        if current["volume"] > baseline["volume"] * 3:
            anomalies.append({
                "type": "volume_spike",
                "severity": "high",
                "current": current["volume"],
                "baseline": baseline["volume"]
            })
        
        # Bounce rate spike
        if current["bounce_rate"] > baseline["bounce_rate"] * 2:
            anomalies.append({
                "type": "bounce_spike",
                "severity": "medium",
                "current": current["bounce_rate"],
                "baseline": baseline["bounce_rate"]
            })
        
        # Unusual sending pattern
        if self._is_unusual_pattern(current["hourly_distribution"]):
            anomalies.append({
                "type": "unusual_pattern",
                "severity": "low",
                "pattern": current["hourly_distribution"]
            })
        
        return anomalies
```



---

# PART 3: INTEGRATIONS & CONNECTORS

## 3.1 Unified Connector Execution Model

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      CONNECTOR EXECUTION ARCHITECTURE                                │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         CONNECTOR REGISTRY                                    │   │
│  │                                                                               │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐           │   │
│  │  │ GitHub  │  │ Slack   │  │ Google  │  │ Notion  │  │ Custom  │           │   │
│  │  │Connector│  │Connector│  │Connector│  │Connector│  │Connector│           │   │
│  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘           │   │
│  │       │            │            │            │            │                  │   │
│  │       └────────────┴────────────┴────────────┴────────────┘                  │   │
│  │                                  │                                            │   │
│  │                                  ▼                                            │   │
│  │                    ┌─────────────────────────┐                                │   │
│  │                    │   Connector Interface   │                                │   │
│  │                    │   (Abstract Base)       │                                │   │
│  │                    └─────────────────────────┘                                │   │
│  │                                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         EXECUTION PIPELINE                                    │   │
│  │                                                                               │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │   │
│  │  │ Request │───▶│ Auth    │───▶│ Rate    │───▶│ Execute │───▶│ Audit   │   │   │
│  │  │ Validate│    │ Check   │    │ Limit   │    │ Action  │    │ Log     │   │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │   │
│  │       │              │              │              │              │          │   │
│  │       ▼              ▼              ▼              ▼              ▼          │   │
│  │  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐   │   │
│  │  │ Schema  │    │ OAuth   │    │ Quota   │    │ Retry   │    │ Event   │   │   │
│  │  │ Validate│    │ Token   │    │ Check   │    │ Logic   │    │ Emit    │   │   │
│  │  └─────────┘    └─────────┘    └─────────┘    └─────────┘    └─────────┘   │   │
│  │                                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│  ┌─────────────────────────────────────────────────────────────────────────────┐   │
│  │                         TRANSACTION MANAGER                                   │   │
│  │                                                                               │   │
│  │  • Saga orchestration for multi-step operations                              │   │
│  │  • Compensation actions for rollback                                         │   │
│  │  • Idempotency key tracking                                                  │   │
│  │  • Distributed lock management                                               │   │
│  │                                                                               │   │
│  └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

```python
# ═══════════════════════════════════════════════════════════════════════════════
# UNIFIED CONNECTOR EXECUTION MODEL
# ═══════════════════════════════════════════════════════════════════════════════

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Callable, TypeVar, Generic
from enum import Enum
import asyncio


class ConnectorType(Enum):
    OAUTH2 = "oauth2"
    API_KEY = "api_key"
    WEBHOOK = "webhook"
    CUSTOM = "custom"


class ActionCategory(Enum):
    READ = "read"           # Safe, idempotent reads
    WRITE = "write"         # Creates or updates data
    DELETE = "delete"       # Destructive operations
    EXECUTE = "execute"     # Triggers actions (send email, etc.)


@dataclass
class ConnectorCapability:
    """Defines a capability/action a connector supports."""
    name: str
    description: str
    category: ActionCategory
    input_schema: Dict
    output_schema: Dict
    required_scopes: List[str]
    rate_limit: Optional[int]  # requests per minute
    requires_approval: bool
    idempotent: bool


@dataclass
class ConnectorConfig:
    """Configuration for a connector instance."""
    connector_id: str
    connector_type: ConnectorType
    name: str
    description: str
    icon_url: str
    capabilities: List[ConnectorCapability]
    auth_config: Dict
    default_rate_limit: int
    supports_webhooks: bool
    supports_batch: bool


@dataclass
class ExecutionContext:
    """Context for connector execution."""
    workspace_id: str
    user_id: str
    agent_id: Optional[str]
    task_id: Optional[str]
    idempotency_key: str
    timeout_seconds: int
    retry_count: int
    metadata: Dict


@dataclass
class ExecutionResult:
    """Result of connector execution."""
    success: bool
    data: Optional[Any]
    error: Optional[str]
    error_code: Optional[str]
    retryable: bool
    execution_time_ms: int
    rate_limit_remaining: Optional[int]
    audit_id: str


class BaseConnector(ABC):
    """
    Abstract base class for all connectors.
    
    All connectors must implement:
    1. Authentication handling
    2. Action execution
    3. Rate limit compliance
    4. Error handling
    """
    
    def __init__(self, config: ConnectorConfig):
        self.config = config
        self._auth_manager = None
        self._rate_limiter = None
    
    @abstractmethod
    async def authenticate(self, credentials: Dict) -> 'AuthResult':
        """Authenticate with the external service."""
        pass
    
    @abstractmethod
    async def refresh_auth(self, auth_data: Dict) -> 'AuthResult':
        """Refresh authentication if needed."""
        pass
    
    @abstractmethod
    async def execute_action(
        self,
        action: str,
        params: Dict,
        context: ExecutionContext
    ) -> ExecutionResult:
        """Execute a connector action."""
        pass
    
    @abstractmethod
    async def validate_connection(self, auth_data: Dict) -> bool:
        """Validate that connection is still valid."""
        pass
    
    def get_capability(self, action: str) -> Optional[ConnectorCapability]:
        """Get capability definition for an action."""
        for cap in self.config.capabilities:
            if cap.name == action:
                return cap
        return None


class ConnectorExecutionEngine:
    """
    Central engine for executing connector actions.
    
    Responsibilities:
    1. Route actions to appropriate connector
    2. Handle authentication
    3. Enforce rate limits
    4. Manage transactions
    5. Audit all operations
    """
    
    def __init__(
        self,
        connector_registry: 'ConnectorRegistry',
        auth_service: 'AuthService',
        rate_limiter: 'RateLimiter',
        audit_service: 'AuditService',
        approval_service: 'ApprovalService',
        transaction_manager: 'TransactionManager'
    ):
        self.registry = connector_registry
        self.auth = auth_service
        self.rate_limiter = rate_limiter
        self.audit = audit_service
        self.approvals = approval_service
        self.transactions = transaction_manager
    
    async def execute(
        self,
        connector_id: str,
        action: str,
        params: Dict,
        context: ExecutionContext
    ) -> ExecutionResult:
        """
        Execute a connector action with full pipeline.
        
        Pipeline:
        1. Validate request
        2. Check permissions
        3. Check rate limits
        4. Check approval requirements
        5. Execute action
        6. Audit result
        """
        
        start_time = time.time()
        audit_id = str(uuid.uuid4())
        
        try:
            # ─────────────────────────────────────────────────────────────
            # STEP 1: GET CONNECTOR AND CAPABILITY
            # ─────────────────────────────────────────────────────────────
            
            connector = self.registry.get_connector(connector_id)
            if not connector:
                return ExecutionResult(
                    success=False,
                    data=None,
                    error=f"Connector not found: {connector_id}",
                    error_code="CONNECTOR_NOT_FOUND",
                    retryable=False,
                    execution_time_ms=0,
                    rate_limit_remaining=None,
                    audit_id=audit_id
                )
            
            capability = connector.get_capability(action)
            if not capability:
                return ExecutionResult(
                    success=False,
                    data=None,
                    error=f"Action not found: {action}",
                    error_code="ACTION_NOT_FOUND",
                    retryable=False,
                    execution_time_ms=0,
                    rate_limit_remaining=None,
                    audit_id=audit_id
                )
            
            # ─────────────────────────────────────────────────────────────
            # STEP 2: VALIDATE INPUT
            # ─────────────────────────────────────────────────────────────
            
            validation_error = self._validate_input(params, capability.input_schema)
            if validation_error:
                return ExecutionResult(
                    success=False,
                    data=None,
                    error=validation_error,
                    error_code="VALIDATION_ERROR",
                    retryable=False,
                    execution_time_ms=0,
                    rate_limit_remaining=None,
                    audit_id=audit_id
                )
            
            # ─────────────────────────────────────────────────────────────
            # STEP 3: CHECK PERMISSIONS
            # ─────────────────────────────────────────────────────────────
            
            auth_data = await self.auth.get_connection_auth(
                workspace_id=context.workspace_id,
                connector_id=connector_id
            )
            
            if not auth_data:
                return ExecutionResult(
                    success=False,
                    data=None,
                    error="Connector not connected",
                    error_code="NOT_CONNECTED",
                    retryable=False,
                    execution_time_ms=0,
                    rate_limit_remaining=None,
                    audit_id=audit_id
                )
            
            # Check scopes
            if not self._has_required_scopes(auth_data.scopes, capability.required_scopes):
                return ExecutionResult(
                    success=False,
                    data=None,
                    error=f"Missing required scopes: {capability.required_scopes}",
                    error_code="INSUFFICIENT_SCOPES",
                    retryable=False,
                    execution_time_ms=0,
                    rate_limit_remaining=None,
                    audit_id=audit_id
                )
            
            # ─────────────────────────────────────────────────────────────
            # STEP 4: CHECK RATE LIMITS
            # ─────────────────────────────────────────────────────────────
            
            rate_limit = capability.rate_limit or connector.config.default_rate_limit
            allowed, remaining = await self.rate_limiter.check_and_consume(
                key=f"{context.workspace_id}:{connector_id}:{action}",
                limit=rate_limit,
                window_seconds=60
            )
            
            if not allowed:
                return ExecutionResult(
                    success=False,
                    data=None,
                    error="Rate limit exceeded",
                    error_code="RATE_LIMITED",
                    retryable=True,
                    execution_time_ms=0,
                    rate_limit_remaining=0,
                    audit_id=audit_id
                )
            
            # ─────────────────────────────────────────────────────────────
            # STEP 5: CHECK APPROVAL REQUIREMENTS
            # ─────────────────────────────────────────────────────────────
            
            if capability.requires_approval:
                approval = await self.approvals.check_or_request(
                    workspace_id=context.workspace_id,
                    user_id=context.user_id,
                    action=f"{connector_id}:{action}",
                    params=params,
                    context=context
                )
                
                if not approval.approved:
                    return ExecutionResult(
                        success=False,
                        data={"approval_id": approval.id},
                        error="Approval required",
                        error_code="APPROVAL_REQUIRED",
                        retryable=False,
                        execution_time_ms=0,
                        rate_limit_remaining=remaining,
                        audit_id=audit_id
                    )
            
            # ─────────────────────────────────────────────────────────────
            # STEP 6: REFRESH AUTH IF NEEDED
            # ─────────────────────────────────────────────────────────────
            
            if auth_data.expires_at and auth_data.expires_at < time.time() + 60:
                auth_data = await self._refresh_auth(connector, auth_data)
            
            # ─────────────────────────────────────────────────────────────
            # STEP 7: EXECUTE ACTION
            # ─────────────────────────────────────────────────────────────
            
            # Start audit trail
            await self.audit.start_execution(
                audit_id=audit_id,
                connector_id=connector_id,
                action=action,
                params=self._redact_sensitive(params),
                context=context
            )
            
            # Execute with retry logic
            result = await self._execute_with_retry(
                connector=connector,
                action=action,
                params=params,
                auth_data=auth_data,
                context=context
            )
            
            # ─────────────────────────────────────────────────────────────
            # STEP 8: AUDIT RESULT
            # ─────────────────────────────────────────────────────────────
            
            execution_time = int((time.time() - start_time) * 1000)
            
            await self.audit.complete_execution(
                audit_id=audit_id,
                success=result.success,
                error=result.error,
                execution_time_ms=execution_time
            )
            
            return ExecutionResult(
                success=result.success,
                data=result.data,
                error=result.error,
                error_code=result.error_code,
                retryable=result.retryable,
                execution_time_ms=execution_time,
                rate_limit_remaining=remaining,
                audit_id=audit_id
            )
            
        except Exception as e:
            execution_time = int((time.time() - start_time) * 1000)
            
            await self.audit.complete_execution(
                audit_id=audit_id,
                success=False,
                error=str(e),
                execution_time_ms=execution_time
            )
            
            return ExecutionResult(
                success=False,
                data=None,
                error=str(e),
                error_code="INTERNAL_ERROR",
                retryable=True,
                execution_time_ms=execution_time,
                rate_limit_remaining=None,
                audit_id=audit_id
            )
    
    async def _execute_with_retry(
        self,
        connector: BaseConnector,
        action: str,
        params: Dict,
        auth_data: 'AuthData',
        context: ExecutionContext
    ) -> ExecutionResult:
        """Execute action with retry logic."""
        
        max_retries = context.retry_count
        last_error = None
        
        for attempt in range(max_retries + 1):
            try:
                result = await asyncio.wait_for(
                    connector.execute_action(action, params, context),
                    timeout=context.timeout_seconds
                )
                
                if result.success or not result.retryable:
                    return result
                
                last_error = result.error
                
            except asyncio.TimeoutError:
                last_error = "Operation timed out"
            except Exception as e:
                last_error = str(e)
            
            # Wait before retry (exponential backoff)
            if attempt < max_retries:
                await asyncio.sleep(2 ** attempt)
        
        return ExecutionResult(
            success=False,
            data=None,
            error=last_error,
            error_code="MAX_RETRIES_EXCEEDED",
            retryable=False,
            execution_time_ms=0,
            rate_limit_remaining=None,
            audit_id=""
        )
```

---

## 3.2 Permission Scopes Surfaced to Agents

```python
# ═══════════════════════════════════════════════════════════════════════════════
# PERMISSION SCOPES FOR AGENTS
# ═══════════════════════════════════════════════════════════════════════════════

"""
SCOPE HIERARCHY

Scopes are hierarchical and connector-specific:

github:
├── repo:read          # Read repository data
├── repo:write         # Create/update repos
├── repo:delete        # Delete repos
├── issues:read        # Read issues
├── issues:write       # Create/update issues
├── pull_requests:read
├── pull_requests:write
└── admin              # Full admin access

slack:
├── channels:read
├── channels:write
├── messages:read
├── messages:write
├── files:read
├── files:write
└── users:read

google:
├── drive:read
├── drive:write
├── calendar:read
├── calendar:write
├── gmail:read
├── gmail:send
└── gmail:modify

Agents see:
1. Which scopes are available
2. Which scopes are granted
3. What each scope allows
4. Scope dependencies
"""

from dataclasses import dataclass
from typing import List, Dict, Set, Optional
from enum import Enum


class ScopeLevel(Enum):
    READ = "read"
    WRITE = "write"
    DELETE = "delete"
    ADMIN = "admin"


@dataclass
class Scope:
    """Definition of a permission scope."""
    id: str
    connector_id: str
    name: str
    description: str
    level: ScopeLevel
    parent_scope: Optional[str]  # For hierarchical scopes
    implies: List[str]  # Scopes this one implies
    required_by: List[str]  # Actions that require this scope
    sensitive: bool  # Requires extra approval
    
    def to_agent_format(self) -> Dict:
        """Format scope for agent consumption."""
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "level": self.level.value,
            "sensitive": self.sensitive,
            "allows": self.required_by
        }


@dataclass
class ScopeGrant:
    """Record of a scope being granted to a workspace."""
    scope_id: str
    workspace_id: str
    connector_id: str
    granted_at: float
    granted_by: str
    expires_at: Optional[float]
    restrictions: Dict  # Additional restrictions


class ScopeRegistry:
    """
    Registry of all available scopes.
    
    Provides:
    1. Scope definitions
    2. Scope hierarchy resolution
    3. Scope validation
    """
    
    # Standard scope definitions
    SCOPES = {
        # GitHub scopes
        "github:repo:read": Scope(
            id="github:repo:read",
            connector_id="github",
            name="Read Repositories",
            description="View repository contents, commits, branches",
            level=ScopeLevel.READ,
            parent_scope=None,
            implies=[],
            required_by=["list_repos", "get_repo", "get_file", "list_commits"],
            sensitive=False
        ),
        "github:repo:write": Scope(
            id="github:repo:write",
            connector_id="github",
            name="Write Repositories",
            description="Create files, branches, commits",
            level=ScopeLevel.WRITE,
            parent_scope="github:repo:read",
            implies=["github:repo:read"],
            required_by=["create_file", "update_file", "create_branch"],
            sensitive=False
        ),
        "github:issues:write": Scope(
            id="github:issues:write",
            connector_id="github",
            name="Write Issues",
            description="Create and update issues",
            level=ScopeLevel.WRITE,
            parent_scope="github:issues:read",
            implies=["github:issues:read"],
            required_by=["create_issue", "update_issue", "close_issue"],
            sensitive=False
        ),
        
        # Slack scopes
        "slack:messages:read": Scope(
            id="slack:messages:read",
            connector_id="slack",
            name="Read Messages",
            description="View messages in channels",
            level=ScopeLevel.READ,
            parent_scope=None,
            implies=[],
            required_by=["list_messages", "search_messages"],
            sensitive=False
        ),
        "slack:messages:write": Scope(
            id="slack:messages:write",
            connector_id="slack",
            name="Send Messages",
            description="Post messages to channels",
            level=ScopeLevel.WRITE,
            parent_scope="slack:messages:read",
            implies=["slack:messages:read"],
            required_by=["send_message", "reply_to_message"],
            sensitive=True  # Sensitive because it can post publicly
        ),
        
        # Google scopes
        "google:gmail:send": Scope(
            id="google:gmail:send",
            connector_id="google",
            name="Send Email",
            description="Send emails on behalf of user",
            level=ScopeLevel.WRITE,
            parent_scope="google:gmail:read",
            implies=["google:gmail:read"],
            required_by=["send_email", "reply_email"],
            sensitive=True
        ),
    }
    
    def get_scope(self, scope_id: str) -> Optional[Scope]:
        """Get scope definition."""
        return self.SCOPES.get(scope_id)
    
    def get_connector_scopes(self, connector_id: str) -> List[Scope]:
        """Get all scopes for a connector."""
        return [s for s in self.SCOPES.values() if s.connector_id == connector_id]
    
    def resolve_implied_scopes(self, scope_ids: List[str]) -> Set[str]:
        """Resolve all implied scopes from a list of scopes."""
        resolved = set(scope_ids)
        
        for scope_id in scope_ids:
            scope = self.get_scope(scope_id)
            if scope:
                resolved.update(scope.implies)
                # Recursively resolve
                resolved.update(self.resolve_implied_scopes(scope.implies))
        
        return resolved


class AgentScopeService:
    """
    Service for agents to query and use scopes.
    
    Provides agent-friendly interface to:
    1. List available scopes
    2. Check granted scopes
    3. Request additional scopes
    4. Understand scope implications
    """
    
    def __init__(self, registry: ScopeRegistry, db, approval_service):
        self.registry = registry
        self.db = db
        self.approvals = approval_service
    
    async def get_available_scopes(
        self,
        workspace_id: str,
        connector_id: str
    ) -> Dict:
        """
        Get scopes available to agent for a connector.
        
        Returns structured data for agent consumption.
        """
        
        # Get all connector scopes
        all_scopes = self.registry.get_connector_scopes(connector_id)
        
        # Get granted scopes
        grants = await self.db.get_scope_grants(workspace_id, connector_id)
        granted_ids = {g.scope_id for g in grants}
        
        # Resolve implied scopes
        effective_ids = self.registry.resolve_implied_scopes(list(granted_ids))
        
        return {
            "connector_id": connector_id,
            "scopes": {
                "granted": [
                    s.to_agent_format() for s in all_scopes 
                    if s.id in granted_ids
                ],
                "effective": [
                    s.to_agent_format() for s in all_scopes
                    if s.id in effective_ids
                ],
                "available": [
                    s.to_agent_format() for s in all_scopes
                    if s.id not in effective_ids
                ]
            },
            "can_request_more": True,
            "request_instructions": "Use request_scope action to request additional permissions"
        }
    
    async def check_scope(
        self,
        workspace_id: str,
        connector_id: str,
        required_scope: str
    ) -> Dict:
        """
        Check if a specific scope is available.
        
        Returns detailed status for agent decision-making.
        """
        
        grants = await self.db.get_scope_grants(workspace_id, connector_id)
        granted_ids = {g.scope_id for g in grants}
        effective_ids = self.registry.resolve_implied_scopes(list(granted_ids))
        
        scope = self.registry.get_scope(required_scope)
        
        if not scope:
            return {
                "available": False,
                "reason": "scope_not_found",
                "message": f"Scope {required_scope} does not exist"
            }
        
        if required_scope in effective_ids:
            return {
                "available": True,
                "granted_directly": required_scope in granted_ids,
                "granted_via": [
                    s for s in granted_ids 
                    if required_scope in self.registry.get_scope(s).implies
                ] if required_scope not in granted_ids else None
            }
        
        return {
            "available": False,
            "reason": "not_granted",
            "can_request": True,
            "scope_details": scope.to_agent_format(),
            "request_action": {
                "action": "request_scope",
                "params": {
                    "connector_id": connector_id,
                    "scope_id": required_scope,
                    "reason": "Required for [describe operation]"
                }
            }
        }
    
    async def request_scope(
        self,
        workspace_id: str,
        user_id: str,
        agent_id: str,
        connector_id: str,
        scope_id: str,
        reason: str
    ) -> Dict:
        """
        Request additional scope from user.
        
        Creates approval request for user to grant scope.
        """
        
        scope = self.registry.get_scope(scope_id)
        
        if not scope:
            return {
                "success": False,
                "error": "Scope not found"
            }
        
        # Check if already granted
        grants = await self.db.get_scope_grants(workspace_id, connector_id)
        if any(g.scope_id == scope_id for g in grants):
            return {
                "success": True,
                "already_granted": True
            }
        
        # Create approval request
        approval = await self.approvals.create_request(
            workspace_id=workspace_id,
            user_id=user_id,
            request_type="scope_grant",
            details={
                "connector_id": connector_id,
                "scope_id": scope_id,
                "scope_name": scope.name,
                "scope_description": scope.description,
                "reason": reason,
                "agent_id": agent_id,
                "sensitive": scope.sensitive
            }
        )
        
        return {
            "success": True,
            "approval_required": True,
            "approval_id": approval.id,
            "message": f"Requested '{scope.name}' permission. Waiting for user approval.",
            "scope_details": scope.to_agent_format()
        }
```

---

## 3.3 Cross-Tool Transaction Semantics

```python
# ═══════════════════════════════════════════════════════════════════════════════
# CROSS-TOOL TRANSACTION SEMANTICS
# ═══════════════════════════════════════════════════════════════════════════════

"""
TRANSACTION MODEL

Multi-connector operations use the Saga pattern:

Saga = Sequence of local transactions with compensation

Example: Create GitHub issue from Slack message
1. Get Slack message (read, no compensation needed)
2. Create GitHub issue (write, compensation: delete issue)
3. Post Slack reply with link (write, compensation: delete message)

If step 3 fails:
- Compensate step 2: Delete the GitHub issue
- Step 1 needs no compensation (read-only)

Transaction States:
- PENDING: Not started
- RUNNING: In progress
- COMPLETED: All steps succeeded
- COMPENSATING: Rolling back
- FAILED: Compensation complete
- PARTIAL: Some steps completed, compensation failed
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Callable, Any
from enum import Enum
import asyncio


class TransactionState(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    FAILED = "failed"
    PARTIAL = "partial"  # Dangerous state - needs manual intervention


class StepState(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    COMPENSATING = "compensating"
    COMPENSATED = "compensated"
    FAILED = "failed"


@dataclass
class TransactionStep:
    """Single step in a saga transaction."""
    id: str
    name: str
    connector_id: str
    action: str
    params: Dict
    compensation_action: Optional[str]
    compensation_params_template: Optional[Dict]  # Template using step result
    state: StepState = StepState.PENDING
    result: Optional[Any] = None
    error: Optional[str] = None
    started_at: Optional[float] = None
    completed_at: Optional[float] = None


@dataclass
class Transaction:
    """Saga transaction across multiple connectors."""
    id: str
    workspace_id: str
    user_id: str
    name: str
    description: str
    steps: List[TransactionStep]
    state: TransactionState = TransactionState.PENDING
    current_step_index: int = 0
    created_at: float = field(default_factory=time.time)
    completed_at: Optional[float] = None
    context: Dict = field(default_factory=dict)  # Shared context between steps


class TransactionManager:
    """
    Manages saga transactions across connectors.
    
    Guarantees:
    1. All-or-nothing semantics (best effort)
    2. Ordered execution
    3. Automatic compensation on failure
    4. Idempotent operations
    """
    
    def __init__(self, db, connector_engine: 'ConnectorExecutionEngine', audit):
        self.db = db
        self.engine = connector_engine
        self.audit = audit
    
    async def create_transaction(
        self,
        workspace_id: str,
        user_id: str,
        name: str,
        description: str,
        steps: List[Dict]
    ) -> Transaction:
        """
        Create a new saga transaction.
        
        Steps should include:
        - connector_id: Which connector to use
        - action: Action to execute
        - params: Action parameters (can reference previous step results)
        - compensation_action: Action to undo this step
        - compensation_params_template: Template for compensation params
        """
        
        transaction_steps = []
        for i, step_def in enumerate(steps):
            step = TransactionStep(
                id=f"{uuid.uuid4()}",
                name=step_def.get("name", f"Step {i+1}"),
                connector_id=step_def["connector_id"],
                action=step_def["action"],
                params=step_def["params"],
                compensation_action=step_def.get("compensation_action"),
                compensation_params_template=step_def.get("compensation_params_template")
            )
            transaction_steps.append(step)
        
        transaction = Transaction(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            user_id=user_id,
            name=name,
            description=description,
            steps=transaction_steps
        )
        
        await self.db.save_transaction(transaction)
        
        return transaction
    
    async def execute_transaction(
        self,
        transaction_id: str,
        context: ExecutionContext
    ) -> Transaction:
        """
        Execute a saga transaction.
        
        Executes steps in order, compensating on failure.
        """
        
        transaction = await self.db.get_transaction(transaction_id)
        
        if transaction.state != TransactionState.PENDING:
            raise ValueError(f"Transaction already in state: {transaction.state}")
        
        transaction.state = TransactionState.RUNNING
        await self.db.save_transaction(transaction)
        
        await self.audit.log_event(
            workspace_id=transaction.workspace_id,
            event_type="transaction_started",
            resource_type="transaction",
            resource_id=transaction.id,
            details={"name": transaction.name, "steps": len(transaction.steps)}
        )
        
        try:
            # Execute steps in order
            for i, step in enumerate(transaction.steps):
                transaction.current_step_index = i
                
                # Resolve params (may reference previous step results)
                resolved_params = self._resolve_params(step.params, transaction.context)
                
                # Execute step
                step.state = StepState.RUNNING
                step.started_at = time.time()
                await self.db.save_transaction(transaction)
                
                result = await self.engine.execute(
                    connector_id=step.connector_id,
                    action=step.action,
                    params=resolved_params,
                    context=context
                )
                
                if result.success:
                    step.state = StepState.COMPLETED
                    step.result = result.data
                    step.completed_at = time.time()
                    
                    # Add result to context for later steps
                    transaction.context[f"step_{i}_result"] = result.data
                    transaction.context[step.name] = result.data
                    
                    await self.db.save_transaction(transaction)
                else:
                    # Step failed - start compensation
                    step.state = StepState.FAILED
                    step.error = result.error
                    
                    await self.audit.log_event(
                        workspace_id=transaction.workspace_id,
                        event_type="transaction_step_failed",
                        resource_type="transaction",
                        resource_id=transaction.id,
                        details={"step": step.name, "error": result.error}
                    )
                    
                    # Compensate completed steps
                    await self._compensate(transaction, i - 1, context)
                    
                    transaction.state = TransactionState.FAILED
                    transaction.completed_at = time.time()
                    await self.db.save_transaction(transaction)
                    
                    return transaction
            
            # All steps completed
            transaction.state = TransactionState.COMPLETED
            transaction.completed_at = time.time()
            await self.db.save_transaction(transaction)
            
            await self.audit.log_event(
                workspace_id=transaction.workspace_id,
                event_type="transaction_completed",
                resource_type="transaction",
                resource_id=transaction.id,
                details={"name": transaction.name}
            )
            
            return transaction
            
        except Exception as e:
            # Unexpected error - try to compensate
            await self._compensate(transaction, transaction.current_step_index - 1, context)
            
            transaction.state = TransactionState.FAILED
            transaction.completed_at = time.time()
            await self.db.save_transaction(transaction)
            
            raise
    
    async def _compensate(
        self,
        transaction: Transaction,
        from_step_index: int,
        context: ExecutionContext
    ):
        """
        Compensate completed steps in reverse order.
        
        Best effort - logs failures but continues.
        """
        
        transaction.state = TransactionState.COMPENSATING
        await self.db.save_transaction(transaction)
        
        compensation_failures = []
        
        # Compensate in reverse order
        for i in range(from_step_index, -1, -1):
            step = transaction.steps[i]
            
            if step.state != StepState.COMPLETED:
                continue
            
            if not step.compensation_action:
                # No compensation defined - skip
                continue
            
            step.state = StepState.COMPENSATING
            await self.db.save_transaction(transaction)
            
            try:
                # Resolve compensation params
                comp_params = self._resolve_params(
                    step.compensation_params_template or {},
                    {**transaction.context, "step_result": step.result}
                )
                
                result = await self.engine.execute(
                    connector_id=step.connector_id,
                    action=step.compensation_action,
                    params=comp_params,
                    context=context
                )
                
                if result.success:
                    step.state = StepState.COMPENSATED
                else:
                    step.state = StepState.FAILED
                    compensation_failures.append({
                        "step": step.name,
                        "error": result.error
                    })
                    
            except Exception as e:
                step.state = StepState.FAILED
                compensation_failures.append({
                    "step": step.name,
                    "error": str(e)
                })
            
            await self.db.save_transaction(transaction)
        
        if compensation_failures:
            # Some compensations failed - dangerous state
            transaction.state = TransactionState.PARTIAL
            
            await self.audit.log_event(
                workspace_id=transaction.workspace_id,
                event_type="transaction_compensation_partial",
                resource_type="transaction",
                resource_id=transaction.id,
                details={"failures": compensation_failures},
                severity="critical"
            )
    
    def _resolve_params(self, params: Dict, context: Dict) -> Dict:
        """
        Resolve parameter references to actual values.
        
        Supports:
        - {{step_name.field}}: Reference previous step result
        - {{context.field}}: Reference transaction context
        """
        
        import re
        
        def resolve_value(value):
            if isinstance(value, str):
                # Find all {{...}} references
                pattern = r'\{\{([^}]+)\}\}'
                matches = re.findall(pattern, value)
                
                for match in matches:
                    parts = match.split('.')
                    resolved = context
                    for part in parts:
                        if isinstance(resolved, dict):
                            resolved = resolved.get(part)
                        else:
                            resolved = getattr(resolved, part, None)
                    
                    if resolved is not None:
                        if value == f"{{{{{match}}}}}":
                            # Entire value is a reference - return actual type
                            return resolved
                        else:
                            # Part of string - convert to string
                            value = value.replace(f"{{{{{match}}}}}", str(resolved))
                
                return value
            
            elif isinstance(value, dict):
                return {k: resolve_value(v) for k, v in value.items()}
            
            elif isinstance(value, list):
                return [resolve_value(v) for v in value]
            
            return value
        
        return resolve_value(params)
```

---

## 3.4 Rollback Behavior

```python
# ═══════════════════════════════════════════════════════════════════════════════
# ROLLBACK BEHAVIOR
# ═══════════════════════════════════════════════════════════════════════════════

"""
ROLLBACK STRATEGIES

Different connectors support different rollback capabilities:

1. FULL_ROLLBACK: Can completely undo operation
   - GitHub: Delete created issue
   - Slack: Delete sent message
   - Google Drive: Delete created file

2. SOFT_ROLLBACK: Can mark as cancelled/archived
   - Jira: Cancel issue (can't delete)
   - Salesforce: Archive record
   - Notion: Archive page

3. COMPENSATING_ACTION: Different action to offset
   - Payment: Refund instead of delete
   - Email: Send correction email
   - Calendar: Send cancellation

4. NO_ROLLBACK: Cannot be undone
   - Sent emails (some providers)
   - Published posts
   - Notifications sent

5. MANUAL_ROLLBACK: Requires human intervention
   - Complex workflows
   - External system changes
   - Compliance-sensitive operations
"""

from dataclasses import dataclass
from typing import Optional, Dict, List, Callable
from enum import Enum


class RollbackStrategy(Enum):
    FULL_ROLLBACK = "full_rollback"
    SOFT_ROLLBACK = "soft_rollback"
    COMPENSATING_ACTION = "compensating_action"
    NO_ROLLBACK = "no_rollback"
    MANUAL_ROLLBACK = "manual_rollback"


@dataclass
class RollbackCapability:
    """Defines rollback capability for an action."""
    action: str
    strategy: RollbackStrategy
    rollback_action: Optional[str]
    rollback_params_template: Optional[Dict]
    time_limit_seconds: Optional[int]  # Some rollbacks only work within time window
    requires_approval: bool
    side_effects: List[str]  # What else might be affected


@dataclass
class RollbackRequest:
    """Request to rollback an operation."""
    id: str
    original_execution_id: str
    connector_id: str
    action: str
    original_params: Dict
    original_result: Dict
    reason: str
    requested_by: str
    requested_at: float
    status: str  # "pending", "approved", "executing", "completed", "failed"
    approval_id: Optional[str]


class RollbackService:
    """
    Manages rollback operations for connector actions.
    
    Responsibilities:
    1. Determine rollback capability
    2. Execute rollback with appropriate strategy
    3. Handle time-limited rollbacks
    4. Manage approval for sensitive rollbacks
    """
    
    # Rollback capabilities by connector and action
    CAPABILITIES = {
        "github": {
            "create_issue": RollbackCapability(
                action="create_issue",
                strategy=RollbackStrategy.SOFT_ROLLBACK,
                rollback_action="close_issue",
                rollback_params_template={"issue_number": "{{result.number}}", "state": "closed"},
                time_limit_seconds=None,
                requires_approval=False,
                side_effects=["Notifications already sent", "Webhooks triggered"]
            ),
            "create_file": RollbackCapability(
                action="create_file",
                strategy=RollbackStrategy.FULL_ROLLBACK,
                rollback_action="delete_file",
                rollback_params_template={"path": "{{params.path}}", "sha": "{{result.content.sha}}"},
                time_limit_seconds=None,
                requires_approval=False,
                side_effects=[]
            ),
            "merge_pull_request": RollbackCapability(
                action="merge_pull_request",
                strategy=RollbackStrategy.MANUAL_ROLLBACK,
                rollback_action=None,
                rollback_params_template=None,
                time_limit_seconds=None,
                requires_approval=True,
                side_effects=["Code deployed", "CI/CD triggered", "Branch deleted"]
            )
        },
        "slack": {
            "send_message": RollbackCapability(
                action="send_message",
                strategy=RollbackStrategy.FULL_ROLLBACK,
                rollback_action="delete_message",
                rollback_params_template={"channel": "{{params.channel}}", "ts": "{{result.ts}}"},
                time_limit_seconds=None,
                requires_approval=False,
                side_effects=["Users may have seen message", "Notifications sent"]
            ),
            "create_channel": RollbackCapability(
                action="create_channel",
                strategy=RollbackStrategy.SOFT_ROLLBACK,
                rollback_action="archive_channel",
                rollback_params_template={"channel": "{{result.channel.id}}"},
                time_limit_seconds=None,
                requires_approval=True,
                side_effects=["Members notified", "Channel history preserved"]
            )
        },
        "stripe": {
            "create_charge": RollbackCapability(
                action="create_charge",
                strategy=RollbackStrategy.COMPENSATING_ACTION,
                rollback_action="create_refund",
                rollback_params_template={"charge": "{{result.id}}"},
                time_limit_seconds=7 * 24 * 3600,  # 7 days for refunds
                requires_approval=True,
                side_effects=["Customer notified", "Accounting records created"]
            )
        }
    }
    
    def __init__(self, db, connector_engine, approval_service, audit):
        self.db = db
        self.engine = connector_engine
        self.approvals = approval_service
        self.audit = audit
    
    async def can_rollback(
        self,
        connector_id: str,
        action: str,
        execution_time: float
    ) -> Dict:
        """
        Check if an action can be rolled back.
        
        Returns detailed rollback capability info.
        """
        
        capability = self._get_capability(connector_id, action)
        
        if not capability:
            return {
                "can_rollback": False,
                "reason": "No rollback capability defined",
                "strategy": None
            }
        
        if capability.strategy == RollbackStrategy.NO_ROLLBACK:
            return {
                "can_rollback": False,
                "reason": "Action cannot be rolled back",
                "strategy": capability.strategy.value,
                "side_effects": capability.side_effects
            }
        
        if capability.strategy == RollbackStrategy.MANUAL_ROLLBACK:
            return {
                "can_rollback": True,
                "manual": True,
                "reason": "Requires manual intervention",
                "strategy": capability.strategy.value,
                "side_effects": capability.side_effects,
                "instructions": "Contact support or perform manual rollback"
            }
        
        # Check time limit
        if capability.time_limit_seconds:
            elapsed = time.time() - execution_time
            if elapsed > capability.time_limit_seconds:
                return {
                    "can_rollback": False,
                    "reason": f"Rollback window expired ({capability.time_limit_seconds}s)",
                    "strategy": capability.strategy.value,
                    "elapsed_seconds": elapsed
                }
        
        return {
            "can_rollback": True,
            "strategy": capability.strategy.value,
            "rollback_action": capability.rollback_action,
            "requires_approval": capability.requires_approval,
            "side_effects": capability.side_effects
        }
    
    async def request_rollback(
        self,
        execution_id: str,
        reason: str,
        requested_by: str,
        context: ExecutionContext
    ) -> RollbackRequest:
        """
        Request rollback of a previous execution.
        
        May require approval for sensitive operations.
        """
        
        # Get original execution
        execution = await self.db.get_execution(execution_id)
        if not execution:
            raise ValueError(f"Execution not found: {execution_id}")
        
        # Check rollback capability
        can_rollback = await self.can_rollback(
            connector_id=execution.connector_id,
            action=execution.action,
            execution_time=execution.executed_at
        )
        
        if not can_rollback["can_rollback"]:
            raise ValueError(f"Cannot rollback: {can_rollback['reason']}")
        
        capability = self._get_capability(execution.connector_id, execution.action)
        
        # Create rollback request
        request = RollbackRequest(
            id=str(uuid.uuid4()),
            original_execution_id=execution_id,
            connector_id=execution.connector_id,
            action=execution.action,
            original_params=execution.params,
            original_result=execution.result,
            reason=reason,
            requested_by=requested_by,
            requested_at=time.time(),
            status="pending",
            approval_id=None
        )
        
        await self.db.save_rollback_request(request)
        
        # Check if approval needed
        if capability.requires_approval:
            approval = await self.approvals.create_request(
                workspace_id=context.workspace_id,
                user_id=requested_by,
                request_type="rollback",
                details={
                    "rollback_id": request.id,
                    "connector": execution.connector_id,
                    "action": execution.action,
                    "reason": reason,
                    "side_effects": capability.side_effects
                }
            )
            
            request.status = "pending_approval"
            request.approval_id = approval.id
            await self.db.save_rollback_request(request)
            
            return request
        
        # Execute immediately
        return await self.execute_rollback(request.id, context)
    
    async def execute_rollback(
        self,
        rollback_id: str,
        context: ExecutionContext
    ) -> RollbackRequest:
        """
        Execute a rollback operation.
        
        Uses the appropriate strategy for the action.
        """
        
        request = await self.db.get_rollback_request(rollback_id)
        if not request:
            raise ValueError(f"Rollback request not found: {rollback_id}")
        
        capability = self._get_capability(request.connector_id, request.action)
        
        request.status = "executing"
        await self.db.save_rollback_request(request)
        
        await self.audit.log_event(
            workspace_id=context.workspace_id,
            event_type="rollback_started",
            resource_type="rollback",
            resource_id=request.id,
            details={
                "original_execution": request.original_execution_id,
                "strategy": capability.strategy.value
            }
        )
        
        try:
            if capability.strategy == RollbackStrategy.MANUAL_ROLLBACK:
                # Can't execute automatically
                request.status = "manual_required"
                await self.db.save_rollback_request(request)
                return request
            
            # Resolve rollback params
            rollback_params = self._resolve_params(
                capability.rollback_params_template,
                {
                    "params": request.original_params,
                    "result": request.original_result
                }
            )
            
            # Execute rollback action
            result = await self.engine.execute(
                connector_id=request.connector_id,
                action=capability.rollback_action,
                params=rollback_params,
                context=context
            )
            
            if result.success:
                request.status = "completed"
                
                await self.audit.log_event(
                    workspace_id=context.workspace_id,
                    event_type="rollback_completed",
                    resource_type="rollback",
                    resource_id=request.id,
                    details={"result": result.data}
                )
            else:
                request.status = "failed"
                
                await self.audit.log_event(
                    workspace_id=context.workspace_id,
                    event_type="rollback_failed",
                    resource_type="rollback",
                    resource_id=request.id,
                    details={"error": result.error}
                )
            
            await self.db.save_rollback_request(request)
            return request
            
        except Exception as e:
            request.status = "failed"
            await self.db.save_rollback_request(request)
            
            await self.audit.log_event(
                workspace_id=context.workspace_id,
                event_type="rollback_error",
                resource_type="rollback",
                resource_id=request.id,
                details={"error": str(e)},
                severity="error"
            )
            
            raise
```

---

## 3.5 Audit Logging Per Connector Action

```python
# ═══════════════════════════════════════════════════════════════════════════════
# CONNECTOR AUDIT LOGGING
# ═══════════════════════════════════════════════════════════════════════════════

"""
AUDIT LOG STRUCTURE

Every connector action is logged with:

1. Request Details
   - Connector and action
   - Parameters (redacted)
   - Requesting user/agent
   - Context (task, workspace)

2. Execution Details
   - Start/end timestamps
   - Duration
   - Retry attempts
   - Rate limit status

3. Result Details
   - Success/failure
   - Response data (redacted)
   - Error details
   - Side effects

4. Security Details
   - Auth method used
   - Scopes exercised
   - IP address
   - User agent

Retention:
- Standard: 90 days
- Compliance: 7 years
- Security events: 1 year
"""

from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any
from enum import Enum
import hashlib


class AuditEventSeverity(Enum):
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


@dataclass
class ConnectorAuditEvent:
    """Audit event for connector action."""
    id: str
    workspace_id: str
    
    # Request
    connector_id: str
    action: str
    params_hash: str  # Hash of params for correlation
    params_redacted: Dict  # Params with sensitive data redacted
    
    # Actor
    actor_type: str  # "user", "agent", "system"
    actor_id: str
    actor_name: str
    
    # Context
    task_id: Optional[str]
    transaction_id: Optional[str]
    idempotency_key: str
    
    # Execution
    started_at: float
    completed_at: Optional[float]
    duration_ms: Optional[int]
    retry_count: int
    rate_limit_remaining: Optional[int]
    
    # Result
    success: bool
    result_hash: Optional[str]
    result_redacted: Optional[Dict]
    error: Optional[str]
    error_code: Optional[str]
    
    # Security
    auth_method: str
    scopes_used: List[str]
    client_ip: Optional[str]
    user_agent: Optional[str]
    
    # Metadata
    severity: AuditEventSeverity
    tags: List[str]
    related_events: List[str]


class ConnectorAuditService:
    """
    Comprehensive audit logging for connector actions.
    
    Features:
    1. Automatic sensitive data redaction
    2. Correlation across related events
    3. Compliance-ready retention
    4. Real-time alerting for anomalies
    """
    
    # Fields to redact by connector
    REDACTION_RULES = {
        "default": ["password", "secret", "token", "key", "credential", "auth"],
        "stripe": ["card_number", "cvc", "exp_month", "exp_year"],
        "github": ["private_key"],
        "slack": ["bot_token", "user_token"],
    }
    
    def __init__(self, db, search_index, alert_service, retention_policy):
        self.db = db
        self.search = search_index
        self.alerts = alert_service
        self.retention = retention_policy
    
    async def log_execution_start(
        self,
        connector_id: str,
        action: str,
        params: Dict,
        context: ExecutionContext,
        auth_info: Dict
    ) -> str:
        """
        Log the start of a connector execution.
        
        Returns audit event ID for correlation.
        """
        
        audit_id = str(uuid.uuid4())
        
        event = ConnectorAuditEvent(
            id=audit_id,
            workspace_id=context.workspace_id,
            connector_id=connector_id,
            action=action,
            params_hash=self._hash_params(params),
            params_redacted=self._redact_sensitive(params, connector_id),
            actor_type="agent" if context.agent_id else "user",
            actor_id=context.agent_id or context.user_id,
            actor_name=await self._get_actor_name(context),
            task_id=context.task_id,
            transaction_id=context.metadata.get("transaction_id"),
            idempotency_key=context.idempotency_key,
            started_at=time.time(),
            completed_at=None,
            duration_ms=None,
            retry_count=0,
            rate_limit_remaining=None,
            success=False,  # Updated on completion
            result_hash=None,
            result_redacted=None,
            error=None,
            error_code=None,
            auth_method=auth_info.get("method", "unknown"),
            scopes_used=auth_info.get("scopes", []),
            client_ip=context.metadata.get("client_ip"),
            user_agent=context.metadata.get("user_agent"),
            severity=AuditEventSeverity.INFO,
            tags=[connector_id, action],
            related_events=[]
        )
        
        await self.db.insert_audit_event(event)
        
        return audit_id
    
    async def log_execution_complete(
        self,
        audit_id: str,
        success: bool,
        result: Optional[Any],
        error: Optional[str],
        error_code: Optional[str],
        retry_count: int,
        rate_limit_remaining: Optional[int]
    ):
        """Log completion of connector execution."""
        
        event = await self.db.get_audit_event(audit_id)
        if not event:
            return
        
        now = time.time()
        
        event.completed_at = now
        event.duration_ms = int((now - event.started_at) * 1000)
        event.success = success
        event.retry_count = retry_count
        event.rate_limit_remaining = rate_limit_remaining
        
        if result:
            event.result_hash = self._hash_params(result)
            event.result_redacted = self._redact_sensitive(result, event.connector_id)
        
        if error:
            event.error = error
            event.error_code = error_code
            event.severity = AuditEventSeverity.ERROR
        
        await self.db.update_audit_event(event)
        
        # Index for search
        await self.search.index_audit_event(event)
        
        # Check for anomalies
        await self._check_anomalies(event)
    
    async def query_audit_log(
        self,
        workspace_id: str,
        filters: Dict,
        start_time: Optional[float] = None,
        end_time: Optional[float] = None,
        limit: int = 100,
        offset: int = 0
    ) -> List[ConnectorAuditEvent]:
        """
        Query audit log with filters.
        
        Filters can include:
        - connector_id
        - action
        - actor_id
        - success
        - severity
        - tags
        """
        
        query = {"workspace_id": workspace_id}
        
        if start_time:
            query["started_at"] = {"$gte": start_time}
        if end_time:
            query.setdefault("started_at", {})["$lte"] = end_time
        
        for key, value in filters.items():
            if value is not None:
                query[key] = value
        
        return await self.db.query_audit_events(
            query=query,
            limit=limit,
            offset=offset,
            order_by="started_at",
            order_dir="desc"
        )
    
    async def get_execution_timeline(
        self,
        execution_id: str
    ) -> List[Dict]:
        """
        Get timeline of events for an execution.
        
        Includes related events (retries, rollbacks, etc.)
        """
        
        event = await self.db.get_audit_event(execution_id)
        if not event:
            return []
        
        # Get all related events
        related = await self.db.get_audit_events_by_ids(event.related_events)
        
        # Build timeline
        timeline = []
        
        timeline.append({
            "timestamp": event.started_at,
            "type": "execution_start",
            "details": {
                "connector": event.connector_id,
                "action": event.action,
                "actor": event.actor_name
            }
        })
        
        for retry in range(event.retry_count):
            timeline.append({
                "timestamp": event.started_at + (retry * 2),  # Approximate
                "type": "retry",
                "details": {"attempt": retry + 1}
            })
        
        if event.completed_at:
            timeline.append({
                "timestamp": event.completed_at,
                "type": "execution_complete",
                "details": {
                    "success": event.success,
                    "duration_ms": event.duration_ms,
                    "error": event.error
                }
            })
        
        # Add related events
        for related_event in related:
            timeline.append({
                "timestamp": related_event.started_at,
                "type": "related_execution",
                "details": {
                    "action": related_event.action,
                    "success": related_event.success
                }
            })
        
        # Sort by timestamp
        timeline.sort(key=lambda x: x["timestamp"])
        
        return timeline
    
    def _redact_sensitive(self, data: Any, connector_id: str) -> Any:
        """Redact sensitive fields from data."""
        
        if data is None:
            return None
        
        redact_fields = set(self.REDACTION_RULES["default"])
        if connector_id in self.REDACTION_RULES:
            redact_fields.update(self.REDACTION_RULES[connector_id])
        
        def redact(obj, path=""):
            if isinstance(obj, dict):
                result = {}
                for key, value in obj.items():
                    key_lower = key.lower()
                    if any(field in key_lower for field in redact_fields):
                        result[key] = "[REDACTED]"
                    else:
                        result[key] = redact(value, f"{path}.{key}")
                return result
            elif isinstance(obj, list):
                return [redact(item, f"{path}[]") for item in obj]
            else:
                return obj
        
        return redact(data)
    
    def _hash_params(self, params: Any) -> str:
        """Create deterministic hash of params for correlation."""
        
        import json
        content = json.dumps(params, sort_keys=True, default=str)
        return hashlib.sha256(content.encode()).hexdigest()[:16]
    
    async def _check_anomalies(self, event: ConnectorAuditEvent):
        """Check for anomalous patterns and alert."""
        
        # High error rate
        recent_errors = await self.db.count_recent_errors(
            workspace_id=event.workspace_id,
            connector_id=event.connector_id,
            minutes=5
        )
        
        if recent_errors > 10:
            await self.alerts.send(
                workspace_id=event.workspace_id,
                alert_type="high_error_rate",
                severity="warning",
                details={
                    "connector": event.connector_id,
                    "error_count": recent_errors,
                    "window_minutes": 5
                }
            )
        
        # Unusual activity volume
        recent_count = await self.db.count_recent_executions(
            workspace_id=event.workspace_id,
            connector_id=event.connector_id,
            minutes=60
        )
        
        baseline = await self.db.get_baseline_volume(
            workspace_id=event.workspace_id,
            connector_id=event.connector_id
        )
        
        if recent_count > baseline * 3:
            await self.alerts.send(
                workspace_id=event.workspace_id,
                alert_type="unusual_volume",
                severity="info",
                details={
                    "connector": event.connector_id,
                    "current_count": recent_count,
                    "baseline": baseline
                }
            )
```

---

## 3.6 Rate-Limit Negotiation

```python
# ═══════════════════════════════════════════════════════════════════════════════
# RATE-LIMIT NEGOTIATION
# ═══════════════════════════════════════════════════════════════════════════════

"""
RATE LIMIT MANAGEMENT

Manus manages rate limits at multiple levels:

1. External API Limits
   - Respect third-party rate limits
   - Parse rate limit headers
   - Implement backoff strategies

2. Internal Limits
   - Per-workspace quotas
   - Per-connector limits
   - Global platform limits

3. Dynamic Adjustment
   - Learn from 429 responses
   - Adjust based on time of day
   - Prioritize critical operations

4. Quota Negotiation
   - Request quota increases
   - Share quotas across workspaces
   - Burst allowances
"""

from dataclasses import dataclass
from typing import Dict, Optional, Tuple, List
from enum import Enum
import asyncio


class RateLimitStrategy(Enum):
    FIXED_WINDOW = "fixed_window"
    SLIDING_WINDOW = "sliding_window"
    TOKEN_BUCKET = "token_bucket"
    LEAKY_BUCKET = "leaky_bucket"


@dataclass
class RateLimitConfig:
    """Configuration for rate limiting."""
    connector_id: str
    action: Optional[str]  # None for connector-wide limit
    strategy: RateLimitStrategy
    limit: int
    window_seconds: int
    burst_limit: Optional[int]
    retry_after_header: str  # Header name for retry-after
    rate_limit_headers: Dict[str, str]  # Header name mappings


@dataclass
class RateLimitState:
    """Current state of rate limiting."""
    remaining: int
    limit: int
    reset_at: float
    retry_after: Optional[int]


class RateLimitNegotiator:
    """
    Manages rate limits across connectors.
    
    Features:
    1. Parse and respect external rate limits
    2. Implement internal quotas
    3. Dynamic adjustment based on responses
    4. Fair queuing for competing requests
    """
    
    # Known rate limit configurations
    CONFIGS = {
        "github": RateLimitConfig(
            connector_id="github",
            action=None,
            strategy=RateLimitStrategy.FIXED_WINDOW,
            limit=5000,  # Per hour for authenticated
            window_seconds=3600,
            burst_limit=None,
            retry_after_header="Retry-After",
            rate_limit_headers={
                "limit": "X-RateLimit-Limit",
                "remaining": "X-RateLimit-Remaining",
                "reset": "X-RateLimit-Reset"
            }
        ),
        "slack": RateLimitConfig(
            connector_id="slack",
            action=None,
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            limit=50,  # Per minute for most methods
            window_seconds=60,
            burst_limit=100,
            retry_after_header="Retry-After",
            rate_limit_headers={
                "limit": "X-Rate-Limit-Limit",
                "remaining": "X-Rate-Limit-Remaining",
                "reset": "X-Rate-Limit-Reset"
            }
        ),
        "openai": RateLimitConfig(
            connector_id="openai",
            action=None,
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            limit=60,  # RPM varies by tier
            window_seconds=60,
            burst_limit=None,
            retry_after_header="Retry-After",
            rate_limit_headers={
                "limit": "x-ratelimit-limit-requests",
                "remaining": "x-ratelimit-remaining-requests",
                "reset": "x-ratelimit-reset-requests"
            }
        )
    }
    
    def __init__(self, redis, db, metrics):
        self.redis = redis
        self.db = db
        self.metrics = metrics
        self._learned_limits: Dict[str, int] = {}
    
    async def check_and_consume(
        self,
        workspace_id: str,
        connector_id: str,
        action: str,
        cost: int = 1
    ) -> Tuple[bool, RateLimitState]:
        """
        Check rate limit and consume quota if allowed.
        
        Returns (allowed, state)
        """
        
        config = self._get_config(connector_id, action)
        
        # Check external limit
        external_state = await self._check_external_limit(
            workspace_id, connector_id, config
        )
        
        if external_state.remaining < cost:
            return False, external_state
        
        # Check internal limit
        internal_state = await self._check_internal_limit(
            workspace_id, connector_id, action, config
        )
        
        if internal_state.remaining < cost:
            return False, internal_state
        
        # Consume quota
        await self._consume(workspace_id, connector_id, action, cost, config)
        
        # Return combined state
        combined = RateLimitState(
            remaining=min(external_state.remaining, internal_state.remaining) - cost,
            limit=min(external_state.limit, internal_state.limit),
            reset_at=min(external_state.reset_at, internal_state.reset_at),
            retry_after=None
        )
        
        return True, combined
    
    async def update_from_response(
        self,
        connector_id: str,
        response_headers: Dict[str, str],
        status_code: int
    ):
        """
        Update rate limit state from API response.
        
        Learns from rate limit headers and 429 responses.
        """
        
        config = self._get_config(connector_id, None)
        
        # Parse rate limit headers
        if config.rate_limit_headers:
            limit = response_headers.get(config.rate_limit_headers.get("limit"))
            remaining = response_headers.get(config.rate_limit_headers.get("remaining"))
            reset = response_headers.get(config.rate_limit_headers.get("reset"))
            
            if limit and remaining and reset:
                await self._update_external_state(
                    connector_id,
                    int(limit),
                    int(remaining),
                    float(reset)
                )
        
        # Handle 429 response
        if status_code == 429:
            retry_after = response_headers.get(config.retry_after_header)
            
            if retry_after:
                await self._set_backoff(connector_id, int(retry_after))
            else:
                # Default exponential backoff
                await self._set_backoff(connector_id, 60)
            
            # Learn from 429s
            await self._learn_limit(connector_id)
            
            self.metrics.increment(f"rate_limit.429.{connector_id}")
    
    async def request_quota_increase(
        self,
        workspace_id: str,
        connector_id: str,
        requested_limit: int,
        reason: str
    ) -> Dict:
        """
        Request increased quota for a connector.
        
        May require approval or payment.
        """
        
        current_quota = await self.db.get_workspace_quota(workspace_id, connector_id)
        
        # Check if increase is within allowed range
        max_allowed = await self._get_max_allowed_quota(workspace_id, connector_id)
        
        if requested_limit > max_allowed:
            return {
                "approved": False,
                "reason": f"Requested limit exceeds maximum allowed ({max_allowed})",
                "current_limit": current_quota,
                "max_allowed": max_allowed
            }
        
        # Check if requires payment
        if requested_limit > current_quota * 2:
            return {
                "approved": False,
                "reason": "Large quota increases require subscription upgrade",
                "current_limit": current_quota,
                "requested_limit": requested_limit,
                "upgrade_required": True
            }
        
        # Auto-approve moderate increases
        await self.db.update_workspace_quota(workspace_id, connector_id, requested_limit)
        
        return {
            "approved": True,
            "new_limit": requested_limit,
            "previous_limit": current_quota
        }
    
    async def get_quota_status(
        self,
        workspace_id: str,
        connector_id: str
    ) -> Dict:
        """Get current quota status for workspace."""
        
        config = self._get_config(connector_id, None)
        
        # Get current usage
        usage = await self._get_current_usage(workspace_id, connector_id, config)
        
        # Get quota
        quota = await self.db.get_workspace_quota(workspace_id, connector_id)
        
        # Get external state
        external = await self._get_external_state(connector_id)
        
        return {
            "connector_id": connector_id,
            "internal": {
                "limit": quota,
                "used": usage,
                "remaining": quota - usage,
                "reset_at": self._get_window_reset(config)
            },
            "external": {
                "limit": external.limit if external else None,
                "remaining": external.remaining if external else None,
                "reset_at": external.reset_at if external else None
            },
            "effective_remaining": min(
                quota - usage,
                external.remaining if external else float('inf')
            )
        }
    
    async def _check_external_limit(
        self,
        workspace_id: str,
        connector_id: str,
        config: RateLimitConfig
    ) -> RateLimitState:
        """Check external API rate limit."""
        
        # Check for active backoff
        backoff_until = await self.redis.get(f"backoff:{connector_id}")
        if backoff_until:
            backoff_time = float(backoff_until)
            if time.time() < backoff_time:
                return RateLimitState(
                    remaining=0,
                    limit=config.limit,
                    reset_at=backoff_time,
                    retry_after=int(backoff_time - time.time())
                )
        
        # Get cached external state
        state = await self._get_external_state(connector_id)
        
        if state:
            return state
        
        # Default to config limits
        return RateLimitState(
            remaining=config.limit,
            limit=config.limit,
            reset_at=time.time() + config.window_seconds,
            retry_after=None
        )
    
    async def _check_internal_limit(
        self,
        workspace_id: str,
        connector_id: str,
        action: str,
        config: RateLimitConfig
    ) -> RateLimitState:
        """Check internal quota limit."""
        
        key = f"quota:{workspace_id}:{connector_id}"
        
        if config.strategy == RateLimitStrategy.SLIDING_WINDOW:
            # Count requests in sliding window
            now = time.time()
            window_start = now - config.window_seconds
            
            count = await self.redis.zcount(key, window_start, now)
            quota = await self.db.get_workspace_quota(workspace_id, connector_id)
            
            return RateLimitState(
                remaining=quota - count,
                limit=quota,
                reset_at=now + config.window_seconds,
                retry_after=None
            )
        
        elif config.strategy == RateLimitStrategy.TOKEN_BUCKET:
            # Token bucket implementation
            bucket_key = f"bucket:{workspace_id}:{connector_id}"
            
            tokens, last_update = await self._get_bucket_state(bucket_key)
            
            # Refill tokens
            now = time.time()
            elapsed = now - last_update
            refill_rate = config.limit / config.window_seconds
            new_tokens = min(config.limit, tokens + (elapsed * refill_rate))
            
            return RateLimitState(
                remaining=int(new_tokens),
                limit=config.limit,
                reset_at=now + ((config.limit - new_tokens) / refill_rate),
                retry_after=None
            )
        
        # Default fixed window
        window_key = f"window:{workspace_id}:{connector_id}:{int(time.time() / config.window_seconds)}"
        count = await self.redis.get(window_key) or 0
        quota = await self.db.get_workspace_quota(workspace_id, connector_id)
        
        return RateLimitState(
            remaining=quota - int(count),
            limit=quota,
            reset_at=(int(time.time() / config.window_seconds) + 1) * config.window_seconds,
            retry_after=None
        )
    
    async def _learn_limit(self, connector_id: str):
        """Learn actual rate limit from 429 responses."""
        
        # Track 429 occurrences
        key = f"429_count:{connector_id}"
        count = await self.redis.incr(key)
        await self.redis.expire(key, 3600)
        
        # If getting many 429s, reduce our internal limit
        if count > 5:
            current = self._learned_limits.get(connector_id, self.CONFIGS.get(connector_id, {}).limit)
            new_limit = int(current * 0.8)  # Reduce by 20%
            self._learned_limits[connector_id] = new_limit
            
            self.metrics.gauge(f"rate_limit.learned.{connector_id}", new_limit)
```

---

## 3.7 Human Approval Checkpoints

```python
# ═══════════════════════════════════════════════════════════════════════════════
# HUMAN APPROVAL CHECKPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

"""
APPROVAL CHECKPOINT MODEL

Certain operations require human approval before execution:

1. Sensitive Operations
   - Sending emails
   - Posting to public channels
   - Financial transactions
   - Data deletion

2. High-Impact Operations
   - Bulk operations (>100 items)
   - Cross-workspace actions
   - Admin-level changes

3. Policy-Based
   - Workspace policies
   - Compliance requirements
   - Custom rules

Approval Flow:
1. Agent requests operation
2. System checks if approval needed
3. If needed, creates approval request
4. User receives notification
5. User approves/rejects
6. Agent continues or handles rejection
"""

from dataclasses import dataclass, field
from typing import List, Dict, Optional, Callable
from enum import Enum
import asyncio


class ApprovalStatus(Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class ApprovalUrgency(Enum):
    LOW = "low"          # Can wait hours
    NORMAL = "normal"    # Should respond within hour
    HIGH = "high"        # Needs response in minutes
    CRITICAL = "critical"  # Immediate response needed


@dataclass
class ApprovalRule:
    """Rule that triggers approval requirement."""
    id: str
    name: str
    description: str
    connector_id: Optional[str]  # None for all connectors
    action: Optional[str]  # None for all actions
    condition: str  # Expression to evaluate
    urgency: ApprovalUrgency
    expires_in_seconds: int
    notify_channels: List[str]  # "email", "slack", "push"
    auto_approve_after: Optional[int]  # Auto-approve if no response


@dataclass
class ApprovalRequest:
    """Request for human approval."""
    id: str
    workspace_id: str
    
    # Requester
    requester_type: str  # "agent", "user", "system"
    requester_id: str
    task_id: Optional[str]
    
    # Operation
    connector_id: str
    action: str
    params: Dict
    params_display: Dict  # Human-readable version
    
    # Rule that triggered
    rule_id: str
    rule_name: str
    
    # Status
    status: ApprovalStatus
    urgency: ApprovalUrgency
    
    # Timing
    created_at: float
    expires_at: float
    responded_at: Optional[float]
    
    # Response
    responder_id: Optional[str]
    response_reason: Optional[str]
    
    # Metadata
    context: Dict  # Additional context for decision


class ApprovalService:
    """
    Manages human approval checkpoints.
    
    Features:
    1. Rule-based approval triggers
    2. Multi-channel notifications
    3. Expiration handling
    4. Approval delegation
    """
    
    # Default approval rules
    DEFAULT_RULES = [
        ApprovalRule(
            id="sensitive_email",
            name="Email Sending",
            description="Requires approval to send emails",
            connector_id="google",
            action="send_email",
            condition="true",  # Always require
            urgency=ApprovalUrgency.NORMAL,
            expires_in_seconds=3600,
            notify_channels=["push", "email"],
            auto_approve_after=None
        ),
        ApprovalRule(
            id="public_post",
            name="Public Posting",
            description="Requires approval to post to public channels",
            connector_id="slack",
            action="send_message",
            condition="params.channel_type == 'public'",
            urgency=ApprovalUrgency.HIGH,
            expires_in_seconds=1800,
            notify_channels=["push"],
            auto_approve_after=None
        ),
        ApprovalRule(
            id="bulk_operation",
            name="Bulk Operations",
            description="Requires approval for operations affecting many items",
            connector_id=None,
            action=None,
            condition="params.count > 100 or params.items.length > 100",
            urgency=ApprovalUrgency.NORMAL,
            expires_in_seconds=7200,
            notify_channels=["email"],
            auto_approve_after=None
        ),
        ApprovalRule(
            id="financial",
            name="Financial Transactions",
            description="Requires approval for payments and refunds",
            connector_id="stripe",
            action=None,
            condition="action in ['create_charge', 'create_refund', 'create_subscription']",
            urgency=ApprovalUrgency.CRITICAL,
            expires_in_seconds=900,
            notify_channels=["push", "email", "slack"],
            auto_approve_after=None
        )
    ]
    
    def __init__(self, db, notification_service, rule_engine):
        self.db = db
        self.notifications = notification_service
        self.rules = rule_engine
        self._pending_requests: Dict[str, asyncio.Event] = {}
    
    async def check_approval_required(
        self,
        workspace_id: str,
        connector_id: str,
        action: str,
        params: Dict
    ) -> Optional[ApprovalRule]:
        """
        Check if operation requires approval.
        
        Returns the triggering rule if approval needed, None otherwise.
        """
        
        # Get workspace rules (custom + defaults)
        rules = await self._get_applicable_rules(workspace_id, connector_id, action)
        
        for rule in rules:
            # Evaluate condition
            if self.rules.evaluate(rule.condition, {
                "connector_id": connector_id,
                "action": action,
                "params": params
            }):
                return rule
        
        return None
    
    async def request_approval(
        self,
        workspace_id: str,
        requester_type: str,
        requester_id: str,
        connector_id: str,
        action: str,
        params: Dict,
        rule: ApprovalRule,
        task_id: Optional[str] = None,
        context: Optional[Dict] = None
    ) -> ApprovalRequest:
        """
        Create approval request and notify approvers.
        
        Returns the created request.
        """
        
        now = time.time()
        
        request = ApprovalRequest(
            id=str(uuid.uuid4()),
            workspace_id=workspace_id,
            requester_type=requester_type,
            requester_id=requester_id,
            task_id=task_id,
            connector_id=connector_id,
            action=action,
            params=params,
            params_display=self._format_params_for_display(params),
            rule_id=rule.id,
            rule_name=rule.name,
            status=ApprovalStatus.PENDING,
            urgency=rule.urgency,
            created_at=now,
            expires_at=now + rule.expires_in_seconds,
            responded_at=None,
            responder_id=None,
            response_reason=None,
            context=context or {}
        )
        
        await self.db.save_approval_request(request)
        
        # Create event for waiting
        self._pending_requests[request.id] = asyncio.Event()
        
        # Notify approvers
        await self._notify_approvers(request, rule)
        
        # Schedule expiration
        asyncio.create_task(self._handle_expiration(request.id, rule))
        
        return request
    
    async def wait_for_approval(
        self,
        request_id: str,
        timeout: Optional[float] = None
    ) -> ApprovalRequest:
        """
        Wait for approval response.
        
        Blocks until approved, rejected, or expired.
        """
        
        event = self._pending_requests.get(request_id)
        if not event:
            # Already resolved
            return await self.db.get_approval_request(request_id)
        
        try:
            await asyncio.wait_for(event.wait(), timeout=timeout)
        except asyncio.TimeoutError:
            pass
        
        return await self.db.get_approval_request(request_id)
    
    async def respond_to_approval(
        self,
        request_id: str,
        approved: bool,
        responder_id: str,
        reason: Optional[str] = None
    ) -> ApprovalRequest:
        """
        Respond to an approval request.
        
        Updates status and notifies waiting processes.
        """
        
        request = await self.db.get_approval_request(request_id)
        
        if not request:
            raise ValueError(f"Approval request not found: {request_id}")
        
        if request.status != ApprovalStatus.PENDING:
            raise ValueError(f"Request already resolved: {request.status}")
        
        # Check if expired
        if time.time() > request.expires_at:
            request.status = ApprovalStatus.EXPIRED
            await self.db.save_approval_request(request)
            raise ValueError("Approval request has expired")
        
        # Update request
        request.status = ApprovalStatus.APPROVED if approved else ApprovalStatus.REJECTED
        request.responded_at = time.time()
        request.responder_id = responder_id
        request.response_reason = reason
        
        await self.db.save_approval_request(request)
        
        # Signal waiting processes
        event = self._pending_requests.get(request_id)
        if event:
            event.set()
            del self._pending_requests[request_id]
        
        # Notify requester
        await self._notify_requester(request)
        
        return request
    
    async def _notify_approvers(
        self,
        request: ApprovalRequest,
        rule: ApprovalRule
    ):
        """Send notifications to approvers."""
        
        # Get approvers for workspace
        approvers = await self.db.get_workspace_approvers(request.workspace_id)
        
        notification_data = {
            "type": "approval_request",
            "request_id": request.id,
            "urgency": request.urgency.value,
            "connector": request.connector_id,
            "action": request.action,
            "rule_name": rule.name,
            "params_display": request.params_display,
            "expires_at": request.expires_at,
            "approve_url": f"https://app.manus.im/approvals/{request.id}/approve",
            "reject_url": f"https://app.manus.im/approvals/{request.id}/reject"
        }
        
        for channel in rule.notify_channels:
            for approver in approvers:
                await self.notifications.send(
                    user_id=approver.user_id,
                    channel=channel,
                    data=notification_data
                )
    
    async def _handle_expiration(
        self,
        request_id: str,
        rule: ApprovalRule
    ):
        """Handle request expiration."""
        
        # Wait until expiration
        request = await self.db.get_approval_request(request_id)
        wait_time = request.expires_at - time.time()
        
        if wait_time > 0:
            await asyncio.sleep(wait_time)
        
        # Check if still pending
        request = await self.db.get_approval_request(request_id)
        if request.status != ApprovalStatus.PENDING:
            return
        
        # Check for auto-approve
        if rule.auto_approve_after:
            request.status = ApprovalStatus.APPROVED
            request.responded_at = time.time()
            request.responder_id = "system"
            request.response_reason = "Auto-approved after timeout"
        else:
            request.status = ApprovalStatus.EXPIRED
        
        await self.db.save_approval_request(request)
        
        # Signal waiting processes
        event = self._pending_requests.get(request_id)
        if event:
            event.set()
            del self._pending_requests[request_id]
    
    def _format_params_for_display(self, params: Dict) -> Dict:
        """Format parameters for human-readable display."""
        
        def format_value(value):
            if isinstance(value, str) and len(value) > 200:
                return value[:200] + "..."
            elif isinstance(value, list) and len(value) > 10:
                return value[:10] + [f"... and {len(value) - 10} more"]
            elif isinstance(value, dict):
                return {k: format_value(v) for k, v in value.items()}
            return value
        
        return {k: format_value(v) for k, v in params.items()}
```

---

# SUMMARY: Real-World Application Possibilities

## Real-Time Collaboration Applications

1. **Collaborative Document Editing**: Build Google Docs-like experiences with OT-based text synchronization
2. **Multiplayer Design Tools**: Create Figma-like collaborative design environments
3. **Pair Programming Platforms**: Real-time code collaboration with cursor sharing
4. **Whiteboard Applications**: Collaborative brainstorming with CRDT-based shape synchronization
5. **Project Management**: Real-time task boards with presence awareness

## Email Workflow Applications

1. **Automated Support Tickets**: Convert emails to tasks with intelligent routing
2. **Invoice Processing**: Parse email attachments and trigger accounting workflows
3. **Lead Qualification**: Analyze incoming emails and route to appropriate sales agents
4. **Newsletter Management**: Automated subscription handling and bounce processing
5. **Compliance Monitoring**: Audit email communications for regulatory requirements

## Integration Applications

1. **Cross-Platform Automation**: Orchestrate workflows across GitHub, Slack, Google, etc.
2. **Data Synchronization**: Keep data consistent across multiple SaaS platforms
3. **Unified Dashboards**: Aggregate data from multiple sources with proper auth
4. **Automated Reporting**: Generate reports by pulling from multiple connectors
5. **Event-Driven Workflows**: React to events across platforms with saga transactions

---

This document provides the comprehensive technical foundation for understanding and building on the Manus platform's collaboration, email, and integration capabilities.
