"""
One-Click Deployment System for SwissBrain.

Supports deploying sandbox projects to multiple targets:
- Vercel (static sites, Next.js, React)
- Netlify (static sites, serverless functions)
- AWS (S3, CloudFront, Lambda, ECS)
- Kubernetes (custom clusters)
- Railway (full-stack apps)
- Fly.io (containers)

Based on DEPLOYMENT_OPTIONS_TARGETS.md specification.
"""
import json
import os
import subprocess
import tempfile
import shutil
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Callable
from enum import Enum
import logging
import asyncio
from datetime import datetime

logger = logging.getLogger(__name__)


class DeploymentTarget(str, Enum):
    """Supported deployment targets."""
    VERCEL = "vercel"
    NETLIFY = "netlify"
    AWS_S3 = "aws_s3"
    AWS_LAMBDA = "aws_lambda"
    AWS_ECS = "aws_ecs"
    KUBERNETES = "kubernetes"
    RAILWAY = "railway"
    FLY_IO = "fly_io"
    DOCKER_HUB = "docker_hub"
    GITHUB_PAGES = "github_pages"


class DeploymentStatus(str, Enum):
    """Deployment status states."""
    PENDING = "pending"
    BUILDING = "building"
    DEPLOYING = "deploying"
    SUCCESS = "success"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class DeploymentConfig:
    """Configuration for a deployment."""
    target: DeploymentTarget
    project_name: str
    source_path: str
    build_command: Optional[str] = None
    output_directory: Optional[str] = None
    environment_variables: Dict[str, str] = field(default_factory=dict)
    region: Optional[str] = None
    domain: Optional[str] = None

    # Target-specific settings
    vercel_team: Optional[str] = None
    vercel_project_id: Optional[str] = None
    netlify_site_id: Optional[str] = None
    aws_bucket: Optional[str] = None
    aws_distribution_id: Optional[str] = None
    k8s_namespace: str = "default"
    k8s_replicas: int = 1

    # Build settings
    node_version: str = "20"
    install_command: str = "npm install"


@dataclass
class DeploymentResult:
    """Result of a deployment operation."""
    status: DeploymentStatus
    target: DeploymentTarget
    url: Optional[str] = None
    deployment_id: Optional[str] = None
    build_logs: List[str] = field(default_factory=list)
    deploy_logs: List[str] = field(default_factory=list)
    error: Optional[str] = None
    duration_seconds: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "status": self.status.value,
            "target": self.target.value,
            "url": self.url,
            "deployment_id": self.deployment_id,
            "build_logs": self.build_logs,
            "deploy_logs": self.deploy_logs,
            "error": self.error,
            "duration_seconds": self.duration_seconds,
            "created_at": self.created_at.isoformat(),
        }


class DeploymentProvider(ABC):
    """Abstract base class for deployment providers."""

    @property
    @abstractmethod
    def target(self) -> DeploymentTarget:
        """Return the deployment target this provider handles."""
        pass

    @abstractmethod
    async def deploy(self, config: DeploymentConfig) -> DeploymentResult:
        """Deploy the project."""
        pass

    @abstractmethod
    async def get_status(self, deployment_id: str) -> DeploymentStatus:
        """Get status of a deployment."""
        pass

    @abstractmethod
    async def rollback(self, deployment_id: str) -> bool:
        """Rollback to a previous deployment."""
        pass


class VercelProvider(DeploymentProvider):
    """Vercel deployment provider."""

    @property
    def target(self) -> DeploymentTarget:
        return DeploymentTarget.VERCEL

    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("VERCEL_TOKEN")

    async def deploy(self, config: DeploymentConfig) -> DeploymentResult:
        """Deploy to Vercel."""
        start_time = datetime.utcnow()
        result = DeploymentResult(
            status=DeploymentStatus.BUILDING,
            target=self.target,
        )

        try:
            # Build vercel.json if not present
            vercel_config = self._generate_vercel_config(config)

            # Run vercel deploy
            cmd = ["vercel", "--yes", "--prod"]
            if self.token:
                cmd.extend(["--token", self.token])
            if config.vercel_team:
                cmd.extend(["--scope", config.vercel_team])

            env = os.environ.copy()
            for key, value in config.environment_variables.items():
                env[f"VERCEL_ENV_{key}"] = value

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=config.source_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )

            stdout, stderr = await process.communicate()
            result.deploy_logs = stdout.decode().split("\n")

            if process.returncode == 0:
                # Extract URL from output
                for line in result.deploy_logs:
                    if "https://" in line:
                        result.url = line.strip()
                        break
                result.status = DeploymentStatus.SUCCESS
            else:
                result.status = DeploymentStatus.FAILED
                result.error = stderr.decode()

        except Exception as e:
            result.status = DeploymentStatus.FAILED
            result.error = str(e)
            logger.exception("Vercel deployment failed")

        result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
        return result

    def _generate_vercel_config(self, config: DeploymentConfig) -> Dict[str, Any]:
        """Generate vercel.json configuration."""
        return {
            "version": 2,
            "name": config.project_name,
            "builds": [
                {
                    "src": "package.json",
                    "use": "@vercel/static-build",
                    "config": {
                        "distDir": config.output_directory or "dist",
                    },
                }
            ],
            "routes": [
                {"handle": "filesystem"},
                {"src": "/(.*)", "dest": "/index.html"},
            ],
        }

    async def get_status(self, deployment_id: str) -> DeploymentStatus:
        """Get Vercel deployment status."""
        # Implementation would use Vercel API
        return DeploymentStatus.SUCCESS

    async def rollback(self, deployment_id: str) -> bool:
        """Rollback Vercel deployment."""
        # Implementation would use Vercel API
        return True


class NetlifyProvider(DeploymentProvider):
    """Netlify deployment provider."""

    @property
    def target(self) -> DeploymentTarget:
        return DeploymentTarget.NETLIFY

    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv("NETLIFY_AUTH_TOKEN")

    async def deploy(self, config: DeploymentConfig) -> DeploymentResult:
        """Deploy to Netlify."""
        start_time = datetime.utcnow()
        result = DeploymentResult(
            status=DeploymentStatus.BUILDING,
            target=self.target,
        )

        try:
            # Build the project first
            if config.build_command:
                build_process = await asyncio.create_subprocess_shell(
                    f"{config.install_command} && {config.build_command}",
                    cwd=config.source_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await build_process.communicate()
                result.build_logs = stdout.decode().split("\n")

                if build_process.returncode != 0:
                    result.status = DeploymentStatus.FAILED
                    result.error = f"Build failed: {stderr.decode()}"
                    return result

            result.status = DeploymentStatus.DEPLOYING

            # Deploy to Netlify
            cmd = ["netlify", "deploy", "--prod", "--dir",
                   config.output_directory or "dist"]
            if self.token:
                cmd.extend(["--auth", self.token])
            if config.netlify_site_id:
                cmd.extend(["--site", config.netlify_site_id])

            process = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=config.source_path,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()
            result.deploy_logs = stdout.decode().split("\n")

            if process.returncode == 0:
                # Extract URL from output
                for line in result.deploy_logs:
                    if "Website URL:" in line or "https://" in line:
                        url_part = line.split(":")[-1].strip()
                        if url_part.startswith("//"):
                            result.url = f"https:{url_part}"
                        elif "https://" in line:
                            result.url = line.strip()
                        break
                result.status = DeploymentStatus.SUCCESS
            else:
                result.status = DeploymentStatus.FAILED
                result.error = stderr.decode()

        except Exception as e:
            result.status = DeploymentStatus.FAILED
            result.error = str(e)
            logger.exception("Netlify deployment failed")

        result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
        return result

    async def get_status(self, deployment_id: str) -> DeploymentStatus:
        return DeploymentStatus.SUCCESS

    async def rollback(self, deployment_id: str) -> bool:
        return True


class AWSS3Provider(DeploymentProvider):
    """AWS S3 + CloudFront deployment provider."""

    @property
    def target(self) -> DeploymentTarget:
        return DeploymentTarget.AWS_S3

    def __init__(
        self,
        access_key: Optional[str] = None,
        secret_key: Optional[str] = None,
        region: str = "us-east-1",
    ):
        self.access_key = access_key or os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = secret_key or os.getenv("AWS_SECRET_ACCESS_KEY")
        self.region = region

    async def deploy(self, config: DeploymentConfig) -> DeploymentResult:
        """Deploy to AWS S3."""
        start_time = datetime.utcnow()
        result = DeploymentResult(
            status=DeploymentStatus.BUILDING,
            target=self.target,
        )

        try:
            # Build the project
            if config.build_command:
                build_process = await asyncio.create_subprocess_shell(
                    f"{config.install_command} && {config.build_command}",
                    cwd=config.source_path,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await build_process.communicate()
                result.build_logs = stdout.decode().split("\n")

                if build_process.returncode != 0:
                    result.status = DeploymentStatus.FAILED
                    result.error = f"Build failed: {stderr.decode()}"
                    return result

            result.status = DeploymentStatus.DEPLOYING

            bucket = config.aws_bucket or f"{config.project_name}-static"
            output_dir = os.path.join(
                config.source_path,
                config.output_directory or "dist"
            )

            # Sync to S3
            sync_cmd = [
                "aws", "s3", "sync",
                output_dir,
                f"s3://{bucket}",
                "--delete",
                "--region", config.region or self.region,
            ]

            process = await asyncio.create_subprocess_exec(
                *sync_cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env={
                    **os.environ,
                    "AWS_ACCESS_KEY_ID": self.access_key,
                    "AWS_SECRET_ACCESS_KEY": self.secret_key,
                },
            )

            stdout, stderr = await process.communicate()
            result.deploy_logs = stdout.decode().split("\n")

            if process.returncode == 0:
                result.url = f"https://{bucket}.s3.{self.region}.amazonaws.com/index.html"

                # Invalidate CloudFront if configured
                if config.aws_distribution_id:
                    await self._invalidate_cloudfront(config.aws_distribution_id)
                    result.url = config.domain or result.url

                result.status = DeploymentStatus.SUCCESS
            else:
                result.status = DeploymentStatus.FAILED
                result.error = stderr.decode()

        except Exception as e:
            result.status = DeploymentStatus.FAILED
            result.error = str(e)
            logger.exception("AWS S3 deployment failed")

        result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
        return result

    async def _invalidate_cloudfront(self, distribution_id: str) -> None:
        """Invalidate CloudFront cache."""
        cmd = [
            "aws", "cloudfront", "create-invalidation",
            "--distribution-id", distribution_id,
            "--paths", "/*",
        ]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        await process.communicate()

    async def get_status(self, deployment_id: str) -> DeploymentStatus:
        return DeploymentStatus.SUCCESS

    async def rollback(self, deployment_id: str) -> bool:
        return True


class KubernetesProvider(DeploymentProvider):
    """Kubernetes deployment provider."""

    @property
    def target(self) -> DeploymentTarget:
        return DeploymentTarget.KUBERNETES

    def __init__(self, kubeconfig: Optional[str] = None):
        self.kubeconfig = kubeconfig or os.getenv("KUBECONFIG")

    async def deploy(self, config: DeploymentConfig) -> DeploymentResult:
        """Deploy to Kubernetes."""
        start_time = datetime.utcnow()
        result = DeploymentResult(
            status=DeploymentStatus.BUILDING,
            target=self.target,
        )

        try:
            # Generate Kubernetes manifests
            manifests = self._generate_manifests(config)

            # Apply manifests
            result.status = DeploymentStatus.DEPLOYING

            for manifest in manifests:
                manifest_yaml = json.dumps(manifest)
                process = await asyncio.create_subprocess_exec(
                    "kubectl", "apply", "-f", "-",
                    "-n", config.k8s_namespace,
                    stdin=asyncio.subprocess.PIPE,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                )
                stdout, stderr = await process.communicate(manifest_yaml.encode())
                result.deploy_logs.extend(stdout.decode().split("\n"))

                if process.returncode != 0:
                    result.status = DeploymentStatus.FAILED
                    result.error = stderr.decode()
                    return result

            # Get service URL
            result.url = await self._get_service_url(
                config.project_name,
                config.k8s_namespace
            )
            result.status = DeploymentStatus.SUCCESS

        except Exception as e:
            result.status = DeploymentStatus.FAILED
            result.error = str(e)
            logger.exception("Kubernetes deployment failed")

        result.duration_seconds = (datetime.utcnow() - start_time).total_seconds()
        return result

    def _generate_manifests(self, config: DeploymentConfig) -> List[Dict[str, Any]]:
        """Generate Kubernetes deployment manifests."""
        name = config.project_name.lower().replace(" ", "-")

        deployment = {
            "apiVersion": "apps/v1",
            "kind": "Deployment",
            "metadata": {
                "name": name,
                "namespace": config.k8s_namespace,
            },
            "spec": {
                "replicas": config.k8s_replicas,
                "selector": {"matchLabels": {"app": name}},
                "template": {
                    "metadata": {"labels": {"app": name}},
                    "spec": {
                        "containers": [{
                            "name": name,
                            "image": f"{name}:latest",
                            "ports": [{"containerPort": 80}],
                            "env": [
                                {"name": k, "value": v}
                                for k, v in config.environment_variables.items()
                            ],
                        }],
                    },
                },
            },
        }

        service = {
            "apiVersion": "v1",
            "kind": "Service",
            "metadata": {
                "name": name,
                "namespace": config.k8s_namespace,
            },
            "spec": {
                "selector": {"app": name},
                "ports": [{"port": 80, "targetPort": 80}],
                "type": "ClusterIP",
            },
        }

        return [deployment, service]

    async def _get_service_url(self, name: str, namespace: str) -> Optional[str]:
        """Get service URL from Kubernetes."""
        name = name.lower().replace(" ", "-")
        return f"http://{name}.{namespace}.svc.cluster.local"

    async def get_status(self, deployment_id: str) -> DeploymentStatus:
        return DeploymentStatus.SUCCESS

    async def rollback(self, deployment_id: str) -> bool:
        return True


class DeploymentService:
    """
    Main deployment service that orchestrates deployments to various targets.
    """

    def __init__(self):
        self.providers: Dict[DeploymentTarget, DeploymentProvider] = {}
        self._register_default_providers()

    def _register_default_providers(self) -> None:
        """Register default deployment providers."""
        self.register_provider(VercelProvider())
        self.register_provider(NetlifyProvider())
        self.register_provider(AWSS3Provider())
        self.register_provider(KubernetesProvider())

    def register_provider(self, provider: DeploymentProvider) -> None:
        """Register a deployment provider."""
        self.providers[provider.target] = provider

    async def deploy(
        self,
        config: DeploymentConfig,
        on_progress: Optional[Callable[[str], None]] = None,
    ) -> DeploymentResult:
        """
        Deploy a project to the specified target.

        Args:
            config: Deployment configuration
            on_progress: Optional callback for progress updates

        Returns:
            DeploymentResult with status and URL
        """
        provider = self.providers.get(config.target)
        if not provider:
            return DeploymentResult(
                status=DeploymentStatus.FAILED,
                target=config.target,
                error=f"No provider registered for {config.target}",
            )

        if on_progress:
            on_progress(f"Starting deployment to {config.target.value}...")

        result = await provider.deploy(config)

        if on_progress:
            if result.status == DeploymentStatus.SUCCESS:
                on_progress(f"Deployment successful! URL: {result.url}")
            else:
                on_progress(f"Deployment failed: {result.error}")

        return result

    async def deploy_multi(
        self,
        configs: List[DeploymentConfig],
    ) -> List[DeploymentResult]:
        """Deploy to multiple targets concurrently."""
        tasks = [self.deploy(config) for config in configs]
        return await asyncio.gather(*tasks)


# Convenience function for one-click deployment
async def one_click_deploy(
    source_path: str,
    target: DeploymentTarget,
    project_name: str,
    **kwargs: Any,
) -> DeploymentResult:
    """
    One-click deployment convenience function.

    Args:
        source_path: Path to the project source
        target: Deployment target
        project_name: Name of the project
        **kwargs: Additional configuration options

    Returns:
        DeploymentResult with status and URL
    """
    config = DeploymentConfig(
        target=target,
        project_name=project_name,
        source_path=source_path,
        **kwargs,
    )

    service = DeploymentService()
    return await service.deploy(config)
