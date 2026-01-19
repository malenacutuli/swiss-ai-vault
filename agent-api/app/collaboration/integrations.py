"""
Integration Hub Module

Implements external service integration with:
- Integration registry and lifecycle management
- OAuth and credential management
- Bidirectional sync engine
- Inbound webhook processing
- Service adapters (Slack, GitHub, Jira, etc.)
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Type
from abc import ABC, abstractmethod
import hashlib
import hmac
import json
import re
import time
import base64
import secrets
from collections import defaultdict


# ==================== Enums ====================

class IntegrationType(Enum):
    """Types of integrations."""
    SLACK = "slack"
    GITHUB = "github"
    JIRA = "jira"
    TEAMS = "teams"
    GOOGLE_DRIVE = "google_drive"
    DROPBOX = "dropbox"
    NOTION = "notion"
    TRELLO = "trello"
    ASANA = "asana"
    WEBHOOK = "webhook"
    CUSTOM = "custom"


class IntegrationStatus(Enum):
    """Integration status."""
    INACTIVE = "inactive"
    CONNECTING = "connecting"
    ACTIVE = "active"
    ERROR = "error"
    SUSPENDED = "suspended"
    EXPIRED = "expired"


class AuthType(Enum):
    """Authentication types."""
    NONE = "none"
    API_KEY = "api_key"
    OAUTH2 = "oauth2"
    BASIC = "basic"
    BEARER = "bearer"
    WEBHOOK_SECRET = "webhook_secret"


class SyncDirection(Enum):
    """Sync direction."""
    INBOUND = "inbound"
    OUTBOUND = "outbound"
    BIDIRECTIONAL = "bidirectional"


class SyncStatus(Enum):
    """Sync operation status."""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    PARTIAL = "partial"


class ConflictResolution(Enum):
    """Conflict resolution strategies."""
    LOCAL_WINS = "local_wins"
    REMOTE_WINS = "remote_wins"
    NEWEST_WINS = "newest_wins"
    MANUAL = "manual"
    MERGE = "merge"


class WebhookEventType(Enum):
    """Webhook event types."""
    CREATED = "created"
    UPDATED = "updated"
    DELETED = "deleted"
    COMMENTED = "commented"
    ASSIGNED = "assigned"
    MENTIONED = "mentioned"
    STATUS_CHANGED = "status_changed"
    CUSTOM = "custom"


# ==================== Data Classes ====================

@dataclass
class Credential:
    """Stored credential for an integration."""
    id: str
    integration_id: str
    auth_type: AuthType
    encrypted_data: str  # Base64 encoded encrypted data
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    refresh_token: Optional[str] = None
    scopes: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """Check if credential is expired."""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at


@dataclass
class OAuthConfig:
    """OAuth configuration."""
    client_id: str
    client_secret: str
    auth_url: str
    token_url: str
    redirect_uri: str
    scopes: List[str] = field(default_factory=list)
    extra_params: Dict[str, str] = field(default_factory=dict)


@dataclass
class IntegrationConfig:
    """Configuration for an integration."""
    type: IntegrationType
    name: str
    auth_type: AuthType
    base_url: str = ""
    oauth_config: Optional[OAuthConfig] = None
    webhook_secret: Optional[str] = None
    rate_limit: int = 100  # Requests per minute
    timeout: int = 30  # Seconds
    retry_count: int = 3
    features: Set[str] = field(default_factory=set)
    field_mappings: Dict[str, str] = field(default_factory=dict)


@dataclass
class Integration:
    """An integration instance."""
    id: str
    config: IntegrationConfig
    workspace_id: str
    status: IntegrationStatus = IntegrationStatus.INACTIVE
    credential_id: Optional[str] = None
    connected_at: Optional[datetime] = None
    last_sync_at: Optional[datetime] = None
    error_message: Optional[str] = None
    sync_direction: SyncDirection = SyncDirection.BIDIRECTIONAL
    enabled_events: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "type": self.config.type.value,
            "name": self.config.name,
            "workspace_id": self.workspace_id,
            "status": self.status.value,
            "connected_at": self.connected_at.isoformat() if self.connected_at else None,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "sync_direction": self.sync_direction.value,
        }


@dataclass
class SyncRecord:
    """Record of a sync operation."""
    id: str
    integration_id: str
    direction: SyncDirection
    status: SyncStatus = SyncStatus.PENDING
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    items_processed: int = 0
    items_created: int = 0
    items_updated: int = 0
    items_deleted: int = 0
    items_failed: int = 0
    errors: List[str] = field(default_factory=list)
    cursor: Optional[str] = None  # For pagination/incremental sync

    @property
    def duration_seconds(self) -> Optional[float]:
        """Get sync duration in seconds."""
        if self.started_at and self.completed_at:
            return (self.completed_at - self.started_at).total_seconds()
        return None


@dataclass
class SyncConflict:
    """A sync conflict requiring resolution."""
    id: str
    integration_id: str
    resource_type: str
    resource_id: str
    local_data: Dict[str, Any]
    remote_data: Dict[str, Any]
    local_modified_at: datetime
    remote_modified_at: datetime
    resolution: Optional[ConflictResolution] = None
    resolved_data: Optional[Dict[str, Any]] = None
    resolved_at: Optional[datetime] = None


@dataclass
class WebhookEvent:
    """An inbound webhook event."""
    id: str
    integration_id: str
    event_type: WebhookEventType
    payload: Dict[str, Any]
    received_at: datetime = field(default_factory=datetime.utcnow)
    processed: bool = False
    processed_at: Optional[datetime] = None
    signature: Optional[str] = None
    source_ip: Optional[str] = None


@dataclass
class FieldMapping:
    """Mapping between local and remote fields."""
    local_field: str
    remote_field: str
    transform: Optional[Callable[[Any], Any]] = None
    reverse_transform: Optional[Callable[[Any], Any]] = None
    required: bool = False


@dataclass
class ResourceMapping:
    """Mapping for a resource type."""
    resource_type: str
    remote_type: str
    field_mappings: List[FieldMapping] = field(default_factory=list)
    sync_direction: SyncDirection = SyncDirection.BIDIRECTIONAL
    filter_func: Optional[Callable[[Dict], bool]] = None


# ==================== Credential Manager ====================

class CredentialManager:
    """Manages credentials for integrations."""

    _counter: int = 0

    def __init__(self, encryption_key: Optional[str] = None):
        self._encryption_key = encryption_key or secrets.token_hex(32)
        self._credentials: Dict[str, Credential] = {}

    def store_credential(
        self,
        integration_id: str,
        auth_type: AuthType,
        data: Dict[str, Any],
        expires_at: Optional[datetime] = None,
        scopes: Optional[Set[str]] = None
    ) -> Credential:
        """Store a credential."""
        CredentialManager._counter += 1
        credential_id = f"cred_{integration_id}_{int(time.time() * 1000)}_{CredentialManager._counter}"

        # Encrypt the data
        encrypted = self._encrypt(json.dumps(data))

        credential = Credential(
            id=credential_id,
            integration_id=integration_id,
            auth_type=auth_type,
            encrypted_data=encrypted,
            expires_at=expires_at,
            scopes=scopes or set()
        )

        self._credentials[credential_id] = credential
        return credential

    def get_credential(self, credential_id: str) -> Optional[Credential]:
        """Get a credential by ID."""
        return self._credentials.get(credential_id)

    def get_credential_data(self, credential_id: str) -> Optional[Dict[str, Any]]:
        """Get decrypted credential data."""
        credential = self._credentials.get(credential_id)
        if not credential:
            return None

        decrypted = self._decrypt(credential.encrypted_data)
        return json.loads(decrypted)

    def update_credential(
        self,
        credential_id: str,
        data: Dict[str, Any],
        expires_at: Optional[datetime] = None
    ) -> bool:
        """Update a credential."""
        credential = self._credentials.get(credential_id)
        if not credential:
            return False

        credential.encrypted_data = self._encrypt(json.dumps(data))
        if expires_at:
            credential.expires_at = expires_at

        return True

    def delete_credential(self, credential_id: str) -> bool:
        """Delete a credential."""
        if credential_id in self._credentials:
            del self._credentials[credential_id]
            return True
        return False

    def refresh_oauth_token(
        self,
        credential_id: str,
        new_access_token: str,
        new_refresh_token: Optional[str] = None,
        expires_in: Optional[int] = None
    ) -> bool:
        """Refresh an OAuth token."""
        credential = self._credentials.get(credential_id)
        if not credential or credential.auth_type != AuthType.OAUTH2:
            return False

        data = self.get_credential_data(credential_id) or {}
        data["access_token"] = new_access_token
        if new_refresh_token:
            data["refresh_token"] = new_refresh_token

        expires_at = None
        if expires_in:
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

        return self.update_credential(credential_id, data, expires_at)

    def _encrypt(self, data: str) -> str:
        """Encrypt data (simplified - use proper encryption in production)."""
        # In production, use proper encryption like Fernet
        encoded = base64.b64encode(data.encode()).decode()
        return encoded

    def _decrypt(self, encrypted: str) -> str:
        """Decrypt data (simplified - use proper encryption in production)."""
        decoded = base64.b64decode(encrypted.encode()).decode()
        return decoded


# ==================== Integration Connector (Abstract) ====================

class IntegrationConnector(ABC):
    """Base class for integration connectors."""

    def __init__(
        self,
        integration: Integration,
        credential_manager: CredentialManager
    ):
        self.integration = integration
        self.credential_manager = credential_manager
        self._rate_limit_remaining = integration.config.rate_limit
        self._rate_limit_reset = datetime.utcnow()

    @abstractmethod
    def connect(self) -> bool:
        """Establish connection to the service."""
        pass

    @abstractmethod
    def disconnect(self) -> bool:
        """Disconnect from the service."""
        pass

    @abstractmethod
    def test_connection(self) -> bool:
        """Test if connection is valid."""
        pass

    @abstractmethod
    def fetch_resources(
        self,
        resource_type: str,
        cursor: Optional[str] = None,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Fetch resources from the service."""
        pass

    @abstractmethod
    def create_resource(
        self,
        resource_type: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create a resource in the service."""
        pass

    @abstractmethod
    def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a resource in the service."""
        pass

    @abstractmethod
    def delete_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> bool:
        """Delete a resource from the service."""
        pass

    def get_auth_headers(self) -> Dict[str, str]:
        """Get authentication headers."""
        if not self.integration.credential_id:
            return {}

        cred_data = self.credential_manager.get_credential_data(
            self.integration.credential_id
        )
        if not cred_data:
            return {}

        auth_type = self.integration.config.auth_type

        if auth_type == AuthType.BEARER:
            return {"Authorization": f"Bearer {cred_data.get('token', '')}"}
        elif auth_type == AuthType.API_KEY:
            key_header = cred_data.get("header_name", "X-API-Key")
            return {key_header: cred_data.get("api_key", "")}
        elif auth_type == AuthType.OAUTH2:
            return {"Authorization": f"Bearer {cred_data.get('access_token', '')}"}
        elif auth_type == AuthType.BASIC:
            credentials = f"{cred_data.get('username', '')}:{cred_data.get('password', '')}"
            encoded = base64.b64encode(credentials.encode()).decode()
            return {"Authorization": f"Basic {encoded}"}

        return {}

    def check_rate_limit(self) -> bool:
        """Check if rate limit allows request."""
        now = datetime.utcnow()
        if now >= self._rate_limit_reset:
            self._rate_limit_remaining = self.integration.config.rate_limit
            self._rate_limit_reset = now + timedelta(minutes=1)

        if self._rate_limit_remaining <= 0:
            return False

        self._rate_limit_remaining -= 1
        return True


# ==================== Service Connectors ====================

class SlackConnector(IntegrationConnector):
    """Connector for Slack integration."""

    def connect(self) -> bool:
        """Connect to Slack."""
        if not self.test_connection():
            return False
        self.integration.status = IntegrationStatus.ACTIVE
        self.integration.connected_at = datetime.utcnow()
        return True

    def disconnect(self) -> bool:
        """Disconnect from Slack."""
        self.integration.status = IntegrationStatus.INACTIVE
        return True

    def test_connection(self) -> bool:
        """Test Slack connection."""
        # In real implementation, call Slack API auth.test
        return self.integration.credential_id is not None

    def fetch_resources(
        self,
        resource_type: str,
        cursor: Optional[str] = None,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Fetch Slack resources."""
        # Simulated - real implementation would call Slack API
        if resource_type == "channels":
            return [
                {"id": "C123", "name": "general", "is_private": False},
                {"id": "C456", "name": "random", "is_private": False},
            ], None
        elif resource_type == "users":
            return [
                {"id": "U123", "name": "alice", "real_name": "Alice Smith"},
            ], None
        return [], None

    def create_resource(
        self,
        resource_type: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create Slack resource."""
        if resource_type == "message":
            return {
                "ok": True,
                "channel": data.get("channel"),
                "ts": str(time.time()),
                "message": {"text": data.get("text")}
            }
        return None

    def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update Slack resource."""
        if resource_type == "message":
            return {
                "ok": True,
                "channel": data.get("channel"),
                "ts": resource_id,
                "message": {"text": data.get("text")}
            }
        return None

    def delete_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> bool:
        """Delete Slack resource."""
        return True

    def send_message(
        self,
        channel: str,
        text: str,
        attachments: Optional[List[Dict]] = None
    ) -> Optional[Dict[str, Any]]:
        """Send a message to Slack channel."""
        data = {"channel": channel, "text": text}
        if attachments:
            data["attachments"] = attachments
        return self.create_resource("message", data)


class GitHubConnector(IntegrationConnector):
    """Connector for GitHub integration."""

    def connect(self) -> bool:
        """Connect to GitHub."""
        if not self.test_connection():
            return False
        self.integration.status = IntegrationStatus.ACTIVE
        self.integration.connected_at = datetime.utcnow()
        return True

    def disconnect(self) -> bool:
        """Disconnect from GitHub."""
        self.integration.status = IntegrationStatus.INACTIVE
        return True

    def test_connection(self) -> bool:
        """Test GitHub connection."""
        return self.integration.credential_id is not None

    def fetch_resources(
        self,
        resource_type: str,
        cursor: Optional[str] = None,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Fetch GitHub resources."""
        if resource_type == "repositories":
            return [
                {"id": 1, "name": "my-repo", "full_name": "user/my-repo"},
            ], None
        elif resource_type == "issues":
            return [
                {"id": 1, "number": 1, "title": "Bug fix", "state": "open"},
            ], None
        return [], None

    def create_resource(
        self,
        resource_type: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create GitHub resource."""
        if resource_type == "issue":
            return {
                "id": int(time.time()),
                "number": 1,
                "title": data.get("title"),
                "body": data.get("body"),
                "state": "open"
            }
        return None

    def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update GitHub resource."""
        return {"id": resource_id, **data}

    def delete_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> bool:
        """Delete GitHub resource."""
        return True


class JiraConnector(IntegrationConnector):
    """Connector for Jira integration."""

    def connect(self) -> bool:
        """Connect to Jira."""
        if not self.test_connection():
            return False
        self.integration.status = IntegrationStatus.ACTIVE
        self.integration.connected_at = datetime.utcnow()
        return True

    def disconnect(self) -> bool:
        """Disconnect from Jira."""
        self.integration.status = IntegrationStatus.INACTIVE
        return True

    def test_connection(self) -> bool:
        """Test Jira connection."""
        return self.integration.credential_id is not None

    def fetch_resources(
        self,
        resource_type: str,
        cursor: Optional[str] = None,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Fetch Jira resources."""
        if resource_type == "projects":
            return [
                {"id": "10000", "key": "PROJ", "name": "My Project"},
            ], None
        elif resource_type == "issues":
            return [
                {"id": "10001", "key": "PROJ-1", "summary": "Task", "status": "To Do"},
            ], None
        return [], None

    def create_resource(
        self,
        resource_type: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Create Jira resource."""
        if resource_type == "issue":
            return {
                "id": str(int(time.time())),
                "key": f"{data.get('project', 'PROJ')}-{int(time.time()) % 1000}",
                "self": f"https://jira.example.com/rest/api/2/issue/{int(time.time())}"
            }
        return None

    def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update Jira resource."""
        return {"id": resource_id, **data}

    def delete_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> bool:
        """Delete Jira resource."""
        return True


class GenericWebhookConnector(IntegrationConnector):
    """Connector for generic webhook integration."""

    def connect(self) -> bool:
        """Connect webhook."""
        self.integration.status = IntegrationStatus.ACTIVE
        self.integration.connected_at = datetime.utcnow()
        return True

    def disconnect(self) -> bool:
        """Disconnect webhook."""
        self.integration.status = IntegrationStatus.INACTIVE
        return True

    def test_connection(self) -> bool:
        """Test webhook connection."""
        return True

    def fetch_resources(
        self,
        resource_type: str,
        cursor: Optional[str] = None,
        limit: int = 100
    ) -> Tuple[List[Dict[str, Any]], Optional[str]]:
        """Webhooks don't fetch resources."""
        return [], None

    def create_resource(
        self,
        resource_type: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Send webhook."""
        return {"sent": True, "data": data}

    def update_resource(
        self,
        resource_type: str,
        resource_id: str,
        data: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update via webhook."""
        return {"sent": True, "data": data}

    def delete_resource(
        self,
        resource_type: str,
        resource_id: str
    ) -> bool:
        """Delete via webhook."""
        return True


# ==================== Connector Factory ====================

class ConnectorFactory:
    """Factory for creating integration connectors."""

    _connectors: Dict[IntegrationType, Type[IntegrationConnector]] = {
        IntegrationType.SLACK: SlackConnector,
        IntegrationType.GITHUB: GitHubConnector,
        IntegrationType.JIRA: JiraConnector,
        IntegrationType.WEBHOOK: GenericWebhookConnector,
    }

    @classmethod
    def register(
        cls,
        integration_type: IntegrationType,
        connector_class: Type[IntegrationConnector]
    ) -> None:
        """Register a connector for an integration type."""
        cls._connectors[integration_type] = connector_class

    @classmethod
    def create(
        cls,
        integration: Integration,
        credential_manager: CredentialManager
    ) -> Optional[IntegrationConnector]:
        """Create a connector for an integration."""
        connector_class = cls._connectors.get(integration.config.type)
        if not connector_class:
            # Fall back to generic webhook for unknown types
            connector_class = GenericWebhookConnector

        return connector_class(integration, credential_manager)


# ==================== Sync Engine ====================

class SyncEngine:
    """Engine for synchronizing data between systems."""

    _counter: int = 0

    def __init__(
        self,
        conflict_resolution: ConflictResolution = ConflictResolution.NEWEST_WINS
    ):
        self.conflict_resolution = conflict_resolution
        self._sync_records: Dict[str, SyncRecord] = {}
        self._conflicts: Dict[str, SyncConflict] = {}
        self._resource_mappings: Dict[str, ResourceMapping] = {}
        self._local_store: Dict[str, Dict[str, Dict]] = defaultdict(dict)  # type -> id -> data

    def register_mapping(self, mapping: ResourceMapping) -> None:
        """Register a resource mapping."""
        self._resource_mappings[mapping.resource_type] = mapping

    def get_mapping(self, resource_type: str) -> Optional[ResourceMapping]:
        """Get mapping for a resource type."""
        return self._resource_mappings.get(resource_type)

    def start_sync(
        self,
        integration_id: str,
        direction: SyncDirection
    ) -> SyncRecord:
        """Start a sync operation."""
        SyncEngine._counter += 1
        sync_id = f"sync_{integration_id}_{int(time.time() * 1000)}_{SyncEngine._counter}"
        record = SyncRecord(
            id=sync_id,
            integration_id=integration_id,
            direction=direction,
            status=SyncStatus.IN_PROGRESS,
            started_at=datetime.utcnow()
        )
        self._sync_records[sync_id] = record
        return record

    def complete_sync(
        self,
        sync_id: str,
        status: SyncStatus = SyncStatus.COMPLETED
    ) -> Optional[SyncRecord]:
        """Complete a sync operation."""
        record = self._sync_records.get(sync_id)
        if not record:
            return None

        record.status = status
        record.completed_at = datetime.utcnow()
        return record

    def sync_resource(
        self,
        sync_id: str,
        resource_type: str,
        local_data: Optional[Dict[str, Any]],
        remote_data: Optional[Dict[str, Any]],
        local_modified: Optional[datetime] = None,
        remote_modified: Optional[datetime] = None
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        Sync a single resource.
        Returns: (action, resolved_data) where action is 'create', 'update', 'delete', 'conflict', 'skip'
        """
        record = self._sync_records.get(sync_id)
        if record:
            record.items_processed += 1

        # No local, has remote -> create locally
        if local_data is None and remote_data is not None:
            if record:
                record.items_created += 1
            return ("create", remote_data)

        # Has local, no remote -> delete locally (or create remotely)
        if local_data is not None and remote_data is None:
            if record:
                record.items_deleted += 1
            return ("delete", None)

        # Both exist -> check for conflict
        if local_data and remote_data:
            # Check if they're the same
            if self._data_equal(local_data, remote_data):
                return ("skip", local_data)

            # Resolve conflict
            resolved = self._resolve_conflict(
                resource_type,
                local_data,
                remote_data,
                local_modified,
                remote_modified
            )

            if resolved is None:
                # Manual resolution needed
                return ("conflict", None)

            if record:
                record.items_updated += 1
            return ("update", resolved)

        return ("skip", local_data)

    def _data_equal(self, data1: Dict, data2: Dict) -> bool:
        """Check if two data dictionaries are equal (ignoring metadata)."""
        # Simple comparison - could be more sophisticated
        keys_to_compare = set(data1.keys()) | set(data2.keys())
        keys_to_compare -= {"_sync_metadata", "_last_modified", "updated_at"}

        for key in keys_to_compare:
            if data1.get(key) != data2.get(key):
                return False
        return True

    def _resolve_conflict(
        self,
        resource_type: str,
        local_data: Dict[str, Any],
        remote_data: Dict[str, Any],
        local_modified: Optional[datetime],
        remote_modified: Optional[datetime]
    ) -> Optional[Dict[str, Any]]:
        """Resolve a conflict between local and remote data."""
        if self.conflict_resolution == ConflictResolution.LOCAL_WINS:
            return local_data

        if self.conflict_resolution == ConflictResolution.REMOTE_WINS:
            return remote_data

        if self.conflict_resolution == ConflictResolution.NEWEST_WINS:
            if local_modified and remote_modified:
                if local_modified >= remote_modified:
                    return local_data
                return remote_data
            # Default to remote if no timestamps
            return remote_data

        if self.conflict_resolution == ConflictResolution.MERGE:
            # Simple merge - remote values override local
            merged = {**local_data, **remote_data}
            return merged

        # Manual resolution
        return None

    def add_conflict(self, conflict: SyncConflict) -> None:
        """Add a conflict for manual resolution."""
        self._conflicts[conflict.id] = conflict

    def get_conflicts(
        self,
        integration_id: Optional[str] = None
    ) -> List[SyncConflict]:
        """Get unresolved conflicts."""
        conflicts = list(self._conflicts.values())
        if integration_id:
            conflicts = [c for c in conflicts if c.integration_id == integration_id]
        return [c for c in conflicts if c.resolved_at is None]

    def resolve_conflict(
        self,
        conflict_id: str,
        resolution: ConflictResolution,
        resolved_data: Optional[Dict[str, Any]] = None
    ) -> bool:
        """Resolve a conflict manually."""
        conflict = self._conflicts.get(conflict_id)
        if not conflict:
            return False

        conflict.resolution = resolution
        conflict.resolved_at = datetime.utcnow()

        if resolved_data:
            conflict.resolved_data = resolved_data
        elif resolution == ConflictResolution.LOCAL_WINS:
            conflict.resolved_data = conflict.local_data
        elif resolution == ConflictResolution.REMOTE_WINS:
            conflict.resolved_data = conflict.remote_data

        return True

    def get_sync_history(
        self,
        integration_id: str,
        limit: int = 10
    ) -> List[SyncRecord]:
        """Get sync history for an integration."""
        records = [
            r for r in self._sync_records.values()
            if r.integration_id == integration_id
        ]
        records.sort(key=lambda r: r.started_at or datetime.min, reverse=True)
        return records[:limit]

    def transform_to_local(
        self,
        resource_type: str,
        remote_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform remote data to local format."""
        mapping = self._resource_mappings.get(resource_type)
        if not mapping:
            return remote_data

        local_data = {}
        for field_mapping in mapping.field_mappings:
            remote_value = remote_data.get(field_mapping.remote_field)
            if remote_value is not None:
                if field_mapping.transform:
                    remote_value = field_mapping.transform(remote_value)
                local_data[field_mapping.local_field] = remote_value
            elif field_mapping.required:
                local_data[field_mapping.local_field] = None

        return local_data

    def transform_to_remote(
        self,
        resource_type: str,
        local_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Transform local data to remote format."""
        mapping = self._resource_mappings.get(resource_type)
        if not mapping:
            return local_data

        remote_data = {}
        for field_mapping in mapping.field_mappings:
            local_value = local_data.get(field_mapping.local_field)
            if local_value is not None:
                if field_mapping.reverse_transform:
                    local_value = field_mapping.reverse_transform(local_value)
                remote_data[field_mapping.remote_field] = local_value
            elif field_mapping.required:
                remote_data[field_mapping.remote_field] = None

        return remote_data


# ==================== Webhook Receiver ====================

class WebhookReceiver:
    """Receives and processes inbound webhooks."""

    _counter: int = 0

    def __init__(self):
        self._events: Dict[str, WebhookEvent] = {}
        self._handlers: Dict[str, List[Callable[[WebhookEvent], None]]] = defaultdict(list)
        self._secrets: Dict[str, str] = {}  # integration_id -> secret

    def register_secret(self, integration_id: str, secret: str) -> None:
        """Register a webhook secret for signature verification."""
        self._secrets[integration_id] = secret

    def register_handler(
        self,
        integration_id: str,
        handler: Callable[[WebhookEvent], None]
    ) -> None:
        """Register a handler for webhook events."""
        self._handlers[integration_id].append(handler)

    def verify_signature(
        self,
        integration_id: str,
        payload: bytes,
        signature: str,
        algorithm: str = "sha256"
    ) -> bool:
        """Verify webhook signature."""
        secret = self._secrets.get(integration_id)
        if not secret:
            return False

        if algorithm == "sha256":
            expected = hmac.new(
                secret.encode(),
                payload,
                hashlib.sha256
            ).hexdigest()
        elif algorithm == "sha1":
            expected = hmac.new(
                secret.encode(),
                payload,
                hashlib.sha1
            ).hexdigest()
        else:
            return False

        # Handle prefixed signatures (e.g., "sha256=...")
        if "=" in signature:
            signature = signature.split("=", 1)[1]

        return hmac.compare_digest(expected, signature)

    def receive_event(
        self,
        integration_id: str,
        event_type: WebhookEventType,
        payload: Dict[str, Any],
        signature: Optional[str] = None,
        source_ip: Optional[str] = None
    ) -> WebhookEvent:
        """Receive a webhook event."""
        WebhookReceiver._counter += 1
        event_id = f"evt_{integration_id}_{int(time.time() * 1000)}_{WebhookReceiver._counter}"

        event = WebhookEvent(
            id=event_id,
            integration_id=integration_id,
            event_type=event_type,
            payload=payload,
            signature=signature,
            source_ip=source_ip
        )

        self._events[event_id] = event
        return event

    def process_event(self, event_id: str) -> bool:
        """Process a webhook event."""
        event = self._events.get(event_id)
        if not event or event.processed:
            return False

        handlers = self._handlers.get(event.integration_id, [])
        for handler in handlers:
            try:
                handler(event)
            except Exception:
                pass  # Log error in production

        event.processed = True
        event.processed_at = datetime.utcnow()
        return True

    def get_pending_events(
        self,
        integration_id: Optional[str] = None
    ) -> List[WebhookEvent]:
        """Get unprocessed events."""
        events = [e for e in self._events.values() if not e.processed]
        if integration_id:
            events = [e for e in events if e.integration_id == integration_id]
        return sorted(events, key=lambda e: e.received_at)

    def get_event(self, event_id: str) -> Optional[WebhookEvent]:
        """Get an event by ID."""
        return self._events.get(event_id)

    def parse_event_type(
        self,
        integration_type: IntegrationType,
        payload: Dict[str, Any]
    ) -> WebhookEventType:
        """Parse event type from payload based on integration."""
        if integration_type == IntegrationType.GITHUB:
            action = payload.get("action", "")
            if action == "opened":
                return WebhookEventType.CREATED
            elif action == "closed":
                return WebhookEventType.DELETED
            elif action in ("edited", "updated"):
                return WebhookEventType.UPDATED
            elif action == "assigned":
                return WebhookEventType.ASSIGNED

        elif integration_type == IntegrationType.SLACK:
            event_type = payload.get("type", "")
            if event_type == "message":
                return WebhookEventType.CREATED
            elif event_type == "message_changed":
                return WebhookEventType.UPDATED
            elif event_type == "message_deleted":
                return WebhookEventType.DELETED
            elif "mention" in event_type:
                return WebhookEventType.MENTIONED

        elif integration_type == IntegrationType.JIRA:
            event_type = payload.get("webhookEvent", "")
            if "created" in event_type:
                return WebhookEventType.CREATED
            elif "updated" in event_type:
                return WebhookEventType.UPDATED
            elif "deleted" in event_type:
                return WebhookEventType.DELETED
            elif "comment" in event_type:
                return WebhookEventType.COMMENTED

        return WebhookEventType.CUSTOM


# ==================== Integration Registry ====================

class IntegrationRegistry:
    """Central registry for managing integrations."""

    _counter: int = 0

    def __init__(self, credential_manager: Optional[CredentialManager] = None):
        self.credential_manager = credential_manager or CredentialManager()
        self._integrations: Dict[str, Integration] = {}
        self._connectors: Dict[str, IntegrationConnector] = {}
        self._workspace_integrations: Dict[str, Set[str]] = defaultdict(set)

    def register_integration(
        self,
        workspace_id: str,
        config: IntegrationConfig
    ) -> Integration:
        """Register a new integration."""
        IntegrationRegistry._counter += 1
        integration_id = f"int_{config.type.value}_{workspace_id}_{int(time.time() * 1000)}_{IntegrationRegistry._counter}"

        integration = Integration(
            id=integration_id,
            config=config,
            workspace_id=workspace_id
        )

        self._integrations[integration_id] = integration
        self._workspace_integrations[workspace_id].add(integration_id)

        return integration

    def get_integration(self, integration_id: str) -> Optional[Integration]:
        """Get an integration by ID."""
        return self._integrations.get(integration_id)

    def get_workspace_integrations(
        self,
        workspace_id: str,
        status: Optional[IntegrationStatus] = None
    ) -> List[Integration]:
        """Get all integrations for a workspace."""
        integration_ids = self._workspace_integrations.get(workspace_id, set())
        integrations = [
            self._integrations[iid]
            for iid in integration_ids
            if iid in self._integrations
        ]

        if status:
            integrations = [i for i in integrations if i.status == status]

        return integrations

    def connect_integration(
        self,
        integration_id: str,
        credentials: Dict[str, Any]
    ) -> bool:
        """Connect an integration with credentials."""
        integration = self._integrations.get(integration_id)
        if not integration:
            return False

        integration.status = IntegrationStatus.CONNECTING

        # Store credentials
        credential = self.credential_manager.store_credential(
            integration_id=integration_id,
            auth_type=integration.config.auth_type,
            data=credentials
        )
        integration.credential_id = credential.id

        # Create and connect via connector
        connector = ConnectorFactory.create(integration, self.credential_manager)
        if not connector:
            integration.status = IntegrationStatus.ERROR
            integration.error_message = "Failed to create connector"
            return False

        if connector.connect():
            self._connectors[integration_id] = connector
            return True
        else:
            integration.status = IntegrationStatus.ERROR
            integration.error_message = "Connection failed"
            return False

    def disconnect_integration(self, integration_id: str) -> bool:
        """Disconnect an integration."""
        integration = self._integrations.get(integration_id)
        if not integration:
            return False

        connector = self._connectors.get(integration_id)
        if connector:
            connector.disconnect()
            del self._connectors[integration_id]

        if integration.credential_id:
            self.credential_manager.delete_credential(integration.credential_id)
            integration.credential_id = None

        integration.status = IntegrationStatus.INACTIVE
        integration.connected_at = None
        return True

    def delete_integration(self, integration_id: str) -> bool:
        """Delete an integration."""
        integration = self._integrations.get(integration_id)
        if not integration:
            return False

        # Disconnect first
        self.disconnect_integration(integration_id)

        # Remove from workspace
        self._workspace_integrations[integration.workspace_id].discard(integration_id)

        # Delete
        del self._integrations[integration_id]
        return True

    def get_connector(self, integration_id: str) -> Optional[IntegrationConnector]:
        """Get the connector for an integration."""
        return self._connectors.get(integration_id)

    def test_integration(self, integration_id: str) -> bool:
        """Test if an integration is working."""
        connector = self._connectors.get(integration_id)
        if not connector:
            return False
        return connector.test_connection()

    def get_stats(self) -> Dict[str, Any]:
        """Get registry statistics."""
        by_type = defaultdict(int)
        by_status = defaultdict(int)

        for integration in self._integrations.values():
            by_type[integration.config.type.value] += 1
            by_status[integration.status.value] += 1

        return {
            "total_integrations": len(self._integrations),
            "active_connections": len(self._connectors),
            "by_type": dict(by_type),
            "by_status": dict(by_status),
        }


# ==================== Integration Manager ====================

class IntegrationManager:
    """High-level manager for integrations."""

    def __init__(self, config: Optional[Dict[str, Any]] = None):
        self.config = config or {}
        self.registry = IntegrationRegistry()
        self.sync_engine = SyncEngine()
        self.webhook_receiver = WebhookReceiver()
        self._event_handlers: Dict[str, List[Callable]] = defaultdict(list)

    def create_integration(
        self,
        workspace_id: str,
        integration_type: IntegrationType,
        name: str,
        auth_type: AuthType = AuthType.OAUTH2,
        **kwargs
    ) -> Integration:
        """Create a new integration."""
        config = IntegrationConfig(
            type=integration_type,
            name=name,
            auth_type=auth_type,
            **kwargs
        )
        return self.registry.register_integration(workspace_id, config)

    def connect(
        self,
        integration_id: str,
        credentials: Dict[str, Any]
    ) -> bool:
        """Connect an integration."""
        return self.registry.connect_integration(integration_id, credentials)

    def disconnect(self, integration_id: str) -> bool:
        """Disconnect an integration."""
        return self.registry.disconnect_integration(integration_id)

    def sync(
        self,
        integration_id: str,
        resource_types: Optional[List[str]] = None,
        direction: SyncDirection = SyncDirection.BIDIRECTIONAL
    ) -> SyncRecord:
        """Perform a sync operation."""
        integration = self.registry.get_integration(integration_id)
        if not integration:
            raise ValueError(f"Integration not found: {integration_id}")

        connector = self.registry.get_connector(integration_id)
        if not connector:
            raise ValueError(f"Integration not connected: {integration_id}")

        # Start sync
        sync_record = self.sync_engine.start_sync(integration_id, direction)

        try:
            resource_types = resource_types or ["default"]

            for resource_type in resource_types:
                cursor = None
                while True:
                    # Fetch remote resources
                    remote_resources, next_cursor = connector.fetch_resources(
                        resource_type,
                        cursor=cursor
                    )

                    for remote in remote_resources:
                        # Transform and sync
                        local = self.sync_engine.transform_to_local(
                            resource_type, remote
                        )
                        action, resolved = self.sync_engine.sync_resource(
                            sync_record.id,
                            resource_type,
                            local_data=None,  # Would get from local store
                            remote_data=local
                        )

                    if not next_cursor:
                        break
                    cursor = next_cursor

            integration.last_sync_at = datetime.utcnow()
            self.sync_engine.complete_sync(sync_record.id, SyncStatus.COMPLETED)

        except Exception as e:
            sync_record.errors.append(str(e))
            self.sync_engine.complete_sync(sync_record.id, SyncStatus.FAILED)

        return sync_record

    def handle_webhook(
        self,
        integration_id: str,
        payload: Dict[str, Any],
        signature: Optional[str] = None
    ) -> Optional[WebhookEvent]:
        """Handle an incoming webhook."""
        integration = self.registry.get_integration(integration_id)
        if not integration:
            return None

        # Verify signature if secret is configured
        if integration.config.webhook_secret and signature:
            payload_bytes = json.dumps(payload).encode()
            if not self.webhook_receiver.verify_signature(
                integration_id, payload_bytes, signature
            ):
                return None

        # Parse event type
        event_type = self.webhook_receiver.parse_event_type(
            integration.config.type, payload
        )

        # Receive event
        event = self.webhook_receiver.receive_event(
            integration_id, event_type, payload, signature
        )

        # Process event
        self.webhook_receiver.process_event(event.id)

        # Emit internal event
        self._emit_event(f"webhook:{integration.config.type.value}", event)

        return event

    def on_event(
        self,
        event_name: str,
        handler: Callable
    ) -> None:
        """Register an event handler."""
        self._event_handlers[event_name].append(handler)

    def _emit_event(self, event_name: str, data: Any) -> None:
        """Emit an internal event."""
        for handler in self._event_handlers.get(event_name, []):
            try:
                handler(data)
            except Exception:
                pass  # Log in production

    def get_integration(self, integration_id: str) -> Optional[Integration]:
        """Get an integration."""
        return self.registry.get_integration(integration_id)

    def list_integrations(
        self,
        workspace_id: str,
        status: Optional[IntegrationStatus] = None
    ) -> List[Integration]:
        """List integrations for a workspace."""
        return self.registry.get_workspace_integrations(workspace_id, status)

    def get_stats(self) -> Dict[str, Any]:
        """Get manager statistics."""
        return {
            **self.registry.get_stats(),
            "pending_webhooks": len(self.webhook_receiver.get_pending_events()),
            "unresolved_conflicts": len(self.sync_engine.get_conflicts()),
        }


# ==================== Global Instances ====================

_integration_manager: Optional[IntegrationManager] = None


def get_integration_manager() -> Optional[IntegrationManager]:
    """Get the global integration manager."""
    return _integration_manager


def set_integration_manager(manager: IntegrationManager) -> None:
    """Set the global integration manager."""
    global _integration_manager
    _integration_manager = manager


def reset_integration_manager() -> None:
    """Reset the global integration manager."""
    global _integration_manager
    _integration_manager = None
