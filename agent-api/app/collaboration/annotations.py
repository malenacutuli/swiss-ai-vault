"""
Document Annotations for Collaboration

Provides:
- Text highlights and marks
- Inline annotations (bookmarks, labels)
- Annotation layers for different purposes
- Annotation visibility controls
- Annotation persistence

Integrates with comments for rich annotations.
"""

from __future__ import annotations

import asyncio
import secrets
from typing import Optional, Any, Callable, Awaitable, List, Dict, Set
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from collections import defaultdict

import logging

logger = logging.getLogger(__name__)


class AnnotationType(Enum):
    """Types of annotations."""
    HIGHLIGHT = "highlight"
    UNDERLINE = "underline"
    STRIKETHROUGH = "strikethrough"
    BOOKMARK = "bookmark"
    LABEL = "label"
    LINK = "link"
    NOTE = "note"


class AnnotationVisibility(Enum):
    """Annotation visibility levels."""
    PRIVATE = "private"  # Only creator can see
    SHARED = "shared"  # Selected users can see
    PUBLIC = "public"  # All document users can see


class AnnotationState(Enum):
    """Annotation states."""
    ACTIVE = "active"
    HIDDEN = "hidden"
    ARCHIVED = "archived"
    DELETED = "deleted"


@dataclass
class AnnotationConfig:
    """Annotation system configuration."""
    max_annotations_per_document: int = 1000
    max_annotation_length: int = 100000
    max_layers_per_document: int = 20
    default_visibility: AnnotationVisibility = AnnotationVisibility.PUBLIC
    allow_overlapping: bool = True
    track_history: bool = True


@dataclass
class AnnotationRange:
    """Range of an annotation in a document."""
    start: int
    end: int

    def overlaps(self, other: "AnnotationRange") -> bool:
        """Check if ranges overlap."""
        return self.start < other.end and other.start < self.end

    def contains(self, position: int) -> bool:
        """Check if position is within range."""
        return self.start <= position < self.end

    def length(self) -> int:
        """Get range length."""
        return self.end - self.start

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {"start": self.start, "end": self.end}

    @classmethod
    def from_dict(cls, data: dict) -> "AnnotationRange":
        """Create from dictionary."""
        return cls(start=data["start"], end=data["end"])


@dataclass
class AnnotationStyle:
    """Visual style for an annotation."""
    color: Optional[str] = None
    background_color: Optional[str] = None
    border_color: Optional[str] = None
    font_weight: Optional[str] = None
    font_style: Optional[str] = None
    text_decoration: Optional[str] = None
    opacity: Optional[float] = None
    custom: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        result = {}
        if self.color:
            result["color"] = self.color
        if self.background_color:
            result["background_color"] = self.background_color
        if self.border_color:
            result["border_color"] = self.border_color
        if self.font_weight:
            result["font_weight"] = self.font_weight
        if self.font_style:
            result["font_style"] = self.font_style
        if self.text_decoration:
            result["text_decoration"] = self.text_decoration
        if self.opacity is not None:
            result["opacity"] = self.opacity
        if self.custom:
            result["custom"] = self.custom
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "AnnotationStyle":
        """Create from dictionary."""
        return cls(
            color=data.get("color"),
            background_color=data.get("background_color"),
            border_color=data.get("border_color"),
            font_weight=data.get("font_weight"),
            font_style=data.get("font_style"),
            text_decoration=data.get("text_decoration"),
            opacity=data.get("opacity"),
            custom=data.get("custom", {}),
        )


@dataclass
class Annotation:
    """An annotation on a document."""
    id: str
    document_id: str
    author_id: str
    annotation_type: AnnotationType
    range: AnnotationRange
    state: AnnotationState
    visibility: AnnotationVisibility
    created_at: datetime
    updated_at: datetime
    layer_id: Optional[str] = None
    label: Optional[str] = None
    note: Optional[str] = None
    link_url: Optional[str] = None
    comment_id: Optional[str] = None  # Link to comment
    style: Optional[AnnotationStyle] = None
    shared_with: Set[str] = field(default_factory=set)
    metadata: dict = field(default_factory=dict)

    def is_visible_to(self, user_id: str) -> bool:
        """Check if annotation is visible to user."""
        if self.state != AnnotationState.ACTIVE:
            return False

        if self.visibility == AnnotationVisibility.PUBLIC:
            return True
        if self.visibility == AnnotationVisibility.PRIVATE:
            return user_id == self.author_id
        if self.visibility == AnnotationVisibility.SHARED:
            return user_id == self.author_id or user_id in self.shared_with

        return False

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "author_id": self.author_id,
            "annotation_type": self.annotation_type.value,
            "range": self.range.to_dict(),
            "state": self.state.value,
            "visibility": self.visibility.value,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "layer_id": self.layer_id,
            "label": self.label,
            "note": self.note,
            "link_url": self.link_url,
            "comment_id": self.comment_id,
            "style": self.style.to_dict() if self.style else None,
            "shared_with": list(self.shared_with),
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Annotation":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            author_id=data["author_id"],
            annotation_type=AnnotationType(data["annotation_type"]),
            range=AnnotationRange.from_dict(data["range"]),
            state=AnnotationState(data["state"]),
            visibility=AnnotationVisibility(data["visibility"]),
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            layer_id=data.get("layer_id"),
            label=data.get("label"),
            note=data.get("note"),
            link_url=data.get("link_url"),
            comment_id=data.get("comment_id"),
            style=AnnotationStyle.from_dict(data["style"]) if data.get("style") else None,
            shared_with=set(data.get("shared_with", [])),
            metadata=data.get("metadata", {}),
        )


@dataclass
class AnnotationLayer:
    """A layer grouping related annotations."""
    id: str
    document_id: str
    name: str
    description: Optional[str] = None
    color: Optional[str] = None
    visibility: AnnotationVisibility = AnnotationVisibility.PUBLIC
    author_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    order: int = 0
    metadata: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "document_id": self.document_id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "visibility": self.visibility.value,
            "author_id": self.author_id,
            "created_at": self.created_at.isoformat(),
            "order": self.order,
            "metadata": self.metadata,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AnnotationLayer":
        """Create from dictionary."""
        return cls(
            id=data["id"],
            document_id=data["document_id"],
            name=data["name"],
            description=data.get("description"),
            color=data.get("color"),
            visibility=AnnotationVisibility(data.get("visibility", "public")),
            author_id=data.get("author_id"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else datetime.utcnow(),
            order=data.get("order", 0),
            metadata=data.get("metadata", {}),
        )


class AnnotationManager:
    """Manages document annotations."""

    def __init__(self, config: Optional[AnnotationConfig] = None):
        self.config = config or AnnotationConfig()
        self._annotations: Dict[str, Annotation] = {}  # annotation_id -> Annotation
        self._document_annotations: Dict[str, Set[str]] = defaultdict(set)  # doc_id -> annotation_ids
        self._layers: Dict[str, AnnotationLayer] = {}  # layer_id -> Layer
        self._document_layers: Dict[str, Set[str]] = defaultdict(set)  # doc_id -> layer_ids
        self._lock = asyncio.Lock()

        # Callbacks
        self.on_annotation_created: Optional[
            Callable[[Annotation], Awaitable[None]]
        ] = None
        self.on_annotation_updated: Optional[
            Callable[[Annotation], Awaitable[None]]
        ] = None
        self.on_annotation_deleted: Optional[
            Callable[[Annotation], Awaitable[None]]
        ] = None

        # Stats
        self._annotations_created = 0
        self._annotations_deleted = 0

    async def create_annotation(
        self,
        document_id: str,
        author_id: str,
        annotation_type: AnnotationType,
        start: int,
        end: int,
        visibility: Optional[AnnotationVisibility] = None,
        layer_id: Optional[str] = None,
        label: Optional[str] = None,
        note: Optional[str] = None,
        link_url: Optional[str] = None,
        comment_id: Optional[str] = None,
        style: Optional[AnnotationStyle] = None,
        shared_with: Optional[Set[str]] = None,
        metadata: Optional[dict] = None
    ) -> Annotation:
        """Create a new annotation."""
        # Validate limits
        if len(self._document_annotations.get(document_id, set())) >= self.config.max_annotations_per_document:
            raise ValueError("Document has reached max annotations")

        # Validate layer
        if layer_id and layer_id not in self._layers:
            raise ValueError("Layer not found")

        # Validate range
        if end - start > self.config.max_annotation_length:
            raise ValueError("Annotation range too large")

        now = datetime.utcnow()
        annotation_id = f"ann_{secrets.token_hex(12)}"

        annotation = Annotation(
            id=annotation_id,
            document_id=document_id,
            author_id=author_id,
            annotation_type=annotation_type,
            range=AnnotationRange(start=start, end=end),
            state=AnnotationState.ACTIVE,
            visibility=visibility or self.config.default_visibility,
            created_at=now,
            updated_at=now,
            layer_id=layer_id,
            label=label,
            note=note,
            link_url=link_url,
            comment_id=comment_id,
            style=style,
            shared_with=shared_with or set(),
            metadata=metadata or {},
        )

        async with self._lock:
            self._annotations[annotation_id] = annotation
            self._document_annotations[document_id].add(annotation_id)
            self._annotations_created += 1

        if self.on_annotation_created:
            try:
                await self.on_annotation_created(annotation)
            except Exception as e:
                logger.error(f"Annotation created callback error: {e}")

        return annotation

    async def update_annotation(
        self,
        annotation_id: str,
        user_id: str,
        start: Optional[int] = None,
        end: Optional[int] = None,
        label: Optional[str] = None,
        note: Optional[str] = None,
        style: Optional[AnnotationStyle] = None,
        visibility: Optional[AnnotationVisibility] = None
    ) -> Optional[Annotation]:
        """Update an annotation."""
        annotation = self._annotations.get(annotation_id)
        if not annotation:
            return None

        # Only author can update
        if annotation.author_id != user_id:
            return None

        async with self._lock:
            if start is not None and end is not None:
                annotation.range = AnnotationRange(start=start, end=end)
            if label is not None:
                annotation.label = label
            if note is not None:
                annotation.note = note
            if style is not None:
                annotation.style = style
            if visibility is not None:
                annotation.visibility = visibility

            annotation.updated_at = datetime.utcnow()

        if self.on_annotation_updated:
            try:
                await self.on_annotation_updated(annotation)
            except Exception as e:
                logger.error(f"Annotation updated callback error: {e}")

        return annotation

    async def delete_annotation(
        self,
        annotation_id: str,
        user_id: str
    ) -> bool:
        """Delete an annotation."""
        annotation = self._annotations.get(annotation_id)
        if not annotation:
            return False

        if annotation.author_id != user_id:
            return False

        async with self._lock:
            annotation.state = AnnotationState.DELETED
            annotation.updated_at = datetime.utcnow()
            self._annotations_deleted += 1

        if self.on_annotation_deleted:
            try:
                await self.on_annotation_deleted(annotation)
            except Exception as e:
                logger.error(f"Annotation deleted callback error: {e}")

        return True

    async def share_annotation(
        self,
        annotation_id: str,
        user_id: str,
        share_with: Set[str]
    ) -> Optional[Annotation]:
        """Share an annotation with specific users."""
        annotation = self._annotations.get(annotation_id)
        if not annotation:
            return None

        if annotation.author_id != user_id:
            return None

        async with self._lock:
            annotation.shared_with.update(share_with)
            annotation.visibility = AnnotationVisibility.SHARED
            annotation.updated_at = datetime.utcnow()

        return annotation

    async def unshare_annotation(
        self,
        annotation_id: str,
        user_id: str,
        unshare_with: Set[str]
    ) -> Optional[Annotation]:
        """Remove sharing from specific users."""
        annotation = self._annotations.get(annotation_id)
        if not annotation:
            return None

        if annotation.author_id != user_id:
            return None

        async with self._lock:
            annotation.shared_with -= unshare_with
            annotation.updated_at = datetime.utcnow()

        return annotation

    def get_annotation(self, annotation_id: str) -> Optional[Annotation]:
        """Get an annotation by ID."""
        return self._annotations.get(annotation_id)

    def get_document_annotations(
        self,
        document_id: str,
        user_id: str,
        annotation_type: Optional[AnnotationType] = None,
        layer_id: Optional[str] = None,
        include_hidden: bool = False
    ) -> List[Annotation]:
        """Get annotations for a document visible to user."""
        annotation_ids = self._document_annotations.get(document_id, set())
        annotations = []

        for aid in annotation_ids:
            annotation = self._annotations.get(aid)
            if not annotation:
                continue

            if not annotation.is_visible_to(user_id):
                continue

            if not include_hidden and annotation.state == AnnotationState.HIDDEN:
                continue

            if annotation_type and annotation.annotation_type != annotation_type:
                continue

            if layer_id and annotation.layer_id != layer_id:
                continue

            annotations.append(annotation)

        # Sort by position
        annotations.sort(key=lambda a: a.range.start)
        return annotations

    def get_annotations_at_position(
        self,
        document_id: str,
        user_id: str,
        position: int
    ) -> List[Annotation]:
        """Get annotations at a specific position."""
        annotations = self.get_document_annotations(document_id, user_id)
        return [a for a in annotations if a.range.contains(position)]

    def get_annotations_in_range(
        self,
        document_id: str,
        user_id: str,
        start: int,
        end: int
    ) -> List[Annotation]:
        """Get annotations overlapping a range."""
        annotations = self.get_document_annotations(document_id, user_id)
        range_to_check = AnnotationRange(start=start, end=end)
        return [a for a in annotations if a.range.overlaps(range_to_check)]

    # Layer management

    async def create_layer(
        self,
        document_id: str,
        name: str,
        author_id: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        visibility: AnnotationVisibility = AnnotationVisibility.PUBLIC,
        metadata: Optional[dict] = None
    ) -> AnnotationLayer:
        """Create an annotation layer."""
        if len(self._document_layers.get(document_id, set())) >= self.config.max_layers_per_document:
            raise ValueError("Document has reached max layers")

        layer_id = f"layer_{secrets.token_hex(8)}"

        # Determine order
        existing_layers = self._document_layers.get(document_id, set())
        order = len(existing_layers)

        layer = AnnotationLayer(
            id=layer_id,
            document_id=document_id,
            name=name,
            description=description,
            color=color,
            visibility=visibility,
            author_id=author_id,
            created_at=datetime.utcnow(),
            order=order,
            metadata=metadata or {},
        )

        async with self._lock:
            self._layers[layer_id] = layer
            self._document_layers[document_id].add(layer_id)

        return layer

    async def update_layer(
        self,
        layer_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        color: Optional[str] = None,
        visibility: Optional[AnnotationVisibility] = None
    ) -> Optional[AnnotationLayer]:
        """Update a layer."""
        layer = self._layers.get(layer_id)
        if not layer:
            return None

        async with self._lock:
            if name is not None:
                layer.name = name
            if description is not None:
                layer.description = description
            if color is not None:
                layer.color = color
            if visibility is not None:
                layer.visibility = visibility

        return layer

    async def delete_layer(self, layer_id: str) -> bool:
        """Delete a layer and its annotations."""
        layer = self._layers.get(layer_id)
        if not layer:
            return False

        async with self._lock:
            # Remove all annotations in this layer
            for annotation in list(self._annotations.values()):
                if annotation.layer_id == layer_id:
                    annotation.state = AnnotationState.DELETED

            self._layers.pop(layer_id, None)
            self._document_layers[layer.document_id].discard(layer_id)

        return True

    def get_layer(self, layer_id: str) -> Optional[AnnotationLayer]:
        """Get a layer by ID."""
        return self._layers.get(layer_id)

    def get_document_layers(self, document_id: str) -> List[AnnotationLayer]:
        """Get all layers for a document."""
        layer_ids = self._document_layers.get(document_id, set())
        layers = [
            self._layers[lid]
            for lid in layer_ids
            if lid in self._layers
        ]
        layers.sort(key=lambda l: l.order)
        return layers

    def get_layer_annotations(
        self,
        layer_id: str,
        user_id: str
    ) -> List[Annotation]:
        """Get all annotations in a layer."""
        layer = self._layers.get(layer_id)
        if not layer:
            return []

        return self.get_document_annotations(
            layer.document_id,
            user_id,
            layer_id=layer_id,
        )

    def get_stats(self) -> dict:
        """Get annotation manager statistics."""
        active = sum(
            1 for a in self._annotations.values()
            if a.state == AnnotationState.ACTIVE
        )
        by_type = defaultdict(int)
        for a in self._annotations.values():
            if a.state == AnnotationState.ACTIVE:
                by_type[a.annotation_type.value] += 1

        return {
            "total_annotations": len(self._annotations),
            "active_annotations": active,
            "annotations_created": self._annotations_created,
            "annotations_deleted": self._annotations_deleted,
            "documents_with_annotations": len(self._document_annotations),
            "total_layers": len(self._layers),
            "by_type": dict(by_type),
        }


# Global annotation manager
_annotation_manager: Optional[AnnotationManager] = None


def get_annotation_manager() -> AnnotationManager:
    """Get global annotation manager."""
    global _annotation_manager
    if _annotation_manager is None:
        _annotation_manager = AnnotationManager()
    return _annotation_manager


def set_annotation_manager(manager: AnnotationManager) -> None:
    """Set global annotation manager."""
    global _annotation_manager
    _annotation_manager = manager


def reset_annotation_manager() -> None:
    """Reset global annotation manager."""
    global _annotation_manager
    _annotation_manager = None
