"""Kubernetes job executor for isolated tool execution"""
import logging
import time
import asyncio
from typing import Dict, Any, Optional
from kubernetes import client
from kubernetes.client.rest import ApiException
from app.k8s.client import get_k8s_clients
from app.storage.s3_workspace import S3Workspace
from app.config import get_settings

logger = logging.getLogger(__name__)


class K8sExecutor:
    """
    Spawns Kubernetes jobs for isolated tool execution.

    Infrastructure ready but not used yet (tools remain mocked in Phase 2B.1).
    """

    def __init__(self, run_id: str, user_id: str, step_id: str):
        """
        Initialize K8s executor.

        Args:
            run_id: Agent run ID
            user_id: User ID
            step_id: Step ID
        """
        self.run_id = run_id
        self.user_id = user_id
        self.step_id = step_id
        self.batch_client, self.core_client = get_k8s_clients()
        self.workspace = S3Workspace(user_id, run_id)
        self.settings = get_settings()
        self.namespace = self.settings.k8s_namespace

    async def execute_shell(self, command: str, timeout: int = 300) -> Dict[str, Any]:
        """
        Execute shell command in isolated K8s job.

        Args:
            command: Shell command to execute
            timeout: Maximum execution time in seconds

        Returns:
            Dictionary with stdout, stderr, exit_code
        """
        job_name = f"agent-shell-{self.run_id[:8]}-{self.step_id[:8]}"

        # Create job manifest
        manifest = self._create_shell_job_manifest(job_name, command, timeout)

        try:
            # Create job
            self.batch_client.create_namespaced_job(
                namespace=self.namespace,
                body=manifest
            )
            logger.info(f"Created K8s job: {job_name}")

            # Wait for pod to be created
            pod_name = await self._wait_for_job_pod(job_name, timeout)
            if not pod_name:
                raise TimeoutError(f"Job pod not created within {timeout}s")

            # Wait for completion
            exit_code, stdout, stderr = await self._wait_for_pod_completion(
                pod_name, timeout
            )

            return {
                "stdout": stdout,
                "stderr": stderr,
                "exit_code": exit_code
            }

        except Exception as e:
            logger.error(f"K8s job execution failed: {e}")
            raise

        finally:
            # Cleanup job (TTL will also auto-delete after 5 minutes)
            await self._cleanup_job(job_name)

    async def execute_code(
        self,
        language: str,
        code: str,
        timeout: int = 120
    ) -> Dict[str, Any]:
        """
        Execute code in isolated K8s job.

        Args:
            language: Programming language (python, javascript, etc.)
            code: Code to execute
            timeout: Maximum execution time in seconds

        Returns:
            Dictionary with result, execution_time_ms, error
        """
        job_name = f"agent-code-{self.run_id[:8]}-{self.step_id[:8]}"

        # Create job manifest
        manifest = self._create_code_job_manifest(job_name, language, code, timeout)

        try:
            # Create job
            self.batch_client.create_namespaced_job(
                namespace=self.namespace,
                body=manifest
            )
            logger.info(f"Created code execution job: {job_name}")

            # Wait for completion
            pod_name = await self._wait_for_job_pod(job_name, timeout)
            if not pod_name:
                raise TimeoutError(f"Job pod not created within {timeout}s")

            exit_code, stdout, stderr = await self._wait_for_pod_completion(
                pod_name, timeout
            )

            return {
                "result": stdout,
                "error": stderr if exit_code != 0 else None,
                "execution_time_ms": 0  # TODO: Track actual time
            }

        except Exception as e:
            logger.error(f"Code execution failed: {e}")
            raise

        finally:
            await self._cleanup_job(job_name)

    def _create_shell_job_manifest(
        self,
        job_name: str,
        command: str,
        timeout: int
    ) -> Dict[str, Any]:
        """Create K8s job manifest for shell execution"""
        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": job_name,
                "namespace": self.namespace,
                "labels": {
                    "app": "agent-tool",
                    "tool": "shell",
                    "run-id": self.run_id[:8]
                }
            },
            "spec": {
                "ttlSecondsAfterFinished": 300,  # Auto-cleanup after 5 min
                "backoffLimit": 2,  # Retry failed jobs twice
                "activeDeadlineSeconds": timeout,
                "template": {
                    "spec": {
                        "restartPolicy": "OnFailure",
                        "containers": [{
                            "name": "executor",
                            "image": "alpine:latest",
                            "command": ["/bin/sh", "-c", command],
                            "workingDir": "/workspace",
                            "resources": {
                                "requests": {
                                    "cpu": "100m",
                                    "memory": "128Mi"
                                },
                                "limits": {
                                    "cpu": "500m",
                                    "memory": "512Mi"
                                }
                            },
                            "volumeMounts": [{
                                "name": "workspace",
                                "mountPath": "/workspace"
                            }]
                        }],
                        "volumes": [{
                            "name": "workspace",
                            "emptyDir": {}  # Ephemeral for now (S3 sync in Phase 2B.2)
                        }]
                    }
                }
            }
        }

    def _create_code_job_manifest(
        self,
        job_name: str,
        language: str,
        code: str,
        timeout: int
    ) -> Dict[str, Any]:
        """Create K8s job manifest for code execution"""
        # Language-specific images
        images = {
            "python": "python:3.11-slim",
            "javascript": "node:20-slim",
            "typescript": "node:20-slim",
            "bash": "bash:latest",
            "ruby": "ruby:3.2-slim",
            "go": "golang:1.21-alpine"
        }

        image = images.get(language.lower(), "python:3.11-slim")

        # Language-specific commands
        if language.lower() == "python":
            cmd = ["python", "-c", code]
        elif language.lower() in ["javascript", "typescript"]:
            cmd = ["node", "-e", code]
        else:
            cmd = ["/bin/sh", "-c", code]

        return {
            "apiVersion": "batch/v1",
            "kind": "Job",
            "metadata": {
                "name": job_name,
                "namespace": self.namespace,
                "labels": {
                    "app": "agent-tool",
                    "tool": "code",
                    "language": language.lower(),
                    "run-id": self.run_id[:8]
                }
            },
            "spec": {
                "ttlSecondsAfterFinished": 300,
                "backoffLimit": 1,
                "activeDeadlineSeconds": timeout,
                "template": {
                    "spec": {
                        "restartPolicy": "Never",
                        "containers": [{
                            "name": "executor",
                            "image": image,
                            "command": cmd,
                            "resources": {
                                "requests": {
                                    "cpu": "100m",
                                    "memory": "128Mi"
                                },
                                "limits": {
                                    "cpu": "1000m",
                                    "memory": "1Gi"
                                }
                            }
                        }]
                    }
                }
            }
        }

    async def _wait_for_job_pod(self, job_name: str, timeout: int) -> Optional[str]:
        """Wait for job's pod to be created"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                pods = self.core_client.list_namespaced_pod(
                    namespace=self.namespace,
                    label_selector=f"job-name={job_name}"
                )

                if pods.items:
                    pod_name = pods.items[0].metadata.name
                    logger.info(f"Job pod created: {pod_name}")
                    return pod_name

            except ApiException as e:
                logger.error(f"Error listing pods: {e}")

            await asyncio.sleep(1)

        return None

    async def _wait_for_pod_completion(
        self,
        pod_name: str,
        timeout: int
    ) -> tuple[int, str, str]:
        """Wait for pod to complete and get logs"""
        start_time = time.time()

        while time.time() - start_time < timeout:
            try:
                pod = self.core_client.read_namespaced_pod(
                    name=pod_name,
                    namespace=self.namespace
                )

                phase = pod.status.phase

                if phase == "Succeeded":
                    logs = self.core_client.read_namespaced_pod_log(
                        name=pod_name,
                        namespace=self.namespace
                    )
                    logger.info(f"Pod {pod_name} succeeded")
                    return 0, logs, ""

                elif phase == "Failed":
                    logs = self.core_client.read_namespaced_pod_log(
                        name=pod_name,
                        namespace=self.namespace
                    )
                    logger.warning(f"Pod {pod_name} failed")
                    return 1, "", logs

            except ApiException as e:
                logger.error(f"Error reading pod status: {e}")

            await asyncio.sleep(1)

        # Timeout
        logger.error(f"Pod {pod_name} timed out after {timeout}s")
        raise TimeoutError(f"Pod {pod_name} execution timeout")

    async def _cleanup_job(self, job_name: str):
        """Delete job (pods will be cleaned up by propagation policy)"""
        try:
            self.batch_client.delete_namespaced_job(
                name=job_name,
                namespace=self.namespace,
                propagation_policy="Background"
            )
            logger.info(f"Deleted job: {job_name}")
        except ApiException as e:
            if e.status != 404:  # Ignore if already deleted
                logger.warning(f"Failed to delete job {job_name}: {e}")
