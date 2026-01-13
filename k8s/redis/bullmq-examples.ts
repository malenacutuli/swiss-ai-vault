/**
 * BullMQ Integration Examples for SwissBrain AI
 *
 * This file provides example code for integrating BullMQ with Redis
 * for background job processing and task queues.
 */

import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import IORedis from 'ioredis';

// ============================================================================
// Redis Connection Configuration
// ============================================================================

export const redisConnection = {
  host: process.env.REDIS_HOST || 'redis.swissbrain.svc.cluster.local',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: 3,
  retryStrategy(times: number) {
    const delay = Math.min(times * 1000, 30000);
    return delay;
  },
  enableReadyCheck: true,
  enableOfflineQueue: true,
  connectTimeout: 10000,
  keepAlive: 30000,
  family: 4, // IPv4
  db: 0,
};

// ============================================================================
// Queue Creation
// ============================================================================

/**
 * Create a new queue for agent tasks
 */
export function createAgentTaskQueue() {
  return new Queue('agent-tasks', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000, // Start with 1 second, doubles each retry
      },
      removeOnComplete: {
        age: 86400, // Remove completed jobs after 24 hours
        count: 1000, // Keep max 1000 completed jobs
      },
      removeOnFail: {
        age: 604800, // Keep failed jobs for 7 days
      },
    },
  });
}

/**
 * Create queue for document processing
 */
export function createDocumentProcessingQueue() {
  return new Queue('document-processing', {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 5, // More attempts for potentially large documents
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      timeout: 300000, // 5 minutes timeout
      removeOnComplete: {
        age: 3600, // Remove after 1 hour
        count: 500,
      },
    },
  });
}

// ============================================================================
// Job Addition
// ============================================================================

interface AgentTaskData {
  taskId: string;
  userId: string;
  prompt: string;
  agentType: 'planning' | 'execution' | 'research';
  priority?: number;
}

/**
 * Add a new agent task to the queue
 */
export async function addAgentTask(
  queue: Queue,
  data: AgentTaskData,
  options?: {
    priority?: number;
    delay?: number;
    jobId?: string;
  }
) {
  return await queue.add('agent-task', data, {
    priority: options?.priority || 0,
    delay: options?.delay,
    jobId: options?.jobId,
  });
}

/**
 * Add a scheduled task
 */
export async function addScheduledTask(
  queue: Queue,
  data: any,
  cronExpression: string
) {
  return await queue.add('scheduled-task', data, {
    repeat: {
      pattern: cronExpression,
    },
  });
}

/**
 * Add a batch of jobs
 */
export async function addBulkTasks(
  queue: Queue,
  tasks: AgentTaskData[]
) {
  const jobs = tasks.map((task) => ({
    name: 'agent-task',
    data: task,
    opts: {
      priority: task.priority || 0,
    },
  }));

  return await queue.addBulk(jobs);
}

// ============================================================================
// Worker Creation
// ============================================================================

/**
 * Create a worker to process agent tasks
 */
export function createAgentTaskWorker() {
  const worker = new Worker(
    'agent-tasks',
    async (job: Job) => {
      console.log(`Processing job ${job.id}:`, job.data);

      const { taskId, userId, prompt, agentType } = job.data;

      // Update progress
      await job.updateProgress(10);

      try {
        // 1. Initialize agent
        await job.updateProgress(20);
        console.log(`Initializing ${agentType} agent for task ${taskId}`);

        // 2. Execute task
        await job.updateProgress(50);
        console.log(`Executing task ${taskId}`);

        // Simulate processing
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // 3. Complete task
        await job.updateProgress(90);
        console.log(`Finalizing task ${taskId}`);

        await job.updateProgress(100);

        return {
          success: true,
          taskId,
          result: 'Task completed successfully',
          timestamp: new Date().toISOString(),
        };
      } catch (error) {
        console.error(`Error processing task ${taskId}:`, error);
        throw error;
      }
    },
    {
      connection: redisConnection,
      concurrency: 10, // Process up to 10 jobs concurrently
      maxStalledCount: 3, // Retry stalled jobs 3 times
      stalledInterval: 30000, // Check for stalled jobs every 30s
      lockDuration: 30000, // Lock job for 30s
      lockRenewTime: 15000, // Renew lock every 15s
    }
  );

  // Worker event handlers
  worker.on('completed', (job) => {
    console.log(`Job ${job.id} completed:`, job.returnvalue);
  });

  worker.on('failed', (job, error) => {
    console.error(`Job ${job?.id} failed:`, error);
  });

  worker.on('progress', (job, progress) => {
    console.log(`Job ${job.id} progress: ${progress}%`);
  });

  worker.on('error', (error) => {
    console.error('Worker error:', error);
  });

  return worker;
}

// ============================================================================
// Queue Events Monitoring
// ============================================================================

/**
 * Monitor queue events
 */
export function createQueueEventsMonitor(queueName: string) {
  const queueEvents = new QueueEvents(queueName, {
    connection: redisConnection,
  });

  queueEvents.on('waiting', ({ jobId }) => {
    console.log(`Job ${jobId} is waiting`);
  });

  queueEvents.on('active', ({ jobId }) => {
    console.log(`Job ${jobId} is now active`);
  });

  queueEvents.on('completed', ({ jobId, returnvalue }) => {
    console.log(`Job ${jobId} completed:`, returnvalue);
  });

  queueEvents.on('failed', ({ jobId, failedReason }) => {
    console.error(`Job ${jobId} failed:`, failedReason);
  });

  queueEvents.on('progress', ({ jobId, data }) => {
    console.log(`Job ${jobId} progress:`, data);
  });

  queueEvents.on('stalled', ({ jobId }) => {
    console.warn(`Job ${jobId} stalled`);
  });

  return queueEvents;
}

// ============================================================================
// Queue Management
// ============================================================================

/**
 * Get queue statistics
 */
export async function getQueueStats(queue: Queue) {
  const [
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
  ] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.getDelayedCount(),
    queue.getPausedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused,
    total: waiting + active + completed + failed + delayed,
  };
}

/**
 * Clean old jobs from queue
 */
export async function cleanQueue(queue: Queue) {
  // Clean completed jobs older than 24 hours
  await queue.clean(24 * 3600 * 1000, 1000, 'completed');

  // Clean failed jobs older than 7 days
  await queue.clean(7 * 24 * 3600 * 1000, 1000, 'failed');

  console.log('Queue cleaned successfully');
}

/**
 * Pause/Resume queue
 */
export async function pauseQueue(queue: Queue) {
  await queue.pause();
  console.log('Queue paused');
}

export async function resumeQueue(queue: Queue) {
  await queue.resume();
  console.log('Queue resumed');
}

/**
 * Get job by ID
 */
export async function getJob(queue: Queue, jobId: string) {
  return await queue.getJob(jobId);
}

/**
 * Remove job by ID
 */
export async function removeJob(queue: Queue, jobId: string) {
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    console.log(`Job ${jobId} removed`);
  }
}

/**
 * Retry failed job
 */
export async function retryFailedJob(queue: Queue, jobId: string) {
  const job = await queue.getJob(jobId);
  if (job && await job.isFailed()) {
    await job.retry();
    console.log(`Job ${jobId} retried`);
  }
}

// ============================================================================
// Rate Limiting
// ============================================================================

/**
 * Create a rate-limited queue
 */
export function createRateLimitedQueue(queueName: string) {
  return new Queue(queueName, {
    connection: redisConnection,
    limiter: {
      max: 1000, // Max 1000 jobs
      duration: 60000, // Per 60 seconds
    },
  });
}

// ============================================================================
// Priority Queues
// ============================================================================

/**
 * Add high-priority task
 */
export async function addHighPriorityTask(
  queue: Queue,
  data: any
) {
  return await queue.add('high-priority-task', data, {
    priority: 1, // Lower number = higher priority
  });
}

/**
 * Add low-priority task
 */
export async function addLowPriorityTask(
  queue: Queue,
  data: any
) {
  return await queue.add('low-priority-task', data, {
    priority: 100,
  });
}

// ============================================================================
// Complete Example: Initialize BullMQ System
// ============================================================================

/**
 * Initialize the complete BullMQ system
 */
export async function initializeBullMQ() {
  // Create queues
  const agentTaskQueue = createAgentTaskQueue();
  const docProcessingQueue = createDocumentProcessingQueue();

  // Create workers
  const agentWorker = createAgentTaskWorker();

  // Create event monitors
  const agentEvents = createQueueEventsMonitor('agent-tasks');
  const docEvents = createQueueEventsMonitor('document-processing');

  // Graceful shutdown
  process.on('SIGTERM', async () => {
    console.log('SIGTERM received, closing workers...');
    await agentWorker.close();
    await agentTaskQueue.close();
    await docProcessingQueue.close();
    await agentEvents.close();
    await docEvents.close();
    process.exit(0);
  });

  console.log('BullMQ system initialized successfully');

  return {
    queues: {
      agentTasks: agentTaskQueue,
      documentProcessing: docProcessingQueue,
    },
    workers: {
      agentWorker,
    },
    events: {
      agentEvents,
      docEvents,
    },
  };
}

// ============================================================================
// Usage Example
// ============================================================================

async function example() {
  // Initialize system
  const system = await initializeBullMQ();

  // Add a task
  const job = await addAgentTask(system.queues.agentTasks, {
    taskId: 'task-123',
    userId: 'user-456',
    prompt: 'Create a React component',
    agentType: 'execution',
    priority: 1,
  });

  console.log(`Job ${job.id} added to queue`);

  // Get queue stats
  const stats = await getQueueStats(system.queues.agentTasks);
  console.log('Queue stats:', stats);

  // Schedule a recurring task
  await addScheduledTask(
    system.queues.agentTasks,
    { type: 'cleanup' },
    '0 0 * * *' // Every day at midnight
  );
}

// Uncomment to run example
// example().catch(console.error);
