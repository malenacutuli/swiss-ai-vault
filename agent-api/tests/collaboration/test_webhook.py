"""Tests for Webhook Client."""

import pytest
import asyncio
import time
import json
import hashlib
import hmac
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import datetime

from app.collaboration.webhook import (
    WebhookClient,
    WebhookEndpoint,
    WebhookConfig,
    WebhookDelivery,
    WebhookStatus,
    verify_webhook_signature,
)


class TestWebhookEndpoint:
    """Tests for WebhookEndpoint."""

    def test_minimal_endpoint(self):
        """Create endpoint with just URL."""
        endpoint = WebhookEndpoint(url="https://example.com/webhook")

        assert endpoint.url == "https://example.com/webhook"
        assert endpoint.enabled is True
        assert endpoint.secret is None

    def test_endpoint_with_secret(self):
        """Create endpoint with signing secret."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            secret="my-secret-key",
            name="my-webhook",
        )

        assert endpoint.secret == "my-secret-key"
        assert endpoint.name == "my-webhook"

    def test_endpoint_with_custom_headers(self):
        """Create endpoint with custom headers."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            headers={"X-Custom": "value"},
        )

        assert endpoint.headers["X-Custom"] == "value"


class TestWebhookConfig:
    """Tests for WebhookConfig."""

    def test_default_config(self):
        """Config has sensible defaults."""
        config = WebhookConfig()

        assert config.timeout == 10.0
        assert config.max_retries == 3
        assert config.retry_base_delay == 1.0

    def test_custom_config(self):
        """Can customize config."""
        config = WebhookConfig(
            timeout=5.0,
            max_retries=5,
        )

        assert config.timeout == 5.0
        assert config.max_retries == 5


class TestWebhookClient:
    """Tests for WebhookClient."""

    @pytest.fixture
    def client(self):
        config = WebhookConfig(
            timeout=1.0,
            max_retries=2,
            retry_base_delay=0.1,
        )
        return WebhookClient(config=config)

    @pytest.fixture
    def mock_http_client(self):
        mock = AsyncMock()
        return mock

    def test_register_endpoint(self, client):
        """Register endpoint adds to registry."""
        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        assert len(client.get_endpoints()) == 1

    def test_register_endpoint_with_name(self, client):
        """Register endpoint with name uses name as key."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            name="my-hook",
        )
        client.register_endpoint(endpoint)

        endpoints = client.get_endpoints()
        assert len(endpoints) == 1
        assert endpoints[0].name == "my-hook"

    def test_unregister_endpoint(self, client):
        """Unregister removes endpoint."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            name="my-hook",
        )
        client.register_endpoint(endpoint)

        result = client.unregister_endpoint("my-hook")

        assert result is True
        assert len(client.get_endpoints()) == 0

    def test_unregister_unknown_endpoint(self, client):
        """Unregister unknown returns False."""
        result = client.unregister_endpoint("unknown")
        assert result is False

    def test_sign_payload(self, client):
        """Payload signing produces valid HMAC."""
        payload = {"test": "data"}
        secret = "test-secret"
        timestamp = "1234567890"

        signature = client._sign_payload(payload, secret, timestamp)

        # Verify signature manually
        message = f"{timestamp}.{json.dumps(payload, sort_keys=True)}"
        expected = hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        assert signature == expected

    def test_build_headers_without_secret(self, client):
        """Headers without secret don't include signature."""
        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        payload = {"test": "data"}

        headers = client._build_headers(endpoint, payload, "delivery-123")

        assert "Content-Type" in headers
        assert "X-Webhook-ID" in headers
        assert "X-Webhook-Timestamp" in headers
        assert "X-Webhook-Signature" not in headers

    def test_build_headers_with_secret(self, client):
        """Headers with secret include signature."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            secret="my-secret",
        )
        payload = {"test": "data"}

        headers = client._build_headers(endpoint, payload, "delivery-123")

        assert "X-Webhook-Signature" in headers
        assert headers["X-Webhook-Signature"].startswith("sha256=")

    def test_build_headers_includes_custom(self, client):
        """Custom endpoint headers are included."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            headers={"X-Custom": "value"},
        )
        payload = {"test": "data"}

        headers = client._build_headers(endpoint, payload, "delivery-123")

        assert headers["X-Custom"] == "value"

    @pytest.mark.asyncio
    async def test_send_no_endpoints(self, client):
        """Send with no endpoints returns empty list."""
        deliveries = await client.send("test_event", {"key": "value"})
        assert deliveries == []

    @pytest.mark.asyncio
    async def test_send_disabled_endpoint(self, client):
        """Send skips disabled endpoints."""
        endpoint = WebhookEndpoint(
            url="https://example.com/webhook",
            enabled=False,
        )
        client.register_endpoint(endpoint)

        deliveries = await client.send("test_event", {"key": "value"})
        assert deliveries == []

    @pytest.mark.asyncio
    async def test_send_success(self, client):
        """Successful send creates delivered record."""
        # Create mock HTTP client
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        deliveries = await client.send("test_event", {"key": "value"})

        assert len(deliveries) == 1
        assert deliveries[0].status == WebhookStatus.DELIVERED
        assert deliveries[0].response_status == 200

    @pytest.mark.asyncio
    async def test_send_failure_exhausts_retries(self, client):
        """Failed send after retries marks as failed."""
        # Create mock that always fails
        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        deliveries = await client.send("test_event", {"key": "value"})

        assert len(deliveries) == 1
        assert deliveries[0].status == WebhookStatus.FAILED
        assert deliveries[0].attempts == 3  # Initial + 2 retries

    @pytest.mark.asyncio
    async def test_get_delivery(self, client):
        """Can retrieve delivery by ID."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        deliveries = await client.send("test_event", {"key": "value"})
        delivery_id = deliveries[0].id

        retrieved = client.get_delivery(delivery_id)
        assert retrieved is not None
        assert retrieved.id == delivery_id

    @pytest.mark.asyncio
    async def test_get_recent_deliveries(self, client):
        """Can get recent delivery records."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        await client.send("event1", {"key": "value1"})
        await client.send("event2", {"key": "value2"})

        recent = client.get_recent_deliveries(limit=10)
        assert len(recent) == 2

    @pytest.mark.asyncio
    async def test_get_stats(self, client):
        """Get webhook statistics."""
        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        await client.send("test_event", {"key": "value"})

        stats = client.get_stats()

        assert stats["endpoints"] == 1
        assert stats["total_sent"] == 1
        assert stats["total_delivered"] == 1
        assert stats["total_failed"] == 0

    @pytest.mark.asyncio
    async def test_delivery_success_callback(self, client):
        """Success callback is invoked."""
        callbacks = []

        async def on_success(delivery):
            callbacks.append(delivery)

        client.on_delivery_success = on_success

        mock_response = MagicMock()
        mock_response.status_code = 200

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        await client.send("test_event", {"key": "value"})

        assert len(callbacks) == 1
        assert callbacks[0].status == WebhookStatus.DELIVERED

    @pytest.mark.asyncio
    async def test_delivery_failure_callback(self, client):
        """Failure callback is invoked."""
        callbacks = []

        async def on_failure(delivery):
            callbacks.append(delivery)

        client.on_delivery_failure = on_failure

        mock_response = MagicMock()
        mock_response.status_code = 500

        mock_http = AsyncMock()
        mock_http.post = AsyncMock(return_value=mock_response)
        client._http_client = mock_http

        endpoint = WebhookEndpoint(url="https://example.com/webhook")
        client.register_endpoint(endpoint)

        await client.send("test_event", {"key": "value"})

        assert len(callbacks) == 1
        assert callbacks[0].status == WebhookStatus.FAILED


class TestVerifyWebhookSignature:
    """Tests for verify_webhook_signature function."""

    def test_valid_signature(self):
        """Valid signature passes verification."""
        secret = "test-secret"
        timestamp = str(int(time.time()))
        payload = json.dumps({"test": "data"}).encode()

        # Generate signature
        message = f"{timestamp}.{payload.decode()}"
        signature = hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        result = verify_webhook_signature(
            payload=payload,
            signature=f"sha256={signature}",
            secret=secret,
            timestamp=timestamp,
        )

        assert result is True

    def test_invalid_signature(self):
        """Invalid signature fails verification."""
        result = verify_webhook_signature(
            payload=b'{"test": "data"}',
            signature="sha256=invalid",
            secret="test-secret",
            timestamp=str(int(time.time())),
        )

        assert result is False

    def test_expired_timestamp(self):
        """Expired timestamp fails verification."""
        secret = "test-secret"
        old_timestamp = str(int(time.time()) - 600)  # 10 minutes ago
        payload = b'{"test": "data"}'

        # Generate valid signature with old timestamp
        message = f"{old_timestamp}.{payload.decode()}"
        signature = hmac.new(
            secret.encode(),
            message.encode(),
            hashlib.sha256
        ).hexdigest()

        result = verify_webhook_signature(
            payload=payload,
            signature=f"sha256={signature}",
            secret=secret,
            timestamp=old_timestamp,
            tolerance=300,  # 5 minutes
        )

        assert result is False

    def test_invalid_timestamp_format(self):
        """Invalid timestamp format fails verification."""
        result = verify_webhook_signature(
            payload=b'{"test": "data"}',
            signature="sha256=something",
            secret="test-secret",
            timestamp="invalid",
        )

        assert result is False


class TestWebhookDelivery:
    """Tests for WebhookDelivery dataclass."""

    def test_default_values(self):
        """Delivery has sensible defaults."""
        delivery = WebhookDelivery(
            id="test-123",
            endpoint_url="https://example.com/webhook",
            payload={"key": "value"},
            status=WebhookStatus.PENDING,
        )

        assert delivery.attempts == 0
        assert delivery.last_attempt is None
        assert delivery.last_error is None
        assert delivery.created_at is not None


class TestWebhookStatus:
    """Tests for WebhookStatus enum."""

    def test_status_values(self):
        """All status values exist."""
        assert WebhookStatus.PENDING.value == "pending"
        assert WebhookStatus.DELIVERED.value == "delivered"
        assert WebhookStatus.FAILED.value == "failed"
        assert WebhookStatus.RETRYING.value == "retrying"
