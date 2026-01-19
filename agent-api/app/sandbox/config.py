"""
Sandbox configuration for E2B with SwissBrain parity.

Complete configuration system matching SwissBrain's sandbox architecture including:
- Resource limits (CPU, memory, disk)
- Network configuration and domain filtering
- Storage quotas and limits
- Security policies
- Execution timeouts
"""
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime


@dataclass
class NetworkConfig:
    """
    Network configuration for sandbox.

    SwissBrain parity: Full network isolation with domain whitelisting,
    DNS configuration, and bandwidth limits.
    """

    # Enable/disable networking
    enable_networking: bool = True

    # DNS configuration
    dns_servers: List[str] = field(default_factory=lambda: ["8.8.8.8", "8.8.4.4"])

    # Allowed domains (whitelist)
    allowed_domains: List[str] = field(default_factory=lambda: [
        "*.github.com",
        "*.npmjs.com",
        "*.pypi.org",
        "api.openai.com",
        "api.anthropic.com",
        "*.googleapis.com",
        "*.githubusercontent.com"
    ])

    # Blocked domains (blacklist)
    blocked_domains: List[str] = field(default_factory=lambda: [
        "localhost",
        "127.0.0.1",
        "169.254.169.254",  # AWS metadata service
        "metadata.google.internal"  # GCP metadata
    ])

    # Rate limiting
    bandwidth_limit_mbps: int = 100
    connection_limit: int = 100


@dataclass
class StorageConfig:
    """
    Storage configuration for sandbox.

    SwissBrain parity: Per-directory quotas, inode limits,
    and cleanup policies.
    """

    # Total disk space
    total_disk_gb: int = 10

    # Per-directory limits
    home_limit_gb: int = 5
    tmp_limit_gb: int = 3
    var_limit_gb: int = 2

    # Inode limits
    max_inodes: int = 100000

    # Quota enforcement
    enforce_quotas: bool = True

    # Cleanup on exit
    cleanup_on_exit: bool = True

    # Persistent storage
    persistent_storage: bool = False
    snapshot_on_exit: bool = False


@dataclass
class SecurityConfig:
    """
    Security configuration for sandbox.

    SwissBrain parity: Multi-layer security with kernel isolation,
    seccomp filtering, and capability dropping.
    """

    # Kernel isolation
    kernel_isolation: bool = True
    seccomp_enabled: bool = True
    apparmor_enabled: bool = True

    # Privileged mode (dangerous - only for trusted code)
    privileged: bool = False
    no_docker: bool = True
    no_host_mount: bool = True

    # Capabilities
    readonly_root: bool = False  # Root filesystem writable for /tmp, /home
    no_raw_sockets: bool = True
    no_kernel_modules: bool = True

    # Resource limits enforcement
    cgroups_enforced: bool = True


@dataclass
class SandboxConfig:
    """
    Complete E2B sandbox configuration with SwissBrain parity.

    Provides comprehensive resource management, networking,
    security, and execution controls.
    """

    # Resource Limits
    cpu_count: int = 2                    # CPU cores
    memory_mb: int = 512                  # Memory in MB
    disk_gb: int = 10                     # Disk space in GB

    # Networking
    network: NetworkConfig = field(default_factory=NetworkConfig)

    # Storage
    storage: StorageConfig = field(default_factory=StorageConfig)

    # Security
    security: SecurityConfig = field(default_factory=SecurityConfig)

    # Environment
    environment_variables: Dict[str, str] = field(default_factory=dict)
    working_directory: str = "/home/user"

    # Additional features
    enable_x11: bool = False              # X11 support for GUI apps
    enable_docker: bool = False           # Docker in Docker

    # Timeouts
    startup_timeout: int = 30             # Startup timeout (seconds)
    execution_timeout: int = 300          # Execution timeout (seconds)
    idle_timeout: int = 3600              # Idle timeout (seconds)

    # Pre-installed packages (will be installed on first use)
    pre_install_packages: List[str] = field(default_factory=list)

    def to_e2b_params(self) -> Dict:
        """
        Convert to E2B API parameters.

        Returns:
            Dict of parameters for E2B Sandbox.create()
        """
        params = {
            "timeout": self.startup_timeout,
            "metadata": {
                "cpu_count": self.cpu_count,
                "memory_mb": self.memory_mb,
                "disk_gb": self.disk_gb
            }
        }

        if self.environment_variables:
            params["env_vars"] = self.environment_variables

        return params


@dataclass
class SandboxMetrics:
    """
    Metrics for sandbox execution with SwissBrain parity.

    Tracks resource usage, execution times, and system metrics
    for monitoring and billing.
    """

    # Identifiers
    sandbox_id: str
    run_id: str

    # CPU metrics
    cpu_usage_percent: float = 0.0        # CPU usage percentage
    cpu_time_seconds: float = 0.0         # Total CPU time

    # Memory metrics
    memory_used_mb: float = 0.0           # Memory used in MB
    memory_limit_mb: float = 512.0        # Memory limit in MB
    memory_peak_mb: float = 0.0           # Peak memory usage

    # Disk metrics
    disk_used_gb: float = 0.0             # Disk used in GB
    disk_limit_gb: float = 10.0           # Disk limit in GB

    # Network metrics
    network_in_bytes: int = 0             # Bytes received
    network_out_bytes: int = 0            # Bytes sent

    # Execution metrics
    execution_count: int = 0              # Number of executions
    execution_time_seconds: float = 0.0   # Total execution time
    last_exit_code: Optional[int] = None  # Last process exit code

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    last_activity_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Health status
    is_healthy: bool = True
    last_health_check: Optional[datetime] = None
    health_check_failures: int = 0

    def to_dict(self) -> Dict:
        """Convert metrics to dictionary for serialization"""
        return {
            "sandbox_id": self.sandbox_id,
            "run_id": self.run_id,
            "cpu": {
                "usage_percent": self.cpu_usage_percent,
                "time_seconds": self.cpu_time_seconds
            },
            "memory": {
                "used_mb": self.memory_used_mb,
                "limit_mb": self.memory_limit_mb,
                "peak_mb": self.memory_peak_mb
            },
            "disk": {
                "used_gb": self.disk_used_gb,
                "limit_gb": self.disk_limit_gb
            },
            "network": {
                "in_bytes": self.network_in_bytes,
                "out_bytes": self.network_out_bytes
            },
            "execution": {
                "count": self.execution_count,
                "time_seconds": self.execution_time_seconds,
                "last_exit_code": self.last_exit_code
            },
            "timestamps": {
                "created_at": self.created_at.isoformat() if self.created_at else None,
                "started_at": self.started_at.isoformat() if self.started_at else None,
                "last_activity_at": self.last_activity_at.isoformat() if self.last_activity_at else None,
                "completed_at": self.completed_at.isoformat() if self.completed_at else None
            },
            "health": {
                "is_healthy": self.is_healthy,
                "last_check": self.last_health_check.isoformat() if self.last_health_check else None,
                "failures": self.health_check_failures
            }
        }

    def update_execution(self, exit_code: int, execution_time: float):
        """Update metrics after execution"""
        self.execution_count += 1
        self.execution_time_seconds += execution_time
        self.last_exit_code = exit_code
        self.last_activity_at = datetime.utcnow()

    def update_health(self, is_healthy: bool):
        """Update health status"""
        self.is_healthy = is_healthy
        self.last_health_check = datetime.utcnow()
        if not is_healthy:
            self.health_check_failures += 1
        else:
            self.health_check_failures = 0


# Default configurations for different use cases
DEFAULT_CONFIG = SandboxConfig()

LIGHTWEIGHT_CONFIG = SandboxConfig(
    cpu_count=1,
    memory_mb=256,
    disk_gb=5,
    execution_timeout=60
)

HEAVY_COMPUTE_CONFIG = SandboxConfig(
    cpu_count=4,
    memory_mb=2048,
    disk_gb=20,
    execution_timeout=600
)

BROWSER_CONFIG = SandboxConfig(
    cpu_count=2,
    memory_mb=1024,
    disk_gb=10,
    enable_x11=True,
    execution_timeout=300
)
