"""Base class for healthcare tools"""

from abc import ABC, abstractmethod
from typing import Any, Dict
import hashlib
import json


class HealthcareTool(ABC):
    """Base class for healthcare tools"""

    name: str
    description: str
    cache_ttl: int = 3600  # Default 1 hour

    @property
    @abstractmethod
    def input_schema(self) -> dict:
        """JSON schema for tool input"""
        pass

    @abstractmethod
    async def execute(self, **kwargs) -> Dict[str, Any]:
        """Execute the tool and return results"""
        pass

    def get_cache_key(self, **kwargs) -> str:
        """Generate cache key from input"""
        input_str = json.dumps(kwargs, sort_keys=True)
        return hashlib.sha256(f"{self.name}:{input_str}".encode()).hexdigest()

    def to_claude_tool(self) -> dict:
        """Convert to Claude tool format"""
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema
        }
