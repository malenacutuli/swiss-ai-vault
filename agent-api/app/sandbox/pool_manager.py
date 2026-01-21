"""
Warm Sandbox Pool Manager
Maintains a pool of pre-warmed E2B sandboxes for instant availability
"""
import asyncio
import logging
from typing import Dict, Optional, List
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import uuid

logger = logging.getLogger(__name__)


class SandboxState(Enum):
    """Sandbox lifecycle states"""
    WARMING = "warming"      # Being initialized
    READY = "ready"          # Available for use
    ASSIGNED = "assigned"    # Assigned to a run
    BUSY = "busy"            # Actively executing
    DRAINING = "draining"    # Completing work before shutdown
    TERMINATED = "terminated"


@dataclass
class PooledSandbox:
    """Represents a sandbox in the pool"""
    id: str
    sandbox_id: str  # E2B sandbox ID
    state: SandboxState
    created_at: datetime
    assigned_at: Optional[datetime] = None
    run_id: Optional[str] = None
    last_activity: datetime = field(default_factory=datetime.utcnow)
    template: str = "base"
    
    @property
    def age_seconds(self) -> float:
        return (datetime.utcnow() - self.created_at).total_seconds()
    
    @property
    def idle_seconds(self) -> float:
        return (datetime.utcnow() - self.last_activity).total_seconds()


class SandboxPoolManager:
    """
    Manages a pool of warm E2B sandboxes for instant availability.
    
    Features:
    - Pre-warms sandboxes to eliminate cold start latency
    - Maintains minimum pool size for each template
    - Recycles sandboxes after max lifetime
    - Cleans up idle sandboxes
    - Tracks sandbox health and metrics
    """
    
    def __init__(
        self,
        e2b_api_key: str,
        min_pool_size: int = 3,
        max_pool_size: int = 10,
        max_sandbox_age_seconds: int = 3600,  # 1 hour
        max_idle_seconds: int = 300,  # 5 minutes
        warmup_interval_seconds: int = 30,
    ):
        self.e2b_api_key = e2b_api_key
        self.min_pool_size = min_pool_size
        self.max_pool_size = max_pool_size
        self.max_sandbox_age_seconds = max_sandbox_age_seconds
        self.max_idle_seconds = max_idle_seconds
        self.warmup_interval_seconds = warmup_interval_seconds
        
        # Pool storage
        self.sandboxes: Dict[str, PooledSandbox] = {}
        
        # Metrics
        self.metrics = {
            "total_created": 0,
            "total_assigned": 0,
            "total_recycled": 0,
            "total_terminated": 0,
            "cache_hits": 0,
            "cache_misses": 0,
        }
        
        # Background tasks
        self._warmup_task: Optional[asyncio.Task] = None
        self._cleanup_task: Optional[asyncio.Task] = None
        self._running = False
        
        logger.info(f"SandboxPoolManager initialized: min={min_pool_size}, max={max_pool_size}")
        
    async def start(self):
        """Start the pool manager background tasks"""
        if self._running:
            return
            
        self._running = True
        
        # Start background tasks
        self._warmup_task = asyncio.create_task(self._warmup_loop())
        self._cleanup_task = asyncio.create_task(self._cleanup_loop())
        
        # Initial warmup
        await self._ensure_min_pool_size()
        
        logger.info("SandboxPoolManager started")
        
    async def stop(self):
        """Stop the pool manager and cleanup"""
        self._running = False
        
        # Cancel background tasks
        if self._warmup_task:
            self._warmup_task.cancel()
        if self._cleanup_task:
            self._cleanup_task.cancel()
            
        # Terminate all sandboxes
        for sandbox in list(self.sandboxes.values()):
            await self._terminate_sandbox(sandbox)
            
        logger.info("SandboxPoolManager stopped")
        
    async def acquire(self, run_id: str, template: str = "base") -> Optional[PooledSandbox]:
        """
        Acquire a sandbox from the pool.
        
        Returns a ready sandbox if available, otherwise creates a new one.
        """
        # Try to find a ready sandbox
        for sandbox in self.sandboxes.values():
            if sandbox.state == SandboxState.READY and sandbox.template == template:
                sandbox.state = SandboxState.ASSIGNED
                sandbox.assigned_at = datetime.utcnow()
                sandbox.run_id = run_id
                sandbox.last_activity = datetime.utcnow()
                
                self.metrics["total_assigned"] += 1
                self.metrics["cache_hits"] += 1
                
                logger.info(f"Acquired sandbox {sandbox.id} for run {run_id} (cache hit)")
                return sandbox
                
        # No ready sandbox, create new one
        self.metrics["cache_misses"] += 1
        
        if len(self.sandboxes) >= self.max_pool_size:
            logger.warning(f"Pool at max capacity ({self.max_pool_size}), cannot create new sandbox")
            return None
            
        sandbox = await self._create_sandbox(template)
        if sandbox:
            sandbox.state = SandboxState.ASSIGNED
            sandbox.assigned_at = datetime.utcnow()
            sandbox.run_id = run_id
            
            self.metrics["total_assigned"] += 1
            
            logger.info(f"Created new sandbox {sandbox.id} for run {run_id} (cache miss)")
            return sandbox
            
        return None
        
    async def release(self, sandbox_id: str, recycle: bool = True):
        """
        Release a sandbox back to the pool.
        
        If recycle=True and sandbox is healthy, returns to ready state.
        Otherwise, terminates the sandbox.
        """
        sandbox = self.sandboxes.get(sandbox_id)
        if not sandbox:
            logger.warning(f"Attempted to release unknown sandbox {sandbox_id}")
            return
            
        sandbox.run_id = None
        sandbox.last_activity = datetime.utcnow()
        
        # Check if sandbox should be recycled
        if recycle and sandbox.age_seconds < self.max_sandbox_age_seconds:
            sandbox.state = SandboxState.READY
            self.metrics["total_recycled"] += 1
            logger.info(f"Recycled sandbox {sandbox_id} back to pool")
        else:
            await self._terminate_sandbox(sandbox)
            
    async def mark_busy(self, sandbox_id: str):
        """Mark a sandbox as actively executing"""
        sandbox = self.sandboxes.get(sandbox_id)
        if sandbox:
            sandbox.state = SandboxState.BUSY
            sandbox.last_activity = datetime.utcnow()
            
    async def mark_idle(self, sandbox_id: str):
        """Mark a sandbox as idle (assigned but not executing)"""
        sandbox = self.sandboxes.get(sandbox_id)
        if sandbox and sandbox.state == SandboxState.BUSY:
            sandbox.state = SandboxState.ASSIGNED
            sandbox.last_activity = datetime.utcnow()
            
    def get_stats(self) -> Dict:
        """Get pool statistics"""
        states = {}
        for sandbox in self.sandboxes.values():
            state = sandbox.state.value
            states[state] = states.get(state, 0) + 1
            
        return {
            "pool_size": len(self.sandboxes),
            "min_pool_size": self.min_pool_size,
            "max_pool_size": self.max_pool_size,
            "states": states,
            "metrics": self.metrics,
        }
        
    async def _create_sandbox(self, template: str = "base") -> Optional[PooledSandbox]:
        """Create a new E2B sandbox"""
        try:
            from e2b_code_interpreter import Sandbox
            
            # Create E2B sandbox
            e2b_sandbox = Sandbox(api_key=self.e2b_api_key)
            
            # Create pool entry
            sandbox = PooledSandbox(
                id=str(uuid.uuid4()),
                sandbox_id=e2b_sandbox.id,
                state=SandboxState.WARMING,
                created_at=datetime.utcnow(),
                template=template,
            )
            
            # Warm up the sandbox (install common dependencies)
            await self._warmup_sandbox(e2b_sandbox, template)
            
            sandbox.state = SandboxState.READY
            self.sandboxes[sandbox.id] = sandbox
            self.metrics["total_created"] += 1
            
            logger.info(f"Created sandbox {sandbox.id} (E2B: {e2b_sandbox.id})")
            return sandbox
            
        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            return None
            
    async def _warmup_sandbox(self, e2b_sandbox, template: str):
        """Pre-warm a sandbox with common dependencies"""
        try:
            # Install common tools
            warmup_commands = [
                "pip install requests httpx beautifulsoup4 --quiet",
                "npm install -g pnpm typescript --silent",
            ]
            
            if template == "webdev":
                warmup_commands.extend([
                    "npm install -g vite create-vite --silent",
                ])
                
            for cmd in warmup_commands:
                result = e2b_sandbox.process.start_and_wait(cmd, timeout=60)
                if result.exit_code != 0:
                    logger.warning(f"Warmup command failed: {cmd}")
                    
            logger.debug(f"Sandbox {e2b_sandbox.id} warmed up with template {template}")
            
        except Exception as e:
            logger.warning(f"Sandbox warmup error: {e}")
            
    async def _terminate_sandbox(self, sandbox: PooledSandbox):
        """Terminate a sandbox"""
        try:
            from e2b_code_interpreter import Sandbox
            
            sandbox.state = SandboxState.TERMINATED
            
            # Close E2B sandbox
            e2b_sandbox = Sandbox.reconnect(sandbox.sandbox_id, api_key=self.e2b_api_key)
            e2b_sandbox.close()
            
            # Remove from pool
            del self.sandboxes[sandbox.id]
            self.metrics["total_terminated"] += 1
            
            logger.info(f"Terminated sandbox {sandbox.id}")
            
        except Exception as e:
            logger.error(f"Failed to terminate sandbox {sandbox.id}: {e}")
            # Still remove from pool
            if sandbox.id in self.sandboxes:
                del self.sandboxes[sandbox.id]
                
    async def _ensure_min_pool_size(self):
        """Ensure minimum number of ready sandboxes"""
        ready_count = sum(1 for s in self.sandboxes.values() if s.state == SandboxState.READY)
        
        needed = self.min_pool_size - ready_count
        if needed > 0:
            logger.info(f"Pool needs {needed} more sandboxes (current ready: {ready_count})")
            
            for _ in range(needed):
                if len(self.sandboxes) < self.max_pool_size:
                    await self._create_sandbox()
                    
    async def _warmup_loop(self):
        """Background task to maintain minimum pool size"""
        while self._running:
            try:
                await self._ensure_min_pool_size()
            except Exception as e:
                logger.error(f"Warmup loop error: {e}")
                
            await asyncio.sleep(self.warmup_interval_seconds)
            
    async def _cleanup_loop(self):
        """Background task to cleanup old/idle sandboxes"""
        while self._running:
            try:
                now = datetime.utcnow()
                
                for sandbox in list(self.sandboxes.values()):
                    # Skip busy sandboxes
                    if sandbox.state in [SandboxState.BUSY, SandboxState.WARMING]:
                        continue
                        
                    # Terminate old sandboxes
                    if sandbox.age_seconds > self.max_sandbox_age_seconds:
                        logger.info(f"Terminating old sandbox {sandbox.id} (age: {sandbox.age_seconds}s)")
                        await self._terminate_sandbox(sandbox)
                        continue
                        
                    # Terminate idle sandboxes (beyond min pool size)
                    ready_count = sum(1 for s in self.sandboxes.values() if s.state == SandboxState.READY)
                    if (sandbox.state == SandboxState.READY and 
                        sandbox.idle_seconds > self.max_idle_seconds and
                        ready_count > self.min_pool_size):
                        logger.info(f"Terminating idle sandbox {sandbox.id} (idle: {sandbox.idle_seconds}s)")
                        await self._terminate_sandbox(sandbox)
                        
            except Exception as e:
                logger.error(f"Cleanup loop error: {e}")
                
            await asyncio.sleep(60)  # Run every minute


# Singleton instance
_pool_manager: Optional[SandboxPoolManager] = None


def get_sandbox_pool_manager() -> Optional[SandboxPoolManager]:
    """Get the singleton pool manager instance"""
    return _pool_manager


async def init_sandbox_pool_manager(e2b_api_key: str, **kwargs) -> SandboxPoolManager:
    """Initialize and start the sandbox pool manager"""
    global _pool_manager
    
    if _pool_manager is None:
        _pool_manager = SandboxPoolManager(e2b_api_key, **kwargs)
        await _pool_manager.start()
        
    return _pool_manager


async def shutdown_sandbox_pool_manager():
    """Shutdown the sandbox pool manager"""
    global _pool_manager
    
    if _pool_manager:
        await _pool_manager.stop()
        _pool_manager = None
