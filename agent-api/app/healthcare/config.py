"""Healthcare module configuration"""

import os
from typing import Literal

# Model configuration
HEALTHCARE_MODELS = {
    "complex": "claude-opus-4-20250514",      # Prior auth, appeals, complex reasoning
    "fast": "claude-sonnet-4-20250514",       # Lookups, tool calls, streaming
    "default": "claude-opus-4-20250514",
}

# Task to model mapping
TASK_MODEL_MAP = {
    "prior_auth_review": "complex",
    "claims_appeal": "complex",
    "clinical_documentation": "complex",
    "care_coordination": "complex",
    "icd10_lookup": "fast",
    "drug_interaction": "fast",
    "literature_search": "fast",
    "general_query": "fast",
}

# Tool configuration
TOOL_CACHE_TTL = {
    "icd10": 86400 * 7,      # 7 days (codes don't change often)
    "npi": 86400,            # 1 day
    "rxnorm": 86400 * 7,     # 7 days
    "pubmed": 3600,          # 1 hour (new papers)
    "coverage": 86400,       # 1 day
    "fda": 86400,            # 1 day
}

# Rate limits
RATE_LIMITS = {
    "free": {"rpm": 5, "tpm": 10000},
    "pro": {"rpm": 30, "tpm": 100000},
    "enterprise": {"rpm": 100, "tpm": 500000},
}

# Max iterations for agentic loop
MAX_TOOL_ITERATIONS = 5

# API configuration
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
