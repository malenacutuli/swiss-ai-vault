# Manus Implementation Playbook Part 5: Operational Semantics

**Author:** Manus AI  
**Version:** 1.0.0  
**Date:** January 2026  
**Classification:** Implementation-Ready Technical Specification

---

## Table of Contents

1. [Real-Time Collaboration Semantics](#1-real-time-collaboration-semantics)
2. [Cross-Tool Memory & Re-planning Rules](#2-cross-tool-memory--re-planning-rules)
3. [Email-Triggered Workflows](#3-email-triggered-workflows)
4. [Live Credit Attribution](#4-live-credit-attribution)

---

## 1. Real-Time Collaboration Semantics

### 1.1 Cursor Locking Mechanism

The cursor locking system prevents conflicts when multiple users interact with the same document region simultaneously.

#### 1.1.1 Lock Types

| Lock Type | Scope | Duration | Preemptable | Use Case |
|-----------|-------|----------|-------------|----------|
| `CURSOR_SOFT` | Character range | 2s auto-expire | Yes | Typing indicator |
| `CURSOR_HARD` | Block/paragraph | Until release | No (owner only) | Active editing |
| `SELECTION_LOCK` | Arbitrary range | 5s auto-expire | Yes | Text selection |
| `STRUCTURAL_LOCK` | Document section | Until release | Admin only | Major restructuring |
| `AI_GENERATION_LOCK` | Output region | Until complete | No | AI writing |

#### 1.1.2 Lock Schema

```sql
CREATE TABLE collab_cursor_locks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES collab_sessions(id) ON DELETE CASCADE,
  document_id UUID NOT NULL,
  user_id UUID NOT NULL,
  
  -- Lock specification
  lock_type VARCHAR(20) NOT NULL CHECK (lock_type IN (
    'CURSOR_SOFT', 'CURSOR_HARD', 'SELECTION_LOCK', 
    'STRUCTURAL_LOCK', 'AI_GENERATION_LOCK'
  )),
  
  -- Range definition (Yjs-compatible)
  range_start_path JSONB NOT NULL,  -- e.g., [0, 2, 5] = paragraph 0, line 2, char 5
  range_start_offset INT NOT NULL,
  range_end_path JSONB NOT NULL,
  range_end_offset INT NOT NULL,
  
  -- Metadata
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,  -- NULL = manual release only
  last_heartbeat TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Conflict resolution
  priority INT NOT NULL DEFAULT 0,  -- Higher = wins conflicts
  preempted_by UUID REFERENCES collab_cursor_locks(id),
  
  CONSTRAINT valid_range CHECK (
    range_start_path <= range_end_path OR 
    (range_start_path = range_end_path AND range_start_offset <= range_end_offset)
  )
);

CREATE INDEX idx_cursor_locks_document ON collab_cursor_locks(document_id, lock_type);
CREATE INDEX idx_cursor_locks_expiry ON collab_cursor_locks(expires_at) WHERE expires_at IS NOT NULL;
```

#### 1.1.3 Lock Acquisition Algorithm

```typescript
interface LockRequest {
  sessionId: string;
  documentId: string;
  userId: string;
  lockType: LockType;
  range: DocumentRange;
  priority?: number;
}

interface LockResult {
  success: boolean;
  lockId?: string;
  conflictingLocks?: ConflictingLock[];
  waitEstimate?: number;  // ms until lock likely available
}

class CursorLockManager {
  private readonly LOCK_TIMEOUTS: Record<LockType, number> = {
    CURSOR_SOFT: 2000,
    CURSOR_HARD: null,  // Manual release
    SELECTION_LOCK: 5000,
    STRUCTURAL_LOCK: null,
    AI_GENERATION_LOCK: null,
  };

  async acquireLock(request: LockRequest): Promise<LockResult> {
    const { sessionId, documentId, userId, lockType, range, priority = 0 } = request;
    
    // Step 1: Find overlapping locks
    const overlapping = await this.findOverlappingLocks(documentId, range);
    
    // Step 2: Check if acquisition is possible
    const blockers = overlapping.filter(lock => {
      // Same user can upgrade their own locks
      if (lock.userId === userId) return false;
      
      // Soft locks are always preemptable
      if (lock.lockType === 'CURSOR_SOFT') return false;
      
      // AI locks block everything except admin
      if (lock.lockType === 'AI_GENERATION_LOCK') return true;
      
      // Priority-based preemption
      if (priority > lock.priority + 10) return false;  // +10 threshold to prevent thrashing
      
      return true;
    });
    
    if (blockers.length > 0) {
      return {
        success: false,
        conflictingLocks: blockers.map(this.toConflictInfo),
        waitEstimate: this.estimateWaitTime(blockers),
      };
    }
    
    // Step 3: Preempt lower-priority locks
    const toPreempt = overlapping.filter(lock => 
      lock.userId !== userId && 
      lock.lockType !== 'AI_GENERATION_LOCK' &&
      (lock.lockType === 'CURSOR_SOFT' || priority > lock.priority + 10)
    );
    
    await this.preemptLocks(toPreempt, request);
    
    // Step 4: Create new lock
    const expiresAt = this.LOCK_TIMEOUTS[lockType] 
      ? new Date(Date.now() + this.LOCK_TIMEOUTS[lockType])
      : null;
    
    const lockId = await this.db.insert('collab_cursor_locks', {
      sessionId,
      documentId,
      userId,
      lockType,
      rangeStartPath: range.start.path,
      rangeStartOffset: range.start.offset,
      rangeEndPath: range.end.path,
      rangeEndOffset: range.end.offset,
      priority,
      expiresAt,
    });
    
    // Step 5: Broadcast lock acquisition
    await this.broadcastLockChange(documentId, {
      type: 'LOCK_ACQUIRED',
      lockId,
      userId,
      lockType,
      range,
    });
    
    return { success: true, lockId };
  }

  async releaseLock(lockId: string, userId: string): Promise<void> {
    const lock = await this.db.get('collab_cursor_locks', lockId);
    
    if (!lock) return;  // Already released
    
    // Only owner or admin can release
    if (lock.userId !== userId && !await this.isAdmin(userId)) {
      throw new ForbiddenError('Cannot release lock owned by another user');
    }
    
    await this.db.delete('collab_cursor_locks', lockId);
    
    await this.broadcastLockChange(lock.documentId, {
      type: 'LOCK_RELEASED',
      lockId,
      userId: lock.userId,
    });
  }

  // Heartbeat to keep manual locks alive
  async heartbeat(lockId: string): Promise<boolean> {
    const updated = await this.db.update('collab_cursor_locks', lockId, {
      lastHeartbeat: new Date(),
    });
    
    return updated > 0;
  }

  // Background job: clean up stale locks
  async cleanupStaleLocks(): Promise<number> {
    const HEARTBEAT_TIMEOUT = 30000;  // 30s without heartbeat = stale
    
    const stale = await this.db.query(`
      DELETE FROM collab_cursor_locks
      WHERE (expires_at IS NOT NULL AND expires_at < NOW())
         OR (expires_at IS NULL AND last_heartbeat < NOW() - INTERVAL '${HEARTBEAT_TIMEOUT}ms')
      RETURNING document_id, id, user_id
    `);
    
    // Broadcast releases
    for (const lock of stale) {
      await this.broadcastLockChange(lock.documentId, {
        type: 'LOCK_EXPIRED',
        lockId: lock.id,
        userId: lock.userId,
      });
    }
    
    return stale.length;
  }

  private async findOverlappingLocks(
    documentId: string, 
    range: DocumentRange
  ): Promise<CursorLock[]> {
    // Yjs paths are arrays, so we need JSONB containment checks
    return this.db.query(`
      SELECT * FROM collab_cursor_locks
      WHERE document_id = $1
        AND NOT (
          range_end_path < $2::jsonb OR
          range_start_path > $3::jsonb OR
          (range_end_path = $2::jsonb AND range_end_offset < $4) OR
          (range_start_path = $3::jsonb AND range_start_offset > $5)
        )
    `, [
      documentId,
      JSON.stringify(range.start.path),
      JSON.stringify(range.end.path),
      range.start.offset,
      range.end.offset,
    ]);
  }
}
```

### 1.2 Prompt Ownership Model

When AI is generating content, ownership determines who can modify, cancel, or redirect the generation.

#### 1.2.1 Ownership States

```typescript
enum PromptOwnershipState {
  // Initial states
  DRAFTING = 'DRAFTING',           // User is typing prompt
  SUBMITTED = 'SUBMITTED',         // Prompt sent, awaiting AI
  
  // Active states
  AI_GENERATING = 'AI_GENERATING', // AI is producing output
  AI_PAUSED = 'AI_PAUSED',         // User requested pause
  
  // Terminal states
  COMPLETED = 'COMPLETED',         // AI finished successfully
  CANCELLED = 'CANCELLED',         // User cancelled
  FAILED = 'FAILED',               // AI error
  TRANSFERRED = 'TRANSFERRED',     // Ownership changed
}

interface PromptOwnership {
  promptId: string;
  runId: string;
  documentId: string;
  
  // Ownership
  originalOwnerId: string;    // Who submitted the prompt
  currentOwnerId: string;     // Who currently controls it
  ownershipHistory: OwnershipTransfer[];
  
  // State
  state: PromptOwnershipState;
  stateHistory: StateTransition[];
  
  // Permissions
  canCancel: string[];        // User IDs who can cancel
  canModify: string[];        // User IDs who can edit output
  canTransfer: string[];      // User IDs who can transfer ownership
  
  // Credit attribution
  creditChargedTo: string;    // Always the CURRENT owner
  creditReservation: string;  // Reservation ID
}

interface OwnershipTransfer {
  fromUserId: string;
  toUserId: string;
  transferredAt: Date;
  reason: 'EXPLICIT' | 'TIMEOUT' | 'DISCONNECT' | 'ADMIN';
  creditsTransferred: number;
}
```

#### 1.2.2 Ownership Transfer Rules

```typescript
class PromptOwnershipManager {
  /**
   * RULE 1: Only current owner can transfer ownership
   * RULE 2: Transfer moves credit liability to new owner
   * RULE 3: Original owner retains read access forever
   * RULE 4: Transfer during AI_GENERATING requires new owner acceptance
   */
  
  async transferOwnership(
    promptId: string,
    fromUserId: string,
    toUserId: string,
    reason: TransferReason
  ): Promise<TransferResult> {
    const ownership = await this.getOwnership(promptId);
    
    // Validate transfer is allowed
    if (ownership.currentOwnerId !== fromUserId) {
      throw new ForbiddenError('Only current owner can transfer');
    }
    
    if (!ownership.canTransfer.includes(fromUserId)) {
      throw new ForbiddenError('Transfer not permitted for this prompt');
    }
    
    // Check new owner has sufficient credits
    const estimatedRemaining = await this.estimateRemainingCost(promptId);
    const newOwnerCredits = await this.creditService.getBalance(toUserId);
    
    if (newOwnerCredits < estimatedRemaining) {
      throw new InsufficientCreditsError(
        `New owner needs ${estimatedRemaining} credits, has ${newOwnerCredits}`
      );
    }
    
    // If AI is generating, require acceptance
    if (ownership.state === 'AI_GENERATING') {
      return this.initiateTransferRequest(ownership, toUserId, reason);
    }
    
    // Execute transfer
    return this.executeTransfer(ownership, toUserId, reason);
  }

  private async executeTransfer(
    ownership: PromptOwnership,
    toUserId: string,
    reason: TransferReason
  ): Promise<TransferResult> {
    const fromUserId = ownership.currentOwnerId;
    
    // Step 1: Transfer credit reservation
    const creditsTransferred = await this.creditService.transferReservation(
      ownership.creditReservation,
      fromUserId,
      toUserId
    );
    
    // Step 2: Update ownership record
    await this.db.update('prompt_ownership', ownership.promptId, {
      currentOwnerId: toUserId,
      creditChargedTo: toUserId,
      ownershipHistory: [
        ...ownership.ownershipHistory,
        {
          fromUserId,
          toUserId,
          transferredAt: new Date(),
          reason,
          creditsTransferred,
        },
      ],
    });
    
    // Step 3: Update permissions
    await this.updatePermissions(ownership.promptId, {
      canCancel: [toUserId],
      canModify: [toUserId, fromUserId],  // Original owner keeps modify
      canTransfer: [toUserId],
    });
    
    // Step 4: Notify both parties
    await this.notifyTransfer(ownership, fromUserId, toUserId, creditsTransferred);
    
    return {
      success: true,
      newOwnerId: toUserId,
      creditsTransferred,
    };
  }

  /**
   * Auto-transfer on disconnect:
   * - If owner disconnects during AI_GENERATING
   * - Wait 30s for reconnect
   * - Then transfer to next participant (by join order)
   * - If no participants, pause generation
   */
  async handleOwnerDisconnect(promptId: string): Promise<void> {
    const ownership = await this.getOwnership(promptId);
    
    if (ownership.state !== 'AI_GENERATING') return;
    
    // Wait for reconnect
    await sleep(30000);
    
    // Check if reconnected
    const stillDisconnected = await this.isUserDisconnected(
      ownership.currentOwnerId,
      ownership.documentId
    );
    
    if (!stillDisconnected) return;
    
    // Find next participant
    const participants = await this.getSessionParticipants(ownership.documentId);
    const nextOwner = participants.find(p => 
      p.userId !== ownership.currentOwnerId && 
      p.status === 'CONNECTED'
    );
    
    if (nextOwner) {
      await this.executeTransfer(ownership, nextOwner.userId, 'DISCONNECT');
    } else {
      // No one to transfer to - pause generation
      await this.pauseGeneration(promptId, 'OWNER_DISCONNECTED');
    }
  }
}
```

### 1.3 Conflict Resolution Rules

#### 1.3.1 Conflict Types and Resolution Matrix

| Conflict Type | Detection | Resolution | Winner |
|---------------|-----------|------------|--------|
| **Concurrent Edit** | Same range, different content | 3-way merge | Both (merged) |
| **Delete vs Edit** | One deletes, one edits same range | Keep edit | Editor |
| **Structural vs Content** | One restructures, one edits content | Preserve content in new structure | Both |
| **AI vs Human** | AI generating, human edits output | Human wins | Human |
| **Human vs Human** | Two humans edit same range | Last-write-wins with merge | Later |
| **Format vs Content** | One formats, one changes text | Apply both | Both |

#### 1.3.2 Conflict Resolution Engine

```typescript
interface ConflictResolution {
  conflictId: string;
  documentId: string;
  
  // Conflicting operations
  operation1: YjsOperation;
  operation2: YjsOperation;
  
  // Resolution
  resolutionStrategy: ResolutionStrategy;
  resolvedOperation: YjsOperation;
  
  // Audit
  resolvedAt: Date;
  resolvedBy: 'AUTOMATIC' | 'MANUAL' | 'AI_ASSISTED';
  humanOverride?: {
    userId: string;
    reason: string;
  };
}

enum ResolutionStrategy {
  MERGE_BOTH = 'MERGE_BOTH',
  KEEP_FIRST = 'KEEP_FIRST',
  KEEP_SECOND = 'KEEP_SECOND',
  TRANSFORM = 'TRANSFORM',
  MANUAL_REQUIRED = 'MANUAL_REQUIRED',
}

class ConflictResolver {
  /**
   * Core resolution algorithm based on Operational Transformation
   * with Yjs-specific optimizations
   */
  
  async resolveConflict(
    op1: YjsOperation,
    op2: YjsOperation,
    context: ResolutionContext
  ): Promise<ConflictResolution> {
    // Step 1: Classify conflict type
    const conflictType = this.classifyConflict(op1, op2);
    
    // Step 2: Check for human override rules
    if (this.isHumanVsAI(op1, op2)) {
      return this.resolveHumanWins(op1, op2, context);
    }
    
    // Step 3: Apply resolution strategy
    switch (conflictType) {
      case 'CONCURRENT_EDIT':
        return this.resolveConcurrentEdit(op1, op2, context);
      
      case 'DELETE_VS_EDIT':
        return this.resolveDeleteVsEdit(op1, op2, context);
      
      case 'STRUCTURAL_VS_CONTENT':
        return this.resolveStructuralVsContent(op1, op2, context);
      
      case 'FORMAT_VS_CONTENT':
        return this.resolveFormatVsContent(op1, op2, context);
      
      default:
        return this.resolveLastWriteWins(op1, op2, context);
    }
  }

  private async resolveConcurrentEdit(
    op1: YjsOperation,
    op2: YjsOperation,
    context: ResolutionContext
  ): Promise<ConflictResolution> {
    // Use 3-way merge with common ancestor
    const ancestor = await this.findCommonAncestor(op1, op2, context.documentId);
    
    const merged = this.threeWayMerge(
      ancestor.content,
      op1.newContent,
      op2.newContent
    );
    
    if (merged.hasConflictMarkers) {
      // Cannot auto-merge - create conflict markers
      return {
        conflictId: generateId(),
        documentId: context.documentId,
        operation1: op1,
        operation2: op2,
        resolutionStrategy: ResolutionStrategy.MANUAL_REQUIRED,
        resolvedOperation: this.createConflictMarkerOp(op1, op2, merged),
        resolvedAt: new Date(),
        resolvedBy: 'AUTOMATIC',
      };
    }
    
    return {
      conflictId: generateId(),
      documentId: context.documentId,
      operation1: op1,
      operation2: op2,
      resolutionStrategy: ResolutionStrategy.MERGE_BOTH,
      resolvedOperation: {
        type: 'UPDATE',
        path: op1.path,
        content: merged.content,
        metadata: {
          mergedFrom: [op1.id, op2.id],
          mergeStrategy: '3-way',
        },
      },
      resolvedAt: new Date(),
      resolvedBy: 'AUTOMATIC',
    };
  }

  /**
   * CRITICAL RULE: Human always wins over AI
   * 
   * Rationale:
   * - User intent is paramount
   * - AI can regenerate, human edits are intentional
   * - Prevents frustration from AI overwriting user work
   */
  private resolveHumanVsAI(
    op1: YjsOperation,
    op2: YjsOperation,
    context: ResolutionContext
  ): ConflictResolution {
    const humanOp = op1.source === 'HUMAN' ? op1 : op2;
    const aiOp = op1.source === 'AI' ? op1 : op2;
    
    // Log for training data
    this.logHumanOverride(humanOp, aiOp, context);
    
    return {
      conflictId: generateId(),
      documentId: context.documentId,
      operation1: op1,
      operation2: op2,
      resolutionStrategy: ResolutionStrategy.KEEP_FIRST,
      resolvedOperation: humanOp,
      resolvedAt: new Date(),
      resolvedBy: 'AUTOMATIC',
    };
  }

  /**
   * Delete vs Edit: Preserve the edit
   * 
   * Rationale:
   * - Edits represent intentional content creation
   * - Deletes might be accidental or outdated
   * - User can always delete again if intended
   */
  private resolveDeleteVsEdit(
    op1: YjsOperation,
    op2: YjsOperation,
    context: ResolutionContext
  ): ConflictResolution {
    const editOp = op1.type === 'UPDATE' ? op1 : op2;
    const deleteOp = op1.type === 'DELETE' ? op1 : op2;
    
    // Notify the deleter that their delete was overridden
    this.notifyDeleteOverridden(deleteOp.userId, editOp, context);
    
    return {
      conflictId: generateId(),
      documentId: context.documentId,
      operation1: op1,
      operation2: op2,
      resolutionStrategy: ResolutionStrategy.KEEP_FIRST,
      resolvedOperation: editOp,
      resolvedAt: new Date(),
      resolvedBy: 'AUTOMATIC',
    };
  }

  private threeWayMerge(
    ancestor: string,
    version1: string,
    version2: string
  ): MergeResult {
    // Use diff-match-patch for character-level merging
    const dmp = new DiffMatchPatch();
    
    const patches1 = dmp.patch_make(ancestor, version1);
    const patches2 = dmp.patch_make(ancestor, version2);
    
    // Apply patches sequentially
    let [merged, results1] = dmp.patch_apply(patches1, ancestor);
    let [finalMerged, results2] = dmp.patch_apply(patches2, merged);
    
    // Check for conflicts (failed patches)
    const hasConflicts = results1.includes(false) || results2.includes(false);
    
    if (hasConflicts) {
      // Create conflict markers
      return {
        content: this.insertConflictMarkers(ancestor, version1, version2),
        hasConflictMarkers: true,
      };
    }
    
    return {
      content: finalMerged,
      hasConflictMarkers: false,
    };
  }
}
```

### 1.4 Session State Synchronization

#### 1.4.1 Session State Schema

```typescript
interface CollabSessionState {
  sessionId: string;
  documentId: string;
  
  // Participants
  participants: Map<string, ParticipantState>;
  
  // Document state
  yjsStateVector: Uint8Array;
  yjsUpdate: Uint8Array;
  
  // Awareness state (cursors, selections, presence)
  awarenessStates: Map<number, AwarenessState>;
  
  // Pending operations (not yet confirmed)
  pendingOps: PendingOperation[];
  
  // Sync metadata
  lastSyncedAt: Date;
  syncVersion: number;
}

interface ParticipantState {
  userId: string;
  clientId: number;  // Yjs client ID
  
  // Connection
  connectionState: 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'DISCONNECTED';
  lastSeenAt: Date;
  
  // Cursor
  cursor?: {
    path: number[];
    offset: number;
  };
  
  // Selection
  selection?: {
    anchor: { path: number[]; offset: number };
    focus: { path: number[]; offset: number };
  };
  
  // Activity
  isTyping: boolean;
  lastActivityAt: Date;
}
```

#### 1.4.2 Sync Protocol

```typescript
class CollabSyncProtocol {
  /**
   * Sync protocol based on Yjs with custom extensions:
   * 1. State vector exchange
   * 2. Update propagation
   * 3. Awareness sync
   * 4. Conflict detection
   */
  
  async syncClient(
    sessionId: string,
    clientId: number,
    clientStateVector: Uint8Array
  ): Promise<SyncResponse> {
    const session = await this.getSession(sessionId);
    
    // Step 1: Calculate diff
    const serverDoc = this.getYjsDoc(session.documentId);
    const diff = Y.encodeStateAsUpdate(serverDoc, clientStateVector);
    
    // Step 2: Get awareness states
    const awareness = this.getAwarenessStates(sessionId);
    
    // Step 3: Get pending operations for this client
    const pendingOps = session.pendingOps.filter(op => 
      op.targetClientId === clientId
    );
    
    return {
      update: diff,
      awarenessStates: awareness,
      pendingOps,
      serverStateVector: Y.encodeStateVector(serverDoc),
      syncVersion: session.syncVersion,
    };
  }

  async applyClientUpdate(
    sessionId: string,
    clientId: number,
    update: Uint8Array,
    metadata: UpdateMetadata
  ): Promise<ApplyResult> {
    const session = await this.getSession(sessionId);
    const serverDoc = this.getYjsDoc(session.documentId);
    
    // Step 1: Validate update
    const validation = this.validateUpdate(update, serverDoc);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Step 2: Check for conflicts
    const conflicts = this.detectConflicts(update, session.pendingOps);
    if (conflicts.length > 0) {
      const resolutions = await Promise.all(
        conflicts.map(c => this.conflictResolver.resolveConflict(
          c.clientOp,
          c.serverOp,
          { documentId: session.documentId, sessionId }
        ))
      );
      
      // Apply resolved operations instead
      update = this.applyResolutions(update, resolutions);
    }
    
    // Step 3: Apply update
    Y.applyUpdate(serverDoc, update);
    
    // Step 4: Broadcast to other clients
    await this.broadcastUpdate(sessionId, clientId, update, metadata);
    
    // Step 5: Persist
    await this.persistDocument(session.documentId, serverDoc);
    
    return {
      success: true,
      newStateVector: Y.encodeStateVector(serverDoc),
      syncVersion: ++session.syncVersion,
    };
  }

  /**
   * Awareness protocol for presence, cursors, selections
   */
  async updateAwareness(
    sessionId: string,
    clientId: number,
    awarenessUpdate: AwarenessUpdate
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    
    // Update local state
    session.awarenessStates.set(clientId, {
      ...session.awarenessStates.get(clientId),
      ...awarenessUpdate,
      lastUpdatedAt: new Date(),
    });
    
    // Broadcast to other clients (except sender)
    await this.broadcastAwareness(sessionId, clientId, awarenessUpdate);
  }

  /**
   * Handle client disconnect gracefully
   */
  async handleDisconnect(sessionId: string, clientId: number): Promise<void> {
    const session = await this.getSession(sessionId);
    const participant = session.participants.get(clientId.toString());
    
    if (!participant) return;
    
    // Update state
    participant.connectionState = 'DISCONNECTED';
    participant.lastSeenAt = new Date();
    
    // Release any locks held by this client
    await this.cursorLockManager.releaseAllLocks(participant.userId);
    
    // Broadcast disconnect
    await this.broadcastAwareness(sessionId, clientId, {
      type: 'DISCONNECT',
      userId: participant.userId,
    });
    
    // Check if owner disconnected during AI generation
    await this.promptOwnershipManager.handleOwnerDisconnect(
      session.activePromptId
    );
    
    // Start reconnect timer
    this.scheduleCleanup(sessionId, clientId, 60000);  // 60s grace period
  }
}
```

### 1.5 Presence Awareness Protocol

```typescript
interface PresenceState {
  userId: string;
  displayName: string;
  avatarUrl?: string;
  
  // Status
  status: 'ACTIVE' | 'IDLE' | 'AWAY' | 'OFFLINE';
  statusMessage?: string;
  
  // Activity
  currentActivity: 'VIEWING' | 'EDITING' | 'SELECTING' | 'AI_PROMPTING';
  activityTarget?: string;  // e.g., section ID being edited
  
  // Cursor (for collaborative editing)
  cursor?: CursorPosition;
  selection?: SelectionRange;
  
  // Timestamps
  joinedAt: Date;
  lastActiveAt: Date;
}

class PresenceManager {
  private readonly IDLE_TIMEOUT = 60000;      // 1 minute
  private readonly AWAY_TIMEOUT = 300000;     // 5 minutes
  private readonly OFFLINE_TIMEOUT = 600000;  // 10 minutes

  async updatePresence(
    sessionId: string,
    userId: string,
    update: Partial<PresenceState>
  ): Promise<void> {
    const current = await this.getPresence(sessionId, userId);
    
    const newState: PresenceState = {
      ...current,
      ...update,
      lastActiveAt: new Date(),
    };
    
    // Auto-set status based on activity
    if (update.currentActivity) {
      newState.status = 'ACTIVE';
    }
    
    await this.setPresence(sessionId, userId, newState);
    
    // Broadcast to session
    await this.broadcastPresence(sessionId, userId, newState);
  }

  /**
   * Background job: Update status based on inactivity
   */
  async updateInactiveStatuses(): Promise<void> {
    const now = Date.now();
    
    const allSessions = await this.getAllActiveSessions();
    
    for (const session of allSessions) {
      for (const [userId, presence] of session.participants) {
        const inactiveMs = now - presence.lastActiveAt.getTime();
        
        let newStatus: PresenceStatus;
        if (inactiveMs > this.OFFLINE_TIMEOUT) {
          newStatus = 'OFFLINE';
        } else if (inactiveMs > this.AWAY_TIMEOUT) {
          newStatus = 'AWAY';
        } else if (inactiveMs > this.IDLE_TIMEOUT) {
          newStatus = 'IDLE';
        } else {
          continue;  // Still active
        }
        
        if (presence.status !== newStatus) {
          await this.updatePresence(session.id, userId, { status: newStatus });
        }
      }
    }
  }

  /**
   * Get formatted presence list for UI
   */
  async getSessionPresence(sessionId: string): Promise<PresenceListItem[]> {
    const session = await this.getSession(sessionId);
    
    return Array.from(session.participants.values())
      .filter(p => p.status !== 'OFFLINE')
      .sort((a, b) => {
        // Sort by status priority, then by join time
        const statusPriority = { ACTIVE: 0, IDLE: 1, AWAY: 2 };
        const aPriority = statusPriority[a.status] ?? 3;
        const bPriority = statusPriority[b.status] ?? 3;
        
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.joinedAt.getTime() - b.joinedAt.getTime();
      })
      .map(p => ({
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: p.avatarUrl,
        status: p.status,
        activity: p.currentActivity,
        cursorColor: this.assignCursorColor(p.userId, sessionId),
      }));
  }
}
```

---

## 2. Cross-Tool Memory & Re-planning Rules

### 2.1 Plan Version Bump Triggers

A plan version bump occurs when the plan structure changes in a way that affects execution order or dependencies.

#### 2.1.1 Version Bump Rules

| Trigger | Version Bump | Rationale |
|---------|--------------|-----------|
| New step added | MINOR | Additive change, existing steps unaffected |
| Step removed | MAJOR | May invalidate dependent steps |
| Step reordered | MAJOR | Execution order changed |
| Step dependency changed | MAJOR | DAG structure modified |
| Step parameters modified | PATCH | Same structure, different inputs |
| Step timeout adjusted | PATCH | Operational change only |
| Goal clarification | MINOR | Same plan, clearer intent |
| Goal changed | MAJOR | Fundamental plan change |
| User feedback incorporated | MINOR | Refinement, not restructure |
| Error recovery replan | MAJOR | New execution path |

#### 2.1.2 Version Schema

```typescript
interface PlanVersion {
  major: number;  // Breaking changes
  minor: number;  // Additive changes
  patch: number;  // Parameter tweaks
  
  // Semantic version string
  toString(): string;  // e.g., "2.3.1"
}

interface PlanVersionHistory {
  planId: string;
  runId: string;
  
  versions: PlanVersionEntry[];
  currentVersion: PlanVersion;
  
  // Rollback support
  canRollbackTo: PlanVersion[];
}

interface PlanVersionEntry {
  version: PlanVersion;
  createdAt: Date;
  
  // What changed
  changeType: 'INITIAL' | 'STEP_ADDED' | 'STEP_REMOVED' | 'STEP_MODIFIED' | 
              'REORDERED' | 'DEPENDENCY_CHANGED' | 'GOAL_CHANGED' | 'ERROR_RECOVERY';
  changeDescription: string;
  
  // Diff from previous
  diff: PlanDiff;
  
  // Trigger
  triggeredBy: 'USER' | 'PLANNER' | 'SUPERVISOR' | 'ERROR_HANDLER';
  triggerContext?: string;
}
```

#### 2.1.3 Version Bump Algorithm

```typescript
class PlanVersionManager {
  async bumpVersion(
    planId: string,
    changeType: ChangeType,
    diff: PlanDiff
  ): Promise<PlanVersion> {
    const current = await this.getCurrentVersion(planId);
    
    let newVersion: PlanVersion;
    
    switch (this.classifyChange(changeType, diff)) {
      case 'BREAKING':
        newVersion = {
          major: current.major + 1,
          minor: 0,
          patch: 0,
        };
        break;
      
      case 'ADDITIVE':
        newVersion = {
          major: current.major,
          minor: current.minor + 1,
          patch: 0,
        };
        break;
      
      case 'PATCH':
        newVersion = {
          major: current.major,
          minor: current.minor,
          patch: current.patch + 1,
        };
        break;
    }
    
    // Record version entry
    await this.recordVersion(planId, {
      version: newVersion,
      createdAt: new Date(),
      changeType,
      changeDescription: this.generateChangeDescription(diff),
      diff,
      triggeredBy: this.getCurrentActor(),
    });
    
    // Notify dependent systems
    await this.notifyVersionBump(planId, current, newVersion, diff);
    
    return newVersion;
  }

  private classifyChange(changeType: ChangeType, diff: PlanDiff): ChangeClass {
    // BREAKING changes
    if ([
      'STEP_REMOVED',
      'REORDERED', 
      'DEPENDENCY_CHANGED',
      'GOAL_CHANGED',
      'ERROR_RECOVERY',
    ].includes(changeType)) {
      return 'BREAKING';
    }
    
    // Check if step modification affects outputs
    if (changeType === 'STEP_MODIFIED') {
      const outputsChanged = diff.modifiedSteps.some(s => 
        s.changes.includes('OUTPUT_SCHEMA')
      );
      if (outputsChanged) return 'BREAKING';
    }
    
    // ADDITIVE changes
    if (['STEP_ADDED', 'GOAL_CLARIFIED'].includes(changeType)) {
      return 'ADDITIVE';
    }
    
    // Everything else is PATCH
    return 'PATCH';
  }
}
```

### 2.2 Step Invalidation Rules

When a plan changes, some completed steps may need to be re-executed.

#### 2.2.1 Invalidation Matrix

| Change | Invalidates | Reason |
|--------|-------------|--------|
| Step removed | Dependent steps | Missing input |
| Step output schema changed | Consumers of output | Type mismatch |
| Step reordered before completed step | Steps after new position | Execution order violated |
| Input data changed | Step and all dependents | Stale computation |
| Tool version upgraded | Steps using that tool | Behavior may differ |
| Goal changed | All steps | New objective |
| Error in step | That step only | Retry needed |
| Timeout in step | That step only | Retry needed |

#### 2.2.2 Invalidation Engine

```typescript
interface StepInvalidation {
  stepId: string;
  reason: InvalidationReason;
  invalidatedAt: Date;
  
  // What triggered invalidation
  trigger: {
    type: 'PLAN_CHANGE' | 'DATA_CHANGE' | 'ERROR' | 'MANUAL';
    sourceStepId?: string;
    planVersion?: PlanVersion;
  };
  
  // Impact
  cascadeInvalidations: string[];  // Step IDs also invalidated
  
  // Recovery
  recoveryAction: 'RERUN' | 'SKIP' | 'MANUAL_REVIEW';
  estimatedRecoveryCost: number;  // Credits
}

class StepInvalidationEngine {
  /**
   * Invalidate a step and cascade to dependents
   */
  async invalidateStep(
    stepId: string,
    reason: InvalidationReason,
    trigger: InvalidationTrigger
  ): Promise<InvalidationResult> {
    const step = await this.getStep(stepId);
    const plan = await this.getPlan(step.planId);
    
    // Step 1: Mark step as invalidated
    await this.markInvalidated(stepId, reason, trigger);
    
    // Step 2: Find dependent steps
    const dependents = this.findDependentSteps(plan, stepId);
    
    // Step 3: Cascade invalidation
    const cascaded: string[] = [];
    for (const depId of dependents) {
      const depStep = plan.steps.find(s => s.id === depId);
      
      // Only invalidate if already completed
      if (depStep.status === 'COMPLETED') {
        await this.invalidateStep(depId, 'DEPENDENCY_INVALIDATED', {
          type: 'PLAN_CHANGE',
          sourceStepId: stepId,
        });
        cascaded.push(depId);
      }
    }
    
    // Step 4: Clear cached artifacts
    await this.clearStepArtifacts(stepId);
    for (const depId of cascaded) {
      await this.clearStepArtifacts(depId);
    }
    
    // Step 5: Estimate recovery cost
    const recoveryCost = await this.estimateRecoveryCost([stepId, ...cascaded]);
    
    return {
      invalidatedSteps: [stepId, ...cascaded],
      recoveryCost,
      requiresUserApproval: recoveryCost > this.AUTO_RECOVERY_THRESHOLD,
    };
  }

  /**
   * Check if a step's cached result can be reused
   */
  async canReuseResult(stepId: string): Promise<ReuseDecision> {
    const step = await this.getStep(stepId);
    const cachedResult = await this.getCachedResult(stepId);
    
    if (!cachedResult) {
      return { canReuse: false, reason: 'NO_CACHE' };
    }
    
    // Check 1: Step definition unchanged
    const definitionHash = this.hashStepDefinition(step);
    if (definitionHash !== cachedResult.definitionHash) {
      return { canReuse: false, reason: 'DEFINITION_CHANGED' };
    }
    
    // Check 2: Input data unchanged
    const inputHash = await this.hashStepInputs(step);
    if (inputHash !== cachedResult.inputHash) {
      return { canReuse: false, reason: 'INPUT_CHANGED' };
    }
    
    // Check 3: Tool version unchanged
    const toolVersion = await this.getToolVersion(step.toolName);
    if (toolVersion !== cachedResult.toolVersion) {
      return { canReuse: false, reason: 'TOOL_UPGRADED' };
    }
    
    // Check 4: Cache not expired
    const cacheAge = Date.now() - cachedResult.createdAt.getTime();
    if (cacheAge > this.getCacheTTL(step.toolName)) {
      return { canReuse: false, reason: 'CACHE_EXPIRED' };
    }
    
    // Check 5: No invalidation flag
    if (cachedResult.invalidated) {
      return { canReuse: false, reason: 'EXPLICITLY_INVALIDATED' };
    }
    
    return { canReuse: true, cachedResult };
  }

  private findDependentSteps(plan: Plan, stepId: string): string[] {
    const dependents: string[] = [];
    const visited = new Set<string>();
    
    const findRecursive = (currentId: string) => {
      for (const step of plan.steps) {
        if (visited.has(step.id)) continue;
        
        const dependsOnCurrent = step.dependencies?.includes(currentId) ||
          step.inputs?.some(i => i.sourceStepId === currentId);
        
        if (dependsOnCurrent) {
          visited.add(step.id);
          dependents.push(step.id);
          findRecursive(step.id);
        }
      }
    };
    
    findRecursive(stepId);
    return dependents;
  }
}
```

### 2.3 Cached Artifact Reuse Policy

#### 2.3.1 Cache Key Generation

```typescript
interface ArtifactCacheKey {
  // Content-based
  inputHash: string;        // SHA-256 of all inputs
  definitionHash: string;   // SHA-256 of step definition
  toolVersion: string;      // Tool semantic version
  
  // Context-based
  tenantId: string;         // Tenant isolation
  runId?: string;           // Optional: run-specific cache
  
  // Composite key
  toString(): string;
}

class ArtifactCacheKeyGenerator {
  generate(step: Step, inputs: StepInputs): ArtifactCacheKey {
    return {
      inputHash: this.hashInputs(inputs),
      definitionHash: this.hashDefinition(step),
      toolVersion: step.toolVersion,
      tenantId: step.tenantId,
      runId: step.cacheScope === 'RUN' ? step.runId : undefined,
      
      toString() {
        const parts = [
          this.tenantId,
          this.definitionHash.slice(0, 16),
          this.inputHash.slice(0, 16),
          this.toolVersion,
        ];
        if (this.runId) parts.push(this.runId);
        return parts.join(':');
      },
    };
  }

  private hashInputs(inputs: StepInputs): string {
    // Deterministic serialization
    const normalized = this.normalizeForHashing(inputs);
    return crypto.createHash('sha256')
      .update(JSON.stringify(normalized))
      .digest('hex');
  }

  private hashDefinition(step: Step): string {
    // Only hash execution-relevant fields
    const relevant = {
      toolName: step.toolName,
      toolConfig: step.toolConfig,
      outputSchema: step.outputSchema,
      retryPolicy: step.retryPolicy,
    };
    return crypto.createHash('sha256')
      .update(JSON.stringify(relevant))
      .digest('hex');
  }

  private normalizeForHashing(obj: unknown): unknown {
    if (obj === null || obj === undefined) return null;
    if (typeof obj !== 'object') return obj;
    if (Array.isArray(obj)) return obj.map(this.normalizeForHashing);
    
    // Sort object keys for deterministic serialization
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj).sort()) {
      sorted[key] = this.normalizeForHashing((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  }
}
```

#### 2.3.2 Cache Reuse Decision Tree

```typescript
class ArtifactCacheManager {
  /**
   * Decision tree for cache reuse:
   * 
   * 1. Is caching enabled for this tool? → No → MISS
   * 2. Does cache entry exist? → No → MISS
   * 3. Is cache entry valid (not expired/invalidated)? → No → MISS
   * 4. Are inputs identical? → No → MISS
   * 5. Is tool version compatible? → No → MISS
   * 6. Is tenant the same? → No → MISS (security)
   * 7. Does user have permission to reuse? → No → MISS
   * 8. → HIT
   */
  
  async lookup(
    step: Step,
    inputs: StepInputs,
    context: ExecutionContext
  ): Promise<CacheLookupResult> {
    // Step 1: Check if caching enabled
    const toolConfig = await this.getToolConfig(step.toolName);
    if (!toolConfig.cachingEnabled) {
      return { hit: false, reason: 'CACHING_DISABLED' };
    }
    
    // Step 2: Generate cache key
    const cacheKey = this.keyGenerator.generate(step, inputs);
    
    // Step 3: Lookup
    const entry = await this.cache.get(cacheKey.toString());
    if (!entry) {
      return { hit: false, reason: 'NOT_FOUND' };
    }
    
    // Step 4: Validate entry
    const validation = await this.validateEntry(entry, step, inputs, context);
    if (!validation.valid) {
      return { hit: false, reason: validation.reason };
    }
    
    // Step 5: Check permissions
    if (!await this.canReuseArtifact(entry, context.userId)) {
      return { hit: false, reason: 'PERMISSION_DENIED' };
    }
    
    // HIT!
    await this.recordCacheHit(cacheKey, entry, context);
    
    return {
      hit: true,
      artifact: entry.artifact,
      metadata: {
        cachedAt: entry.createdAt,
        originalRunId: entry.runId,
        reuseCount: entry.reuseCount + 1,
      },
    };
  }

  async store(
    step: Step,
    inputs: StepInputs,
    artifact: Artifact,
    context: ExecutionContext
  ): Promise<void> {
    const toolConfig = await this.getToolConfig(step.toolName);
    if (!toolConfig.cachingEnabled) return;
    
    const cacheKey = this.keyGenerator.generate(step, inputs);
    
    const entry: CacheEntry = {
      key: cacheKey.toString(),
      artifact,
      
      // Metadata
      stepId: step.id,
      runId: context.runId,
      tenantId: context.tenantId,
      toolName: step.toolName,
      toolVersion: step.toolVersion,
      
      // Hashes for validation
      inputHash: cacheKey.inputHash,
      definitionHash: cacheKey.definitionHash,
      
      // Lifecycle
      createdAt: new Date(),
      expiresAt: this.calculateExpiry(toolConfig),
      reuseCount: 0,
      
      // Provenance
      provenance: {
        originalStepId: step.id,
        originalRunId: context.runId,
        createdBy: context.userId,
      },
    };
    
    await this.cache.set(cacheKey.toString(), entry, {
      ttl: toolConfig.cacheTTL,
    });
  }

  /**
   * Cache invalidation strategies
   */
  async invalidate(pattern: InvalidationPattern): Promise<number> {
    switch (pattern.type) {
      case 'BY_STEP':
        return this.invalidateByStep(pattern.stepId);
      
      case 'BY_RUN':
        return this.invalidateByRun(pattern.runId);
      
      case 'BY_TOOL':
        return this.invalidateByTool(pattern.toolName, pattern.beforeVersion);
      
      case 'BY_TENANT':
        return this.invalidateByTenant(pattern.tenantId);
      
      case 'BY_AGE':
        return this.invalidateByAge(pattern.maxAge);
      
      default:
        throw new Error(`Unknown invalidation pattern: ${pattern.type}`);
    }
  }
}
```

### 2.4 Dynamic Re-planning Algorithm

```typescript
interface ReplanTrigger {
  type: 'ERROR' | 'USER_FEEDBACK' | 'NEW_INFORMATION' | 'GOAL_CHANGE' | 'TIMEOUT';
  context: Record<string, unknown>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface ReplanResult {
  newPlan: Plan;
  versionBump: PlanVersion;
  invalidatedSteps: string[];
  estimatedAdditionalCost: number;
  requiresApproval: boolean;
}

class DynamicReplanner {
  /**
   * Re-planning algorithm:
   * 
   * 1. Analyze trigger and current state
   * 2. Determine replan scope (full vs partial)
   * 3. Generate alternative plans
   * 4. Score and select best plan
   * 5. Calculate impact (invalidations, cost)
   * 6. Request approval if needed
   * 7. Execute transition
   */
  
  async replan(
    currentPlan: Plan,
    trigger: ReplanTrigger,
    context: ExecutionContext
  ): Promise<ReplanResult> {
    // Step 1: Analyze current state
    const analysis = await this.analyzeState(currentPlan, trigger);
    
    // Step 2: Determine scope
    const scope = this.determineReplanScope(trigger, analysis);
    
    // Step 3: Generate alternatives
    const alternatives = await this.generateAlternatives(
      currentPlan,
      scope,
      trigger,
      context
    );
    
    // Step 4: Score and select
    const scored = await Promise.all(
      alternatives.map(async plan => ({
        plan,
        score: await this.scorePlan(plan, currentPlan, context),
      }))
    );
    
    const best = scored.reduce((a, b) => a.score > b.score ? a : b);
    
    // Step 5: Calculate impact
    const impact = await this.calculateImpact(currentPlan, best.plan);
    
    // Step 6: Check if approval needed
    const requiresApproval = this.requiresApproval(impact, context);
    
    if (requiresApproval) {
      await this.requestApproval(currentPlan, best.plan, impact, context);
    }
    
    return {
      newPlan: best.plan,
      versionBump: impact.versionBump,
      invalidatedSteps: impact.invalidatedSteps,
      estimatedAdditionalCost: impact.additionalCost,
      requiresApproval,
    };
  }

  private determineReplanScope(
    trigger: ReplanTrigger,
    analysis: StateAnalysis
  ): ReplanScope {
    // FULL replan triggers
    if (trigger.type === 'GOAL_CHANGE') {
      return { type: 'FULL', reason: 'Goal fundamentally changed' };
    }
    
    if (trigger.severity === 'CRITICAL') {
      return { type: 'FULL', reason: 'Critical failure requires complete replan' };
    }
    
    // PARTIAL replan - from failed step onwards
    if (trigger.type === 'ERROR') {
      return {
        type: 'PARTIAL',
        fromStepId: analysis.failedStepId,
        reason: 'Replan from point of failure',
      };
    }
    
    // INCREMENTAL - add/modify specific steps
    if (trigger.type === 'NEW_INFORMATION') {
      return {
        type: 'INCREMENTAL',
        affectedSteps: analysis.stepsAffectedByNewInfo,
        reason: 'Incorporate new information',
      };
    }
    
    // Default: partial from current step
    return {
      type: 'PARTIAL',
      fromStepId: analysis.currentStepId,
      reason: 'Default partial replan',
    };
  }

  private async generateAlternatives(
    currentPlan: Plan,
    scope: ReplanScope,
    trigger: ReplanTrigger,
    context: ExecutionContext
  ): Promise<Plan[]> {
    const alternatives: Plan[] = [];
    
    // Strategy 1: Retry with different parameters
    if (trigger.type === 'ERROR') {
      const retryPlan = await this.generateRetryPlan(currentPlan, scope, trigger);
      if (retryPlan) alternatives.push(retryPlan);
    }
    
    // Strategy 2: Use alternative tools
    const altToolPlan = await this.generateAlternativeToolPlan(
      currentPlan,
      scope,
      context
    );
    if (altToolPlan) alternatives.push(altToolPlan);
    
    // Strategy 3: Decompose failed step into smaller steps
    const decomposedPlan = await this.generateDecomposedPlan(
      currentPlan,
      scope,
      trigger
    );
    if (decomposedPlan) alternatives.push(decomposedPlan);
    
    // Strategy 4: Skip optional steps
    const skippedPlan = await this.generateSkippedPlan(currentPlan, scope);
    if (skippedPlan) alternatives.push(skippedPlan);
    
    // Strategy 5: LLM-generated novel approach
    const novelPlan = await this.generateNovelPlan(
      currentPlan,
      scope,
      trigger,
      context
    );
    if (novelPlan) alternatives.push(novelPlan);
    
    // Ensure at least one alternative
    if (alternatives.length === 0) {
      throw new ReplanFailedError('No viable alternative plans generated');
    }
    
    return alternatives;
  }

  private async scorePlan(
    newPlan: Plan,
    currentPlan: Plan,
    context: ExecutionContext
  ): Promise<number> {
    let score = 100;
    
    // Factor 1: Estimated success probability (0-40 points)
    const successProb = await this.estimateSuccessProbability(newPlan);
    score += successProb * 40;
    
    // Factor 2: Cost efficiency (0-20 points)
    const costRatio = currentPlan.estimatedCost / newPlan.estimatedCost;
    score += Math.min(costRatio * 10, 20);
    
    // Factor 3: Reuse of completed work (0-20 points)
    const reuseRatio = this.calculateReuseRatio(currentPlan, newPlan);
    score += reuseRatio * 20;
    
    // Factor 4: Time to completion (0-10 points)
    const timeRatio = currentPlan.estimatedDuration / newPlan.estimatedDuration;
    score += Math.min(timeRatio * 5, 10);
    
    // Factor 5: Complexity penalty (-10 to 0 points)
    const complexityPenalty = (newPlan.steps.length - currentPlan.steps.length) * 0.5;
    score -= Math.max(complexityPenalty, 0);
    
    // Factor 6: User preference alignment (0-10 points)
    const preferenceScore = await this.scoreUserPreferences(newPlan, context);
    score += preferenceScore;
    
    return Math.max(0, Math.min(200, score));
  }
}
```

### 2.5 Memory Persistence Across Tools

```typescript
interface CrossToolMemory {
  runId: string;
  
  // Structured memory
  entities: Map<string, Entity>;           // Named entities discovered
  facts: Map<string, Fact>;                // Verified facts
  preferences: Map<string, Preference>;    // User preferences learned
  
  // Unstructured memory
  context: string[];                       // Relevant context snippets
  
  // Tool-specific memory
  toolMemories: Map<string, ToolMemory>;
  
  // Metadata
  createdAt: Date;
  lastAccessedAt: Date;
  accessCount: number;
}

interface ToolMemory {
  toolName: string;
  
  // What this tool learned
  discoveries: Discovery[];
  
  // What this tool produced
  outputs: ToolOutput[];
  
  // Errors encountered
  errors: ToolError[];
}

class CrossToolMemoryManager {
  /**
   * Memory is shared across tools within a run.
   * Each tool can read from and write to shared memory.
   * Memory is persisted for the duration of the run.
   */
  
  async getMemory(runId: string): Promise<CrossToolMemory> {
    let memory = await this.cache.get(`memory:${runId}`);
    
    if (!memory) {
      memory = await this.db.get('run_memory', runId);
    }
    
    if (!memory) {
      memory = this.createEmptyMemory(runId);
    }
    
    memory.lastAccessedAt = new Date();
    memory.accessCount++;
    
    return memory;
  }

  async addEntity(
    runId: string,
    entity: Entity,
    source: { toolName: string; stepId: string }
  ): Promise<void> {
    const memory = await this.getMemory(runId);
    
    // Check for existing entity with same identifier
    const existing = memory.entities.get(entity.id);
    
    if (existing) {
      // Merge entities
      const merged = this.mergeEntities(existing, entity);
      memory.entities.set(entity.id, merged);
    } else {
      memory.entities.set(entity.id, {
        ...entity,
        discoveredBy: source,
        discoveredAt: new Date(),
      });
    }
    
    await this.persistMemory(runId, memory);
  }

  async addFact(
    runId: string,
    fact: Fact,
    source: { toolName: string; stepId: string }
  ): Promise<void> {
    const memory = await this.getMemory(runId);
    
    // Check for contradicting facts
    const contradictions = this.findContradictions(memory.facts, fact);
    
    if (contradictions.length > 0) {
      // Resolve contradiction - prefer more recent, higher confidence
      const resolved = this.resolveContradiction(fact, contradictions);
      
      // Remove contradicted facts
      for (const c of contradictions) {
        if (c.superseded) {
          memory.facts.delete(c.id);
        }
      }
      
      memory.facts.set(resolved.id, resolved);
    } else {
      memory.facts.set(fact.id, {
        ...fact,
        discoveredBy: source,
        discoveredAt: new Date(),
      });
    }
    
    await this.persistMemory(runId, memory);
  }

  /**
   * Get relevant memory for a specific tool execution
   */
  async getRelevantMemory(
    runId: string,
    toolName: string,
    query: string
  ): Promise<RelevantMemory> {
    const memory = await this.getMemory(runId);
    
    // Get tool-specific memory
    const toolMemory = memory.toolMemories.get(toolName) || {
      toolName,
      discoveries: [],
      outputs: [],
      errors: [],
    };
    
    // Get relevant entities (semantic search)
    const relevantEntities = await this.semanticSearch(
      Array.from(memory.entities.values()),
      query,
      10
    );
    
    // Get relevant facts
    const relevantFacts = await this.semanticSearch(
      Array.from(memory.facts.values()),
      query,
      10
    );
    
    // Get relevant context
    const relevantContext = await this.semanticSearch(
      memory.context,
      query,
      5
    );
    
    return {
      entities: relevantEntities,
      facts: relevantFacts,
      context: relevantContext,
      toolHistory: toolMemory,
      preferences: memory.preferences,
    };
  }

  /**
   * Compress memory when it gets too large
   */
  async compressMemory(runId: string): Promise<void> {
    const memory = await this.getMemory(runId);
    
    // Summarize context
    if (memory.context.length > 100) {
      const summary = await this.summarizeContext(memory.context);
      memory.context = [summary, ...memory.context.slice(-20)];
    }
    
    // Remove low-confidence facts
    for (const [id, fact] of memory.facts) {
      if (fact.confidence < 0.3 && fact.accessCount < 2) {
        memory.facts.delete(id);
      }
    }
    
    // Merge similar entities
    memory.entities = this.deduplicateEntities(memory.entities);
    
    await this.persistMemory(runId, memory);
  }
}
```

---

## 3. Email-Triggered Workflows

### 3.1 Idempotent Email Ingestion

#### 3.1.1 Email Deduplication Schema

```sql
CREATE TABLE email_ingestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Email identifiers (for deduplication)
  message_id VARCHAR(255) NOT NULL,           -- RFC 5322 Message-ID
  in_reply_to VARCHAR(255),                   -- For threading
  references TEXT[],                          -- Full reference chain
  
  -- Idempotency
  idempotency_key VARCHAR(255) NOT NULL UNIQUE,  -- SHA-256(message_id + tenant_id)
  
  -- Processing state
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN (
    'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DUPLICATE', 'REJECTED'
  )),
  
  -- Email metadata
  tenant_id UUID NOT NULL,
  from_address VARCHAR(255) NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[],
  subject TEXT,
  received_at TIMESTAMPTZ NOT NULL,
  
  -- Content
  body_text TEXT,
  body_html TEXT,
  
  -- Attachments (stored in S3)
  attachments JSONB DEFAULT '[]',
  
  -- Processing result
  run_id UUID REFERENCES runs(id),
  processing_started_at TIMESTAMPTZ,
  processing_completed_at TIMESTAMPTZ,
  error_message TEXT,
  
  -- Audit
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  CONSTRAINT unique_message_per_tenant UNIQUE (tenant_id, message_id)
);

CREATE INDEX idx_email_ingestion_status ON email_ingestion(status, created_at);
CREATE INDEX idx_email_ingestion_thread ON email_ingestion(in_reply_to);
CREATE INDEX idx_email_ingestion_tenant ON email_ingestion(tenant_id, received_at DESC);
```

#### 3.1.2 Idempotent Ingestion Pipeline

```typescript
interface IncomingEmail {
  messageId: string;
  inReplyTo?: string;
  references?: string[];
  from: EmailAddress;
  to: EmailAddress[];
  cc?: EmailAddress[];
  subject: string;
  bodyText?: string;
  bodyHtml?: string;
  attachments: EmailAttachment[];
  receivedAt: Date;
  rawHeaders: Record<string, string>;
}

class EmailIngestionPipeline {
  /**
   * Idempotent email ingestion:
   * 1. Generate idempotency key
   * 2. Check for duplicate
   * 3. Validate sender
   * 4. Parse and sanitize
   * 5. Store attachments
   * 6. Create ingestion record
   * 7. Trigger workflow
   */
  
  async ingest(
    email: IncomingEmail,
    tenantId: string
  ): Promise<IngestionResult> {
    // Step 1: Generate idempotency key
    const idempotencyKey = this.generateIdempotencyKey(email.messageId, tenantId);
    
    // Step 2: Check for duplicate (atomic upsert)
    const existing = await this.db.query(`
      INSERT INTO email_ingestion (
        message_id, idempotency_key, tenant_id, from_address, 
        to_addresses, cc_addresses, subject, received_at,
        body_text, body_html, in_reply_to, references, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'PENDING')
      ON CONFLICT (idempotency_key) DO NOTHING
      RETURNING id, status
    `, [
      email.messageId,
      idempotencyKey,
      tenantId,
      email.from.address,
      email.to.map(e => e.address),
      email.cc?.map(e => e.address),
      email.subject,
      email.receivedAt,
      email.bodyText,
      email.bodyHtml,
      email.inReplyTo,
      email.references,
    ]);
    
    if (!existing) {
      // Duplicate - return existing record
      const duplicate = await this.db.get('email_ingestion', { idempotencyKey });
      return {
        status: 'DUPLICATE',
        existingId: duplicate.id,
        existingRunId: duplicate.runId,
      };
    }
    
    const ingestionId = existing.id;
    
    try {
      // Step 3: Validate sender
      const validation = await this.validateSender(email, tenantId);
      if (!validation.valid) {
        await this.markRejected(ingestionId, validation.reason);
        return { status: 'REJECTED', reason: validation.reason };
      }
      
      // Step 4: Parse and sanitize
      const sanitized = await this.sanitizeEmail(email);
      
      // Step 5: Store attachments
      const storedAttachments = await this.storeAttachments(
        ingestionId,
        email.attachments,
        tenantId
      );
      
      await this.db.update('email_ingestion', ingestionId, {
        attachments: storedAttachments,
      });
      
      // Step 6: Trigger workflow
      const runId = await this.triggerWorkflow(ingestionId, sanitized, tenantId);
      
      await this.db.update('email_ingestion', ingestionId, {
        status: 'PROCESSING',
        runId,
        processingStartedAt: new Date(),
      });
      
      return { status: 'ACCEPTED', ingestionId, runId };
      
    } catch (error) {
      await this.markFailed(ingestionId, error.message);
      throw error;
    }
  }

  private generateIdempotencyKey(messageId: string, tenantId: string): string {
    return crypto.createHash('sha256')
      .update(`${tenantId}:${messageId}`)
      .digest('hex');
  }

  private async validateSender(
    email: IncomingEmail,
    tenantId: string
  ): Promise<ValidationResult> {
    // Check 1: Sender is authorized for this tenant
    const authorized = await this.isAuthorizedSender(email.from.address, tenantId);
    if (!authorized) {
      return { valid: false, reason: 'UNAUTHORIZED_SENDER' };
    }
    
    // Check 2: SPF/DKIM/DMARC validation
    const authResult = await this.validateEmailAuth(email);
    if (!authResult.passed) {
      return { valid: false, reason: `AUTH_FAILED: ${authResult.failure}` };
    }
    
    // Check 3: Rate limiting
    const rateLimited = await this.checkRateLimit(email.from.address, tenantId);
    if (rateLimited) {
      return { valid: false, reason: 'RATE_LIMITED' };
    }
    
    // Check 4: Content policy
    const contentCheck = await this.checkContentPolicy(email);
    if (!contentCheck.passed) {
      return { valid: false, reason: `CONTENT_POLICY: ${contentCheck.violation}` };
    }
    
    return { valid: true };
  }
}
```

### 3.2 Attachment Provenance Tracking

```typescript
interface AttachmentProvenance {
  attachmentId: string;
  
  // Source
  emailIngestionId: string;
  originalFilename: string;
  originalMimeType: string;
  originalSize: number;
  
  // Storage
  storageKey: string;
  storageBucket: string;
  contentHash: string;  // SHA-256 of content
  
  // Processing
  processedAt?: Date;
  processedBy?: string;  // Tool that processed it
  extractedContent?: string;  // Text extraction result
  
  // Security
  scannedAt: Date;
  scanResult: 'CLEAN' | 'SUSPICIOUS' | 'MALICIOUS';
  scanDetails?: string;
  
  // Lineage
  derivedFrom?: string;  // Parent attachment ID
  derivatives: string[];  // Child attachment IDs
}

class AttachmentProvenanceManager {
  async trackAttachment(
    attachment: EmailAttachment,
    ingestionId: string,
    tenantId: string
  ): Promise<AttachmentProvenance> {
    // Step 1: Calculate content hash
    const contentHash = crypto.createHash('sha256')
      .update(attachment.content)
      .digest('hex');
    
    // Step 2: Check for existing attachment with same hash (dedup)
    const existing = await this.findByContentHash(contentHash, tenantId);
    if (existing) {
      // Link to existing instead of storing duplicate
      await this.linkAttachment(ingestionId, existing.attachmentId);
      return existing;
    }
    
    // Step 3: Scan for malware
    const scanResult = await this.scanAttachment(attachment);
    
    if (scanResult.result === 'MALICIOUS') {
      throw new MaliciousAttachmentError(
        `Attachment ${attachment.filename} flagged as malicious: ${scanResult.details}`
      );
    }
    
    // Step 4: Store in S3
    const storageKey = `attachments/${tenantId}/${ingestionId}/${contentHash}/${attachment.filename}`;
    await this.storage.put(storageKey, attachment.content, attachment.mimeType);
    
    // Step 5: Create provenance record
    const provenance: AttachmentProvenance = {
      attachmentId: generateId(),
      emailIngestionId: ingestionId,
      originalFilename: attachment.filename,
      originalMimeType: attachment.mimeType,
      originalSize: attachment.content.length,
      storageKey,
      storageBucket: this.config.bucket,
      contentHash,
      scannedAt: new Date(),
      scanResult: scanResult.result,
      scanDetails: scanResult.details,
      derivatives: [],
    };
    
    await this.db.insert('attachment_provenance', provenance);
    
    return provenance;
  }

  /**
   * Track when an attachment is processed/transformed
   */
  async trackProcessing(
    attachmentId: string,
    toolName: string,
    result: ProcessingResult
  ): Promise<void> {
    const provenance = await this.getProvenance(attachmentId);
    
    await this.db.update('attachment_provenance', attachmentId, {
      processedAt: new Date(),
      processedBy: toolName,
      extractedContent: result.extractedText,
    });
    
    // If processing created derivatives, track them
    if (result.derivatives) {
      for (const derivative of result.derivatives) {
        const derivedProvenance = await this.trackDerivedAttachment(
          attachmentId,
          derivative
        );
        provenance.derivatives.push(derivedProvenance.attachmentId);
      }
      
      await this.db.update('attachment_provenance', attachmentId, {
        derivatives: provenance.derivatives,
      });
    }
  }

  /**
   * Get full lineage of an attachment
   */
  async getLineage(attachmentId: string): Promise<AttachmentLineage> {
    const provenance = await this.getProvenance(attachmentId);
    
    // Get ancestors
    const ancestors: AttachmentProvenance[] = [];
    let current = provenance;
    while (current.derivedFrom) {
      const parent = await this.getProvenance(current.derivedFrom);
      ancestors.unshift(parent);
      current = parent;
    }
    
    // Get descendants
    const descendants = await this.getDescendants(attachmentId);
    
    return {
      attachment: provenance,
      ancestors,
      descendants,
      rootAttachment: ancestors[0] || provenance,
    };
  }
}
```

### 3.3 Reply-To Mapping and Threading

```typescript
interface EmailThread {
  threadId: string;
  tenantId: string;
  
  // Thread metadata
  subject: string;
  participants: EmailAddress[];
  
  // Messages in thread (ordered)
  messages: ThreadMessage[];
  
  // Associated runs
  runs: ThreadRun[];
  
  // State
  status: 'ACTIVE' | 'RESOLVED' | 'ARCHIVED';
  lastActivityAt: Date;
}

interface ThreadMessage {
  ingestionId: string;
  messageId: string;
  from: EmailAddress;
  receivedAt: Date;
  snippet: string;  // First 200 chars
  hasAttachments: boolean;
}

interface ThreadRun {
  runId: string;
  triggeredByMessageId: string;
  status: RunStatus;
  createdAt: Date;
}

class EmailThreadManager {
  /**
   * Threading algorithm:
   * 1. Check In-Reply-To header
   * 2. Check References header
   * 3. Fall back to subject matching
   * 4. Create new thread if no match
   */
  
  async findOrCreateThread(
    email: IncomingEmail,
    tenantId: string
  ): Promise<EmailThread> {
    // Strategy 1: In-Reply-To header
    if (email.inReplyTo) {
      const thread = await this.findThreadByMessageId(email.inReplyTo, tenantId);
      if (thread) {
        return this.addToThread(thread, email);
      }
    }
    
    // Strategy 2: References header
    if (email.references?.length) {
      for (const ref of email.references.reverse()) {  // Most recent first
        const thread = await this.findThreadByMessageId(ref, tenantId);
        if (thread) {
          return this.addToThread(thread, email);
        }
      }
    }
    
    // Strategy 3: Subject matching (with Re:/Fwd: normalization)
    const normalizedSubject = this.normalizeSubject(email.subject);
    const subjectMatch = await this.findThreadBySubject(
      normalizedSubject,
      email.from.address,
      tenantId,
      { maxAge: 7 * 24 * 60 * 60 * 1000 }  // 7 days
    );
    
    if (subjectMatch) {
      return this.addToThread(subjectMatch, email);
    }
    
    // Strategy 4: Create new thread
    return this.createThread(email, tenantId);
  }

  private normalizeSubject(subject: string): string {
    // Remove Re:, Fwd:, RE:, FW:, etc.
    return subject
      .replace(/^(re|fwd|fw):\s*/gi, '')
      .replace(/^\[.*?\]\s*/, '')  // Remove [tags]
      .trim()
      .toLowerCase();
  }

  /**
   * Generate reply-to address for outbound emails
   */
  generateReplyToAddress(
    threadId: string,
    tenantId: string
  ): string {
    // Format: run+{encoded_thread_id}@inbound.swissbrain.ai
    const encoded = this.encodeThreadId(threadId, tenantId);
    return `run+${encoded}@inbound.swissbrain.ai`;
  }

  /**
   * Parse reply-to address to find thread
   */
  async parseReplyToAddress(
    toAddress: string
  ): Promise<{ threadId: string; tenantId: string } | null> {
    const match = toAddress.match(/^run\+([a-zA-Z0-9_-]+)@inbound\.swissbrain\.ai$/);
    if (!match) return null;
    
    try {
      return this.decodeThreadId(match[1]);
    } catch {
      return null;
    }
  }

  private encodeThreadId(threadId: string, tenantId: string): string {
    const payload = JSON.stringify({ t: threadId, n: tenantId });
    const encrypted = this.encrypt(payload);
    return Buffer.from(encrypted).toString('base64url');
  }

  private decodeThreadId(encoded: string): { threadId: string; tenantId: string } {
    const encrypted = Buffer.from(encoded, 'base64url');
    const payload = this.decrypt(encrypted);
    const { t, n } = JSON.parse(payload);
    return { threadId: t, tenantId: n };
  }
}
```

### 3.4 Security Model (Spoofing, Loops)

```typescript
interface EmailSecurityConfig {
  // Authentication requirements
  requireSPF: boolean;
  requireDKIM: boolean;
  requireDMARC: boolean;
  
  // Rate limiting
  maxEmailsPerSenderPerHour: number;
  maxEmailsPerTenantPerHour: number;
  maxAttachmentSizeMB: number;
  maxAttachmentsPerEmail: number;
  
  // Loop prevention
  maxRepliesPerThread: number;
  maxAutoRepliesPerHour: number;
  loopDetectionWindow: number;  // ms
  
  // Content filtering
  blockedSenders: string[];
  blockedDomains: string[];
  allowedFileTypes: string[];
}

class EmailSecurityManager {
  /**
   * Comprehensive security checks for inbound email
   */
  
  async validateEmail(
    email: IncomingEmail,
    tenantId: string
  ): Promise<SecurityValidationResult> {
    const checks: SecurityCheck[] = [];
    
    // Check 1: SPF validation
    checks.push(await this.checkSPF(email));
    
    // Check 2: DKIM validation
    checks.push(await this.checkDKIM(email));
    
    // Check 3: DMARC validation
    checks.push(await this.checkDMARC(email));
    
    // Check 4: Sender reputation
    checks.push(await this.checkSenderReputation(email.from.address));
    
    // Check 5: Rate limiting
    checks.push(await this.checkRateLimits(email, tenantId));
    
    // Check 6: Loop detection
    checks.push(await this.checkForLoop(email, tenantId));
    
    // Check 7: Content policy
    checks.push(await this.checkContentPolicy(email));
    
    // Check 8: Attachment safety
    checks.push(await this.checkAttachments(email));
    
    // Aggregate results
    const failed = checks.filter(c => !c.passed);
    
    if (failed.length > 0) {
      // Log security event
      await this.logSecurityEvent({
        type: 'EMAIL_REJECTED',
        email: this.sanitizeForLog(email),
        tenantId,
        failedChecks: failed,
      });
    }
    
    return {
      valid: failed.length === 0,
      checks,
      failedChecks: failed,
    };
  }

  /**
   * Loop detection algorithm:
   * 1. Check if this is an auto-reply to our auto-reply
   * 2. Check for rapid back-and-forth
   * 3. Check for known loop patterns
   */
  private async checkForLoop(
    email: IncomingEmail,
    tenantId: string
  ): Promise<SecurityCheck> {
    // Check 1: Auto-Reply headers
    const autoReplyHeaders = [
      'Auto-Submitted',
      'X-Auto-Response-Suppress',
      'X-Autoreply',
      'X-Autorespond',
    ];
    
    for (const header of autoReplyHeaders) {
      if (email.rawHeaders[header]) {
        // This is an auto-reply - check if it's to our auto-reply
        const isReplyToUs = await this.isReplyToOurEmail(email, tenantId);
        if (isReplyToUs) {
          return {
            name: 'LOOP_DETECTION',
            passed: false,
            reason: 'Auto-reply to auto-reply detected',
          };
        }
      }
    }
    
    // Check 2: Rapid exchange detection
    const recentExchanges = await this.getRecentExchanges(
      email.from.address,
      tenantId,
      this.config.loopDetectionWindow
    );
    
    if (recentExchanges.length >= 5) {
      // 5+ emails in detection window = potential loop
      const isLoop = this.analyzeExchangePattern(recentExchanges);
      if (isLoop) {
        return {
          name: 'LOOP_DETECTION',
          passed: false,
          reason: 'Rapid exchange pattern detected',
        };
      }
    }
    
    // Check 3: Known loop patterns
    const knownPatterns = [
      /out of office/i,
      /automatic reply/i,
      /undeliverable/i,
      /delivery status notification/i,
    ];
    
    for (const pattern of knownPatterns) {
      if (pattern.test(email.subject) || pattern.test(email.bodyText || '')) {
        return {
          name: 'LOOP_DETECTION',
          passed: false,
          reason: `Known auto-reply pattern: ${pattern}`,
        };
      }
    }
    
    return { name: 'LOOP_DETECTION', passed: true };
  }

  /**
   * Prevent spoofing attacks
   */
  private async checkSPF(email: IncomingEmail): Promise<SecurityCheck> {
    const spfResult = email.rawHeaders['Received-SPF'] || 
                      email.rawHeaders['Authentication-Results'];
    
    if (!spfResult) {
      return {
        name: 'SPF',
        passed: !this.config.requireSPF,
        reason: 'No SPF result found',
      };
    }
    
    const passed = /spf=pass/i.test(spfResult);
    
    return {
      name: 'SPF',
      passed: passed || !this.config.requireSPF,
      reason: passed ? 'SPF passed' : 'SPF failed',
      details: spfResult,
    };
  }

  private async checkDKIM(email: IncomingEmail): Promise<SecurityCheck> {
    const authResults = email.rawHeaders['Authentication-Results'] || '';
    const passed = /dkim=pass/i.test(authResults);
    
    return {
      name: 'DKIM',
      passed: passed || !this.config.requireDKIM,
      reason: passed ? 'DKIM passed' : 'DKIM failed or missing',
      details: authResults,
    };
  }

  private async checkDMARC(email: IncomingEmail): Promise<SecurityCheck> {
    const authResults = email.rawHeaders['Authentication-Results'] || '';
    const passed = /dmarc=pass/i.test(authResults);
    
    return {
      name: 'DMARC',
      passed: passed || !this.config.requireDMARC,
      reason: passed ? 'DMARC passed' : 'DMARC failed or missing',
      details: authResults,
    };
  }

  /**
   * Safe outbound reply generation
   */
  async generateSafeReply(
    threadId: string,
    content: string,
    tenantId: string
  ): Promise<OutboundEmail> {
    // Check auto-reply rate limit
    const recentAutoReplies = await this.countRecentAutoReplies(tenantId);
    if (recentAutoReplies >= this.config.maxAutoRepliesPerHour) {
      throw new RateLimitError('Auto-reply rate limit exceeded');
    }
    
    const thread = await this.threadManager.getThread(threadId);
    
    // Generate safe headers
    const headers: Record<string, string> = {
      'Auto-Submitted': 'auto-replied',
      'X-Auto-Response-Suppress': 'All',
      'Precedence': 'bulk',
      'X-SwissBrain-Thread': threadId,
    };
    
    // Add References header for threading
    const references = thread.messages.map(m => m.messageId);
    if (references.length > 0) {
      headers['References'] = references.join(' ');
      headers['In-Reply-To'] = references[references.length - 1];
    }
    
    return {
      to: [thread.messages[thread.messages.length - 1].from],
      subject: `Re: ${thread.subject}`,
      body: content,
      headers,
      replyTo: this.threadManager.generateReplyToAddress(threadId, tenantId),
    };
  }
}
```

---

## 4. Live Credit Attribution

### 4.1 Real-Time Credit Tracking

```typescript
interface CreditTracker {
  runId: string;
  tenantId: string;
  ownerId: string;  // Who pays
  
  // Budget
  reservedCredits: number;
  usedCredits: number;
  remainingCredits: number;
  
  // Real-time tracking
  currentStepId?: string;
  currentStepStartCredits: number;
  
  // Breakdown
  breakdown: CreditBreakdown[];
  
  // Alerts
  alertThresholds: number[];  // e.g., [0.5, 0.8, 0.95]
  alertsSent: number[];
}

interface CreditBreakdown {
  stepId: string;
  toolName: string;
  
  // Token usage
  inputTokens: number;
  outputTokens: number;
  
  // Computed cost
  llmCredits: number;
  computeCredits: number;
  storageCredits: number;
  totalCredits: number;
  
  // Timing
  startedAt: Date;
  completedAt?: Date;
}

class RealTimeCreditTracker {
  private readonly UPDATE_INTERVAL = 1000;  // 1 second
  private trackers: Map<string, CreditTracker> = new Map();

  /**
   * Start tracking credits for a run
   */
  async startTracking(
    runId: string,
    tenantId: string,
    ownerId: string,
    reservedCredits: number
  ): Promise<CreditTracker> {
    const tracker: CreditTracker = {
      runId,
      tenantId,
      ownerId,
      reservedCredits,
      usedCredits: 0,
      remainingCredits: reservedCredits,
      currentStepStartCredits: 0,
      breakdown: [],
      alertThresholds: [0.5, 0.8, 0.95],
      alertsSent: [],
    };
    
    this.trackers.set(runId, tracker);
    
    // Start real-time sync
    this.startRealtimeSync(runId);
    
    return tracker;
  }

  /**
   * Record credit usage for a step
   */
  async recordUsage(
    runId: string,
    stepId: string,
    usage: CreditUsage
  ): Promise<CreditUpdateResult> {
    const tracker = this.trackers.get(runId);
    if (!tracker) {
      throw new Error(`No tracker for run ${runId}`);
    }
    
    // Calculate credits
    const credits = this.calculateCredits(usage);
    
    // Update tracker
    tracker.usedCredits += credits.total;
    tracker.remainingCredits = tracker.reservedCredits - tracker.usedCredits;
    
    // Add to breakdown
    const existingBreakdown = tracker.breakdown.find(b => b.stepId === stepId);
    if (existingBreakdown) {
      existingBreakdown.inputTokens += usage.inputTokens || 0;
      existingBreakdown.outputTokens += usage.outputTokens || 0;
      existingBreakdown.llmCredits += credits.llm;
      existingBreakdown.computeCredits += credits.compute;
      existingBreakdown.storageCredits += credits.storage;
      existingBreakdown.totalCredits += credits.total;
    } else {
      tracker.breakdown.push({
        stepId,
        toolName: usage.toolName,
        inputTokens: usage.inputTokens || 0,
        outputTokens: usage.outputTokens || 0,
        llmCredits: credits.llm,
        computeCredits: credits.compute,
        storageCredits: credits.storage,
        totalCredits: credits.total,
        startedAt: new Date(),
      });
    }
    
    // Check thresholds
    const usageRatio = tracker.usedCredits / tracker.reservedCredits;
    for (const threshold of tracker.alertThresholds) {
      if (usageRatio >= threshold && !tracker.alertsSent.includes(threshold)) {
        await this.sendThresholdAlert(tracker, threshold);
        tracker.alertsSent.push(threshold);
      }
    }
    
    // Check if budget exceeded
    if (tracker.remainingCredits <= 0) {
      return {
        success: false,
        budgetExceeded: true,
        usedCredits: tracker.usedCredits,
        remainingCredits: 0,
      };
    }
    
    // Persist update
    await this.persistTracker(tracker);
    
    // Broadcast to UI
    await this.broadcastUpdate(tracker);
    
    return {
      success: true,
      budgetExceeded: false,
      usedCredits: tracker.usedCredits,
      remainingCredits: tracker.remainingCredits,
    };
  }

  private calculateCredits(usage: CreditUsage): CreditCalculation {
    const llm = this.calculateLLMCredits(
      usage.inputTokens || 0,
      usage.outputTokens || 0,
      usage.model || 'default'
    );
    
    const compute = this.calculateComputeCredits(
      usage.computeTimeMs || 0,
      usage.computeTier || 'standard'
    );
    
    const storage = this.calculateStorageCredits(
      usage.storageBytesWritten || 0
    );
    
    return {
      llm,
      compute,
      storage,
      total: llm + compute + storage,
    };
  }

  private calculateLLMCredits(
    inputTokens: number,
    outputTokens: number,
    model: string
  ): number {
    // Pricing per 1M tokens (in credits)
    const pricing: Record<string, { input: number; output: number }> = {
      'claude-3-opus': { input: 15, output: 75 },
      'claude-3-sonnet': { input: 3, output: 15 },
      'claude-3-haiku': { input: 0.25, output: 1.25 },
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-4o': { input: 5, output: 15 },
      'default': { input: 3, output: 15 },
    };
    
    const rates = pricing[model] || pricing['default'];
    
    return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
  }

  /**
   * Real-time sync to database and UI
   */
  private startRealtimeSync(runId: string): void {
    const interval = setInterval(async () => {
      const tracker = this.trackers.get(runId);
      if (!tracker) {
        clearInterval(interval);
        return;
      }
      
      await this.persistTracker(tracker);
      await this.broadcastUpdate(tracker);
    }, this.UPDATE_INTERVAL);
  }

  private async broadcastUpdate(tracker: CreditTracker): Promise<void> {
    await this.pubsub.publish(`credits:${tracker.runId}`, {
      type: 'CREDIT_UPDATE',
      runId: tracker.runId,
      usedCredits: tracker.usedCredits,
      remainingCredits: tracker.remainingCredits,
      breakdown: tracker.breakdown,
      timestamp: new Date(),
    });
  }
}
```

### 4.2 Single-Payer Enforcement

```typescript
interface SinglePayerPolicy {
  /**
   * RULE: Only one user pays for a run, regardless of collaborators.
   * 
   * The payer is determined by:
   * 1. Run creator (default)
   * 2. Explicit transfer (ownership change)
   * 3. Organization billing (enterprise)
   */
  
  runId: string;
  payerId: string;
  payerType: 'USER' | 'ORGANIZATION';
  
  // Transfer history
  transfers: PayerTransfer[];
  
  // Enforcement
  enforceAtStep: boolean;  // Check before each step
  enforceAtTool: boolean;  // Check before each tool call
}

interface PayerTransfer {
  fromPayerId: string;
  toPayerId: string;
  transferredAt: Date;
  reason: 'EXPLICIT' | 'OWNERSHIP_CHANGE' | 'ORG_POLICY' | 'CREDIT_EXHAUSTED';
  creditsAtTransfer: number;
}

class SinglePayerEnforcer {
  /**
   * Enforce single-payer policy before execution
   */
  async enforceBeforeExecution(
    runId: string,
    stepId: string,
    estimatedCost: number
  ): Promise<EnforcementResult> {
    const policy = await this.getPolicy(runId);
    const payer = await this.getPayer(policy.payerId, policy.payerType);
    
    // Check 1: Payer has sufficient credits
    const balance = await this.creditService.getBalance(payer.id);
    if (balance < estimatedCost) {
      // Try to find alternative payer (org fallback)
      const alternative = await this.findAlternativePayer(policy, estimatedCost);
      
      if (alternative) {
        await this.transferPayer(policy, alternative, 'CREDIT_EXHAUSTED');
        return { allowed: true, payerId: alternative.id };
      }
      
      return {
        allowed: false,
        reason: 'INSUFFICIENT_CREDITS',
        payerId: payer.id,
        balance,
        required: estimatedCost,
      };
    }
    
    // Check 2: Payer account is active
    if (payer.status !== 'ACTIVE') {
      return {
        allowed: false,
        reason: 'PAYER_INACTIVE',
        payerId: payer.id,
      };
    }
    
    // Check 3: No billing holds
    const holds = await this.getBillingHolds(payer.id);
    if (holds.length > 0) {
      return {
        allowed: false,
        reason: 'BILLING_HOLD',
        payerId: payer.id,
        holds,
      };
    }
    
    return { allowed: true, payerId: payer.id };
  }

  /**
   * Handle payer change during collaboration
   */
  async handleOwnershipChange(
    runId: string,
    newOwnerId: string
  ): Promise<void> {
    const policy = await this.getPolicy(runId);
    const tracker = await this.creditTracker.getTracker(runId);
    
    // Calculate credits used so far
    const creditsUsed = tracker.usedCredits;
    
    // Finalize charges to old payer
    await this.creditService.finalizeCharges(
      policy.payerId,
      runId,
      creditsUsed
    );
    
    // Transfer remaining reservation to new payer
    const remainingReservation = tracker.reservedCredits - creditsUsed;
    
    // Check new payer has capacity
    const newPayerBalance = await this.creditService.getBalance(newOwnerId);
    if (newPayerBalance < remainingReservation) {
      throw new InsufficientCreditsError(
        `New owner needs ${remainingReservation} credits, has ${newPayerBalance}`
      );
    }
    
    // Create new reservation for new payer
    await this.creditService.createReservation(
      newOwnerId,
      runId,
      remainingReservation
    );
    
    // Update policy
    await this.transferPayer(policy, { id: newOwnerId }, 'OWNERSHIP_CHANGE');
    
    // Update tracker
    tracker.ownerId = newOwnerId;
    await this.creditTracker.persistTracker(tracker);
  }

  /**
   * Organization billing: charge org instead of user
   */
  async applyOrgBilling(
    runId: string,
    userId: string,
    orgId: string
  ): Promise<void> {
    const policy = await this.getPolicy(runId);
    
    // Check org billing policy
    const orgPolicy = await this.getOrgBillingPolicy(orgId);
    
    if (!orgPolicy.coverMemberUsage) {
      return;  // Org doesn't cover member usage
    }
    
    // Check if user is covered
    const isCovered = await this.isUserCoveredByOrg(userId, orgId);
    if (!isCovered) {
      return;
    }
    
    // Check org budget
    const orgBudget = await this.getOrgBudget(orgId);
    const tracker = await this.creditTracker.getTracker(runId);
    
    if (orgBudget.remaining < tracker.reservedCredits) {
      // Org can't cover - fall back to user
      return;
    }
    
    // Transfer to org billing
    await this.transferPayer(
      policy,
      { id: orgId, type: 'ORGANIZATION' },
      'ORG_POLICY'
    );
  }

  private async transferPayer(
    policy: SinglePayerPolicy,
    newPayer: { id: string; type?: 'USER' | 'ORGANIZATION' },
    reason: PayerTransfer['reason']
  ): Promise<void> {
    const transfer: PayerTransfer = {
      fromPayerId: policy.payerId,
      toPayerId: newPayer.id,
      transferredAt: new Date(),
      reason,
      creditsAtTransfer: await this.creditTracker.getUsedCredits(policy.runId),
    };
    
    policy.transfers.push(transfer);
    policy.payerId = newPayer.id;
    policy.payerType = newPayer.type || 'USER';
    
    await this.persistPolicy(policy);
    
    // Audit log
    await this.auditLog.log({
      type: 'PAYER_TRANSFER',
      runId: policy.runId,
      transfer,
    });
  }
}
```

### 4.3 Multi-Participant Billing Rules

```typescript
interface MultiParticipantBilling {
  /**
   * Rules for billing when multiple users collaborate:
   * 
   * 1. OWNER_PAYS (default): Run owner pays all costs
   * 2. SPLIT_EQUAL: Costs split equally among active participants
   * 3. SPLIT_BY_USAGE: Costs split by individual usage
   * 4. ORG_PAYS: Organization covers all member costs
   */
  
  runId: string;
  billingMode: 'OWNER_PAYS' | 'SPLIT_EQUAL' | 'SPLIT_BY_USAGE' | 'ORG_PAYS';
  
  // Participants
  participants: BillingParticipant[];
  
  // Usage tracking per participant
  usageByParticipant: Map<string, ParticipantUsage>;
}

interface BillingParticipant {
  userId: string;
  joinedAt: Date;
  leftAt?: Date;
  
  // Billing status
  billingEnabled: boolean;
  creditBalance: number;
  
  // Usage
  promptsSubmitted: number;
  tokensConsumed: number;
  creditsCharged: number;
}

interface ParticipantUsage {
  userId: string;
  
  // Prompts
  prompts: PromptUsage[];
  
  // Totals
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCredits: number;
}

class MultiParticipantBillingManager {
  /**
   * Calculate and apply billing for multi-participant run
   */
  async calculateBilling(
    runId: string
  ): Promise<BillingCalculation> {
    const billing = await this.getBilling(runId);
    const tracker = await this.creditTracker.getTracker(runId);
    
    switch (billing.billingMode) {
      case 'OWNER_PAYS':
        return this.calculateOwnerPays(billing, tracker);
      
      case 'SPLIT_EQUAL':
        return this.calculateSplitEqual(billing, tracker);
      
      case 'SPLIT_BY_USAGE':
        return this.calculateSplitByUsage(billing, tracker);
      
      case 'ORG_PAYS':
        return this.calculateOrgPays(billing, tracker);
    }
  }

  private calculateOwnerPays(
    billing: MultiParticipantBilling,
    tracker: CreditTracker
  ): BillingCalculation {
    // All costs go to owner
    return {
      charges: [{
        userId: tracker.ownerId,
        amount: tracker.usedCredits,
        breakdown: tracker.breakdown,
      }],
      totalCredits: tracker.usedCredits,
    };
  }

  private calculateSplitEqual(
    billing: MultiParticipantBilling,
    tracker: CreditTracker
  ): BillingCalculation {
    const activeParticipants = billing.participants.filter(p => p.billingEnabled);
    const splitAmount = tracker.usedCredits / activeParticipants.length;
    
    return {
      charges: activeParticipants.map(p => ({
        userId: p.userId,
        amount: splitAmount,
        breakdown: [],  // No per-user breakdown in equal split
      })),
      totalCredits: tracker.usedCredits,
    };
  }

  private calculateSplitByUsage(
    billing: MultiParticipantBilling,
    tracker: CreditTracker
  ): BillingCalculation {
    const charges: BillingCharge[] = [];
    
    for (const [userId, usage] of billing.usageByParticipant) {
      const participant = billing.participants.find(p => p.userId === userId);
      if (!participant?.billingEnabled) continue;
      
      charges.push({
        userId,
        amount: usage.totalCredits,
        breakdown: usage.prompts.map(p => ({
          stepId: p.stepId,
          toolName: p.toolName,
          inputTokens: p.inputTokens,
          outputTokens: p.outputTokens,
          totalCredits: p.credits,
        })),
      });
    }
    
    return {
      charges,
      totalCredits: tracker.usedCredits,
    };
  }

  /**
   * Track usage per participant
   */
  async trackParticipantUsage(
    runId: string,
    userId: string,
    usage: CreditUsage
  ): Promise<void> {
    const billing = await this.getBilling(runId);
    
    let participantUsage = billing.usageByParticipant.get(userId);
    if (!participantUsage) {
      participantUsage = {
        userId,
        prompts: [],
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCredits: 0,
      };
      billing.usageByParticipant.set(userId, participantUsage);
    }
    
    const credits = this.creditTracker.calculateCredits(usage);
    
    participantUsage.prompts.push({
      stepId: usage.stepId,
      toolName: usage.toolName,
      inputTokens: usage.inputTokens || 0,
      outputTokens: usage.outputTokens || 0,
      credits: credits.total,
      timestamp: new Date(),
    });
    
    participantUsage.totalInputTokens += usage.inputTokens || 0;
    participantUsage.totalOutputTokens += usage.outputTokens || 0;
    participantUsage.totalCredits += credits.total;
    
    await this.persistBilling(billing);
  }
}
```

### 4.4 Audit Trail for Billing Disputes

```typescript
interface BillingAuditEntry {
  id: string;
  runId: string;
  tenantId: string;
  
  // Event
  eventType: BillingEventType;
  eventData: Record<string, unknown>;
  
  // Context
  userId?: string;
  stepId?: string;
  toolName?: string;
  
  // Credits
  creditsBefore: number;
  creditsAfter: number;
  creditsDelta: number;
  
  // Timing
  occurredAt: Date;
  
  // Immutability
  hash: string;  // SHA-256 of entry + previous hash
  previousHash: string;
}

type BillingEventType = 
  | 'RESERVATION_CREATED'
  | 'RESERVATION_INCREASED'
  | 'RESERVATION_DECREASED'
  | 'CREDITS_CHARGED'
  | 'CREDITS_REFUNDED'
  | 'PAYER_TRANSFERRED'
  | 'BILLING_MODE_CHANGED'
  | 'DISPUTE_OPENED'
  | 'DISPUTE_RESOLVED';

class BillingAuditTrail {
  /**
   * Immutable audit trail for billing events.
   * Uses hash chain for tamper detection.
   */
  
  async recordEvent(
    runId: string,
    event: Omit<BillingAuditEntry, 'id' | 'hash' | 'previousHash' | 'occurredAt'>
  ): Promise<BillingAuditEntry> {
    // Get previous entry for hash chain
    const previousEntry = await this.getLatestEntry(runId);
    const previousHash = previousEntry?.hash || 'GENESIS';
    
    const entry: BillingAuditEntry = {
      id: generateId(),
      ...event,
      runId,
      occurredAt: new Date(),
      previousHash,
      hash: '',  // Will be calculated
    };
    
    // Calculate hash
    entry.hash = this.calculateHash(entry);
    
    // Store immutably
    await this.storeImmutable(entry);
    
    return entry;
  }

  /**
   * Verify audit trail integrity
   */
  async verifyIntegrity(runId: string): Promise<IntegrityResult> {
    const entries = await this.getAllEntries(runId);
    
    if (entries.length === 0) {
      return { valid: true, entries: 0 };
    }
    
    // Verify first entry
    if (entries[0].previousHash !== 'GENESIS') {
      return {
        valid: false,
        error: 'First entry does not have GENESIS previous hash',
        failedAt: entries[0].id,
      };
    }
    
    // Verify hash chain
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      
      // Verify entry hash
      const calculatedHash = this.calculateHash(entry);
      if (calculatedHash !== entry.hash) {
        return {
          valid: false,
          error: 'Entry hash mismatch - possible tampering',
          failedAt: entry.id,
        };
      }
      
      // Verify chain link
      if (i > 0 && entry.previousHash !== entries[i - 1].hash) {
        return {
          valid: false,
          error: 'Hash chain broken - possible tampering',
          failedAt: entry.id,
        };
      }
    }
    
    return { valid: true, entries: entries.length };
  }

  /**
   * Generate billing report for dispute resolution
   */
  async generateDisputeReport(
    runId: string,
    disputeId: string
  ): Promise<DisputeReport> {
    // Verify integrity first
    const integrity = await this.verifyIntegrity(runId);
    if (!integrity.valid) {
      throw new IntegrityError('Audit trail integrity check failed');
    }
    
    const entries = await this.getAllEntries(runId);
    const tracker = await this.creditTracker.getTracker(runId);
    
    // Build timeline
    const timeline = entries.map(e => ({
      timestamp: e.occurredAt,
      event: e.eventType,
      description: this.describeEvent(e),
      creditsDelta: e.creditsDelta,
      creditsAfter: e.creditsAfter,
    }));
    
    // Calculate totals
    const totals = {
      totalCharged: entries
        .filter(e => e.eventType === 'CREDITS_CHARGED')
        .reduce((sum, e) => sum + e.creditsDelta, 0),
      totalRefunded: entries
        .filter(e => e.eventType === 'CREDITS_REFUNDED')
        .reduce((sum, e) => sum + Math.abs(e.creditsDelta), 0),
      netCharged: tracker.usedCredits,
    };
    
    // Get breakdown by tool
    const byTool = new Map<string, number>();
    for (const entry of entries) {
      if (entry.eventType === 'CREDITS_CHARGED' && entry.toolName) {
        byTool.set(
          entry.toolName,
          (byTool.get(entry.toolName) || 0) + entry.creditsDelta
        );
      }
    }
    
    return {
      disputeId,
      runId,
      generatedAt: new Date(),
      integrityVerified: true,
      timeline,
      totals,
      breakdownByTool: Object.fromEntries(byTool),
      rawEntries: entries,
    };
  }

  private calculateHash(entry: BillingAuditEntry): string {
    const payload = JSON.stringify({
      id: entry.id,
      runId: entry.runId,
      tenantId: entry.tenantId,
      eventType: entry.eventType,
      eventData: entry.eventData,
      userId: entry.userId,
      stepId: entry.stepId,
      toolName: entry.toolName,
      creditsBefore: entry.creditsBefore,
      creditsAfter: entry.creditsAfter,
      creditsDelta: entry.creditsDelta,
      occurredAt: entry.occurredAt.toISOString(),
      previousHash: entry.previousHash,
    });
    
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  private async storeImmutable(entry: BillingAuditEntry): Promise<void> {
    // Use append-only storage
    await this.db.query(`
      INSERT INTO billing_audit_trail (
        id, run_id, tenant_id, event_type, event_data,
        user_id, step_id, tool_name,
        credits_before, credits_after, credits_delta,
        occurred_at, hash, previous_hash
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      entry.id,
      entry.runId,
      entry.tenantId,
      entry.eventType,
      JSON.stringify(entry.eventData),
      entry.userId,
      entry.stepId,
      entry.toolName,
      entry.creditsBefore,
      entry.creditsAfter,
      entry.creditsDelta,
      entry.occurredAt,
      entry.hash,
      entry.previousHash,
    ]);
    
    // Also write to immutable storage (S3 with object lock)
    await this.immutableStorage.put(
      `audit/${entry.runId}/${entry.id}.json`,
      JSON.stringify(entry),
      { objectLock: true }
    );
  }
}
```

---

## Summary

This document provides complete operational semantics for:

1. **Real-Time Collaboration**: Cursor locking with 5 lock types, prompt ownership with transfer rules, conflict resolution matrix (human always wins over AI), session state sync via Yjs, and presence awareness protocol.

2. **Cross-Tool Memory & Re-planning**: Plan version bump triggers (major/minor/patch), step invalidation rules with cascade, artifact cache reuse policy with content-addressed keys, dynamic re-planning algorithm with 5 strategies, and cross-tool memory persistence.

3. **Email-Triggered Workflows**: Idempotent ingestion with SHA-256 deduplication, attachment provenance with lineage tracking, reply-to mapping with encrypted thread IDs, and comprehensive security (SPF/DKIM/DMARC, loop detection, spoofing prevention).

4. **Live Credit Attribution**: Real-time tracking with 1-second sync, single-payer enforcement with transfer semantics, multi-participant billing modes (owner pays, split equal, split by usage, org pays), and immutable audit trail with hash chain for dispute resolution.

All implementations include exact TypeScript interfaces, database schemas, and pseudocode ready for production deployment.

---

**Document Version:** 1.0.0  
**Last Updated:** January 2026  
**Classification:** Implementation-Ready Technical Specification
