"""
Configuration management for Agent API
"""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings from environment variables"""

    # API Configuration
    app_name: str = "Swiss Agent API"
    version: str = "1.0.0"
    debug: bool = False

    # Supabase (Direct project)
    supabase_url: str
    supabase_service_role_key: str

    # LLM Providers
    anthropic_api_key: str | None = None
    openai_api_key: str | None = None
    manus_api_key: str | None = None
    manus_api_url: str = "https://api.manus.im/v1"

    # LLM Settings - Default to Manus for full parity
    llm_primary_provider: str = "manus"  # "manus", "anthropic", or "openai"
    llm_default_model: str = "manus-1.6-max"
    llm_fallback_enabled: bool = True

    # E2B Sandboxes (for tool execution)
    e2b_api_key: str | None = None

    # Web Search APIs (optional, fallback to mock if not set)
    tavily_api_key: str | None = None
    serper_api_key: str | None = None

    # Redis (Upstash)
    redis_url: str

    # Exoscale S3 Workspace Storage (Geneva)
    s3_endpoint: str = "https://sos-ch-gva-2.exo.io"
    s3_workspace_bucket: str = "swissbrain-workspaces"
    s3_region: str = "ch-gva-2"
    s3_access_key: str | None = None
    s3_secret_key: str | None = None

    # Worker Settings
    worker_job_timeout: int = 5  # BRPOP timeout seconds
    worker_max_retries: int = 3

    # K8s Configuration
    k8s_namespace: str = "agents"
    k8s_in_cluster: bool = True

    # CORS - Allow all origins (API is protected by auth tokens)
    cors_origins: list[str] = ["*"]

    # OAuth - GitHub
    github_client_id: str | None = None
    github_client_secret: str | None = None

    # OAuth - Slack
    slack_client_id: str | None = None
    slack_client_secret: str | None = None

    # OAuth - Google
    google_client_id: str | None = None
    google_client_secret: str | None = None

    # OAuth Settings
    oauth_redirect_base_url: str = "https://api.swissbrain.ai"
    oauth_frontend_callback_url: str = "https://swissbrain.ai/settings/connections"

    # Encryption key for storing tokens (32-byte base64 string)
    connector_encryption_key: str | None = None

    class Config:
        env_file = ".env"
        case_sensitive = False


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
