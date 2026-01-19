"""Sandbox management for agent execution."""

from app.sandbox.e2b_manager import E2BSandboxManager, get_sandbox_manager
from app.sandbox.manager_enhanced import EnhancedE2BSandboxManager, get_enhanced_sandbox_manager
from app.sandbox.config import (
    SandboxConfig,
    SandboxMetrics,
    NetworkConfig,
    StorageConfig,
    SecurityConfig,
    DEFAULT_CONFIG,
    LIGHTWEIGHT_CONFIG,
    HEAVY_COMPUTE_CONFIG,
    BROWSER_CONFIG
)
from app.sandbox.resource_limits import (
    ResourceTier,
    TierResourceLimits,
    get_tier_limits,
    generate_kubernetes_limit_range,
    generate_kubernetes_resource_quota,
    TIER_LIMITS,
)
from app.sandbox.dependency_merger import (
    DependencyMerger,
    TemplateMerger,
    merge_package_jsons,
    resolve_version_conflict,
    ConflictResolution,
)
from app.sandbox.deployment import (
    DeploymentTarget,
    DeploymentService,
    one_click_deploy,
)
from app.sandbox.dev_server import (
    DevServerOrchestrator,
    Framework,
    start_dev_server,
    stop_dev_server,
    detect_framework,
)

__all__ = [
    # Original manager (backward compatibility)
    "E2BSandboxManager",
    "get_sandbox_manager",
    # Enhanced manager (SwissBrain standard)
    "EnhancedE2BSandboxManager",
    "get_enhanced_sandbox_manager",
    # Configuration classes
    "SandboxConfig",
    "SandboxMetrics",
    "NetworkConfig",
    "StorageConfig",
    "SecurityConfig",
    # Preset configurations
    "DEFAULT_CONFIG",
    "LIGHTWEIGHT_CONFIG",
    "HEAVY_COMPUTE_CONFIG",
    "BROWSER_CONFIG",
    # Resource limits (Kubernetes/cgroups)
    "ResourceTier",
    "TierResourceLimits",
    "get_tier_limits",
    "generate_kubernetes_limit_range",
    "generate_kubernetes_resource_quota",
    "TIER_LIMITS",
    # Dependency merging
    "DependencyMerger",
    "TemplateMerger",
    "merge_package_jsons",
    "resolve_version_conflict",
    "ConflictResolution",
    # Deployment automation
    "DeploymentTarget",
    "DeploymentService",
    "one_click_deploy",
    # Dev server orchestration
    "DevServerOrchestrator",
    "Framework",
    "start_dev_server",
    "stop_dev_server",
    "detect_framework",
]
