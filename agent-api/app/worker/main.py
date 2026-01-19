"""Worker process main entry point"""
print("=== main.py MODULE LOADED ===", flush=True)

import asyncio
import signal
import logging
import sys
from app.worker.job_queue import JobQueue
from app.worker.job_processor import JobProcessor

print("=== main.py IMPORTS COMPLETE ===", flush=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)

logger = logging.getLogger(__name__)


class AgentWorker:
    """
    Worker process for agent execution.

    Continuously dequeues jobs from Redis and processes them.
    """

    def __init__(self):
        # Write immediate heartbeat BEFORE any initialization
        try:
            from datetime import datetime
            from redis import Redis
            from app.config import get_settings
            settings = get_settings()
            # Convert redis:// to rediss:// for Upstash TLS
            redis_url = settings.redis_url
            if redis_url.startswith('redis://') and 'upstash.io' in redis_url:
                redis_url = redis_url.replace('redis://', 'rediss://')

            # Connect (ssl_cert_reqs='none' for TLS if needed)
            conn_kwargs = {'decode_responses': True}
            if redis_url.startswith('rediss://'):
                conn_kwargs['ssl_cert_reqs'] = 'none'
            r = Redis.from_url(redis_url, **conn_kwargs)
            r.set("worker:heartbeat", datetime.utcnow().isoformat())
            r.lpush("worker:debug", f"Worker __init__ started at {datetime.utcnow().isoformat()}")
            logger.info("Initial heartbeat written before initialization")
        except Exception as e:
            logger.error(f"Failed to write initial heartbeat: {e}")

        logger.info("Initializing JobQueue...")
        self.queue = JobQueue()
        logger.info("✓ JobQueue initialized")

        logger.info("Initializing JobProcessor...")
        self.processor = JobProcessor()
        logger.info("✓ JobProcessor initialized")

        # Initialize DB to Redis sync service
        logger.info("Initializing DB sync service...")
        from app.worker.db_sync import DBToRedisSync
        from supabase import create_client
        settings = get_settings()
        supabase = create_client(settings.supabase_url, settings.supabase_service_role_key)
        self.db_sync = DBToRedisSync(supabase, self.queue.redis)
        logger.info("✓ DB sync service initialized")

        self.running = True
        self.heartbeat_counter = 0  # For periodic status logging

        logger.info("✓ Agent Worker fully initialized")

    async def start(self):
        """Start worker main loop"""
        logger.info("=== start() method called ===")

        # Register signal handlers for graceful shutdown
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)

        logger.info("✓ Signal handlers registered")
        logger.info("✓ Agent Worker started successfully")
        logger.info("Worker configuration:")
        logger.info(f"  - BRPOP timeout: 5 seconds")
        logger.info(f"  - Max retries: {self.queue.max_retries}")
        logger.info("Waiting for jobs...")

        # Write heartbeat to Redis for monitoring
        try:
            from datetime import datetime
            self.queue.redis.set("worker:heartbeat", datetime.utcnow().isoformat())
            self.queue.redis.lpush("worker:debug", f"Worker started at {datetime.utcnow().isoformat()}")
            logger.info("Redis heartbeat written")
        except Exception as e:
            logger.error(f"Failed to write heartbeat: {e}")

        try:
            # Start DB sync service in background
            db_sync_task = asyncio.create_task(self.db_sync.start())
            logger.info("DB sync service started in background")

            # Start sandbox cleanup background task
            cleanup_task = asyncio.create_task(self._sandbox_cleanup_task())
            logger.info("Sandbox cleanup task started in background")

            # Start main processing loop
            await self._main_loop()

        except Exception as e:
            logger.exception(f"Worker main loop error: {e}")
            raise
        finally:
            self.db_sync.stop()
            logger.info("Agent Worker shutting down")

    async def _sandbox_cleanup_task(self):
        """Background task to cleanup expired E2B sandboxes"""
        from app.sandbox import get_sandbox_manager

        sandbox_manager = get_sandbox_manager()
        logger.info("Sandbox cleanup background task started")

        while self.running:
            try:
                await asyncio.sleep(300)  # Run every 5 minutes

                if not self.running:
                    break

                logger.info("Running sandbox cleanup...")
                await sandbox_manager.cleanup_expired_sandboxes()

                active_count = sandbox_manager.get_active_sandbox_count()
                logger.info(f"Sandbox cleanup completed: {active_count} active sandboxes")

            except asyncio.CancelledError:
                logger.info("Sandbox cleanup task cancelled")
                break
            except Exception as e:
                logger.error(f"Sandbox cleanup error: {e}")
                # Continue running despite errors

        logger.info("Sandbox cleanup task stopped")

    async def _main_loop(self):
        """Main job processing loop with comprehensive error handling"""
        logger.info("Entering main processing loop")

        # Write to Redis to confirm loop started
        try:
            from datetime import datetime
            self.queue.redis.lpush("worker:debug", f"Main loop entered at {datetime.utcnow().isoformat()}")
            logger.info("Main loop marker written to Redis")
        except Exception as e:
            logger.warning(f"Failed to log main loop start: {e}")

        logger.info("Starting main while loop...")

        # Write first iteration marker
        try:
            from datetime import datetime
            self.queue.redis.lpush("worker:debug", f"Entering first iteration at {datetime.utcnow().isoformat()}")
        except Exception as e:
            logger.warning(f"Failed to write first iteration marker: {e}")

        while self.running:
            try:
                # Heartbeat: Log that worker is alive every 60 iterations (~5 minutes)
                self.heartbeat_counter += 1
                if self.heartbeat_counter >= 60:
                    logger.info("Worker heartbeat: alive and processing")
                    self.heartbeat_counter = 0
                    # Update Redis heartbeat
                    try:
                        from datetime import datetime
                        self.queue.redis.set("worker:heartbeat", datetime.utcnow().isoformat())
                    except:
                        pass

                # Log queue stats periodically (non-critical, ignore errors)
                try:
                    stats = self.queue.get_queue_stats()
                    logger.debug(f"Queue stats: {stats}")
                except Exception as e:
                    logger.warning(f"Failed to get queue stats: {e}")

                # Dequeue next job (blocking with 5s timeout)
                # Note: This blocks the event loop, but simplifies error handling
                logger.debug("About to call dequeue()...")
                try:
                    job = self.queue.dequeue(timeout=5)
                    logger.debug(f"Dequeue returned: {job is not None}")
                except Exception as e:
                    logger.error(f"Failed to dequeue job: {e}")
                    await asyncio.sleep(1)
                    continue

                if job:
                    run_id = job["run_id"]
                    retry_count = job.get("retry_count", 0)

                    logger.info(f"Dequeued job: {run_id} (retry={retry_count})")

                    # Process job with comprehensive error handling
                    try:
                        success, error = await self.processor.process(job)

                        # Update queue based on result
                        try:
                            if success:
                                self.queue.mark_complete(run_id)
                                logger.info(f"Job {run_id} completed successfully")
                            else:
                                self.queue.mark_failed(run_id, error or "Unknown error", retry_count)
                                logger.error(f"Job {run_id} failed: {error}")
                        except Exception as e:
                            logger.error(f"Failed to update queue status for job {run_id}: {e}")

                    except Exception as e:
                        logger.exception(f"Unhandled exception processing job {run_id}: {e}")
                        # Try to mark as failed
                        try:
                            self.queue.mark_failed(run_id, f"Unhandled exception: {str(e)}", retry_count)
                        except Exception as mark_error:
                            logger.error(f"Failed to mark job {run_id} as failed: {mark_error}")

                else:
                    # No job available, continue loop
                    await asyncio.sleep(0.1)

            except Exception as e:
                # Catch any other unhandled exceptions in the loop
                logger.exception(f"Unhandled exception in main loop: {e}")
                await asyncio.sleep(1)  # Prevent tight loop on persistent errors

    def _signal_handler(self, signum, frame):
        """Handle shutdown signals"""
        signal_name = signal.Signals(signum).name
        logger.info(f"Received {signal_name}, initiating graceful shutdown...")
        self.running = False


def main():
    """Main entry point"""
    print("=== main() FUNCTION CALLED ===", flush=True)
    logger.info("Starting Swiss Agent Worker")

    try:
        worker = AgentWorker()
        logger.info("Worker initialized successfully")
    except Exception as e:
        logger.exception(f"Failed to initialize worker: {e}")
        sys.exit(1)

    try:
        asyncio.run(worker.start())
    except KeyboardInterrupt:
        logger.info("Worker interrupted by user")
    except Exception as e:
        logger.exception(f"Worker failed: {e}")
        sys.exit(1)

    logger.info("Worker shutdown complete")


if __name__ == "__main__":
    main()
