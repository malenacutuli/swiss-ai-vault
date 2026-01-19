"""
Storage Backends for Document Persistence

Provides abstract storage interface and implementations:
- InMemoryStorage: Fast, non-persistent storage for testing
- FileStorage: File-based persistent storage
- StorageManager: Manages multiple storage backends with fallback

Supports:
- Document content storage
- Metadata storage
- Versioned snapshots
- Compression and encryption hooks
"""

from __future__ import annotations

import asyncio
import json
import hashlib
import gzip
import os
import shutil
from abc import ABC, abstractmethod
from typing import Optional, Any, Callable, TypeVar
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from enum import Enum

import logging

logger = logging.getLogger(__name__)

T = TypeVar("T")


class StorageType(Enum):
    """Types of storage backends."""
    MEMORY = "memory"
    FILE = "file"
    REDIS = "redis"
    S3 = "s3"


class StorageError(Exception):
    """Base storage error."""
    pass


class DocumentNotFoundError(StorageError):
    """Document not found in storage."""
    pass


class StorageFullError(StorageError):
    """Storage capacity exceeded."""
    pass


class StorageCorruptionError(StorageError):
    """Data corruption detected."""
    pass


@dataclass
class StorageConfig:
    """Storage configuration."""
    max_document_size: int = 10 * 1024 * 1024  # 10MB
    max_total_size: int = 1024 * 1024 * 1024  # 1GB
    compression_enabled: bool = True
    compression_threshold: int = 1024  # Compress if > 1KB
    checksum_enabled: bool = True
    encryption_enabled: bool = False
    encryption_key: Optional[bytes] = None
    auto_cleanup: bool = True
    cleanup_interval: float = 3600.0  # 1 hour
    max_age: Optional[timedelta] = None


@dataclass
class StorageMetadata:
    """Metadata for stored document."""
    document_id: str
    version: int
    content_hash: str
    size: int
    compressed: bool
    encrypted: bool
    created_at: datetime
    updated_at: datetime
    content_type: str = "text/plain"
    custom: dict = field(default_factory=dict)

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "document_id": self.document_id,
            "version": self.version,
            "content_hash": self.content_hash,
            "size": self.size,
            "compressed": self.compressed,
            "encrypted": self.encrypted,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "content_type": self.content_type,
            "custom": self.custom,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "StorageMetadata":
        """Create from dictionary."""
        return cls(
            document_id=data["document_id"],
            version=data["version"],
            content_hash=data["content_hash"],
            size=data["size"],
            compressed=data["compressed"],
            encrypted=data["encrypted"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            content_type=data.get("content_type", "text/plain"),
            custom=data.get("custom", {}),
        )


@dataclass
class StoredDocument:
    """A stored document with content and metadata."""
    content: str
    metadata: StorageMetadata


class StorageBackend(ABC):
    """Abstract storage backend interface."""

    @abstractmethod
    async def save(
        self,
        document_id: str,
        content: str,
        version: int,
        metadata: Optional[dict] = None
    ) -> StorageMetadata:
        """Save document content."""
        pass

    @abstractmethod
    async def load(self, document_id: str) -> StoredDocument:
        """Load document content and metadata."""
        pass

    @abstractmethod
    async def delete(self, document_id: str) -> bool:
        """Delete document."""
        pass

    @abstractmethod
    async def exists(self, document_id: str) -> bool:
        """Check if document exists."""
        pass

    @abstractmethod
    async def list_documents(
        self,
        prefix: Optional[str] = None,
        limit: int = 100
    ) -> list[str]:
        """List document IDs."""
        pass

    @abstractmethod
    async def get_metadata(self, document_id: str) -> StorageMetadata:
        """Get document metadata without loading content."""
        pass

    @abstractmethod
    async def get_stats(self) -> dict:
        """Get storage statistics."""
        pass


class InMemoryStorage(StorageBackend):
    """In-memory storage backend for testing and caching."""

    def __init__(self, config: Optional[StorageConfig] = None):
        self.config = config or StorageConfig()
        self._documents: dict[str, bytes] = {}
        self._metadata: dict[str, StorageMetadata] = {}
        self._lock = asyncio.Lock()
        self._total_size = 0

    async def save(
        self,
        document_id: str,
        content: str,
        version: int,
        metadata: Optional[dict] = None
    ) -> StorageMetadata:
        """Save document to memory."""
        content_bytes = content.encode("utf-8")

        # Check size limits
        if len(content_bytes) > self.config.max_document_size:
            raise StorageError(
                f"Document exceeds max size: {len(content_bytes)} > "
                f"{self.config.max_document_size}"
            )

        # Compress if enabled and above threshold
        compressed = False
        if (self.config.compression_enabled and
                len(content_bytes) > self.config.compression_threshold):
            content_bytes = gzip.compress(content_bytes)
            compressed = True

        # Calculate checksum
        content_hash = ""
        if self.config.checksum_enabled:
            content_hash = hashlib.sha256(content_bytes).hexdigest()

        now = datetime.utcnow()
        meta = StorageMetadata(
            document_id=document_id,
            version=version,
            content_hash=content_hash,
            size=len(content_bytes),
            compressed=compressed,
            encrypted=False,
            created_at=now,
            updated_at=now,
            custom=metadata or {},
        )

        async with self._lock:
            # Check total size
            old_size = len(self._documents.get(document_id, b""))
            new_total = self._total_size - old_size + len(content_bytes)

            if new_total > self.config.max_total_size:
                raise StorageFullError(
                    f"Storage full: {new_total} > {self.config.max_total_size}"
                )

            # Update created_at if document exists
            if document_id in self._metadata:
                meta.created_at = self._metadata[document_id].created_at

            self._documents[document_id] = content_bytes
            self._metadata[document_id] = meta
            self._total_size = new_total

        return meta

    async def load(self, document_id: str) -> StoredDocument:
        """Load document from memory."""
        async with self._lock:
            if document_id not in self._documents:
                raise DocumentNotFoundError(f"Document not found: {document_id}")

            content_bytes = self._documents[document_id]
            meta = self._metadata[document_id]

        # Verify checksum
        if self.config.checksum_enabled and meta.content_hash:
            actual_hash = hashlib.sha256(content_bytes).hexdigest()
            if actual_hash != meta.content_hash:
                raise StorageCorruptionError(
                    f"Checksum mismatch for {document_id}"
                )

        # Decompress if needed
        if meta.compressed:
            content_bytes = gzip.decompress(content_bytes)

        return StoredDocument(
            content=content_bytes.decode("utf-8"),
            metadata=meta,
        )

    async def delete(self, document_id: str) -> bool:
        """Delete document from memory."""
        async with self._lock:
            if document_id not in self._documents:
                return False

            size = len(self._documents[document_id])
            del self._documents[document_id]
            del self._metadata[document_id]
            self._total_size -= size

        return True

    async def exists(self, document_id: str) -> bool:
        """Check if document exists."""
        return document_id in self._documents

    async def list_documents(
        self,
        prefix: Optional[str] = None,
        limit: int = 100
    ) -> list[str]:
        """List document IDs."""
        docs = list(self._documents.keys())

        if prefix:
            docs = [d for d in docs if d.startswith(prefix)]

        docs.sort()
        return docs[:limit]

    async def get_metadata(self, document_id: str) -> StorageMetadata:
        """Get document metadata."""
        if document_id not in self._metadata:
            raise DocumentNotFoundError(f"Document not found: {document_id}")
        return self._metadata[document_id]

    async def get_stats(self) -> dict:
        """Get storage statistics."""
        return {
            "type": "memory",
            "document_count": len(self._documents),
            "total_size": self._total_size,
            "max_size": self.config.max_total_size,
            "utilization": self._total_size / self.config.max_total_size
            if self.config.max_total_size > 0 else 0,
        }

    async def clear(self) -> int:
        """Clear all documents."""
        async with self._lock:
            count = len(self._documents)
            self._documents.clear()
            self._metadata.clear()
            self._total_size = 0
        return count


class FileStorage(StorageBackend):
    """File-based persistent storage backend."""

    def __init__(
        self,
        base_path: str,
        config: Optional[StorageConfig] = None
    ):
        self.base_path = Path(base_path)
        self.config = config or StorageConfig()
        self._lock = asyncio.Lock()

        # Create directories
        self.base_path.mkdir(parents=True, exist_ok=True)
        (self.base_path / "documents").mkdir(exist_ok=True)
        (self.base_path / "metadata").mkdir(exist_ok=True)

    def _doc_path(self, document_id: str) -> Path:
        """Get document file path."""
        safe_id = document_id.replace("/", "_").replace("\\", "_")
        return self.base_path / "documents" / f"{safe_id}.dat"

    def _meta_path(self, document_id: str) -> Path:
        """Get metadata file path."""
        safe_id = document_id.replace("/", "_").replace("\\", "_")
        return self.base_path / "metadata" / f"{safe_id}.json"

    async def save(
        self,
        document_id: str,
        content: str,
        version: int,
        metadata: Optional[dict] = None
    ) -> StorageMetadata:
        """Save document to file."""
        content_bytes = content.encode("utf-8")

        # Check size limits
        if len(content_bytes) > self.config.max_document_size:
            raise StorageError(
                f"Document exceeds max size: {len(content_bytes)} > "
                f"{self.config.max_document_size}"
            )

        # Compress if enabled
        compressed = False
        if (self.config.compression_enabled and
                len(content_bytes) > self.config.compression_threshold):
            content_bytes = gzip.compress(content_bytes)
            compressed = True

        # Calculate checksum
        content_hash = ""
        if self.config.checksum_enabled:
            content_hash = hashlib.sha256(content_bytes).hexdigest()

        now = datetime.utcnow()

        # Check if updating existing document
        doc_path = self._doc_path(document_id)
        meta_path = self._meta_path(document_id)

        created_at = now
        if meta_path.exists():
            try:
                existing = json.loads(meta_path.read_text())
                created_at = datetime.fromisoformat(existing["created_at"])
            except Exception:
                pass

        meta = StorageMetadata(
            document_id=document_id,
            version=version,
            content_hash=content_hash,
            size=len(content_bytes),
            compressed=compressed,
            encrypted=False,
            created_at=created_at,
            updated_at=now,
            custom=metadata or {},
        )

        async with self._lock:
            # Write document
            doc_path.write_bytes(content_bytes)

            # Write metadata
            meta_path.write_text(json.dumps(meta.to_dict(), indent=2))

        return meta

    async def load(self, document_id: str) -> StoredDocument:
        """Load document from file."""
        doc_path = self._doc_path(document_id)
        meta_path = self._meta_path(document_id)

        if not doc_path.exists():
            raise DocumentNotFoundError(f"Document not found: {document_id}")

        # Load metadata
        meta_data = json.loads(meta_path.read_text())
        meta = StorageMetadata.from_dict(meta_data)

        # Load content
        content_bytes = doc_path.read_bytes()

        # Verify checksum
        if self.config.checksum_enabled and meta.content_hash:
            actual_hash = hashlib.sha256(content_bytes).hexdigest()
            if actual_hash != meta.content_hash:
                raise StorageCorruptionError(
                    f"Checksum mismatch for {document_id}"
                )

        # Decompress if needed
        if meta.compressed:
            content_bytes = gzip.decompress(content_bytes)

        return StoredDocument(
            content=content_bytes.decode("utf-8"),
            metadata=meta,
        )

    async def delete(self, document_id: str) -> bool:
        """Delete document file."""
        doc_path = self._doc_path(document_id)
        meta_path = self._meta_path(document_id)

        if not doc_path.exists():
            return False

        async with self._lock:
            doc_path.unlink(missing_ok=True)
            meta_path.unlink(missing_ok=True)

        return True

    async def exists(self, document_id: str) -> bool:
        """Check if document exists."""
        return self._doc_path(document_id).exists()

    async def list_documents(
        self,
        prefix: Optional[str] = None,
        limit: int = 100
    ) -> list[str]:
        """List document IDs."""
        docs_dir = self.base_path / "documents"
        docs = []

        for path in docs_dir.glob("*.dat"):
            doc_id = path.stem.replace("_", "/")
            if prefix is None or doc_id.startswith(prefix):
                docs.append(doc_id)

        docs.sort()
        return docs[:limit]

    async def get_metadata(self, document_id: str) -> StorageMetadata:
        """Get document metadata."""
        meta_path = self._meta_path(document_id)

        if not meta_path.exists():
            raise DocumentNotFoundError(f"Document not found: {document_id}")

        meta_data = json.loads(meta_path.read_text())
        return StorageMetadata.from_dict(meta_data)

    async def get_stats(self) -> dict:
        """Get storage statistics."""
        docs_dir = self.base_path / "documents"

        total_size = 0
        doc_count = 0

        for path in docs_dir.glob("*.dat"):
            total_size += path.stat().st_size
            doc_count += 1

        return {
            "type": "file",
            "base_path": str(self.base_path),
            "document_count": doc_count,
            "total_size": total_size,
            "max_size": self.config.max_total_size,
            "utilization": total_size / self.config.max_total_size
            if self.config.max_total_size > 0 else 0,
        }

    async def cleanup(self, max_age: Optional[timedelta] = None) -> int:
        """Remove old documents."""
        if max_age is None:
            max_age = self.config.max_age

        if max_age is None:
            return 0

        cutoff = datetime.utcnow() - max_age
        removed = 0

        meta_dir = self.base_path / "metadata"

        async with self._lock:
            for meta_path in meta_dir.glob("*.json"):
                try:
                    meta_data = json.loads(meta_path.read_text())
                    updated = datetime.fromisoformat(meta_data["updated_at"])

                    if updated < cutoff:
                        doc_id = meta_path.stem.replace("_", "/")
                        doc_path = self._doc_path(doc_id)

                        doc_path.unlink(missing_ok=True)
                        meta_path.unlink(missing_ok=True)
                        removed += 1
                except Exception as e:
                    logger.warning(f"Error cleaning up {meta_path}: {e}")

        return removed


class StorageManager:
    """Manages multiple storage backends with fallback support."""

    def __init__(
        self,
        primary: StorageBackend,
        secondary: Optional[StorageBackend] = None,
        config: Optional[StorageConfig] = None
    ):
        self.primary = primary
        self.secondary = secondary
        self.config = config or StorageConfig()
        self._running = False
        self._cleanup_task: Optional[asyncio.Task] = None

        # Stats
        self._reads = 0
        self._writes = 0
        self._deletes = 0
        self._fallback_reads = 0
        self._errors = 0

    async def start(self) -> None:
        """Start background tasks."""
        if self._running:
            return

        self._running = True

        if self.config.auto_cleanup:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())

    async def stop(self) -> None:
        """Stop background tasks."""
        self._running = False

        if self._cleanup_task:
            self._cleanup_task.cancel()
            try:
                await self._cleanup_task
            except asyncio.CancelledError:
                pass

    async def _cleanup_loop(self) -> None:
        """Periodic cleanup of old documents."""
        while self._running:
            try:
                await asyncio.sleep(self.config.cleanup_interval)

                # Cleanup primary if it supports it
                if hasattr(self.primary, "cleanup"):
                    await self.primary.cleanup()

                # Cleanup secondary if it supports it
                if self.secondary and hasattr(self.secondary, "cleanup"):
                    await self.secondary.cleanup()

            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.error(f"Cleanup error: {e}")

    async def save(
        self,
        document_id: str,
        content: str,
        version: int,
        metadata: Optional[dict] = None
    ) -> StorageMetadata:
        """Save document to primary (and optionally secondary)."""
        self._writes += 1

        try:
            meta = await self.primary.save(document_id, content, version, metadata)

            # Also save to secondary for redundancy
            if self.secondary:
                try:
                    await self.secondary.save(document_id, content, version, metadata)
                except Exception as e:
                    logger.warning(f"Secondary save failed: {e}")

            return meta

        except Exception as e:
            self._errors += 1
            raise

    async def load(self, document_id: str) -> StoredDocument:
        """Load document from primary (fallback to secondary)."""
        self._reads += 1

        try:
            return await self.primary.load(document_id)
        except DocumentNotFoundError:
            # Try secondary
            if self.secondary:
                try:
                    self._fallback_reads += 1
                    doc = await self.secondary.load(document_id)

                    # Restore to primary
                    await self.primary.save(
                        document_id,
                        doc.content,
                        doc.metadata.version,
                        doc.metadata.custom
                    )

                    return doc
                except DocumentNotFoundError:
                    pass

            raise
        except Exception as e:
            self._errors += 1

            # Try secondary on error
            if self.secondary:
                try:
                    self._fallback_reads += 1
                    return await self.secondary.load(document_id)
                except Exception:
                    pass

            raise

    async def delete(self, document_id: str) -> bool:
        """Delete document from all backends."""
        self._deletes += 1

        primary_deleted = await self.primary.delete(document_id)

        if self.secondary:
            try:
                await self.secondary.delete(document_id)
            except Exception as e:
                logger.warning(f"Secondary delete failed: {e}")

        return primary_deleted

    async def exists(self, document_id: str) -> bool:
        """Check if document exists in any backend."""
        if await self.primary.exists(document_id):
            return True

        if self.secondary:
            return await self.secondary.exists(document_id)

        return False

    async def list_documents(
        self,
        prefix: Optional[str] = None,
        limit: int = 100
    ) -> list[str]:
        """List documents from primary backend."""
        return await self.primary.list_documents(prefix, limit)

    async def get_metadata(self, document_id: str) -> StorageMetadata:
        """Get document metadata."""
        try:
            return await self.primary.get_metadata(document_id)
        except DocumentNotFoundError:
            if self.secondary:
                return await self.secondary.get_metadata(document_id)
            raise

    def get_stats(self) -> dict:
        """Get manager statistics."""
        return {
            "reads": self._reads,
            "writes": self._writes,
            "deletes": self._deletes,
            "fallback_reads": self._fallback_reads,
            "errors": self._errors,
            "running": self._running,
        }

    async def get_full_stats(self) -> dict:
        """Get full statistics including backends."""
        stats = self.get_stats()
        stats["primary"] = await self.primary.get_stats()

        if self.secondary:
            stats["secondary"] = await self.secondary.get_stats()

        return stats


# Global storage instance
_storage: Optional[StorageManager] = None


def get_storage() -> Optional[StorageManager]:
    """Get global storage instance."""
    return _storage


def set_storage(storage: StorageManager) -> None:
    """Set global storage instance."""
    global _storage
    _storage = storage


def reset_storage() -> None:
    """Reset global storage instance."""
    global _storage
    _storage = None
