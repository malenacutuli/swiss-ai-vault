"""Kubernetes client initialization"""
import logging
from kubernetes import client, config
from app.config import get_settings

logger = logging.getLogger(__name__)

_batch_client = None
_core_client = None


def get_k8s_clients():
    """
    Get Kubernetes API clients (lazy initialization).

    Returns:
        Tuple of (BatchV1Api, CoreV1Api)
    """
    global _batch_client, _core_client

    if _batch_client is None:
        settings = get_settings()

        # Load Kubernetes config
        if settings.k8s_in_cluster:
            config.load_incluster_config()
            logger.info("Loaded in-cluster Kubernetes config")
        else:
            config.load_kube_config()
            logger.info("Loaded Kubernetes config from kubeconfig")

        _batch_client = client.BatchV1Api()
        _core_client = client.CoreV1Api()

    return _batch_client, _core_client
