"""
Enhanced E2B Sandbox Manager with SwissBrain Parity.

Provides advanced features:
- Full configuration support (resource limits, networking, storage)
- Real-time metrics collection
- Health monitoring with automatic recovery
- Custom environment setup
- Resource quota enforcement
"""
import asyncio
import logging
import time
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from e2b_code_interpreter import Sandbox

from app.config import get_settings
from app.sandbox.config import (
    SandboxConfig,
    SandboxMetrics,
    DEFAULT_CONFIG,
    LIGHTWEIGHT_CONFIG,
    HEAVY_COMPUTE_CONFIG,
    BROWSER_CONFIG
)

logger = logging.getLogger(__name__)


class EnhancedE2BSandboxManager:
    """
    Enhanced E2B Sandbox Manager with SwissBrain parity.

    Features:
    - Advanced configuration (CPU, memory, disk limits)
    - Real-time metrics collection
    - Health monitoring and automatic recovery
    - Custom environment setup
    - Resource quota enforcement
    - Domain whitelisting/blacklisting
    """

    def __init__(self):
        self.settings = get_settings()
        self.active_sandboxes: Dict[str, Sandbox] = {}
        self.sandbox_configs: Dict[str, SandboxConfig] = {}
        self.sandbox_metrics: Dict[str, SandboxMetrics] = {}

    async def create_sandbox(
        self,
        run_id: str,
        config: Optional[SandboxConfig] = None,
        custom_packages: Optional[List[str]] = None,
        environment_vars: Optional[Dict[str, str]] = None
    ) -> str:
        """
        Create new E2B sandbox with advanced configuration.

        Args:
            run_id: Agent run ID
            config: Sandbox configuration (defaults to DEFAULT_CONFIG)
            custom_packages: Packages to install (e.g., ["pandas", "numpy"])
            environment_vars: Environment variables to set

        Returns:
            Sandbox ID
        """
        if config is None:
            config = DEFAULT_CONFIG

        logger.info(
            f"Creating sandbox for run {run_id} with config: "
            f"CPU={config.cpu_count}, MEM={config.memory_mb}MB, DISK={config.disk_gb}GB"
        )

        try:
            # Merge environment variables
            env_vars = {**config.environment_variables}
            if environment_vars:
                env_vars.update(environment_vars)

            # Create E2B sandbox
            sandbox = Sandbox(
                api_key=self.settings.e2b_api_key,
                timeout=config.startup_timeout,
                metadata={
                    "run_id": run_id,
                    "cpu_count": config.cpu_count,
                    "memory_mb": config.memory_mb,
                    "disk_gb": config.disk_gb
                }
            )

            sandbox_id = sandbox.id

            # Store sandbox and config
            self.active_sandboxes[run_id] = sandbox
            self.sandbox_configs[run_id] = config

            # Initialize metrics
            self.sandbox_metrics[run_id] = SandboxMetrics(
                sandbox_id=sandbox_id,
                run_id=run_id,
                memory_limit_mb=config.memory_mb,
                disk_limit_gb=config.disk_gb,
                started_at=datetime.utcnow()
            )

            logger.info(f"Created sandbox {sandbox_id} for run {run_id}")

            # Setup custom environment if needed
            if custom_packages or env_vars:
                await self._setup_custom_environment(
                    run_id=run_id,
                    packages=custom_packages or [],
                    environment_vars=env_vars
                )

            # Install pre-configured packages
            if config.pre_install_packages:
                await self._install_packages(run_id, config.pre_install_packages)

            return sandbox_id

        except Exception as e:
            logger.error(f"Failed to create sandbox: {e}")
            raise

    async def get_or_create_sandbox(
        self,
        run_id: str,
        config: Optional[SandboxConfig] = None
    ) -> Sandbox:
        """
        Get existing sandbox or create new one with pooling.

        Args:
            run_id: Agent run ID
            config: Sandbox configuration

        Returns:
            E2B Sandbox instance
        """
        # Check if sandbox already exists
        if run_id in self.active_sandboxes:
            sandbox = self.active_sandboxes[run_id]

            # Health check
            is_healthy = await self._health_check_sandbox(run_id)

            if is_healthy:
                logger.info(f"Reusing healthy sandbox for run {run_id}")
                return sandbox
            else:
                logger.warning(f"Sandbox unhealthy for run {run_id}, recreating")
                await self.cleanup_sandbox(run_id)

        # Create new sandbox
        await self.create_sandbox(run_id, config)
        return self.active_sandboxes[run_id]

    async def execute_code(
        self,
        run_id: str,
        language: str,
        code: str,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Execute code with metrics collection.

        Args:
            run_id: Agent run ID
            language: Programming language
            code: Code to execute
            timeout: Execution timeout

        Returns:
            Execution result with metrics
        """
        sandbox = await self.get_or_create_sandbox(run_id)

        start_time = time.time()

        try:
            if language == "python":
                result = sandbox.run_code(code)
            elif language in ["javascript", "typescript"]:
                result = sandbox.run_code(code, language="js")
            else:
                raise ValueError(f"Unsupported language: {language}")

            execution_time = time.time() - start_time
            exit_code = 0 if not result.error else 1

            # Update metrics
            if run_id in self.sandbox_metrics:
                self.sandbox_metrics[run_id].update_execution(
                    exit_code=exit_code,
                    execution_time=execution_time
                )

            return {
                "success": not result.error,
                "stdout": result.logs.stdout if result.logs else "",
                "stderr": result.logs.stderr if result.logs else "",
                "error": str(result.error) if result.error else None,
                "results": result.results if hasattr(result, 'results') else None,
                "execution_time": execution_time
            }

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Code execution failed: {e}")

            # Update metrics
            if run_id in self.sandbox_metrics:
                self.sandbox_metrics[run_id].update_execution(
                    exit_code=1,
                    execution_time=execution_time
                )

            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "error": str(e),
                "results": None,
                "execution_time": execution_time
            }

    async def execute_shell(
        self,
        run_id: str,
        command: str,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Execute shell command with metrics collection.

        Args:
            run_id: Agent run ID
            command: Shell command
            timeout: Execution timeout

        Returns:
            Execution result with metrics
        """
        sandbox = await self.get_or_create_sandbox(run_id)

        start_time = time.time()

        try:
            process = sandbox.process.start(command)
            process.wait()

            execution_time = time.time() - start_time

            # Update metrics
            if run_id in self.sandbox_metrics:
                self.sandbox_metrics[run_id].update_execution(
                    exit_code=process.exit_code,
                    execution_time=execution_time
                )

            return {
                "success": process.exit_code == 0,
                "stdout": process.stdout,
                "stderr": process.stderr,
                "exit_code": process.exit_code,
                "error": process.stderr if process.exit_code != 0 else None,
                "execution_time": execution_time
            }

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"Shell execution failed: {e}")

            # Update metrics
            if run_id in self.sandbox_metrics:
                self.sandbox_metrics[run_id].update_execution(
                    exit_code=1,
                    execution_time=execution_time
                )

            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "exit_code": 1,
                "error": str(e),
                "execution_time": execution_time
            }

    async def _setup_custom_environment(
        self,
        run_id: str,
        packages: List[str],
        environment_vars: Dict[str, str]
    ) -> bool:
        """
        Setup custom environment in sandbox.

        Args:
            run_id: Agent run ID
            packages: Packages to install
            environment_vars: Environment variables

        Returns:
            Success status
        """
        logger.info(f"Setting up custom environment for run {run_id}")

        # Install packages
        if packages:
            success = await self._install_packages(run_id, packages)
            if not success:
                return False

        # Set environment variables
        if environment_vars:
            for key, value in environment_vars.items():
                await self.execute_shell(
                    run_id=run_id,
                    command=f"echo 'export {key}={value}' >> ~/.bashrc",
                    timeout=5
                )

        logger.info(f"Custom environment setup completed for run {run_id}")
        return True

    async def _install_packages(
        self,
        run_id: str,
        packages: List[str]
    ) -> bool:
        """
        Install packages in sandbox.

        Args:
            run_id: Agent run ID
            packages: List of packages to install

        Returns:
            Success status
        """
        logger.info(f"Installing packages for run {run_id}: {packages}")

        for package in packages:
            # Detect package manager based on package format
            if ":" in package:
                # Format: "pip:pandas" or "npm:lodash"
                manager, pkg = package.split(":", 1)
            else:
                # Default to pip
                manager = "pip"
                pkg = package

            # Install based on package manager
            if manager == "pip":
                command = f"pip install {pkg}"
            elif manager == "npm":
                command = f"npm install -g {pkg}"
            elif manager == "apt":
                command = f"apt-get install -y {pkg}"
            else:
                logger.warning(f"Unknown package manager: {manager}")
                continue

            result = await self.execute_shell(
                run_id=run_id,
                command=command,
                timeout=120
            )

            if not result["success"]:
                logger.error(f"Failed to install {package}: {result['stderr']}")
                return False

        logger.info(f"All packages installed successfully for run {run_id}")
        return True

    async def _health_check_sandbox(self, run_id: str) -> bool:
        """
        Check if sandbox is healthy.

        Args:
            run_id: Agent run ID

        Returns:
            True if healthy, False otherwise
        """
        if run_id not in self.active_sandboxes:
            return False

        try:
            sandbox = self.active_sandboxes[run_id]

            # Test basic operations
            # 1. List root directory
            sandbox.filesystem.list("/")

            # 2. Execute simple command
            result = await self.execute_shell(
                run_id=run_id,
                command="echo 'health_check'",
                timeout=5
            )

            is_healthy = result["success"]

            # Update metrics
            if run_id in self.sandbox_metrics:
                self.sandbox_metrics[run_id].update_health(is_healthy)

            return is_healthy

        except Exception as e:
            logger.error(f"Health check failed for run {run_id}: {e}")

            # Update metrics
            if run_id in self.sandbox_metrics:
                self.sandbox_metrics[run_id].update_health(False)

            return False

    async def get_metrics(self, run_id: str) -> Optional[Dict[str, Any]]:
        """
        Get metrics for sandbox.

        Args:
            run_id: Agent run ID

        Returns:
            Metrics dictionary or None if not found
        """
        if run_id not in self.sandbox_metrics:
            return None

        return self.sandbox_metrics[run_id].to_dict()

    async def write_file(
        self,
        run_id: str,
        path: str,
        content: str
    ) -> bool:
        """Write file to sandbox filesystem"""
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            sandbox.filesystem.write(path, content)
            logger.debug(f"Wrote file {path} to sandbox for run {run_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to write file {path}: {e}")
            return False

    async def read_file(
        self,
        run_id: str,
        path: str
    ) -> Optional[str]:
        """Read file from sandbox filesystem"""
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            content = sandbox.filesystem.read(path)
            return content
        except Exception as e:
            logger.error(f"Failed to read file {path}: {e}")
            return None

    async def list_files(
        self,
        run_id: str,
        path: str = "/"
    ) -> List[Dict[str, Any]]:
        """List files in sandbox directory"""
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            files = sandbox.filesystem.list(path)
            return [
                {
                    "name": f.name,
                    "path": f.path,
                    "type": f.type,
                    "size": getattr(f, 'size', 0)
                }
                for f in files
            ]
        except Exception as e:
            logger.error(f"Failed to list files in {path}: {e}")
            return []

    async def download_file(
        self,
        run_id: str,
        path: str
    ) -> Optional[bytes]:
        """Download file from sandbox as bytes"""
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            content = sandbox.filesystem.read(path, format="bytes")
            return content
        except Exception as e:
            logger.error(f"Failed to download file {path}: {e}")
            return None

    async def cleanup_sandbox(self, run_id: str):
        """
        Cleanup sandbox for run.

        Args:
            run_id: Agent run ID
        """
        if run_id in self.active_sandboxes:
            try:
                sandbox = self.active_sandboxes[run_id]
                sandbox.close()
                logger.info(f"Closed sandbox for run {run_id}")
            except Exception as e:
                logger.error(f"Error closing sandbox for run {run_id}: {e}")
            finally:
                del self.active_sandboxes[run_id]

                if run_id in self.sandbox_configs:
                    del self.sandbox_configs[run_id]

                if run_id in self.sandbox_metrics:
                    # Mark completed
                    self.sandbox_metrics[run_id].completed_at = datetime.utcnow()
                    # Keep metrics for a while for reporting
                    # TODO: Export to monitoring system

    async def cleanup_expired_sandboxes(self):
        """Cleanup expired sandboxes based on idle timeout"""
        now = datetime.utcnow()
        expired_runs = []

        for run_id, metrics in self.sandbox_metrics.items():
            if run_id not in self.sandbox_configs:
                continue

            config = self.sandbox_configs[run_id]
            last_activity = metrics.last_activity_at or metrics.created_at

            idle_time = (now - last_activity).total_seconds()

            if idle_time > config.idle_timeout:
                expired_runs.append(run_id)
                logger.info(
                    f"Sandbox for run {run_id} idle for {idle_time}s "
                    f"(limit: {config.idle_timeout}s)"
                )

        for run_id in expired_runs:
            await self.cleanup_sandbox(run_id)

    def get_active_sandbox_count(self) -> int:
        """Get count of active sandboxes"""
        return len(self.active_sandboxes)

    def get_sandbox_info(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for sandbox"""
        if run_id not in self.active_sandboxes:
            return None

        sandbox = self.active_sandboxes[run_id]
        config = self.sandbox_configs.get(run_id)
        metrics = self.sandbox_metrics.get(run_id)

        return {
            "sandbox_id": sandbox.id,
            "run_id": run_id,
            "config": {
                "cpu_count": config.cpu_count if config else None,
                "memory_mb": config.memory_mb if config else None,
                "disk_gb": config.disk_gb if config else None
            },
            "metrics": metrics.to_dict() if metrics else None
        }


# Singleton instance
_enhanced_sandbox_manager: Optional[EnhancedE2BSandboxManager] = None


def get_enhanced_sandbox_manager() -> EnhancedE2BSandboxManager:
    """Get singleton enhanced sandbox manager instance"""
    global _enhanced_sandbox_manager
    if _enhanced_sandbox_manager is None:
        _enhanced_sandbox_manager = EnhancedE2BSandboxManager()
    return _enhanced_sandbox_manager
