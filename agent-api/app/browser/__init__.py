"""Cloud Browser Session Management - Phase 8

Manages persistent browser sessions for automation.
"""

from app.browser.session_manager import (
    CloudBrowserSessionManager,
    BrowserSession,
    SessionStatus
)

__all__ = [
    "CloudBrowserSessionManager",
    "BrowserSession",
    "SessionStatus",
]
