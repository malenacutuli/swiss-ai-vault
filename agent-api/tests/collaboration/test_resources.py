"""
Tests for Resource Management & Asset Library Module

Tests cover:
- Asset creation and metadata
- Asset versioning
- Collection management
- Share links
- Access control
- Usage tracking
- Resource quotas
- Asset type detection
"""

import pytest
from datetime import datetime, timedelta
from app.collaboration.resources import (
    ResourceManager,
    AssetRegistry,
    AssetTypeDetector,
    Asset,
    AssetType,
    AssetStatus,
    AssetMetadata,
    AssetVersion,
    AssetUsage,
    Collection,
    CollectionType,
    ShareLink,
    SharePermission,
    AccessLevel,
    ResourceQuota,
    SortField,
    SortOrder,
    get_resource_manager,
    set_resource_manager,
    reset_resource_manager,
)


# ==================== AssetMetadata Tests ====================

class TestAssetMetadata:
    """Tests for AssetMetadata."""

    def test_create_metadata(self):
        """Test creating metadata."""
        metadata = AssetMetadata(
            filename="document.pdf",
            mime_type="application/pdf",
            size_bytes=1024,
            extension=".pdf"
        )

        assert metadata.filename == "document.pdf"
        assert metadata.mime_type == "application/pdf"
        assert metadata.size_bytes == 1024

    def test_metadata_with_dimensions(self):
        """Test metadata with image dimensions."""
        metadata = AssetMetadata(
            filename="image.png",
            mime_type="image/png",
            size_bytes=2048,
            extension=".png",
            width=800,
            height=600
        )

        assert metadata.width == 800
        assert metadata.height == 600

    def test_metadata_with_duration(self):
        """Test metadata with duration."""
        metadata = AssetMetadata(
            filename="video.mp4",
            mime_type="video/mp4",
            size_bytes=10000000,
            extension=".mp4",
            duration_seconds=120.5
        )

        assert metadata.duration_seconds == 120.5

    def test_metadata_to_dict(self):
        """Test metadata serialization."""
        metadata = AssetMetadata(
            filename="test.txt",
            mime_type="text/plain",
            size_bytes=100,
            extension=".txt",
            checksum="abc123"
        )

        d = metadata.to_dict()
        assert d["filename"] == "test.txt"
        assert d["checksum"] == "abc123"


# ==================== Asset Tests ====================

class TestAsset:
    """Tests for Asset data class."""

    def test_create_asset(self):
        """Test creating an asset."""
        asset = Asset(
            id="asset_1",
            name="My Document",
            asset_type=AssetType.DOCUMENT
        )

        assert asset.id == "asset_1"
        assert asset.name == "My Document"
        assert asset.asset_type == AssetType.DOCUMENT
        assert asset.status == AssetStatus.ACTIVE

    def test_add_tag(self):
        """Test adding tags to asset."""
        asset = Asset(id="asset_1", name="Test", asset_type=AssetType.IMAGE)

        asset.add_tag("Important")
        asset.add_tag("review")

        assert "important" in asset.tags
        assert "review" in asset.tags

    def test_remove_tag(self):
        """Test removing tags from asset."""
        asset = Asset(
            id="asset_1",
            name="Test",
            asset_type=AssetType.IMAGE,
            tags={"important", "review"}
        )

        result = asset.remove_tag("important")
        assert result is True
        assert "important" not in asset.tags

        result = asset.remove_tag("nonexistent")
        assert result is False

    def test_set_label(self):
        """Test setting labels on asset."""
        asset = Asset(id="asset_1", name="Test", asset_type=AssetType.IMAGE)

        asset.set_label("project", "alpha")
        asset.set_label("priority", "high")

        assert asset.labels["project"] == "alpha"
        assert asset.labels["priority"] == "high"

    def test_get_current_version(self):
        """Test getting current version."""
        asset = Asset(id="asset_1", name="Test", asset_type=AssetType.DOCUMENT)
        asset.versions.append(AssetVersion(
            version_id="ver_1",
            version_number=1,
            storage_path="/path/v1",
            size_bytes=100,
            checksum="abc"
        ))

        version = asset.get_current_version()
        assert version is not None
        assert version.version_number == 1

    def test_to_dict(self):
        """Test asset serialization."""
        asset = Asset(
            id="asset_1",
            name="Test",
            asset_type=AssetType.IMAGE,
            description="Test image",
            tags={"test"},
            labels={"key": "value"}
        )

        d = asset.to_dict()
        assert d["id"] == "asset_1"
        assert d["type"] == "image"
        assert "test" in d["tags"]


# ==================== AssetTypeDetector Tests ====================

class TestAssetTypeDetector:
    """Tests for AssetTypeDetector."""

    def test_detect_image_by_extension(self):
        """Test detecting image by extension."""
        assert AssetTypeDetector.detect("photo.jpg") == AssetType.IMAGE
        assert AssetTypeDetector.detect("photo.png") == AssetType.IMAGE
        assert AssetTypeDetector.detect("photo.gif") == AssetType.IMAGE
        assert AssetTypeDetector.detect("photo.webp") == AssetType.IMAGE

    def test_detect_video_by_extension(self):
        """Test detecting video by extension."""
        assert AssetTypeDetector.detect("video.mp4") == AssetType.VIDEO
        assert AssetTypeDetector.detect("video.mov") == AssetType.VIDEO
        assert AssetTypeDetector.detect("video.webm") == AssetType.VIDEO

    def test_detect_audio_by_extension(self):
        """Test detecting audio by extension."""
        assert AssetTypeDetector.detect("song.mp3") == AssetType.AUDIO
        assert AssetTypeDetector.detect("sound.wav") == AssetType.AUDIO
        assert AssetTypeDetector.detect("music.flac") == AssetType.AUDIO

    def test_detect_document_by_extension(self):
        """Test detecting document by extension."""
        assert AssetTypeDetector.detect("doc.pdf") == AssetType.DOCUMENT
        assert AssetTypeDetector.detect("doc.docx") == AssetType.DOCUMENT
        assert AssetTypeDetector.detect("readme.md") == AssetType.DOCUMENT

    def test_detect_spreadsheet_by_extension(self):
        """Test detecting spreadsheet by extension."""
        assert AssetTypeDetector.detect("data.xlsx") == AssetType.SPREADSHEET
        assert AssetTypeDetector.detect("data.csv") == AssetType.SPREADSHEET

    def test_detect_code_by_extension(self):
        """Test detecting code by extension."""
        assert AssetTypeDetector.detect("main.py") == AssetType.CODE
        assert AssetTypeDetector.detect("app.js") == AssetType.CODE
        assert AssetTypeDetector.detect("index.html") == AssetType.CODE

    def test_detect_by_mime_type(self):
        """Test detecting by MIME type."""
        assert AssetTypeDetector.detect("file", "image/jpeg") == AssetType.IMAGE
        assert AssetTypeDetector.detect("file", "video/mp4") == AssetType.VIDEO
        assert AssetTypeDetector.detect("file", "application/pdf") == AssetType.DOCUMENT

    def test_detect_unknown(self):
        """Test detecting unknown type."""
        assert AssetTypeDetector.detect("unknown.xyz") == AssetType.OTHER


# ==================== Collection Tests ====================

class TestCollection:
    """Tests for Collection data class."""

    def test_create_collection(self):
        """Test creating a collection."""
        collection = Collection(
            id="coll_1",
            name="My Photos",
            collection_type=CollectionType.ALBUM
        )

        assert collection.id == "coll_1"
        assert collection.name == "My Photos"
        assert collection.collection_type == CollectionType.ALBUM

    def test_add_asset(self):
        """Test adding asset to collection."""
        collection = Collection(
            id="coll_1",
            name="Test",
            collection_type=CollectionType.FOLDER
        )

        collection.add_asset("asset_1")
        collection.add_asset("asset_2")

        assert "asset_1" in collection.asset_ids
        assert "asset_2" in collection.asset_ids
        assert collection.asset_count == 2

    def test_remove_asset(self):
        """Test removing asset from collection."""
        collection = Collection(
            id="coll_1",
            name="Test",
            collection_type=CollectionType.FOLDER,
            asset_ids={"asset_1", "asset_2"}
        )

        result = collection.remove_asset("asset_1")
        assert result is True
        assert "asset_1" not in collection.asset_ids

        result = collection.remove_asset("nonexistent")
        assert result is False

    def test_add_child(self):
        """Test adding child collection."""
        collection = Collection(
            id="coll_1",
            name="Parent",
            collection_type=CollectionType.FOLDER
        )

        collection.add_child("coll_2")
        assert "coll_2" in collection.child_ids

    def test_remove_child(self):
        """Test removing child collection."""
        collection = Collection(
            id="coll_1",
            name="Parent",
            collection_type=CollectionType.FOLDER,
            child_ids={"coll_2", "coll_3"}
        )

        result = collection.remove_child("coll_2")
        assert result is True
        assert "coll_2" not in collection.child_ids

    def test_to_dict(self):
        """Test collection serialization."""
        collection = Collection(
            id="coll_1",
            name="Test",
            collection_type=CollectionType.ALBUM,
            description="Test collection",
            tags={"photos"}
        )

        d = collection.to_dict()
        assert d["id"] == "coll_1"
        assert d["type"] == "album"


# ==================== ShareLink Tests ====================

class TestShareLink:
    """Tests for ShareLink."""

    def test_create_share_link(self):
        """Test creating a share link."""
        link = ShareLink(
            id="share_1",
            resource_id="asset_1",
            resource_type="asset",
            token="abc123",
            permission=SharePermission.VIEW
        )

        assert link.id == "share_1"
        assert link.token == "abc123"
        assert link.permission == SharePermission.VIEW

    def test_is_expired(self):
        """Test expiration check."""
        # Not expired
        link = ShareLink(
            id="share_1",
            resource_id="asset_1",
            resource_type="asset",
            token="abc",
            permission=SharePermission.VIEW,
            expires_at=datetime.utcnow() + timedelta(hours=1)
        )
        assert not link.is_expired

        # Expired
        link.expires_at = datetime.utcnow() - timedelta(hours=1)
        assert link.is_expired

        # No expiration
        link.expires_at = None
        assert not link.is_expired

    def test_is_used_up(self):
        """Test max uses check."""
        link = ShareLink(
            id="share_1",
            resource_id="asset_1",
            resource_type="asset",
            token="abc",
            permission=SharePermission.VIEW,
            max_uses=5,
            use_count=3
        )
        assert not link.is_used_up

        link.use_count = 5
        assert link.is_used_up

        link.max_uses = None
        assert not link.is_used_up

    def test_is_valid(self):
        """Test validity check."""
        link = ShareLink(
            id="share_1",
            resource_id="asset_1",
            resource_type="asset",
            token="abc",
            permission=SharePermission.VIEW
        )
        assert link.is_valid

        link.is_active = False
        assert not link.is_valid

    def test_record_use(self):
        """Test recording use."""
        link = ShareLink(
            id="share_1",
            resource_id="asset_1",
            resource_type="asset",
            token="abc",
            permission=SharePermission.VIEW
        )

        link.record_use()
        assert link.use_count == 1

        link.record_use()
        assert link.use_count == 2


# ==================== ResourceQuota Tests ====================

class TestResourceQuota:
    """Tests for ResourceQuota."""

    def test_default_quota(self):
        """Test default quota values."""
        quota = ResourceQuota()

        assert quota.max_storage_bytes == 10 * 1024 * 1024 * 1024  # 10GB
        assert quota.max_file_size_bytes == 100 * 1024 * 1024  # 100MB

    def test_check_file_size_valid(self):
        """Test file size check - valid."""
        quota = ResourceQuota(max_file_size_bytes=1000)

        is_valid, error = quota.check_file_size(500)
        assert is_valid
        assert error is None

    def test_check_file_size_exceeded(self):
        """Test file size check - exceeded."""
        quota = ResourceQuota(max_file_size_bytes=1000)

        is_valid, error = quota.check_file_size(1500)
        assert not is_valid
        assert "exceeds" in error

    def test_check_extension_blocked(self):
        """Test blocked extension."""
        quota = ResourceQuota()

        is_valid, error = quota.check_extension(".exe")
        assert not is_valid
        assert "blocked" in error

    def test_check_extension_allowed(self):
        """Test allowed extension."""
        quota = ResourceQuota()

        is_valid, error = quota.check_extension(".pdf")
        assert is_valid

    def test_check_extension_allowlist(self):
        """Test extension allowlist."""
        quota = ResourceQuota(allowed_extensions={".pdf", ".doc"})

        is_valid, error = quota.check_extension(".pdf")
        assert is_valid

        is_valid, error = quota.check_extension(".jpg")
        assert not is_valid
        assert "not in allowed" in error


# ==================== AssetRegistry Tests ====================

class TestAssetRegistry:
    """Tests for AssetRegistry."""

    def test_create_asset(self):
        """Test creating an asset."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test Image",
            asset_type=AssetType.IMAGE,
            workspace_id="ws1"
        )

        assert asset.id.startswith("asset_")
        assert asset.name == "Test Image"
        assert asset.workspace_id == "ws1"

    def test_get_asset(self):
        """Test getting an asset."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT
        )

        fetched = registry.get_asset(asset.id)
        assert fetched == asset

        assert registry.get_asset("nonexistent") is None

    def test_update_asset(self):
        """Test updating an asset."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT
        )

        asset.name = "Updated"
        asset.add_tag("important")

        result = registry.update_asset(asset)
        assert result is True

        fetched = registry.get_asset(asset.id)
        assert fetched.name == "Updated"

    def test_delete_asset_soft(self):
        """Test soft deleting an asset."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT
        )

        result = registry.delete_asset(asset.id, soft_delete=True)
        assert result is True

        fetched = registry.get_asset(asset.id)
        assert fetched.status == AssetStatus.DELETED

    def test_delete_asset_hard(self):
        """Test hard deleting an asset."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT
        )

        result = registry.delete_asset(asset.id, soft_delete=False)
        assert result is True

        fetched = registry.get_asset(asset.id)
        assert fetched is None

    def test_list_assets(self):
        """Test listing assets."""
        registry = AssetRegistry()

        registry.create_asset(name="Image 1", asset_type=AssetType.IMAGE, workspace_id="ws1")
        registry.create_asset(name="Image 2", asset_type=AssetType.IMAGE, workspace_id="ws1")
        registry.create_asset(name="Doc 1", asset_type=AssetType.DOCUMENT, workspace_id="ws2")

        # All assets
        assets = registry.list_assets()
        assert len(assets) == 3

        # By workspace
        assets = registry.list_assets(workspace_id="ws1")
        assert len(assets) == 2

        # By type
        assets = registry.list_assets(asset_type=AssetType.IMAGE)
        assert len(assets) == 2

    def test_list_assets_with_sorting(self):
        """Test listing assets with sorting."""
        registry = AssetRegistry()

        registry.create_asset(name="B File", asset_type=AssetType.DOCUMENT)
        registry.create_asset(name="A File", asset_type=AssetType.DOCUMENT)
        registry.create_asset(name="C File", asset_type=AssetType.DOCUMENT)

        assets = registry.list_assets(sort_field=SortField.NAME, sort_order=SortOrder.ASC)
        assert assets[0].name == "A File"
        assert assets[2].name == "C File"

        assets = registry.list_assets(sort_field=SortField.NAME, sort_order=SortOrder.DESC)
        assert assets[0].name == "C File"

    def test_list_assets_pagination(self):
        """Test listing assets with pagination."""
        registry = AssetRegistry()

        for i in range(10):
            registry.create_asset(name=f"Asset {i}", asset_type=AssetType.DOCUMENT)

        assets = registry.list_assets(limit=3, offset=0)
        assert len(assets) == 3

        assets = registry.list_assets(limit=3, offset=3)
        assert len(assets) == 3

    def test_list_assets_by_tags(self):
        """Test listing assets by tags."""
        registry = AssetRegistry()

        a1 = registry.create_asset(name="A1", asset_type=AssetType.DOCUMENT)
        a1.add_tag("important")
        a1.add_tag("review")
        registry.update_asset(a1)

        a2 = registry.create_asset(name="A2", asset_type=AssetType.DOCUMENT)
        a2.add_tag("important")
        registry.update_asset(a2)

        assets = registry.list_assets(tags={"important"})
        assert len(assets) == 2

        assets = registry.list_assets(tags={"important", "review"})
        assert len(assets) == 1

    def test_search_assets(self):
        """Test searching assets."""
        registry = AssetRegistry()

        registry.create_asset(
            name="Project Report",
            asset_type=AssetType.DOCUMENT,
            description="Quarterly report"
        )
        registry.create_asset(
            name="Meeting Notes",
            asset_type=AssetType.DOCUMENT,
            description="Team meeting"
        )

        results = registry.search_assets("report")
        assert len(results) == 1
        assert results[0].name == "Project Report"

        results = registry.search_assets("meeting")
        assert len(results) == 1

    def test_get_assets_by_tag(self):
        """Test getting assets by tag."""
        registry = AssetRegistry()

        a1 = registry.create_asset(name="A1", asset_type=AssetType.DOCUMENT)
        a1.add_tag("urgent")
        registry.update_asset(a1)

        a2 = registry.create_asset(name="A2", asset_type=AssetType.DOCUMENT)
        a2.add_tag("urgent")
        registry.update_asset(a2)

        assets = registry.get_assets_by_tag("urgent")
        assert len(assets) == 2

    def test_get_assets_by_type(self):
        """Test getting assets by type."""
        registry = AssetRegistry()

        registry.create_asset(name="Image", asset_type=AssetType.IMAGE)
        registry.create_asset(name="Doc", asset_type=AssetType.DOCUMENT)

        assets = registry.get_assets_by_type(AssetType.IMAGE)
        assert len(assets) == 1


# ==================== Version Management Tests ====================

class TestVersionManagement:
    """Tests for asset version management."""

    def test_add_version(self):
        """Test adding a version."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT
        )

        version = registry.add_version(
            asset_id=asset.id,
            storage_path="/path/v1",
            size_bytes=1000,
            checksum="abc123",
            change_notes="First version"
        )

        assert version is not None
        assert version.version_number == 2  # Initial is 1
        assert asset.current_version == 2

    def test_get_version(self):
        """Test getting a specific version."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT
        )

        registry.add_version(
            asset_id=asset.id,
            storage_path="/path/v1",
            size_bytes=1000,
            checksum="abc"
        )

        version = registry.get_version(asset.id, 2)
        assert version is not None
        assert version.version_number == 2

        version = registry.get_version(asset.id, 99)
        assert version is None

    def test_revert_to_version(self):
        """Test reverting to a specific version."""
        registry = AssetRegistry()

        asset = registry.create_asset(
            name="Test",
            asset_type=AssetType.DOCUMENT,
            storage_path="/path/original"
        )

        # Add initial version
        registry.add_version(
            asset_id=asset.id,
            storage_path="/path/v1",
            size_bytes=100,
            checksum="v1"
        )

        registry.add_version(
            asset_id=asset.id,
            storage_path="/path/v2",
            size_bytes=200,
            checksum="v2"
        )

        # Revert to version 2
        result = registry.revert_to_version(asset.id, 2)
        assert result is True
        assert asset.current_version == 2
        assert asset.storage_path == "/path/v1"


# ==================== Collection Registry Tests ====================

class TestCollectionRegistry:
    """Tests for collection management in registry."""

    def test_create_collection(self):
        """Test creating a collection."""
        registry = AssetRegistry()

        collection = registry.create_collection(
            name="Photos",
            collection_type=CollectionType.ALBUM,
            workspace_id="ws1"
        )

        assert collection.id.startswith("coll_")
        assert collection.name == "Photos"

    def test_get_collection(self):
        """Test getting a collection."""
        registry = AssetRegistry()

        collection = registry.create_collection(
            name="Test",
            collection_type=CollectionType.FOLDER
        )

        fetched = registry.get_collection(collection.id)
        assert fetched == collection

    def test_update_collection(self):
        """Test updating a collection."""
        registry = AssetRegistry()

        collection = registry.create_collection(
            name="Test",
            collection_type=CollectionType.FOLDER
        )

        collection.name = "Updated"
        result = registry.update_collection(collection)
        assert result is True

    def test_delete_collection(self):
        """Test deleting a collection."""
        registry = AssetRegistry()

        collection = registry.create_collection(
            name="Test",
            collection_type=CollectionType.FOLDER
        )

        result = registry.delete_collection(collection.id)
        assert result is True
        assert registry.get_collection(collection.id) is None

    def test_delete_collection_with_children(self):
        """Test deleting collection with children."""
        registry = AssetRegistry()

        parent = registry.create_collection(
            name="Parent",
            collection_type=CollectionType.FOLDER
        )
        child = registry.create_collection(
            name="Child",
            collection_type=CollectionType.FOLDER,
            parent_id=parent.id
        )

        result = registry.delete_collection(parent.id, delete_children=True)
        assert result is True
        assert registry.get_collection(child.id) is None

    def test_list_collections(self):
        """Test listing collections."""
        registry = AssetRegistry()

        registry.create_collection(name="C1", collection_type=CollectionType.FOLDER, workspace_id="ws1")
        registry.create_collection(name="C2", collection_type=CollectionType.ALBUM, workspace_id="ws1")
        registry.create_collection(name="C3", collection_type=CollectionType.FOLDER, workspace_id="ws2")

        # All
        collections = registry.list_collections()
        assert len(collections) == 3

        # By workspace
        collections = registry.list_collections(workspace_id="ws1")
        assert len(collections) == 2

        # By type
        collections = registry.list_collections(collection_type=CollectionType.FOLDER)
        assert len(collections) == 2

    def test_get_root_collections(self):
        """Test getting root collections."""
        registry = AssetRegistry()

        root = registry.create_collection(
            name="Root",
            collection_type=CollectionType.FOLDER
        )
        registry.create_collection(
            name="Child",
            collection_type=CollectionType.FOLDER,
            parent_id=root.id
        )

        roots = registry.get_root_collections()
        assert len(roots) == 1
        assert roots[0].name == "Root"

    def test_add_asset_to_collection(self):
        """Test adding asset to collection."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Image", asset_type=AssetType.IMAGE)
        collection = registry.create_collection(name="Album", collection_type=CollectionType.ALBUM)

        result = registry.add_asset_to_collection(asset.id, collection.id)
        assert result is True
        assert asset.id in collection.asset_ids
        assert collection.id in asset.collection_ids

    def test_remove_asset_from_collection(self):
        """Test removing asset from collection."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Image", asset_type=AssetType.IMAGE)
        collection = registry.create_collection(name="Album", collection_type=CollectionType.ALBUM)

        registry.add_asset_to_collection(asset.id, collection.id)
        result = registry.remove_asset_from_collection(asset.id, collection.id)

        assert result is True
        assert asset.id not in collection.asset_ids
        assert collection.id not in asset.collection_ids

    def test_move_collection(self):
        """Test moving collection to new parent."""
        registry = AssetRegistry()

        parent1 = registry.create_collection(name="Parent1", collection_type=CollectionType.FOLDER)
        parent2 = registry.create_collection(name="Parent2", collection_type=CollectionType.FOLDER)
        child = registry.create_collection(
            name="Child",
            collection_type=CollectionType.FOLDER,
            parent_id=parent1.id
        )

        result = registry.move_collection(child.id, parent2.id)
        assert result is True
        assert child.parent_id == parent2.id
        assert child.id in parent2.child_ids
        assert child.id not in parent1.child_ids

    def test_move_collection_circular_reference(self):
        """Test preventing circular reference."""
        registry = AssetRegistry()

        parent = registry.create_collection(name="Parent", collection_type=CollectionType.FOLDER)
        child = registry.create_collection(
            name="Child",
            collection_type=CollectionType.FOLDER,
            parent_id=parent.id
        )

        # Try to move parent under child - should fail
        result = registry.move_collection(parent.id, child.id)
        assert result is False


# ==================== Share Link Registry Tests ====================

class TestShareLinkRegistry:
    """Tests for share link management in registry."""

    def test_create_share_link(self):
        """Test creating a share link."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW
        )

        assert link is not None
        assert link.id.startswith("share_")
        assert len(link.token) == 32

    def test_create_share_link_with_expiration(self):
        """Test creating share link with expiration."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW,
            expires_in_hours=24
        )

        assert link.expires_at is not None
        assert not link.is_expired

    def test_create_share_link_with_password(self):
        """Test creating share link with password."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.DOWNLOAD,
            password="secret123"
        )

        assert link.password_hash is not None

    def test_get_share_link_by_token(self):
        """Test getting share link by token."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)
        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW
        )

        fetched = registry.get_share_link_by_token(link.token)
        assert fetched == link

    def test_validate_share_link_valid(self):
        """Test validating a valid share link."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)
        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW
        )

        is_valid, fetched, error = registry.validate_share_link(link.token)
        assert is_valid
        assert fetched == link
        assert error is None

    def test_validate_share_link_expired(self):
        """Test validating an expired share link."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)
        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW,
            expires_in_hours=1
        )

        # Manually expire
        link.expires_at = datetime.utcnow() - timedelta(hours=1)

        is_valid, _, error = registry.validate_share_link(link.token)
        assert not is_valid
        assert "expired" in error

    def test_validate_share_link_password(self):
        """Test validating share link with password."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)
        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW,
            password="secret"
        )

        # Without password
        is_valid, _, error = registry.validate_share_link(link.token)
        assert not is_valid
        assert "required" in error

        # Wrong password
        is_valid, _, error = registry.validate_share_link(link.token, password="wrong")
        assert not is_valid
        assert "Invalid password" in error

        # Correct password
        is_valid, _, error = registry.validate_share_link(link.token, password="secret")
        assert is_valid

    def test_revoke_share_link(self):
        """Test revoking a share link."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)
        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW
        )

        result = registry.revoke_share_link(link.id)
        assert result is True
        assert not link.is_active

    def test_list_share_links(self):
        """Test listing share links."""
        registry = AssetRegistry()

        a1 = registry.create_asset(name="A1", asset_type=AssetType.DOCUMENT)
        a2 = registry.create_asset(name="A2", asset_type=AssetType.DOCUMENT)

        registry.create_share_link(a1.id, "asset", SharePermission.VIEW, created_by="user1")
        registry.create_share_link(a1.id, "asset", SharePermission.DOWNLOAD, created_by="user1")
        registry.create_share_link(a2.id, "asset", SharePermission.VIEW, created_by="user2")

        # All
        links = registry.list_share_links()
        assert len(links) == 3

        # By resource
        links = registry.list_share_links(resource_id=a1.id)
        assert len(links) == 2

        # By creator
        links = registry.list_share_links(created_by="user1")
        assert len(links) == 2


# ==================== Usage Tracking Tests ====================

class TestUsageTracking:
    """Tests for usage tracking."""

    def test_record_usage(self):
        """Test recording usage."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        usage = registry.record_usage(
            asset_id=asset.id,
            action="view",
            user_id="user1"
        )

        assert usage is not None
        assert usage.action == "view"
        assert asset.view_count == 1

    def test_record_download(self):
        """Test recording download."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        registry.record_usage(asset.id, "download", "user1")
        registry.record_usage(asset.id, "download", "user2")

        assert asset.download_count == 2

    def test_get_usage_stats(self):
        """Test getting usage stats."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        registry.record_usage(asset.id, "view", "user1")
        registry.record_usage(asset.id, "view", "user2")
        registry.record_usage(asset.id, "download", "user1")

        stats = registry.get_usage_stats(asset.id)
        assert stats["total_actions"] == 3
        assert stats["action_counts"]["view"] == 2
        assert stats["action_counts"]["download"] == 1
        assert stats["unique_users"] == 2


# ==================== ResourceManager Tests ====================

class TestResourceManager:
    """Tests for ResourceManager."""

    def test_upload_asset(self):
        """Test uploading an asset."""
        manager = ResourceManager()

        content = b"Hello, World!"
        asset, error = manager.upload_asset(
            name="greeting.txt",
            content=content,
            filename="greeting.txt",
            workspace_id="ws1",
            owner_id="user1"
        )

        assert error is None
        assert asset is not None
        assert asset.name == "greeting.txt"
        assert asset.asset_type == AssetType.DOCUMENT
        assert asset.metadata.size_bytes == len(content)

    def test_upload_asset_type_detection(self):
        """Test asset type detection on upload."""
        manager = ResourceManager()

        # Image
        asset, _ = manager.upload_asset(
            name="Photo",
            content=b"fake image data",
            filename="photo.jpg"
        )
        assert asset.asset_type == AssetType.IMAGE

        # Video
        asset, _ = manager.upload_asset(
            name="Video",
            content=b"fake video data",
            filename="video.mp4"
        )
        assert asset.asset_type == AssetType.VIDEO

    def test_upload_asset_quota_exceeded(self):
        """Test upload with file size exceeding quota."""
        quota = ResourceQuota(max_file_size_bytes=100)
        manager = ResourceManager(quota=quota)

        content = b"x" * 200
        asset, error = manager.upload_asset(
            name="large.txt",
            content=content,
            filename="large.txt"
        )

        assert asset is None
        assert "exceeds" in error

    def test_upload_asset_blocked_extension(self):
        """Test upload with blocked extension."""
        manager = ResourceManager()

        asset, error = manager.upload_asset(
            name="virus",
            content=b"malicious",
            filename="virus.exe"
        )

        assert asset is None
        assert "blocked" in error

    def test_update_asset(self):
        """Test updating asset metadata."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(
            name="original",
            content=b"content",
            filename="file.txt"
        )

        updated = manager.update_asset(
            asset_id=asset.id,
            name="updated",
            description="New description",
            tags={"important"}
        )

        assert updated.name == "updated"
        assert updated.description == "New description"
        assert "important" in updated.tags

    def test_delete_asset(self):
        """Test deleting an asset."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(
            name="test",
            content=b"content",
            filename="test.txt"
        )

        result = manager.delete_asset(asset.id)
        assert result is True

        fetched = manager.get_asset(asset.id)
        assert fetched.status == AssetStatus.DELETED

    def test_upload_new_version(self):
        """Test uploading a new version."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(
            name="document",
            content=b"version 1",
            filename="doc.txt"
        )

        # After initial upload, version is 2 (1 initial + 1 from add_version)
        initial_version = asset.current_version

        version, error = manager.upload_new_version(
            asset_id=asset.id,
            content=b"version 2",
            filename="doc.txt",
            change_notes="Updated content"
        )

        assert error is None
        assert version is not None
        assert asset.current_version == initial_version + 1

    def test_list_assets(self):
        """Test listing assets."""
        manager = ResourceManager()

        manager.upload_asset(name="a1", content=b"1", filename="a1.txt", workspace_id="ws1")
        manager.upload_asset(name="a2", content=b"2", filename="a2.txt", workspace_id="ws1")
        manager.upload_asset(name="a3", content=b"3", filename="a3.txt", workspace_id="ws2")

        assets = manager.list_assets()
        assert len(assets) == 3

        assets = manager.list_assets(workspace_id="ws1")
        assert len(assets) == 2

    def test_search_assets(self):
        """Test searching assets."""
        manager = ResourceManager()

        manager.upload_asset(name="project report", content=b"1", filename="report.pdf")
        manager.upload_asset(name="meeting notes", content=b"2", filename="notes.txt")

        results = manager.search_assets("report")
        assert len(results) == 1
        assert results[0].name == "project report"

    def test_create_collection(self):
        """Test creating a collection."""
        manager = ResourceManager()

        collection = manager.create_collection(
            name="Photos",
            collection_type=CollectionType.ALBUM,
            workspace_id="ws1"
        )

        assert collection.name == "Photos"
        assert collection.collection_type == CollectionType.ALBUM

    def test_add_to_collection(self):
        """Test adding asset to collection."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(name="image", content=b"img", filename="photo.jpg")
        collection = manager.create_collection(name="Album", collection_type=CollectionType.ALBUM)

        result = manager.add_to_collection(asset.id, collection.id)
        assert result is True

        assets = manager.get_collection_assets(collection.id)
        assert len(assets) == 1

    def test_remove_from_collection(self):
        """Test removing asset from collection."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(name="image", content=b"img", filename="photo.jpg")
        collection = manager.create_collection(name="Album", collection_type=CollectionType.ALBUM)

        manager.add_to_collection(asset.id, collection.id)
        result = manager.remove_from_collection(asset.id, collection.id)

        assert result is True
        assets = manager.get_collection_assets(collection.id)
        assert len(assets) == 0

    def test_create_share_link(self):
        """Test creating a share link."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(name="doc", content=b"content", filename="doc.pdf")

        link = manager.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW
        )

        assert link is not None

    def test_validate_share_link(self):
        """Test validating a share link."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(name="doc", content=b"content", filename="doc.pdf")
        link = manager.create_share_link(asset.id, "asset", SharePermission.VIEW)

        is_valid, fetched, error = manager.validate_share_link(link.token)
        assert is_valid
        assert fetched == link

    def test_record_view_and_download(self):
        """Test recording views and downloads."""
        manager = ResourceManager()

        asset, _ = manager.upload_asset(name="doc", content=b"content", filename="doc.pdf")

        manager.record_view(asset.id, "user1")
        manager.record_download(asset.id, "user1")

        stats = manager.get_usage_stats(asset.id)
        assert stats["action_counts"]["view"] == 1
        assert stats["action_counts"]["download"] == 1

    def test_get_storage_usage(self):
        """Test getting storage usage."""
        manager = ResourceManager()

        manager.upload_asset(name="a1", content=b"x" * 100, filename="a1.txt", workspace_id="ws1")
        manager.upload_asset(name="a2", content=b"x" * 200, filename="a2.txt", workspace_id="ws1")

        usage = manager.get_storage_usage("ws1")
        assert usage["used_bytes"] == 300
        assert usage["remaining_bytes"] == manager.quota.max_storage_bytes - 300

    def test_get_stats(self):
        """Test getting overall stats."""
        manager = ResourceManager()

        manager.upload_asset(name="img", content=b"img", filename="photo.jpg")
        manager.upload_asset(name="doc", content=b"doc", filename="doc.pdf")
        manager.create_collection(name="Album", collection_type=CollectionType.ALBUM)

        stats = manager.get_stats()
        assert stats["total_assets"] == 2
        assert stats["total_collections"] == 1
        assert stats["assets_by_type"]["image"] == 1
        assert stats["assets_by_type"]["document"] == 1


# ==================== Global Functions Tests ====================

class TestGlobalFunctions:
    """Tests for global resource manager functions."""

    def test_get_set_resource_manager(self):
        """Test get/set resource manager."""
        reset_resource_manager()

        assert get_resource_manager() is None

        manager = ResourceManager()
        set_resource_manager(manager)

        assert get_resource_manager() == manager

    def test_reset_resource_manager(self):
        """Test resetting resource manager."""
        manager = ResourceManager()
        set_resource_manager(manager)

        reset_resource_manager()

        assert get_resource_manager() is None


# ==================== Edge Cases Tests ====================

class TestEdgeCases:
    """Tests for edge cases."""

    def test_empty_filename(self):
        """Test handling empty filename."""
        manager = ResourceManager()

        asset, error = manager.upload_asset(
            name="unnamed",
            content=b"content",
            filename=""
        )

        # Should still work with OTHER type
        assert asset is not None
        assert asset.asset_type == AssetType.OTHER

    def test_unicode_filename(self):
        """Test handling unicode filename."""
        manager = ResourceManager()

        asset, error = manager.upload_asset(
            name="日本語",
            content=b"content",
            filename="日本語.txt"
        )

        assert asset is not None
        assert asset.name == "日本語"

    def test_large_tag_count(self):
        """Test handling many tags."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        for i in range(100):
            asset.add_tag(f"tag{i}")

        registry.update_asset(asset)
        assert len(asset.tags) == 100

    def test_deep_collection_hierarchy(self):
        """Test deep collection hierarchy."""
        registry = AssetRegistry()

        parent = registry.create_collection(name="Level0", collection_type=CollectionType.FOLDER)

        current = parent
        for i in range(1, 10):
            child = registry.create_collection(
                name=f"Level{i}",
                collection_type=CollectionType.FOLDER,
                parent_id=current.id
            )
            current = child

        # Should be able to traverse
        roots = registry.get_root_collections()
        assert len(roots) == 1
        assert roots[0].name == "Level0"

    def test_concurrent_version_creation(self):
        """Test multiple versions created quickly."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)

        for i in range(10):
            registry.add_version(
                asset_id=asset.id,
                storage_path=f"/path/v{i}",
                size_bytes=100,
                checksum=f"checksum{i}"
            )

        assert asset.current_version == 11  # 1 initial + 10 new
        assert len(asset.versions) == 10

    def test_share_link_max_uses(self):
        """Test share link with max uses."""
        registry = AssetRegistry()

        asset = registry.create_asset(name="Test", asset_type=AssetType.DOCUMENT)
        link = registry.create_share_link(
            resource_id=asset.id,
            resource_type="asset",
            permission=SharePermission.VIEW,
            max_uses=2
        )

        link.record_use()
        is_valid, _, _ = registry.validate_share_link(link.token)
        assert is_valid

        link.record_use()
        is_valid, _, error = registry.validate_share_link(link.token)
        assert not is_valid
        assert "maximum uses" in error
