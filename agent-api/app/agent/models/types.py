"""Agent data models and types"""
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field
from datetime import datetime


# Enum types matching database
class AgentRunStatus(str):
    CREATED = "created"
    QUEUED = "queued"
    PLANNING = "planning"
    EXECUTING = "executing"
    WAITING_USER = "waiting_user"
    PAUSED = "paused"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    TIMEOUT = "timeout"


class AgentStepStatus(str):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"
    CANCELLED = "cancelled"


class ToolType(str):
    SHELL = "shell"
    CODE = "code"
    BROWSER = "browser"
    FILE_READ = "file_read"
    FILE_WRITE = "file_write"
    SEARCH = "search"
    MESSAGE = "message"
    PLAN = "plan"
    GENERATE = "generate"
    SLIDES = "slides"
    CONNECTOR = "connector"


class AgentMode(str):
    CHAT = "chat"
    RESEARCH = "research"
    SLIDES = "slides"
    WEBSITE = "website"
    DOCUMENT = "document"
    CODE = "code"
    DATA_ANALYSIS = "data_analysis"
    CUSTOM = "custom"


# Planning models
class PlanPhase(BaseModel):
    """Individual phase in an execution plan"""
    phase_number: int
    name: str
    description: str
    required_capabilities: List[str]
    estimated_credits: float
    dependencies: List[int] = Field(default_factory=list)
    expected_outputs: List[str] = Field(default_factory=list)


class ExecutionPlan(BaseModel):
    """Complete execution plan for a task"""
    goal: str
    phases: List[PlanPhase]
    total_estimated_credits: float
    total_estimated_duration_minutes: int
    required_capabilities: List[str]
    risks: List[str] = Field(default_factory=list)


class PlanningConstraints(BaseModel):
    """Constraints for planning"""
    max_credits: Optional[float] = None
    max_phases: Optional[int] = None
    available_capabilities: Optional[List[str]] = None
    context: Optional[Dict[str, Any]] = None


# Tool execution models
class ToolResult(BaseModel):
    """Result from tool execution"""
    output: Any
    success: bool
    error: Optional[str] = None
    credits_used: float = 0
    artifacts: List[Dict[str, Any]] = Field(default_factory=list)
    memory: List[Dict[str, Any]] = Field(default_factory=list)


class ToolContext(BaseModel):
    """Context for tool execution"""
    run_id: str
    user_id: str
    step_id: str


# Agent action models
class AgentAction(BaseModel):
    """Action decided by supervisor"""
    type: Literal["tool", "message", "phase_complete", "task_complete", "request_input"]
    tool_name: Optional[str] = None
    tool_input: Optional[Dict[str, Any]] = None
    message: Optional[str] = None
    reasoning: Optional[str] = None


# Execution result models
class ExecutionResult(BaseModel):
    """Result from agent execution"""
    status: Literal["completed", "failed", "paused", "waiting_user"]
    error: Optional[str] = None
    final_message: Optional[str] = None


# LLM message models
class LLMMessage(BaseModel):
    """Message for LLM conversation"""
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    tool_call_id: Optional[str] = None
    tool_name: Optional[str] = None
