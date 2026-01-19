"""E2B sandbox executor for reliable tool execution"""
import logging
from typing import Dict, Any, Optional
from app.sandbox import get_sandbox_manager

logger = logging.getLogger(__name__)


class E2BSandboxExecutor:
    """
    Execute tools in E2B sandboxes with enterprise-grade pooling.

    Architecture:
    - Orchestration: Swiss K8s (data residency, control)
    - Tool execution: E2B sandboxes (reliable networking, proven infrastructure)
    - Sandbox pooling: Reuse sandboxes per run_id for performance
    - File persistence: Files persist across operations within a run
    """

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.sandbox_manager = get_sandbox_manager()
        logger.info("E2B sandbox executor initialized with pooling")

    async def execute_shell(
        self,
        command: str,
        run_id: str,
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Execute shell command in E2B sandbox with pooling.

        Args:
            command: Shell command to execute
            run_id: Agent run ID (used for sandbox pooling)
            timeout: Execution timeout in seconds

        Returns:
            Dict with stdout, stderr, exit_code
        """
        logger.info(f"Executing shell command in E2B for run {run_id}: {command[:100]}...")

        try:
            result = await self.sandbox_manager.execute_shell(
                run_id=run_id,
                command=command,
                timeout=timeout
            )

            logger.info(f"Shell command completed with exit code {result.get('exit_code', 1)}")
            return result

        except Exception as e:
            logger.error(f"E2B shell execution failed: {e}")
            return {
                "stdout": "",
                "stderr": str(e),
                "exit_code": 1,
                "success": False
            }

    async def execute_code(
        self,
        code: str,
        run_id: str,
        language: str = "python",
        timeout: int = 300
    ) -> Dict[str, Any]:
        """
        Execute code in E2B sandbox with pooling.

        Args:
            code: Code to execute
            run_id: Agent run ID (used for sandbox pooling)
            language: Programming language (python, javascript, typescript)
            timeout: Execution timeout in seconds

        Returns:
            Dict with success, stdout, stderr, results
        """
        logger.info(f"Executing {language} code in E2B for run {run_id}: {len(code)} chars")

        try:
            result = await self.sandbox_manager.execute_code(
                run_id=run_id,
                language=language,
                code=code,
                timeout=timeout
            )

            logger.info(f"Code execution completed: success={result.get('success', False)}")
            return result

        except Exception as e:
            logger.error(f"E2B code execution failed: {e}")
            return {
                "success": False,
                "stdout": "",
                "stderr": str(e),
                "error": str(e),
                "results": None
            }

    async def read_file(self, run_id: str, filepath: str) -> Optional[str]:
        """
        Read file from E2B sandbox filesystem with pooling.

        Args:
            run_id: Agent run ID (used for sandbox pooling)
            filepath: Path to file in sandbox

        Returns:
            File content or None if not found
        """
        logger.info(f"Reading file from E2B for run {run_id}: {filepath}")

        try:
            content = await self.sandbox_manager.read_file(
                run_id=run_id,
                path=filepath
            )
            return content

        except Exception as e:
            logger.error(f"E2B file read failed: {e}")
            return None

    async def write_file(self, run_id: str, filepath: str, content: str) -> bool:
        """
        Write file to E2B sandbox filesystem with pooling.

        Args:
            run_id: Agent run ID (used for sandbox pooling)
            filepath: Path to file in sandbox
            content: File content to write

        Returns:
            True if successful, False otherwise
        """
        logger.info(f"Writing file to E2B for run {run_id}: {filepath}")

        try:
            success = await self.sandbox_manager.write_file(
                run_id=run_id,
                path=filepath,
                content=content
            )
            return success

        except Exception as e:
            logger.error(f"E2B file write failed: {e}")
            return False

    async def list_files(self, run_id: str, dirpath: str = "/") -> list:
        """
        List files in E2B sandbox directory with pooling.

        Args:
            run_id: Agent run ID (used for sandbox pooling)
            dirpath: Directory path to list (default: root)

        Returns:
            List of file metadata dicts
        """
        logger.info(f"Listing files in E2B for run {run_id}: {dirpath}")

        try:
            files = await self.sandbox_manager.list_files(
                run_id=run_id,
                path=dirpath
            )
            return files

        except Exception as e:
            logger.error(f"E2B list files failed: {e}")
            return []
