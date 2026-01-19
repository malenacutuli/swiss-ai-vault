"""
Prompt Version Manager

Production-grade prompt versioning with Supabase persistence.
Manages prompt versions, activation, and rollback capability.
"""

import logging
from typing import Dict, Any, List, Optional
from datetime import datetime
from enum import Enum
from supabase import Client
import structlog

logger = structlog.get_logger()


class PromptStatus(str, Enum):
    """Prompt version status"""
    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"
    DEPRECATED = "deprecated"


class PromptVersion:
    """Represents a prompt version"""

    def __init__(
        self,
        prompt_id: str,
        version: int,
        content: str,
        system_prompt: str,
        metadata: Optional[Dict[str, Any]] = None,
        status: str = "draft",
        created_at: Optional[str] = None,
        id: Optional[str] = None
    ):
        """
        Initialize prompt version.

        Args:
            prompt_id: Unique prompt identifier
            version: Version number
            content: Prompt content
            system_prompt: System prompt
            metadata: Additional metadata
            status: Version status
            created_at: Creation timestamp
            id: Database ID
        """
        self.id = id
        self.prompt_id = prompt_id
        self.version = version
        self.content = content
        self.system_prompt = system_prompt
        self.metadata = metadata or {}
        self.status = PromptStatus(status) if isinstance(status, str) else status
        self.created_at = created_at or datetime.utcnow().isoformat()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for storage/API"""
        return {
            "id": self.id,
            "prompt_id": self.prompt_id,
            "version": self.version,
            "content": self.content,
            "system_prompt": self.system_prompt,
            "metadata": self.metadata,
            "status": self.status.value,
            "created_at": self.created_at
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PromptVersion":
        """Create from dictionary"""
        return cls(
            id=data.get("id"),
            prompt_id=data["prompt_id"],
            version=data["version"],
            content=data["content"],
            system_prompt=data["system_prompt"],
            metadata=data.get("metadata", {}),
            status=data.get("status", "draft"),
            created_at=data.get("created_at")
        )


class PromptVersionManager:
    """
    Manage prompt versions with Supabase persistence.

    Provides versioning, activation, and rollback capabilities
    for production-grade prompt management.
    """

    def __init__(self, supabase: Client):
        """
        Initialize version manager.

        Args:
            supabase: Supabase client for persistence
        """
        self.supabase = supabase
        self.table_name = "prompt_versions"

    async def create_version(
        self,
        prompt_id: str,
        content: str,
        system_prompt: str,
        metadata: Optional[Dict[str, Any]] = None,
        user_id: Optional[str] = None
    ) -> PromptVersion:
        """
        Create new prompt version.

        Args:
            prompt_id: Unique prompt identifier
            content: Prompt content
            system_prompt: System prompt
            metadata: Additional metadata
            user_id: User creating the version

        Returns:
            Created prompt version
        """
        # Get next version number
        versions = await self.list_versions(prompt_id)
        next_version = len(versions) + 1

        # Create version object
        version_data = {
            "prompt_id": prompt_id,
            "version": next_version,
            "content": content,
            "system_prompt": system_prompt,
            "metadata": metadata or {},
            "status": PromptStatus.DRAFT.value,
            "created_at": datetime.utcnow().isoformat(),
            "created_by": user_id
        }

        # Insert into database
        result = self.supabase.table(self.table_name).insert(version_data).execute()

        if not result.data:
            raise Exception("Failed to create prompt version")

        version = PromptVersion.from_dict(result.data[0])

        logger.info(
            "prompt_version_created",
            prompt_id=prompt_id,
            version=next_version,
            user_id=user_id
        )

        return version

    async def get_version(
        self,
        prompt_id: str,
        version: Optional[int] = None
    ) -> Optional[PromptVersion]:
        """
        Get specific prompt version.

        Args:
            prompt_id: Prompt identifier
            version: Version number (None = latest)

        Returns:
            Prompt version or None if not found
        """
        query = self.supabase.table(self.table_name).select("*").eq("prompt_id", prompt_id)

        if version is not None:
            query = query.eq("version", version)
        else:
            # Get latest version
            query = query.order("version", desc=True).limit(1)

        result = query.execute()

        if not result.data:
            return None

        return PromptVersion.from_dict(result.data[0])

    async def get_active_version(self, prompt_id: str) -> Optional[PromptVersion]:
        """
        Get active prompt version.

        Args:
            prompt_id: Prompt identifier

        Returns:
            Active version or None
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "prompt_id", prompt_id
        ).eq(
            "status", PromptStatus.ACTIVE.value
        ).execute()

        if not result.data:
            return None

        return PromptVersion.from_dict(result.data[0])

    async def activate_version(
        self,
        prompt_id: str,
        version: int,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Activate specific version (deactivates others).

        Args:
            prompt_id: Prompt identifier
            version: Version number to activate
            user_id: User activating the version

        Returns:
            Success status
        """
        # Verify version exists
        target_version = await self.get_version(prompt_id, version)
        if not target_version:
            logger.error("version_not_found", prompt_id=prompt_id, version=version)
            return False

        # Deactivate all other versions
        self.supabase.table(self.table_name).update({
            "status": PromptStatus.ARCHIVED.value
        }).eq("prompt_id", prompt_id).eq("status", PromptStatus.ACTIVE.value).execute()

        # Activate target version
        self.supabase.table(self.table_name).update({
            "status": PromptStatus.ACTIVE.value
        }).eq("prompt_id", prompt_id).eq("version", version).execute()

        logger.info(
            "prompt_version_activated",
            prompt_id=prompt_id,
            version=version,
            user_id=user_id
        )

        return True

    async def list_versions(self, prompt_id: str) -> List[PromptVersion]:
        """
        List all versions for prompt.

        Args:
            prompt_id: Prompt identifier

        Returns:
            List of prompt versions
        """
        result = self.supabase.table(self.table_name).select("*").eq(
            "prompt_id", prompt_id
        ).order("version", desc=False).execute()

        return [PromptVersion.from_dict(v) for v in result.data]

    async def rollback_version(
        self,
        prompt_id: str,
        version: int,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Rollback to previous version.

        Args:
            prompt_id: Prompt identifier
            version: Version to rollback to
            user_id: User performing rollback

        Returns:
            Success status
        """
        logger.info(
            "prompt_version_rollback",
            prompt_id=prompt_id,
            target_version=version,
            user_id=user_id
        )

        return await self.activate_version(prompt_id, version, user_id)

    async def deprecate_version(
        self,
        prompt_id: str,
        version: int,
        user_id: Optional[str] = None
    ) -> bool:
        """
        Mark version as deprecated.

        Args:
            prompt_id: Prompt identifier
            version: Version to deprecate
            user_id: User deprecating the version

        Returns:
            Success status
        """
        self.supabase.table(self.table_name).update({
            "status": PromptStatus.DEPRECATED.value
        }).eq("prompt_id", prompt_id).eq("version", version).execute()

        logger.info(
            "prompt_version_deprecated",
            prompt_id=prompt_id,
            version=version,
            user_id=user_id
        )

        return True
