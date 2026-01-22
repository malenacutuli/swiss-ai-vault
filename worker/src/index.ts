/**
 * Swiss Agent Worker Service
 *
 * Long-running worker process that handles agent task execution.
 * Decoupled from Edge Functions to avoid timeout limitations.
 *
 * Architecture:
 * 1. Edge Function creates task record and enqueues to Redis
 * 2. Worker picks up task from queue
 * 3. Worker runs full execution loop (no timeout constraints)
 * 4. Status updates flow through database (Realtime subscriptions)
 *
 * Deployment: Railway, Fly.io, or Kubernetes
 */

import 'dotenv/config';
import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { Queue, Worker, Job } from 'bullmq';
import Redis from 'ioredis';
import { AgentExecutor } from './executor.js';

// Environment configuration
const config = {
  port: parseInt(process.env.PORT || '3001'),
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '3'),
  webhookSecret: process.env.WORKER_WEBHOOK_SECRET || 'dev-secret',
};

// Validate required env vars
if (!config.supabaseUrl || !config.supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Initialize Supabase client
const supabase = createClient(config.supabaseUrl, config.supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Initialize Redis connection
const redisConnection = new Redis(config.redisUrl, {
  maxRetriesPerRequest: null, // Required for BullMQ
  enableReadyCheck: false,
});

// Create BullMQ queue
const taskQueue = new Queue('agent-tasks', {
  connection: redisConnection,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 50,
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
  },
});

// Express app for health checks and webhook triggers
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    queue: 'agent-tasks',
    concurrency: config.workerConcurrency,
  });
});

// Queue stats endpoint
app.get('/stats', async (req, res) => {
  try {
    const [waiting, active, completed, failed] = await Promise.all([
      taskQueue.getWaitingCount(),
      taskQueue.getActiveCount(),
      taskQueue.getCompletedCount(),
      taskQueue.getFailedCount(),
    ]);

    res.json({
      waiting,
      active,
      completed,
      failed,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

// Webhook endpoint for Edge Functions to trigger task execution
app.post('/execute', async (req, res) => {
  // Verify webhook secret
  const secret = req.headers['x-worker-secret'];
  if (secret !== config.webhookSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { task_id, priority = 0 } = req.body;

  if (!task_id) {
    return res.status(400).json({ error: 'task_id is required' });
  }

  try {
    // Add task to queue
    const job = await taskQueue.add(
      'execute-task',
      { taskId: task_id },
      { priority }
    );

    console.log(`[Worker] Task ${task_id} queued as job ${job.id}`);

    res.json({
      success: true,
      job_id: job.id,
      task_id,
      message: 'Task queued for execution',
    });
  } catch (error) {
    console.error('[Worker] Failed to queue task:', error);
    res.status(500).json({ error: 'Failed to queue task' });
  }
});

// Create the worker process
const worker = new Worker(
  'agent-tasks',
  async (job: Job<{ taskId: string }>) => {
    const { taskId } = job.data;
    console.log(`[Worker] Processing task ${taskId} (job ${job.id})`);

    const executor = new AgentExecutor(supabase, taskId);

    try {
      // Report progress at key points
      await job.updateProgress(0);

      // Execute the full agent loop
      const result = await executor.execute({
        onProgress: async (progress: number) => {
          await job.updateProgress(progress);
        },
        onLog: async (message: string) => {
          await job.log(message);
        },
      });

      await job.updateProgress(100);

      console.log(`[Worker] Task ${taskId} completed:`, result.status);
      return result;
    } catch (error) {
      console.error(`[Worker] Task ${taskId} failed:`, error);

      // Update task status in database
      await supabase
        .from('agent_runs')
        .update({
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
          completed_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      throw error; // BullMQ will handle retries
    }
  },
  {
    connection: redisConnection,
    concurrency: config.workerConcurrency,
    limiter: {
      max: 10,
      duration: 1000, // 10 jobs per second
    },
  }
);

// Worker event handlers
worker.on('completed', (job, result) => {
  console.log(`[Worker] Job ${job.id} completed with result:`, result?.status);
});

worker.on('failed', (job, error) => {
  console.error(`[Worker] Job ${job?.id} failed:`, error.message);
});

worker.on('progress', (job, progress) => {
  console.log(`[Worker] Job ${job.id} progress: ${progress}%`);
});

worker.on('error', (error) => {
  console.error('[Worker] Worker error:', error);
});

// Graceful shutdown
async function shutdown() {
  console.log('[Worker] Shutting down...');

  await worker.close();
  await taskQueue.close();
  await redisConnection.quit();

  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the server
app.listen(config.port, () => {
  console.log(`[Worker] Server listening on port ${config.port}`);
  console.log(`[Worker] Supabase: ${config.supabaseUrl}`);
  console.log(`[Worker] Redis: ${config.redisUrl}`);
  console.log(`[Worker] Concurrency: ${config.workerConcurrency}`);
});

console.log('[Worker] Starting worker process...');
