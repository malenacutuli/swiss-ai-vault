"""Tests for Integration Hub module."""

import pytest
from datetime import datetime, timedelta
import json
import hashlib
import hmac

from app.collaboration.integrations import (
    IntegrationManager,
    IntegrationRegistry,
    IntegrationConfig,
    Integration,
    IntegrationType,
    IntegrationStatus,
    IntegrationConnector,
    ConnectorFactory,
    CredentialManager,
    Credential,
    AuthType,
    OAuthConfig,
    SyncEngine,
    SyncRecord,
    SyncConflict,
    SyncDirection,
    SyncStatus,
    ConflictResolution,
    ResourceMapping,
    FieldMapping,
    WebhookReceiver,
    WebhookEvent,
    WebhookEventType,
    SlackConnector,
    GitHubConnector,
    JiraConnector,
    GenericWebhookConnector,
    get_integration_manager,
    set_integration_manager,
    reset_integration_manager,
)


# ==================== Fixtures ====================

@pytest.fixture
def credential_manager():
    """Create a credential manager."""
    return CredentialManager()


@pytest.fixture
def registry(credential_manager):
    """Create an integration registry."""
    return IntegrationRegistry(credential_manager)


@pytest.fixture
def sync_engine():
    """Create a sync engine."""
    return SyncEngine()


@pytest.fixture
def webhook_receiver():
    """Create a webhook receiver."""
    return WebhookReceiver()


@pytest.fixture
def manager():
    """Create an integration manager."""
    return IntegrationManager()


@pytest.fixture
def slack_config():
    """Create a Slack integration config."""
    return IntegrationConfig(
        type=IntegrationType.SLACK,
        name="Slack Integration",
        auth_type=AuthType.OAUTH2,
        base_url="https://slack.com/api"
    )


@pytest.fixture
def github_config():
    """Create a GitHub integration config."""
    return IntegrationConfig(
        type=IntegrationType.GITHUB,
        name="GitHub Integration",
        auth_type=AuthType.BEARER,
        base_url="https://api.github.com"
    )


# ==================== Credential Tests ====================

class TestCredential:
    """Tests for Credential."""

    def test_create_credential(self):
        """Test creating a credential."""
        cred = Credential(
            id="cred_1",
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            encrypted_data="encrypted"
        )
        assert cred.id == "cred_1"
        assert cred.integration_id == "int_1"
        assert cred.auth_type == AuthType.API_KEY

    def test_credential_not_expired(self):
        """Test credential not expired."""
        cred = Credential(
            id="cred_1",
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            encrypted_data="encrypted",
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        assert cred.is_expired is False

    def test_credential_expired(self):
        """Test credential expired."""
        cred = Credential(
            id="cred_1",
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            encrypted_data="encrypted",
            expires_at=datetime.utcnow() - timedelta(hours=1)
        )
        assert cred.is_expired is True

    def test_credential_no_expiry(self):
        """Test credential with no expiry."""
        cred = Credential(
            id="cred_1",
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            encrypted_data="encrypted"
        )
        assert cred.is_expired is False


# ==================== CredentialManager Tests ====================

class TestCredentialManager:
    """Tests for CredentialManager."""

    def test_store_credential(self, credential_manager):
        """Test storing a credential."""
        cred = credential_manager.store_credential(
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            data={"api_key": "secret123"}
        )
        assert cred.id is not None
        assert cred.integration_id == "int_1"
        assert cred.auth_type == AuthType.API_KEY

    def test_get_credential(self, credential_manager):
        """Test getting a credential."""
        cred = credential_manager.store_credential(
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            data={"api_key": "secret123"}
        )

        retrieved = credential_manager.get_credential(cred.id)
        assert retrieved is not None
        assert retrieved.id == cred.id

    def test_get_credential_data(self, credential_manager):
        """Test getting credential data."""
        cred = credential_manager.store_credential(
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            data={"api_key": "secret123"}
        )

        data = credential_manager.get_credential_data(cred.id)
        assert data is not None
        assert data["api_key"] == "secret123"

    def test_update_credential(self, credential_manager):
        """Test updating a credential."""
        cred = credential_manager.store_credential(
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            data={"api_key": "old_key"}
        )

        result = credential_manager.update_credential(
            cred.id,
            data={"api_key": "new_key"}
        )
        assert result is True

        data = credential_manager.get_credential_data(cred.id)
        assert data["api_key"] == "new_key"

    def test_delete_credential(self, credential_manager):
        """Test deleting a credential."""
        cred = credential_manager.store_credential(
            integration_id="int_1",
            auth_type=AuthType.API_KEY,
            data={"api_key": "secret123"}
        )

        result = credential_manager.delete_credential(cred.id)
        assert result is True
        assert credential_manager.get_credential(cred.id) is None

    def test_refresh_oauth_token(self, credential_manager):
        """Test refreshing OAuth token."""
        cred = credential_manager.store_credential(
            integration_id="int_1",
            auth_type=AuthType.OAUTH2,
            data={"access_token": "old_token", "refresh_token": "refresh"}
        )

        result = credential_manager.refresh_oauth_token(
            cred.id,
            new_access_token="new_token",
            new_refresh_token="new_refresh",
            expires_in=3600
        )
        assert result is True

        data = credential_manager.get_credential_data(cred.id)
        assert data["access_token"] == "new_token"
        assert data["refresh_token"] == "new_refresh"


# ==================== Integration Tests ====================

class TestIntegration:
    """Tests for Integration."""

    def test_create_integration(self, slack_config):
        """Test creating an integration."""
        integration = Integration(
            id="int_1",
            config=slack_config,
            workspace_id="ws_1"
        )
        assert integration.id == "int_1"
        assert integration.config.type == IntegrationType.SLACK
        assert integration.status == IntegrationStatus.INACTIVE

    def test_integration_to_dict(self, slack_config):
        """Test converting integration to dict."""
        integration = Integration(
            id="int_1",
            config=slack_config,
            workspace_id="ws_1",
            status=IntegrationStatus.ACTIVE
        )

        result = integration.to_dict()
        assert result["id"] == "int_1"
        assert result["type"] == "slack"
        assert result["status"] == "active"


# ==================== IntegrationRegistry Tests ====================

class TestIntegrationRegistry:
    """Tests for IntegrationRegistry."""

    def test_register_integration(self, registry, slack_config):
        """Test registering an integration."""
        integration = registry.register_integration("ws_1", slack_config)

        assert integration.id is not None
        assert integration.workspace_id == "ws_1"
        assert integration.config.type == IntegrationType.SLACK

    def test_get_integration(self, registry, slack_config):
        """Test getting an integration."""
        integration = registry.register_integration("ws_1", slack_config)

        retrieved = registry.get_integration(integration.id)
        assert retrieved is not None
        assert retrieved.id == integration.id

    def test_get_workspace_integrations(self, registry, slack_config, github_config):
        """Test getting workspace integrations."""
        registry.register_integration("ws_1", slack_config)
        registry.register_integration("ws_1", github_config)
        registry.register_integration("ws_2", slack_config)

        integrations = registry.get_workspace_integrations("ws_1")
        assert len(integrations) == 2

    def test_get_workspace_integrations_by_status(self, registry, slack_config):
        """Test getting workspace integrations by status."""
        int1 = registry.register_integration("ws_1", slack_config)
        int1.status = IntegrationStatus.ACTIVE

        int2 = registry.register_integration("ws_1", slack_config)
        int2.status = IntegrationStatus.INACTIVE

        active = registry.get_workspace_integrations("ws_1", IntegrationStatus.ACTIVE)
        assert len(active) == 1
        assert active[0].status == IntegrationStatus.ACTIVE

    def test_connect_integration(self, registry, slack_config):
        """Test connecting an integration."""
        integration = registry.register_integration("ws_1", slack_config)

        result = registry.connect_integration(
            integration.id,
            {"access_token": "token123"}
        )
        assert result is True
        assert integration.status == IntegrationStatus.ACTIVE

    def test_disconnect_integration(self, registry, slack_config):
        """Test disconnecting an integration."""
        integration = registry.register_integration("ws_1", slack_config)
        registry.connect_integration(integration.id, {"access_token": "token123"})

        result = registry.disconnect_integration(integration.id)
        assert result is True
        assert integration.status == IntegrationStatus.INACTIVE

    def test_delete_integration(self, registry, slack_config):
        """Test deleting an integration."""
        integration = registry.register_integration("ws_1", slack_config)

        result = registry.delete_integration(integration.id)
        assert result is True
        assert registry.get_integration(integration.id) is None

    def test_get_connector(self, registry, slack_config):
        """Test getting connector for integration."""
        integration = registry.register_integration("ws_1", slack_config)
        registry.connect_integration(integration.id, {"access_token": "token123"})

        connector = registry.get_connector(integration.id)
        assert connector is not None
        assert isinstance(connector, SlackConnector)

    def test_test_integration(self, registry, slack_config):
        """Test testing an integration."""
        integration = registry.register_integration("ws_1", slack_config)
        registry.connect_integration(integration.id, {"access_token": "token123"})

        result = registry.test_integration(integration.id)
        assert result is True

    def test_get_stats(self, registry, slack_config, github_config):
        """Test getting registry stats."""
        int1 = registry.register_integration("ws_1", slack_config)
        int1.status = IntegrationStatus.ACTIVE
        registry.register_integration("ws_1", github_config)

        stats = registry.get_stats()
        assert stats["total_integrations"] == 2
        assert "by_type" in stats
        assert "by_status" in stats


# ==================== Connector Tests ====================

class TestConnectors:
    """Tests for Integration Connectors."""

    def test_slack_connector_connect(self, credential_manager, slack_config):
        """Test Slack connector connect."""
        integration = Integration(
            id="int_1",
            config=slack_config,
            workspace_id="ws_1"
        )

        cred = credential_manager.store_credential(
            "int_1", AuthType.OAUTH2, {"access_token": "token"}
        )
        integration.credential_id = cred.id

        connector = SlackConnector(integration, credential_manager)
        result = connector.connect()

        assert result is True
        assert integration.status == IntegrationStatus.ACTIVE

    def test_slack_connector_fetch_channels(self, credential_manager, slack_config):
        """Test Slack connector fetch channels."""
        integration = Integration(
            id="int_1",
            config=slack_config,
            workspace_id="ws_1"
        )

        cred = credential_manager.store_credential(
            "int_1", AuthType.OAUTH2, {"access_token": "token"}
        )
        integration.credential_id = cred.id

        connector = SlackConnector(integration, credential_manager)
        channels, cursor = connector.fetch_resources("channels")

        assert len(channels) >= 1
        assert any(c["name"] == "general" for c in channels)

    def test_slack_connector_send_message(self, credential_manager, slack_config):
        """Test Slack connector send message."""
        integration = Integration(
            id="int_1",
            config=slack_config,
            workspace_id="ws_1"
        )

        cred = credential_manager.store_credential(
            "int_1", AuthType.OAUTH2, {"access_token": "token"}
        )
        integration.credential_id = cred.id

        connector = SlackConnector(integration, credential_manager)
        result = connector.send_message("C123", "Hello!")

        assert result is not None
        assert result["ok"] is True

    def test_github_connector_connect(self, credential_manager, github_config):
        """Test GitHub connector connect."""
        integration = Integration(
            id="int_1",
            config=github_config,
            workspace_id="ws_1"
        )

        cred = credential_manager.store_credential(
            "int_1", AuthType.BEARER, {"token": "ghp_token123"}
        )
        integration.credential_id = cred.id

        connector = GitHubConnector(integration, credential_manager)
        result = connector.connect()

        assert result is True

    def test_github_connector_create_issue(self, credential_manager, github_config):
        """Test GitHub connector create issue."""
        integration = Integration(
            id="int_1",
            config=github_config,
            workspace_id="ws_1"
        )

        cred = credential_manager.store_credential(
            "int_1", AuthType.BEARER, {"token": "ghp_token123"}
        )
        integration.credential_id = cred.id

        connector = GitHubConnector(integration, credential_manager)
        result = connector.create_resource("issue", {
            "title": "Bug fix",
            "body": "Fix the bug"
        })

        assert result is not None
        assert result["title"] == "Bug fix"

    def test_jira_connector_fetch_projects(self, credential_manager):
        """Test Jira connector fetch projects."""
        config = IntegrationConfig(
            type=IntegrationType.JIRA,
            name="Jira",
            auth_type=AuthType.BASIC,
            base_url="https://jira.example.com"
        )
        integration = Integration(
            id="int_1",
            config=config,
            workspace_id="ws_1"
        )

        cred = credential_manager.store_credential(
            "int_1", AuthType.BASIC, {"username": "user", "password": "pass"}
        )
        integration.credential_id = cred.id

        connector = JiraConnector(integration, credential_manager)
        projects, _ = connector.fetch_resources("projects")

        assert len(projects) >= 1
        assert any(p["key"] == "PROJ" for p in projects)

    def test_generic_webhook_connector(self, credential_manager):
        """Test generic webhook connector."""
        config = IntegrationConfig(
            type=IntegrationType.WEBHOOK,
            name="Webhook",
            auth_type=AuthType.WEBHOOK_SECRET,
            base_url="https://webhook.example.com"
        )
        integration = Integration(
            id="int_1",
            config=config,
            workspace_id="ws_1"
        )

        connector = GenericWebhookConnector(integration, credential_manager)
        result = connector.connect()

        assert result is True
        assert integration.status == IntegrationStatus.ACTIVE


# ==================== ConnectorFactory Tests ====================

class TestConnectorFactory:
    """Tests for ConnectorFactory."""

    def test_create_slack_connector(self, credential_manager, slack_config):
        """Test creating Slack connector."""
        integration = Integration(
            id="int_1",
            config=slack_config,
            workspace_id="ws_1"
        )

        connector = ConnectorFactory.create(integration, credential_manager)
        assert isinstance(connector, SlackConnector)

    def test_create_github_connector(self, credential_manager, github_config):
        """Test creating GitHub connector."""
        integration = Integration(
            id="int_1",
            config=github_config,
            workspace_id="ws_1"
        )

        connector = ConnectorFactory.create(integration, credential_manager)
        assert isinstance(connector, GitHubConnector)

    def test_create_unknown_connector(self, credential_manager):
        """Test creating connector for unknown type."""
        config = IntegrationConfig(
            type=IntegrationType.CUSTOM,
            name="Custom",
            auth_type=AuthType.API_KEY
        )
        integration = Integration(
            id="int_1",
            config=config,
            workspace_id="ws_1"
        )

        connector = ConnectorFactory.create(integration, credential_manager)
        # Falls back to GenericWebhookConnector
        assert isinstance(connector, GenericWebhookConnector)


# ==================== SyncEngine Tests ====================

class TestSyncEngine:
    """Tests for SyncEngine."""

    def test_start_sync(self, sync_engine):
        """Test starting sync."""
        record = sync_engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        assert record.id is not None
        assert record.integration_id == "int_1"
        assert record.status == SyncStatus.IN_PROGRESS

    def test_complete_sync(self, sync_engine):
        """Test completing sync."""
        record = sync_engine.start_sync("int_1", SyncDirection.INBOUND)
        result = sync_engine.complete_sync(record.id)

        assert result is not None
        assert result.status == SyncStatus.COMPLETED
        assert result.completed_at is not None

    def test_sync_resource_create(self, sync_engine):
        """Test syncing resource - create."""
        record = sync_engine.start_sync("int_1", SyncDirection.INBOUND)

        action, data = sync_engine.sync_resource(
            record.id,
            "task",
            local_data=None,
            remote_data={"id": "1", "title": "Task"}
        )

        assert action == "create"
        assert data["title"] == "Task"
        assert record.items_created == 1

    def test_sync_resource_delete(self, sync_engine):
        """Test syncing resource - delete."""
        record = sync_engine.start_sync("int_1", SyncDirection.OUTBOUND)

        action, data = sync_engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Task"},
            remote_data=None
        )

        assert action == "delete"
        assert record.items_deleted == 1

    def test_sync_resource_skip_same(self, sync_engine):
        """Test syncing resource - skip same."""
        record = sync_engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        action, data = sync_engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Task"},
            remote_data={"id": "1", "title": "Task"}
        )

        assert action == "skip"

    def test_sync_resource_update(self, sync_engine):
        """Test syncing resource - update."""
        record = sync_engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        action, data = sync_engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Old"},
            remote_data={"id": "1", "title": "New"},
            local_modified=datetime.utcnow() - timedelta(hours=1),
            remote_modified=datetime.utcnow()
        )

        assert action == "update"
        assert data["title"] == "New"  # Remote wins (newest)
        assert record.items_updated == 1

    def test_conflict_resolution_local_wins(self):
        """Test conflict resolution - local wins."""
        engine = SyncEngine(ConflictResolution.LOCAL_WINS)
        record = engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        action, data = engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Local"},
            remote_data={"id": "1", "title": "Remote"}
        )

        assert action == "update"
        assert data["title"] == "Local"

    def test_conflict_resolution_remote_wins(self):
        """Test conflict resolution - remote wins."""
        engine = SyncEngine(ConflictResolution.REMOTE_WINS)
        record = engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        action, data = engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Local"},
            remote_data={"id": "1", "title": "Remote"}
        )

        assert action == "update"
        assert data["title"] == "Remote"

    def test_conflict_resolution_merge(self):
        """Test conflict resolution - merge."""
        engine = SyncEngine(ConflictResolution.MERGE)
        record = engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        action, data = engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Local", "status": "open"},
            remote_data={"id": "1", "title": "Remote", "priority": "high"}
        )

        assert action == "update"
        # Merged data - remote overrides local for same keys
        assert data["title"] == "Remote"
        assert data["priority"] == "high"

    def test_conflict_resolution_manual(self):
        """Test conflict resolution - manual."""
        engine = SyncEngine(ConflictResolution.MANUAL)
        record = engine.start_sync("int_1", SyncDirection.BIDIRECTIONAL)

        action, data = engine.sync_resource(
            record.id,
            "task",
            local_data={"id": "1", "title": "Local"},
            remote_data={"id": "1", "title": "Remote"}
        )

        assert action == "conflict"
        assert data is None

    def test_add_and_get_conflicts(self, sync_engine):
        """Test adding and getting conflicts."""
        conflict = SyncConflict(
            id="conflict_1",
            integration_id="int_1",
            resource_type="task",
            resource_id="task_1",
            local_data={"title": "Local"},
            remote_data={"title": "Remote"},
            local_modified_at=datetime.utcnow(),
            remote_modified_at=datetime.utcnow()
        )
        sync_engine.add_conflict(conflict)

        conflicts = sync_engine.get_conflicts("int_1")
        assert len(conflicts) == 1
        assert conflicts[0].id == "conflict_1"

    def test_resolve_conflict(self, sync_engine):
        """Test resolving a conflict."""
        conflict = SyncConflict(
            id="conflict_1",
            integration_id="int_1",
            resource_type="task",
            resource_id="task_1",
            local_data={"title": "Local"},
            remote_data={"title": "Remote"},
            local_modified_at=datetime.utcnow(),
            remote_modified_at=datetime.utcnow()
        )
        sync_engine.add_conflict(conflict)

        result = sync_engine.resolve_conflict(
            "conflict_1",
            ConflictResolution.LOCAL_WINS
        )

        assert result is True
        assert conflict.resolved_at is not None
        assert conflict.resolved_data["title"] == "Local"

    def test_register_mapping(self, sync_engine):
        """Test registering resource mapping."""
        mapping = ResourceMapping(
            resource_type="task",
            remote_type="issue",
            field_mappings=[
                FieldMapping(local_field="title", remote_field="summary"),
                FieldMapping(local_field="description", remote_field="body"),
            ]
        )
        sync_engine.register_mapping(mapping)

        retrieved = sync_engine.get_mapping("task")
        assert retrieved is not None
        assert retrieved.remote_type == "issue"

    def test_transform_to_local(self, sync_engine):
        """Test transforming remote data to local."""
        mapping = ResourceMapping(
            resource_type="task",
            remote_type="issue",
            field_mappings=[
                FieldMapping(local_field="title", remote_field="summary"),
                FieldMapping(local_field="desc", remote_field="body"),
            ]
        )
        sync_engine.register_mapping(mapping)

        remote_data = {"summary": "Bug", "body": "Fix it", "extra": "ignored"}
        local_data = sync_engine.transform_to_local("task", remote_data)

        assert local_data["title"] == "Bug"
        assert local_data["desc"] == "Fix it"
        assert "extra" not in local_data

    def test_transform_to_remote(self, sync_engine):
        """Test transforming local data to remote."""
        mapping = ResourceMapping(
            resource_type="task",
            remote_type="issue",
            field_mappings=[
                FieldMapping(local_field="title", remote_field="summary"),
                FieldMapping(local_field="desc", remote_field="body"),
            ]
        )
        sync_engine.register_mapping(mapping)

        local_data = {"title": "Bug", "desc": "Fix it", "local_only": "ignored"}
        remote_data = sync_engine.transform_to_remote("task", local_data)

        assert remote_data["summary"] == "Bug"
        assert remote_data["body"] == "Fix it"
        assert "local_only" not in remote_data

    def test_get_sync_history(self, sync_engine):
        """Test getting sync history."""
        sync_engine.start_sync("int_1", SyncDirection.INBOUND)
        sync_engine.start_sync("int_1", SyncDirection.OUTBOUND)
        sync_engine.start_sync("int_2", SyncDirection.BIDIRECTIONAL)

        history = sync_engine.get_sync_history("int_1")
        assert len(history) == 2


# ==================== SyncRecord Tests ====================

class TestSyncRecord:
    """Tests for SyncRecord."""

    def test_duration_seconds(self):
        """Test calculating duration."""
        record = SyncRecord(
            id="sync_1",
            integration_id="int_1",
            direction=SyncDirection.INBOUND,
            started_at=datetime.utcnow() - timedelta(seconds=30),
            completed_at=datetime.utcnow()
        )

        assert record.duration_seconds is not None
        assert 29 <= record.duration_seconds <= 31

    def test_duration_not_completed(self):
        """Test duration when not completed."""
        record = SyncRecord(
            id="sync_1",
            integration_id="int_1",
            direction=SyncDirection.INBOUND,
            started_at=datetime.utcnow()
        )

        assert record.duration_seconds is None


# ==================== WebhookReceiver Tests ====================

class TestWebhookReceiver:
    """Tests for WebhookReceiver."""

    def test_register_secret(self, webhook_receiver):
        """Test registering webhook secret."""
        webhook_receiver.register_secret("int_1", "secret123")
        # Secret is stored internally

    def test_verify_signature_sha256(self, webhook_receiver):
        """Test verifying SHA256 signature."""
        secret = "webhook_secret"
        webhook_receiver.register_secret("int_1", secret)

        payload = b'{"event": "test"}'
        expected_sig = hmac.new(
            secret.encode(),
            payload,
            hashlib.sha256
        ).hexdigest()

        result = webhook_receiver.verify_signature(
            "int_1", payload, expected_sig, "sha256"
        )
        assert result is True

    def test_verify_signature_with_prefix(self, webhook_receiver):
        """Test verifying signature with prefix."""
        secret = "webhook_secret"
        webhook_receiver.register_secret("int_1", secret)

        payload = b'{"event": "test"}'
        sig = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
        prefixed_sig = f"sha256={sig}"

        result = webhook_receiver.verify_signature(
            "int_1", payload, prefixed_sig, "sha256"
        )
        assert result is True

    def test_verify_signature_invalid(self, webhook_receiver):
        """Test verifying invalid signature."""
        webhook_receiver.register_secret("int_1", "secret123")

        result = webhook_receiver.verify_signature(
            "int_1", b'payload', "invalid_sig", "sha256"
        )
        assert result is False

    def test_receive_event(self, webhook_receiver):
        """Test receiving webhook event."""
        event = webhook_receiver.receive_event(
            "int_1",
            WebhookEventType.CREATED,
            {"action": "created", "data": {"id": "123"}}
        )

        assert event.id is not None
        assert event.integration_id == "int_1"
        assert event.event_type == WebhookEventType.CREATED
        assert event.processed is False

    def test_process_event(self, webhook_receiver):
        """Test processing webhook event."""
        events_received = []

        def handler(event):
            events_received.append(event)

        webhook_receiver.register_handler("int_1", handler)
        event = webhook_receiver.receive_event(
            "int_1",
            WebhookEventType.UPDATED,
            {"data": "test"}
        )

        result = webhook_receiver.process_event(event.id)

        assert result is True
        assert event.processed is True
        assert len(events_received) == 1

    def test_get_pending_events(self, webhook_receiver):
        """Test getting pending events."""
        webhook_receiver.receive_event("int_1", WebhookEventType.CREATED, {})
        webhook_receiver.receive_event("int_1", WebhookEventType.UPDATED, {})

        pending = webhook_receiver.get_pending_events()
        assert len(pending) == 2

    def test_get_pending_events_by_integration(self, webhook_receiver):
        """Test getting pending events by integration."""
        webhook_receiver.receive_event("int_1", WebhookEventType.CREATED, {})
        webhook_receiver.receive_event("int_2", WebhookEventType.UPDATED, {})

        pending = webhook_receiver.get_pending_events("int_1")
        assert len(pending) == 1

    def test_parse_github_event_type(self, webhook_receiver):
        """Test parsing GitHub event type."""
        event_type = webhook_receiver.parse_event_type(
            IntegrationType.GITHUB,
            {"action": "opened"}
        )
        assert event_type == WebhookEventType.CREATED

        event_type = webhook_receiver.parse_event_type(
            IntegrationType.GITHUB,
            {"action": "closed"}
        )
        assert event_type == WebhookEventType.DELETED

    def test_parse_slack_event_type(self, webhook_receiver):
        """Test parsing Slack event type."""
        event_type = webhook_receiver.parse_event_type(
            IntegrationType.SLACK,
            {"type": "message"}
        )
        assert event_type == WebhookEventType.CREATED

    def test_parse_jira_event_type(self, webhook_receiver):
        """Test parsing Jira event type."""
        event_type = webhook_receiver.parse_event_type(
            IntegrationType.JIRA,
            {"webhookEvent": "jira:issue_created"}
        )
        assert event_type == WebhookEventType.CREATED


# ==================== IntegrationManager Tests ====================

class TestIntegrationManager:
    """Tests for IntegrationManager."""

    def test_create_integration(self, manager):
        """Test creating integration via manager."""
        integration = manager.create_integration(
            workspace_id="ws_1",
            integration_type=IntegrationType.SLACK,
            name="Slack"
        )

        assert integration.id is not None
        assert integration.config.type == IntegrationType.SLACK

    def test_connect_and_disconnect(self, manager):
        """Test connecting and disconnecting via manager."""
        integration = manager.create_integration(
            workspace_id="ws_1",
            integration_type=IntegrationType.SLACK,
            name="Slack"
        )

        result = manager.connect(integration.id, {"access_token": "token"})
        assert result is True
        assert integration.status == IntegrationStatus.ACTIVE

        result = manager.disconnect(integration.id)
        assert result is True
        assert integration.status == IntegrationStatus.INACTIVE

    def test_sync(self, manager):
        """Test sync via manager."""
        integration = manager.create_integration(
            workspace_id="ws_1",
            integration_type=IntegrationType.SLACK,
            name="Slack"
        )
        manager.connect(integration.id, {"access_token": "token"})

        record = manager.sync(integration.id)

        assert record is not None
        assert record.status in [SyncStatus.COMPLETED, SyncStatus.FAILED]

    def test_handle_webhook(self, manager):
        """Test handling webhook via manager."""
        integration = manager.create_integration(
            workspace_id="ws_1",
            integration_type=IntegrationType.GITHUB,
            name="GitHub"
        )

        event = manager.handle_webhook(
            integration.id,
            {"action": "opened", "issue": {"title": "Bug"}}
        )

        assert event is not None
        assert event.event_type == WebhookEventType.CREATED

    def test_on_event(self, manager):
        """Test event handling via manager."""
        events_received = []

        def handler(event):
            events_received.append(event)

        manager.on_event("webhook:github", handler)

        integration = manager.create_integration(
            workspace_id="ws_1",
            integration_type=IntegrationType.GITHUB,
            name="GitHub"
        )

        manager.handle_webhook(integration.id, {"action": "opened"})

        assert len(events_received) == 1

    def test_list_integrations(self, manager):
        """Test listing integrations."""
        manager.create_integration("ws_1", IntegrationType.SLACK, "Slack")
        manager.create_integration("ws_1", IntegrationType.GITHUB, "GitHub")
        manager.create_integration("ws_2", IntegrationType.JIRA, "Jira")

        integrations = manager.list_integrations("ws_1")
        assert len(integrations) == 2

    def test_get_stats(self, manager):
        """Test getting manager stats."""
        manager.create_integration("ws_1", IntegrationType.SLACK, "Slack")

        stats = manager.get_stats()
        assert stats["total_integrations"] == 1
        assert "pending_webhooks" in stats
        assert "unresolved_conflicts" in stats


# ==================== Global Functions Tests ====================

class TestGlobalFunctions:
    """Tests for global functions."""

    def test_get_set_reset_integration_manager(self, manager):
        """Test global integration manager management."""
        reset_integration_manager()
        assert get_integration_manager() is None

        set_integration_manager(manager)
        assert get_integration_manager() is manager

        reset_integration_manager()
        assert get_integration_manager() is None


# ==================== AuthType Tests ====================

class TestAuthType:
    """Tests for AuthType enum."""

    def test_all_auth_types(self):
        """Test all auth types exist."""
        assert AuthType.NONE.value == "none"
        assert AuthType.API_KEY.value == "api_key"
        assert AuthType.OAUTH2.value == "oauth2"
        assert AuthType.BASIC.value == "basic"
        assert AuthType.BEARER.value == "bearer"
        assert AuthType.WEBHOOK_SECRET.value == "webhook_secret"


# ==================== IntegrationType Tests ====================

class TestIntegrationType:
    """Tests for IntegrationType enum."""

    def test_all_integration_types(self):
        """Test all integration types exist."""
        assert IntegrationType.SLACK.value == "slack"
        assert IntegrationType.GITHUB.value == "github"
        assert IntegrationType.JIRA.value == "jira"
        assert IntegrationType.TEAMS.value == "teams"
        assert IntegrationType.GOOGLE_DRIVE.value == "google_drive"
        assert IntegrationType.DROPBOX.value == "dropbox"
        assert IntegrationType.NOTION.value == "notion"
        assert IntegrationType.TRELLO.value == "trello"
        assert IntegrationType.ASANA.value == "asana"
        assert IntegrationType.WEBHOOK.value == "webhook"
        assert IntegrationType.CUSTOM.value == "custom"


# ==================== Edge Cases ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_connect_nonexistent_integration(self, registry):
        """Test connecting nonexistent integration."""
        result = registry.connect_integration("nonexistent", {})
        assert result is False

    def test_disconnect_nonexistent_integration(self, registry):
        """Test disconnecting nonexistent integration."""
        result = registry.disconnect_integration("nonexistent")
        assert result is False

    def test_delete_nonexistent_integration(self, registry):
        """Test deleting nonexistent integration."""
        result = registry.delete_integration("nonexistent")
        assert result is False

    def test_get_connector_not_connected(self, registry, slack_config):
        """Test getting connector when not connected."""
        integration = registry.register_integration("ws_1", slack_config)
        connector = registry.get_connector(integration.id)
        assert connector is None

    def test_sync_not_connected(self, manager):
        """Test syncing when not connected."""
        integration = manager.create_integration(
            "ws_1", IntegrationType.SLACK, "Slack"
        )

        with pytest.raises(ValueError):
            manager.sync(integration.id)

    def test_verify_signature_no_secret(self, webhook_receiver):
        """Test verifying signature without secret."""
        result = webhook_receiver.verify_signature(
            "unknown_int", b"payload", "sig", "sha256"
        )
        assert result is False

    def test_process_already_processed_event(self, webhook_receiver):
        """Test processing already processed event."""
        event = webhook_receiver.receive_event(
            "int_1", WebhookEventType.CREATED, {}
        )
        webhook_receiver.process_event(event.id)

        result = webhook_receiver.process_event(event.id)
        assert result is False

    def test_resolve_nonexistent_conflict(self, sync_engine):
        """Test resolving nonexistent conflict."""
        result = sync_engine.resolve_conflict(
            "nonexistent", ConflictResolution.LOCAL_WINS
        )
        assert result is False

    def test_complete_nonexistent_sync(self, sync_engine):
        """Test completing nonexistent sync."""
        result = sync_engine.complete_sync("nonexistent")
        assert result is None
