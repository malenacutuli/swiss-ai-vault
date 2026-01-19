"""Pydantic models for Healthcare API"""

from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Any
from datetime import datetime
from uuid import UUID

# ============================================
# REQUEST MODELS
# ============================================

class HealthcareQueryRequest(BaseModel):
    """Main healthcare query request"""
    query: str = Field(..., description="User's healthcare query")
    task_type: Literal[
        "prior_auth_review",
        "claims_appeal",
        "icd10_lookup",
        "drug_interaction",
        "literature_search",
        "clinical_documentation",
        "care_coordination",
        "general_query"
    ] = "general_query"

    # Optional context (from browser - top-K chunks only)
    context_chunks: Optional[List[str]] = Field(
        default=None,
        description="Relevant document chunks (extracted client-side)"
    )

    # Model preference
    model: Optional[Literal["complex", "fast"]] = None

    # Streaming
    stream: bool = False

    # Conversation context
    conversation_id: Optional[str] = None
    previous_messages: Optional[List[dict]] = None


class ToolCallRequest(BaseModel):
    """Direct tool call request"""
    tool: Literal["icd10", "npi", "rxnorm", "pubmed", "coverage", "fda"]
    input: dict


# ============================================
# RESPONSE MODELS
# ============================================

class Citation(BaseModel):
    """Medical citation"""
    index: int
    source_type: str
    url: Optional[str] = None
    title: Optional[str] = None
    authors: Optional[str] = None
    date: Optional[str] = None
    snippet: Optional[str] = None


class ToolResult(BaseModel):
    """Result from a tool call"""
    tool: str
    input: dict
    output: dict
    cached: bool = False


class HealthcareQueryResponse(BaseModel):
    """Main healthcare query response"""
    content: str
    citations: List[Citation] = []
    tool_results: List[ToolResult] = []

    # Metadata
    task_id: Optional[UUID] = None
    model_used: str
    input_tokens: int
    output_tokens: int
    latency_ms: int

    # Confidence (for medical accuracy)
    confidence: Optional[Literal["high", "medium", "low"]] = None

    # Disclaimer
    disclaimer: str = "For informational purposes only. Consult healthcare providers for medical decisions."


class StreamChunk(BaseModel):
    """Streaming response chunk"""
    type: Literal["text", "tool_call", "tool_result", "citation", "done", "error"]
    content: Optional[str] = None
    tool: Optional[str] = None
    tool_input: Optional[dict] = None
    tool_output: Optional[dict] = None
    citation: Optional[Citation] = None


# ============================================
# TOOL SCHEMAS
# ============================================

class ICD10Result(BaseModel):
    """ICD-10 lookup result"""
    code: str
    description: str
    type: str = "diagnosis"


class NPIResult(BaseModel):
    """NPI verification result"""
    npi: str
    name: str
    credential: Optional[str] = None
    specialty: Optional[str] = None
    taxonomy_code: Optional[str] = None
    state: Optional[str] = None
    license: Optional[str] = None
    status: str = "Unknown"
    address: Optional[dict] = None


class DrugInfo(BaseModel):
    """Drug information"""
    name: str
    rxcui: Optional[str] = None
    original_search: Optional[str] = None
    error: Optional[str] = None


class DrugInteraction(BaseModel):
    """Drug interaction"""
    description: str
    severity: str = "Unknown"
    drugs: List[str] = []


class PubMedArticle(BaseModel):
    """PubMed article"""
    pmid: str
    title: str
    authors: str
    journal: str
    year: str
    url: str
    abstract_available: bool = False
