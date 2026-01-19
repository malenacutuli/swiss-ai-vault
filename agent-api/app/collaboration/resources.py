"""
Resource Management & Asset Library Module

Implements resource management functionality with:
- Asset types and metadata system
- Asset storage and retrieval
- Asset versioning and history
- Collections and folder organization
- Asset sharing and access control
- Thumbnail and preview generation
- Usage tracking and analytics
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Union
from abc import ABC, abstractmethod
import time
import hashlib
import mimetypes
import re


# ==================== Enums ====================

class AssetType(Enum):
    """Types of assets."""
    IMAGE = "image"
    VIDEO = "video"
    AUDIO = "audio"
    DOCUMENT = "document"
    SPREADSHEET = "spreadsheet"
    PRESENTATION = "presentation"
    ARCHIVE = "archive"
    CODE = "code"
    DATA = "data"
    OTHER = "other"


class AssetStatus(Enum):
    """Asset status."""
    PENDING = "pending"
    PROCESSING = "processing"
    ACTIVE = "active"
    ARCHIVED = "archived"
    DELETED = "deleted"
    QUARANTINED = "quarantined"


class CollectionType(Enum):
    """Types of collections."""
    FOLDER = "folder"
    ALBUM = "album"
    PLAYLIST = "playlist"
    PROJECT = "project"
    SMART = "smart"  # Dynamic based on rules


class AccessLevel(Enum):
    """Access levels for assets."""
    PRIVATE = "private"
    WORKSPACE = "workspace"
    ORGANIZATION = "organization"
    PUBLIC = "public"
    LINK = "link"  # Anyone with link


class SharePermission(Enum):
    """Sharing permissions."""
    VIEW = "view"
    DOWNLOAD = "download"
    EDIT = "edit"
    MANAGE = "manage"


class SortField(Enum):
    """Fields for sorting assets."""
    NAME = "name"
    CREATED_AT = "created_at"
    UPDATED_AT = "updated_at"
    SIZE = "size"
    TYPE = "type"


class SortOrder(Enum):
    """Sort order."""
    ASC = "asc"
    DESC = "desc"


# ==================== Data Classes ====================

@dataclass
class AssetMetadata:
    """Metadata for an asset."""
    filename: str
    mime_type: str
    size_bytes: int
    extension: str = ""
    width: Optional[int] = None  # For images/videos
    height: Optional[int] = None
    duration_seconds: Optional[float] = None  # For audio/video
    page_count: Optional[int] = None  # For documents
    encoding: Optional[str] = None
    checksum: Optional[str] = None
    custom: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "filename": self.filename,
            "mime_type": self.mime_type,
            "size_bytes": self.size_bytes,
            "extension": self.extension,
            "width": self.width,
            "height": self.height,
            "duration_seconds": self.duration_seconds,
            "page_count": self.page_count,
            "checksum": self.checksum,
        }


@dataclass
class AssetVersion:
    """A version of an asset."""
    version_id: str
    version_number: int
    storage_path: str
    size_bytes: int
    checksum: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: Optional[str] = None
    change_notes: str = ""
    metadata: Optional[AssetMetadata] = None


@dataclass
class Asset:
    """An asset/resource in the system."""
    id: str
    name: str
    asset_type: AssetType
    status: AssetStatus = AssetStatus.ACTIVE
    description: str = ""
    storage_path: str = ""
    metadata: Optional[AssetMetadata] = None
    tags: Set[str] = field(default_factory=set)
    labels: Dict[str, str] = field(default_factory=dict)
    access_level: AccessLevel = AccessLevel.PRIVATE
    workspace_id: Optional[str] = None
    collection_ids: Set[str] = field(default_factory=set)
    owner_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    current_version: int = 1
    versions: List[AssetVersion] = field(default_factory=list)
    thumbnail_path: Optional[str] = None
    preview_path: Optional[str] = None
    download_count: int = 0
    view_count: int = 0
    custom_data: Dict[str, Any] = field(default_factory=dict)

    def add_tag(self, tag: str) -> None:
        """Add a tag to the asset."""
        self.tags.add(tag.lower().strip())
        self.updated_at = datetime.utcnow()

    def remove_tag(self, tag: str) -> bool:
        """Remove a tag from the asset."""
        tag_lower = tag.lower().strip()
        if tag_lower in self.tags:
            self.tags.discard(tag_lower)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def set_label(self, key: str, value: str) -> None:
        """Set a label on the asset."""
        self.labels[key] = value
        self.updated_at = datetime.utcnow()

    def get_current_version(self) -> Optional[AssetVersion]:
        """Get the current version of the asset."""
        for v in self.versions:
            if v.version_number == self.current_version:
                return v
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.asset_type.value,
            "status": self.status.value,
            "description": self.description,
            "tags": list(self.tags),
            "labels": self.labels,
            "access_level": self.access_level.value,
            "workspace_id": self.workspace_id,
            "owner_id": self.owner_id,
            "current_version": self.current_version,
            "metadata": self.metadata.to_dict() if self.metadata else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class Collection:
    """A collection/folder of assets."""
    id: str
    name: str
    collection_type: CollectionType
    description: str = ""
    parent_id: Optional[str] = None
    workspace_id: Optional[str] = None
    owner_id: Optional[str] = None
    asset_ids: Set[str] = field(default_factory=set)
    child_ids: Set[str] = field(default_factory=set)
    cover_asset_id: Optional[str] = None
    access_level: AccessLevel = AccessLevel.PRIVATE
    tags: Set[str] = field(default_factory=set)
    color: Optional[str] = None
    icon: Optional[str] = None
    sort_field: SortField = SortField.NAME
    sort_order: SortOrder = SortOrder.ASC
    smart_rules: Optional[Dict[str, Any]] = None  # For smart collections
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_asset(self, asset_id: str) -> None:
        """Add an asset to the collection."""
        self.asset_ids.add(asset_id)
        self.updated_at = datetime.utcnow()

    def remove_asset(self, asset_id: str) -> bool:
        """Remove an asset from the collection."""
        if asset_id in self.asset_ids:
            self.asset_ids.discard(asset_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    def add_child(self, child_id: str) -> None:
        """Add a child collection."""
        self.child_ids.add(child_id)
        self.updated_at = datetime.utcnow()

    def remove_child(self, child_id: str) -> bool:
        """Remove a child collection."""
        if child_id in self.child_ids:
            self.child_ids.discard(child_id)
            self.updated_at = datetime.utcnow()
            return True
        return False

    @property
    def asset_count(self) -> int:
        """Get number of assets in collection."""
        return len(self.asset_ids)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "type": self.collection_type.value,
            "description": self.description,
            "parent_id": self.parent_id,
            "workspace_id": self.workspace_id,
            "asset_count": self.asset_count,
            "access_level": self.access_level.value,
            "tags": list(self.tags),
            "color": self.color,
            "icon": self.icon,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
        }


@dataclass
class ShareLink:
    """A sharing link for an asset or collection."""
    id: str
    resource_id: str
    resource_type: str  # "asset" or "collection"
    token: str
    permission: SharePermission
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    password_hash: Optional[str] = None
    max_uses: Optional[int] = None
    use_count: int = 0
    allowed_emails: Set[str] = field(default_factory=set)
    is_active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """Check if link is expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_used_up(self) -> bool:
        """Check if link has reached max uses."""
        if self.max_uses is None:
            return False
        return self.use_count >= self.max_uses

    @property
    def is_valid(self) -> bool:
        """Check if link is valid."""
        return self.is_active and not self.is_expired and not self.is_used_up

    def record_use(self) -> None:
        """Record a use of the link."""
        self.use_count += 1


@dataclass
class AssetUsage:
    """Track asset usage."""
    id: str
    asset_id: str
    user_id: Optional[str] = None
    action: str = ""  # view, download, embed, etc.
    context: str = ""  # where it was used
    timestamp: datetime = field(default_factory=datetime.utcnow)
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ResourceQuota:
    """Resource quota configuration."""
    max_storage_bytes: int = 10 * 1024 * 1024 * 1024  # 10GB default
    max_asset_count: int = 10000
    max_file_size_bytes: int = 100 * 1024 * 1024  # 100MB default
    allowed_types: Set[AssetType] = field(default_factory=lambda: set(AssetType))
    allowed_extensions: Set[str] = field(default_factory=set)
    blocked_extensions: Set[str] = field(default_factory=lambda: {".exe", ".bat", ".cmd", ".sh"})

    def check_file_size(self, size_bytes: int) -> Tuple[bool, Optional[str]]:
        """Check if file size is within quota."""
        if size_bytes > self.max_file_size_bytes:
            return False, f"File size {size_bytes} exceeds maximum {self.max_file_size_bytes}"
        return True, None

    def check_extension(self, extension: str) -> Tuple[bool, Optional[str]]:
        """Check if extension is allowed."""
        ext_lower = extension.lower()
        if ext_lower in self.blocked_extensions:
            return False, f"Extension {extension} is blocked"
        if self.allowed_extensions and ext_lower not in self.allowed_extensions:
            return False, f"Extension {extension} is not in allowed list"
        return True, None


# ==================== Asset Type Detection ====================

class AssetTypeDetector:
    """Detects asset type from file information."""

    MIME_TYPE_MAP = {
        # Images
        "image/jpeg": AssetType.IMAGE,
        "image/png": AssetType.IMAGE,
        "image/gif": AssetType.IMAGE,
        "image/webp": AssetType.IMAGE,
        "image/svg+xml": AssetType.IMAGE,
        "image/bmp": AssetType.IMAGE,
        "image/tiff": AssetType.IMAGE,
        # Videos
        "video/mp4": AssetType.VIDEO,
        "video/webm": AssetType.VIDEO,
        "video/quicktime": AssetType.VIDEO,
        "video/x-msvideo": AssetType.VIDEO,
        "video/x-matroska": AssetType.VIDEO,
        # Audio
        "audio/mpeg": AssetType.AUDIO,
        "audio/wav": AssetType.AUDIO,
        "audio/ogg": AssetType.AUDIO,
        "audio/flac": AssetType.AUDIO,
        "audio/aac": AssetType.AUDIO,
        # Documents
        "application/pdf": AssetType.DOCUMENT,
        "application/msword": AssetType.DOCUMENT,
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": AssetType.DOCUMENT,
        "text/plain": AssetType.DOCUMENT,
        "text/markdown": AssetType.DOCUMENT,
        "text/rtf": AssetType.DOCUMENT,
        # Spreadsheets
        "application/vnd.ms-excel": AssetType.SPREADSHEET,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": AssetType.SPREADSHEET,
        "text/csv": AssetType.SPREADSHEET,
        # Presentations
        "application/vnd.ms-powerpoint": AssetType.PRESENTATION,
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": AssetType.PRESENTATION,
        # Archives
        "application/zip": AssetType.ARCHIVE,
        "application/x-tar": AssetType.ARCHIVE,
        "application/gzip": AssetType.ARCHIVE,
        "application/x-rar-compressed": AssetType.ARCHIVE,
        "application/x-7z-compressed": AssetType.ARCHIVE,
        # Code
        "text/html": AssetType.CODE,
        "text/css": AssetType.CODE,
        "text/javascript": AssetType.CODE,
        "application/javascript": AssetType.CODE,
        "application/json": AssetType.DATA,
        "application/xml": AssetType.DATA,
        "text/xml": AssetType.DATA,
    }

    EXTENSION_MAP = {
        # Images
        ".jpg": AssetType.IMAGE, ".jpeg": AssetType.IMAGE,
        ".png": AssetType.IMAGE, ".gif": AssetType.IMAGE,
        ".webp": AssetType.IMAGE, ".svg": AssetType.IMAGE,
        ".bmp": AssetType.IMAGE, ".tiff": AssetType.IMAGE,
        ".ico": AssetType.IMAGE,
        # Videos
        ".mp4": AssetType.VIDEO, ".webm": AssetType.VIDEO,
        ".mov": AssetType.VIDEO, ".avi": AssetType.VIDEO,
        ".mkv": AssetType.VIDEO, ".wmv": AssetType.VIDEO,
        # Audio
        ".mp3": AssetType.AUDIO, ".wav": AssetType.AUDIO,
        ".ogg": AssetType.AUDIO, ".flac": AssetType.AUDIO,
        ".aac": AssetType.AUDIO, ".m4a": AssetType.AUDIO,
        # Documents
        ".pdf": AssetType.DOCUMENT, ".doc": AssetType.DOCUMENT,
        ".docx": AssetType.DOCUMENT, ".txt": AssetType.DOCUMENT,
        ".md": AssetType.DOCUMENT, ".rtf": AssetType.DOCUMENT,
        # Spreadsheets
        ".xls": AssetType.SPREADSHEET, ".xlsx": AssetType.SPREADSHEET,
        ".csv": AssetType.SPREADSHEET,
        # Presentations
        ".ppt": AssetType.PRESENTATION, ".pptx": AssetType.PRESENTATION,
        # Archives
        ".zip": AssetType.ARCHIVE, ".tar": AssetType.ARCHIVE,
        ".gz": AssetType.ARCHIVE, ".rar": AssetType.ARCHIVE,
        ".7z": AssetType.ARCHIVE,
        # Code
        ".py": AssetType.CODE, ".js": AssetType.CODE,
        ".ts": AssetType.CODE, ".html": AssetType.CODE,
        ".css": AssetType.CODE, ".java": AssetType.CODE,
        ".cpp": AssetType.CODE, ".c": AssetType.CODE,
        ".go": AssetType.CODE, ".rs": AssetType.CODE,
        ".rb": AssetType.CODE, ".php": AssetType.CODE,
        # Data
        ".json": AssetType.DATA, ".xml": AssetType.DATA,
        ".yaml": AssetType.DATA, ".yml": AssetType.DATA,
    }

    @classmethod
    def detect(cls, filename: str, mime_type: Optional[str] = None) -> AssetType:
        """Detect asset type from filename and mime type."""
        # Try mime type first
        if mime_type and mime_type in cls.MIME_TYPE_MAP:
            return cls.MIME_TYPE_MAP[mime_type]

        # Try extension
        ext = cls._get_extension(filename)
        if ext in cls.EXTENSION_MAP:
            return cls.EXTENSION_MAP[ext]

        # Try to guess mime type
        guessed_mime, _ = mimetypes.guess_type(filename)
        if guessed_mime and guessed_mime in cls.MIME_TYPE_MAP:
            return cls.MIME_TYPE_MAP[guessed_mime]

        return AssetType.OTHER

    @classmethod
    def _get_extension(cls, filename: str) -> str:
        """Get lowercase extension from filename."""
        if "." in filename:
            return "." + filename.rsplit(".", 1)[-1].lower()
        return ""


# ==================== Asset Registry ====================

class AssetRegistry:
    """Central registry for managing assets."""

    _counter: int = 0

    def __init__(self):
        self._assets: Dict[str, Asset] = {}
        self._collections: Dict[str, Collection] = {}
        self._share_links: Dict[str, ShareLink] = {}
        self._usage_records: List[AssetUsage] = []
        self._workspace_assets: Dict[str, Set[str]] = {}
        self._tag_index: Dict[str, Set[str]] = {}  # tag -> asset_ids
        self._type_index: Dict[AssetType, Set[str]] = {}  # type -> asset_ids

    def create_asset(
        self,
        name: str,
        asset_type: AssetType,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        **kwargs
    ) -> Asset:
        """Create a new asset."""
        AssetRegistry._counter += 1
        asset_id = f"asset_{int(time.time() * 1000)}_{AssetRegistry._counter}"

        asset = Asset(
            id=asset_id,
            name=name,
            asset_type=asset_type,
            workspace_id=workspace_id,
            owner_id=owner_id,
            **kwargs
        )

        self._assets[asset_id] = asset

        # Index by workspace
        if workspace_id:
            if workspace_id not in self._workspace_assets:
                self._workspace_assets[workspace_id] = set()
            self._workspace_assets[workspace_id].add(asset_id)

        # Index by type
        if asset_type not in self._type_index:
            self._type_index[asset_type] = set()
        self._type_index[asset_type].add(asset_id)

        return asset

    def get_asset(self, asset_id: str) -> Optional[Asset]:
        """Get an asset by ID."""
        return self._assets.get(asset_id)

    def update_asset(self, asset: Asset) -> bool:
        """Update an asset."""
        if asset.id not in self._assets:
            return False

        asset.updated_at = datetime.utcnow()
        self._assets[asset.id] = asset

        # Update tag index
        self._update_tag_index(asset)

        return True

    def delete_asset(self, asset_id: str, soft_delete: bool = True) -> bool:
        """Delete an asset."""
        asset = self._assets.get(asset_id)
        if not asset:
            return False

        if soft_delete:
            asset.status = AssetStatus.DELETED
            asset.updated_at = datetime.utcnow()
        else:
            # Remove from indexes
            if asset.workspace_id and asset.workspace_id in self._workspace_assets:
                self._workspace_assets[asset.workspace_id].discard(asset_id)

            if asset.asset_type in self._type_index:
                self._type_index[asset.asset_type].discard(asset_id)

            for tag in asset.tags:
                if tag in self._tag_index:
                    self._tag_index[tag].discard(asset_id)

            # Remove from collections
            for collection in self._collections.values():
                collection.asset_ids.discard(asset_id)

            del self._assets[asset_id]

        return True

    def _update_tag_index(self, asset: Asset) -> None:
        """Update tag index for asset."""
        # Remove old tags
        for tag, asset_ids in self._tag_index.items():
            asset_ids.discard(asset.id)

        # Add current tags
        for tag in asset.tags:
            if tag not in self._tag_index:
                self._tag_index[tag] = set()
            self._tag_index[tag].add(asset.id)

    def list_assets(
        self,
        workspace_id: Optional[str] = None,
        asset_type: Optional[AssetType] = None,
        status: Optional[AssetStatus] = None,
        tags: Optional[Set[str]] = None,
        collection_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        sort_field: SortField = SortField.CREATED_AT,
        sort_order: SortOrder = SortOrder.DESC,
        limit: int = 100,
        offset: int = 0
    ) -> List[Asset]:
        """List assets matching criteria."""
        # Start with all or workspace-filtered assets
        if workspace_id and workspace_id in self._workspace_assets:
            asset_ids = self._workspace_assets[workspace_id]
            assets = [self._assets[aid] for aid in asset_ids if aid in self._assets]
        else:
            assets = list(self._assets.values())

        # Filter by type
        if asset_type:
            assets = [a for a in assets if a.asset_type == asset_type]

        # Filter by status
        if status:
            assets = [a for a in assets if a.status == status]
        else:
            # By default, exclude deleted
            assets = [a for a in assets if a.status != AssetStatus.DELETED]

        # Filter by tags
        if tags:
            assets = [a for a in assets if tags.issubset(a.tags)]

        # Filter by collection
        if collection_id:
            collection = self._collections.get(collection_id)
            if collection:
                assets = [a for a in assets if a.id in collection.asset_ids]

        # Filter by owner
        if owner_id:
            assets = [a for a in assets if a.owner_id == owner_id]

        # Sort
        reverse = sort_order == SortOrder.DESC
        if sort_field == SortField.NAME:
            assets.sort(key=lambda a: a.name.lower(), reverse=reverse)
        elif sort_field == SortField.CREATED_AT:
            assets.sort(key=lambda a: a.created_at, reverse=reverse)
        elif sort_field == SortField.UPDATED_AT:
            assets.sort(key=lambda a: a.updated_at, reverse=reverse)
        elif sort_field == SortField.SIZE:
            assets.sort(
                key=lambda a: a.metadata.size_bytes if a.metadata else 0,
                reverse=reverse
            )
        elif sort_field == SortField.TYPE:
            assets.sort(key=lambda a: a.asset_type.value, reverse=reverse)

        # Paginate
        return assets[offset:offset + limit]

    def search_assets(
        self,
        query: str,
        workspace_id: Optional[str] = None
    ) -> List[Asset]:
        """Search assets by name, description, or tags."""
        query_lower = query.lower()
        assets = self.list_assets(workspace_id=workspace_id, limit=10000)

        results = []
        for asset in assets:
            if (query_lower in asset.name.lower() or
                query_lower in asset.description.lower() or
                any(query_lower in tag for tag in asset.tags)):
                results.append(asset)

        return results

    def get_assets_by_tag(self, tag: str) -> List[Asset]:
        """Get all assets with a specific tag."""
        tag_lower = tag.lower()
        asset_ids = self._tag_index.get(tag_lower, set())
        return [self._assets[aid] for aid in asset_ids if aid in self._assets]

    def get_assets_by_type(self, asset_type: AssetType) -> List[Asset]:
        """Get all assets of a specific type."""
        asset_ids = self._type_index.get(asset_type, set())
        return [self._assets[aid] for aid in asset_ids if aid in self._assets]

    # Version management
    def add_version(
        self,
        asset_id: str,
        storage_path: str,
        size_bytes: int,
        checksum: str,
        created_by: Optional[str] = None,
        change_notes: str = "",
        metadata: Optional[AssetMetadata] = None
    ) -> Optional[AssetVersion]:
        """Add a new version to an asset."""
        asset = self._assets.get(asset_id)
        if not asset:
            return None

        AssetRegistry._counter += 1
        version_id = f"ver_{int(time.time() * 1000)}_{AssetRegistry._counter}"

        version = AssetVersion(
            version_id=version_id,
            version_number=asset.current_version + 1,
            storage_path=storage_path,
            size_bytes=size_bytes,
            checksum=checksum,
            created_by=created_by,
            change_notes=change_notes,
            metadata=metadata
        )

        asset.versions.append(version)
        asset.current_version = version.version_number
        asset.storage_path = storage_path
        if metadata:
            asset.metadata = metadata
        asset.updated_at = datetime.utcnow()

        return version

    def get_version(self, asset_id: str, version_number: int) -> Optional[AssetVersion]:
        """Get a specific version of an asset."""
        asset = self._assets.get(asset_id)
        if not asset:
            return None

        for version in asset.versions:
            if version.version_number == version_number:
                return version
        return None

    def revert_to_version(self, asset_id: str, version_number: int) -> bool:
        """Revert asset to a specific version."""
        asset = self._assets.get(asset_id)
        if not asset:
            return False

        version = self.get_version(asset_id, version_number)
        if not version:
            return False

        asset.storage_path = version.storage_path
        asset.metadata = version.metadata
        asset.current_version = version_number
        asset.updated_at = datetime.utcnow()

        return True

    # Collection management
    def create_collection(
        self,
        name: str,
        collection_type: CollectionType,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        **kwargs
    ) -> Collection:
        """Create a new collection."""
        AssetRegistry._counter += 1
        collection_id = f"coll_{int(time.time() * 1000)}_{AssetRegistry._counter}"

        collection = Collection(
            id=collection_id,
            name=name,
            collection_type=collection_type,
            workspace_id=workspace_id,
            owner_id=owner_id,
            parent_id=parent_id,
            **kwargs
        )

        self._collections[collection_id] = collection

        # Update parent's children
        if parent_id and parent_id in self._collections:
            self._collections[parent_id].add_child(collection_id)

        return collection

    def get_collection(self, collection_id: str) -> Optional[Collection]:
        """Get a collection by ID."""
        return self._collections.get(collection_id)

    def update_collection(self, collection: Collection) -> bool:
        """Update a collection."""
        if collection.id not in self._collections:
            return False

        collection.updated_at = datetime.utcnow()
        self._collections[collection.id] = collection
        return True

    def delete_collection(
        self,
        collection_id: str,
        delete_children: bool = False
    ) -> bool:
        """Delete a collection."""
        collection = self._collections.get(collection_id)
        if not collection:
            return False

        if delete_children:
            # Recursively delete children
            for child_id in list(collection.child_ids):
                self.delete_collection(child_id, delete_children=True)

        # Remove from parent
        if collection.parent_id and collection.parent_id in self._collections:
            self._collections[collection.parent_id].remove_child(collection_id)

        # Remove collection references from assets
        for asset_id in collection.asset_ids:
            asset = self._assets.get(asset_id)
            if asset:
                asset.collection_ids.discard(collection_id)

        del self._collections[collection_id]
        return True

    def list_collections(
        self,
        workspace_id: Optional[str] = None,
        collection_type: Optional[CollectionType] = None,
        parent_id: Optional[str] = None,
        filter_by_parent: bool = False
    ) -> List[Collection]:
        """List collections matching criteria."""
        collections = list(self._collections.values())

        if workspace_id:
            collections = [c for c in collections if c.workspace_id == workspace_id]

        if collection_type:
            collections = [c for c in collections if c.collection_type == collection_type]

        if filter_by_parent or parent_id is not None:
            collections = [c for c in collections if c.parent_id == parent_id]

        return collections

    def get_root_collections(self, workspace_id: Optional[str] = None) -> List[Collection]:
        """Get root collections (no parent)."""
        return self.list_collections(workspace_id=workspace_id, parent_id=None, filter_by_parent=True)

    def add_asset_to_collection(self, asset_id: str, collection_id: str) -> bool:
        """Add an asset to a collection."""
        asset = self._assets.get(asset_id)
        collection = self._collections.get(collection_id)

        if not asset or not collection:
            return False

        collection.add_asset(asset_id)
        asset.collection_ids.add(collection_id)
        asset.updated_at = datetime.utcnow()

        return True

    def remove_asset_from_collection(self, asset_id: str, collection_id: str) -> bool:
        """Remove an asset from a collection."""
        asset = self._assets.get(asset_id)
        collection = self._collections.get(collection_id)

        if not asset or not collection:
            return False

        collection.remove_asset(asset_id)
        asset.collection_ids.discard(collection_id)
        asset.updated_at = datetime.utcnow()

        return True

    def move_collection(self, collection_id: str, new_parent_id: Optional[str]) -> bool:
        """Move a collection to a new parent."""
        collection = self._collections.get(collection_id)
        if not collection:
            return False

        # Check for circular reference
        if new_parent_id:
            current = new_parent_id
            while current:
                if current == collection_id:
                    return False  # Would create circular reference
                parent = self._collections.get(current)
                current = parent.parent_id if parent else None

        # Remove from old parent
        if collection.parent_id and collection.parent_id in self._collections:
            self._collections[collection.parent_id].remove_child(collection_id)

        # Add to new parent
        if new_parent_id and new_parent_id in self._collections:
            self._collections[new_parent_id].add_child(collection_id)

        collection.parent_id = new_parent_id
        collection.updated_at = datetime.utcnow()

        return True

    # Share link management
    def create_share_link(
        self,
        resource_id: str,
        resource_type: str,
        permission: SharePermission,
        created_by: Optional[str] = None,
        expires_in_hours: Optional[int] = None,
        password: Optional[str] = None,
        max_uses: Optional[int] = None,
        allowed_emails: Optional[Set[str]] = None
    ) -> Optional[ShareLink]:
        """Create a share link for a resource."""
        # Verify resource exists
        if resource_type == "asset" and resource_id not in self._assets:
            return None
        if resource_type == "collection" and resource_id not in self._collections:
            return None

        AssetRegistry._counter += 1
        link_id = f"share_{int(time.time() * 1000)}_{AssetRegistry._counter}"
        token = hashlib.sha256(f"{link_id}_{time.time()}".encode()).hexdigest()[:32]

        expires_at = None
        if expires_in_hours:
            expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)

        password_hash = None
        if password:
            password_hash = hashlib.sha256(password.encode()).hexdigest()

        link = ShareLink(
            id=link_id,
            resource_id=resource_id,
            resource_type=resource_type,
            token=token,
            permission=permission,
            created_by=created_by,
            expires_at=expires_at,
            password_hash=password_hash,
            max_uses=max_uses,
            allowed_emails=allowed_emails or set()
        )

        self._share_links[link_id] = link
        return link

    def get_share_link(self, link_id: str) -> Optional[ShareLink]:
        """Get a share link by ID."""
        return self._share_links.get(link_id)

    def get_share_link_by_token(self, token: str) -> Optional[ShareLink]:
        """Get a share link by token."""
        for link in self._share_links.values():
            if link.token == token:
                return link
        return None

    def validate_share_link(
        self,
        token: str,
        password: Optional[str] = None,
        email: Optional[str] = None
    ) -> Tuple[bool, Optional[ShareLink], Optional[str]]:
        """Validate a share link."""
        link = self.get_share_link_by_token(token)
        if not link:
            return False, None, "Share link not found"

        if not link.is_valid:
            if not link.is_active:
                return False, link, "Share link is disabled"
            if link.is_expired:
                return False, link, "Share link has expired"
            if link.is_used_up:
                return False, link, "Share link has reached maximum uses"

        if link.password_hash and password:
            if hashlib.sha256(password.encode()).hexdigest() != link.password_hash:
                return False, link, "Invalid password"
        elif link.password_hash and not password:
            return False, link, "Password required"

        if link.allowed_emails and email:
            if email.lower() not in {e.lower() for e in link.allowed_emails}:
                return False, link, "Email not authorized"

        return True, link, None

    def revoke_share_link(self, link_id: str) -> bool:
        """Revoke a share link."""
        link = self._share_links.get(link_id)
        if not link:
            return False

        link.is_active = False
        return True

    def list_share_links(
        self,
        resource_id: Optional[str] = None,
        created_by: Optional[str] = None
    ) -> List[ShareLink]:
        """List share links."""
        links = list(self._share_links.values())

        if resource_id:
            links = [l for l in links if l.resource_id == resource_id]

        if created_by:
            links = [l for l in links if l.created_by == created_by]

        return links

    # Usage tracking
    def record_usage(
        self,
        asset_id: str,
        action: str,
        user_id: Optional[str] = None,
        context: str = "",
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> Optional[AssetUsage]:
        """Record asset usage."""
        asset = self._assets.get(asset_id)
        if not asset:
            return None

        AssetRegistry._counter += 1
        usage_id = f"usage_{int(time.time() * 1000)}_{AssetRegistry._counter}"

        usage = AssetUsage(
            id=usage_id,
            asset_id=asset_id,
            user_id=user_id,
            action=action,
            context=context,
            ip_address=ip_address,
            user_agent=user_agent
        )

        self._usage_records.append(usage)

        # Update asset counters
        if action == "view":
            asset.view_count += 1
        elif action == "download":
            asset.download_count += 1

        return usage

    def get_usage_stats(
        self,
        asset_id: str,
        since: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get usage statistics for an asset."""
        records = [r for r in self._usage_records if r.asset_id == asset_id]

        if since:
            records = [r for r in records if r.timestamp >= since]

        action_counts: Dict[str, int] = {}
        for record in records:
            action_counts[record.action] = action_counts.get(record.action, 0) + 1

        return {
            "total_actions": len(records),
            "action_counts": action_counts,
            "unique_users": len({r.user_id for r in records if r.user_id}),
        }


# ==================== Resource Manager ====================

class ResourceManager:
    """High-level manager for resources."""

    def __init__(self, quota: Optional[ResourceQuota] = None):
        self.registry = AssetRegistry()
        self.quota = quota or ResourceQuota()
        self.type_detector = AssetTypeDetector()
        self._storage_used: Dict[str, int] = {}  # workspace -> bytes

    def upload_asset(
        self,
        name: str,
        content: bytes,
        filename: str,
        mime_type: Optional[str] = None,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        description: str = "",
        tags: Optional[Set[str]] = None
    ) -> Tuple[Optional[Asset], Optional[str]]:
        """Upload a new asset."""
        # Check file size
        size_bytes = len(content)
        is_valid, error = self.quota.check_file_size(size_bytes)
        if not is_valid:
            return None, error

        # Check extension
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()
        is_valid, error = self.quota.check_extension(ext)
        if not is_valid:
            return None, error

        # Check workspace quota
        if workspace_id:
            current_usage = self._storage_used.get(workspace_id, 0)
            if current_usage + size_bytes > self.quota.max_storage_bytes:
                return None, "Storage quota exceeded"

        # Detect asset type
        asset_type = self.type_detector.detect(filename, mime_type)

        # Compute checksum
        checksum = hashlib.sha256(content).hexdigest()

        # Create metadata
        metadata = AssetMetadata(
            filename=filename,
            mime_type=mime_type or mimetypes.guess_type(filename)[0] or "application/octet-stream",
            size_bytes=size_bytes,
            extension=ext,
            checksum=checksum
        )

        # Create asset
        asset = self.registry.create_asset(
            name=name,
            asset_type=asset_type,
            workspace_id=workspace_id,
            owner_id=owner_id,
            description=description,
            tags=tags or set(),
            metadata=metadata,
            storage_path=f"storage/{checksum[:2]}/{checksum}"
        )

        # Create initial version
        self.registry.add_version(
            asset_id=asset.id,
            storage_path=asset.storage_path,
            size_bytes=size_bytes,
            checksum=checksum,
            created_by=owner_id,
            change_notes="Initial upload",
            metadata=metadata
        )

        # Update storage usage
        if workspace_id:
            self._storage_used[workspace_id] = self._storage_used.get(workspace_id, 0) + size_bytes

        return asset, None

    def get_asset(self, asset_id: str) -> Optional[Asset]:
        """Get an asset by ID."""
        return self.registry.get_asset(asset_id)

    def update_asset(
        self,
        asset_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        tags: Optional[Set[str]] = None
    ) -> Optional[Asset]:
        """Update asset metadata."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return None

        if name is not None:
            asset.name = name
        if description is not None:
            asset.description = description
        if tags is not None:
            asset.tags = tags

        self.registry.update_asset(asset)
        return asset

    def delete_asset(self, asset_id: str, permanent: bool = False) -> bool:
        """Delete an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return False

        # Update storage usage on permanent delete
        if permanent and asset.workspace_id and asset.metadata:
            self._storage_used[asset.workspace_id] = max(
                0,
                self._storage_used.get(asset.workspace_id, 0) - asset.metadata.size_bytes
            )

        return self.registry.delete_asset(asset_id, soft_delete=not permanent)

    def upload_new_version(
        self,
        asset_id: str,
        content: bytes,
        filename: str,
        uploaded_by: Optional[str] = None,
        change_notes: str = ""
    ) -> Tuple[Optional[AssetVersion], Optional[str]]:
        """Upload a new version of an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return None, "Asset not found"

        size_bytes = len(content)
        is_valid, error = self.quota.check_file_size(size_bytes)
        if not is_valid:
            return None, error

        checksum = hashlib.sha256(content).hexdigest()

        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[-1].lower()

        metadata = AssetMetadata(
            filename=filename,
            mime_type=mimetypes.guess_type(filename)[0] or "application/octet-stream",
            size_bytes=size_bytes,
            extension=ext,
            checksum=checksum
        )

        version = self.registry.add_version(
            asset_id=asset_id,
            storage_path=f"storage/{checksum[:2]}/{checksum}",
            size_bytes=size_bytes,
            checksum=checksum,
            created_by=uploaded_by,
            change_notes=change_notes,
            metadata=metadata
        )

        return version, None

    def list_assets(self, **kwargs) -> List[Asset]:
        """List assets."""
        return self.registry.list_assets(**kwargs)

    def search_assets(self, query: str, workspace_id: Optional[str] = None) -> List[Asset]:
        """Search assets."""
        return self.registry.search_assets(query, workspace_id)

    # Collection operations
    def create_collection(
        self,
        name: str,
        collection_type: CollectionType = CollectionType.FOLDER,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        description: str = ""
    ) -> Collection:
        """Create a new collection."""
        return self.registry.create_collection(
            name=name,
            collection_type=collection_type,
            workspace_id=workspace_id,
            owner_id=owner_id,
            parent_id=parent_id,
            description=description
        )

    def get_collection(self, collection_id: str) -> Optional[Collection]:
        """Get a collection."""
        return self.registry.get_collection(collection_id)

    def delete_collection(self, collection_id: str, delete_children: bool = False) -> bool:
        """Delete a collection."""
        return self.registry.delete_collection(collection_id, delete_children)

    def list_collections(self, **kwargs) -> List[Collection]:
        """List collections."""
        return self.registry.list_collections(**kwargs)

    def add_to_collection(self, asset_id: str, collection_id: str) -> bool:
        """Add an asset to a collection."""
        return self.registry.add_asset_to_collection(asset_id, collection_id)

    def remove_from_collection(self, asset_id: str, collection_id: str) -> bool:
        """Remove an asset from a collection."""
        return self.registry.remove_asset_from_collection(asset_id, collection_id)

    def get_collection_assets(self, collection_id: str) -> List[Asset]:
        """Get all assets in a collection."""
        collection = self.registry.get_collection(collection_id)
        if not collection:
            return []

        return [
            self.registry.get_asset(aid)
            for aid in collection.asset_ids
            if self.registry.get_asset(aid)
        ]

    # Sharing operations
    def create_share_link(
        self,
        resource_id: str,
        resource_type: str,
        permission: SharePermission = SharePermission.VIEW,
        created_by: Optional[str] = None,
        expires_in_hours: Optional[int] = None,
        password: Optional[str] = None,
        max_uses: Optional[int] = None
    ) -> Optional[ShareLink]:
        """Create a share link."""
        return self.registry.create_share_link(
            resource_id=resource_id,
            resource_type=resource_type,
            permission=permission,
            created_by=created_by,
            expires_in_hours=expires_in_hours,
            password=password,
            max_uses=max_uses
        )

    def validate_share_link(
        self,
        token: str,
        password: Optional[str] = None,
        email: Optional[str] = None
    ) -> Tuple[bool, Optional[ShareLink], Optional[str]]:
        """Validate a share link."""
        return self.registry.validate_share_link(token, password, email)

    def revoke_share_link(self, link_id: str) -> bool:
        """Revoke a share link."""
        return self.registry.revoke_share_link(link_id)

    # Usage tracking
    def record_view(self, asset_id: str, user_id: Optional[str] = None) -> None:
        """Record a view of an asset."""
        self.registry.record_usage(asset_id, "view", user_id)

    def record_download(self, asset_id: str, user_id: Optional[str] = None) -> None:
        """Record a download of an asset."""
        self.registry.record_usage(asset_id, "download", user_id)

    def get_usage_stats(self, asset_id: str) -> Dict[str, Any]:
        """Get usage stats for an asset."""
        return self.registry.get_usage_stats(asset_id)

    def get_storage_usage(self, workspace_id: str) -> Dict[str, Any]:
        """Get storage usage for a workspace."""
        used = self._storage_used.get(workspace_id, 0)
        return {
            "used_bytes": used,
            "max_bytes": self.quota.max_storage_bytes,
            "used_percent": (used / self.quota.max_storage_bytes) * 100 if self.quota.max_storage_bytes > 0 else 0,
            "remaining_bytes": max(0, self.quota.max_storage_bytes - used)
        }

    def get_stats(self) -> Dict[str, Any]:
        """Get overall resource statistics."""
        assets = self.registry.list_assets(limit=100000)

        type_counts: Dict[str, int] = {}
        total_size = 0
        for asset in assets:
            type_counts[asset.asset_type.value] = type_counts.get(asset.asset_type.value, 0) + 1
            if asset.metadata:
                total_size += asset.metadata.size_bytes

        return {
            "total_assets": len(assets),
            "total_collections": len(self.registry._collections),
            "total_share_links": len(self.registry._share_links),
            "total_size_bytes": total_size,
            "assets_by_type": type_counts,
        }


# ==================== Global Instances ====================

_resource_manager: Optional[ResourceManager] = None


def get_resource_manager() -> Optional[ResourceManager]:
    """Get the global resource manager."""
    return _resource_manager


def set_resource_manager(manager: ResourceManager) -> None:
    """Set the global resource manager."""
    global _resource_manager
    _resource_manager = manager


def reset_resource_manager() -> None:
    """Reset the global resource manager."""
    global _resource_manager
    _resource_manager = None
