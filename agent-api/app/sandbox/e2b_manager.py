"""
E2B Sandbox Manager
Enterprise-grade sandbox management for code execution
"""
import asyncio
import logging
from typing import Optional, Dict, Any, List
from datetime import datetime, timedelta
from e2b_code_interpreter import Sandbox

from app.config import get_settings

logger = logging.getLogger(__name__)


class E2BSandboxManager:
    """
    Manages E2B sandboxes for agent execution.

    Features:
    - Sandbox pooling for performance
    - Automatic cleanup and timeout handling
    - File persistence across operations
    - Code/shell execution
    """

    def __init__(self):
        self.settings = get_settings()
        self.active_sandboxes: Dict[str, Sandbox] = {}
        self.sandbox_metadata: Dict[str, Dict[str, Any]] = {}

    async def get_or_create_sandbox(
        self,
        run_id: str,
        timeout: int = 300
    ) -> Sandbox:
        """
        Get existing sandbox for run or create new one.

        Args:
            run_id: Agent run ID
            timeout: Sandbox timeout in seconds

        Returns:
            E2B Sandbox instance
        """
        # Check if sandbox already exists for this run
        if run_id in self.active_sandboxes:
            sandbox = self.active_sandboxes[run_id]

            # Check if sandbox is still alive
            try:
                # Ping sandbox to verify it's responsive
                sandbox.filesystem.list("/")
                logger.info(f"Reusing existing sandbox for run {run_id}")
                return sandbox
            except Exception as e:
                logger.warning(f"Existing sandbox dead for run {run_id}: {e}")
                # Remove dead sandbox
                del self.active_sandboxes[run_id]
                del self.sandbox_metadata[run_id]

        # Create new sandbox
        logger.info(f"Creating new E2B sandbox for run {run_id}")

        try:
            sandbox = Sandbox(
                api_key=self.settings.e2b_api_key,
                timeout=timeout,
                metadata={"run_id": run_id}
            )

            self.active_sandboxes[run_id] = sandbox
            self.sandbox_metadata[run_id] = {
                "created_at": datetime.utcnow(),
                "expires_at": datetime.utcnow() + timedelta(seconds=timeout),
                "run_id": run_id
            }

            logger.info(f"Created sandbox {sandbox.id} for run {run_id}")
            return sandbox

        except Exception as e:
            logger.error(f"Failed to create E2B sandbox: {e}")
            raise

    async def execute_code(
        self,
        run_id: str,
        language: str,
        code: str,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Execute code in sandbox.

        Args:
            run_id: Agent run ID
            language: Programming language (python, javascript)
            code: Code to execute
            timeout: Execution timeout in seconds

        Returns:
            Execution result with stdout, stderr, return value
        """
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            if language == "python":
                result = sandbox.run_code(code)
            elif language in ["javascript", "typescript"]:
                # E2B supports Node.js execution
                result = sandbox.run_code(code, language="js")
            else:
                raise ValueError(f"Unsupported language: {language}")

            return {
                "success": not result.error,
                "stdout": result.logs.stdout if result.logs else "",
                "stderr": result.logs.stderr if result.logs else "",
                "error": str(result.error) if result.error else None,
                "results": result.results if hasattr(result, 'results') else None
            }

        except Exception as e:
            logger.error(f"Code execution failed: {e}")
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "error": str(e),
                "results": None
            }

    async def execute_shell(
        self,
        run_id: str,
        command: str,
        timeout: int = 30
    ) -> Dict[str, Any]:
        """
        Execute shell command in sandbox.

        Args:
            run_id: Agent run ID
            command: Shell command to execute
            timeout: Execution timeout in seconds

        Returns:
            Execution result with stdout, stderr, exit code
        """
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            process = sandbox.process.start(command)
            process.wait()

            return {
                "success": process.exit_code == 0,
                "stdout": process.stdout,
                "stderr": process.stderr,
                "exit_code": process.exit_code,
                "error": process.stderr if process.exit_code != 0 else None
            }

        except Exception as e:
            logger.error(f"Shell execution failed: {e}")
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "exit_code": 1,
                "error": str(e)
            }

    async def write_file(
        self,
        run_id: str,
        path: str,
        content: str
    ) -> bool:
        """
        Write file to sandbox filesystem.

        Args:
            run_id: Agent run ID
            path: File path in sandbox
            content: File content

        Returns:
            Success status
        """
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
        """
        Read file from sandbox filesystem.

        Args:
            run_id: Agent run ID
            path: File path in sandbox

        Returns:
            File content or None if not found
        """
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
        """
        List files in sandbox directory.

        Args:
            run_id: Agent run ID
            path: Directory path

        Returns:
            List of file metadata
        """
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
        """
        Download file from sandbox as bytes.

        Args:
            run_id: Agent run ID
            path: File path in sandbox

        Returns:
            File bytes or None if not found
        """
        sandbox = await self.get_or_create_sandbox(run_id)

        try:
            # Read file as bytes
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
                if run_id in self.sandbox_metadata:
                    del self.sandbox_metadata[run_id]

    async def cleanup_expired_sandboxes(self):
        """
        Cleanup expired sandboxes (called periodically).
        """
        now = datetime.utcnow()
        expired_runs = []

        for run_id, metadata in self.sandbox_metadata.items():
            if metadata["expires_at"] < now:
                expired_runs.append(run_id)

        for run_id in expired_runs:
            logger.info(f"Cleaning up expired sandbox for run {run_id}")
            await self.cleanup_sandbox(run_id)

    def get_active_sandbox_count(self) -> int:
        """Get count of active sandboxes."""
        return len(self.active_sandboxes)

    def get_sandbox_info(self, run_id: str) -> Optional[Dict[str, Any]]:
        """Get metadata for sandbox."""
        if run_id in self.sandbox_metadata:
            metadata = self.sandbox_metadata[run_id].copy()
            metadata["sandbox_id"] = self.active_sandboxes[run_id].id if run_id in self.active_sandboxes else None
            return metadata
        return None


# Singleton instance
_sandbox_manager: Optional[E2BSandboxManager] = None


def get_sandbox_manager() -> E2BSandboxManager:
    """Get singleton sandbox manager instance."""
    global _sandbox_manager
    if _sandbox_manager is None:
        _sandbox_manager = E2BSandboxManager()
    return _sandbox_manager
