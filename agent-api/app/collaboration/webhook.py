"""
Webhook Client for Collaboration Alerts

Sends HTTP webhook notifications to configured endpoints with:
- Retry logic with exponential backoff
- Request signing for security (HMAC-SHA256)
- Configurable timeouts and retry limits
- Async/concurrent delivery to multiple endpoints
"""

from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import logging
import time
import uuid
from typing import Optional, Any, Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum

import httpx

logger = logging.getLogger(__name__)


class WebhookStatus(Enum):
    """Status of a webhook delivery attempt."""
    PENDING = "pending"
    DELIVERED = "delivered"
    FAILED = "failed"
    RETRYING = "retrying"


@dataclass
class WebhookEndpoint:
    """Configuration for a webhook endpoint."""
    url: str
    secret: Optional[str] = None  # For HMAC signing
    enabled: bool = True
    name: Optional[str] = None
    headers: dict = field(default_factory=dict)

    # Per-endpoint overrides
    timeout: Optional[float] = None
    max_retries: Optional[int] = None


@dataclass
class WebhookConfig:
    """Global webhook configuration."""
    timeout: float = 10.0  # Request timeout in seconds
    max_retries: int = 3
    retry_base_delay: float = 1.0  # Base delay for exponential backoff
    retry_max_delay: float = 60.0  # Maximum delay between retries
    concurrent_deliveries: int = 10  # Max concurrent webhook calls


@dataclass
class WebhookDelivery:
    """Record of a webhook delivery attempt."""
    id: str
    endpoint_url: str
    payload: dict
    status: WebhookStatus
    attempts: int = 0
    last_attempt: Optional[datetime] = None
    last_error: Optional[str] = None
    response_status: Optional[int] = None
    response_time_ms: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


class WebhookClient:
    """
    Async HTTP client for sending webhook notifications.

    Features:
    - HMAC-SHA256 request signing
    - Exponential backoff retry
    - Concurrent delivery to multiple endpoints
    - Delivery tracking and statistics
    """

    def __init__(
        self,
        config: Optional[WebhookConfig] = None,
        http_client: Optional[httpx.AsyncClient] = None,
    ):
        """
        Initialize webhook client.

        Args:
            config: Webhook configuration
            http_client: Optional pre-configured HTTP client
        """
        self.config = config or WebhookConfig()
        self._http_client = http_client
        self._owns_client = http_client is None

        # Endpoint registry
        self._endpoints: dict[str, WebhookEndpoint] = {}

        # Delivery tracking
        self._deliveries: dict[str, WebhookDelivery] = {}
        self._max_delivery_history = 1000

        # Statistics
        self._total_sent = 0
        self._total_delivered = 0
        self._total_failed = 0

        # Semaphore for concurrent deliveries
        self._semaphore = asyncio.Semaphore(self.config.concurrent_deliveries)

        # Callbacks
        self.on_delivery_success: Optional[Callable[[WebhookDelivery], Any]] = None
        self.on_delivery_failure: Optional[Callable[[WebhookDelivery], Any]] = None

    async def _get_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(
                timeout=self.config.timeout,
                follow_redirects=True,
            )
        return self._http_client

    async def close(self) -> None:
        """Close HTTP client if owned."""
        if self._owns_client and self._http_client:
            await self._http_client.aclose()
            self._http_client = None

    def register_endpoint(self, endpoint: WebhookEndpoint) -> None:
        """
        Register a webhook endpoint.

        Args:
            endpoint: Endpoint configuration
        """
        key = endpoint.name or endpoint.url
        self._endpoints[key] = endpoint
        logger.info(f"Registered webhook endpoint: {key}")

    def unregister_endpoint(self, name_or_url: str) -> bool:
        """
        Unregister a webhook endpoint.

        Args:
            name_or_url: Endpoint name or URL

        Returns:
            True if endpoint was removed
        """
        if name_or_url in self._endpoints:
            del self._endpoints[name_or_url]
            logger.info(f"Unregistered webhook endpoint: {name_or_url}")
            return True
        return False

    def get_endpoints(self) -> list[WebhookEndpoint]:
        """Get all registered endpoints."""
        return list(self._endpoints.values())

    def _sign_payload(
        self,
        payload: dict,
        secret: str,
        timestamp: str
    ) -> str:
        """
        Sign payload with HMAC-SHA256.

        Args:
            payload: The payload to sign
            secret: The signing secret
            timestamp: Request timestamp

        Returns:
            Hex-encoded signature
        """
        message = f"{timestamp}.{json.dumps(payload, sort_keys=True)}"
        signature = hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()
        return signature

    def _build_headers(
        self,
        endpoint: WebhookEndpoint,
        payload: dict,
        delivery_id: str
    ) -> dict:
        """Build request headers including signature."""
        timestamp = str(int(time.time()))

        headers = {
            "Content-Type": "application/json",
            "X-Webhook-ID": delivery_id,
            "X-Webhook-Timestamp": timestamp,
            **endpoint.headers,
        }

        if endpoint.secret:
            signature = self._sign_payload(payload, endpoint.secret, timestamp)
            headers["X-Webhook-Signature"] = f"sha256={signature}"

        return headers

    async def send(
        self,
        event_type: str,
        payload: dict,
        endpoints: Optional[list[str]] = None,
    ) -> list[WebhookDelivery]:
        """
        Send webhook to registered endpoints.

        Args:
            event_type: Type of event (e.g., "circuit_open")
            payload: Event payload data
            endpoints: Optional list of endpoint names/URLs to send to.
                      If None, sends to all enabled endpoints.

        Returns:
            List of delivery records
        """
        # Build full payload
        full_payload = {
            "event": event_type,
            "timestamp": datetime.utcnow().isoformat(),
            "data": payload,
        }

        # Determine which endpoints to send to
        target_endpoints = []
        if endpoints:
            for name in endpoints:
                if name in self._endpoints and self._endpoints[name].enabled:
                    target_endpoints.append(self._endpoints[name])
        else:
            target_endpoints = [e for e in self._endpoints.values() if e.enabled]

        if not target_endpoints:
            logger.warning(f"No endpoints available for event: {event_type}")
            return []

        # Send to all endpoints concurrently
        tasks = [
            self._deliver(endpoint, full_payload)
            for endpoint in target_endpoints
        ]

        deliveries = await asyncio.gather(*tasks, return_exceptions=True)

        # Filter out exceptions and return valid deliveries
        return [d for d in deliveries if isinstance(d, WebhookDelivery)]

    async def _deliver(
        self,
        endpoint: WebhookEndpoint,
        payload: dict
    ) -> WebhookDelivery:
        """Deliver webhook to a single endpoint with retries."""
        delivery_id = str(uuid.uuid4())
        delivery = WebhookDelivery(
            id=delivery_id,
            endpoint_url=endpoint.url,
            payload=payload,
            status=WebhookStatus.PENDING,
        )

        self._total_sent += 1

        # Get endpoint-specific or default settings
        max_retries = endpoint.max_retries or self.config.max_retries
        timeout = endpoint.timeout or self.config.timeout

        async with self._semaphore:
            for attempt in range(max_retries + 1):
                delivery.attempts = attempt + 1
                delivery.last_attempt = datetime.utcnow()

                try:
                    client = await self._get_client()
                    headers = self._build_headers(endpoint, payload, delivery_id)

                    start_time = time.monotonic()
                    response = await client.post(
                        endpoint.url,
                        json=payload,
                        headers=headers,
                        timeout=timeout,
                    )
                    elapsed_ms = (time.monotonic() - start_time) * 1000

                    delivery.response_status = response.status_code
                    delivery.response_time_ms = elapsed_ms

                    if 200 <= response.status_code < 300:
                        delivery.status = WebhookStatus.DELIVERED
                        self._total_delivered += 1

                        logger.info(
                            f"Webhook delivered: {endpoint.url} "
                            f"(status={response.status_code}, "
                            f"time={elapsed_ms:.0f}ms)"
                        )

                        if self.on_delivery_success:
                            try:
                                result = self.on_delivery_success(delivery)
                                if asyncio.iscoroutine(result):
                                    await result
                            except Exception:
                                pass

                        break

                    else:
                        delivery.last_error = f"HTTP {response.status_code}"
                        delivery.status = WebhookStatus.RETRYING

                        logger.warning(
                            f"Webhook failed: {endpoint.url} "
                            f"(status={response.status_code})"
                        )

                except httpx.TimeoutException as e:
                    delivery.last_error = f"Timeout: {e}"
                    delivery.status = WebhookStatus.RETRYING
                    logger.warning(f"Webhook timeout: {endpoint.url}")

                except httpx.RequestError as e:
                    delivery.last_error = f"Request error: {e}"
                    delivery.status = WebhookStatus.RETRYING
                    logger.warning(f"Webhook request error: {endpoint.url} - {e}")

                except Exception as e:
                    delivery.last_error = str(e)
                    delivery.status = WebhookStatus.RETRYING
                    logger.error(f"Webhook unexpected error: {endpoint.url} - {e}")

                # Calculate retry delay with exponential backoff
                if attempt < max_retries:
                    delay = min(
                        self.config.retry_base_delay * (2 ** attempt),
                        self.config.retry_max_delay
                    )
                    await asyncio.sleep(delay)

        # Mark as failed if not delivered
        if delivery.status != WebhookStatus.DELIVERED:
            delivery.status = WebhookStatus.FAILED
            self._total_failed += 1

            if self.on_delivery_failure:
                try:
                    result = self.on_delivery_failure(delivery)
                    if asyncio.iscoroutine(result):
                        await result
                except Exception:
                    pass

        # Store delivery record
        self._store_delivery(delivery)

        return delivery

    def _store_delivery(self, delivery: WebhookDelivery) -> None:
        """Store delivery record with cleanup of old records."""
        self._deliveries[delivery.id] = delivery

        # Cleanup old deliveries
        if len(self._deliveries) > self._max_delivery_history:
            # Remove oldest deliveries
            sorted_deliveries = sorted(
                self._deliveries.items(),
                key=lambda x: x[1].created_at
            )
            for key, _ in sorted_deliveries[:100]:
                del self._deliveries[key]

    def get_delivery(self, delivery_id: str) -> Optional[WebhookDelivery]:
        """Get a delivery record by ID."""
        return self._deliveries.get(delivery_id)

    def get_recent_deliveries(self, limit: int = 100) -> list[WebhookDelivery]:
        """Get recent delivery records."""
        sorted_deliveries = sorted(
            self._deliveries.values(),
            key=lambda x: x.created_at,
            reverse=True
        )
        return sorted_deliveries[:limit]

    def get_stats(self) -> dict:
        """Get webhook client statistics."""
        return {
            "endpoints": len(self._endpoints),
            "enabled_endpoints": len([e for e in self._endpoints.values() if e.enabled]),
            "total_sent": self._total_sent,
            "total_delivered": self._total_delivered,
            "total_failed": self._total_failed,
            "delivery_rate": (
                round(self._total_delivered / self._total_sent, 4)
                if self._total_sent > 0 else 1.0
            ),
            "pending_deliveries": len([
                d for d in self._deliveries.values()
                if d.status == WebhookStatus.PENDING
            ]),
        }


def verify_webhook_signature(
    payload: bytes,
    signature: str,
    secret: str,
    timestamp: str,
    tolerance: int = 300
) -> bool:
    """
    Verify an incoming webhook signature.

    Args:
        payload: Raw request body
        signature: Signature from X-Webhook-Signature header
        secret: The shared secret
        timestamp: Timestamp from X-Webhook-Timestamp header
        tolerance: Maximum age of request in seconds

    Returns:
        True if signature is valid and request is not too old
    """
    # Check timestamp freshness
    try:
        request_time = int(timestamp)
        current_time = int(time.time())
        if abs(current_time - request_time) > tolerance:
            return False
    except ValueError:
        return False

    # Verify signature
    expected_signature = hmac.new(
        secret.encode(),
        f"{timestamp}.{payload.decode()}".encode(),
        hashlib.sha256
    ).hexdigest()

    # Parse signature (format: "sha256=...")
    if signature.startswith("sha256="):
        signature = signature[7:]

    return hmac.compare_digest(expected_signature, signature)
