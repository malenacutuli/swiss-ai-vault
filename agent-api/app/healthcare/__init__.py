"""SwissVault Healthcare Module - Claude-Native

Browser-first healthcare AI with:
- Prior authorization review
- Claims appeals analysis
- ICD-10 code lookup
- Drug interaction checks
- Medical literature search
- Clinical documentation assistance

Privacy-first: Documents stay in browser, only queries + context chunks sent to API.
"""

from .router import router as healthcare_router
from .orchestrator import HealthcareOrchestrator
from .models import (
    HealthcareQueryRequest,
    HealthcareQueryResponse,
    Citation,
    ToolResult,
    StreamChunk,
)
from .tools import (
    HEALTHCARE_TOOLS,
    get_tool,
    get_all_tools,
    get_claude_tools,
)

__all__ = [
    # Router
    "healthcare_router",
    # Orchestrator
    "HealthcareOrchestrator",
    # Models
    "HealthcareQueryRequest",
    "HealthcareQueryResponse",
    "Citation",
    "ToolResult",
    "StreamChunk",
    # Tools
    "HEALTHCARE_TOOLS",
    "get_tool",
    "get_all_tools",
    "get_claude_tools",
]
