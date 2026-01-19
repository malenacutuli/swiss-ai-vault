"""
Dev Server Orchestrator for SwissBrain Sandboxes.

Manages development servers for various frameworks:
- Vite (React, Vue, Svelte)
- Next.js
- Nuxt.js
- Create React App
- Custom dev servers

Features:
- Automatic framework detection
- Port management
- HMR/WebSocket support
- Process lifecycle management
- Health monitoring

Based on DEV_SERVER_ARCHITECTURE.md specification.
"""
import asyncio
import os
import signal
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable, Set
from enum import Enum
from datetime import datetime
import logging
import json

logger = logging.getLogger(__name__)


class Framework(str, Enum):
    """Supported development frameworks."""
    VITE = "vite"
    NEXT = "next"
    NUXT = "nuxt"
    CRA = "cra"  # Create React App
    REMIX = "remix"
    ASTRO = "astro"
    SVELTE_KIT = "sveltekit"
    ANGULAR = "angular"
    VUE_CLI = "vue-cli"
    CUSTOM = "custom"


class ServerStatus(str, Enum):
    """Dev server status."""
    STOPPED = "stopped"
    STARTING = "starting"
    RUNNING = "running"
    ERROR = "error"
    STOPPING = "stopping"


@dataclass
class FrameworkConfig:
    """Configuration for a framework's dev server."""
    framework: Framework
    start_command: str
    default_port: int
    port_env_var: str
    ready_patterns: List[str]
    hmr_port: Optional[int] = None
    hmr_protocol: str = "ws"
    supports_https: bool = True
    env_overrides: Dict[str, str] = field(default_factory=dict)


# Framework configurations
FRAMEWORK_CONFIGS: Dict[Framework, FrameworkConfig] = {
    Framework.VITE: FrameworkConfig(
        framework=Framework.VITE,
        start_command="npm run dev",
        default_port=5173,
        port_env_var="PORT",
        ready_patterns=[
            r"Local:\s+https?://",
            r"ready in \d+",
            r"VITE.*ready",
        ],
        hmr_port=5173,
        hmr_protocol="ws",
        env_overrides={
            "VITE_HMR_HOST": "0.0.0.0",
        },
    ),
    Framework.NEXT: FrameworkConfig(
        framework=Framework.NEXT,
        start_command="npm run dev",
        default_port=3000,
        port_env_var="PORT",
        ready_patterns=[
            r"Ready on http",
            r"started server on",
            r"ready - started server",
        ],
        hmr_port=3000,
        hmr_protocol="ws",
    ),
    Framework.NUXT: FrameworkConfig(
        framework=Framework.NUXT,
        start_command="npm run dev",
        default_port=3000,
        port_env_var="PORT",
        ready_patterns=[
            r"Listening on",
            r"ready in",
            r"Nuxt.*ready",
        ],
        hmr_port=24678,
        hmr_protocol="ws",
    ),
    Framework.CRA: FrameworkConfig(
        framework=Framework.CRA,
        start_command="npm start",
        default_port=3000,
        port_env_var="PORT",
        ready_patterns=[
            r"Compiled successfully",
            r"Starting the development server",
            r"You can now view",
        ],
        hmr_port=3000,
        hmr_protocol="ws",
        env_overrides={
            "BROWSER": "none",
            "CI": "true",
        },
    ),
    Framework.REMIX: FrameworkConfig(
        framework=Framework.REMIX,
        start_command="npm run dev",
        default_port=3000,
        port_env_var="PORT",
        ready_patterns=[
            r"Remix.*running",
            r"started at",
        ],
        hmr_port=8002,
        hmr_protocol="ws",
    ),
    Framework.ASTRO: FrameworkConfig(
        framework=Framework.ASTRO,
        start_command="npm run dev",
        default_port=4321,
        port_env_var="PORT",
        ready_patterns=[
            r"Local:\s+https?://",
            r"astro.*ready",
        ],
        hmr_port=4321,
        hmr_protocol="ws",
    ),
    Framework.SVELTE_KIT: FrameworkConfig(
        framework=Framework.SVELTE_KIT,
        start_command="npm run dev",
        default_port=5173,
        port_env_var="PORT",
        ready_patterns=[
            r"Local:\s+https?://",
            r"SvelteKit.*ready",
        ],
        hmr_port=5173,
        hmr_protocol="ws",
    ),
    Framework.ANGULAR: FrameworkConfig(
        framework=Framework.ANGULAR,
        start_command="npm start",
        default_port=4200,
        port_env_var="PORT",
        ready_patterns=[
            r"Compiled successfully",
            r"Angular Live Development Server",
        ],
        hmr_port=4200,
        hmr_protocol="ws",
    ),
    Framework.VUE_CLI: FrameworkConfig(
        framework=Framework.VUE_CLI,
        start_command="npm run serve",
        default_port=8080,
        port_env_var="PORT",
        ready_patterns=[
            r"App running at",
            r"Compiled successfully",
        ],
        hmr_port=8080,
        hmr_protocol="ws",
    ),
}


@dataclass
class DevServerInstance:
    """Represents a running dev server instance."""
    server_id: str
    framework: Framework
    port: int
    hmr_port: Optional[int]
    process: Optional[asyncio.subprocess.Process] = None
    status: ServerStatus = ServerStatus.STOPPED
    url: Optional[str] = None
    started_at: Optional[datetime] = None
    logs: List[str] = field(default_factory=list)
    error: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "server_id": self.server_id,
            "framework": self.framework.value,
            "port": self.port,
            "hmr_port": self.hmr_port,
            "status": self.status.value,
            "url": self.url,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "logs": self.logs[-100:],  # Last 100 log lines
            "error": self.error,
        }


class FrameworkDetector:
    """Detects the framework used in a project."""

    FRAMEWORK_INDICATORS = {
        Framework.NEXT: [
            ("next.config.js", None),
            ("next.config.mjs", None),
            ("next.config.ts", None),
            ("package.json", '"next"'),
        ],
        Framework.NUXT: [
            ("nuxt.config.js", None),
            ("nuxt.config.ts", None),
            ("package.json", '"nuxt"'),
        ],
        Framework.VITE: [
            ("vite.config.js", None),
            ("vite.config.ts", None),
            ("vite.config.mjs", None),
            ("package.json", '"vite"'),
        ],
        Framework.REMIX: [
            ("remix.config.js", None),
            ("package.json", '"@remix-run"'),
        ],
        Framework.ASTRO: [
            ("astro.config.mjs", None),
            ("astro.config.ts", None),
            ("package.json", '"astro"'),
        ],
        Framework.SVELTE_KIT: [
            ("svelte.config.js", None),
            ("package.json", '"@sveltejs/kit"'),
        ],
        Framework.ANGULAR: [
            ("angular.json", None),
            ("package.json", '"@angular/core"'),
        ],
        Framework.VUE_CLI: [
            ("vue.config.js", None),
            ("package.json", '"@vue/cli-service"'),
        ],
        Framework.CRA: [
            ("package.json", '"react-scripts"'),
        ],
    }

    @classmethod
    def detect(cls, project_path: str) -> Framework:
        """
        Detect the framework used in a project.

        Args:
            project_path: Path to the project directory

        Returns:
            Detected framework or CUSTOM if unknown
        """
        for framework, indicators in cls.FRAMEWORK_INDICATORS.items():
            for filename, content_pattern in indicators:
                filepath = os.path.join(project_path, filename)
                if os.path.exists(filepath):
                    if content_pattern is None:
                        return framework
                    try:
                        with open(filepath, "r") as f:
                            content = f.read()
                            if content_pattern in content:
                                return framework
                    except Exception:
                        pass

        return Framework.CUSTOM

    @classmethod
    def get_dev_command(cls, project_path: str) -> Optional[str]:
        """Get the dev command from package.json."""
        package_json = os.path.join(project_path, "package.json")
        if os.path.exists(package_json):
            try:
                with open(package_json, "r") as f:
                    data = json.load(f)
                    scripts = data.get("scripts", {})
                    # Check common dev script names
                    for script_name in ["dev", "start", "serve"]:
                        if script_name in scripts:
                            return f"npm run {script_name}"
            except Exception:
                pass
        return None


class PortManager:
    """Manages port allocation for dev servers."""

    def __init__(
        self,
        base_port: int = 3000,
        max_port: int = 9999,
        reserved_ports: Optional[Set[int]] = None,
    ):
        self.base_port = base_port
        self.max_port = max_port
        self.reserved_ports = reserved_ports or {22, 80, 443, 5432, 6379, 8080}
        self.allocated_ports: Set[int] = set()

    def allocate(self, preferred_port: Optional[int] = None) -> int:
        """
        Allocate an available port.

        Args:
            preferred_port: Preferred port to allocate if available

        Returns:
            Allocated port number
        """
        if preferred_port:
            if self._is_available(preferred_port):
                self.allocated_ports.add(preferred_port)
                return preferred_port

        # Find next available port
        for port in range(self.base_port, self.max_port):
            if self._is_available(port):
                self.allocated_ports.add(port)
                return port

        raise RuntimeError("No available ports")

    def release(self, port: int) -> None:
        """Release an allocated port."""
        self.allocated_ports.discard(port)

    def _is_available(self, port: int) -> bool:
        """Check if a port is available."""
        if port in self.reserved_ports:
            return False
        if port in self.allocated_ports:
            return False
        # TODO: Check if port is actually in use via socket
        return True


class DevServerOrchestrator:
    """
    Orchestrates development servers in sandbox environments.

    Handles:
    - Starting/stopping servers
    - Port management
    - Health monitoring
    - Log collection
    """

    def __init__(
        self,
        port_manager: Optional[PortManager] = None,
        max_servers: int = 5,
    ):
        self.port_manager = port_manager or PortManager()
        self.max_servers = max_servers
        self.servers: Dict[str, DevServerInstance] = {}
        self._health_check_task: Optional[asyncio.Task] = None

    async def start_server(
        self,
        server_id: str,
        project_path: str,
        framework: Optional[Framework] = None,
        port: Optional[int] = None,
        custom_command: Optional[str] = None,
        env: Optional[Dict[str, str]] = None,
        on_ready: Optional[Callable[[str], None]] = None,
        on_log: Optional[Callable[[str], None]] = None,
    ) -> DevServerInstance:
        """
        Start a development server.

        Args:
            server_id: Unique identifier for this server
            project_path: Path to the project
            framework: Framework to use (auto-detected if None)
            port: Port to use (auto-allocated if None)
            custom_command: Custom start command
            env: Additional environment variables
            on_ready: Callback when server is ready
            on_log: Callback for log output

        Returns:
            DevServerInstance with server details
        """
        # Check limits
        if len(self.servers) >= self.max_servers:
            raise RuntimeError(f"Maximum {self.max_servers} servers allowed")

        # Detect framework if not specified
        if framework is None:
            framework = FrameworkDetector.detect(project_path)
            logger.info(f"Detected framework: {framework.value}")

        # Get framework config
        if framework == Framework.CUSTOM:
            config = FrameworkConfig(
                framework=Framework.CUSTOM,
                start_command=custom_command or "npm run dev",
                default_port=3000,
                port_env_var="PORT",
                ready_patterns=[r"Listening", r"ready", r"started"],
            )
        else:
            config = FRAMEWORK_CONFIGS.get(framework, FRAMEWORK_CONFIGS[Framework.VITE])

        # Allocate port
        allocated_port = self.port_manager.allocate(port or config.default_port)

        # Create server instance
        server = DevServerInstance(
            server_id=server_id,
            framework=framework,
            port=allocated_port,
            hmr_port=config.hmr_port or allocated_port,
            status=ServerStatus.STARTING,
        )
        self.servers[server_id] = server

        try:
            # Build environment
            server_env = os.environ.copy()
            server_env[config.port_env_var] = str(allocated_port)
            server_env["HOST"] = "0.0.0.0"
            server_env.update(config.env_overrides)
            if env:
                server_env.update(env)

            # Start the process
            command = custom_command or config.start_command

            # Install dependencies first if needed
            if not os.path.exists(os.path.join(project_path, "node_modules")):
                logger.info("Installing dependencies...")
                install_process = await asyncio.create_subprocess_exec(
                    "npm", "install",
                    cwd=project_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                await install_process.communicate()

            # Start dev server
            server.process = await asyncio.create_subprocess_shell(
                command,
                cwd=project_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
                env=server_env,
                preexec_fn=os.setsid,  # Create new process group
            )

            # Monitor output for ready signal
            ready_event = asyncio.Event()

            async def monitor_output():
                while server.process and server.process.stdout:
                    line = await server.process.stdout.readline()
                    if not line:
                        break

                    line_str = line.decode().strip()
                    server.logs.append(line_str)

                    if on_log:
                        on_log(line_str)

                    # Check for ready patterns
                    for pattern in config.ready_patterns:
                        if re.search(pattern, line_str, re.IGNORECASE):
                            ready_event.set()
                            server.status = ServerStatus.RUNNING
                            server.started_at = datetime.utcnow()
                            server.url = f"http://localhost:{allocated_port}"
                            if on_ready:
                                on_ready(server.url)
                            break

            # Start monitoring task
            asyncio.create_task(monitor_output())

            # Wait for ready signal with timeout
            try:
                await asyncio.wait_for(ready_event.wait(), timeout=60.0)
            except asyncio.TimeoutError:
                server.status = ServerStatus.ERROR
                server.error = "Server startup timeout"
                logger.error(f"Server {server_id} failed to start within timeout")

        except Exception as e:
            server.status = ServerStatus.ERROR
            server.error = str(e)
            self.port_manager.release(allocated_port)
            logger.exception(f"Failed to start server {server_id}")

        return server

    async def stop_server(self, server_id: str, timeout: float = 10.0) -> bool:
        """
        Stop a development server.

        Args:
            server_id: Server identifier
            timeout: Graceful shutdown timeout

        Returns:
            True if stopped successfully
        """
        server = self.servers.get(server_id)
        if not server:
            return False

        server.status = ServerStatus.STOPPING

        try:
            if server.process:
                # Send SIGTERM to process group
                try:
                    os.killpg(os.getpgid(server.process.pid), signal.SIGTERM)
                except ProcessLookupError:
                    pass

                # Wait for graceful shutdown
                try:
                    await asyncio.wait_for(server.process.wait(), timeout=timeout)
                except asyncio.TimeoutError:
                    # Force kill
                    try:
                        os.killpg(os.getpgid(server.process.pid), signal.SIGKILL)
                    except ProcessLookupError:
                        pass

            # Release port
            self.port_manager.release(server.port)

            server.status = ServerStatus.STOPPED
            del self.servers[server_id]
            return True

        except Exception as e:
            logger.exception(f"Error stopping server {server_id}")
            server.error = str(e)
            return False

    async def stop_all(self) -> None:
        """Stop all running servers."""
        tasks = [
            self.stop_server(server_id)
            for server_id in list(self.servers.keys())
        ]
        await asyncio.gather(*tasks, return_exceptions=True)

    def get_server(self, server_id: str) -> Optional[DevServerInstance]:
        """Get a server by ID."""
        return self.servers.get(server_id)

    def get_all_servers(self) -> List[DevServerInstance]:
        """Get all servers."""
        return list(self.servers.values())

    async def restart_server(self, server_id: str) -> Optional[DevServerInstance]:
        """Restart a server."""
        server = self.servers.get(server_id)
        if not server:
            return None

        # Store config
        framework = server.framework
        port = server.port

        # Stop and start
        await self.stop_server(server_id)
        # Note: Would need to store project_path to restart properly
        return None

    async def health_check(self, server_id: str) -> bool:
        """Check if a server is healthy."""
        server = self.servers.get(server_id)
        if not server or not server.process:
            return False

        # Check if process is still running
        if server.process.returncode is not None:
            server.status = ServerStatus.ERROR
            server.error = f"Process exited with code {server.process.returncode}"
            return False

        return server.status == ServerStatus.RUNNING


# Global orchestrator instance
_orchestrator: Optional[DevServerOrchestrator] = None


def get_orchestrator() -> DevServerOrchestrator:
    """Get the global orchestrator instance."""
    global _orchestrator
    if _orchestrator is None:
        _orchestrator = DevServerOrchestrator()
    return _orchestrator


# Convenience functions
async def start_dev_server(
    project_path: str,
    server_id: Optional[str] = None,
    **kwargs: Any,
) -> DevServerInstance:
    """Start a dev server for a project."""
    orchestrator = get_orchestrator()
    return await orchestrator.start_server(
        server_id=server_id or f"server-{len(orchestrator.servers)}",
        project_path=project_path,
        **kwargs,
    )


async def stop_dev_server(server_id: str) -> bool:
    """Stop a dev server."""
    orchestrator = get_orchestrator()
    return await orchestrator.stop_server(server_id)


def detect_framework(project_path: str) -> Framework:
    """Detect the framework of a project."""
    return FrameworkDetector.detect(project_path)
