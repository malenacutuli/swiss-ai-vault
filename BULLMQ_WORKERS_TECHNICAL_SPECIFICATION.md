# BullMQ Workers: Complete Technical Specification

**Document Type:** Internal Engineering Handoff  
**Author:** Technical Lead  
**Date:** January 21, 2026  
**Status:** Implementation Ready

---

## Executive Summary

This document provides the complete technical specification for implementing BullMQ workers to handle long-running agent tasks. Edge Functions have a 30-second timeout limit, making them unsuitable for tasks that can run for minutes or hours. BullMQ provides reliable, persistent job queues with automatic retries, priority handling, and graceful shutdown.

**Key Metrics:**
- Edge Function timeout: 30 seconds
- Agent task duration: 30 seconds to 2+ hours
- Required solution: Persistent worker processes with Redis-backed queues

---

## Part 1: Architecture Overview

### 1.1 Current Problem

```
┌─────────────────────────────────────────────────────────────────┐
│ CURRENT (BROKEN)                                                │
│                                                                 │
│ User Request → Edge Function → Agent Execution → TIMEOUT (30s) │
│                                                                 │
│ Problem: Edge Functions killed after 30 seconds                 │
│ Impact: Long tasks fail, users frustrated                       │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Target Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TARGET (BULLMQ)                                                             │
│                                                                             │
│ ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────────────────┐   │
│ │  User    │    │  Edge    │    │  Redis   │    │  BullMQ Worker       │   │
│ │  Request │───▶│ Function │───▶│  Queue   │───▶│  (Long-running)      │   │
│ └──────────┘    └──────────┘    └──────────┘    └──────────────────────┘   │
│       │              │               │                    │                 │
│       │              │               │                    ▼                 │
│       │         Returns          Job ID            ┌──────────────┐        │
│       │         immediately      stored            │ Agent Loop   │        │
│       │              │               │             │ (no timeout) │        │
│       │              ▼               │             └──────────────┘        │
│       │         task_id              │                    │                 │
│       │              │               │                    ▼                 │
│       │              │               │             ┌──────────────┐        │
│       │◀─────────────┘               │             │ Sandbox      │        │
│       │                              │             │ Execution    │        │
│       │                              │             └──────────────┘        │
│       │                              │                    │                 │
│       │         WebSocket            │                    ▼                 │
│       │◀─────────────────────────────┼────────────  Progress Events        │
│       │                              │                    │                 │
│       │                              │                    ▼                 │
│       │◀─────────────────────────────┼────────────  Completion             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Component Responsibilities

| Component | Responsibility | Timeout |
|-----------|----------------|---------|
| Edge Function | Validate, enqueue, return task_id | 30s |
| Redis Queue | Store jobs, manage priorities | N/A |
| BullMQ Worker | Execute agent loop, run tools | None |
| Sandbox | Execute code, browser, shell | Per-tool |
| WebSocket | Stream progress to client | N/A |

---

## Part 2: Data Structures

### 2.1 Job Payload Schema

```typescript
/**
 * Job payload stored in Redis queue.
 * This is the contract between Edge Function and Worker.
 */
interface AgentJobPayload {
  // Identifiers
  job_id: string;              // UUID, idempotency key
  run_id: string;              // Parent run ID
  task_id: string;             // Task being executed
  org_id: string;              // Organization for billing
  user_id: string;             // User who triggered
  
  // Task definition
  task_type: TaskType;         // 'agent_run' | 'tool_execution' | 'wide_research'
  prompt: string;              // User prompt or task description
  context: TaskContext;        // Conversation history, files, etc.
  
  // Configuration
  config: TaskConfig;          // Model, temperature, max_tokens, etc.
  tools_allowed: string[];     // List of tool names
  sandbox_config: SandboxConfig;
  
  // Billing
  credits_reserved: number;    // Pre-reserved credits
  max_credits: number;         // Hard limit
  
  // Metadata
  priority: JobPriority;       // 1-10, higher = more urgent
  created_at: string;          // ISO timestamp
  timeout_ms: number;          // Job-level timeout (default: 2 hours)
  retry_count: number;         // Current retry attempt
  max_retries: number;         // Max retry attempts
  
  // Checkpointing
  checkpoint_id?: string;      // Resume from checkpoint
  checkpoint_data?: any;       // Checkpoint state
}

enum TaskType {
  AGENT_RUN = 'agent_run',
  TOOL_EXECUTION = 'tool_execution',
  WIDE_RESEARCH = 'wide_research',
  SLIDE_GENERATION = 'slide_generation',
  DOCUMENT_GENERATION = 'document_generation',
  DATA_ANALYSIS = 'data_analysis',
}

enum JobPriority {
  CRITICAL = 10,    // System tasks, retries
  HIGH = 7,         // Paid users, time-sensitive
  NORMAL = 5,       // Standard tasks
  LOW = 3,          // Background, batch
  BULK = 1,         // Bulk operations
}

interface TaskContext {
  conversation_history: Message[];
  files: FileReference[];
  workspace_id?: string;
  parent_task_id?: string;
  metadata: Record<string, any>;
}

interface TaskConfig {
  model: string;              // 'gpt-4-turbo', 'claude-3-opus', etc.
  temperature: number;        // 0.0 - 1.0
  max_tokens: number;         // Max output tokens per LLM call
  max_steps: number;          // Max agent loop iterations
  max_tool_calls: number;     // Max tool invocations
  stream_output: boolean;     // Stream to WebSocket
}

interface SandboxConfig {
  type: 'e2b' | 'firecracker' | 'docker';
  timeout_ms: number;         // Sandbox-level timeout
  memory_mb: number;          // Memory limit
  cpu_cores: number;          // CPU limit
  disk_gb: number;            // Disk limit
  network_enabled: boolean;   // Allow network access
  preinstalled_packages: string[];
}
```

### 2.2 Job Result Schema

```typescript
/**
 * Job result returned by worker.
 * Stored in Redis and database.
 */
interface AgentJobResult {
  job_id: string;
  run_id: string;
  task_id: string;
  
  // Outcome
  status: JobStatus;
  exit_code: number;          // 0 = success, non-zero = error
  error?: JobError;
  
  // Output
  output: TaskOutput;
  artifacts: Artifact[];
  
  // Billing
  tokens_used: TokenUsage;
  credits_charged: number;
  credits_refunded: number;
  
  // Timing
  started_at: string;
  completed_at: string;
  duration_ms: number;
  
  // Checkpointing
  final_checkpoint_id?: string;
  
  // Metrics
  steps_executed: number;
  tool_calls_made: number;
  llm_calls_made: number;
}

enum JobStatus {
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  TIMEOUT = 'timeout',
  RETRYING = 'retrying',
}

interface JobError {
  code: string;               // Error code for categorization
  message: string;            // Human-readable message
  stack?: string;             // Stack trace (internal only)
  retryable: boolean;         // Can this be retried?
  user_facing_message: string; // Safe to show to user
}

interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  by_model: Record<string, { input: number; output: number }>;
}

interface Artifact {
  id: string;
  type: 'file' | 'image' | 'document' | 'slide_deck' | 'code';
  name: string;
  url: string;                // S3 URL
  size_bytes: number;
  mime_type: string;
  metadata: Record<string, any>;
}
```

### 2.3 Progress Event Schema

```typescript
/**
 * Progress events streamed via WebSocket.
 * Enables real-time UI updates.
 */
interface ProgressEvent {
  event_id: string;
  job_id: string;
  run_id: string;
  task_id: string;
  
  event_type: ProgressEventType;
  timestamp: string;
  
  // Event-specific data
  data: ProgressData;
}

enum ProgressEventType {
  // Lifecycle
  JOB_STARTED = 'job_started',
  JOB_PROGRESS = 'job_progress',
  JOB_COMPLETED = 'job_completed',
  JOB_FAILED = 'job_failed',
  JOB_CANCELLED = 'job_cancelled',
  
  // Agent loop
  STEP_STARTED = 'step_started',
  STEP_COMPLETED = 'step_completed',
  THINKING = 'thinking',
  
  // Tool execution
  TOOL_STARTED = 'tool_started',
  TOOL_PROGRESS = 'tool_progress',
  TOOL_COMPLETED = 'tool_completed',
  TOOL_FAILED = 'tool_failed',
  
  // LLM
  LLM_STARTED = 'llm_started',
  LLM_STREAMING = 'llm_streaming',
  LLM_COMPLETED = 'llm_completed',
  
  // Artifacts
  ARTIFACT_CREATED = 'artifact_created',
  
  // Checkpointing
  CHECKPOINT_SAVED = 'checkpoint_saved',
}

type ProgressData = 
  | JobStartedData
  | JobProgressData
  | StepData
  | ToolData
  | LLMData
  | ArtifactData
  | CheckpointData;

interface JobProgressData {
  percent_complete: number;   // 0-100
  current_step: number;
  total_steps_estimate: number;
  message: string;
  tokens_used: number;
  credits_used: number;
}

interface ToolData {
  tool_name: string;
  tool_input: any;
  tool_output?: any;
  duration_ms?: number;
  status: 'started' | 'progress' | 'completed' | 'failed';
}

interface LLMData {
  model: string;
  input_tokens?: number;
  output_tokens?: number;
  content_delta?: string;     // For streaming
  status: 'started' | 'streaming' | 'completed';
}
```

---

## Part 3: Queue Configuration

### 3.1 Queue Definitions

```typescript
/**
 * Queue configuration for different task types.
 * Each queue has different concurrency and priority settings.
 */
const QUEUE_CONFIGS: Record<string, QueueConfig> = {
  // High-priority agent runs
  'agent:critical': {
    name: 'agent:critical',
    concurrency: 10,
    maxRetries: 5,
    backoff: { type: 'exponential', delay: 1000 },
    timeout: 2 * 60 * 60 * 1000,  // 2 hours
    priority: JobPriority.CRITICAL,
  },
  
  // Standard agent runs
  'agent:standard': {
    name: 'agent:standard',
    concurrency: 50,
    maxRetries: 3,
    backoff: { type: 'exponential', delay: 5000 },
    timeout: 2 * 60 * 60 * 1000,  // 2 hours
    priority: JobPriority.NORMAL,
  },
  
  // Tool executions (fast)
  'tools:fast': {
    name: 'tools:fast',
    concurrency: 100,
    maxRetries: 3,
    backoff: { type: 'fixed', delay: 1000 },
    timeout: 5 * 60 * 1000,       // 5 minutes
    priority: JobPriority.HIGH,
  },
  
  // Wide research (parallel agents)
  'research:wide': {
    name: 'research:wide',
    concurrency: 20,
    maxRetries: 2,
    backoff: { type: 'exponential', delay: 10000 },
    timeout: 4 * 60 * 60 * 1000,  // 4 hours
    priority: JobPriority.NORMAL,
  },
  
  // Slide generation
  'generation:slides': {
    name: 'generation:slides',
    concurrency: 20,
    maxRetries: 2,
    backoff: { type: 'exponential', delay: 5000 },
    timeout: 30 * 60 * 1000,      // 30 minutes
    priority: JobPriority.NORMAL,
  },
  
  // Bulk operations (low priority)
  'bulk:operations': {
    name: 'bulk:operations',
    concurrency: 10,
    maxRetries: 5,
    backoff: { type: 'exponential', delay: 30000 },
    timeout: 24 * 60 * 60 * 1000, // 24 hours
    priority: JobPriority.BULK,
  },
};

interface QueueConfig {
  name: string;
  concurrency: number;
  maxRetries: number;
  backoff: BackoffConfig;
  timeout: number;
  priority: JobPriority;
}

interface BackoffConfig {
  type: 'fixed' | 'exponential';
  delay: number;              // Base delay in ms
  maxDelay?: number;          // Max delay for exponential
}
```

### 3.2 Redis Connection Configuration

```typescript
/**
 * Redis connection configuration.
 * Uses Redis Cluster for production.
 */
const REDIS_CONFIG = {
  // Single node (development)
  development: {
    host: 'localhost',
    port: 6379,
    password: undefined,
    db: 0,
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
    lazyConnect: true,
  },
  
  // Redis Cluster (production)
  production: {
    nodes: [
      { host: 'redis-1.swissbrain.internal', port: 6379 },
      { host: 'redis-2.swissbrain.internal', port: 6379 },
      { host: 'redis-3.swissbrain.internal', port: 6379 },
    ],
    redisOptions: {
      password: process.env.REDIS_PASSWORD,
      tls: { rejectUnauthorized: false },
    },
    scaleReads: 'slave',
    maxRedirections: 16,
    retryDelayOnFailover: 100,
    retryDelayOnClusterDown: 100,
  },
};
```

---

## Part 4: Worker Implementation

### 4.1 Worker Process Pseudocode

```python
"""
BullMQ Worker Process

This is the main worker that processes agent jobs from Redis queues.
Runs as a long-lived process in Kubernetes.
"""

import asyncio
import signal
import sys
from dataclasses import dataclass
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
import uuid

# ============================================================================
# CONFIGURATION
# ============================================================================

@dataclass
class WorkerConfig:
    """Worker configuration."""
    worker_id: str
    queues: List[str]
    concurrency: int = 10
    poll_interval_ms: int = 100
    heartbeat_interval_ms: int = 5000
    graceful_shutdown_timeout_ms: int = 30000
    max_job_duration_ms: int = 7200000  # 2 hours
    checkpoint_interval_ms: int = 60000  # 1 minute
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # Sandbox pool
    sandbox_pool_size: int = 5
    sandbox_warmup_enabled: bool = True


# ============================================================================
# WORKER STATE
# ============================================================================

class WorkerState(Enum):
    """Worker lifecycle states."""
    INITIALIZING = "initializing"
    READY = "ready"
    PROCESSING = "processing"
    DRAINING = "draining"      # Graceful shutdown, finish current jobs
    STOPPED = "stopped"


@dataclass
class ActiveJob:
    """Tracks an active job being processed."""
    job_id: str
    run_id: str
    task_id: str
    started_at: datetime
    last_heartbeat: datetime
    checkpoint_id: Optional[str] = None
    cancel_requested: bool = False


# ============================================================================
# MAIN WORKER CLASS
# ============================================================================

class AgentWorker:
    """
    BullMQ Worker for processing agent jobs.
    
    Lifecycle:
    1. Initialize: Connect to Redis, warm sandbox pool
    2. Poll: Fetch jobs from queues by priority
    3. Process: Execute agent loop with checkpointing
    4. Complete: Store result, release resources
    5. Shutdown: Drain jobs, cleanup
    """
    
    def __init__(self, config: WorkerConfig):
        self.config = config
        self.state = WorkerState.INITIALIZING
        self.active_jobs: Dict[str, ActiveJob] = {}
        self.redis_client = None
        self.sandbox_pool = None
        self.event_publisher = None
        self._shutdown_event = asyncio.Event()
        
    # ========================================================================
    # LIFECYCLE
    # ========================================================================
    
    async def start(self):
        """
        Start the worker.
        
        Steps:
        1. Connect to Redis
        2. Initialize sandbox pool
        3. Register signal handlers
        4. Start heartbeat loop
        5. Start job processing loop
        """
        print(f"[{self.config.worker_id}] Starting worker...")
        
        # Phase 1: Connect to Redis
        self.redis_client = await self._connect_redis()
        
        # Phase 2: Initialize sandbox pool
        self.sandbox_pool = await self._init_sandbox_pool()
        
        # Phase 3: Initialize event publisher
        self.event_publisher = EventPublisher(self.redis_client)
        
        # Phase 4: Register signal handlers
        self._register_signal_handlers()
        
        # Phase 5: Mark ready
        self.state = WorkerState.READY
        await self._register_worker()
        
        print(f"[{self.config.worker_id}] Worker ready, processing jobs...")
        
        # Phase 6: Start processing loops
        await asyncio.gather(
            self._heartbeat_loop(),
            self._job_processing_loop(),
            self._checkpoint_loop(),
        )
    
    async def shutdown(self, timeout_ms: Optional[int] = None):
        """
        Graceful shutdown.
        
        Steps:
        1. Stop accepting new jobs
        2. Wait for active jobs to complete (with timeout)
        3. Checkpoint any incomplete jobs
        4. Release resources
        5. Deregister worker
        """
        timeout_ms = timeout_ms or self.config.graceful_shutdown_timeout_ms
        print(f"[{self.config.worker_id}] Initiating graceful shutdown...")
        
        # Phase 1: Stop accepting new jobs
        self.state = WorkerState.DRAINING
        
        # Phase 2: Wait for active jobs
        deadline = datetime.utcnow() + timedelta(milliseconds=timeout_ms)
        while self.active_jobs and datetime.utcnow() < deadline:
            await asyncio.sleep(0.1)
            print(f"[{self.config.worker_id}] Waiting for {len(self.active_jobs)} jobs...")
        
        # Phase 3: Force checkpoint remaining jobs
        for job_id, active_job in list(self.active_jobs.items()):
            print(f"[{self.config.worker_id}] Force checkpointing job {job_id}")
            await self._force_checkpoint(active_job)
        
        # Phase 4: Release resources
        await self.sandbox_pool.shutdown()
        await self.redis_client.close()
        
        # Phase 5: Deregister
        await self._deregister_worker()
        
        self.state = WorkerState.STOPPED
        print(f"[{self.config.worker_id}] Shutdown complete")
    
    # ========================================================================
    # JOB PROCESSING LOOP
    # ========================================================================
    
    async def _job_processing_loop(self):
        """
        Main job processing loop.
        
        Continuously polls queues and processes jobs.
        Respects concurrency limits.
        """
        while self.state in (WorkerState.READY, WorkerState.PROCESSING):
            # Check if we can accept more jobs
            if len(self.active_jobs) >= self.config.concurrency:
                await asyncio.sleep(self.config.poll_interval_ms / 1000)
                continue
            
            # Poll for next job (priority order)
            job = await self._poll_next_job()
            
            if job is None:
                await asyncio.sleep(self.config.poll_interval_ms / 1000)
                continue
            
            # Process job in background
            self.state = WorkerState.PROCESSING
            asyncio.create_task(self._process_job(job))
    
    async def _poll_next_job(self) -> Optional[Dict[str, Any]]:
        """
        Poll queues for next job.
        
        Polls queues in priority order:
        1. agent:critical
        2. agent:standard
        3. tools:fast
        4. research:wide
        5. generation:slides
        6. bulk:operations
        
        Returns None if no jobs available.
        """
        for queue_name in self.config.queues:
            # BRPOPLPUSH: Atomic move from queue to processing list
            job_data = await self.redis_client.brpoplpush(
                f"queue:{queue_name}",
                f"processing:{self.config.worker_id}",
                timeout=0.1  # 100ms timeout
            )
            
            if job_data:
                return self._parse_job_data(job_data)
        
        return None
    
    async def _process_job(self, job: Dict[str, Any]):
        """
        Process a single job.
        
        Steps:
        1. Validate job
        2. Check idempotency
        3. Reserve credits
        4. Acquire sandbox
        5. Execute agent loop
        6. Store result
        7. Release resources
        8. Publish completion event
        """
        job_id = job['job_id']
        run_id = job['run_id']
        task_id = job['task_id']
        
        print(f"[{self.config.worker_id}] Processing job {job_id}")
        
        # Track active job
        active_job = ActiveJob(
            job_id=job_id,
            run_id=run_id,
            task_id=task_id,
            started_at=datetime.utcnow(),
            last_heartbeat=datetime.utcnow(),
        )
        self.active_jobs[job_id] = active_job
        
        result = None
        error = None
        
        try:
            # Phase 1: Validate job
            self._validate_job(job)
            
            # Phase 2: Check idempotency
            existing_result = await self._check_idempotency(job_id)
            if existing_result:
                print(f"[{job_id}] Returning cached result (idempotent)")
                result = existing_result
                return
            
            # Phase 3: Publish start event
            await self.event_publisher.publish(ProgressEvent(
                event_id=str(uuid.uuid4()),
                job_id=job_id,
                run_id=run_id,
                task_id=task_id,
                event_type=ProgressEventType.JOB_STARTED,
                timestamp=datetime.utcnow().isoformat(),
                data={'message': 'Job started'},
            ))
            
            # Phase 4: Reserve credits
            credits_reserved = await self._reserve_credits(
                org_id=job['org_id'],
                amount=job['credits_reserved'],
                job_id=job_id,
            )
            
            # Phase 5: Acquire sandbox
            sandbox = await self.sandbox_pool.acquire(
                config=job['sandbox_config'],
                timeout_ms=30000,  # 30s to acquire
            )
            
            try:
                # Phase 6: Execute agent loop
                result = await self._execute_agent_loop(
                    job=job,
                    sandbox=sandbox,
                    active_job=active_job,
                )
            finally:
                # Phase 7: Release sandbox
                await self.sandbox_pool.release(sandbox)
            
            # Phase 8: Finalize billing
            await self._finalize_billing(
                org_id=job['org_id'],
                job_id=job_id,
                credits_reserved=credits_reserved,
                credits_used=result.credits_charged,
            )
            
        except CancelledException:
            result = self._create_cancelled_result(job)
            
        except TimeoutException as e:
            result = self._create_timeout_result(job, e)
            
        except RetryableException as e:
            # Re-queue for retry
            await self._requeue_for_retry(job, e)
            return
            
        except Exception as e:
            error = e
            result = self._create_error_result(job, e)
        
        finally:
            # Phase 9: Store result
            if result:
                await self._store_result(job_id, result)
            
            # Phase 10: Publish completion event
            await self.event_publisher.publish(ProgressEvent(
                event_id=str(uuid.uuid4()),
                job_id=job_id,
                run_id=run_id,
                task_id=task_id,
                event_type=(
                    ProgressEventType.JOB_COMPLETED if result.status == JobStatus.COMPLETED
                    else ProgressEventType.JOB_FAILED
                ),
                timestamp=datetime.utcnow().isoformat(),
                data={'result': result.to_dict()},
            ))
            
            # Phase 11: Remove from active jobs
            del self.active_jobs[job_id]
            
            # Phase 12: Remove from processing list
            await self.redis_client.lrem(
                f"processing:{self.config.worker_id}",
                1,
                job_id,
            )
            
            print(f"[{self.config.worker_id}] Completed job {job_id}: {result.status}")
    
    # ========================================================================
    # AGENT LOOP EXECUTION
    # ========================================================================
    
    async def _execute_agent_loop(
        self,
        job: Dict[str, Any],
        sandbox: Sandbox,
        active_job: ActiveJob,
    ) -> AgentJobResult:
        """
        Execute the agent loop.
        
        This is the core agent execution logic.
        Runs until completion, cancellation, or timeout.
        
        Steps per iteration:
        1. Check for cancellation
        2. Check for timeout
        3. Build context
        4. Call LLM
        5. Parse tool calls
        6. Execute tools
        7. Update context
        8. Check completion
        9. Checkpoint if needed
        """
        job_id = job['job_id']
        config = job['config']
        
        # Initialize state
        context = job['context']
        messages = context['conversation_history'].copy()
        step = 0
        total_tokens = TokenUsage(input_tokens=0, output_tokens=0, total_tokens=0, by_model={})
        artifacts = []
        
        # Resume from checkpoint if available
        if job.get('checkpoint_id'):
            checkpoint = await self._load_checkpoint(job['checkpoint_id'])
            messages = checkpoint['messages']
            step = checkpoint['step']
            total_tokens = checkpoint['tokens']
            artifacts = checkpoint['artifacts']
        
        # Agent loop
        while step < config['max_steps']:
            step += 1
            
            # Check 1: Cancellation
            if active_job.cancel_requested:
                raise CancelledException(f"Job {job_id} cancelled by user")
            
            # Check 2: Timeout
            elapsed_ms = (datetime.utcnow() - active_job.started_at).total_seconds() * 1000
            if elapsed_ms > job['timeout_ms']:
                raise TimeoutException(f"Job {job_id} exceeded timeout")
            
            # Check 3: Credit limit
            if total_tokens.total_tokens > job['max_credits'] * 1000:  # Rough conversion
                raise CreditExhaustedException(f"Job {job_id} exceeded credit limit")
            
            # Publish step start
            await self.event_publisher.publish(ProgressEvent(
                event_id=str(uuid.uuid4()),
                job_id=job_id,
                run_id=job['run_id'],
                task_id=job['task_id'],
                event_type=ProgressEventType.STEP_STARTED,
                timestamp=datetime.utcnow().isoformat(),
                data={'step': step, 'total_steps_estimate': config['max_steps']},
            ))
            
            # Step 1: Call LLM
            llm_response = await self._call_llm(
                messages=messages,
                model=config['model'],
                temperature=config['temperature'],
                max_tokens=config['max_tokens'],
                tools=self._get_tool_definitions(job['tools_allowed']),
                stream=config['stream_output'],
                job_id=job_id,
            )
            
            # Update token usage
            total_tokens.input_tokens += llm_response.usage.input_tokens
            total_tokens.output_tokens += llm_response.usage.output_tokens
            total_tokens.total_tokens += llm_response.usage.total_tokens
            
            # Step 2: Check for completion (no tool calls)
            if not llm_response.tool_calls:
                # Agent is done
                messages.append({
                    'role': 'assistant',
                    'content': llm_response.content,
                })
                break
            
            # Step 3: Execute tool calls
            tool_results = []
            for tool_call in llm_response.tool_calls:
                # Publish tool start
                await self.event_publisher.publish(ProgressEvent(
                    event_id=str(uuid.uuid4()),
                    job_id=job_id,
                    run_id=job['run_id'],
                    task_id=job['task_id'],
                    event_type=ProgressEventType.TOOL_STARTED,
                    timestamp=datetime.utcnow().isoformat(),
                    data={
                        'tool_name': tool_call.name,
                        'tool_input': tool_call.arguments,
                        'status': 'started',
                    },
                ))
                
                # Execute tool
                try:
                    tool_result = await self._execute_tool(
                        sandbox=sandbox,
                        tool_name=tool_call.name,
                        tool_input=tool_call.arguments,
                        job_id=job_id,
                    )
                    
                    # Check for artifacts
                    if tool_result.artifacts:
                        artifacts.extend(tool_result.artifacts)
                    
                    tool_results.append({
                        'tool_call_id': tool_call.id,
                        'role': 'tool',
                        'content': tool_result.output,
                    })
                    
                    # Publish tool completion
                    await self.event_publisher.publish(ProgressEvent(
                        event_id=str(uuid.uuid4()),
                        job_id=job_id,
                        run_id=job['run_id'],
                        task_id=job['task_id'],
                        event_type=ProgressEventType.TOOL_COMPLETED,
                        timestamp=datetime.utcnow().isoformat(),
                        data={
                            'tool_name': tool_call.name,
                            'tool_output': tool_result.output[:500],  # Truncate for event
                            'duration_ms': tool_result.duration_ms,
                            'status': 'completed',
                        },
                    ))
                    
                except ToolExecutionException as e:
                    tool_results.append({
                        'tool_call_id': tool_call.id,
                        'role': 'tool',
                        'content': f"Error: {e.message}",
                    })
                    
                    # Publish tool failure
                    await self.event_publisher.publish(ProgressEvent(
                        event_id=str(uuid.uuid4()),
                        job_id=job_id,
                        run_id=job['run_id'],
                        task_id=job['task_id'],
                        event_type=ProgressEventType.TOOL_FAILED,
                        timestamp=datetime.utcnow().isoformat(),
                        data={
                            'tool_name': tool_call.name,
                            'error': e.message,
                            'status': 'failed',
                        },
                    ))
            
            # Step 4: Update messages
            messages.append({
                'role': 'assistant',
                'content': llm_response.content,
                'tool_calls': [tc.to_dict() for tc in llm_response.tool_calls],
            })
            messages.extend(tool_results)
            
            # Step 5: Checkpoint if needed
            checkpoint_elapsed = (datetime.utcnow() - active_job.started_at).total_seconds() * 1000
            if checkpoint_elapsed > self.config.checkpoint_interval_ms * (step // 10 + 1):
                checkpoint_id = await self._save_checkpoint(
                    job_id=job_id,
                    data={
                        'messages': messages,
                        'step': step,
                        'tokens': total_tokens,
                        'artifacts': artifacts,
                    },
                )
                active_job.checkpoint_id = checkpoint_id
                
                await self.event_publisher.publish(ProgressEvent(
                    event_id=str(uuid.uuid4()),
                    job_id=job_id,
                    run_id=job['run_id'],
                    task_id=job['task_id'],
                    event_type=ProgressEventType.CHECKPOINT_SAVED,
                    timestamp=datetime.utcnow().isoformat(),
                    data={'checkpoint_id': checkpoint_id, 'step': step},
                ))
            
            # Publish step completion
            await self.event_publisher.publish(ProgressEvent(
                event_id=str(uuid.uuid4()),
                job_id=job_id,
                run_id=job['run_id'],
                task_id=job['task_id'],
                event_type=ProgressEventType.STEP_COMPLETED,
                timestamp=datetime.utcnow().isoformat(),
                data={'step': step},
            ))
        
        # Build result
        return AgentJobResult(
            job_id=job_id,
            run_id=job['run_id'],
            task_id=job['task_id'],
            status=JobStatus.COMPLETED,
            exit_code=0,
            output=TaskOutput(
                content=messages[-1]['content'] if messages else '',
                messages=messages,
            ),
            artifacts=artifacts,
            tokens_used=total_tokens,
            credits_charged=self._calculate_credits(total_tokens),
            credits_refunded=0,
            started_at=active_job.started_at.isoformat(),
            completed_at=datetime.utcnow().isoformat(),
            duration_ms=int((datetime.utcnow() - active_job.started_at).total_seconds() * 1000),
            final_checkpoint_id=active_job.checkpoint_id,
            steps_executed=step,
            tool_calls_made=sum(1 for m in messages if m.get('role') == 'tool'),
            llm_calls_made=step,
        )
    
    # ========================================================================
    # TOOL EXECUTION
    # ========================================================================
    
    async def _execute_tool(
        self,
        sandbox: Sandbox,
        tool_name: str,
        tool_input: Dict[str, Any],
        job_id: str,
    ) -> ToolResult:
        """
        Execute a tool in the sandbox.
        
        Tools are executed in isolation with resource limits.
        """
        tool_start = datetime.utcnow()
        
        # Get tool executor
        executor = self._get_tool_executor(tool_name)
        
        # Execute with timeout
        try:
            result = await asyncio.wait_for(
                executor.execute(sandbox, tool_input),
                timeout=executor.timeout_seconds,
            )
        except asyncio.TimeoutError:
            raise ToolExecutionException(
                tool_name=tool_name,
                message=f"Tool {tool_name} timed out after {executor.timeout_seconds}s",
                retryable=True,
            )
        
        duration_ms = int((datetime.utcnow() - tool_start).total_seconds() * 1000)
        
        return ToolResult(
            output=result.output,
            artifacts=result.artifacts,
            duration_ms=duration_ms,
        )
    
    # ========================================================================
    # CHECKPOINTING
    # ========================================================================
    
    async def _save_checkpoint(self, job_id: str, data: Dict[str, Any]) -> str:
        """
        Save a checkpoint for job resumption.
        
        Checkpoints are stored in Redis with TTL and backed up to S3.
        """
        checkpoint_id = f"checkpoint:{job_id}:{uuid.uuid4().hex[:8]}"
        
        # Store in Redis (fast access)
        await self.redis_client.setex(
            checkpoint_id,
            86400,  # 24 hour TTL
            json.dumps(data),
        )
        
        # Backup to S3 (durability)
        await self._backup_checkpoint_to_s3(checkpoint_id, data)
        
        return checkpoint_id
    
    async def _load_checkpoint(self, checkpoint_id: str) -> Dict[str, Any]:
        """Load checkpoint from Redis or S3."""
        # Try Redis first
        data = await self.redis_client.get(checkpoint_id)
        if data:
            return json.loads(data)
        
        # Fall back to S3
        return await self._load_checkpoint_from_s3(checkpoint_id)
    
    # ========================================================================
    # BILLING
    # ========================================================================
    
    async def _reserve_credits(
        self,
        org_id: str,
        amount: float,
        job_id: str,
    ) -> float:
        """
        Reserve credits before job execution.
        
        Uses row-level locking to prevent race conditions.
        """
        # Call billing service
        reservation = await self.billing_client.reserve_credits(
            org_id=org_id,
            amount=amount,
            job_id=job_id,
            idempotency_key=f"reserve:{job_id}",
        )
        
        if not reservation.success:
            raise InsufficientCreditsException(
                org_id=org_id,
                required=amount,
                available=reservation.available,
            )
        
        return reservation.reserved_amount
    
    async def _finalize_billing(
        self,
        org_id: str,
        job_id: str,
        credits_reserved: float,
        credits_used: float,
    ):
        """
        Finalize billing after job completion.
        
        Charges actual usage and refunds excess reservation.
        """
        await self.billing_client.finalize(
            org_id=org_id,
            job_id=job_id,
            credits_reserved=credits_reserved,
            credits_used=credits_used,
            idempotency_key=f"finalize:{job_id}",
        )
    
    # ========================================================================
    # RETRY LOGIC
    # ========================================================================
    
    async def _requeue_for_retry(self, job: Dict[str, Any], error: RetryableException):
        """
        Re-queue a job for retry.
        
        Uses exponential backoff with jitter.
        """
        retry_count = job.get('retry_count', 0) + 1
        max_retries = job.get('max_retries', 3)
        
        if retry_count > max_retries:
            # Max retries exceeded, fail permanently
            result = self._create_error_result(job, error)
            await self._store_result(job['job_id'], result)
            return
        
        # Calculate backoff delay
        base_delay_ms = 5000  # 5 seconds
        max_delay_ms = 300000  # 5 minutes
        delay_ms = min(base_delay_ms * (2 ** retry_count), max_delay_ms)
        
        # Add jitter (±20%)
        jitter = delay_ms * 0.2 * (random.random() * 2 - 1)
        delay_ms = int(delay_ms + jitter)
        
        # Update job
        job['retry_count'] = retry_count
        job['retry_delay_ms'] = delay_ms
        job['last_error'] = str(error)
        
        # Re-queue with delay
        queue_name = self._get_queue_for_job(job)
        await self.redis_client.zadd(
            f"delayed:{queue_name}",
            {json.dumps(job): time.time() + delay_ms / 1000},
        )
        
        print(f"[{job['job_id']}] Re-queued for retry {retry_count}/{max_retries} in {delay_ms}ms")
    
    # ========================================================================
    # SIGNAL HANDLERS
    # ========================================================================
    
    def _register_signal_handlers(self):
        """Register signal handlers for graceful shutdown."""
        loop = asyncio.get_event_loop()
        
        for sig in (signal.SIGTERM, signal.SIGINT):
            loop.add_signal_handler(
                sig,
                lambda: asyncio.create_task(self.shutdown()),
            )
    
    # ========================================================================
    # HEARTBEAT
    # ========================================================================
    
    async def _heartbeat_loop(self):
        """
        Heartbeat loop to maintain worker registration.
        
        Also checks for stalled jobs and cancellation requests.
        """
        while self.state != WorkerState.STOPPED:
            try:
                # Update worker heartbeat
                await self.redis_client.setex(
                    f"worker:{self.config.worker_id}:heartbeat",
                    30,  # 30 second TTL
                    datetime.utcnow().isoformat(),
                )
                
                # Check for cancellation requests
                for job_id, active_job in list(self.active_jobs.items()):
                    cancel_key = f"cancel:{job_id}"
                    if await self.redis_client.exists(cancel_key):
                        active_job.cancel_requested = True
                        await self.redis_client.delete(cancel_key)
                
                # Update active job heartbeats
                for job_id, active_job in self.active_jobs.items():
                    active_job.last_heartbeat = datetime.utcnow()
                    await self.redis_client.setex(
                        f"job:{job_id}:heartbeat",
                        60,  # 60 second TTL
                        self.config.worker_id,
                    )
                
            except Exception as e:
                print(f"[{self.config.worker_id}] Heartbeat error: {e}")
            
            await asyncio.sleep(self.config.heartbeat_interval_ms / 1000)


# ============================================================================
# ENTRY POINT
# ============================================================================

async def main():
    """Main entry point for worker process."""
    config = WorkerConfig(
        worker_id=f"worker-{uuid.uuid4().hex[:8]}",
        queues=[
            'agent:critical',
            'agent:standard',
            'tools:fast',
            'research:wide',
            'generation:slides',
            'bulk:operations',
        ],
        concurrency=10,
        redis_url=os.environ.get('REDIS_URL', 'redis://localhost:6379'),
    )
    
    worker = AgentWorker(config)
    await worker.start()


if __name__ == '__main__':
    asyncio.run(main())
```

---

## Part 5: Edge Function Integration

### 5.1 Edge Function Enqueue Pseudocode

```typescript
/**
 * Edge Function: Enqueue Agent Task
 * 
 * This is the entry point from the frontend.
 * It validates the request, creates the job, and enqueues it.
 * Returns immediately with task_id.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from '@supabase/supabase-js';
import { Redis } from 'ioredis';

interface CreateTaskRequest {
  prompt: string;
  task_type: TaskType;
  config?: Partial<TaskConfig>;
  context?: Partial<TaskContext>;
  priority?: JobPriority;
}

interface CreateTaskResponse {
  task_id: string;
  run_id: string;
  status: 'queued';
  estimated_wait_seconds: number;
}

serve(async (req: Request) => {
  const startTime = Date.now();
  
  try {
    // ================================================================
    // PHASE 1: Authentication (5ms)
    // ================================================================
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );
    
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // ================================================================
    // PHASE 2: Parse and Validate Request (2ms)
    // ================================================================
    const body: CreateTaskRequest = await req.json();
    
    // Validate required fields
    if (!body.prompt || body.prompt.trim().length === 0) {
      return new Response(JSON.stringify({ error: 'Prompt is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    if (!body.task_type) {
      body.task_type = TaskType.AGENT_RUN;
    }
    
    // ================================================================
    // PHASE 3: Get User Organization and Credits (10ms)
    // ================================================================
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('id, credits_balance, tier')
      .eq('owner_id', user.id)
      .single();
    
    if (orgError || !org) {
      return new Response(JSON.stringify({ error: 'Organization not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // ================================================================
    // PHASE 4: Estimate Credits and Check Balance (5ms)
    // ================================================================
    const estimatedCredits = estimateCredits(body.task_type, body.prompt);
    
    if (org.credits_balance < estimatedCredits) {
      return new Response(JSON.stringify({
        error: 'Insufficient credits',
        required: estimatedCredits,
        available: org.credits_balance,
      }), {
        status: 402,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    
    // ================================================================
    // PHASE 5: Create Run and Task Records (15ms)
    // ================================================================
    const runId = crypto.randomUUID();
    const taskId = crypto.randomUUID();
    const jobId = crypto.randomUUID();
    
    // Create run record
    const { error: runError } = await supabase
      .from('agent_runs')
      .insert({
        id: runId,
        org_id: org.id,
        user_id: user.id,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    
    if (runError) {
      throw new Error(`Failed to create run: ${runError.message}`);
    }
    
    // Create task record
    const { error: taskError } = await supabase
      .from('agent_tasks')
      .insert({
        id: taskId,
        run_id: runId,
        type: body.task_type,
        prompt: body.prompt,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    
    if (taskError) {
      throw new Error(`Failed to create task: ${taskError.message}`);
    }
    
    // ================================================================
    // PHASE 6: Build Job Payload (2ms)
    // ================================================================
    const jobPayload: AgentJobPayload = {
      job_id: jobId,
      run_id: runId,
      task_id: taskId,
      org_id: org.id,
      user_id: user.id,
      
      task_type: body.task_type,
      prompt: body.prompt,
      context: {
        conversation_history: body.context?.conversation_history || [],
        files: body.context?.files || [],
        workspace_id: body.context?.workspace_id,
        metadata: body.context?.metadata || {},
      },
      
      config: {
        model: body.config?.model || 'gpt-4-turbo',
        temperature: body.config?.temperature || 0.7,
        max_tokens: body.config?.max_tokens || 4096,
        max_steps: body.config?.max_steps || 50,
        max_tool_calls: body.config?.max_tool_calls || 100,
        stream_output: body.config?.stream_output ?? true,
      },
      
      tools_allowed: getToolsForTaskType(body.task_type),
      
      sandbox_config: {
        type: 'e2b',
        timeout_ms: 300000,  // 5 minutes per tool
        memory_mb: 2048,
        cpu_cores: 2,
        disk_gb: 10,
        network_enabled: true,
        preinstalled_packages: [],
      },
      
      credits_reserved: estimatedCredits,
      max_credits: estimatedCredits * 2,  // Allow 2x buffer
      
      priority: body.priority || JobPriority.NORMAL,
      created_at: new Date().toISOString(),
      timeout_ms: getTimeoutForTaskType(body.task_type),
      retry_count: 0,
      max_retries: 3,
    };
    
    // ================================================================
    // PHASE 7: Enqueue to Redis (5ms)
    // ================================================================
    const redis = new Redis(Deno.env.get('REDIS_URL')!);
    
    const queueName = getQueueForTaskType(body.task_type, body.priority);
    
    await redis.lpush(
      `queue:${queueName}`,
      JSON.stringify(jobPayload)
    );
    
    // Get queue position for estimate
    const queueLength = await redis.llen(`queue:${queueName}`);
    const estimatedWaitSeconds = queueLength * 30;  // Rough estimate
    
    await redis.quit();
    
    // ================================================================
    // PHASE 8: Return Response (immediate)
    // ================================================================
    const response: CreateTaskResponse = {
      task_id: taskId,
      run_id: runId,
      status: 'queued',
      estimated_wait_seconds: estimatedWaitSeconds,
    };
    
    console.log(`[${taskId}] Enqueued in ${Date.now() - startTime}ms`);
    
    return new Response(JSON.stringify(response), {
      status: 202,  // Accepted
      headers: { 'Content-Type': 'application/json' },
    });
    
  } catch (error) {
    console.error('Error creating task:', error);
    
    return new Response(JSON.stringify({
      error: 'Internal server error',
      message: error.message,
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});

// ================================================================
// HELPER FUNCTIONS
// ================================================================

function estimateCredits(taskType: TaskType, prompt: string): number {
  const baseCredits: Record<TaskType, number> = {
    [TaskType.AGENT_RUN]: 10,
    [TaskType.TOOL_EXECUTION]: 2,
    [TaskType.WIDE_RESEARCH]: 50,
    [TaskType.SLIDE_GENERATION]: 20,
    [TaskType.DOCUMENT_GENERATION]: 15,
    [TaskType.DATA_ANALYSIS]: 25,
  };
  
  // Adjust based on prompt length
  const promptMultiplier = 1 + (prompt.length / 10000);
  
  return Math.ceil(baseCredits[taskType] * promptMultiplier);
}

function getQueueForTaskType(taskType: TaskType, priority?: JobPriority): string {
  if (priority === JobPriority.CRITICAL) {
    return 'agent:critical';
  }
  
  const queueMapping: Record<TaskType, string> = {
    [TaskType.AGENT_RUN]: 'agent:standard',
    [TaskType.TOOL_EXECUTION]: 'tools:fast',
    [TaskType.WIDE_RESEARCH]: 'research:wide',
    [TaskType.SLIDE_GENERATION]: 'generation:slides',
    [TaskType.DOCUMENT_GENERATION]: 'generation:slides',
    [TaskType.DATA_ANALYSIS]: 'agent:standard',
  };
  
  return queueMapping[taskType] || 'agent:standard';
}

function getTimeoutForTaskType(taskType: TaskType): number {
  const timeouts: Record<TaskType, number> = {
    [TaskType.AGENT_RUN]: 2 * 60 * 60 * 1000,      // 2 hours
    [TaskType.TOOL_EXECUTION]: 5 * 60 * 1000,      // 5 minutes
    [TaskType.WIDE_RESEARCH]: 4 * 60 * 60 * 1000,  // 4 hours
    [TaskType.SLIDE_GENERATION]: 30 * 60 * 1000,   // 30 minutes
    [TaskType.DOCUMENT_GENERATION]: 30 * 60 * 1000, // 30 minutes
    [TaskType.DATA_ANALYSIS]: 1 * 60 * 60 * 1000,  // 1 hour
  };
  
  return timeouts[taskType] || 2 * 60 * 60 * 1000;
}

function getToolsForTaskType(taskType: TaskType): string[] {
  const toolSets: Record<TaskType, string[]> = {
    [TaskType.AGENT_RUN]: [
      'code_execute', 'shell_execute', 'browser_action', 'web_search',
      'file_read', 'file_write', 'generate_document', 'generate_slides',
      'generate_image', 'send_email', 'calendar_action',
    ],
    [TaskType.TOOL_EXECUTION]: ['*'],  // All tools
    [TaskType.WIDE_RESEARCH]: [
      'web_search', 'browser_action', 'file_write', 'generate_document',
    ],
    [TaskType.SLIDE_GENERATION]: [
      'generate_slides', 'generate_image', 'file_write',
    ],
    [TaskType.DOCUMENT_GENERATION]: [
      'generate_document', 'file_write', 'web_search',
    ],
    [TaskType.DATA_ANALYSIS]: [
      'code_execute', 'file_read', 'file_write', 'generate_image',
    ],
  };
  
  return toolSets[taskType] || toolSets[TaskType.AGENT_RUN];
}
```

---

## Part 6: Kubernetes Deployment

### 6.1 Worker Deployment Manifest

```yaml
# k8s/bullmq-worker-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: bullmq-worker
  namespace: swissbrain
  labels:
    app: bullmq-worker
    component: worker
spec:
  replicas: 5
  selector:
    matchLabels:
      app: bullmq-worker
  template:
    metadata:
      labels:
        app: bullmq-worker
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      # Anti-affinity: spread across nodes
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app: bullmq-worker
                topologyKey: kubernetes.io/hostname
      
      # Graceful shutdown
      terminationGracePeriodSeconds: 300  # 5 minutes
      
      containers:
        - name: worker
          image: swissbrain/bullmq-worker:latest
          imagePullPolicy: Always
          
          # Resources
          resources:
            requests:
              memory: "2Gi"
              cpu: "1000m"
            limits:
              memory: "4Gi"
              cpu: "2000m"
          
          # Environment
          env:
            - name: WORKER_ID
              valueFrom:
                fieldRef:
                  fieldPath: metadata.name
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
            - name: SUPABASE_URL
              valueFrom:
                secretKeyRef:
                  name: supabase-credentials
                  key: url
            - name: SUPABASE_SERVICE_KEY
              valueFrom:
                secretKeyRef:
                  name: supabase-credentials
                  key: service_key
            - name: E2B_API_KEY
              valueFrom:
                secretKeyRef:
                  name: e2b-credentials
                  key: api_key
            - name: OPENAI_API_KEY
              valueFrom:
                secretKeyRef:
                  name: openai-credentials
                  key: api_key
            - name: WORKER_CONCURRENCY
              value: "10"
            - name: SANDBOX_POOL_SIZE
              value: "5"
          
          # Health checks
          livenessProbe:
            httpGet:
              path: /health/live
              port: 8080
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 8080
            initialDelaySeconds: 10
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
          
          # Lifecycle hooks
          lifecycle:
            preStop:
              exec:
                command:
                  - /bin/sh
                  - -c
                  - |
                    # Signal graceful shutdown
                    kill -SIGTERM 1
                    # Wait for jobs to complete
                    sleep 60
          
          # Ports
          ports:
            - name: http
              containerPort: 8080
            - name: metrics
              containerPort: 9090
          
          # Volume mounts
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      
      volumes:
        - name: tmp
          emptyDir:
            sizeLimit: 10Gi

---
apiVersion: v1
kind: Service
metadata:
  name: bullmq-worker
  namespace: swissbrain
spec:
  selector:
    app: bullmq-worker
  ports:
    - name: http
      port: 8080
      targetPort: 8080
    - name: metrics
      port: 9090
      targetPort: 9090

---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: bullmq-worker-hpa
  namespace: swissbrain
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: bullmq-worker
  minReplicas: 3
  maxReplicas: 50
  metrics:
    # Scale based on queue length
    - type: External
      external:
        metric:
          name: redis_queue_length
          selector:
            matchLabels:
              queue: agent
        target:
          type: AverageValue
          averageValue: "100"
    # Scale based on CPU
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 5
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60

---
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: bullmq-worker-pdb
  namespace: swissbrain
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: bullmq-worker
```

---

## Part 7: Monitoring & Observability

### 7.1 Prometheus Metrics

```python
"""
Prometheus metrics for BullMQ workers.
"""

from prometheus_client import Counter, Histogram, Gauge, Info

# ============================================================================
# JOB METRICS
# ============================================================================

jobs_total = Counter(
    'bullmq_jobs_total',
    'Total jobs processed',
    ['queue', 'status', 'task_type']
)

jobs_duration_seconds = Histogram(
    'bullmq_jobs_duration_seconds',
    'Job processing duration',
    ['queue', 'task_type'],
    buckets=[1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600, 7200]
)

jobs_active = Gauge(
    'bullmq_jobs_active',
    'Currently active jobs',
    ['worker_id', 'queue']
)

jobs_waiting = Gauge(
    'bullmq_jobs_waiting',
    'Jobs waiting in queue',
    ['queue']
)

jobs_retries_total = Counter(
    'bullmq_jobs_retries_total',
    'Total job retries',
    ['queue', 'retry_reason']
)

# ============================================================================
# WORKER METRICS
# ============================================================================

workers_active = Gauge(
    'bullmq_workers_active',
    'Active workers',
    ['worker_id']
)

worker_info = Info(
    'bullmq_worker',
    'Worker information',
    ['worker_id']
)

# ============================================================================
# RESOURCE METRICS
# ============================================================================

sandbox_pool_size = Gauge(
    'bullmq_sandbox_pool_size',
    'Sandbox pool size',
    ['worker_id']
)

sandbox_pool_available = Gauge(
    'bullmq_sandbox_pool_available',
    'Available sandboxes in pool',
    ['worker_id']
)

sandbox_acquisition_seconds = Histogram(
    'bullmq_sandbox_acquisition_seconds',
    'Time to acquire sandbox',
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30]
)

# ============================================================================
# BILLING METRICS
# ============================================================================

credits_reserved_total = Counter(
    'bullmq_credits_reserved_total',
    'Total credits reserved',
    ['org_id']
)

credits_charged_total = Counter(
    'bullmq_credits_charged_total',
    'Total credits charged',
    ['org_id', 'task_type']
)

credits_refunded_total = Counter(
    'bullmq_credits_refunded_total',
    'Total credits refunded',
    ['org_id', 'reason']
)

# ============================================================================
# TOOL METRICS
# ============================================================================

tool_executions_total = Counter(
    'bullmq_tool_executions_total',
    'Total tool executions',
    ['tool_name', 'status']
)

tool_duration_seconds = Histogram(
    'bullmq_tool_duration_seconds',
    'Tool execution duration',
    ['tool_name'],
    buckets=[0.1, 0.5, 1, 2, 5, 10, 30, 60, 120, 300]
)

# ============================================================================
# LLM METRICS
# ============================================================================

llm_calls_total = Counter(
    'bullmq_llm_calls_total',
    'Total LLM calls',
    ['model', 'status']
)

llm_tokens_total = Counter(
    'bullmq_llm_tokens_total',
    'Total tokens used',
    ['model', 'direction']  # direction: input/output
)

llm_latency_seconds = Histogram(
    'bullmq_llm_latency_seconds',
    'LLM call latency',
    ['model'],
    buckets=[0.5, 1, 2, 5, 10, 20, 30, 60]
)
```

---

## Part 8: Testing

### 8.1 Integration Test Suite

```python
"""
Integration tests for BullMQ workers.
"""

import pytest
import asyncio
from datetime import datetime
import json

from worker import AgentWorker, WorkerConfig
from job_types import AgentJobPayload, TaskType, JobPriority


@pytest.fixture
async def worker():
    """Create test worker."""
    config = WorkerConfig(
        worker_id='test-worker',
        queues=['test:queue'],
        concurrency=2,
        redis_url='redis://localhost:6379/1',  # Use test database
    )
    worker = AgentWorker(config)
    yield worker
    await worker.shutdown(timeout_ms=5000)


@pytest.fixture
async def redis_client():
    """Create test Redis client."""
    import aioredis
    client = await aioredis.from_url('redis://localhost:6379/1')
    yield client
    await client.flushdb()
    await client.close()


class TestJobProcessing:
    """Test job processing."""
    
    async def test_simple_job_completes(self, worker, redis_client):
        """Test that a simple job completes successfully."""
        # Arrange
        job = AgentJobPayload(
            job_id='test-job-1',
            run_id='test-run-1',
            task_id='test-task-1',
            org_id='test-org',
            user_id='test-user',
            task_type=TaskType.AGENT_RUN,
            prompt='Say hello',
            context={'conversation_history': [], 'files': [], 'metadata': {}},
            config={
                'model': 'gpt-4-turbo',
                'temperature': 0.7,
                'max_tokens': 100,
                'max_steps': 1,
                'max_tool_calls': 0,
                'stream_output': False,
            },
            tools_allowed=[],
            sandbox_config={'type': 'e2b', 'timeout_ms': 30000},
            credits_reserved=10,
            max_credits=20,
            priority=JobPriority.NORMAL,
            created_at=datetime.utcnow().isoformat(),
            timeout_ms=60000,
            retry_count=0,
            max_retries=3,
        )
        
        # Enqueue job
        await redis_client.lpush('queue:test:queue', json.dumps(job.__dict__))
        
        # Act
        asyncio.create_task(worker.start())
        await asyncio.sleep(5)  # Wait for processing
        
        # Assert
        result = await redis_client.get(f'result:{job.job_id}')
        assert result is not None
        result_data = json.loads(result)
        assert result_data['status'] == 'completed'
    
    async def test_job_timeout_handled(self, worker, redis_client):
        """Test that job timeout is handled correctly."""
        # Arrange
        job = AgentJobPayload(
            job_id='test-job-timeout',
            run_id='test-run-timeout',
            task_id='test-task-timeout',
            org_id='test-org',
            user_id='test-user',
            task_type=TaskType.AGENT_RUN,
            prompt='Do something that takes forever',
            context={'conversation_history': [], 'files': [], 'metadata': {}},
            config={
                'model': 'gpt-4-turbo',
                'temperature': 0.7,
                'max_tokens': 100,
                'max_steps': 100,  # Many steps
                'max_tool_calls': 100,
                'stream_output': False,
            },
            tools_allowed=['sleep'],  # Mock tool that sleeps
            sandbox_config={'type': 'e2b', 'timeout_ms': 1000},
            credits_reserved=10,
            max_credits=20,
            priority=JobPriority.NORMAL,
            created_at=datetime.utcnow().isoformat(),
            timeout_ms=2000,  # 2 second timeout
            retry_count=0,
            max_retries=0,  # No retries
        )
        
        # Enqueue job
        await redis_client.lpush('queue:test:queue', json.dumps(job.__dict__))
        
        # Act
        asyncio.create_task(worker.start())
        await asyncio.sleep(5)  # Wait for timeout
        
        # Assert
        result = await redis_client.get(f'result:{job.job_id}')
        assert result is not None
        result_data = json.loads(result)
        assert result_data['status'] == 'timeout'
    
    async def test_job_retry_on_failure(self, worker, redis_client):
        """Test that retryable failures are retried."""
        # Arrange
        job = AgentJobPayload(
            job_id='test-job-retry',
            run_id='test-run-retry',
            task_id='test-task-retry',
            org_id='test-org',
            user_id='test-user',
            task_type=TaskType.AGENT_RUN,
            prompt='Fail once then succeed',
            context={'conversation_history': [], 'files': [], 'metadata': {}},
            config={
                'model': 'gpt-4-turbo',
                'temperature': 0.7,
                'max_tokens': 100,
                'max_steps': 1,
                'max_tool_calls': 0,
                'stream_output': False,
            },
            tools_allowed=[],
            sandbox_config={'type': 'e2b', 'timeout_ms': 30000},
            credits_reserved=10,
            max_credits=20,
            priority=JobPriority.NORMAL,
            created_at=datetime.utcnow().isoformat(),
            timeout_ms=60000,
            retry_count=0,
            max_retries=3,
        )
        
        # Enqueue job
        await redis_client.lpush('queue:test:queue', json.dumps(job.__dict__))
        
        # Act
        asyncio.create_task(worker.start())
        await asyncio.sleep(10)  # Wait for retries
        
        # Assert
        # Check retry counter
        retries = await redis_client.get(f'retries:{job.job_id}')
        assert int(retries or 0) >= 1
    
    async def test_graceful_shutdown(self, worker, redis_client):
        """Test graceful shutdown checkpoints active jobs."""
        # Arrange
        job = AgentJobPayload(
            job_id='test-job-shutdown',
            run_id='test-run-shutdown',
            task_id='test-task-shutdown',
            org_id='test-org',
            user_id='test-user',
            task_type=TaskType.AGENT_RUN,
            prompt='Long running task',
            context={'conversation_history': [], 'files': [], 'metadata': {}},
            config={
                'model': 'gpt-4-turbo',
                'temperature': 0.7,
                'max_tokens': 100,
                'max_steps': 100,
                'max_tool_calls': 100,
                'stream_output': False,
            },
            tools_allowed=['sleep'],
            sandbox_config={'type': 'e2b', 'timeout_ms': 30000},
            credits_reserved=10,
            max_credits=20,
            priority=JobPriority.NORMAL,
            created_at=datetime.utcnow().isoformat(),
            timeout_ms=3600000,  # 1 hour
            retry_count=0,
            max_retries=3,
        )
        
        # Enqueue job
        await redis_client.lpush('queue:test:queue', json.dumps(job.__dict__))
        
        # Act
        worker_task = asyncio.create_task(worker.start())
        await asyncio.sleep(2)  # Let job start
        
        # Trigger shutdown
        await worker.shutdown(timeout_ms=5000)
        
        # Assert
        # Check checkpoint was saved
        checkpoints = await redis_client.keys(f'checkpoint:{job.job_id}:*')
        assert len(checkpoints) >= 1
```

---

## Part 9: Operational Runbook

### 9.1 Deployment Checklist

```markdown
## BullMQ Worker Deployment Checklist

### Pre-Deployment

- [ ] Redis cluster healthy (3+ nodes)
- [ ] Supabase connection verified
- [ ] E2B API key valid
- [ ] OpenAI API key valid
- [ ] Docker image built and pushed
- [ ] Kubernetes secrets created
- [ ] HPA metrics available

### Deployment

- [ ] Apply Kubernetes manifests
- [ ] Verify pods starting
- [ ] Check logs for errors
- [ ] Verify Redis connection
- [ ] Verify Supabase connection
- [ ] Verify sandbox pool initialization

### Post-Deployment

- [ ] Enqueue test job
- [ ] Verify job completes
- [ ] Check Prometheus metrics
- [ ] Verify Grafana dashboards
- [ ] Test graceful shutdown
- [ ] Test HPA scaling

### Rollback

If issues occur:
1. `kubectl rollout undo deployment/bullmq-worker`
2. Check logs: `kubectl logs -l app=bullmq-worker --tail=100`
3. Verify Redis state: `redis-cli INFO`
```

### 9.2 Troubleshooting Guide

```markdown
## Troubleshooting Guide

### Jobs Stuck in Queue

**Symptoms:**
- Queue length increasing
- No jobs being processed

**Diagnosis:**
1. Check worker pods: `kubectl get pods -l app=bullmq-worker`
2. Check worker logs: `kubectl logs -l app=bullmq-worker --tail=100`
3. Check Redis connection: `redis-cli PING`

**Resolution:**
1. Restart workers: `kubectl rollout restart deployment/bullmq-worker`
2. Scale up workers: `kubectl scale deployment/bullmq-worker --replicas=10`
3. Check for stuck jobs: `redis-cli LRANGE processing:* 0 -1`

### High Job Failure Rate

**Symptoms:**
- `bullmq_jobs_total{status="failed"}` increasing
- User complaints about failed tasks

**Diagnosis:**
1. Check failure reasons in logs
2. Check LLM API status
3. Check sandbox availability

**Resolution:**
1. If LLM API down: Wait for recovery, jobs will retry
2. If sandbox issues: Restart sandbox pool
3. If credit issues: Check billing service

### Memory Pressure

**Symptoms:**
- OOMKilled pods
- Slow job processing

**Diagnosis:**
1. Check memory usage: `kubectl top pods -l app=bullmq-worker`
2. Check for memory leaks in logs

**Resolution:**
1. Increase memory limits
2. Reduce concurrency
3. Check for sandbox leaks
```

---

## Appendix A: Error Codes

| Code | Name | Retryable | Description |
|------|------|-----------|-------------|
| E001 | VALIDATION_ERROR | No | Invalid job payload |
| E002 | AUTH_ERROR | No | Authentication failed |
| E003 | CREDIT_INSUFFICIENT | No | Not enough credits |
| E004 | SANDBOX_TIMEOUT | Yes | Sandbox acquisition timeout |
| E005 | SANDBOX_ERROR | Yes | Sandbox execution error |
| E006 | LLM_TIMEOUT | Yes | LLM API timeout |
| E007 | LLM_ERROR | Yes | LLM API error |
| E008 | LLM_RATE_LIMIT | Yes | LLM rate limited |
| E009 | TOOL_TIMEOUT | Yes | Tool execution timeout |
| E010 | TOOL_ERROR | Depends | Tool execution error |
| E011 | JOB_TIMEOUT | No | Job exceeded timeout |
| E012 | JOB_CANCELLED | No | Job cancelled by user |
| E013 | CHECKPOINT_ERROR | Yes | Checkpoint save failed |
| E014 | BILLING_ERROR | Yes | Billing service error |
| E999 | INTERNAL_ERROR | Yes | Unknown internal error |

---

## Appendix B: Queue Priority Matrix

| Task Type | Default Queue | Priority | Timeout | Max Retries |
|-----------|---------------|----------|---------|-------------|
| Agent Run | agent:standard | 5 | 2h | 3 |
| Tool Execution | tools:fast | 7 | 5m | 3 |
| Wide Research | research:wide | 5 | 4h | 2 |
| Slide Generation | generation:slides | 5 | 30m | 2 |
| Document Generation | generation:slides | 5 | 30m | 2 |
| Data Analysis | agent:standard | 5 | 1h | 3 |
| Critical (any) | agent:critical | 10 | 2h | 5 |
| Bulk (any) | bulk:operations | 1 | 24h | 5 |

---

*Document Version: 1.0*  
*Last Updated: January 21, 2026*  
*Author: Technical Lead*
