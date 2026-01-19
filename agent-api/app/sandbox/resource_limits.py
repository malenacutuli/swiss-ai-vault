"""
Comprehensive resource limits configuration for SwissBrain sandboxes.

Implements tier-based resource limits for:
- CPU (cores, shares, throttling)
- Memory (limits, soft limits, OOM handling)
- Disk I/O (read/write BPS, IOPS)
- Network bandwidth (egress/ingress)
- Storage (ephemeral, persistent, inodes)
- Process limits (pids, threads, open files)

Based on cgroups v2 and Kubernetes resource management.
"""
from dataclasses import dataclass, field
from typing import Dict, Optional, Any
from enum import Enum


class ResourceTier(str, Enum):
    """Resource tier levels for sandboxes."""
    FREE = "free"
    STANDARD = "standard"
    PRO = "pro"
    ENTERPRISE = "enterprise"


@dataclass
class CpuLimitConfig:
    """CPU limit configuration using cgroups v2."""
    request_millicores: int          # Kubernetes request (guaranteed)
    limit_millicores: int            # Kubernetes limit (hard cap)
    weight: int                      # cgroups v2 weight (1-10000)
    shares: int                      # cgroups v1 shares (2-262144)
    quota_microseconds: int          # CPU quota per period
    period_microseconds: int = 100000  # Period (default 100ms)
    burst_millicores: Optional[int] = None  # Burst allowance
    burst_duration_seconds: int = 30  # Burst duration

    def to_cgroup_config(self) -> Dict[str, str]:
        """Generate cgroup v2 configuration."""
        return {
            "cpu.max": f"{self.quota_microseconds} {self.period_microseconds}",
            "cpu.weight": str(self.weight),
        }

    def to_kubernetes_resources(self) -> Dict[str, str]:
        """Generate Kubernetes resource spec."""
        return {
            "requests": {"cpu": f"{self.request_millicores}m"},
            "limits": {"cpu": f"{self.limit_millicores}m"},
        }


@dataclass
class MemoryLimitConfig:
    """Memory limit configuration using cgroups v2."""
    request_bytes: int               # Kubernetes request
    limit_bytes: int                 # Hard limit (OOM killer)
    soft_limit_bytes: int            # High watermark (reclaim pressure)
    swap_bytes: int = 0              # Swap limit (0 = disabled)
    oom_score_adj: int = 500         # OOM priority (-1000 to 1000)
    oom_kill_group: bool = True      # Kill all processes on OOM

    def to_cgroup_config(self) -> Dict[str, str]:
        """Generate cgroup v2 configuration."""
        config = {
            "memory.max": str(self.limit_bytes),
            "memory.high": str(self.soft_limit_bytes),
            "memory.swap.max": str(self.swap_bytes),
        }
        if self.oom_kill_group:
            config["memory.oom.group"] = "1"
        return config

    def to_kubernetes_resources(self) -> Dict[str, str]:
        """Generate Kubernetes resource spec."""
        return {
            "requests": {"memory": self._format_bytes(self.request_bytes)},
            "limits": {"memory": self._format_bytes(self.limit_bytes)},
        }

    @staticmethod
    def _format_bytes(bytes_val: int) -> str:
        """Format bytes for Kubernetes (Mi, Gi)."""
        if bytes_val >= 1024 * 1024 * 1024:
            return f"{bytes_val // (1024 * 1024 * 1024)}Gi"
        return f"{bytes_val // (1024 * 1024)}Mi"


@dataclass
class IoLimitConfig:
    """Disk I/O limit configuration using cgroups v2."""
    read_bytes_per_second: int       # Read throughput limit
    write_bytes_per_second: int      # Write throughput limit
    read_iops_per_second: int        # Read IOPS limit
    write_iops_per_second: int       # Write IOPS limit
    weight: int = 100                # I/O weight (1-10000)

    def to_cgroup_config(self, device_major_minor: str = "8:0") -> Dict[str, str]:
        """Generate cgroup v2 configuration."""
        io_max = (
            f"{device_major_minor} "
            f"rbps={self.read_bytes_per_second} "
            f"wbps={self.write_bytes_per_second} "
            f"riops={self.read_iops_per_second} "
            f"wiops={self.write_iops_per_second}"
        )
        return {
            "io.max": io_max,
            "io.weight": f"default {self.weight}",
        }


@dataclass
class NetworkLimitConfig:
    """Network bandwidth limit configuration."""
    egress_bits_per_second: int      # Outbound bandwidth
    ingress_bits_per_second: int     # Inbound bandwidth
    egress_burst_bytes: int          # Egress burst buffer
    ingress_burst_bytes: int         # Ingress burst buffer
    max_connections: int             # Max concurrent connections
    max_packets_per_second: int      # Packet rate limit

    def to_kubernetes_annotations(self) -> Dict[str, str]:
        """Generate Kubernetes pod annotations for bandwidth."""
        return {
            "kubernetes.io/ingress-bandwidth": f"{self.ingress_bits_per_second // 1000000}M",
            "kubernetes.io/egress-bandwidth": f"{self.egress_bits_per_second // 1000000}M",
        }

    def to_cni_bandwidth_config(self) -> Dict[str, Any]:
        """Generate CNI bandwidth plugin configuration."""
        return {
            "type": "bandwidth",
            "capabilities": {"bandwidth": True},
            "ingressRate": self.ingress_bits_per_second // 8,  # Convert to bytes
            "ingressBurst": self.ingress_burst_bytes,
            "egressRate": self.egress_bits_per_second // 8,
            "egressBurst": self.egress_burst_bytes,
        }


@dataclass
class StorageLimitConfig:
    """Storage limit configuration."""
    ephemeral_storage_bytes: int     # Kubernetes ephemeral storage
    persistent_storage_bytes: int    # PVC size
    inode_limit: int                 # Max inodes
    tmpfs_size_bytes: int            # tmpfs size for /tmp

    def to_kubernetes_resources(self) -> Dict[str, str]:
        """Generate Kubernetes resource spec."""
        return {
            "requests": {"ephemeral-storage": self._format_bytes(self.ephemeral_storage_bytes // 2)},
            "limits": {"ephemeral-storage": self._format_bytes(self.ephemeral_storage_bytes)},
        }

    @staticmethod
    def _format_bytes(bytes_val: int) -> str:
        """Format bytes for Kubernetes."""
        if bytes_val >= 1024 * 1024 * 1024:
            return f"{bytes_val // (1024 * 1024 * 1024)}Gi"
        return f"{bytes_val // (1024 * 1024)}Mi"


@dataclass
class ProcessLimitConfig:
    """Process limit configuration using cgroups v2."""
    max_processes: int               # pids.max
    max_threads: int                 # Thread limit
    max_open_files: int              # nofile ulimit
    max_stack_size_kb: int           # Stack size ulimit
    max_memlock_kb: int              # Memory lock ulimit

    def to_cgroup_config(self) -> Dict[str, str]:
        """Generate cgroup v2 configuration."""
        return {
            "pids.max": str(self.max_processes),
        }

    def to_ulimits(self) -> Dict[str, Dict[str, int]]:
        """Generate ulimit configuration."""
        return {
            "nofile": {"soft": self.max_open_files, "hard": self.max_open_files},
            "nproc": {"soft": self.max_processes, "hard": self.max_processes},
            "stack": {"soft": self.max_stack_size_kb, "hard": self.max_stack_size_kb},
            "memlock": {"soft": self.max_memlock_kb, "hard": self.max_memlock_kb},
        }


@dataclass
class TierResourceLimits:
    """Complete resource limits for a tier."""
    tier: ResourceTier
    cpu: CpuLimitConfig
    memory: MemoryLimitConfig
    io: IoLimitConfig
    network: NetworkLimitConfig
    storage: StorageLimitConfig
    process: ProcessLimitConfig

    def to_kubernetes_pod_spec(self) -> Dict[str, Any]:
        """Generate complete Kubernetes pod spec resources."""
        resources = {}

        # Merge CPU resources
        cpu_res = self.cpu.to_kubernetes_resources()
        for key in ["requests", "limits"]:
            resources.setdefault(key, {}).update(cpu_res.get(key, {}))

        # Merge memory resources
        mem_res = self.memory.to_kubernetes_resources()
        for key in ["requests", "limits"]:
            resources.setdefault(key, {}).update(mem_res.get(key, {}))

        # Merge storage resources
        storage_res = self.storage.to_kubernetes_resources()
        for key in ["requests", "limits"]:
            resources.setdefault(key, {}).update(storage_res.get(key, {}))

        return resources

    def to_cgroup_configs(self, device: str = "8:0") -> Dict[str, str]:
        """Generate all cgroup v2 configurations."""
        config = {}
        config.update(self.cpu.to_cgroup_config())
        config.update(self.memory.to_cgroup_config())
        config.update(self.io.to_cgroup_config(device))
        config.update(self.process.to_cgroup_config())
        return config


# Tier configurations based on documentation
TIER_LIMITS: Dict[ResourceTier, TierResourceLimits] = {
    ResourceTier.FREE: TierResourceLimits(
        tier=ResourceTier.FREE,
        cpu=CpuLimitConfig(
            request_millicores=250,
            limit_millicores=500,
            weight=50,
            shares=512,
            quota_microseconds=50000,
        ),
        memory=MemoryLimitConfig(
            request_bytes=256 * 1024 * 1024,        # 256 MB
            limit_bytes=512 * 1024 * 1024,          # 512 MB
            soft_limit_bytes=384 * 1024 * 1024,     # 384 MB
            oom_score_adj=1000,
        ),
        io=IoLimitConfig(
            read_bytes_per_second=50 * 1024 * 1024,    # 50 MB/s
            write_bytes_per_second=25 * 1024 * 1024,   # 25 MB/s
            read_iops_per_second=500,
            write_iops_per_second=250,
            weight=50,
        ),
        network=NetworkLimitConfig(
            egress_bits_per_second=10 * 1000 * 1000,   # 10 Mbps
            ingress_bits_per_second=50 * 1000 * 1000,  # 50 Mbps
            egress_burst_bytes=32 * 1024,
            ingress_burst_bytes=64 * 1024,
            max_connections=100,
            max_packets_per_second=1000,
        ),
        storage=StorageLimitConfig(
            ephemeral_storage_bytes=1 * 1024 * 1024 * 1024,   # 1 GB
            persistent_storage_bytes=0,
            inode_limit=100000,
            tmpfs_size_bytes=100 * 1024 * 1024,   # 100 MB
        ),
        process=ProcessLimitConfig(
            max_processes=50,
            max_threads=100,
            max_open_files=1024,
            max_stack_size_kb=8192,
            max_memlock_kb=65536,
        ),
    ),

    ResourceTier.STANDARD: TierResourceLimits(
        tier=ResourceTier.STANDARD,
        cpu=CpuLimitConfig(
            request_millicores=500,
            limit_millicores=1000,
            weight=100,
            shares=1024,
            quota_microseconds=100000,
            burst_millicores=1500,
        ),
        memory=MemoryLimitConfig(
            request_bytes=512 * 1024 * 1024,          # 512 MB
            limit_bytes=2 * 1024 * 1024 * 1024,       # 2 GB
            soft_limit_bytes=int(1.5 * 1024 * 1024 * 1024),  # 1.5 GB
            oom_score_adj=500,
        ),
        io=IoLimitConfig(
            read_bytes_per_second=100 * 1024 * 1024,  # 100 MB/s
            write_bytes_per_second=50 * 1024 * 1024,  # 50 MB/s
            read_iops_per_second=1000,
            write_iops_per_second=500,
            weight=100,
        ),
        network=NetworkLimitConfig(
            egress_bits_per_second=50 * 1000 * 1000,   # 50 Mbps
            ingress_bits_per_second=100 * 1000 * 1000, # 100 Mbps
            egress_burst_bytes=64 * 1024,
            ingress_burst_bytes=128 * 1024,
            max_connections=500,
            max_packets_per_second=5000,
        ),
        storage=StorageLimitConfig(
            ephemeral_storage_bytes=5 * 1024 * 1024 * 1024,   # 5 GB
            persistent_storage_bytes=5 * 1024 * 1024 * 1024,  # 5 GB
            inode_limit=500000,
            tmpfs_size_bytes=500 * 1024 * 1024,   # 500 MB
        ),
        process=ProcessLimitConfig(
            max_processes=100,
            max_threads=500,
            max_open_files=4096,
            max_stack_size_kb=8192,
            max_memlock_kb=65536,
        ),
    ),

    ResourceTier.PRO: TierResourceLimits(
        tier=ResourceTier.PRO,
        cpu=CpuLimitConfig(
            request_millicores=1000,
            limit_millicores=2000,
            weight=200,
            shares=2048,
            quota_microseconds=200000,
            burst_millicores=3000,
            burst_duration_seconds=60,
        ),
        memory=MemoryLimitConfig(
            request_bytes=1 * 1024 * 1024 * 1024,     # 1 GB
            limit_bytes=4 * 1024 * 1024 * 1024,       # 4 GB
            soft_limit_bytes=3 * 1024 * 1024 * 1024,  # 3 GB
            oom_score_adj=250,
        ),
        io=IoLimitConfig(
            read_bytes_per_second=200 * 1024 * 1024,  # 200 MB/s
            write_bytes_per_second=100 * 1024 * 1024, # 100 MB/s
            read_iops_per_second=2000,
            write_iops_per_second=1000,
            weight=200,
        ),
        network=NetworkLimitConfig(
            egress_bits_per_second=100 * 1000 * 1000,  # 100 Mbps
            ingress_bits_per_second=500 * 1000 * 1000, # 500 Mbps
            egress_burst_bytes=128 * 1024,
            ingress_burst_bytes=256 * 1024,
            max_connections=1000,
            max_packets_per_second=10000,
        ),
        storage=StorageLimitConfig(
            ephemeral_storage_bytes=20 * 1024 * 1024 * 1024,  # 20 GB
            persistent_storage_bytes=50 * 1024 * 1024 * 1024, # 50 GB
            inode_limit=1000000,
            tmpfs_size_bytes=1 * 1024 * 1024 * 1024,  # 1 GB
        ),
        process=ProcessLimitConfig(
            max_processes=200,
            max_threads=1000,
            max_open_files=16384,
            max_stack_size_kb=16384,
            max_memlock_kb=131072,
        ),
    ),

    ResourceTier.ENTERPRISE: TierResourceLimits(
        tier=ResourceTier.ENTERPRISE,
        cpu=CpuLimitConfig(
            request_millicores=2000,
            limit_millicores=4000,
            weight=400,
            shares=4096,
            quota_microseconds=400000,
            burst_millicores=8000,
            burst_duration_seconds=120,
        ),
        memory=MemoryLimitConfig(
            request_bytes=2 * 1024 * 1024 * 1024,     # 2 GB
            limit_bytes=8 * 1024 * 1024 * 1024,       # 8 GB
            soft_limit_bytes=6 * 1024 * 1024 * 1024,  # 6 GB
            oom_score_adj=0,
            oom_kill_group=False,
        ),
        io=IoLimitConfig(
            read_bytes_per_second=500 * 1024 * 1024,   # 500 MB/s
            write_bytes_per_second=250 * 1024 * 1024,  # 250 MB/s
            read_iops_per_second=5000,
            write_iops_per_second=2500,
            weight=400,
        ),
        network=NetworkLimitConfig(
            egress_bits_per_second=1000 * 1000 * 1000,  # 1 Gbps
            ingress_bits_per_second=1000 * 1000 * 1000, # 1 Gbps
            egress_burst_bytes=1024 * 1024,
            ingress_burst_bytes=1024 * 1024,
            max_connections=5000,
            max_packets_per_second=50000,
        ),
        storage=StorageLimitConfig(
            ephemeral_storage_bytes=100 * 1024 * 1024 * 1024,  # 100 GB
            persistent_storage_bytes=500 * 1024 * 1024 * 1024, # 500 GB
            inode_limit=10000000,
            tmpfs_size_bytes=4 * 1024 * 1024 * 1024,  # 4 GB
        ),
        process=ProcessLimitConfig(
            max_processes=500,
            max_threads=5000,
            max_open_files=65536,
            max_stack_size_kb=32768,
            max_memlock_kb=262144,
        ),
    ),
}


def get_tier_limits(tier: str | ResourceTier) -> TierResourceLimits:
    """
    Get resource limits for a specific tier.

    Args:
        tier: Tier name or ResourceTier enum

    Returns:
        TierResourceLimits for the specified tier

    Raises:
        ValueError: If tier is not valid
    """
    if isinstance(tier, str):
        try:
            tier = ResourceTier(tier.lower())
        except ValueError:
            # Default to STANDARD if invalid
            tier = ResourceTier.STANDARD

    return TIER_LIMITS.get(tier, TIER_LIMITS[ResourceTier.STANDARD])


def get_user_tier(user_id: str) -> ResourceTier:
    """
    Get the resource tier for a user based on their subscription.

    This should be connected to the billing system.
    For now, returns STANDARD as default.

    Args:
        user_id: User identifier

    Returns:
        ResourceTier for the user
    """
    # TODO: Connect to billing/subscription system
    # For now, return STANDARD as default
    return ResourceTier.STANDARD


def generate_kubernetes_limit_range(namespace: str = "sandboxes") -> Dict[str, Any]:
    """
    Generate Kubernetes LimitRange for sandbox namespace.

    Returns a LimitRange that enforces default and max limits for containers.
    """
    standard = TIER_LIMITS[ResourceTier.STANDARD]
    enterprise = TIER_LIMITS[ResourceTier.ENTERPRISE]

    return {
        "apiVersion": "v1",
        "kind": "LimitRange",
        "metadata": {
            "name": "sandbox-limits",
            "namespace": namespace,
        },
        "spec": {
            "limits": [
                {
                    "type": "Container",
                    "default": {
                        "cpu": f"{standard.cpu.limit_millicores}m",
                        "memory": MemoryLimitConfig._format_bytes(standard.memory.limit_bytes),
                        "ephemeral-storage": StorageLimitConfig._format_bytes(standard.storage.ephemeral_storage_bytes),
                    },
                    "defaultRequest": {
                        "cpu": f"{standard.cpu.request_millicores}m",
                        "memory": MemoryLimitConfig._format_bytes(standard.memory.request_bytes),
                        "ephemeral-storage": StorageLimitConfig._format_bytes(standard.storage.ephemeral_storage_bytes // 2),
                    },
                    "max": {
                        "cpu": f"{enterprise.cpu.limit_millicores}m",
                        "memory": MemoryLimitConfig._format_bytes(enterprise.memory.limit_bytes),
                        "ephemeral-storage": StorageLimitConfig._format_bytes(enterprise.storage.ephemeral_storage_bytes),
                    },
                    "min": {
                        "cpu": "100m",
                        "memory": "128Mi",
                        "ephemeral-storage": "100Mi",
                    },
                },
                {
                    "type": "PersistentVolumeClaim",
                    "max": {
                        "storage": StorageLimitConfig._format_bytes(enterprise.storage.persistent_storage_bytes),
                    },
                    "min": {
                        "storage": "1Gi",
                    },
                },
            ],
        },
    }


def generate_kubernetes_resource_quota(
    namespace: str = "sandboxes",
    max_pods: int = 500,
    total_cpu: int = 100,
    total_memory_gb: int = 200,
    total_storage_tb: float = 1.0,
) -> Dict[str, Any]:
    """
    Generate Kubernetes ResourceQuota for sandbox namespace.

    Returns a ResourceQuota that limits total resources in the namespace.
    """
    return {
        "apiVersion": "v1",
        "kind": "ResourceQuota",
        "metadata": {
            "name": "sandbox-quota",
            "namespace": namespace,
        },
        "spec": {
            "hard": {
                # Compute resources
                "requests.cpu": str(total_cpu),
                "requests.memory": f"{total_memory_gb}Gi",
                "limits.cpu": str(total_cpu * 2),
                "limits.memory": f"{total_memory_gb * 2}Gi",
                # Storage resources
                "requests.storage": f"{int(total_storage_tb * 1024)}Gi",
                "requests.ephemeral-storage": f"{int(total_storage_tb * 512)}Gi",
                "limits.ephemeral-storage": f"{int(total_storage_tb * 1024)}Gi",
                # Object counts
                "pods": str(max_pods),
                "services": "100",
                "secrets": "500",
                "configmaps": "500",
                "persistentvolumeclaims": "200",
            },
        },
    }
