"""
Authentication and authorization module.
"""

from .dependencies import get_current_user, get_current_user_with_email, get_supabase_client, get_supabase_for_user, get_optional_user

__all__ = ["get_current_user", "get_current_user_with_email", "get_supabase_client", "get_supabase_for_user", "get_optional_user"]
