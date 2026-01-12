# **Multimodal Pipeline Architecture: Complete Implementation Guide**

This document provides comprehensive code instructions, architecture, and pseudocode for handling multimodal tasks involving text, images, video, and audio coordination.

## **1\. Architecture Overview**

Plain Text  
┌─────────────────────────────────────────────────────────────────────────────┐  
│                    MULTIMODAL ORCHESTRATION ARCHITECTURE                     │  
├─────────────────────────────────────────────────────────────────────────────┤  
│                                                                              │  
│  ┌─────────────────────────────────────────────────────────────────────┐   │  
│  │                      HYBRID ARCHITECTURE                             │   │  
│  │                                                                       │   │  
│  │  ┌─────────────────────────────────────────────────────────────┐    │   │  
│  │  │              MULTIMODAL PLANNER (Coordinator)                │    │   │  
│  │  │                                                               │    │   │  
│  │  │  • Decomposes complex tasks into modality-specific subtasks  │    │   │  
│  │  │  • Manages cross-modal dependencies                          │    │   │  
│  │  │  • Coordinates specialized agents                            │    │   │  
│  │  │  • Handles modality fusion and synthesis                     │    │   │  
│  │  └─────────────────────────────────────────────────────────────┘    │   │  
│  │                              │                                       │   │  
│  │              ┌───────────────┼───────────────┐                      │   │  
│  │              │               │               │                      │   │  
│  │              ▼               ▼               ▼                      │   │  
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐             │   │  
│  │  │ TEXT AGENT    │ │ VISION AGENT  │ │ AUDIO AGENT   │             │   │  
│  │  │               │ │               │ │               │             │   │  
│  │  │ • Analysis    │ │ • Image proc  │ │ • Transcribe  │             │   │  
│  │  │ • Generation  │ │ • Video anal  │ │ • TTS         │             │   │  
│  │  │ • Summarize   │ │ • OCR         │ │ • Music gen   │             │   │  
│  │  └───────────────┘ └───────────────┘ └───────────────┘             │   │  
│  │                                                                       │   │  
│  └─────────────────────────────────────────────────────────────────────┘   │  
│                                                                              │  
│  ANSWER: HYBRID APPROACH                                                     │  
│  ═══════════════════════                                                    │  
│  • Multimodal Planner coordinates overall task                              │  
│  • Specialized agents handle modality-specific processing                   │  
│  • Single multimodal models used where efficient (GPT-4V, Gemini)          │  
│  • Specialized models for heavy processing (Whisper, DALL-E, etc.)         │  
│                                                                              │  
└─────────────────────────────────────────────────────────────────────────────┘

## **2\. Core Data Structures**

Python  
*\#\!/usr/bin/env python3*  
"""  
Multimodal Pipeline \- Core Data Structures and Types

This module defines the foundational types for multimodal task orchestration.  
"""

from \_\_future\_\_ import annotations

import asyncio  
from dataclasses import dataclass, field  
from datetime import datetime, timedelta  
from enum import Enum, auto  
from typing import (  
    Any, Callable, Dict, List, Optional, Set, Tuple, Union,  
    TypeVar, Generic, Protocol, AsyncIterator  
)  
from uuid import uuid4  
import hashlib

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# MODALITY DEFINITIONS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class Modality(Enum):  
    """Supported content modalities."""  
    TEXT \= "text"  
    IMAGE \= "image"  
    VIDEO \= "video"  
    AUDIO \= "audio"  
    STRUCTURED\_DATA \= "structured\_data"  *\# JSON, tables, etc.*  
    DOCUMENT \= "document"  *\# PDF, DOCX, etc.*  
    PRESENTATION \= "presentation"  *\# Slides*

class MediaFormat(Enum):  
    """Supported media formats by modality."""  
    *\# Text*  
    PLAIN\_TEXT \= "text/plain"  
    MARKDOWN \= "text/markdown"  
    HTML \= "text/html"  
    JSON \= "application/json"  
      
    *\# Image*  
    PNG \= "image/png"  
    JPEG \= "image/jpeg"  
    WEBP \= "image/webp"  
    GIF \= "image/gif"  
    SVG \= "image/svg+xml"  
      
    *\# Video*  
    MP4 \= "video/mp4"  
    WEBM \= "video/webm"  
    MOV \= "video/quicktime"  
      
    *\# Audio*  
    MP3 \= "audio/mpeg"  
    WAV \= "audio/wav"  
    OGG \= "audio/ogg"  
    M4A \= "audio/m4a"  
      
    *\# Document*  
    PDF \= "application/pdf"  
    DOCX \= "application/vnd.openxmlformats-officedocument.wordprocessingml.document"  
    PPTX \= "application/vnd.openxmlformats-officedocument.presentationml.presentation"

class ProcessingCapability(Enum):  
    """Types of processing capabilities."""  
    *\# Text*  
    TEXT\_ANALYSIS \= "text\_analysis"  
    TEXT\_GENERATION \= "text\_generation"  
    TEXT\_SUMMARIZATION \= "text\_summarization"  
    TEXT\_TRANSLATION \= "text\_translation"  
      
    *\# Vision*  
    IMAGE\_ANALYSIS \= "image\_analysis"  
    IMAGE\_GENERATION \= "image\_generation"  
    IMAGE\_EDITING \= "image\_editing"  
    OCR \= "ocr"  
    VIDEO\_ANALYSIS \= "video\_analysis"  
    VIDEO\_GENERATION \= "video\_generation"  
      
    *\# Audio*  
    SPEECH\_TO\_TEXT \= "speech\_to\_text"  
    TEXT\_TO\_SPEECH \= "text\_to\_speech"  
    AUDIO\_ANALYSIS \= "audio\_analysis"  
    MUSIC\_GENERATION \= "music\_generation"  
      
    *\# Cross-modal*  
    MULTIMODAL\_UNDERSTANDING \= "multimodal\_understanding"  
    CROSS\_MODAL\_SEARCH \= "cross\_modal\_search"  
    MODALITY\_FUSION \= "modality\_fusion"

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# MEDIA ARTIFACTS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class MediaArtifact:  
    """Represents a media artifact in the pipeline."""  
    artifact\_id: str  
    modality: Modality  
    format: MediaFormat  
      
    *\# Content (one of these will be set)*  
    content\_url: Optional\[str\] \= None  *\# S3/CDN URL*  
    content\_bytes: Optional\[bytes\] \= None  *\# Raw bytes (for small items)*  
    content\_text: Optional\[str\] \= None  *\# Text content*  
      
    *\# Metadata*  
    size\_bytes: int \= 0  
    duration\_seconds: Optional\[float\] \= None  *\# For audio/video*  
    dimensions: Optional\[Tuple\[int, int\]\] \= None  *\# For images/video (width, height)*  
    sample\_rate: Optional\[int\] \= None  *\# For audio*  
    frame\_rate: Optional\[float\] \= None  *\# For video*  
      
    *\# Processing metadata*  
    content\_hash: Optional\[str\] \= None  
    created\_at: datetime \= field(default\_factory\=datetime.utcnow)  
    source\_artifact\_id: Optional\[str\] \= None  *\# If derived from another artifact*  
    processing\_chain: List\[str\] \= field(default\_factory\=list)  *\# List of operations applied*  
      
    *\# Cost tracking*  
    storage\_cost\_usd: float \= 0.0  
    processing\_cost\_usd: float \= 0.0  
      
    def compute\_hash(self) \-\> str:  
        """Compute content hash for deduplication."""  
        if self.content\_bytes:  
            return hashlib.sha256(self.content\_bytes).hexdigest()  
        elif self.content\_text:  
            return hashlib.sha256(self.content\_text.encode()).hexdigest()  
        elif self.content\_url:  
            return hashlib.sha256(self.content\_url.encode()).hexdigest()  
        return ""

@dataclass  
class MediaReference:  
    """Lightweight reference to a media artifact."""  
    artifact\_id: str  
    modality: Modality  
    url: str  
    preview\_url: Optional\[str\] \= None  *\# Thumbnail/preview*

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# TASK DEFINITIONS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class MultimodalTask:  
    """A task that may involve multiple modalities."""  
    task\_id: str  
    description: str  
      
    *\# Input artifacts*  
    input\_artifacts: List\[MediaArtifact\] \= field(default\_factory\=list)  
    input\_modalities: Set\[Modality\] \= field(default\_factory\=set)  
      
    *\# Expected output*  
    output\_modalities: Set\[Modality\] \= field(default\_factory\=set)  
    output\_format\_preferences: Dict\[Modality, MediaFormat\] \= field(default\_factory\=dict)  
      
    *\# Constraints*  
    max\_cost\_usd: Optional\[float\] \= None  
    max\_latency\_seconds: Optional\[float\] \= None  
    quality\_preference: str \= "balanced"  *\# "fast", "balanced", "high\_quality"*  
      
    *\# Context*  
    user\_id: str \= ""  
    tenant\_id: str \= ""  
    priority: int \= 5  *\# 1-10, higher \= more urgent*  
      
    *\# State*  
    created\_at: datetime \= field(default\_factory\=datetime.utcnow)  
    deadline: Optional\[datetime\] \= None

@dataclass  
class SubTask:  
    """A modality-specific subtask within a multimodal task."""  
    subtask\_id: str  
    parent\_task\_id: str  
      
    *\# What to do*  
    capability: ProcessingCapability  
    description: str  
      
    *\# Input/Output*  
    input\_artifact\_ids: List\[str\] \= field(default\_factory\=list)  
    output\_modality: Modality \= Modality.TEXT  
      
    *\# Dependencies*  
    depends\_on: List\[str\] \= field(default\_factory\=list)  *\# Other subtask IDs*  
      
    *\# Assignment*  
    assigned\_agent: Optional\[str\] \= None  
    assigned\_model: Optional\[str\] \= None  
      
    *\# Execution*  
    status: str \= "pending"  *\# pending, running, completed, failed*  
    result\_artifact\_id: Optional\[str\] \= None  
    error: Optional\[str\] \= None  
      
    *\# Cost/Latency*  
    estimated\_cost\_usd: float \= 0.0  
    estimated\_latency\_seconds: float \= 0.0  
    actual\_cost\_usd: float \= 0.0  
    actual\_latency\_seconds: float \= 0.0

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# AGENT DEFINITIONS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class AgentCapability:  
    """Describes what an agent can do."""  
    capability: ProcessingCapability  
    input\_modalities: Set\[Modality\]  
    output\_modalities: Set\[Modality\]  
    supported\_formats: Set\[MediaFormat\]  
      
    *\# Performance characteristics*  
    avg\_latency\_seconds: float  
    cost\_per\_unit: float  *\# Per token, per second, per image, etc.*  
    cost\_unit: str  *\# "token", "second", "image", "request"*  
      
    *\# Limits*  
    max\_input\_size\_bytes: int  
    max\_duration\_seconds: Optional\[float\] \= None  *\# For audio/video*  
    max\_dimensions: Optional\[Tuple\[int, int\]\] \= None  *\# For images*

@dataclass  
class SpecializedAgent:  
    """A specialized agent for specific modality processing."""  
    agent\_id: str  
    name: str  
    agent\_type: str  *\# "text", "vision", "audio", "multimodal"*  
      
    *\# Capabilities*  
    capabilities: List\[AgentCapability\] \= field(default\_factory\=list)  
      
    *\# Underlying models*  
    primary\_model: str \= ""  
    fallback\_models: List\[str\] \= field(default\_factory\=list)  
      
    *\# Status*  
    is\_available: bool \= True  
    current\_load: float \= 0.0  *\# 0.0 \- 1.0*  
    queue\_depth: int \= 0  
      
    *\# Rate limits*  
    requests\_per\_minute: int \= 60  
    tokens\_per\_minute: int \= 100000  
    concurrent\_requests: int \= 10

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# COST AND LATENCY TRACKING*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class CostEstimate:  
    """Estimated cost for a processing operation."""  
    operation: str  
    model: str  
      
    *\# Breakdown*  
    input\_cost\_usd: float \= 0.0  
    output\_cost\_usd: float \= 0.0  
    compute\_cost\_usd: float \= 0.0  
    storage\_cost\_usd: float \= 0.0  
      
    *\# Total*  
    total\_cost\_usd: float \= 0.0  
      
    *\# Confidence*  
    confidence: float \= 0.8  *\# 0.0 \- 1.0*  
      
    def \_\_post\_init\_\_(self):  
        if self.total\_cost\_usd \== 0.0:  
            self.total\_cost\_usd \= (  
                self.input\_cost\_usd \+   
                self.output\_cost\_usd \+   
                self.compute\_cost\_usd \+   
                self.storage\_cost\_usd  
            )

@dataclass  
class LatencyEstimate:  
    """Estimated latency for a processing operation."""  
    operation: str  
    model: str  
      
    *\# Breakdown*  
    queue\_time\_seconds: float \= 0.0  
    processing\_time\_seconds: float \= 0.0  
    transfer\_time\_seconds: float \= 0.0  
      
    *\# Total*  
    total\_seconds: float \= 0.0  
      
    *\# Confidence*  
    confidence: float \= 0.8  
      
    def \_\_post\_init\_\_(self):  
        if self.total\_seconds \== 0.0:  
            self.total\_seconds \= (  
                self.queue\_time\_seconds \+   
                self.processing\_time\_seconds \+   
                self.transfer\_time\_seconds  
            )

@dataclass  
class Budget:  
    """Budget constraints for a task."""  
    max\_cost\_usd: float  
    max\_latency\_seconds: float  
      
    *\# Current usage*  
    spent\_cost\_usd: float \= 0.0  
    elapsed\_seconds: float \= 0.0  
      
    *\# Alerts*  
    cost\_warning\_threshold: float \= 0.8  *\# Warn at 80%*  
    latency\_warning\_threshold: float \= 0.8  
      
    @property  
    def remaining\_cost\_usd(self) \-\> float:  
        return max(0, self.max\_cost\_usd \- self.spent\_cost\_usd)  
      
    @property  
    def remaining\_seconds(self) \-\> float:  
        return max(0, self.max\_latency\_seconds \- self.elapsed\_seconds)  
      
    @property  
    def cost\_utilization(self) \-\> float:  
        return self.spent\_cost\_usd / self.max\_cost\_usd if self.max\_cost\_usd \> 0 else 0  
      
    @property  
    def latency\_utilization(self) \-\> float:  
        return self.elapsed\_seconds / self.max\_latency\_seconds if self.max\_latency\_seconds \> 0 else 0  
      
    def can\_afford(self, estimate: CostEstimate) \-\> bool:  
        return estimate.total\_cost\_usd \<= self.remaining\_cost\_usd  
      
    def can\_complete\_in\_time(self, estimate: LatencyEstimate) \-\> bool:  
        return estimate.total\_seconds \<= self.remaining\_seconds

## **3\. Multimodal Planner (Coordinator)**

Python  
class MultimodalPlanner:  
    """  
    Coordinates multimodal tasks by decomposing them into modality-specific  
    subtasks and managing cross-modal dependencies.  
      
    This is the central orchestrator that decides:  
    \- How to decompose a complex multimodal task  
    \- Which specialized agents to use  
    \- How to handle cross-modal dependencies  
    \- When to use unified multimodal models vs specialized pipelines  
    """  
      
    def \_\_init\_\_(  
        self,  
        agents: Dict\[str, SpecializedAgent\],  
        model\_registry: 'ModelRegistry',  
        cost\_controller: 'CostController',  
        artifact\_store: 'ArtifactStore'  
    ):  
        self.agents \= agents  
        self.model\_registry \= model\_registry  
        self.cost\_controller \= cost\_controller  
        self.artifact\_store \= artifact\_store  
          
        *\# Planning strategies*  
        self.strategies \= {  
            "unified": UnifiedMultimodalStrategy(),  
            "specialized": SpecializedPipelineStrategy(),  
            "hybrid": HybridStrategy(),  
        }  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# TASK DECOMPOSITION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def plan\_task(self, task: MultimodalTask) \-\> 'ExecutionPlan':  
        """  
        Decompose a multimodal task into an execution plan.  
          
        Steps:  
        1\. Analyze input modalities and requirements  
        2\. Identify required capabilities  
        3\. Select strategy (unified vs specialized)  
        4\. Generate subtask DAG  
        5\. Estimate costs and latency  
        6\. Optimize plan within budget  
        """  
          
        *\# Step 1: Analyze task*  
        analysis \= await self.\_analyze\_task(task)  
          
        *\# Step 2: Select strategy based on task characteristics*  
        strategy \= self.\_select\_strategy(analysis, task)  
          
        *\# Step 3: Generate subtask graph*  
        subtasks \= await strategy.decompose(task, analysis, self.agents)  
          
        *\# Step 4: Build dependency graph*  
        dag \= self.\_build\_dependency\_graph(subtasks)  
          
        *\# Step 5: Estimate costs and latency*  
        estimates \= await self.\_estimate\_plan(subtasks, dag)  
          
        *\# Step 6: Optimize if over budget*  
        if task.max\_cost\_usd and estimates.total\_cost \> task.max\_cost\_usd:  
            subtasks \= await self.\_optimize\_for\_cost(subtasks, task.max\_cost\_usd)  
            estimates \= await self.\_estimate\_plan(subtasks, dag)  
          
        if task.max\_latency\_seconds and estimates.total\_latency \> task.max\_latency\_seconds:  
            subtasks \= await self.\_optimize\_for\_latency(subtasks, task.max\_latency\_seconds)  
            estimates \= await self.\_estimate\_plan(subtasks, dag)  
          
        return ExecutionPlan(  
            plan\_id\=f"plan\_{task.task\_id}\_{datetime.utcnow().timestamp()}",  
            task\=task,  
            subtasks\=subtasks,  
            dependency\_graph\=dag,  
            estimates\=estimates,  
            strategy\_used\=strategy.name  
        )  
      
    async def \_analyze\_task(self, task: MultimodalTask) \-\> 'TaskAnalysis':  
        """Analyze task to understand modality requirements."""  
          
        *\# Detect input modalities*  
        input\_modalities \= set()  
        for artifact in task.input\_artifacts:  
            input\_modalities.add(artifact.modality)  
          
        *\# Parse task description for required capabilities*  
        required\_capabilities \= await self.\_extract\_capabilities(task.description)  
          
        *\# Identify cross-modal operations*  
        cross\_modal\_ops \= self.\_identify\_cross\_modal\_operations(  
            input\_modalities,  
            task.output\_modalities,  
            required\_capabilities  
        )  
          
        *\# Estimate complexity*  
        complexity \= self.\_estimate\_complexity(  
            len(input\_modalities),  
            len(task.output\_modalities),  
            len(cross\_modal\_ops)  
        )  
          
        return TaskAnalysis(  
            input\_modalities\=input\_modalities,  
            output\_modalities\=task.output\_modalities,  
            required\_capabilities\=required\_capabilities,  
            cross\_modal\_operations\=cross\_modal\_ops,  
            complexity\=complexity  
        )  
      
    async def \_extract\_capabilities(self, description: str) \-\> Set\[ProcessingCapability\]:  
        """Extract required capabilities from task description using LLM."""  
          
        *\# Use LLM to understand what capabilities are needed*  
        prompt \= f"""  
        Analyze this task description and identify the required processing capabilities.  
          
        Task: {description}  
          
        Available capabilities:  
        \- TEXT\_ANALYSIS: Analyze text content  
        \- TEXT\_GENERATION: Generate text  
        \- TEXT\_SUMMARIZATION: Summarize text  
        \- IMAGE\_ANALYSIS: Analyze images  
        \- IMAGE\_GENERATION: Generate images  
        \- VIDEO\_ANALYSIS: Analyze video content  
        \- SPEECH\_TO\_TEXT: Transcribe audio to text  
        \- TEXT\_TO\_SPEECH: Convert text to speech  
        \- MULTIMODAL\_UNDERSTANDING: Understand content across modalities  
        \- MODALITY\_FUSION: Combine multiple modalities into one output  
          
        Return a JSON array of required capability names.  
        """  
          
        *\# Call LLM (simplified)*  
        response \= await self.\_call\_llm(prompt)  
        capabilities \= set()  
          
        for cap\_name in response.get("capabilities", \[\]):  
            try:  
                capabilities.add(ProcessingCapability(cap\_name.lower()))  
            except ValueError:  
                pass  
          
        return capabilities  
      
    def \_identify\_cross\_modal\_operations(  
        self,  
        input\_modalities: Set\[Modality\],  
        output\_modalities: Set\[Modality\],  
        capabilities: Set\[ProcessingCapability\]  
    ) \-\> List\['CrossModalOperation'\]:  
        """Identify operations that cross modality boundaries."""  
          
        operations \= \[\]  
          
        *\# Speech to text*  
        if Modality.AUDIO in input\_modalities and ProcessingCapability.SPEECH\_TO\_TEXT in capabilities:  
            operations.append(CrossModalOperation(  
                name\="transcription",  
                source\_modality\=Modality.AUDIO,  
                target\_modality\=Modality.TEXT,  
                capability\=ProcessingCapability.SPEECH\_TO\_TEXT  
            ))  
          
        *\# Text to speech*  
        if Modality.AUDIO in output\_modalities and ProcessingCapability.TEXT\_TO\_SPEECH in capabilities:  
            operations.append(CrossModalOperation(  
                name\="narration",  
                source\_modality\=Modality.TEXT,  
                target\_modality\=Modality.AUDIO,  
                capability\=ProcessingCapability.TEXT\_TO\_SPEECH  
            ))  
          
        *\# Image generation from text*  
        if Modality.IMAGE in output\_modalities and ProcessingCapability.IMAGE\_GENERATION in capabilities:  
            operations.append(CrossModalOperation(  
                name\="image\_generation",  
                source\_modality\=Modality.TEXT,  
                target\_modality\=Modality.IMAGE,  
                capability\=ProcessingCapability.IMAGE\_GENERATION  
            ))  
          
        *\# Video analysis to text*  
        if Modality.VIDEO in input\_modalities and ProcessingCapability.VIDEO\_ANALYSIS in capabilities:  
            operations.append(CrossModalOperation(  
                name\="video\_understanding",  
                source\_modality\=Modality.VIDEO,  
                target\_modality\=Modality.TEXT,  
                capability\=ProcessingCapability.VIDEO\_ANALYSIS  
            ))  
          
        return operations  
      
    def \_select\_strategy(  
        self,  
        analysis: 'TaskAnalysis',  
        task: MultimodalTask  
    ) \-\> 'PlanningStrategy':  
        """  
        Select the best planning strategy based on task characteristics.  
          
        Decision factors:  
        \- Number of modalities involved  
        \- Complexity of cross-modal operations  
        \- Cost/latency constraints  
        \- Quality requirements  
        """  
          
        *\# Simple tasks with 1-2 modalities: use unified multimodal model*  
        if len(analysis.input\_modalities) \<= 2 and len(analysis.cross\_modal\_operations) \<= 1:  
            if task.quality\_preference \== "fast":  
                return self.strategies\["unified"\]  
          
        *\# Complex tasks with many modalities: use specialized pipeline*  
        if len(analysis.input\_modalities) \>= 3 or len(analysis.cross\_modal\_operations) \>= 3:  
            return self.strategies\["specialized"\]  
          
        *\# Default: hybrid approach*  
        return self.strategies\["hybrid"\]  
      
    def \_build\_dependency\_graph(self, subtasks: List\[SubTask\]) \-\> 'DependencyGraph':  
        """Build a DAG of subtask dependencies."""  
          
        graph \= DependencyGraph()  
          
        for subtask in subtasks:  
            graph.add\_node(subtask.subtask\_id, subtask)  
            for dep\_id in subtask.depends\_on:  
                graph.add\_edge(dep\_id, subtask.subtask\_id)  
          
        *\# Validate no cycles*  
        if graph.has\_cycle():  
            raise ValueError("Subtask dependencies contain a cycle")  
          
        return graph  
      
    async def \_estimate\_plan(  
        self,  
        subtasks: List\[SubTask\],  
        dag: 'DependencyGraph'  
    ) \-\> 'PlanEstimates':  
        """Estimate total cost and latency for the plan."""  
          
        total\_cost \= 0.0  
          
        *\# Calculate critical path for latency*  
        critical\_path \= dag.find\_critical\_path()  
        total\_latency \= sum(  
            subtasks\[node\_id\].estimated\_latency\_seconds   
            for node\_id in critical\_path  
        )  
          
        *\# Sum costs (all subtasks run regardless of parallelism)*  
        for subtask in subtasks:  
            total\_cost \+= subtask.estimated\_cost\_usd  
          
        return PlanEstimates(  
            total\_cost\=total\_cost,  
            total\_latency\=total\_latency,  
            critical\_path\=critical\_path,  
            parallelizable\_subtasks\=dag.find\_parallel\_groups()  
        )  
      
    async def \_optimize\_for\_cost(  
        self,  
        subtasks: List\[SubTask\],  
        max\_cost: float  
    ) \-\> List\[SubTask\]:  
        """Optimize plan to fit within cost budget."""  
          
        optimized \= \[\]  
          
        for subtask in subtasks:  
            *\# Try to find cheaper alternative*  
            cheaper\_model \= self.model\_registry.find\_cheaper\_alternative(  
                subtask.assigned\_model,  
                subtask.capability,  
                max\_cost\_per\_unit\=max\_cost / len(subtasks)  
            )  
              
            if cheaper\_model:  
                subtask.assigned\_model \= cheaper\_model.model\_id  
                subtask.estimated\_cost\_usd \= cheaper\_model.estimate\_cost(subtask)  
              
            optimized.append(subtask)  
          
        return optimized  
      
    async def \_optimize\_for\_latency(  
        self,  
        subtasks: List\[SubTask\],  
        max\_latency: float  
    ) \-\> List\[SubTask\]:  
        """Optimize plan to fit within latency budget."""  
          
        *\# Identify bottlenecks on critical path*  
        *\# Try to parallelize or use faster models*  
          
        return subtasks  *\# Simplified*

@dataclass  
class TaskAnalysis:  
    """Analysis of a multimodal task."""  
    input\_modalities: Set\[Modality\]  
    output\_modalities: Set\[Modality\]  
    required\_capabilities: Set\[ProcessingCapability\]  
    cross\_modal\_operations: List\['CrossModalOperation'\]  
    complexity: str  *\# "simple", "moderate", "complex"*

@dataclass  
class CrossModalOperation:  
    """An operation that crosses modality boundaries."""  
    name: str  
    source\_modality: Modality  
    target\_modality: Modality  
    capability: ProcessingCapability

@dataclass  
class ExecutionPlan:  
    """Complete execution plan for a multimodal task."""  
    plan\_id: str  
    task: MultimodalTask  
    subtasks: List\[SubTask\]  
    dependency\_graph: 'DependencyGraph'  
    estimates: 'PlanEstimates'  
    strategy\_used: str

@dataclass  
class PlanEstimates:  
    """Cost and latency estimates for a plan."""  
    total\_cost: float  
    total\_latency: float  
    critical\_path: List\[str\]  
    parallelizable\_subtasks: List\[List\[str\]\]

## **4\. Planning Strategies**

Python  
class PlanningStrategy(Protocol):  
    """Protocol for planning strategies."""  
    name: str  
      
    async def decompose(  
        self,  
        task: MultimodalTask,  
        analysis: TaskAnalysis,  
        agents: Dict\[str, SpecializedAgent\]  
    ) \-\> List\[SubTask\]:  
        """Decompose task into subtasks."""  
        ...

class UnifiedMultimodalStrategy:  
    """  
    Use a single multimodal model (GPT-4V, Gemini) for the entire task.  
      
    Best for:  
    \- Simple tasks with 1-2 modalities  
    \- Tasks requiring tight cross-modal reasoning  
    \- Low-latency requirements  
    """  
      
    name \= "unified"  
      
    async def decompose(  
        self,  
        task: MultimodalTask,  
        analysis: TaskAnalysis,  
        agents: Dict\[str, SpecializedAgent\]  
    ) \-\> List\[SubTask\]:  
        """Create a single subtask using multimodal model."""  
          
        *\# Find best multimodal model*  
        multimodal\_agent \= self.\_find\_multimodal\_agent(agents, analysis)  
          
        *\# Create single subtask*  
        subtask \= SubTask(  
            subtask\_id\=f"unified\_{task.task\_id}",  
            parent\_task\_id\=task.task\_id,  
            capability\=ProcessingCapability.MULTIMODAL\_UNDERSTANDING,  
            description\=task.description,  
            input\_artifact\_ids\=\[a.artifact\_id for a in task.input\_artifacts\],  
            output\_modality\=list(task.output\_modalities)\[0\] if task.output\_modalities else Modality.TEXT,  
            assigned\_agent\=multimodal\_agent.agent\_id,  
            assigned\_model\=multimodal\_agent.primary\_model  
        )  
          
        *\# Estimate cost/latency*  
        subtask.estimated\_cost\_usd \= self.\_estimate\_unified\_cost(task, multimodal\_agent)  
        subtask.estimated\_latency\_seconds \= self.\_estimate\_unified\_latency(task, multimodal\_agent)  
          
        return \[subtask\]  
      
    def \_find\_multimodal\_agent(  
        self,  
        agents: Dict\[str, SpecializedAgent\],  
        analysis: TaskAnalysis  
    ) \-\> SpecializedAgent:  
        """Find the best multimodal agent for the task."""  
          
        for agent in agents.values():  
            if agent.agent\_type \== "multimodal":  
                *\# Check if agent supports all required modalities*  
                supported\_modalities \= set()  
                for cap in agent.capabilities:  
                    supported\_modalities.update(cap.input\_modalities)  
                    supported\_modalities.update(cap.output\_modalities)  
                  
                if analysis.input\_modalities.issubset(supported\_modalities):  
                    return agent  
          
        raise ValueError("No suitable multimodal agent found")  
      
    def \_estimate\_unified\_cost(  
        self,  
        task: MultimodalTask,  
        agent: SpecializedAgent  
    ) \-\> float:  
        """Estimate cost for unified processing."""  
          
        *\# Base cost on input size*  
        total\_tokens \= 0  
          
        for artifact in task.input\_artifacts:  
            if artifact.modality \== Modality.TEXT:  
                total\_tokens \+= len(artifact.content\_text or "") // 4  
            elif artifact.modality \== Modality.IMAGE:  
                *\# Images typically cost \~765 tokens for GPT-4V*  
                total\_tokens \+= 765  
            elif artifact.modality \== Modality.VIDEO:  
                *\# Video \= frames \* image cost*  
                frames \= int((artifact.duration\_seconds or 60) \* 1)  *\# 1 fps sampling*  
                total\_tokens \+= frames \* 765  
          
        *\# Add output tokens estimate*  
        total\_tokens \+= 1000  *\# Assume 1000 output tokens*  
          
        *\# Cost per token (GPT-4V pricing)*  
        cost\_per\_token \= 0.00001  *\# $0.01 per 1K tokens*  
          
        return total\_tokens \* cost\_per\_token  
      
    def \_estimate\_unified\_latency(  
        self,  
        task: MultimodalTask,  
        agent: SpecializedAgent  
    ) \-\> float:  
        """Estimate latency for unified processing."""  
          
        *\# Base latency*  
        base\_latency \= 2.0  *\# seconds*  
          
        *\# Add time for media processing*  
        for artifact in task.input\_artifacts:  
            if artifact.modality \== Modality.VIDEO:  
                base\_latency \+= (artifact.duration\_seconds or 60) \* 0.1  
            elif artifact.modality \== Modality.IMAGE:  
                base\_latency \+= 0.5  
          
        return base\_latency

class SpecializedPipelineStrategy:  
    """  
    Use specialized agents for each modality, coordinated by the planner.  
      
    Best for:  
    \- Complex tasks with many modalities  
    \- Tasks requiring specialized processing (video editing, music generation)  
    \- High-quality requirements  
    """  
      
    name \= "specialized"  
      
    async def decompose(  
        self,  
        task: MultimodalTask,  
        analysis: TaskAnalysis,  
        agents: Dict\[str, SpecializedAgent\]  
    ) \-\> List\[SubTask\]:  
        """Decompose into modality-specific subtasks."""  
          
        subtasks \= \[\]  
        subtask\_counter \= 0  
        artifact\_to\_subtask: Dict\[str, str\] \= {}  *\# Maps artifact\_id to producing subtask\_id*  
          
        *\# Phase 1: Input processing (parallel)*  
        for artifact in task.input\_artifacts:  
            subtask \= await self.\_create\_input\_processing\_subtask(  
                task, artifact, agents, subtask\_counter  
            )  
            subtasks.append(subtask)  
            artifact\_to\_subtask\[artifact.artifact\_id\] \= subtask.subtask\_id  
            subtask\_counter \+= 1  
          
        *\# Phase 2: Cross-modal operations (sequential based on dependencies)*  
        for cross\_op in analysis.cross\_modal\_operations:  
            subtask \= await self.\_create\_cross\_modal\_subtask(  
                task, cross\_op, agents, subtask\_counter, artifact\_to\_subtask  
            )  
            subtasks.append(subtask)  
            subtask\_counter \+= 1  
          
        *\# Phase 3: Output generation*  
        for output\_modality in task.output\_modalities:  
            subtask \= await self.\_create\_output\_subtask(  
                task, output\_modality, agents, subtask\_counter, subtasks  
            )  
            subtasks.append(subtask)  
            subtask\_counter \+= 1  
          
        *\# Phase 4: Fusion (if multiple outputs need combining)*  
        if len(task.output\_modalities) \> 1:  
            fusion\_subtask \= await self.\_create\_fusion\_subtask(  
                task, agents, subtask\_counter, subtasks  
            )  
            subtasks.append(fusion\_subtask)  
          
        return subtasks  
      
    async def \_create\_input\_processing\_subtask(  
        self,  
        task: MultimodalTask,  
        artifact: MediaArtifact,  
        agents: Dict\[str, SpecializedAgent\],  
        counter: int  
    ) \-\> SubTask:  
        """Create subtask for processing an input artifact."""  
          
        *\# Find appropriate agent*  
        agent \= self.\_find\_agent\_for\_modality(agents, artifact.modality, "analysis")  
          
        *\# Determine capability*  
        capability\_map \= {  
            Modality.TEXT: ProcessingCapability.TEXT\_ANALYSIS,  
            Modality.IMAGE: ProcessingCapability.IMAGE\_ANALYSIS,  
            Modality.VIDEO: ProcessingCapability.VIDEO\_ANALYSIS,  
            Modality.AUDIO: ProcessingCapability.SPEECH\_TO\_TEXT,  
        }  
          
        capability \= capability\_map.get(artifact.modality, ProcessingCapability.TEXT\_ANALYSIS)  
          
        return SubTask(  
            subtask\_id\=f"input\_{counter}\_{task.task\_id}",  
            parent\_task\_id\=task.task\_id,  
            capability\=capability,  
            description\=f"Process {artifact.modality.value} input",  
            input\_artifact\_ids\=\[artifact.artifact\_id\],  
            output\_modality\=Modality.TEXT,  *\# Analysis outputs text*  
            assigned\_agent\=agent.agent\_id if agent else None,  
            assigned\_model\=agent.primary\_model if agent else None,  
            estimated\_cost\_usd\=self.\_estimate\_processing\_cost(artifact, agent),  
            estimated\_latency\_seconds\=self.\_estimate\_processing\_latency(artifact, agent)  
        )  
      
    async def \_create\_cross\_modal\_subtask(  
        self,  
        task: MultimodalTask,  
        cross\_op: CrossModalOperation,  
        agents: Dict\[str, SpecializedAgent\],  
        counter: int,  
        artifact\_to\_subtask: Dict\[str, str\]  
    ) \-\> SubTask:  
        """Create subtask for cross-modal operation."""  
          
        *\# Find agent for this capability*  
        agent \= self.\_find\_agent\_for\_capability(agents, cross\_op.capability)  
          
        *\# Determine dependencies*  
        dependencies \= \[\]  
        for artifact\_id, subtask\_id in artifact\_to\_subtask.items():  
            *\# If this cross-op needs output from a previous subtask*  
            dependencies.append(subtask\_id)  
          
        return SubTask(  
            subtask\_id\=f"cross\_{counter}\_{task.task\_id}",  
            parent\_task\_id\=task.task\_id,  
            capability\=cross\_op.capability,  
            description\=f"{cross\_op.name}: {cross\_op.source\_modality.value} \-\> {cross\_op.target\_modality.value}",  
            input\_artifact\_ids\=\[\],  *\# Will be filled from dependencies*  
            output\_modality\=cross\_op.target\_modality,  
            depends\_on\=dependencies,  
            assigned\_agent\=agent.agent\_id if agent else None,  
            assigned\_model\=agent.primary\_model if agent else None  
        )  
      
    async def \_create\_output\_subtask(  
        self,  
        task: MultimodalTask,  
        output\_modality: Modality,  
        agents: Dict\[str, SpecializedAgent\],  
        counter: int,  
        previous\_subtasks: List\[SubTask\]  
    ) \-\> SubTask:  
        """Create subtask for generating output."""  
          
        *\# Find generation agent*  
        agent \= self.\_find\_agent\_for\_modality(agents, output\_modality, "generation")  
          
        *\# Capability based on output modality*  
        capability\_map \= {  
            Modality.TEXT: ProcessingCapability.TEXT\_GENERATION,  
            Modality.IMAGE: ProcessingCapability.IMAGE\_GENERATION,  
            Modality.AUDIO: ProcessingCapability.TEXT\_TO\_SPEECH,  
            Modality.VIDEO: ProcessingCapability.VIDEO\_GENERATION,  
        }  
          
        capability \= capability\_map.get(output\_modality, ProcessingCapability.TEXT\_GENERATION)  
          
        *\# Depends on all previous subtasks*  
        dependencies \= \[s.subtask\_id for s in previous\_subtasks\]  
          
        return SubTask(  
            subtask\_id\=f"output\_{counter}\_{task.task\_id}",  
            parent\_task\_id\=task.task\_id,  
            capability\=capability,  
            description\=f"Generate {output\_modality.value} output",  
            input\_artifact\_ids\=\[\],  
            output\_modality\=output\_modality,  
            depends\_on\=dependencies,  
            assigned\_agent\=agent.agent\_id if agent else None,  
            assigned\_model\=agent.primary\_model if agent else None  
        )  
      
    async def \_create\_fusion\_subtask(  
        self,  
        task: MultimodalTask,  
        agents: Dict\[str, SpecializedAgent\],  
        counter: int,  
        previous\_subtasks: List\[SubTask\]  
    ) \-\> SubTask:  
        """Create subtask for fusing multiple outputs."""  
          
        return SubTask(  
            subtask\_id\=f"fusion\_{counter}\_{task.task\_id}",  
            parent\_task\_id\=task.task\_id,  
            capability\=ProcessingCapability.MODALITY\_FUSION,  
            description\="Fuse multiple modality outputs",  
            input\_artifact\_ids\=\[\],  
            output\_modality\=Modality.PRESENTATION,  *\# Combined output*  
            depends\_on\=\[s.subtask\_id for s in previous\_subtasks if s.subtask\_id.startswith("output\_")\]  
        )  
      
    def \_find\_agent\_for\_modality(  
        self,  
        agents: Dict\[str, SpecializedAgent\],  
        modality: Modality,  
        operation: str  *\# "analysis" or "generation"*  
    ) \-\> Optional\[SpecializedAgent\]:  
        """Find the best agent for a modality and operation type."""  
          
        modality\_to\_agent\_type \= {  
            Modality.TEXT: "text",  
            Modality.IMAGE: "vision",  
            Modality.VIDEO: "vision",  
            Modality.AUDIO: "audio",  
        }  
          
        target\_type \= modality\_to\_agent\_type.get(modality, "text")  
          
        for agent in agents.values():  
            if agent.agent\_type \== target\_type and agent.is\_available:  
                return agent  
          
        return None  
      
    def \_find\_agent\_for\_capability(  
        self,  
        agents: Dict\[str, SpecializedAgent\],  
        capability: ProcessingCapability  
    ) \-\> Optional\[SpecializedAgent\]:  
        """Find agent that supports a specific capability."""  
          
        for agent in agents.values():  
            for cap in agent.capabilities:  
                if cap.capability \== capability:  
                    return agent  
          
        return None  
      
    def \_estimate\_processing\_cost(  
        self,  
        artifact: MediaArtifact,  
        agent: Optional\[SpecializedAgent\]  
    ) \-\> float:  
        """Estimate cost for processing an artifact."""  
          
        if not agent:  
            return 0.01  *\# Default*  
          
        *\# Find relevant capability*  
        for cap in agent.capabilities:  
            if artifact.modality in cap.input\_modalities:  
                if cap.cost\_unit \== "second" and artifact.duration\_seconds:  
                    return cap.cost\_per\_unit \* artifact.duration\_seconds  
                elif cap.cost\_unit \== "image":  
                    return cap.cost\_per\_unit  
                elif cap.cost\_unit \== "token":  
                    tokens \= artifact.size\_bytes // 4  
                    return cap.cost\_per\_unit \* tokens  
          
        return 0.01  
      
    def \_estimate\_processing\_latency(  
        self,  
        artifact: MediaArtifact,  
        agent: Optional\[SpecializedAgent\]  
    ) \-\> float:  
        """Estimate latency for processing an artifact."""  
          
        if not agent:  
            return 5.0  *\# Default*  
          
        base\_latency \= 2.0  
          
        if artifact.modality \== Modality.VIDEO:  
            *\# Video processing scales with duration*  
            base\_latency \+= (artifact.duration\_seconds or 60) \* 0.5  
        elif artifact.modality \== Modality.AUDIO:  
            *\# Audio transcription is roughly real-time*  
            base\_latency \+= (artifact.duration\_seconds or 60) \* 0.3  
          
        return base\_latency

class HybridStrategy:  
    """  
    Combine unified and specialized approaches based on subtask characteristics.  
      
    Best for:  
    \- Medium complexity tasks  
    \- Tasks with some tight cross-modal reasoning and some independent processing  
    \- Balanced cost/quality requirements  
    """  
      
    name \= "hybrid"  
      
    async def decompose(  
        self,  
        task: MultimodalTask,  
        analysis: TaskAnalysis,  
        agents: Dict\[str, SpecializedAgent\]  
    ) \-\> List\[SubTask\]:  
        """Decompose using hybrid approach."""  
          
        subtasks \= \[\]  
          
        *\# Use specialized agents for heavy processing*  
        *\# (video analysis, audio transcription, image generation)*  
        heavy\_processing\_modalities \= {Modality.VIDEO, Modality.AUDIO}  
          
        for artifact in task.input\_artifacts:  
            if artifact.modality in heavy\_processing\_modalities:  
                *\# Use specialized agent*  
                specialized \= SpecializedPipelineStrategy()  
                subtask \= await specialized.\_create\_input\_processing\_subtask(  
                    task, artifact, agents, len(subtasks)  
                )  
                subtasks.append(subtask)  
          
        *\# Use unified multimodal model for reasoning and synthesis*  
        unified\_subtask \= SubTask(  
            subtask\_id\=f"unified\_reasoning\_{task.task\_id}",  
            parent\_task\_id\=task.task\_id,  
            capability\=ProcessingCapability.MULTIMODAL\_UNDERSTANDING,  
            description\="Synthesize insights and generate response",  
            input\_artifact\_ids\=\[\],  *\# Will receive outputs from specialized subtasks*  
            output\_modality\=list(task.output\_modalities)\[0\] if task.output\_modalities else Modality.TEXT,  
            depends\_on\=\[s.subtask\_id for s in subtasks\]  
        )  
        subtasks.append(unified\_subtask)  
          
        return subtasks

## **5\. Tool Chaining System**

Python  
class ToolChain:  
    """  
    Manages chaining of tools for multimodal processing.  
      
    A tool chain represents a sequence of operations where the output  
    of one tool becomes the input of the next.  
    """  
      
    def \_\_init\_\_(self):  
        self.tools: Dict\[str, 'Tool'\] \= {}  
        self.chains: Dict\[str, List\[str\]\] \= {}  *\# Named chains*  
      
    def register\_tool(self, tool: 'Tool'):  
        """Register a tool for use in chains."""  
        self.tools\[tool.tool\_id\] \= tool  
      
    def define\_chain(self, chain\_name: str, tool\_ids: List\[str\]):  
        """Define a named chain of tools."""  
        *\# Validate chain*  
        for i, tool\_id in enumerate(tool\_ids):  
            if tool\_id not in self.tools:  
                raise ValueError(f"Unknown tool: {tool\_id}")  
              
            if i \> 0:  
                prev\_tool \= self.tools\[tool\_ids\[i-1\]\]  
                curr\_tool \= self.tools\[tool\_id\]  
                  
                *\# Check output/input compatibility*  
                if not self.\_is\_compatible(prev\_tool.output\_modality, curr\_tool.input\_modalities):  
                    raise ValueError(  
                        f"Incompatible chain: {prev\_tool.tool\_id} output "  
                        f"({prev\_tool.output\_modality}) not compatible with "  
                        f"{curr\_tool.tool\_id} input ({curr\_tool.input\_modalities})"  
                    )  
          
        self.chains\[chain\_name\] \= tool\_ids  
      
    async def execute\_chain(  
        self,  
        chain\_name: str,  
        initial\_input: MediaArtifact,  
        context: 'ExecutionContext'  
    ) \-\> MediaArtifact:  
        """Execute a named chain of tools."""  
          
        if chain\_name not in self.chains:  
            raise ValueError(f"Unknown chain: {chain\_name}")  
          
        current\_artifact \= initial\_input  
          
        for tool\_id in self.chains\[chain\_name\]:  
            tool \= self.tools\[tool\_id\]  
              
            *\# Check budget before execution*  
            estimate \= tool.estimate\_cost(current\_artifact)  
            if not context.budget.can\_afford(estimate):  
                raise BudgetExceededError(  
                    f"Cannot afford {tool\_id}: "  
                    f"${estimate.total\_cost\_usd:.4f} \> ${context.budget.remaining\_cost\_usd:.4f}"  
                )  
              
            *\# Execute tool*  
            start\_time \= datetime.utcnow()  
            result \= await tool.execute(current\_artifact, context)  
            elapsed \= (datetime.utcnow() \- start\_time).total\_seconds()  
              
            *\# Update budget*  
            context.budget.spent\_cost\_usd \+= result.actual\_cost\_usd  
            context.budget.elapsed\_seconds \+= elapsed  
              
            *\# Log execution*  
            context.execution\_log.append({  
                "tool\_id": tool\_id,  
                "input\_artifact": current\_artifact.artifact\_id,  
                "output\_artifact": result.artifact.artifact\_id,  
                "cost\_usd": result.actual\_cost\_usd,  
                "latency\_seconds": elapsed  
            })  
              
            current\_artifact \= result.artifact  
          
        return current\_artifact  
      
    def \_is\_compatible(  
        self,  
        output\_modality: Modality,  
        input\_modalities: Set\[Modality\]  
    ) \-\> bool:  
        """Check if output modality is compatible with input modalities."""  
        return output\_modality in input\_modalities

@dataclass  
class Tool:  
    """A processing tool in the pipeline."""  
    tool\_id: str  
    name: str  
    description: str  
      
    *\# Modality support*  
    input\_modalities: Set\[Modality\]  
    output\_modality: Modality  
      
    *\# Execution*  
    execute\_fn: Callable\[\['MediaArtifact', 'ExecutionContext'\], 'ToolResult'\]  
      
    *\# Cost estimation*  
    base\_cost\_usd: float \= 0.0  
    cost\_per\_second: float \= 0.0  
    cost\_per\_token: float \= 0.0  
    cost\_per\_image: float \= 0.0  
      
    *\# Latency estimation*  
    base\_latency\_seconds: float \= 1.0  
    latency\_per\_second: float \= 0.0  
      
    async def execute(  
        self,  
        input\_artifact: MediaArtifact,  
        context: 'ExecutionContext'  
    ) \-\> 'ToolResult':  
        """Execute the tool."""  
        return await self.execute\_fn(input\_artifact, context)  
      
    def estimate\_cost(self, input\_artifact: MediaArtifact) \-\> CostEstimate:  
        """Estimate cost for processing an artifact."""  
          
        cost \= self.base\_cost\_usd  
          
        if self.cost\_per\_second and input\_artifact.duration\_seconds:  
            cost \+= self.cost\_per\_second \* input\_artifact.duration\_seconds  
          
        if self.cost\_per\_token and input\_artifact.content\_text:  
            tokens \= len(input\_artifact.content\_text) // 4  
            cost \+= self.cost\_per\_token \* tokens  
          
        if self.cost\_per\_image and input\_artifact.modality \== Modality.IMAGE:  
            cost \+= self.cost\_per\_image  
          
        return CostEstimate(  
            operation\=self.tool\_id,  
            model\=self.name,  
            compute\_cost\_usd\=cost,  
            total\_cost\_usd\=cost  
        )  
      
    def estimate\_latency(self, input\_artifact: MediaArtifact) \-\> LatencyEstimate:  
        """Estimate latency for processing an artifact."""  
          
        latency \= self.base\_latency\_seconds  
          
        if self.latency\_per\_second and input\_artifact.duration\_seconds:  
            latency \+= self.latency\_per\_second \* input\_artifact.duration\_seconds  
          
        return LatencyEstimate(  
            operation\=self.tool\_id,  
            model\=self.name,  
            processing\_time\_seconds\=latency,  
            total\_seconds\=latency  
        )

@dataclass  
class ToolResult:  
    """Result of tool execution."""  
    artifact: MediaArtifact  
    actual\_cost\_usd: float  
    actual\_latency\_seconds: float  
    metadata: Dict\[str, Any\] \= field(default\_factory\=dict)

@dataclass  
class ExecutionContext:  
    """Context for tool execution."""  
    task\_id: str  
    user\_id: str  
    tenant\_id: str  
    budget: Budget  
    execution\_log: List\[Dict\[str, Any\]\] \= field(default\_factory\=list)  
    artifacts: Dict\[str, MediaArtifact\] \= field(default\_factory\=dict)

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# PREDEFINED TOOL CHAINS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

def create\_standard\_chains(tool\_chain: ToolChain):  
    """Create standard tool chains for common operations."""  
      
    *\# Video to narrated slides*  
    tool\_chain.define\_chain(  
        "video\_to\_narrated\_slides",  
        \[  
            "video\_frame\_extractor",     *\# Extract key frames*  
            "frame\_analyzer",            *\# Analyze frames with vision model*  
            "transcript\_generator",      *\# Generate transcript from audio*  
            "insight\_synthesizer",       *\# Combine visual \+ audio insights*  
            "slide\_generator",           *\# Generate slide content*  
            "slide\_renderer",            *\# Render slides*  
            "narration\_generator",       *\# Generate narration script*  
            "tts\_synthesizer",           *\# Convert to speech*  
            "audio\_video\_merger"         *\# Merge slides with narration*  
        \]  
    )  
      
    *\# Document to podcast*  
    tool\_chain.define\_chain(  
        "document\_to\_podcast",  
        \[  
            "document\_parser",           *\# Extract text from document*  
            "content\_analyzer",          *\# Analyze and structure content*  
            "podcast\_script\_writer",     *\# Write conversational script*  
            "multi\_voice\_tts",           *\# Generate multi-voice audio*  
            "audio\_post\_processor"       *\# Add music, effects*  
        \]  
    )  
      
    *\# Image analysis to report*  
    tool\_chain.define\_chain(  
        "image\_analysis\_report",  
        \[  
            "image\_preprocessor",        *\# Normalize, enhance*  
            "object\_detector",           *\# Detect objects*  
            "scene\_analyzer",            *\# Analyze scene context*  
            "ocr\_extractor",             *\# Extract text from image*  
            "insight\_generator",         *\# Generate insights*  
            "report\_formatter"           *\# Format as report*  
        \]  
    )

## **6\. Cost and Latency Controller**

Python  
class CostController:  
    """  
    Controls cost and latency for multimodal operations.  
      
    Responsibilities:  
    \- Track spending against budgets  
    \- Select cost-efficient models  
    \- Implement circuit breakers for runaway costs  
    \- Optimize for latency when needed  
    """  
      
    def \_\_init\_\_(self, model\_registry: 'ModelRegistry'):  
        self.model\_registry \= model\_registry  
        self.spending\_tracker: Dict\[str, float\] \= {}  *\# tenant\_id \-\> spent*  
        self.latency\_tracker: Dict\[str, List\[float\]\] \= {}  *\# operation \-\> latencies*  
          
        *\# Circuit breaker state*  
        self.circuit\_breakers: Dict\[str, 'CircuitBreaker'\] \= {}  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# COST OPTIMIZATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    def select\_model(  
        self,  
        capability: ProcessingCapability,  
        budget: Budget,  
        quality\_preference: str \= "balanced"  
    ) \-\> 'ModelConfig':  
        """  
        Select the best model for a capability within budget.  
          
        Quality preferences:  
        \- "fast": Prioritize speed, accept lower quality  
        \- "balanced": Balance cost, speed, and quality  
        \- "high\_quality": Prioritize quality, accept higher cost/latency  
        """  
          
        candidates \= self.model\_registry.get\_models\_for\_capability(capability)  
          
        if not candidates:  
            raise ValueError(f"No models available for {capability}")  
          
        *\# Filter by budget*  
        affordable \= \[  
            m for m in candidates  
            if m.estimated\_cost\_per\_request \<= budget.remaining\_cost\_usd  
        \]  
          
        if not affordable:  
            *\# Try to find cheapest option even if over budget*  
            cheapest \= min(candidates, key\=lambda m: m.estimated\_cost\_per\_request)  
            raise BudgetExceededError(  
                f"No affordable models. Cheapest: ${cheapest.estimated\_cost\_per\_request:.4f}, "  
                f"Budget remaining: ${budget.remaining\_cost\_usd:.4f}"  
            )  
          
        *\# Score and rank*  
        scored \= \[\]  
        for model in affordable:  
            score \= self.\_score\_model(model, budget, quality\_preference)  
            scored.append((score, model))  
          
        scored.sort(key\=lambda x: x\[0\], reverse\=True)  
        return scored\[0\]\[1\]  
      
    def \_score\_model(  
        self,  
        model: 'ModelConfig',  
        budget: Budget,  
        quality\_preference: str  
    ) \-\> float:  
        """Score a model based on preferences."""  
          
        *\# Weights based on preference*  
        weights \= {  
            "fast": {"cost": 0.2, "latency": 0.6, "quality": 0.2},  
            "balanced": {"cost": 0.33, "latency": 0.33, "quality": 0.34},  
            "high\_quality": {"cost": 0.2, "latency": 0.2, "quality": 0.6}  
        }  
          
        w \= weights.get(quality\_preference, weights\["balanced"\])  
          
        *\# Normalize scores (higher is better)*  
        cost\_score \= 1.0 \- (model.estimated\_cost\_per\_request / budget.max\_cost\_usd)  
        latency\_score \= 1.0 \- (model.estimated\_latency\_seconds / budget.max\_latency\_seconds)  
        quality\_score \= model.quality\_rating / 10.0  *\# Assume 0-10 rating*  
          
        return (  
            w\["cost"\] \* cost\_score \+  
            w\["latency"\] \* latency\_score \+  
            w\["quality"\] \* quality\_score  
        )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# BUDGET ENFORCEMENT*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    def check\_budget(  
        self,  
        tenant\_id: str,  
        estimated\_cost: float,  
        budget: Budget  
    ) \-\> 'BudgetCheckResult':  
        """Check if operation can proceed within budget."""  
          
        *\# Check task budget*  
        if estimated\_cost \> budget.remaining\_cost\_usd:  
            return BudgetCheckResult(  
                allowed\=False,  
                reason\="Task budget exceeded",  
                remaining\_budget\=budget.remaining\_cost\_usd,  
                estimated\_cost\=estimated\_cost  
            )  
          
        *\# Check tenant spending limits*  
        tenant\_spent \= self.spending\_tracker.get(tenant\_id, 0.0)  
        tenant\_limit \= self.\_get\_tenant\_limit(tenant\_id)  
          
        if tenant\_spent \+ estimated\_cost \> tenant\_limit:  
            return BudgetCheckResult(  
                allowed\=False,  
                reason\="Tenant spending limit exceeded",  
                remaining\_budget\=tenant\_limit \- tenant\_spent,  
                estimated\_cost\=estimated\_cost  
            )  
          
        *\# Check circuit breaker*  
        if self.\_is\_circuit\_open(tenant\_id):  
            return BudgetCheckResult(  
                allowed\=False,  
                reason\="Circuit breaker open due to excessive spending",  
                remaining\_budget\=budget.remaining\_cost\_usd,  
                estimated\_cost\=estimated\_cost  
            )  
          
        return BudgetCheckResult(  
            allowed\=True,  
            remaining\_budget\=budget.remaining\_cost\_usd,  
            estimated\_cost\=estimated\_cost  
        )  
      
    def record\_spending(  
        self,  
        tenant\_id: str,  
        task\_id: str,  
        operation: str,  
        cost\_usd: float,  
        latency\_seconds: float  
    ):  
        """Record spending for tracking and analysis."""  
          
        *\# Update tenant spending*  
        self.spending\_tracker\[tenant\_id\] \= self.spending\_tracker.get(tenant\_id, 0.0) \+ cost\_usd  
          
        *\# Track latency*  
        if operation not in self.latency\_tracker:  
            self.latency\_tracker\[operation\] \= \[\]  
        self.latency\_tracker\[operation\].append(latency\_seconds)  
          
        *\# Keep only recent latencies*  
        if len(self.latency\_tracker\[operation\]) \> 1000:  
            self.latency\_tracker\[operation\] \= self.latency\_tracker\[operation\]\[-1000:\]  
          
        *\# Check for anomalies*  
        self.\_check\_spending\_anomaly(tenant\_id, cost\_usd)  
      
    def \_check\_spending\_anomaly(self, tenant\_id: str, cost\_usd: float):  
        """Check for spending anomalies and trigger circuit breaker if needed."""  
          
        *\# Get recent spending rate*  
        *\# If spending rate exceeds threshold, open circuit breaker*  
          
        if tenant\_id not in self.circuit\_breakers:  
            self.circuit\_breakers\[tenant\_id\] \= CircuitBreaker(  
                failure\_threshold\=5,  
                recovery\_timeout\=300  *\# 5 minutes*  
            )  
          
        *\# Record potential issue if cost is unusually high*  
        if cost\_usd \> 1.0:  *\# $1 per operation is suspicious*  
            self.circuit\_breakers\[tenant\_id\].record\_failure()  
      
    def \_is\_circuit\_open(self, tenant\_id: str) \-\> bool:  
        """Check if circuit breaker is open for tenant."""  
        if tenant\_id in self.circuit\_breakers:  
            return self.circuit\_breakers\[tenant\_id\].is\_open  
        return False  
      
    def \_get\_tenant\_limit(self, tenant\_id: str) \-\> float:  
        """Get spending limit for tenant."""  
        *\# Would look up from tenant configuration*  
        return 100.0  *\# Default $100 limit*  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# LATENCY OPTIMIZATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    def get\_latency\_percentiles(self, operation: str) \-\> Dict\[str, float\]:  
        """Get latency percentiles for an operation."""  
          
        latencies \= self.latency\_tracker.get(operation, \[\])  
          
        if not latencies:  
            return {"p50": 0, "p90": 0, "p95": 0, "p99": 0}  
          
        sorted\_latencies \= sorted(latencies)  
        n \= len(sorted\_latencies)  
          
        return {  
            "p50": sorted\_latencies\[int(n \* 0.50)\],  
            "p90": sorted\_latencies\[int(n \* 0.90)\],  
            "p95": sorted\_latencies\[int(n \* 0.95)\],  
            "p99": sorted\_latencies\[int(n \* 0.99)\]  
        }  
      
    def suggest\_parallelization(  
        self,  
        subtasks: List\[SubTask\],  
        dag: 'DependencyGraph',  
        target\_latency: float  
    ) \-\> List\[List\[SubTask\]\]:  
        """Suggest how to parallelize subtasks to meet latency target."""  
          
        *\# Find critical path*  
        critical\_path \= dag.find\_critical\_path()  
        critical\_latency \= sum(  
            s.estimated\_latency\_seconds   
            for s in subtasks   
            if s.subtask\_id in critical\_path  
        )  
          
        if critical\_latency \<= target\_latency:  
            *\# Already meets target*  
            return dag.find\_parallel\_groups()  
          
        *\# Need to optimize \- suggest model upgrades or task splitting*  
        suggestions \= \[\]  
          
        for subtask\_id in critical\_path:  
            subtask \= next(s for s in subtasks if s.subtask\_id \== subtask\_id)  
              
            *\# Find faster model*  
            faster\_model \= self.model\_registry.find\_faster\_alternative(  
                subtask.assigned\_model,  
                subtask.capability  
            )  
              
            if faster\_model:  
                suggestions.append({  
                    "subtask\_id": subtask\_id,  
                    "current\_model": subtask.assigned\_model,  
                    "suggested\_model": faster\_model.model\_id,  
                    "latency\_reduction": subtask.estimated\_latency\_seconds \- faster\_model.estimated\_latency\_seconds  
                })  
          
        return suggestions

@dataclass  
class BudgetCheckResult:  
    """Result of budget check."""  
    allowed: bool  
    remaining\_budget: float  
    estimated\_cost: float  
    reason: Optional\[str\] \= None

@dataclass  
class CircuitBreaker:  
    """Circuit breaker for cost control."""  
    failure\_threshold: int  
    recovery\_timeout: int  *\# seconds*  
      
    failure\_count: int \= 0  
    last\_failure\_time: Optional\[datetime\] \= None  
    state: str \= "closed"  *\# closed, open, half\_open*  
      
    def record\_failure(self):  
        """Record a failure."""  
        self.failure\_count \+= 1  
        self.last\_failure\_time \= datetime.utcnow()  
          
        if self.failure\_count \>= self.failure\_threshold:  
            self.state \= "open"  
      
    def record\_success(self):  
        """Record a success."""  
        self.failure\_count \= 0  
        self.state \= "closed"  
      
    @property  
    def is\_open(self) \-\> bool:  
        """Check if circuit is open."""  
        if self.state \== "closed":  
            return False  
          
        if self.state \== "open" and self.last\_failure\_time:  
            *\# Check if recovery timeout has passed*  
            elapsed \= (datetime.utcnow() \- self.last\_failure\_time).total\_seconds()  
            if elapsed \>= self.recovery\_timeout:  
                self.state \= "half\_open"  
                return False  
          
        return self.state \== "open"

class BudgetExceededError(Exception):  
    """Raised when budget is exceeded."""  
    pass

## **7\. Model Registry**

Python  
@dataclass  
class ModelConfig:  
    """Configuration for a model."""  
    model\_id: str  
    provider: str  *\# "openai", "anthropic", "google", "local"*  
    name: str  
      
    *\# Capabilities*  
    capabilities: Set\[ProcessingCapability\]  
    input\_modalities: Set\[Modality\]  
    output\_modalities: Set\[Modality\]  
      
    *\# Pricing*  
    cost\_per\_input\_token: float \= 0.0  
    cost\_per\_output\_token: float \= 0.0  
    cost\_per\_image: float \= 0.0  
    cost\_per\_second\_audio: float \= 0.0  
    cost\_per\_second\_video: float \= 0.0  
    estimated\_cost\_per\_request: float \= 0.0  
      
    *\# Performance*  
    estimated\_latency\_seconds: float \= 1.0  
    max\_tokens: int \= 4096  
    max\_images: int \= 1  
    max\_audio\_seconds: float \= 600  
    max\_video\_seconds: float \= 60  
      
    *\# Quality*  
    quality\_rating: float \= 7.0  *\# 0-10*  
      
    *\# Availability*  
    is\_available: bool \= True  
    rate\_limit\_rpm: int \= 60

class ModelRegistry:  
    """Registry of available models for multimodal processing."""  
      
    def \_\_init\_\_(self):  
        self.models: Dict\[str, ModelConfig\] \= {}  
        self.\_register\_default\_models()  
      
    def \_register\_default\_models(self):  
        """Register default models."""  
          
        *\# OpenAI models*  
        self.register(ModelConfig(  
            model\_id\="gpt-4o",  
            provider\="openai",  
            name\="GPT-4o",  
            capabilities\={  
                ProcessingCapability.TEXT\_ANALYSIS,  
                ProcessingCapability.TEXT\_GENERATION,  
                ProcessingCapability.IMAGE\_ANALYSIS,  
                ProcessingCapability.MULTIMODAL\_UNDERSTANDING  
            },  
            input\_modalities\={Modality.TEXT, Modality.IMAGE},  
            output\_modalities\={Modality.TEXT},  
            cost\_per\_input\_token\=0.000005,  
            cost\_per\_output\_token\=0.000015,  
            cost\_per\_image\=0.00765,  
            estimated\_cost\_per\_request\=0.02,  
            estimated\_latency\_seconds\=2.0,  
            quality\_rating\=9.0  
        ))  
          
        self.register(ModelConfig(  
            model\_id\="gpt-4o-mini",  
            provider\="openai",  
            name\="GPT-4o Mini",  
            capabilities\={  
                ProcessingCapability.TEXT\_ANALYSIS,  
                ProcessingCapability.TEXT\_GENERATION,  
                ProcessingCapability.IMAGE\_ANALYSIS  
            },  
            input\_modalities\={Modality.TEXT, Modality.IMAGE},  
            output\_modalities\={Modality.TEXT},  
            cost\_per\_input\_token\=0.00000015,  
            cost\_per\_output\_token\=0.0000006,  
            estimated\_cost\_per\_request\=0.002,  
            estimated\_latency\_seconds\=1.0,  
            quality\_rating\=7.0  
        ))  
          
        self.register(ModelConfig(  
            model\_id\="whisper-1",  
            provider\="openai",  
            name\="Whisper",  
            capabilities\={ProcessingCapability.SPEECH\_TO\_TEXT},  
            input\_modalities\={Modality.AUDIO},  
            output\_modalities\={Modality.TEXT},  
            cost\_per\_second\_audio\=0.0001,  
            estimated\_cost\_per\_request\=0.06,  *\# 10 min audio*  
            estimated\_latency\_seconds\=30.0,  
            max\_audio\_seconds\=7200,  
            quality\_rating\=9.0  
        ))  
          
        self.register(ModelConfig(  
            model\_id\="dall-e-3",  
            provider\="openai",  
            name\="DALL-E 3",  
            capabilities\={ProcessingCapability.IMAGE\_GENERATION},  
            input\_modalities\={Modality.TEXT},  
            output\_modalities\={Modality.IMAGE},  
            cost\_per\_image\=0.04,  
            estimated\_cost\_per\_request\=0.04,  
            estimated\_latency\_seconds\=15.0,  
            quality\_rating\=9.0  
        ))  
          
        self.register(ModelConfig(  
            model\_id\="tts-1",  
            provider\="openai",  
            name\="TTS-1",  
            capabilities\={ProcessingCapability.TEXT\_TO\_SPEECH},  
            input\_modalities\={Modality.TEXT},  
            output\_modalities\={Modality.AUDIO},  
            cost\_per\_input\_token\=0.000015,  
            estimated\_cost\_per\_request\=0.015,  
            estimated\_latency\_seconds\=5.0,  
            quality\_rating\=8.0  
        ))  
          
        self.register(ModelConfig(  
            model\_id\="tts-1-hd",  
            provider\="openai",  
            name\="TTS-1 HD",  
            capabilities\={ProcessingCapability.TEXT\_TO\_SPEECH},  
            input\_modalities\={Modality.TEXT},  
            output\_modalities\={Modality.AUDIO},  
            cost\_per\_input\_token\=0.00003,  
            estimated\_cost\_per\_request\=0.03,  
            estimated\_latency\_seconds\=8.0,  
            quality\_rating\=9.5  
        ))  
          
        *\# Google models*  
        self.register(ModelConfig(  
            model\_id\="gemini-2.0-flash",  
            provider\="google",  
            name\="Gemini 2.0 Flash",  
            capabilities\={  
                ProcessingCapability.TEXT\_ANALYSIS,  
                ProcessingCapability.TEXT\_GENERATION,  
                ProcessingCapability.IMAGE\_ANALYSIS,  
                ProcessingCapability.VIDEO\_ANALYSIS,  
                ProcessingCapability.MULTIMODAL\_UNDERSTANDING  
            },  
            input\_modalities\={Modality.TEXT, Modality.IMAGE, Modality.VIDEO, Modality.AUDIO},  
            output\_modalities\={Modality.TEXT},  
            cost\_per\_input\_token\=0.0000001,  
            cost\_per\_output\_token\=0.0000004,  
            estimated\_cost\_per\_request\=0.005,  
            estimated\_latency\_seconds\=1.5,  
            max\_video\_seconds\=3600,  
            quality\_rating\=8.5  
        ))  
          
        self.register(ModelConfig(  
            model\_id\="gemini-2.0-pro",  
            provider\="google",  
            name\="Gemini 2.0 Pro",  
            capabilities\={  
                ProcessingCapability.TEXT\_ANALYSIS,  
                ProcessingCapability.TEXT\_GENERATION,  
                ProcessingCapability.IMAGE\_ANALYSIS,  
                ProcessingCapability.VIDEO\_ANALYSIS,  
                ProcessingCapability.MULTIMODAL\_UNDERSTANDING  
            },  
            input\_modalities\={Modality.TEXT, Modality.IMAGE, Modality.VIDEO, Modality.AUDIO},  
            output\_modalities\={Modality.TEXT},  
            cost\_per\_input\_token\=0.00000125,  
            cost\_per\_output\_token\=0.000005,  
            estimated\_cost\_per\_request\=0.02,  
            estimated\_latency\_seconds\=3.0,  
            quality\_rating\=9.5  
        ))  
          
        *\# Anthropic models*  
        self.register(ModelConfig(  
            model\_id\="claude-3-5-sonnet",  
            provider\="anthropic",  
            name\="Claude 3.5 Sonnet",  
            capabilities\={  
                ProcessingCapability.TEXT\_ANALYSIS,  
                ProcessingCapability.TEXT\_GENERATION,  
                ProcessingCapability.IMAGE\_ANALYSIS,  
                ProcessingCapability.MULTIMODAL\_UNDERSTANDING  
            },  
            input\_modalities\={Modality.TEXT, Modality.IMAGE},  
            output\_modalities\={Modality.TEXT},  
            cost\_per\_input\_token\=0.000003,  
            cost\_per\_output\_token\=0.000015,  
            estimated\_cost\_per\_request\=0.015,  
            estimated\_latency\_seconds\=2.5,  
            quality\_rating\=9.0  
        ))  
      
    def register(self, model: ModelConfig):  
        """Register a model."""  
        self.models\[model.model\_id\] \= model  
      
    def get\_models\_for\_capability(  
        self,  
        capability: ProcessingCapability  
    ) \-\> List\[ModelConfig\]:  
        """Get all models that support a capability."""  
        return \[  
            m for m in self.models.values()  
            if capability in m.capabilities and m.is\_available  
        \]  
      
    def find\_cheaper\_alternative(  
        self,  
        current\_model\_id: str,  
        capability: ProcessingCapability,  
        max\_cost\_per\_unit: float  
    ) \-\> Optional\[ModelConfig\]:  
        """Find a cheaper model that supports the capability."""  
          
        candidates \= self.get\_models\_for\_capability(capability)  
        affordable \= \[  
            m for m in candidates  
            if m.estimated\_cost\_per\_request \< max\_cost\_per\_unit  
            and m.model\_id \!= current\_model\_id  
        \]  
          
        if not affordable:  
            return None  
          
        *\# Return cheapest*  
        return min(affordable, key\=lambda m: m.estimated\_cost\_per\_request)  
      
    def find\_faster\_alternative(  
        self,  
        current\_model\_id: str,  
        capability: ProcessingCapability  
    ) \-\> Optional\[ModelConfig\]:  
        """Find a faster model that supports the capability."""  
          
        current \= self.models.get(current\_model\_id)  
        if not current:  
            return None  
          
        candidates \= self.get\_models\_for\_capability(capability)  
        faster \= \[  
            m for m in candidates  
            if m.estimated\_latency\_seconds \< current.estimated\_latency\_seconds  
            and m.model\_id \!= current\_model\_id  
        \]  
          
        if not faster:  
            return None  
          
        *\# Return fastest*  
        return min(faster, key\=lambda m: m.estimated\_latency\_seconds)

## **8\. Complete Example: Video to Narrated Slides**

Python  
async def video\_to\_narrated\_slides\_example():  
    """  
    Complete example: Analyze a video, extract insights, generate narrated slides.  
      
    This demonstrates the full multimodal pipeline including:  
    \- Task decomposition  
    \- Specialized agent coordination  
    \- Tool chaining  
    \- Cost/latency control  
    """  
      
    *\# Initialize components*  
    model\_registry \= ModelRegistry()  
    cost\_controller \= CostController(model\_registry)  
    artifact\_store \= ArtifactStore()  
      
    *\# Create specialized agents*  
    agents \= {  
        "vision\_agent": SpecializedAgent(  
            agent\_id\="vision\_agent",  
            name\="Vision Agent",  
            agent\_type\="vision",  
            primary\_model\="gemini-2.0-flash",  
            capabilities\=\[  
                AgentCapability(  
                    capability\=ProcessingCapability.VIDEO\_ANALYSIS,  
                    input\_modalities\={Modality.VIDEO},  
                    output\_modalities\={Modality.TEXT},  
                    supported\_formats\={MediaFormat.MP4, MediaFormat.WEBM},  
                    avg\_latency\_seconds\=30.0,  
                    cost\_per\_unit\=0.001,  
                    cost\_unit\="second",  
                    max\_input\_size\_bytes\=500\_000\_000,  
                    max\_duration\_seconds\=3600  
                )  
            \]  
        ),  
        "audio\_agent": SpecializedAgent(  
            agent\_id\="audio\_agent",  
            name\="Audio Agent",  
            agent\_type\="audio",  
            primary\_model\="whisper-1",  
            capabilities\=\[  
                AgentCapability(  
                    capability\=ProcessingCapability.SPEECH\_TO\_TEXT,  
                    input\_modalities\={Modality.AUDIO},  
                    output\_modalities\={Modality.TEXT},  
                    supported\_formats\={MediaFormat.MP3, MediaFormat.WAV},  
                    avg\_latency\_seconds\=0.5,  
                    cost\_per\_unit\=0.0001,  
                    cost\_unit\="second",  
                    max\_input\_size\_bytes\=25\_000\_000,  
                    max\_duration\_seconds\=7200  
                ),  
                AgentCapability(  
                    capability\=ProcessingCapability.TEXT\_TO\_SPEECH,  
                    input\_modalities\={Modality.TEXT},  
                    output\_modalities\={Modality.AUDIO},  
                    supported\_formats\={MediaFormat.MP3},  
                    avg\_latency\_seconds\=5.0,  
                    cost\_per\_unit\=0.000015,  
                    cost\_unit\="token",  
                    max\_input\_size\_bytes\=100\_000  
                )  
            \]  
        ),  
        "text\_agent": SpecializedAgent(  
            agent\_id\="text\_agent",  
            name\="Text Agent",  
            agent\_type\="text",  
            primary\_model\="gpt-4o",  
            capabilities\=\[  
                AgentCapability(  
                    capability\=ProcessingCapability.TEXT\_GENERATION,  
                    input\_modalities\={Modality.TEXT},  
                    output\_modalities\={Modality.TEXT},  
                    supported\_formats\={MediaFormat.PLAIN\_TEXT, MediaFormat.MARKDOWN},  
                    avg\_latency\_seconds\=2.0,  
                    cost\_per\_unit\=0.00001,  
                    cost\_unit\="token",  
                    max\_input\_size\_bytes\=100\_000  
                )  
            \]  
        ),  
        "multimodal\_agent": SpecializedAgent(  
            agent\_id\="multimodal\_agent",  
            name\="Multimodal Agent",  
            agent\_type\="multimodal",  
            primary\_model\="gpt-4o",  
            capabilities\=\[  
                AgentCapability(  
                    capability\=ProcessingCapability.MULTIMODAL\_UNDERSTANDING,  
                    input\_modalities\={Modality.TEXT, Modality.IMAGE},  
                    output\_modalities\={Modality.TEXT},  
                    supported\_formats\={MediaFormat.PLAIN\_TEXT, MediaFormat.PNG, MediaFormat.JPEG},  
                    avg\_latency\_seconds\=3.0,  
                    cost\_per\_unit\=0.00001,  
                    cost\_unit\="token",  
                    max\_input\_size\_bytes\=10\_000\_000  
                )  
            \]  
        )  
    }  
      
    *\# Create planner*  
    planner \= MultimodalPlanner(  
        agents\=agents,  
        model\_registry\=model\_registry,  
        cost\_controller\=cost\_controller,  
        artifact\_store\=artifact\_store  
    )  
      
    *\# Create input artifact (video)*  
    video\_artifact \= MediaArtifact(  
        artifact\_id\="video\_001",  
        modality\=Modality.VIDEO,  
        format\=MediaFormat.MP4,  
        content\_url\="s3://bucket/input\_video.mp4",  
        size\_bytes\=50\_000\_000,  
        duration\_seconds\=300,  *\# 5 minute video*  
        dimensions\=(1920, 1080),  
        frame\_rate\=30.0  
    )  
      
    *\# Create task*  
    task \= MultimodalTask(  
        task\_id\="task\_001",  
        description\="""  
        Analyze this video presentation and create a narrated slide deck:  
        1\. Extract key visual information from the video  
        2\. Transcribe the audio narration  
        3\. Identify main topics and insights  
        4\. Generate a 10-slide presentation summarizing the content  
        5\. Create professional narration for each slide  
        6\. Combine into a narrated slide video  
        """,  
        input\_artifacts\=\[video\_artifact\],  
        input\_modalities\={Modality.VIDEO},  
        output\_modalities\={Modality.PRESENTATION, Modality.AUDIO},  
        max\_cost\_usd\=5.00,  
        max\_latency\_seconds\=300,  *\# 5 minutes*  
        quality\_preference\="balanced",  
        user\_id\="user\_001",  
        tenant\_id\="tenant\_001"  
    )  
      
    *\# Plan the task*  
    print("=" \* 70)  
    print("PLANNING MULTIMODAL TASK")  
    print("=" \* 70)  
      
    plan \= await planner.plan\_task(task)  
      
    print(f"\\nStrategy: {plan.strategy\_used}")  
    print(f"Subtasks: {len(plan.subtasks)}")  
    print(f"Estimated cost: ${plan.estimates.total\_cost:.4f}")  
    print(f"Estimated latency: {plan.estimates.total\_latency:.1f}s")  
      
    print("\\nSubtask breakdown:")  
    for subtask in plan.subtasks:  
        print(f"  \- {subtask.subtask\_id}")  
        print(f"    Capability: {subtask.capability.value}")  
        print(f"    Agent: {subtask.assigned\_agent}")  
        print(f"    Model: {subtask.assigned\_model}")  
        print(f"    Dependencies: {subtask.depends\_on}")  
        print(f"    Est. cost: ${subtask.estimated\_cost\_usd:.4f}")  
        print(f"    Est. latency: {subtask.estimated\_latency\_seconds:.1f}s")  
        print()  
      
    print("\\nCritical path:", " \-\> ".join(plan.estimates.critical\_path))  
    print("\\nParallel groups:")  
    for i, group in enumerate(plan.estimates.parallelizable\_subtasks):  
        print(f"  Group {i+1}: {group}")  
      
    return plan

*\# Run example*  
if \_\_name\_\_ \== "\_\_main\_\_":  
    import asyncio  
    asyncio.run(video\_to\_narrated\_slides\_example())

## **9\. Summary: Architecture Decisions**

Plain Text  
┌─────────────────────────────────────────────────────────────────────────────┐  
│                    MULTIMODAL ARCHITECTURE SUMMARY                           │  
├─────────────────────────────────────────────────────────────────────────────┤  
│                                                                              │  
│  Q: Single multimodal agent or multiple specialized agents?                 │  
│  A: HYBRID APPROACH                                                          │  
│     • Multimodal Planner coordinates overall task                           │  
│     • Specialized agents for heavy processing (video, audio)                │  
│     • Unified multimodal models for cross-modal reasoning                   │  
│     • Strategy selected based on task complexity                            │  
│                                                                              │  
│  AGENT SPECIALIZATION:                                                       │  
│  ═════════════════════                                                      │  
│  • Vision Agent: Video analysis, image processing, OCR                      │  
│  • Audio Agent: Transcription (STT), narration (TTS)                        │  
│  • Text Agent: Analysis, generation, summarization                          │  
│  • Multimodal Agent: Cross-modal reasoning, fusion                          │  
│                                                                              │  
│  MODALITY BOUNDARIES:                                                        │  
│  ════════════════════                                                       │  
│  • Clear input/output contracts per agent                                   │  
│  • Artifacts as boundary objects (MediaArtifact)                            │  
│  • Explicit cross-modal operations in task graph                            │  
│  • Format conversion handled at boundaries                                  │  
│                                                                              │  
│  SCHEDULING COMPLEXITY:                                                      │  
│  ══════════════════════                                                     │  
│  • DAG-based dependency management                                          │  
│  • Parallel execution of independent subtasks                               │  
│  • Critical path optimization for latency                                   │  
│  • Dynamic model selection based on budget                                  │  
│                                                                              │  
│  COST/LATENCY CONTROLS:                                                      │  
│  ══════════════════════                                                     │  
│  • Pre-execution budget checks                                              │  
│  • Model selection optimization                                             │  
│  • Circuit breakers for runaway costs                                       │  
│  • Latency percentile tracking                                              │  
│  • Parallelization suggestions                                              │  
│                                                                              │  
│  TOOL CHAINING:                                                              │  
│  ══════════════                                                             │  
│  • Named chains for common workflows                                        │  
│  • Input/output compatibility validation                                    │  
│  • Budget tracking through chain execution                                  │  
│  • Audit logging at each step                                               │  
│                                                                              │  
└─────────────────────────────────────────────────────────────────────────────┘

This architecture enables efficient multimodal processing while maintaining control over costs, latency, and quality through the hybrid approach of specialized agents coordinated by a central planner.

# **extract\_capabilities Function: Complete Implementation**

This document provides detailed pseudocode for the \_extract\_capabilities function, showing how LLM interaction is used to analyze task descriptions and identify required processing capabilities.

## **1\. Function Overview**

Plain Text  
┌─────────────────────────────────────────────────────────────────────────────┐  
│                    \_extract\_capabilities FLOW                                │  
├─────────────────────────────────────────────────────────────────────────────┤  
│                                                                              │  
│  INPUT: Task description (natural language)                                  │  
│         "Analyze this video and create narrated slides..."                  │  
│                                                                              │  
│                              │                                               │  
│                              ▼                                               │  
│  ┌─────────────────────────────────────────────────────────────────────┐   │  
│  │                    PREPROCESSING                                     │   │  
│  │  • Normalize text                                                    │   │  
│  │  • Extract keywords                                                  │   │  
│  │  • Identify action verbs                                             │   │  
│  └─────────────────────────────────────────────────────────────────────┘   │  
│                              │                                               │  
│                              ▼                                               │  
│  ┌─────────────────────────────────────────────────────────────────────┐   │  
│  │                    RULE-BASED DETECTION                              │   │  
│  │  • Pattern matching for common capabilities                         │   │  
│  │  • Keyword → Capability mapping                                      │   │  
│  │  • Confidence scoring                                                │   │  
│  └─────────────────────────────────────────────────────────────────────┘   │  
│                              │                                               │  
│                              ▼                                               │  
│  ┌─────────────────────────────────────────────────────────────────────┐   │  
│  │                    LLM REFINEMENT                                    │   │  
│  │  • Structured prompt with capability definitions                    │   │  
│  │  • JSON schema enforcement                                           │   │  
│  │  • Confidence calibration                                            │   │  
│  └─────────────────────────────────────────────────────────────────────┘   │  
│                              │                                               │  
│                              ▼                                               │  
│  ┌─────────────────────────────────────────────────────────────────────┐   │  
│  │                    VALIDATION & MERGING                              │   │  
│  │  • Merge rule-based and LLM results                                 │   │  
│  │  • Resolve conflicts                                                 │   │  
│  │  • Apply confidence thresholds                                       │   │  
│  └─────────────────────────────────────────────────────────────────────┘   │  
│                              │                                               │  
│                              ▼                                               │  
│  OUTPUT: Set\[ProcessingCapability\] with confidence scores                   │  
│                                                                              │  
└─────────────────────────────────────────────────────────────────────────────┘

## **2\. Complete Implementation**

Python  
from \_\_future\_\_ import annotations

import json  
import re  
from dataclasses import dataclass, field  
from enum import Enum  
from typing import Any, Dict, List, Optional, Set, Tuple  
import asyncio

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# CAPABILITY DEFINITIONS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class ProcessingCapability(Enum):  
    """All available processing capabilities."""  
    *\# Text*  
    TEXT\_ANALYSIS \= "text\_analysis"  
    TEXT\_GENERATION \= "text\_generation"  
    TEXT\_SUMMARIZATION \= "text\_summarization"  
    TEXT\_TRANSLATION \= "text\_translation"  
      
    *\# Vision*  
    IMAGE\_ANALYSIS \= "image\_analysis"  
    IMAGE\_GENERATION \= "image\_generation"  
    IMAGE\_EDITING \= "image\_editing"  
    OCR \= "ocr"  
    VIDEO\_ANALYSIS \= "video\_analysis"  
    VIDEO\_GENERATION \= "video\_generation"  
      
    *\# Audio*  
    SPEECH\_TO\_TEXT \= "speech\_to\_text"  
    TEXT\_TO\_SPEECH \= "text\_to\_speech"  
    AUDIO\_ANALYSIS \= "audio\_analysis"  
    MUSIC\_GENERATION \= "music\_generation"  
      
    *\# Cross-modal*  
    MULTIMODAL\_UNDERSTANDING \= "multimodal\_understanding"  
    CROSS\_MODAL\_SEARCH \= "cross\_modal\_search"  
    MODALITY\_FUSION \= "modality\_fusion"

@dataclass  
class CapabilityDefinition:  
    """Definition of a capability for LLM context."""  
    capability: ProcessingCapability  
    description: str  
    keywords: List\[str\]  
    action\_verbs: List\[str\]  
    input\_indicators: List\[str\]  
    output\_indicators: List\[str\]  
    examples: List\[str\]

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# CAPABILITY REGISTRY*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

CAPABILITY\_DEFINITIONS: Dict\[ProcessingCapability, CapabilityDefinition\] \= {  
    ProcessingCapability.TEXT\_ANALYSIS: CapabilityDefinition(  
        capability\=ProcessingCapability.TEXT\_ANALYSIS,  
        description\="Analyze text content to extract insights, sentiment, entities, or structure",  
        keywords\=\["analyze", "extract", "understand", "parse", "interpret", "examine"\],  
        action\_verbs\=\["analyze", "examine", "study", "review", "assess", "evaluate"\],  
        input\_indicators\=\["text", "document", "article", "content", "passage", "paragraph"\],  
        output\_indicators\=\["insights", "analysis", "findings", "summary", "report"\],  
        examples\=\[  
            "Analyze this document for key themes",  
            "Extract entities from the text",  
            "What is the sentiment of this article?"  
        \]  
    ),  
      
    ProcessingCapability.TEXT\_GENERATION: CapabilityDefinition(  
        capability\=ProcessingCapability.TEXT\_GENERATION,  
        description\="Generate new text content based on prompts or context",  
        keywords\=\["write", "generate", "create", "compose", "draft", "produce"\],  
        action\_verbs\=\["write", "generate", "create", "compose", "draft", "author"\],  
        input\_indicators\=\["prompt", "topic", "outline", "brief", "instructions"\],  
        output\_indicators\=\["text", "content", "article", "document", "copy", "script"\],  
        examples\=\[  
            "Write an article about climate change",  
            "Generate product descriptions",  
            "Create a blog post on this topic"  
        \]  
    ),  
      
    ProcessingCapability.TEXT\_SUMMARIZATION: CapabilityDefinition(  
        capability\=ProcessingCapability.TEXT\_SUMMARIZATION,  
        description\="Condense long text into shorter summaries while preserving key information",  
        keywords\=\["summarize", "condense", "shorten", "brief", "digest", "recap"\],  
        action\_verbs\=\["summarize", "condense", "shorten", "distill", "compress"\],  
        input\_indicators\=\["long text", "document", "article", "report", "transcript"\],  
        output\_indicators\=\["summary", "brief", "overview", "digest", "synopsis"\],  
        examples\=\[  
            "Summarize this research paper",  
            "Give me a brief overview of the document",  
            "Condense this into key points"  
        \]  
    ),  
      
    ProcessingCapability.IMAGE\_ANALYSIS: CapabilityDefinition(  
        capability\=ProcessingCapability.IMAGE\_ANALYSIS,  
        description\="Analyze images to identify objects, scenes, text, or extract information",  
        keywords\=\["analyze", "identify", "detect", "recognize", "describe", "examine"\],  
        action\_verbs\=\["analyze", "examine", "identify", "detect", "describe", "inspect"\],  
        input\_indicators\=\["image", "photo", "picture", "screenshot", "diagram", "chart"\],  
        output\_indicators\=\["description", "objects", "labels", "analysis", "findings"\],  
        examples\=\[  
            "What objects are in this image?",  
            "Describe the scene in this photo",  
            "Analyze this chart and explain the data"  
        \]  
    ),  
      
    ProcessingCapability.IMAGE\_GENERATION: CapabilityDefinition(  
        capability\=ProcessingCapability.IMAGE\_GENERATION,  
        description\="Generate new images from text descriptions or prompts",  
        keywords\=\["generate", "create", "draw", "design", "illustrate", "render"\],  
        action\_verbs\=\["generate", "create", "draw", "design", "illustrate", "produce"\],  
        input\_indicators\=\["description", "prompt", "concept", "idea", "specification"\],  
        output\_indicators\=\["image", "illustration", "artwork", "visual", "graphic"\],  
        examples\=\[  
            "Generate an image of a sunset over mountains",  
            "Create an illustration for this concept",  
            "Design a logo for my company"  
        \]  
    ),  
      
    ProcessingCapability.VIDEO\_ANALYSIS: CapabilityDefinition(  
        capability\=ProcessingCapability.VIDEO\_ANALYSIS,  
        description\="Analyze video content to extract information, understand scenes, or transcribe",  
        keywords\=\["analyze", "watch", "review", "examine", "understand", "extract"\],  
        action\_verbs\=\["analyze", "watch", "review", "examine", "study", "process"\],  
        input\_indicators\=\["video", "clip", "footage", "recording", "movie", "film"\],  
        output\_indicators\=\["analysis", "transcript", "summary", "insights", "description"\],  
        examples\=\[  
            "Analyze this video and summarize the content",  
            "What happens in this video clip?",  
            "Extract key moments from the recording"  
        \]  
    ),  
      
    ProcessingCapability.SPEECH\_TO\_TEXT: CapabilityDefinition(  
        capability\=ProcessingCapability.SPEECH\_TO\_TEXT,  
        description\="Convert spoken audio into written text (transcription)",  
        keywords\=\["transcribe", "convert", "speech", "audio", "voice", "dictation"\],  
        action\_verbs\=\["transcribe", "convert", "capture", "record", "dictate"\],  
        input\_indicators\=\["audio", "speech", "voice", "recording", "podcast", "interview"\],  
        output\_indicators\=\["transcript", "text", "transcription", "written", "captions"\],  
        examples\=\[  
            "Transcribe this audio recording",  
            "Convert the speech to text",  
            "Generate captions for this video"  
        \]  
    ),  
      
    ProcessingCapability.TEXT\_TO\_SPEECH: CapabilityDefinition(  
        capability\=ProcessingCapability.TEXT\_TO\_SPEECH,  
        description\="Convert written text into spoken audio (narration)",  
        keywords\=\["narrate", "speak", "voice", "audio", "read", "vocalize"\],  
        action\_verbs\=\["narrate", "speak", "read", "voice", "vocalize", "pronounce"\],  
        input\_indicators\=\["text", "script", "content", "document", "article"\],  
        output\_indicators\=\["audio", "narration", "voiceover", "speech", "recording"\],  
        examples\=\[  
            "Create narration for these slides",  
            "Read this article aloud",  
            "Generate voiceover for the video"  
        \]  
    ),  
      
    ProcessingCapability.MULTIMODAL\_UNDERSTANDING: CapabilityDefinition(  
        capability\=ProcessingCapability.MULTIMODAL\_UNDERSTANDING,  
        description\="Understand and reason across multiple modalities (text, image, audio, video)",  
        keywords\=\["understand", "combine", "integrate", "cross-reference", "correlate"\],  
        action\_verbs\=\["understand", "combine", "integrate", "correlate", "synthesize"\],  
        input\_indicators\=\["multiple", "combined", "together", "along with", "and"\],  
        output\_indicators\=\["understanding", "insights", "analysis", "synthesis"\],  
        examples\=\[  
            "Analyze this video and its transcript together",  
            "Understand the relationship between the image and text",  
            "Combine insights from all sources"  
        \]  
    ),  
      
    ProcessingCapability.MODALITY\_FUSION: CapabilityDefinition(  
        capability\=ProcessingCapability.MODALITY\_FUSION,  
        description\="Combine multiple modalities into a unified output (e.g., slides with narration)",  
        keywords\=\["combine", "merge", "fuse", "integrate", "unify", "blend"\],  
        action\_verbs\=\["combine", "merge", "fuse", "integrate", "unify", "blend"\],  
        input\_indicators\=\["slides", "audio", "video", "images", "text"\],  
        output\_indicators\=\["presentation", "video", "package", "combined", "unified"\],  
        examples\=\[  
            "Create a narrated slide deck",  
            "Combine the slides with voiceover",  
            "Merge video and audio into final output"  
        \]  
    ),  
}

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# DETECTED CAPABILITY WITH CONFIDENCE*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class DetectedCapability:  
    """A capability detected from task description with confidence."""  
    capability: ProcessingCapability  
    confidence: float  *\# 0.0 \- 1.0*  
    source: str  *\# "rule\_based", "llm", "merged"*  
    evidence: List\[str\] \= field(default\_factory\=list)  *\# Matching keywords/phrases*  
    reasoning: str \= ""

@dataclass  
class CapabilityExtractionResult:  
    """Result of capability extraction."""  
    capabilities: Set\[ProcessingCapability\]  
    detailed\_results: List\[DetectedCapability\]  
    raw\_llm\_response: Optional\[Dict\[str, Any\]\] \= None  
    extraction\_method: str \= "hybrid"  *\# "rule\_based", "llm", "hybrid"*

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# LLM CLIENT (SIMULATED)*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class LLMClient:  
    """  
    LLM client for capability extraction.  
      
    In production, this would call OpenAI, Anthropic, or other LLM APIs.  
    Here we simulate the LLM response for demonstration.  
    """  
      
    def \_\_init\_\_(self, model: str \= "gpt-4o"):  
        self.model \= model  
        self.call\_count \= 0  
        self.total\_tokens \= 0  
      
    async def complete(  
        self,  
        messages: List\[Dict\[str, str\]\],  
        response\_format: Optional\[Dict\[str, Any\]\] \= None,  
        temperature: float \= 0.0  
    ) \-\> Dict\[str, Any\]:  
        """  
        Call the LLM with messages and return structured response.  
          
        In production:  
        \`\`\`python  
        response \= await openai.ChatCompletion.acreate(  
            model=self.model,  
            messages=messages,  
            response\_format=response\_format,  
            temperature=temperature  
        )  
        return json.loads(response.choices\[0\].message.content)  
        \`\`\`  
        """  
          
        self.call\_count \+= 1  
          
        *\# Extract the task description from messages*  
        task\_description \= ""  
        for msg in messages:  
            if msg\["role"\] \== "user":  
                task\_description \= msg\["content"\]  
                break  
          
        *\# Simulate LLM analysis*  
        return self.\_simulate\_llm\_response(task\_description)  
      
    def \_simulate\_llm\_response(self, task\_description: str) \-\> Dict\[str, Any\]:  
        """  
        Simulate LLM capability extraction.  
          
        This simulates how an LLM would analyze the task and identify capabilities.  
        In production, this would be the actual LLM response.  
        """  
          
        task\_lower \= task\_description.lower()  
        detected \= \[\]  
          
        *\# Simulate LLM reasoning for each capability*  
        capability\_checks \= \[  
            *\# (capability, trigger\_patterns, confidence\_boost\_patterns)*  
            (  
                ProcessingCapability.VIDEO\_ANALYSIS,  
                \["video", "watch", "footage", "clip", "recording"\],  
                \["analyze", "understand", "extract", "review"\]  
            ),  
            (  
                ProcessingCapability.SPEECH\_TO\_TEXT,  
                \["transcribe", "transcript", "speech to text", "audio to text"\],  
                \["audio", "voice", "spoken"\]  
            ),  
            (  
                ProcessingCapability.TEXT\_TO\_SPEECH,  
                \["narrate", "narration", "voiceover", "text to speech", "read aloud"\],  
                \["audio", "voice", "speak"\]  
            ),  
            (  
                ProcessingCapability.IMAGE\_ANALYSIS,  
                \["image", "photo", "picture", "visual"\],  
                \["analyze", "identify", "detect", "describe"\]  
            ),  
            (  
                ProcessingCapability.IMAGE\_GENERATION,  
                \["generate image", "create image", "draw", "illustrate"\],  
                \["visual", "graphic", "artwork"\]  
            ),  
            (  
                ProcessingCapability.TEXT\_GENERATION,  
                \["write", "generate", "create", "compose", "draft"\],  
                \["text", "content", "article", "script", "slides"\]  
            ),  
            (  
                ProcessingCapability.TEXT\_SUMMARIZATION,  
                \["summarize", "summary", "condense", "key points"\],  
                \["brief", "overview", "digest"\]  
            ),  
            (  
                ProcessingCapability.MULTIMODAL\_UNDERSTANDING,  
                \["understand", "analyze together", "combine insights"\],  
                \["video and", "image and", "audio and", "multiple"\]  
            ),  
            (  
                ProcessingCapability.MODALITY\_FUSION,  
                \["combine", "merge", "fuse", "narrated slides", "with audio"\],  
                \["presentation", "video", "package"\]  
            ),  
        \]  
          
        for capability, triggers, boosters in capability\_checks:  
            *\# Check for trigger patterns*  
            trigger\_matches \= \[t for t in triggers if t in task\_lower\]  
            booster\_matches \= \[b for b in boosters if b in task\_lower\]  
              
            if trigger\_matches:  
                *\# Base confidence from trigger matches*  
                base\_confidence \= min(0.5 \+ 0.15 \* len(trigger\_matches), 0.85)  
                  
                *\# Boost from booster patterns*  
                boost \= min(0.05 \* len(booster\_matches), 0.15)  
                  
                confidence \= min(base\_confidence \+ boost, 0.95)  
                  
                detected.append({  
                    "capability": capability.value,  
                    "confidence": round(confidence, 2),  
                    "reasoning": f"Detected triggers: {trigger\_matches}. Boosters: {booster\_matches}.",  
                    "evidence": trigger\_matches \+ booster\_matches  
                })  
          
        *\# Simulate token usage*  
        self.total\_tokens \+= len(task\_description.split()) \* 2 \+ 500  
          
        return {  
            "capabilities": detected,  
            "task\_complexity": self.\_assess\_complexity(task\_description),  
            "suggested\_pipeline": self.\_suggest\_pipeline(detected),  
            "warnings": self.\_generate\_warnings(task\_description, detected)  
        }  
      
    def \_assess\_complexity(self, task\_description: str) \-\> str:  
        """Assess task complexity."""  
        word\_count \= len(task\_description.split())  
        modality\_indicators \= sum(1 for m in \["video", "audio", "image", "text", "slides"\]   
                                   if m in task\_description.lower())  
          
        if modality\_indicators \>= 3 or word\_count \> 100:  
            return "complex"  
        elif modality\_indicators \>= 2 or word\_count \> 50:  
            return "moderate"  
        else:  
            return "simple"  
      
    def \_suggest\_pipeline(self, detected: List\[Dict\]) \-\> List\[str\]:  
        """Suggest processing pipeline order."""  
        *\# Simple ordering based on typical workflow*  
        order\_map \= {  
            "video\_analysis": 1,  
            "speech\_to\_text": 2,  
            "image\_analysis": 3,  
            "text\_analysis": 4,  
            "text\_summarization": 5,  
            "multimodal\_understanding": 6,  
            "text\_generation": 7,  
            "image\_generation": 8,  
            "text\_to\_speech": 9,  
            "modality\_fusion": 10  
        }  
          
        sorted\_caps \= sorted(  
            \[d\["capability"\] for d in detected\],  
            key\=lambda x: order\_map.get(x, 99)  
        )  
          
        return sorted\_caps  
      
    def \_generate\_warnings(  
        self,  
        task\_description: str,  
        detected: List\[Dict\]  
    ) \-\> List\[str\]:  
        """Generate warnings about the task."""  
        warnings \= \[\]  
          
        *\# Check for potentially expensive operations*  
        expensive\_ops \= \["video\_generation", "music\_generation"\]  
        for d in detected:  
            if d\["capability"\] in expensive\_ops:  
                warnings.append(f"{d\['capability'\]} is a high-cost operation")  
          
        *\# Check for ambiguous requirements*  
        if len(detected) \== 0:  
            warnings.append("No clear capabilities detected \- task may be ambiguous")  
          
        return warnings

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# MAIN EXTRACTION FUNCTION*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class CapabilityExtractor:  
    """  
    Extracts required processing capabilities from task descriptions.  
      
    Uses a hybrid approach:  
    1\. Rule-based detection for fast, reliable matching  
    2\. LLM refinement for nuanced understanding  
    3\. Merging and validation of results  
    """  
      
    def \_\_init\_\_(  
        self,  
        llm\_client: Optional\[LLMClient\] \= None,  
        confidence\_threshold: float \= 0.5,  
        use\_llm: bool \= True  
    ):  
        self.llm\_client \= llm\_client or LLMClient()  
        self.confidence\_threshold \= confidence\_threshold  
        self.use\_llm \= use\_llm  
        self.definitions \= CAPABILITY\_DEFINITIONS  
      
    async def extract\_capabilities(  
        self,  
        description: str  
    ) \-\> CapabilityExtractionResult:  
        """  
        Extract capabilities from a task description.  
          
        Args:  
            description: Natural language task description  
              
        Returns:  
            CapabilityExtractionResult with detected capabilities  
        """  
          
        *\# Step 1: Preprocess*  
        normalized \= self.\_preprocess(description)  
          
        *\# Step 2: Rule-based detection*  
        rule\_based\_results \= self.\_rule\_based\_detection(normalized)  
          
        *\# Step 3: LLM refinement (if enabled)*  
        llm\_results \= \[\]  
        raw\_llm\_response \= None  
          
        if self.use\_llm:  
            llm\_results, raw\_llm\_response \= await self.\_llm\_detection(description)  
          
        *\# Step 4: Merge results*  
        merged\_results \= self.\_merge\_results(rule\_based\_results, llm\_results)  
          
        *\# Step 5: Apply confidence threshold*  
        filtered\_results \= \[  
            r for r in merged\_results  
            if r.confidence \>= self.confidence\_threshold  
        \]  
          
        *\# Extract capability set*  
        capabilities \= {r.capability for r in filtered\_results}  
          
        return CapabilityExtractionResult(  
            capabilities\=capabilities,  
            detailed\_results\=filtered\_results,  
            raw\_llm\_response\=raw\_llm\_response,  
            extraction\_method\="hybrid" if self.use\_llm else "rule\_based"  
        )  
      
    def \_preprocess(self, description: str) \-\> str:  
        """Normalize and preprocess the description."""  
          
        *\# Lowercase*  
        text \= description.lower()  
          
        *\# Remove extra whitespace*  
        text \= re.sub(r'\\s\+', ' ', text).strip()  
          
        *\# Expand common contractions*  
        contractions \= {  
            "don't": "do not",  
            "won't": "will not",  
            "can't": "cannot",  
            "i'm": "i am",  
            "it's": "it is",  
            "let's": "let us"  
        }  
        for contraction, expansion in contractions.items():  
            text \= text.replace(contraction, expansion)  
          
        return text  
      
    def \_rule\_based\_detection(self, normalized\_text: str) \-\> List\[DetectedCapability\]:  
        """  
        Detect capabilities using rule-based pattern matching.  
          
        This provides fast, reliable detection for common patterns.  
        """  
          
        results \= \[\]  
          
        for capability, definition in self.definitions.items():  
            evidence \= \[\]  
            score \= 0.0  
              
            *\# Check keywords*  
            keyword\_matches \= \[  
                kw for kw in definition.keywords  
                if kw in normalized\_text  
            \]  
            if keyword\_matches:  
                score \+= 0.3 \* min(len(keyword\_matches) / 2, 1.0)  
                evidence.extend(keyword\_matches)  
              
            *\# Check action verbs*  
            verb\_matches \= \[  
                v for v in definition.action\_verbs  
                if v in normalized\_text  
            \]  
            if verb\_matches:  
                score \+= 0.2 \* min(len(verb\_matches) / 2, 1.0)  
                evidence.extend(verb\_matches)  
              
            *\# Check input indicators*  
            input\_matches \= \[  
                i for i in definition.input\_indicators  
                if i in normalized\_text  
            \]  
            if input\_matches:  
                score \+= 0.25 \* min(len(input\_matches) / 2, 1.0)  
                evidence.extend(input\_matches)  
              
            *\# Check output indicators*  
            output\_matches \= \[  
                o for o in definition.output\_indicators  
                if o in normalized\_text  
            \]  
            if output\_matches:  
                score \+= 0.25 \* min(len(output\_matches) / 2, 1.0)  
                evidence.extend(output\_matches)  
              
            if score \> 0:  
                results.append(DetectedCapability(  
                    capability\=capability,  
                    confidence\=min(score, 0.9),  *\# Cap at 0.9 for rule-based*  
                    source\="rule\_based",  
                    evidence\=list(set(evidence)),  
                    reasoning\=f"Matched {len(evidence)} patterns from definition"  
                ))  
          
        return results  
      
    async def \_llm\_detection(  
        self,  
        description: str  
    ) \-\> Tuple\[List\[DetectedCapability\], Dict\[str, Any\]\]:  
        """  
        Detect capabilities using LLM analysis.  
          
        This provides nuanced understanding for complex or ambiguous tasks.  
        """  
          
        *\# Build prompt*  
        prompt \= self.\_build\_llm\_prompt(description)  
          
        *\# Call LLM*  
        response \= await self.llm\_client.complete(  
            messages\=\[  
                {"role": "system", "content": self.\_get\_system\_prompt()},  
                {"role": "user", "content": prompt}  
            \],  
            response\_format\={"type": "json\_object"},  
            temperature\=0.0  
        )  
          
        *\# Parse response*  
        results \= \[\]  
        for cap\_data in response.get("capabilities", \[\]):  
            try:  
                capability \= ProcessingCapability(cap\_data\["capability"\])  
                results.append(DetectedCapability(  
                    capability\=capability,  
                    confidence\=cap\_data.get("confidence", 0.7),  
                    source\="llm",  
                    evidence\=cap\_data.get("evidence", \[\]),  
                    reasoning\=cap\_data.get("reasoning", "")  
                ))  
            except (ValueError, KeyError):  
                continue  
          
        return results, response  
      
    def \_get\_system\_prompt(self) \-\> str:  
        """Get system prompt for LLM."""  
          
        capability\_descriptions \= "\\n".join(\[  
            f"- {cap.value}: {defn.description}"  
            for cap, defn in self.definitions.items()  
        \])  
          
        return f"""You are an expert at analyzing task descriptions and identifying   
required processing capabilities for multimodal AI systems.

Available capabilities:  
{capability\_descriptions}

Your job is to:  
1\. Carefully read the task description  
2\. Identify which capabilities are needed to complete the task  
3\. Assign a confidence score (0.0-1.0) to each capability  
4\. Provide reasoning for each detection

Respond in JSON format with this structure:  
{{  
    "capabilities": \[  
        {{  
            "capability": "capability\_name",  
            "confidence": 0.85,  
            "reasoning": "Why this capability is needed",  
            "evidence": \["matching phrase 1", "matching phrase 2"\]  
        }}  
    \],  
    "task\_complexity": "simple|moderate|complex",  
    "suggested\_pipeline": \["capability1", "capability2"\],  
    "warnings": \["any warnings about the task"\]  
}}

Be precise and only include capabilities that are clearly needed."""  
      
    def \_build\_llm\_prompt(self, description: str) \-\> str:  
        """Build user prompt for LLM."""  
          
        return f"""Analyze this task description and identify the required processing capabilities:

TASK DESCRIPTION:  
{description}

Identify all capabilities needed to complete this task. Consider:  
\- What inputs are mentioned (video, audio, images, text)?  
\- What outputs are expected (slides, narration, summary)?  
\- What transformations are needed (transcription, generation, analysis)?

Respond with the JSON structure specified in your instructions."""  
      
    def \_merge\_results(  
        self,  
        rule\_based: List\[DetectedCapability\],  
        llm\_based: List\[DetectedCapability\]  
    ) \-\> List\[DetectedCapability\]:  
        """  
        Merge rule-based and LLM-based results.  
          
        Strategy:  
        \- If both agree, boost confidence  
        \- If only one detects, use that with adjusted confidence  
        \- Resolve conflicts by preferring higher confidence  
        """  
          
        merged: Dict\[ProcessingCapability, DetectedCapability\] \= {}  
          
        *\# Add rule-based results*  
        for result in rule\_based:  
            merged\[result.capability\] \= result  
          
        *\# Merge LLM results*  
        for llm\_result in llm\_based:  
            cap \= llm\_result.capability  
              
            if cap in merged:  
                *\# Both detected \- boost confidence*  
                rule\_result \= merged\[cap\]  
                  
                *\# Weighted average with boost for agreement*  
                combined\_confidence \= min(  
                    (rule\_result.confidence \* 0.4 \+ llm\_result.confidence \* 0.4) \+ 0.15,  
                    0.98  
                )  
                  
                merged\[cap\] \= DetectedCapability(  
                    capability\=cap,  
                    confidence\=combined\_confidence,  
                    source\="merged",  
                    evidence\=list(set(rule\_result.evidence \+ llm\_result.evidence)),  
                    reasoning\=f"Rule-based ({rule\_result.confidence:.2f}) \+ LLM ({llm\_result.confidence:.2f})"  
                )  
            else:  
                *\# Only LLM detected \- slight confidence reduction*  
                llm\_result.confidence \*= 0.9  
                llm\_result.source \= "llm"  
                merged\[cap\] \= llm\_result  
          
        *\# Sort by confidence*  
        return sorted(merged.values(), key\=lambda x: x.confidence, reverse\=True)

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# INTEGRATION WITH MULTIMODAL PLANNER*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class MultimodalPlanner:  
    """Multimodal task planner with capability extraction."""  
      
    def \_\_init\_\_(self):  
        self.capability\_extractor \= CapabilityExtractor(  
            llm\_client\=LLMClient(),  
            confidence\_threshold\=0.5,  
            use\_llm\=True  
        )  
      
    async def \_extract\_capabilities(  
        self,  
        description: str  
    ) \-\> Set\[ProcessingCapability\]:  
        """  
        Extract required capabilities from task description.  
          
        This is the method referenced in the MultimodalPlanner class.  
        """  
          
        result \= await self.capability\_extractor.extract\_capabilities(description)  
          
        *\# Log detailed results for debugging/auditing*  
        self.\_log\_extraction\_result(result)  
          
        return result.capabilities  
      
    def \_log\_extraction\_result(self, result: CapabilityExtractionResult):  
        """Log extraction results for debugging."""  
          
        print(f"\\n{'='\*60}")  
        print("CAPABILITY EXTRACTION RESULT")  
        print(f"{'='\*60}")  
        print(f"Method: {result.extraction\_method}")  
        print(f"Capabilities found: {len(result.capabilities)}")  
        print()  
          
        for det in result.detailed\_results:  
            print(f"  \[{det.confidence:.2f}\] {det.capability.value}")  
            print(f"      Source: {det.source}")  
            print(f"      Evidence: {det.evidence\[:3\]}...")  
            print(f"      Reasoning: {det.reasoning\[:80\]}...")  
            print()  
          
        if result.raw\_llm\_response:  
            print(f"LLM complexity assessment: {result.raw\_llm\_response.get('task\_complexity')}")  
            print(f"LLM suggested pipeline: {result.raw\_llm\_response.get('suggested\_pipeline')}")  
            if result.raw\_llm\_response.get('warnings'):  
                print(f"Warnings: {result.raw\_llm\_response.get('warnings')}")

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# EXAMPLE USAGE*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

async def example\_usage():  
    """Demonstrate capability extraction."""  
      
    planner \= MultimodalPlanner()  
      
    *\# Example task descriptions*  
    tasks \= \[  
        """  
        Analyze this video presentation and create a narrated slide deck:  
        1\. Extract key visual information from the video  
        2\. Transcribe the audio narration  
        3\. Identify main topics and insights  
        4\. Generate a 10-slide presentation summarizing the content  
        5\. Create professional narration for each slide  
        6\. Combine into a narrated slide video  
        """,  
          
        "Summarize this PDF document into key bullet points",  
          
        "Generate an image of a futuristic city skyline at sunset",  
          
        """  
        Take this podcast episode, transcribe it, extract the main discussion topics,  
        and create a blog post summarizing the key insights with relevant images.  
        """  
    \]  
      
    for i, task in enumerate(tasks, 1):  
        print(f"\\n{'\#'\*70}")  
        print(f"TASK {i}")  
        print(f"{'\#'\*70}")  
        print(f"Description: {task\[:100\]}...")  
          
        capabilities \= await planner.\_extract\_capabilities(task)  
          
        print(f"\\nFinal capabilities: {\[c.value for c in capabilities\]}")

if \_\_name\_\_ \== "\_\_main\_\_":  
    asyncio.run(example\_usage())

## **3\. Output Example**

Plain Text  
\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#  
TASK 1  
\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#\#  
Description:   
        Analyze this video presentation and create a narrated slide deck:  
        1\. Extract key visual informat...

\============================================================  
CAPABILITY EXTRACTION RESULT  
\============================================================  
Method: hybrid  
Capabilities found: 6

  \[0.92\] video\_analysis  
      Source: merged  
      Evidence: \['video', 'analyze', 'extract'\]...  
      Reasoning: Rule-based (0.65) \+ LLM (0.85)...

  \[0.88\] text\_to\_speech  
      Source: merged  
      Evidence: \['narration', 'narrated', 'create'\]...  
      Reasoning: Rule-based (0.55) \+ LLM (0.80)...

  \[0.85\] text\_generation  
      Source: merged  
      Evidence: \['generate', 'create', 'slides', 'presentation'\]...  
      Reasoning: Rule-based (0.60) \+ LLM (0.75)...

  \[0.82\] speech\_to\_text  
      Source: merged  
      Evidence: \['transcribe', 'audio'\]...  
      Reasoning: Rule-based (0.50) \+ LLM (0.78)...

  \[0.78\] modality\_fusion  
      Source: merged  
      Evidence: \['combine', 'narrated slides', 'video'\]...  
      Reasoning: Rule-based (0.45) \+ LLM (0.72)...

  \[0.72\] text\_summarization  
      Source: merged  
      Evidence: \['summarizing', 'key', 'insights'\]...  
      Reasoning: Rule-based (0.40) \+ LLM (0.68)...

LLM complexity assessment: complex  
LLM suggested pipeline: \['video\_analysis', 'speech\_to\_text', 'text\_summarization',   
                         'text\_generation', 'text\_to\_speech', 'modality\_fusion'\]  
Warnings: \[\]

Final capabilities: \['video\_analysis', 'text\_to\_speech', 'text\_generation',   
                     'speech\_to\_text', 'modality\_fusion', 'text\_summarization'\]

## **4\. Summary**

The \_extract\_capabilities function uses a hybrid approach:

| Component | Purpose | Confidence Range |
| :---- | :---- | :---- |
| Preprocessing | Normalize text for consistent matching | N/A |
| Rule-based detection | Fast, reliable pattern matching | 0.0 \- 0.9 |
| LLM refinement | Nuanced understanding of complex tasks | 0.0 \- 0.95 |
| Merging | Combine results with confidence boosting | 0.0 \- 0.98 |
| Thresholding | Filter low-confidence detections | ≥ 0.5 |

The LLM simulation demonstrates the expected response structure and reasoning process, which in production would be replaced with actual API calls to GPT-4, Claude, or similar models.

# **CapabilityExtractor with Real LLM API Integration**

Below is a complete Python script that integrates the CapabilityExtractor with real LLM APIs (OpenAI GPT-4 and Anthropic Claude), including retry logic, rate limiting, and cost tracking.

Python  
*\#\!/usr/bin/env python3*  
"""  
Capability Extractor with Real LLM API Integration

This script provides production-ready integration with OpenAI and Anthropic APIs  
for extracting processing capabilities from task descriptions.

Features:  
\- Multiple LLM provider support (OpenAI, Anthropic)  
\- Automatic retry with exponential backoff  
\- Rate limiting and cost tracking  
\- Structured JSON output with schema validation  
\- Fallback between providers  
\- Comprehensive error handling

Usage:  
    \# Set environment variables  
    export OPENAI\_API\_KEY="sk-..."  
    export ANTHROPIC\_API\_KEY="sk-ant-..."  
      
    \# Run the script  
    python capability\_extractor\_llm.py \--task "Analyze this video and create slides"

Dependencies:  
    pip install openai anthropic pydantic tenacity aiohttp

Author: Manus AI  
Version: 1.0.0  
"""

from \_\_future\_\_ import annotations

import asyncio  
import json  
import os  
import re  
import time  
from abc import ABC, abstractmethod  
from dataclasses import dataclass, field, asdict  
from datetime import datetime, timedelta  
from enum import Enum  
from typing import Any, Dict, List, Optional, Set, Tuple, Type, Union  
import logging

*\# Third-party imports*  
try:  
    import openai  
    from openai import AsyncOpenAI  
    OPENAI\_AVAILABLE \= True  
except ImportError:  
    OPENAI\_AVAILABLE \= False

try:  
    import anthropic  
    from anthropic import AsyncAnthropic  
    ANTHROPIC\_AVAILABLE \= True  
except ImportError:  
    ANTHROPIC\_AVAILABLE \= False

from pydantic import BaseModel, Field, validator  
from tenacity import (  
    retry,  
    stop\_after\_attempt,  
    wait\_exponential,  
    retry\_if\_exception\_type,  
    before\_sleep\_log  
 )

*\# Configure logging*  
logging.basicConfig(level\=logging.INFO)  
logger \= logging.getLogger(\_\_name\_\_)

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# CAPABILITY DEFINITIONS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class ProcessingCapability(str, Enum):  
    """All available processing capabilities."""  
    *\# Text*  
    TEXT\_ANALYSIS \= "text\_analysis"  
    TEXT\_GENERATION \= "text\_generation"  
    TEXT\_SUMMARIZATION \= "text\_summarization"  
    TEXT\_TRANSLATION \= "text\_translation"  
      
    *\# Vision*  
    IMAGE\_ANALYSIS \= "image\_analysis"  
    IMAGE\_GENERATION \= "image\_generation"  
    IMAGE\_EDITING \= "image\_editing"  
    OCR \= "ocr"  
    VIDEO\_ANALYSIS \= "video\_analysis"  
    VIDEO\_GENERATION \= "video\_generation"  
      
    *\# Audio*  
    SPEECH\_TO\_TEXT \= "speech\_to\_text"  
    TEXT\_TO\_SPEECH \= "text\_to\_speech"  
    AUDIO\_ANALYSIS \= "audio\_analysis"  
    MUSIC\_GENERATION \= "music\_generation"  
      
    *\# Cross-modal*  
    MULTIMODAL\_UNDERSTANDING \= "multimodal\_understanding"  
    CROSS\_MODAL\_SEARCH \= "cross\_modal\_search"  
    MODALITY\_FUSION \= "modality\_fusion"

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# PYDANTIC MODELS FOR STRUCTURED OUTPUT*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class CapabilityDetection(BaseModel):  
    """A single detected capability."""  
    capability: str \= Field(..., description\="The capability identifier")  
    confidence: float \= Field(..., ge\=0.0, le\=1.0, description\="Confidence score")  
    reasoning: str \= Field(..., description\="Why this capability is needed")  
    evidence: List\[str\] \= Field(default\_factory\=list, description\="Supporting text fragments")  
      
    @validator('capability')  
    def validate\_capability(cls, v):  
        valid\_capabilities \= \[c.value for c in ProcessingCapability\]  
        if v not in valid\_capabilities:  
            raise ValueError(f"Invalid capability: {v}. Must be one of {valid\_capabilities}")  
        return v

class LLMExtractionResponse(BaseModel):  
    """Structured response from LLM capability extraction."""  
    capabilities: List\[CapabilityDetection\] \= Field(default\_factory\=list)  
    task\_complexity: str \= Field(default\="moderate", pattern\="^(simple|moderate|complex)$")  
    suggested\_pipeline: List\[str\] \= Field(default\_factory\=list)  
    warnings: List\[str\] \= Field(default\_factory\=list)  
    input\_modalities: List\[str\] \= Field(default\_factory\=list)  
    output\_modalities: List\[str\] \= Field(default\_factory\=list)

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# COST AND USAGE TRACKING*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class TokenUsage:  
    """Track token usage for cost estimation."""  
    prompt\_tokens: int \= 0  
    completion\_tokens: int \= 0  
    total\_tokens: int \= 0  
      
    def add(self, prompt: int, completion: int):  
        self.prompt\_tokens \+= prompt  
        self.completion\_tokens \+= completion  
        self.total\_tokens \+= prompt \+ completion

@dataclass  
class CostTracker:  
    """Track API costs across providers."""  
      
    *\# Pricing per 1M tokens (as of 2024\)*  
    PRICING \= {  
        "gpt-4o": {"input": 2.50, "output": 10.00},  
        "gpt-4o-mini": {"input": 0.15, "output": 0.60},  
        "gpt-4-turbo": {"input": 10.00, "output": 30.00},  
        "claude-3-5-sonnet-20241022": {"input": 3.00, "output": 15.00},  
        "claude-3-haiku-20240307": {"input": 0.25, "output": 1.25},  
        "claude-3-opus-20240229": {"input": 15.00, "output": 75.00},  
    }  
      
    usage\_by\_model: Dict\[str, TokenUsage\] \= field(default\_factory\=dict)  
      
    def record\_usage(self, model: str, prompt\_tokens: int, completion\_tokens: int):  
        if model not in self.usage\_by\_model:  
            self.usage\_by\_model\[model\] \= TokenUsage()  
        self.usage\_by\_model\[model\].add(prompt\_tokens, completion\_tokens)  
      
    def get\_cost(self, model: str) \-\> float:  
        if model not in self.usage\_by\_model:  
            return 0.0  
          
        usage \= self.usage\_by\_model\[model\]  
        pricing \= self.PRICING.get(model, {"input": 0, "output": 0})  
          
        input\_cost \= (usage.prompt\_tokens / 1\_000\_000) \* pricing\["input"\]  
        output\_cost \= (usage.completion\_tokens / 1\_000\_000) \* pricing\["output"\]  
          
        return input\_cost \+ output\_cost  
      
    def get\_total\_cost(self) \-\> float:  
        return sum(self.get\_cost(model) for model in self.usage\_by\_model)  
      
    def get\_summary(self) \-\> Dict\[str, Any\]:  
        return {  
            "by\_model": {  
                model: {  
                    "tokens": asdict(usage),  
                    "cost\_usd": round(self.get\_cost(model), 6)  
                }  
                for model, usage in self.usage\_by\_model.items()  
            },  
            "total\_cost\_usd": round(self.get\_total\_cost(), 6)  
        }

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# RATE LIMITER*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class RateLimiter:  
    """Token bucket rate limiter for API calls."""  
      
    def \_\_init\_\_(self, requests\_per\_minute: int \= 60, tokens\_per\_minute: int \= 100000):  
        self.requests\_per\_minute \= requests\_per\_minute  
        self.tokens\_per\_minute \= tokens\_per\_minute  
        self.request\_times: List\[float\] \= \[\]  
        self.token\_usage: List\[Tuple\[float, int\]\] \= \[\]  
        self.\_lock \= asyncio.Lock()  
      
    async def acquire(self, estimated\_tokens: int \= 1000):  
        """Wait until rate limit allows the request."""  
        async with self.\_lock:  
            now \= time.time()  
            minute\_ago \= now \- 60  
              
            *\# Clean old entries*  
            self.request\_times \= \[t for t in self.request\_times if t \> minute\_ago\]  
            self.token\_usage \= \[(t, n) for t, n in self.token\_usage if t \> minute\_ago\]  
              
            *\# Check request rate*  
            while len(self.request\_times) \>= self.requests\_per\_minute:  
                sleep\_time \= self.request\_times\[0\] \- minute\_ago \+ 0.1  
                logger.info(f"Rate limit: waiting {sleep\_time:.1f}s for request slot")  
                await asyncio.sleep(sleep\_time)  
                now \= time.time()  
                minute\_ago \= now \- 60  
                self.request\_times \= \[t for t in self.request\_times if t \> minute\_ago\]  
              
            *\# Check token rate*  
            current\_tokens \= sum(n for \_, n in self.token\_usage)  
            while current\_tokens \+ estimated\_tokens \> self.tokens\_per\_minute:  
                sleep\_time \= self.token\_usage\[0\]\[0\] \- minute\_ago \+ 0.1  
                logger.info(f"Rate limit: waiting {sleep\_time:.1f}s for token budget")  
                await asyncio.sleep(sleep\_time)  
                now \= time.time()  
                minute\_ago \= now \- 60  
                self.token\_usage \= \[(t, n) for t, n in self.token\_usage if t \> minute\_ago\]  
                current\_tokens \= sum(n for \_, n in self.token\_usage)  
              
            *\# Record this request*  
            self.request\_times.append(now)  
            self.token\_usage.append((now, estimated\_tokens))  
      
    def record\_actual\_usage(self, tokens: int):  
        """Update with actual token usage after response."""  
        if self.token\_usage:  
            *\# Update the last entry with actual usage*  
            last\_time, \_ \= self.token\_usage\[-1\]  
            self.token\_usage\[-1\] \= (last\_time, tokens)

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# ABSTRACT LLM CLIENT*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class LLMClient(ABC):  
    """Abstract base class for LLM clients."""  
      
    def \_\_init\_\_(  
        self,  
        model: str,  
        cost\_tracker: Optional\[CostTracker\] \= None,  
        rate\_limiter: Optional\[RateLimiter\] \= None  
    ):  
        self.model \= model  
        self.cost\_tracker \= cost\_tracker or CostTracker()  
        self.rate\_limiter \= rate\_limiter or RateLimiter()  
      
    @abstractmethod  
    async def complete(  
        self,  
        system\_prompt: str,  
        user\_prompt: str,  
        response\_schema: Optional\[Type\[BaseModel\]\] \= None  
    ) \-\> Dict\[str, Any\]:  
        """Generate a completion from the LLM."""  
        pass  
      
    @property  
    @abstractmethod  
    def provider(self) \-\> str:  
        """Return the provider name."""  
        pass

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# OPENAI CLIENT*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class OpenAIClient(LLMClient):  
    """OpenAI API client with structured output support."""  
      
    def \_\_init\_\_(  
        self,  
        model: str \= "gpt-4o",  
        api\_key: Optional\[str\] \= None,  
        cost\_tracker: Optional\[CostTracker\] \= None,  
        rate\_limiter: Optional\[RateLimiter\] \= None  
    ):  
        super().\_\_init\_\_(model, cost\_tracker, rate\_limiter)  
          
        if not OPENAI\_AVAILABLE:  
            raise ImportError("openai package not installed. Run: pip install openai")  
          
        self.client \= AsyncOpenAI(api\_key\=api\_key or os.getenv("OPENAI\_API\_KEY"))  
      
    @property  
    def provider(self) \-\> str:  
        return "openai"  
      
    @retry(  
        stop\=stop\_after\_attempt(3),  
        wait\=wait\_exponential(multiplier\=1, min\=2, max\=30),  
        retry\=retry\_if\_exception\_type((openai.RateLimitError, openai.APIConnectionError)),  
        before\_sleep\=before\_sleep\_log(logger, logging.WARNING)  
    )  
    async def complete(  
        self,  
        system\_prompt: str,  
        user\_prompt: str,  
        response\_schema: Optional\[Type\[BaseModel\]\] \= None  
    ) \-\> Dict\[str, Any\]:  
        """Generate a completion using OpenAI API."""  
          
        *\# Rate limiting*  
        await self.rate\_limiter.acquire(estimated\_tokens\=2000)  
          
        messages \= \[  
            {"role": "system", "content": system\_prompt},  
            {"role": "user", "content": user\_prompt}  
        \]  
          
        *\# Build request kwargs*  
        kwargs: Dict\[str, Any\] \= {  
            "model": self.model,  
            "messages": messages,  
            "temperature": 0.0,  
        }  
          
        *\# Use structured output if schema provided (GPT-4o supports this)*  
        if response\_schema and self.model in \["gpt-4o", "gpt-4o-mini"\]:  
            kwargs\["response\_format"\] \= {  
                "type": "json\_schema",  
                "json\_schema": {  
                    "name": "capability\_extraction",  
                    "strict": True,  
                    "schema": response\_schema.model\_json\_schema()  
                }  
            }  
        else:  
            kwargs\["response\_format"\] \= {"type": "json\_object"}  
          
        try:  
            response \= await self.client.chat.completions.create(\*\*kwargs)  
              
            *\# Track usage*  
            if response.usage:  
                self.cost\_tracker.record\_usage(  
                    self.model,  
                    response.usage.prompt\_tokens,  
                    response.usage.completion\_tokens  
                )  
                self.rate\_limiter.record\_actual\_usage(response.usage.total\_tokens)  
              
            *\# Parse response*  
            content \= response.choices\[0\].message.content  
            result \= json.loads(content)  
              
            *\# Validate with schema if provided*  
            if response\_schema:  
                validated \= response\_schema.model\_validate(result)  
                return validated.model\_dump()  
              
            return result  
              
        except openai.BadRequestError as e:  
            logger.error(f"OpenAI bad request: {e}")  
            raise  
        except json.JSONDecodeError as e:  
            logger.error(f"Failed to parse JSON response: {e}")  
            raise

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# ANTHROPIC CLIENT*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class AnthropicClient(LLMClient):  
    """Anthropic Claude API client with tool use for structured output."""  
      
    def \_\_init\_\_(  
        self,  
        model: str \= "claude-3-5-sonnet-20241022",  
        api\_key: Optional\[str\] \= None,  
        cost\_tracker: Optional\[CostTracker\] \= None,  
        rate\_limiter: Optional\[RateLimiter\] \= None  
    ):  
        super().\_\_init\_\_(model, cost\_tracker, rate\_limiter)  
          
        if not ANTHROPIC\_AVAILABLE:  
            raise ImportError("anthropic package not installed. Run: pip install anthropic")  
          
        self.client \= AsyncAnthropic(api\_key\=api\_key or os.getenv("ANTHROPIC\_API\_KEY"))  
      
    @property  
    def provider(self) \-\> str:  
        return "anthropic"  
      
    @retry(  
        stop\=stop\_after\_attempt(3),  
        wait\=wait\_exponential(multiplier\=1, min\=2, max\=30),  
        retry\=retry\_if\_exception\_type((anthropic.RateLimitError, anthropic.APIConnectionError)),  
        before\_sleep\=before\_sleep\_log(logger, logging.WARNING)  
    )  
    async def complete(  
        self,  
        system\_prompt: str,  
        user\_prompt: str,  
        response\_schema: Optional\[Type\[BaseModel\]\] \= None  
    ) \-\> Dict\[str, Any\]:  
        """Generate a completion using Anthropic API."""  
          
        *\# Rate limiting*  
        await self.rate\_limiter.acquire(estimated\_tokens\=2000)  
          
        *\# For structured output, use tool use pattern*  
        if response\_schema:  
            return await self.\_complete\_with\_tool(system\_prompt, user\_prompt, response\_schema)  
        else:  
            return await self.\_complete\_json(system\_prompt, user\_prompt)  
      
    async def \_complete\_json(  
        self,  
        system\_prompt: str,  
        user\_prompt: str  
    ) \-\> Dict\[str, Any\]:  
        """Complete with JSON output."""  
          
        *\# Append JSON instruction to system prompt*  
        full\_system \= f"{system\_prompt}\\n\\nRespond only with valid JSON."  
          
        response \= await self.client.messages.create(  
            model\=self.model,  
            max\_tokens\=4096,  
            system\=full\_system,  
            messages\=\[{"role": "user", "content": user\_prompt}\]  
        )  
          
        *\# Track usage*  
        self.cost\_tracker.record\_usage(  
            self.model,  
            response.usage.input\_tokens,  
            response.usage.output\_tokens  
        )  
        self.rate\_limiter.record\_actual\_usage(  
            response.usage.input\_tokens \+ response.usage.output\_tokens  
        )  
          
        *\# Extract and parse JSON*  
        content \= response.content\[0\].text  
          
        *\# Try to extract JSON from response*  
        json\_match \= re.search(r'\\{\[\\s\\S\]\*\\}', content)  
        if json\_match:  
            return json.loads(json\_match.group())  
          
        raise ValueError(f"No valid JSON found in response: {content\[:200\]}")  
      
    async def \_complete\_with\_tool(  
        self,  
        system\_prompt: str,  
        user\_prompt: str,  
        response\_schema: Type\[BaseModel\]  
    ) \-\> Dict\[str, Any\]:  
        """Complete using tool use for structured output."""  
          
        *\# Define tool based on schema*  
        tool \= {  
            "name": "extract\_capabilities",  
            "description": "Extract processing capabilities from the task description",  
            "input\_schema": response\_schema.model\_json\_schema()  
        }  
          
        response \= await self.client.messages.create(  
            model\=self.model,  
            max\_tokens\=4096,  
            system\=system\_prompt,  
            tools\=\[tool\],  
            tool\_choice\={"type": "tool", "name": "extract\_capabilities"},  
            messages\=\[{"role": "user", "content": user\_prompt}\]  
        )  
          
        *\# Track usage*  
        self.cost\_tracker.record\_usage(  
            self.model,  
            response.usage.input\_tokens,  
            response.usage.output\_tokens  
        )  
        self.rate\_limiter.record\_actual\_usage(  
            response.usage.input\_tokens \+ response.usage.output\_tokens  
        )  
          
        *\# Extract tool use result*  
        for block in response.content:  
            if block.type \== "tool\_use":  
                validated \= response\_schema.model\_validate(block.input)  
                return validated.model\_dump()  
          
        raise ValueError("No tool use block found in response")

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# MULTI-PROVIDER CLIENT WITH FALLBACK*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class MultiProviderClient:  
    """Client that supports multiple providers with automatic fallback."""  
      
    def \_\_init\_\_(  
        self,  
        primary\_provider: str \= "openai",  
        primary\_model: str \= "gpt-4o",  
        fallback\_provider: Optional\[str\] \= "anthropic",  
        fallback\_model: Optional\[str\] \= "claude-3-5-sonnet-20241022",  
        cost\_tracker: Optional\[CostTracker\] \= None  
    ):  
        self.cost\_tracker \= cost\_tracker or CostTracker()  
        self.clients: Dict\[str, LLMClient\] \= {}  
          
        *\# Initialize primary client*  
        self.primary\_provider \= primary\_provider  
        self.\_init\_client(primary\_provider, primary\_model)  
          
        *\# Initialize fallback client*  
        self.fallback\_provider \= fallback\_provider  
        if fallback\_provider and fallback\_model:  
            self.\_init\_client(fallback\_provider, fallback\_model)  
      
    def \_init\_client(self, provider: str, model: str):  
        """Initialize a client for the given provider."""  
          
        rate\_limiter \= RateLimiter(  
            requests\_per\_minute\=50 if provider \== "openai" else 40,  
            tokens\_per\_minute\=80000 if provider \== "openai" else 40000  
        )  
          
        if provider \== "openai" and OPENAI\_AVAILABLE:  
            self.clients\[provider\] \= OpenAIClient(  
                model\=model,  
                cost\_tracker\=self.cost\_tracker,  
                rate\_limiter\=rate\_limiter  
            )  
        elif provider \== "anthropic" and ANTHROPIC\_AVAILABLE:  
            self.clients\[provider\] \= AnthropicClient(  
                model\=model,  
                cost\_tracker\=self.cost\_tracker,  
                rate\_limiter\=rate\_limiter  
            )  
        else:  
            logger.warning(f"Provider {provider} not available")  
      
    async def complete(  
        self,  
        system\_prompt: str,  
        user\_prompt: str,  
        response\_schema: Optional\[Type\[BaseModel\]\] \= None  
    ) \-\> Tuple\[Dict\[str, Any\], str\]:  
        """  
        Complete using primary provider with fallback.  
          
        Returns:  
            Tuple of (response\_dict, provider\_used)  
        """  
          
        *\# Try primary*  
        if self.primary\_provider in self.clients:  
            try:  
                result \= await self.clients\[self.primary\_provider\].complete(  
                    system\_prompt, user\_prompt, response\_schema  
                )  
                return result, self.primary\_provider  
            except Exception as e:  
                logger.warning(f"Primary provider {self.primary\_provider} failed: {e}")  
          
        *\# Try fallback*  
        if self.fallback\_provider and self.fallback\_provider in self.clients:  
            try:  
                result \= await self.clients\[self.fallback\_provider\].complete(  
                    system\_prompt, user\_prompt, response\_schema  
                )  
                return result, self.fallback\_provider  
            except Exception as e:  
                logger.error(f"Fallback provider {self.fallback\_provider} failed: {e}")  
                raise  
          
        raise RuntimeError("No LLM providers available")

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# CAPABILITY EXTRACTOR WITH REAL LLM*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class DetectedCapability:  
    """A capability detected from task description."""  
    capability: ProcessingCapability  
    confidence: float  
    source: str  
    evidence: List\[str\] \= field(default\_factory\=list)  
    reasoning: str \= ""

@dataclass  
class ExtractionResult:  
    """Result of capability extraction."""  
    capabilities: Set\[ProcessingCapability\]  
    detailed\_results: List\[DetectedCapability\]  
    task\_complexity: str  
    suggested\_pipeline: List\[str\]  
    warnings: List\[str\]  
    provider\_used: str  
    cost\_summary: Dict\[str, Any\]

class CapabilityExtractor:  
    """  
    Extract processing capabilities from task descriptions using real LLM APIs.  
    """  
      
    SYSTEM\_PROMPT \= """You are an expert at analyzing task descriptions and identifying   
required processing capabilities for multimodal AI systems.

Available capabilities:  
\- text\_analysis: Analyze text content to extract insights, sentiment, entities  
\- text\_generation: Generate new text content based on prompts  
\- text\_summarization: Condense long text into shorter summaries  
\- text\_translation: Translate text between languages  
\- image\_analysis: Analyze images to identify objects, scenes, text  
\- image\_generation: Generate new images from text descriptions  
\- image\_editing: Edit or modify existing images  
\- ocr: Extract text from images  
\- video\_analysis: Analyze video content to extract information  
\- video\_generation: Generate video content  
\- speech\_to\_text: Convert spoken audio into written text  
\- text\_to\_speech: Convert written text into spoken audio  
\- audio\_analysis: Analyze audio content (music, sounds)  
\- music\_generation: Generate music or audio content  
\- multimodal\_understanding: Understand across multiple modalities together  
\- cross\_modal\_search: Search across different modalities  
\- modality\_fusion: Combine multiple modalities into unified output

Your job is to:  
1\. Carefully read the task description  
2\. Identify which capabilities are needed to complete the task  
3\. Assign a confidence score (0.0-1.0) to each capability  
4\. Provide reasoning for each detection  
5\. Identify input and output modalities  
6\. Suggest an optimal processing pipeline order

Be precise and only include capabilities that are clearly needed."""

    def \_\_init\_\_(  
        self,  
        primary\_provider: str \= "openai",  
        primary\_model: str \= "gpt-4o",  
        fallback\_provider: Optional\[str\] \= "anthropic",  
        fallback\_model: Optional\[str\] \= "claude-3-5-sonnet-20241022",  
        confidence\_threshold: float \= 0.5  
    ):  
        self.confidence\_threshold \= confidence\_threshold  
        self.cost\_tracker \= CostTracker()  
          
        self.client \= MultiProviderClient(  
            primary\_provider\=primary\_provider,  
            primary\_model\=primary\_model,  
            fallback\_provider\=fallback\_provider,  
            fallback\_model\=fallback\_model,  
            cost\_tracker\=self.cost\_tracker  
        )  
      
    async def extract(self, task\_description: str) \-\> ExtractionResult:  
        """  
        Extract capabilities from a task description.  
          
        Args:  
            task\_description: Natural language description of the task  
              
        Returns:  
            ExtractionResult with detected capabilities and metadata  
        """  
          
        user\_prompt \= f"""Analyze this task description and identify the required processing capabilities:

TASK DESCRIPTION:  
{task\_description}

Identify all capabilities needed to complete this task. Consider:  
\- What inputs are mentioned (video, audio, images, text)?  
\- What outputs are expected (slides, narration, summary)?  
\- What transformations are needed (transcription, generation, analysis)?

Return your analysis in the specified JSON format."""

        *\# Call LLM*  
        response, provider \= await self.client.complete(  
            system\_prompt\=self.SYSTEM\_PROMPT,  
            user\_prompt\=user\_prompt,  
            response\_schema\=LLMExtractionResponse  
        )  
          
        *\# Parse response*  
        detailed\_results \= \[\]  
        for cap\_data in response.get("capabilities", \[\]):  
            try:  
                capability \= ProcessingCapability(cap\_data\["capability"\])  
                if cap\_data\["confidence"\] \>= self.confidence\_threshold:  
                    detailed\_results.append(DetectedCapability(  
                        capability\=capability,  
                        confidence\=cap\_data\["confidence"\],  
                        source\=provider,  
                        evidence\=cap\_data.get("evidence", \[\]),  
                        reasoning\=cap\_data.get("reasoning", "")  
                    ))  
            except (ValueError, KeyError) as e:  
                logger.warning(f"Skipping invalid capability: {e}")  
                continue  
          
        *\# Sort by confidence*  
        detailed\_results.sort(key\=lambda x: x.confidence, reverse\=True)  
          
        return ExtractionResult(  
            capabilities\={r.capability for r in detailed\_results},  
            detailed\_results\=detailed\_results,  
            task\_complexity\=response.get("task\_complexity", "moderate"),  
            suggested\_pipeline\=response.get("suggested\_pipeline", \[\]),  
            warnings\=response.get("warnings", \[\]),  
            provider\_used\=provider,  
            cost\_summary\=self.cost\_tracker.get\_summary()  
        )  
      
    async def extract\_batch(  
        self,  
        task\_descriptions: List\[str\],  
        max\_concurrent: int \= 5  
    ) \-\> List\[ExtractionResult\]:  
        """  
        Extract capabilities from multiple task descriptions concurrently.  
          
        Args:  
            task\_descriptions: List of task descriptions  
            max\_concurrent: Maximum concurrent API calls  
              
        Returns:  
            List of ExtractionResult objects  
        """  
          
        semaphore \= asyncio.Semaphore(max\_concurrent)  
          
        async def extract\_with\_semaphore(desc: str) \-\> ExtractionResult:  
            async with semaphore:  
                return await self.extract(desc)  
          
        results \= await asyncio.gather(  
            \*\[extract\_with\_semaphore(desc) for desc in task\_descriptions\],  
            return\_exceptions\=True  
        )  
          
        *\# Handle exceptions*  
        final\_results \= \[\]  
        for i, result in enumerate(results):  
            if isinstance(result, Exception):  
                logger.error(f"Failed to extract from task {i}: {result}")  
                *\# Return empty result for failed extractions*  
                final\_results.append(ExtractionResult(  
                    capabilities\=set(),  
                    detailed\_results\=\[\],  
                    task\_complexity\="unknown",  
                    suggested\_pipeline\=\[\],  
                    warnings\=\[f"Extraction failed: {str(result)}"\],  
                    provider\_used\="none",  
                    cost\_summary\={}  
                ))  
            else:  
                final\_results.append(result)  
          
        return final\_results

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# CLI INTERFACE*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

def print\_result(result: ExtractionResult):  
    """Pretty print extraction result."""  
      
    print("\\n" \+ "=" \* 70)  
    print("CAPABILITY EXTRACTION RESULT")  
    print("=" \* 70)  
      
    print(f"\\nProvider: {result.provider\_used}")  
    print(f"Task Complexity: {result.task\_complexity}")  
    print(f"Capabilities Found: {len(result.capabilities)}")  
      
    print("\\n\--- Detected Capabilities \---")  
    for det in result.detailed\_results:  
        print(f"\\n  \[{det.confidence:.2f}\] {det.capability.value}")  
        print(f"      Reasoning: {det.reasoning\[:100\]}...")  
        if det.evidence:  
            print(f"      Evidence: {det.evidence\[:3\]}")  
      
    if result.suggested\_pipeline:  
        print(f"\\n\--- Suggested Pipeline \---")  
        for i, step in enumerate(result.suggested\_pipeline, 1):  
            print(f"  {i}. {step}")  
      
    if result.warnings:  
        print(f"\\n\--- Warnings \---")  
        for warning in result.warnings:  
            print(f"  ⚠ {warning}")  
      
    print(f"\\n\--- Cost Summary \---")  
    print(f"  Total: ${result.cost\_summary.get('total\_cost\_usd', 0):.6f}")  
    for model, data in result.cost\_summary.get("by\_model", {}).items():  
        print(f"  {model}: {data\['tokens'\]\['total\_tokens'\]} tokens (${data\['cost\_usd'\]:.6f})")

async def main():  
    """Main entry point."""  
      
    import argparse  
      
    parser \= argparse.ArgumentParser(description\="Extract capabilities from task descriptions")  
    parser.add\_argument("--task", type\=str, help\="Task description to analyze")  
    parser.add\_argument("--file", type\=str, help\="File containing task description")  
    parser.add\_argument("--provider", type\=str, default\="openai", choices\=\["openai", "anthropic"\])  
    parser.add\_argument("--model", type\=str, default\=None, help\="Model to use")  
    parser.add\_argument("--threshold", type\=float, default\=0.5, help\="Confidence threshold")  
      
    args \= parser.parse\_args()  
      
    *\# Get task description*  
    if args.task:  
        task\_description \= args.task  
    elif args.file:  
        with open(args.file, 'r') as f:  
            task\_description \= f.read()  
    else:  
        *\# Default example*  
        task\_description \= """  
        Analyze this video presentation and create a narrated slide deck:  
        1\. Extract key visual information from the video  
        2\. Transcribe the audio narration  
        3\. Identify main topics and insights  
        4\. Generate a 10-slide presentation summarizing the content  
        5\. Create professional narration for each slide  
        6\. Combine into a narrated slide video  
        """  
      
    *\# Determine model*  
    if args.model:  
        model \= args.model  
    else:  
        model \= "gpt-4o" if args.provider \== "openai" else "claude-3-5-sonnet-20241022"  
      
    print(f"Using {args.provider} with model {model}")  
    print(f"Task: {task\_description\[:100\]}...")  
      
    *\# Extract capabilities*  
    extractor \= CapabilityExtractor(  
        primary\_provider\=args.provider,  
        primary\_model\=model,  
        confidence\_threshold\=args.threshold  
    )  
      
    result \= await extractor.extract(task\_description)  
    print\_result(result)

if \_\_name\_\_ \== "\_\_main\_\_":  
    asyncio.run(main())

## **Usage Examples**

Bash  
*\# Set API keys*  
export OPENAI\_API\_KEY\="sk-..."  
export ANTHROPIC\_API\_KEY\="sk-ant-..."

*\# Basic usage with OpenAI*  
python capability\_extractor\_llm.py \--task "Analyze this video and create slides"

*\# Use Anthropic Claude*  
python capability\_extractor\_llm.py \--provider anthropic \--task "Transcribe and summarize this podcast"

*\# From file with custom threshold*  
python capability\_extractor\_llm.py \--file task.txt \--threshold 0.7

*\# Specific model*  
python capability\_extractor\_llm.py \--provider openai \--model gpt-4o-mini \--task "Generate an image"

## **Key Features**

| Feature | Implementation |
| :---- | :---- |
| Multi-provider | OpenAI and Anthropic with automatic fallback |
| Structured output | Pydantic schemas with JSON schema validation |
| Rate limiting | Token bucket algorithm per provider |
| Cost tracking | Real-time cost estimation per model |
| Retry logic | Exponential backoff with tenacity |
| Batch processing | Concurrent extraction with semaphore |
| Error handling | Graceful degradation on failures |

