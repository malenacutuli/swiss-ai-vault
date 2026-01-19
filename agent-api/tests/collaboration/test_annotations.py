"""Tests for Document Annotations."""

import pytest
import asyncio
from datetime import datetime, timedelta

from app.collaboration.annotations import (
    AnnotationManager,
    AnnotationConfig,
    Annotation,
    AnnotationType,
    AnnotationVisibility,
    AnnotationState,
    AnnotationRange,
    AnnotationStyle,
    AnnotationLayer,
    get_annotation_manager,
    set_annotation_manager,
    reset_annotation_manager,
)


class TestAnnotationType:
    """Tests for AnnotationType enum."""

    def test_type_values(self):
        """Type values are correct."""
        assert AnnotationType.HIGHLIGHT.value == "highlight"
        assert AnnotationType.UNDERLINE.value == "underline"
        assert AnnotationType.BOOKMARK.value == "bookmark"
        assert AnnotationType.LINK.value == "link"


class TestAnnotationVisibility:
    """Tests for AnnotationVisibility enum."""

    def test_visibility_values(self):
        """Visibility values are correct."""
        assert AnnotationVisibility.PRIVATE.value == "private"
        assert AnnotationVisibility.SHARED.value == "shared"
        assert AnnotationVisibility.PUBLIC.value == "public"


class TestAnnotationState:
    """Tests for AnnotationState enum."""

    def test_state_values(self):
        """State values are correct."""
        assert AnnotationState.ACTIVE.value == "active"
        assert AnnotationState.HIDDEN.value == "hidden"
        assert AnnotationState.DELETED.value == "deleted"


class TestAnnotationConfig:
    """Tests for AnnotationConfig."""

    def test_default_config(self):
        """Default configuration values."""
        config = AnnotationConfig()

        assert config.max_annotations_per_document == 1000
        assert config.max_layers_per_document == 20
        assert config.default_visibility == AnnotationVisibility.PUBLIC

    def test_custom_config(self):
        """Custom configuration."""
        config = AnnotationConfig(
            max_annotations_per_document=500,
            allow_overlapping=False,
        )

        assert config.max_annotations_per_document == 500
        assert config.allow_overlapping is False


class TestAnnotationRange:
    """Tests for AnnotationRange."""

    def test_create_range(self):
        """Create a range."""
        r = AnnotationRange(start=10, end=50)

        assert r.start == 10
        assert r.end == 50

    def test_overlaps(self):
        """Check range overlap."""
        r1 = AnnotationRange(start=10, end=50)
        r2 = AnnotationRange(start=40, end=80)
        r3 = AnnotationRange(start=60, end=100)

        assert r1.overlaps(r2) is True
        assert r1.overlaps(r3) is False

    def test_contains(self):
        """Check position containment."""
        r = AnnotationRange(start=10, end=50)

        assert r.contains(10) is True
        assert r.contains(30) is True
        assert r.contains(50) is False
        assert r.contains(5) is False

    def test_length(self):
        """Get range length."""
        r = AnnotationRange(start=10, end=50)
        assert r.length() == 40

    def test_to_dict(self):
        """Convert to dictionary."""
        r = AnnotationRange(start=10, end=50)
        d = r.to_dict()

        assert d["start"] == 10
        assert d["end"] == 50


class TestAnnotationStyle:
    """Tests for AnnotationStyle."""

    def test_create_style(self):
        """Create a style."""
        style = AnnotationStyle(
            color="#ff0000",
            background_color="#ffff00",
            opacity=0.5,
        )

        assert style.color == "#ff0000"
        assert style.opacity == 0.5

    def test_to_dict(self):
        """Convert to dictionary."""
        style = AnnotationStyle(
            color="#ff0000",
            font_weight="bold",
        )
        d = style.to_dict()

        assert d["color"] == "#ff0000"
        assert d["font_weight"] == "bold"
        assert "background_color" not in d  # None values excluded

    def test_from_dict(self):
        """Create from dictionary."""
        style = AnnotationStyle.from_dict({
            "color": "#00ff00",
            "opacity": 0.8,
        })

        assert style.color == "#00ff00"
        assert style.opacity == 0.8


class TestAnnotation:
    """Tests for Annotation."""

    @pytest.fixture
    def annotation(self):
        """Create a test annotation."""
        now = datetime.utcnow()
        return Annotation(
            id="ann_123",
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            range=AnnotationRange(start=10, end=50),
            state=AnnotationState.ACTIVE,
            visibility=AnnotationVisibility.PUBLIC,
            created_at=now,
            updated_at=now,
        )

    def test_is_visible_to_public(self, annotation):
        """Public annotations visible to all."""
        assert annotation.is_visible_to("user1") is True
        assert annotation.is_visible_to("user2") is True

    def test_is_visible_to_private(self, annotation):
        """Private annotations only visible to author."""
        annotation.visibility = AnnotationVisibility.PRIVATE

        assert annotation.is_visible_to("user1") is True
        assert annotation.is_visible_to("user2") is False

    def test_is_visible_to_shared(self, annotation):
        """Shared annotations visible to author and shared users."""
        annotation.visibility = AnnotationVisibility.SHARED
        annotation.shared_with = {"user2", "user3"}

        assert annotation.is_visible_to("user1") is True
        assert annotation.is_visible_to("user2") is True
        assert annotation.is_visible_to("user4") is False

    def test_is_visible_to_deleted(self, annotation):
        """Deleted annotations not visible."""
        annotation.state = AnnotationState.DELETED

        assert annotation.is_visible_to("user1") is False

    def test_to_dict(self, annotation):
        """Convert to dictionary."""
        d = annotation.to_dict()

        assert d["id"] == "ann_123"
        assert d["annotation_type"] == "highlight"
        assert d["visibility"] == "public"

    def test_from_dict(self, annotation):
        """Create from dictionary."""
        d = annotation.to_dict()
        recreated = Annotation.from_dict(d)

        assert recreated.id == annotation.id
        assert recreated.annotation_type == annotation.annotation_type


class TestAnnotationLayer:
    """Tests for AnnotationLayer."""

    def test_create_layer(self):
        """Create a layer."""
        layer = AnnotationLayer(
            id="layer_123",
            document_id="doc1",
            name="My Highlights",
            color="#ff0000",
        )

        assert layer.name == "My Highlights"
        assert layer.color == "#ff0000"

    def test_to_dict(self):
        """Convert to dictionary."""
        layer = AnnotationLayer(
            id="layer_123",
            document_id="doc1",
            name="Notes",
            description="Personal notes",
        )
        d = layer.to_dict()

        assert d["name"] == "Notes"
        assert d["description"] == "Personal notes"


class TestAnnotationManager:
    """Tests for AnnotationManager."""

    @pytest.fixture
    def manager(self):
        """Create an annotation manager."""
        return AnnotationManager()

    @pytest.mark.asyncio
    async def test_create_annotation(self, manager):
        """Create a new annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            start=10,
            end=50,
        )

        assert annotation is not None
        assert annotation.annotation_type == AnnotationType.HIGHLIGHT
        assert annotation.range.start == 10

    @pytest.mark.asyncio
    async def test_create_annotation_with_style(self, manager):
        """Create annotation with style."""
        style = AnnotationStyle(color="#ff0000", opacity=0.5)
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            start=10,
            end=50,
            style=style,
        )

        assert annotation.style is not None
        assert annotation.style.color == "#ff0000"

    @pytest.mark.asyncio
    async def test_create_annotation_with_layer(self, manager):
        """Create annotation in a layer."""
        layer = await manager.create_layer("doc1", "My Layer")
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            start=10,
            end=50,
            layer_id=layer.id,
        )

        assert annotation.layer_id == layer.id

    @pytest.mark.asyncio
    async def test_create_annotation_private(self, manager):
        """Create private annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.NOTE,
            start=10,
            end=50,
            visibility=AnnotationVisibility.PRIVATE,
            note="Private note",
        )

        assert annotation.visibility == AnnotationVisibility.PRIVATE
        assert annotation.is_visible_to("user1") is True
        assert annotation.is_visible_to("user2") is False

    @pytest.mark.asyncio
    async def test_create_annotation_max_limit(self, manager):
        """Cannot exceed max annotations."""
        config = AnnotationConfig(max_annotations_per_document=2)
        manager = AnnotationManager(config)

        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10)
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 20, 30)

        with pytest.raises(ValueError, match="max annotations"):
            await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 40, 50)

    @pytest.mark.asyncio
    async def test_update_annotation(self, manager):
        """Update an annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            start=10,
            end=50,
        )

        updated = await manager.update_annotation(
            annotation.id,
            user_id="user1",
            start=15,
            end=55,
            label="Updated",
        )

        assert updated is not None
        assert updated.range.start == 15
        assert updated.label == "Updated"

    @pytest.mark.asyncio
    async def test_update_annotation_wrong_user(self, manager):
        """Cannot update another user's annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            start=10,
            end=50,
        )

        updated = await manager.update_annotation(
            annotation.id,
            user_id="user2",
            label="Hacked",
        )

        assert updated is None

    @pytest.mark.asyncio
    async def test_delete_annotation(self, manager):
        """Delete an annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.HIGHLIGHT,
            start=10,
            end=50,
        )

        deleted = await manager.delete_annotation(annotation.id, "user1")

        assert deleted is True
        assert annotation.state == AnnotationState.DELETED

    @pytest.mark.asyncio
    async def test_share_annotation(self, manager):
        """Share an annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.NOTE,
            start=10,
            end=50,
            visibility=AnnotationVisibility.PRIVATE,
        )

        shared = await manager.share_annotation(
            annotation.id,
            user_id="user1",
            share_with={"user2", "user3"},
        )

        assert shared is not None
        assert shared.visibility == AnnotationVisibility.SHARED
        assert "user2" in shared.shared_with

    @pytest.mark.asyncio
    async def test_unshare_annotation(self, manager):
        """Remove sharing from annotation."""
        annotation = await manager.create_annotation(
            document_id="doc1",
            author_id="user1",
            annotation_type=AnnotationType.NOTE,
            start=10,
            end=50,
            visibility=AnnotationVisibility.SHARED,
            shared_with={"user2", "user3"},
        )

        unshared = await manager.unshare_annotation(
            annotation.id,
            user_id="user1",
            unshare_with={"user2"},
        )

        assert unshared is not None
        assert "user2" not in unshared.shared_with
        assert "user3" in unshared.shared_with

    @pytest.mark.asyncio
    async def test_get_document_annotations(self, manager):
        """Get annotations for a document."""
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10)
        await manager.create_annotation("doc1", "user1", AnnotationType.NOTE, 20, 30)
        await manager.create_annotation("doc2", "user1", AnnotationType.HIGHLIGHT, 0, 10)

        annotations = manager.get_document_annotations("doc1", "user1")

        assert len(annotations) == 2

    @pytest.mark.asyncio
    async def test_get_document_annotations_respects_visibility(self, manager):
        """Visibility is respected when getting annotations."""
        await manager.create_annotation(
            "doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10,
            visibility=AnnotationVisibility.PUBLIC,
        )
        await manager.create_annotation(
            "doc1", "user2", AnnotationType.NOTE, 20, 30,
            visibility=AnnotationVisibility.PRIVATE,
        )

        annotations = manager.get_document_annotations("doc1", "user1")

        # user1 should only see public annotation
        assert len(annotations) == 1

    @pytest.mark.asyncio
    async def test_get_document_annotations_by_type(self, manager):
        """Filter annotations by type."""
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10)
        await manager.create_annotation("doc1", "user1", AnnotationType.NOTE, 20, 30)
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 40, 50)

        annotations = manager.get_document_annotations(
            "doc1", "user1", annotation_type=AnnotationType.HIGHLIGHT
        )

        assert len(annotations) == 2

    @pytest.mark.asyncio
    async def test_get_annotations_at_position(self, manager):
        """Get annotations at a position."""
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 10, 50)
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 40, 80)
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 100, 150)

        annotations = manager.get_annotations_at_position("doc1", "user1", 45)

        assert len(annotations) == 2

    @pytest.mark.asyncio
    async def test_get_annotations_in_range(self, manager):
        """Get annotations overlapping a range."""
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 10, 50)
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 40, 80)
        await manager.create_annotation("doc1", "user1", AnnotationType.HIGHLIGHT, 100, 150)

        annotations = manager.get_annotations_in_range("doc1", "user1", 30, 60)

        assert len(annotations) == 2

    # Layer tests

    @pytest.mark.asyncio
    async def test_create_layer(self, manager):
        """Create a layer."""
        layer = await manager.create_layer(
            document_id="doc1",
            name="My Notes",
            color="#ff0000",
        )

        assert layer is not None
        assert layer.name == "My Notes"
        assert layer.color == "#ff0000"

    @pytest.mark.asyncio
    async def test_create_layer_max_limit(self, manager):
        """Cannot exceed max layers."""
        config = AnnotationConfig(max_layers_per_document=2)
        manager = AnnotationManager(config)

        await manager.create_layer("doc1", "Layer 1")
        await manager.create_layer("doc1", "Layer 2")

        with pytest.raises(ValueError, match="max layers"):
            await manager.create_layer("doc1", "Layer 3")

    @pytest.mark.asyncio
    async def test_update_layer(self, manager):
        """Update a layer."""
        layer = await manager.create_layer("doc1", "Original")

        updated = await manager.update_layer(
            layer.id,
            name="Updated",
            color="#00ff00",
        )

        assert updated is not None
        assert updated.name == "Updated"
        assert updated.color == "#00ff00"

    @pytest.mark.asyncio
    async def test_delete_layer(self, manager):
        """Delete a layer."""
        layer = await manager.create_layer("doc1", "To Delete")
        await manager.create_annotation(
            "doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10,
            layer_id=layer.id,
        )

        deleted = await manager.delete_layer(layer.id)

        assert deleted is True
        assert manager.get_layer(layer.id) is None

    @pytest.mark.asyncio
    async def test_get_document_layers(self, manager):
        """Get layers for a document."""
        await manager.create_layer("doc1", "Layer 1")
        await manager.create_layer("doc1", "Layer 2")
        await manager.create_layer("doc2", "Other Doc Layer")

        layers = manager.get_document_layers("doc1")

        assert len(layers) == 2

    @pytest.mark.asyncio
    async def test_get_layer_annotations(self, manager):
        """Get annotations in a layer."""
        layer = await manager.create_layer("doc1", "My Layer")
        await manager.create_annotation(
            "doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10, layer_id=layer.id
        )
        await manager.create_annotation(
            "doc1", "user1", AnnotationType.NOTE, 20, 30, layer_id=layer.id
        )
        await manager.create_annotation(
            "doc1", "user1", AnnotationType.HIGHLIGHT, 40, 50  # No layer
        )

        annotations = manager.get_layer_annotations(layer.id, "user1")

        assert len(annotations) == 2

    @pytest.mark.asyncio
    async def test_callbacks(self, manager):
        """Callbacks are invoked."""
        created_annotations = []
        updated_annotations = []
        deleted_annotations = []

        async def on_created(annotation):
            created_annotations.append(annotation)

        async def on_updated(annotation):
            updated_annotations.append(annotation)

        async def on_deleted(annotation):
            deleted_annotations.append(annotation)

        manager.on_annotation_created = on_created
        manager.on_annotation_updated = on_updated
        manager.on_annotation_deleted = on_deleted

        annotation = await manager.create_annotation(
            "doc1", "user1", AnnotationType.HIGHLIGHT, 0, 10
        )
        await manager.update_annotation(annotation.id, "user1", label="Test")
        await manager.delete_annotation(annotation.id, "user1")

        assert len(created_annotations) == 1
        assert len(updated_annotations) == 1
        assert len(deleted_annotations) == 1

    def test_get_stats(self, manager):
        """Get manager statistics."""
        stats = manager.get_stats()

        assert "total_annotations" in stats
        assert "active_annotations" in stats
        assert "by_type" in stats


class TestGlobalAnnotationManager:
    """Tests for global annotation manager functions."""

    def test_get_annotation_manager(self):
        """Get global annotation manager."""
        reset_annotation_manager()

        manager = get_annotation_manager()

        assert manager is not None
        assert isinstance(manager, AnnotationManager)

    def test_set_annotation_manager(self):
        """Set global annotation manager."""
        reset_annotation_manager()

        custom = AnnotationManager()
        set_annotation_manager(custom)

        assert get_annotation_manager() is custom

    def test_reset_annotation_manager(self):
        """Reset global annotation manager."""
        get_annotation_manager()

        reset_annotation_manager()

        manager = get_annotation_manager()
        assert manager is not None
