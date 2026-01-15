Max  
05:17

# **Orchestrator Component: Complete Pseudocode Implementation**

This document provides the complete pseudocode for the Orchestrator component, which manages subtask decomposition, scheduling, and run state transitions for wide research operations.

## **1\. Architecture Overview**

Plain Text  
┌─────────────────────────────────────────────────────────────────────────────┐  
│                         ORCHESTRATOR ARCHITECTURE                            │  
├─────────────────────────────────────────────────────────────────────────────┤  
│                                                                              │  
│  ┌─────────────────────────────────────────────────────────────────────┐   │  
│  │                      ORCHESTRATOR CORE                               │   │  
│  │                                                                       │   │  
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │  
│  │  │    Run      │  │   Task      │  │  Scheduler  │  │  State    │  │   │  
│  │  │  Manager    │  │ Decomposer  │  │             │  │  Machine  │  │   │  
│  │  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │   │  
│  │         │                │                │               │         │   │  
│  │         └────────────────┴────────────────┴───────────────┘         │   │  
│  │                                   │                                  │   │  
│  │                                   ▼                                  │   │  
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │  
│  │  │                    Event Bus (Internal)                      │   │   │  
│  │  └─────────────────────────────────────────────────────────────┘   │   │  
│  │                                   │                                  │   │  
│  └───────────────────────────────────┼──────────────────────────────────┘   │  
│                                      │                                      │  
│  ┌───────────────────────────────────┼──────────────────────────────────┐   │  
│  │                                   ▼                                  │   │  
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │   │  
│  │  │  PostgreSQL │  │    Redis    │  │  Job Queue  │  │    S3     │  │   │  
│  │  │   (State)   │  │   (Cache)   │  │  (BullMQ)   │  │ (Artifacts)│  │   │  
│  │  └─────────────┘  └─────────────┘  └─────────────┘  └───────────┘  │   │  
│  │                         INFRASTRUCTURE LAYER                        │   │  
│  └─────────────────────────────────────────────────────────────────────┘   │  
│                                                                              │  
└─────────────────────────────────────────────────────────────────────────────┘

## **2\. Core Data Structures**

Python  
*\#\!/usr/bin/env python3*  
"""  
Orchestrator Core Data Structures and Types  
"""

from \_\_future\_\_ import annotations

from dataclasses import dataclass, field  
from datetime import datetime, timedelta  
from enum import Enum, auto  
from typing import Any, Callable, Dict, List, Optional, Set, TypeVar  
from uuid import uuid4

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# RUN STATE MACHINE*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class RunState(Enum):  
    """States in the research run lifecycle."""  
    CREATED \= "created"  
    VALIDATING \= "validating"  
    DECOMPOSING \= "decomposing"  
    SCHEDULING \= "scheduling"  
    EXECUTING \= "executing"  
    AGGREGATING \= "aggregating"  
    FINALIZING \= "finalizing"  
    COMPLETED \= "completed"  
    FAILED \= "failed"  
    CANCELLED \= "cancelled"

class SubtaskState(Enum):  
    """States in the subtask lifecycle."""  
    PENDING \= "pending"  
    QUEUED \= "queued"  
    ASSIGNED \= "assigned"  
    RUNNING \= "running"  
    CHECKPOINTED \= "checkpointed"  
    COMPLETED \= "completed"  
    FAILED \= "failed"  
    SKIPPED \= "skipped"  
    CANCELLED \= "cancelled"

*\# Valid state transitions*  
RUN\_TRANSITIONS: Dict\[RunState, Set\[RunState\]\] \= {  
    RunState.CREATED: {RunState.VALIDATING, RunState.CANCELLED},  
    RunState.VALIDATING: {RunState.DECOMPOSING, RunState.FAILED, RunState.CANCELLED},  
    RunState.DECOMPOSING: {RunState.SCHEDULING, RunState.FAILED, RunState.CANCELLED},  
    RunState.SCHEDULING: {RunState.EXECUTING, RunState.FAILED, RunState.CANCELLED},  
    RunState.EXECUTING: {RunState.AGGREGATING, RunState.FAILED, RunState.CANCELLED},  
    RunState.AGGREGATING: {RunState.FINALIZING, RunState.FAILED, RunState.CANCELLED},  
    RunState.FINALIZING: {RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED},  
    RunState.COMPLETED: set(),  *\# Terminal state*  
    RunState.FAILED: set(),     *\# Terminal state*  
    RunState.CANCELLED: set(),  *\# Terminal state*  
}

SUBTASK\_TRANSITIONS: Dict\[SubtaskState, Set\[SubtaskState\]\] \= {  
    SubtaskState.PENDING: {SubtaskState.QUEUED, SubtaskState.CANCELLED},  
    SubtaskState.QUEUED: {SubtaskState.ASSIGNED, SubtaskState.CANCELLED},  
    SubtaskState.ASSIGNED: {SubtaskState.RUNNING, SubtaskState.PENDING, SubtaskState.CANCELLED},  
    SubtaskState.RUNNING: {SubtaskState.CHECKPOINTED, SubtaskState.COMPLETED,   
                           SubtaskState.FAILED, SubtaskState.CANCELLED},  
    SubtaskState.CHECKPOINTED: {SubtaskState.RUNNING, SubtaskState.COMPLETED,  
                                 SubtaskState.FAILED, SubtaskState.CANCELLED},  
    SubtaskState.COMPLETED: set(),  
    SubtaskState.FAILED: {SubtaskState.PENDING},  *\# Can retry*  
    SubtaskState.SKIPPED: set(),  
    SubtaskState.CANCELLED: set(),  
}

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# CORE ENTITIES*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class ResearchRun:  
    """A research run representing a complete research task."""  
    id: str  
    tenant\_id: str  
    user\_id: str  
      
    *\# Query and configuration*  
    query: str  
    config: RunConfig  
      
    *\# State*  
    state: RunState  
    state\_version: int  
      
    *\# Progress*  
    total\_subtasks: int  
    completed\_subtasks: int  
    failed\_subtasks: int  
      
    *\# Fencing*  
    lock\_token: Optional\[str\]  
    lock\_expires\_at: Optional\[datetime\]  
      
    *\# Timing*  
    created\_at: datetime  
    started\_at: Optional\[datetime\]  
    completed\_at: Optional\[datetime\]  
    deadline\_at: Optional\[datetime\]  
      
    *\# Results*  
    result\_summary: Optional\[Dict\[str, Any\]\]  
    artifacts: List\[str\]  
      
    @property  
    def progress\_percentage(self) \-\> float:  
        if self.total\_subtasks \== 0:  
            return 0.0  
        return (self.completed\_subtasks / self.total\_subtasks) \* 100  
      
    @property  
    def is\_terminal(self) \-\> bool:  
        return self.state in {RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED}

@dataclass  
class RunConfig:  
    """Configuration for a research run."""  
    max\_subtasks: int \= 100  
    max\_sources\_per\_subtask: int \= 10  
    max\_retries: int \= 3  
    timeout\_minutes: int \= 60  
    priority: int \= 5  *\# 1-10, higher \= more urgent*  
      
    *\# Decomposition settings*  
    decomposition\_strategy: str \= "entity\_based"  
    entity\_types: List\[str\] \= field(default\_factory\=list)  
      
    *\# Quality settings*  
    min\_confidence: float \= 0.7  
    require\_multiple\_sources: bool \= True  
      
    *\# Resource limits*  
    max\_llm\_calls: int \= 1000  
    max\_web\_requests: int \= 500  
    budget\_limit\_usd: Optional\[float\] \= None

@dataclass  
class Subtask:  
    """A subtask within a research run."""  
    id: str  
    run\_id: str  
    index: int  
    idempotency\_key: str  
      
    *\# Task definition*  
    task\_type: str  
    entity\_id: Optional\[str\]  
    input\_data: Dict\[str, Any\]  
      
    *\# State*  
    state: SubtaskState  
    state\_version: int  
      
    *\# Execution*  
    attempt\_count: int  
    max\_attempts: int  
    assigned\_worker\_id: Optional\[str\]  
    heartbeat\_at: Optional\[datetime\]  
      
    *\# Checkpointing*  
    checkpoint\_id: Optional\[str\]  
    checkpoint\_step: int  
      
    *\# Results*  
    result\_data: Optional\[Dict\[str, Any\]\]  
    artifacts: List\[str\]  
      
    *\# Errors*  
    last\_error: Optional\[str\]  
    last\_error\_code: Optional\[str\]  
      
    *\# Timing*  
    created\_at: datetime  
    started\_at: Optional\[datetime\]  
    completed\_at: Optional\[datetime\]  
      
    *\# Dependencies*  
    depends\_on: List\[str\]  *\# List of subtask IDs*  
      
    @property  
    def is\_ready(self) \-\> bool:  
        """Check if subtask is ready to execute (dependencies met)."""  
        return len(self.depends\_on) \== 0  
      
    @property  
    def is\_terminal(self) \-\> bool:  
        return self.state in {SubtaskState.COMPLETED, SubtaskState.FAILED,   
                              SubtaskState.SKIPPED, SubtaskState.CANCELLED}

@dataclass  
class DecompositionResult:  
    """Result of decomposing a query into subtasks."""  
    subtasks: List\[SubtaskDefinition\]  
    dependency\_graph: Dict\[str, List\[str\]\]  *\# subtask\_id \-\> dependencies*  
    estimated\_duration\_minutes: int  
    estimated\_cost\_usd: float  
    decomposition\_reasoning: str

@dataclass  
class SubtaskDefinition:  
    """Definition of a subtask before creation."""  
    task\_type: str  
    entity\_id: Optional\[str\]  
    input\_data: Dict\[str, Any\]  
    priority: int  
    estimated\_duration\_seconds: int  
    depends\_on\_indices: List\[int\]  *\# Indices of dependent subtasks*

@dataclass  
class SchedulingDecision:  
    """Decision about how to schedule subtasks."""  
    subtask\_id: str  
    queue\_name: str  
    priority: int  
    delay\_seconds: int  
    worker\_affinity: Optional\[str\]

@dataclass  
class AggregationResult:  
    """Result of aggregating subtask results."""  
    summary: Dict\[str, Any\]  
    claims: List\[Dict\[str, Any\]\]  
    conflicts: List\[Dict\[str, Any\]\]  
    artifacts: List\[str\]  
    confidence: float  
    coverage: float  *\# Percentage of subtasks that contributed*

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# EVENTS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class EventType(Enum):  
    """Types of events in the orchestrator."""  
    *\# Run events*  
    RUN\_CREATED \= auto()  
    RUN\_STARTED \= auto()  
    RUN\_STATE\_CHANGED \= auto()  
    RUN\_COMPLETED \= auto()  
    RUN\_FAILED \= auto()  
    RUN\_CANCELLED \= auto()  
      
    *\# Subtask events*  
    SUBTASK\_CREATED \= auto()  
    SUBTASK\_QUEUED \= auto()  
    SUBTASK\_ASSIGNED \= auto()  
    SUBTASK\_STARTED \= auto()  
    SUBTASK\_CHECKPOINTED \= auto()  
    SUBTASK\_COMPLETED \= auto()  
    SUBTASK\_FAILED \= auto()  
    SUBTASK\_RETRIED \= auto()  
      
    *\# Progress events*  
    PROGRESS\_UPDATED \= auto()  
    DEADLINE\_WARNING \= auto()  
    BUDGET\_WARNING \= auto()

@dataclass  
class Event:  
    """An event in the orchestrator."""  
    id: str  
    type: EventType  
    run\_id: str  
    subtask\_id: Optional\[str\]  
    timestamp: datetime  
    data: Dict\[str, Any\]  
      
    @classmethod  
    def create(  
        cls,  
        event\_type: EventType,  
        run\_id: str,  
        subtask\_id: Optional\[str\] \= None,  
        \*\*data  
    ) \-\> 'Event':  
        return cls(  
            id\=str(uuid4()),  
            type\=event\_type,  
            run\_id\=run\_id,  
            subtask\_id\=subtask\_id,  
            timestamp\=datetime.utcnow(),  
            data\=data  
        )

## **3\. Orchestrator Core Implementation**

Python  
*\#\!/usr/bin/env python3*  
"""  
Orchestrator Core Implementation

The Orchestrator is the central coordinator for research runs. It manages:  
\- Run lifecycle and state transitions  
\- Query decomposition into subtasks  
\- Subtask scheduling and prioritization  
\- Progress tracking and aggregation  
\- Failure handling and recovery coordination  
"""

from \_\_future\_\_ import annotations

import asyncio  
from contextlib import asynccontextmanager  
from typing import AsyncIterator

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# ORCHESTRATOR CLASS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class Orchestrator:  
    """  
    Central coordinator for research runs.  
      
    The Orchestrator is responsible for:  
    1\. Accepting research queries and creating runs  
    2\. Decomposing queries into parallel subtasks  
    3\. Scheduling subtasks across worker pools  
    4\. Tracking progress and handling failures  
    5\. Aggregating results and producing final output  
      
    Thread Safety:  
    \- All state mutations go through the database with fencing tokens  
    \- Multiple orchestrator instances can run concurrently  
    \- Work is distributed via job queues with deduplication  
    """  
      
    def \_\_init\_\_(  
        self,  
        db: DatabaseAdapter,  
        cache: CacheAdapter,  
        job\_queue: JobQueueAdapter,  
        decomposer: TaskDecomposer,  
        scheduler: SubtaskScheduler,  
        aggregator: ResultAggregator,  
        event\_bus: EventBus,  
        config: OrchestratorConfig  
    ):  
        self.db \= db  
        self.cache \= cache  
        self.job\_queue \= job\_queue  
        self.decomposer \= decomposer  
        self.scheduler \= scheduler  
        self.aggregator \= aggregator  
        self.event\_bus \= event\_bus  
        self.config \= config  
          
        *\# Internal state*  
        self.\_running \= False  
        self.\_background\_tasks: List\[asyncio.Task\] \= \[\]  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# LIFECYCLE MANAGEMENT*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def start(self) \-\> None:  
        """Start the orchestrator and background tasks."""  
        self.\_running \= True  
          
        *\# Start background monitors*  
        self.\_background\_tasks \= \[  
            asyncio.create\_task(self.\_progress\_monitor\_loop()),  
            asyncio.create\_task(self.\_deadline\_monitor\_loop()),  
            asyncio.create\_task(self.\_stalled\_run\_detector\_loop()),  
        \]  
          
        *\# Subscribe to events*  
        await self.event\_bus.subscribe(  
            EventType.SUBTASK\_COMPLETED,  
            self.\_on\_subtask\_completed  
        )  
        await self.event\_bus.subscribe(  
            EventType.SUBTASK\_FAILED,  
            self.\_on\_subtask\_failed  
        )  
      
    async def stop(self) \-\> None:  
        """Stop the orchestrator gracefully."""  
        self.\_running \= False  
          
        *\# Cancel background tasks*  
        for task in self.\_background\_tasks:  
            task.cancel()  
          
        await asyncio.gather(\*self.\_background\_tasks, return\_exceptions\=True)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RUN CREATION AND INITIALIZATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def create\_run(  
        self,  
        tenant\_id: str,  
        user\_id: str,  
        query: str,  
        config: Optional\[RunConfig\] \= None  
    ) \-\> ResearchRun:  
        """  
        Create a new research run.  
          
        This is the entry point for all research operations. It:  
        1\. Validates the query and configuration  
        2\. Creates the run record in the database  
        3\. Triggers the decomposition phase  
          
        Args:  
            tenant\_id: Tenant identifier for isolation  
            user\_id: User who initiated the run  
            query: Natural language research query  
            config: Optional configuration overrides  
              
        Returns:  
            The created ResearchRun object  
              
        Raises:  
            ValidationError: If query or config is invalid  
            QuotaExceededError: If tenant has exceeded limits  
        """  
        config \= config or RunConfig()  
          
        *\# Step 1: Validate inputs*  
        await self.\_validate\_run\_request(tenant\_id, user\_id, query, config)  
          
        *\# Step 2: Create run record (atomic)*  
        run \= await self.db.transaction(lambda tx: self.\_create\_run\_record(  
            tx, tenant\_id, user\_id, query, config  
        ))  
          
        *\# Step 3: Emit creation event*  
        await self.event\_bus.publish(Event.create(  
            EventType.RUN\_CREATED,  
            run\_id\=run.id,  
            query\=query,  
            tenant\_id\=tenant\_id,  
            user\_id\=user\_id  
        ))  
          
        *\# Step 4: Trigger async processing*  
        await self.job\_queue.enqueue(  
            queue\="orchestrator.process\_run",  
            job\_id\=f"process:{run.id}",  
            data\={"run\_id": run.id},  
            dedup\_key\=f"process:{run.id}"  
        )  
          
        return run  
      
    async def \_validate\_run\_request(  
        self,  
        tenant\_id: str,  
        user\_id: str,  
        query: str,  
        config: RunConfig  
    ) \-\> None:  
        """Validate a run creation request."""  
        *\# Check query length*  
        if len(query) \< 10:  
            raise ValidationError("Query too short")  
        if len(query) \> 10000:  
            raise ValidationError("Query too long")  
          
        *\# Check tenant quotas*  
        quota \= await self.db.get\_tenant\_quota(tenant\_id)  
        active\_runs \= await self.db.count\_active\_runs(tenant\_id)  
          
        if active\_runs \>= quota.max\_concurrent\_runs:  
            raise QuotaExceededError("Max concurrent runs exceeded")  
          
        *\# Check budget*  
        if config.budget\_limit\_usd and config.budget\_limit\_usd \> quota.remaining\_budget:  
            raise QuotaExceededError("Insufficient budget")  
      
    async def \_create\_run\_record(  
        self,  
        tx: Transaction,  
        tenant\_id: str,  
        user\_id: str,  
        query: str,  
        config: RunConfig  
    ) \-\> ResearchRun:  
        """Create the run record in a transaction."""  
        run\_id \= str(uuid4())  
        now \= datetime.utcnow()  
          
        run \= ResearchRun(  
            id\=run\_id,  
            tenant\_id\=tenant\_id,  
            user\_id\=user\_id,  
            query\=query,  
            config\=config,  
            state\=RunState.CREATED,  
            state\_version\=1,  
            total\_subtasks\=0,  
            completed\_subtasks\=0,  
            failed\_subtasks\=0,  
            lock\_token\=None,  
            lock\_expires\_at\=None,  
            created\_at\=now,  
            started\_at\=None,  
            completed\_at\=None,  
            deadline\_at\=now \+ timedelta(minutes\=config.timeout\_minutes),  
            result\_summary\=None,  
            artifacts\=\[\]  
        )  
          
        await tx.insert\_run(run)  
        return run  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RUN PROCESSING (Main State Machine)*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def process\_run(self, run\_id: str) \-\> None:  
        """  
        Process a run through its lifecycle.  
          
        This is the main state machine driver. It:  
        1\. Acquires a lock on the run  
        2\. Determines the current state  
        3\. Executes the appropriate phase  
        4\. Transitions to the next state  
        5\. Releases the lock  
          
        The method is idempotent \- calling it multiple times is safe.  
        """  
        async with self.\_acquire\_run\_lock(run\_id) as run:  
            if run is None:  
                return  *\# Run doesn't exist or is locked*  
              
            if run.is\_terminal:  
                return  *\# Nothing to do*  
              
            try:  
                *\# Execute current phase*  
                next\_state \= await self.\_execute\_phase(run)  
                  
                *\# Transition if needed*  
                if next\_state and next\_state \!= run.state:  
                    await self.\_transition\_run\_state(run, next\_state)  
                      
                    *\# Continue processing if not terminal*  
                    if next\_state not in {RunState.EXECUTING}:  
                        *\# Re-enqueue for next phase*  
                        await self.job\_queue.enqueue(  
                            queue\="orchestrator.process\_run",  
                            job\_id\=f"process:{run\_id}",  
                            data\={"run\_id": run\_id},  
                            dedup\_key\=f"process:{run\_id}:{next\_state.value}"  
                        )  
                          
            except Exception as e:  
                await self.\_handle\_run\_error(run, e)  
      
    async def \_execute\_phase(self, run: ResearchRun) \-\> Optional\[RunState\]:  
        """Execute the current phase and return the next state."""  
          
        if run.state \== RunState.CREATED:  
            return await self.\_phase\_validate(run)  
          
        elif run.state \== RunState.VALIDATING:  
            return await self.\_phase\_decompose(run)  
          
        elif run.state \== RunState.DECOMPOSING:  
            return await self.\_phase\_schedule(run)  
          
        elif run.state \== RunState.SCHEDULING:  
            return await self.\_phase\_start\_execution(run)  
          
        elif run.state \== RunState.EXECUTING:  
            return await self.\_phase\_monitor\_execution(run)  
          
        elif run.state \== RunState.AGGREGATING:  
            return await self.\_phase\_aggregate(run)  
          
        elif run.state \== RunState.FINALIZING:  
            return await self.\_phase\_finalize(run)  
          
        return None  
      
    @asynccontextmanager  
    async def \_acquire\_run\_lock(  
        self,  
        run\_id: str,  
        timeout: timedelta \= timedelta(minutes\=5\)  
    ) \-\> AsyncIterator\[Optional\[ResearchRun\]\]:  
        """  
        Acquire an exclusive lock on a run.  
          
        Uses database-level locking with fencing tokens to ensure  
        only one orchestrator instance processes a run at a time.  
        """  
        lock\_token \= str(uuid4())  
        expires\_at \= datetime.utcnow() \+ timeout  
          
        *\# Try to acquire lock*  
        run \= await self.db.acquire\_run\_lock(run\_id, lock\_token, expires\_at)  
          
        if run is None:  
            yield None  
            return  
          
        try:  
            yield run  
        finally:  
            *\# Release lock*  
            await self.db.release\_run\_lock(run\_id, lock\_token)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PHASE: VALIDATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_phase\_validate(self, run: ResearchRun) \-\> RunState:  
        """  
        Validate the run before decomposition.  
          
        Checks:  
        \- Query is processable  
        \- Resources are available  
        \- No duplicate runs  
        """  
        *\# Check for duplicate queries (optional)*  
        if self.config.deduplicate\_queries:  
            existing \= await self.\_find\_similar\_run(run.tenant\_id, run.query)  
            if existing:  
                *\# Link to existing run instead of duplicating*  
                await self.\_link\_to\_existing\_run(run, existing)  
                return RunState.COMPLETED  
          
        *\# Validate query can be decomposed*  
        validation \= await self.decomposer.validate\_query(run.query)  
        if not validation.is\_valid:  
            raise ValidationError(validation.error\_message)  
          
        return RunState.VALIDATING  *\# Triggers transition to DECOMPOSING*  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PHASE: DECOMPOSITION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_phase\_decompose(self, run: ResearchRun) \-\> RunState:  
        """  
        Decompose the query into subtasks.  
          
        This phase:  
        1\. Analyzes the query to identify entities/dimensions  
        2\. Creates subtask definitions  
        3\. Builds dependency graph  
        4\. Persists subtasks to database  
        """  
        *\# Decompose query*  
        decomposition \= await self.decomposer.decompose(  
            query\=run.query,  
            config\=run.config  
        )  
          
        *\# Validate decomposition*  
        if len(decomposition.subtasks) \== 0:  
            raise DecompositionError("No subtasks generated")  
          
        if len(decomposition.subtasks) \> run.config.max\_subtasks:  
            *\# Truncate or re-decompose with stricter limits*  
            decomposition \= await self.decomposer.decompose(  
                query\=run.query,  
                config\=run.config,  
                max\_subtasks\=run.config.max\_subtasks  
            )  
          
        *\# Create subtasks in database (atomic)*  
        await self.db.transaction(lambda tx: self.\_create\_subtasks(  
            tx, run, decomposition  
        ))  
          
        *\# Update run with subtask count*  
        await self.db.update\_run(  
            run\_id\=run.id,  
            state\_version\=run.state\_version,  
            updates\={  
                "total\_subtasks": len(decomposition.subtasks),  
                "state\_version": run.state\_version \+ 1  
            }  
        )  
          
        return RunState.DECOMPOSING  *\# Triggers transition to SCHEDULING*  
      
    async def \_create\_subtasks(  
        self,  
        tx: Transaction,  
        run: ResearchRun,  
        decomposition: DecompositionResult  
    ) \-\> List\[Subtask\]:  
        """Create subtask records in a transaction."""  
        subtasks \= \[\]  
        id\_map \= {}  *\# index \-\> subtask\_id*  
          
        for index, definition in enumerate(decomposition.subtasks):  
            subtask\_id \= str(uuid4())  
            id\_map\[index\] \= subtask\_id  
              
            *\# Resolve dependencies*  
            depends\_on \= \[  
                id\_map\[dep\_idx\]   
                for dep\_idx in definition.depends\_on\_indices  
                if dep\_idx in id\_map  
            \]  
              
            subtask \= Subtask(  
                id\=subtask\_id,  
                run\_id\=run.id,  
                index\=index,  
                idempotency\_key\=f"{run.id}:{index}",  
                task\_type\=definition.task\_type,  
                entity\_id\=definition.entity\_id,  
                input\_data\=definition.input\_data,  
                state\=SubtaskState.PENDING,  
                state\_version\=1,  
                attempt\_count\=0,  
                max\_attempts\=run.config.max\_retries,  
                assigned\_worker\_id\=None,  
                heartbeat\_at\=None,  
                checkpoint\_id\=None,  
                checkpoint\_step\=0,  
                result\_data\=None,  
                artifacts\=\[\],  
                last\_error\=None,  
                last\_error\_code\=None,  
                created\_at\=datetime.utcnow(),  
                started\_at\=None,  
                completed\_at\=None,  
                depends\_on\=depends\_on  
            )  
              
            await tx.insert\_subtask(subtask)  
            subtasks.append(subtask)  
          
        return subtasks  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PHASE: SCHEDULING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_phase\_schedule(self, run: ResearchRun) \-\> RunState:  
        """  
        Schedule subtasks for execution.  
          
        This phase:  
        1\. Identifies ready subtasks (dependencies met)  
        2\. Determines scheduling parameters  
        3\. Enqueues subtasks to job queue  
        """  
        *\# Get all pending subtasks*  
        subtasks \= await self.db.get\_subtasks\_by\_run(  
            run\_id\=run.id,  
            states\=\[SubtaskState.PENDING\]  
        )  
          
        *\# Filter to ready subtasks (dependencies met)*  
        completed\_ids \= await self.\_get\_completed\_subtask\_ids(run.id)  
        ready\_subtasks \= \[  
            s for s in subtasks  
            if all(dep in completed\_ids for dep in s.depends\_on)  
        \]  
          
        *\# Schedule each ready subtask*  
        for subtask in ready\_subtasks:  
            decision \= await self.scheduler.schedule(subtask, run)  
            await self.\_enqueue\_subtask(subtask, decision)  
          
        return RunState.SCHEDULING  *\# Triggers transition to EXECUTING*  
      
    async def \_enqueue\_subtask(  
        self,  
        subtask: Subtask,  
        decision: SchedulingDecision  
    ) \-\> None:  
        """Enqueue a subtask for execution."""  
        *\# Update state to QUEUED*  
        await self.db.update\_subtask(  
            subtask\_id\=subtask.id,  
            state\_version\=subtask.state\_version,  
            updates\={  
                "state": SubtaskState.QUEUED.value,  
                "state\_version": subtask.state\_version \+ 1  
            }  
        )  
          
        *\# Enqueue to job queue*  
        await self.job\_queue.enqueue(  
            queue\=decision.queue\_name,  
            job\_id\=subtask.id,  
            data\={  
                "subtask\_id": subtask.id,  
                "run\_id": subtask.run\_id,  
                "task\_type": subtask.task\_type,  
                "input\_data": subtask.input\_data  
            },  
            priority\=decision.priority,  
            delay\_seconds\=decision.delay\_seconds,  
            dedup\_key\=subtask.idempotency\_key  
        )  
          
        *\# Emit event*  
        await self.event\_bus.publish(Event.create(  
            EventType.SUBTASK\_QUEUED,  
            run\_id\=subtask.run\_id,  
            subtask\_id\=subtask.id,  
            queue\=decision.queue\_name,  
            priority\=decision.priority  
        ))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PHASE: EXECUTION MONITORING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_phase\_start\_execution(self, run: ResearchRun) \-\> RunState:  
        """Start the execution phase."""  
        *\# Update run started\_at*  
        await self.db.update\_run(  
            run\_id\=run.id,  
            state\_version\=run.state\_version,  
            updates\={  
                "started\_at": datetime.utcnow(),  
                "state\_version": run.state\_version \+ 1  
            }  
        )  
          
        await self.event\_bus.publish(Event.create(  
            EventType.RUN\_STARTED,  
            run\_id\=run.id  
        ))  
          
        return RunState.EXECUTING  
      
    async def \_phase\_monitor\_execution(self, run: ResearchRun) \-\> Optional\[RunState\]:  
        """  
        Monitor execution progress.  
          
        This phase runs periodically while subtasks execute.  
        It checks for completion and triggers aggregation.  
        """  
        *\# Get current progress*  
        progress \= await self.\_calculate\_progress(run.id)  
          
        *\# Check if all subtasks are done*  
        if progress.is\_complete:  
            return RunState.AGGREGATING  
          
        *\# Check for deadline*  
        if run.deadline\_at and datetime.utcnow() \> run.deadline\_at:  
            *\# Cancel remaining subtasks*  
            await self.\_cancel\_pending\_subtasks(run.id)  
            return RunState.AGGREGATING  
          
        *\# Schedule newly ready subtasks*  
        await self.\_schedule\_ready\_subtasks(run)  
          
        *\# Stay in EXECUTING state*  
        return None  
      
    async def \_calculate\_progress(self, run\_id: str) \-\> RunProgress:  
        """Calculate current run progress."""  
        counts \= await self.db.get\_subtask\_counts\_by\_state(run\_id)  
          
        total \= sum(counts.values())  
        completed \= counts.get(SubtaskState.COMPLETED.value, 0)  
        failed \= counts.get(SubtaskState.FAILED.value, 0)  
        skipped \= counts.get(SubtaskState.SKIPPED.value, 0)  
        cancelled \= counts.get(SubtaskState.CANCELLED.value, 0)  
          
        terminal \= completed \+ failed \+ skipped \+ cancelled  
          
        return RunProgress(  
            total\=total,  
            completed\=completed,  
            failed\=failed,  
            skipped\=skipped,  
            cancelled\=cancelled,  
            in\_progress\=total \- terminal,  
            is\_complete\=(terminal \== total)  
        )  
      
    async def \_schedule\_ready\_subtasks(self, run: ResearchRun) \-\> None:  
        """Schedule any newly ready subtasks."""  
        *\# Get pending subtasks*  
        pending \= await self.db.get\_subtasks\_by\_run(  
            run\_id\=run.id,  
            states\=\[SubtaskState.PENDING\]  
        )  
          
        if not pending:  
            return  
          
        *\# Get completed subtask IDs*  
        completed\_ids \= await self.\_get\_completed\_subtask\_ids(run.id)  
          
        *\# Find newly ready subtasks*  
        for subtask in pending:  
            if all(dep in completed\_ids for dep in subtask.depends\_on):  
                decision \= await self.scheduler.schedule(subtask, run)  
                await self.\_enqueue\_subtask(subtask, decision)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PHASE: AGGREGATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_phase\_aggregate(self, run: ResearchRun) \-\> RunState:  
        """  
        Aggregate subtask results.  
          
        This phase:  
        1\. Collects all subtask results  
        2\. Reconciles conflicts  
        3\. Generates summary  
        4\. Stores aggregated results  
        """  
        *\# Get completed subtask results*  
        subtasks \= await self.db.get\_subtasks\_by\_run(  
            run\_id\=run.id,  
            states\=\[SubtaskState.COMPLETED\]  
        )  
          
        results \= \[s.result\_data for s in subtasks if s.result\_data\]  
          
        *\# Aggregate results*  
        aggregation \= await self.aggregator.aggregate(  
            query\=run.query,  
            results\=results,  
            config\=run.config  
        )  
          
        *\# Store aggregation*  
        await self.db.update\_run(  
            run\_id\=run.id,  
            state\_version\=run.state\_version,  
            updates\={  
                "result\_summary": aggregation.summary,  
                "artifacts": aggregation.artifacts,  
                "state\_version": run.state\_version \+ 1  
            }  
        )  
          
        return RunState.AGGREGATING  *\# Triggers transition to FINALIZING*  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PHASE: FINALIZATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_phase\_finalize(self, run: ResearchRun) \-\> RunState:  
        """  
        Finalize the run.  
          
        This phase:  
        1\. Generates final artifacts  
        2\. Updates billing  
        3\. Cleans up resources  
        4\. Marks run as complete  
        """  
        *\# Generate final report*  
        report \= await self.\_generate\_final\_report(run)  
          
        *\# Update billing*  
        await self.\_record\_billing(run)  
          
        *\# Cleanup*  
        await self.\_cleanup\_run\_resources(run)  
          
        *\# Mark complete*  
        await self.db.update\_run(  
            run\_id\=run.id,  
            state\_version\=run.state\_version,  
            updates\={  
                "completed\_at": datetime.utcnow(),  
                "state\_version": run.state\_version \+ 1  
            }  
        )  
          
        await self.event\_bus.publish(Event.create(  
            EventType.RUN\_COMPLETED,  
            run\_id\=run.id,  
            duration\_seconds\=(datetime.utcnow() \- run.started\_at).total\_seconds()  
        ))  
          
        return RunState.COMPLETED  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# STATE TRANSITIONS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_transition\_run\_state(  
        self,  
        run: ResearchRun,  
        new\_state: RunState  
    ) \-\> None:  
        """  
        Transition a run to a new state.  
          
        Validates the transition is allowed and updates the database.  
        """  
        *\# Validate transition*  
        allowed \= RUN\_TRANSITIONS.get(run.state, set())  
        if new\_state not in allowed:  
            raise InvalidTransitionError(  
                f"Cannot transition from {run.state} to {new\_state}"  
            )  
          
        *\# Update database*  
        success \= await self.db.transition\_run\_state(  
            run\_id\=run.id,  
            from\_state\=run.state,  
            to\_state\=new\_state,  
            state\_version\=run.state\_version  
        )  
          
        if not success:  
            raise ConcurrencyError("State transition failed \- concurrent modification")  
          
        *\# Emit event*  
        await self.event\_bus.publish(Event.create(  
            EventType.RUN\_STATE\_CHANGED,  
            run\_id\=run.id,  
            from\_state\=run.state.value,  
            to\_state\=new\_state.value  
        ))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# EVENT HANDLERS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_on\_subtask\_completed(self, event: Event) \-\> None:  
        """Handle subtask completion event."""  
        run\_id \= event.run\_id  
        subtask\_id \= event.subtask\_id  
          
        *\# Update run progress*  
        await self.db.increment\_run\_progress(run\_id, "completed\_subtasks")  
          
        *\# Check if this unblocks other subtasks*  
        await self.\_schedule\_ready\_subtasks\_for\_run(run\_id)  
          
        *\# Check if run should advance*  
        await self.\_check\_run\_advancement(run\_id)  
      
    async def \_on\_subtask\_failed(self, event: Event) \-\> None:  
        """Handle subtask failure event."""  
        run\_id \= event.run\_id  
        subtask\_id \= event.subtask\_id  
          
        *\# Get subtask details*  
        subtask \= await self.db.get\_subtask(subtask\_id)  
          
        if subtask.attempt\_count \< subtask.max\_attempts:  
            *\# Schedule retry*  
            await self.\_schedule\_subtask\_retry(subtask)  
        else:  
            *\# Mark as permanently failed*  
            await self.db.increment\_run\_progress(run\_id, "failed\_subtasks")  
              
            *\# Check if run should fail*  
            await self.\_check\_run\_failure(run\_id)  
      
    async def \_check\_run\_advancement(self, run\_id: str) \-\> None:  
        """Check if a run should advance to the next phase."""  
        progress \= await self.\_calculate\_progress(run\_id)  
          
        if progress.is\_complete:  
            *\# Trigger run processing to advance state*  
            await self.job\_queue.enqueue(  
                queue\="orchestrator.process\_run",  
                job\_id\=f"advance:{run\_id}",  
                data\={"run\_id": run\_id},  
                dedup\_key\=f"advance:{run\_id}:{datetime.utcnow().minute}"  
            )  
      
    async def \_check\_run\_failure(self, run\_id: str) \-\> None:  
        """Check if a run should be marked as failed."""  
        run \= await self.db.get\_run(run\_id)  
        progress \= await self.\_calculate\_progress(run\_id)  
          
        *\# Fail if too many subtasks failed*  
        failure\_ratio \= progress.failed / progress.total if progress.total \> 0 else 0  
          
        if failure\_ratio \> self.config.max\_failure\_ratio:  
            await self.\_fail\_run(run, "Too many subtasks failed")  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# ERROR HANDLING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_handle\_run\_error(  
        self,  
        run: ResearchRun,  
        error: Exception  
    ) \-\> None:  
        """Handle an error during run processing."""  
        error\_message \= str(error)  
          
        *\# Log error*  
        await self.\_log\_run\_error(run, error)  
          
        *\# Determine if recoverable*  
        if isinstance(error, (ValidationError, DecompositionError)):  
            *\# Not recoverable \- fail the run*  
            await self.\_fail\_run(run, error\_message)  
          
        elif isinstance(error, ConcurrencyError):  
            *\# Retry later*  
            await self.job\_queue.enqueue(  
                queue\="orchestrator.process\_run",  
                job\_id\=f"retry:{run.id}",  
                data\={"run\_id": run.id},  
                delay\_seconds\=5,  
                dedup\_key\=f"retry:{run.id}:{datetime.utcnow().minute}"  
            )  
          
        else:  
            *\# Unknown error \- fail the run*  
            await self.\_fail\_run(run, f"Unexpected error: {error\_message}")  
      
    async def \_fail\_run(self, run: ResearchRun, reason: str) \-\> None:  
        """Mark a run as failed."""  
        await self.db.update\_run(  
            run\_id\=run.id,  
            state\_version\=run.state\_version,  
            updates\={  
                "state": RunState.FAILED.value,  
                "completed\_at": datetime.utcnow(),  
                "result\_summary": {"error": reason},  
                "state\_version": run.state\_version \+ 1  
            }  
        )  
          
        await self.event\_bus.publish(Event.create(  
            EventType.RUN\_FAILED,  
            run\_id\=run.id,  
            reason\=reason  
        ))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# BACKGROUND MONITORS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_progress\_monitor\_loop(self) \-\> None:  
        """Background loop to emit progress updates."""  
        while self.\_running:  
            try:  
                await self.\_emit\_progress\_updates()  
            except Exception as e:  
                pass  *\# Log and continue*  
            await asyncio.sleep(10)  
      
    async def \_deadline\_monitor\_loop(self) \-\> None:  
        """Background loop to check for deadline violations."""  
        while self.\_running:  
            try:  
                await self.\_check\_deadlines()  
            except Exception as e:  
                pass  *\# Log and continue*  
            await asyncio.sleep(30)  
      
    async def \_stalled\_run\_detector\_loop(self) \-\> None:  
        """Background loop to detect stalled runs."""  
        while self.\_running:  
            try:  
                await self.\_detect\_stalled\_runs()  
            except Exception as e:  
                pass  *\# Log and continue*  
            await asyncio.sleep(60)  
      
    async def \_emit\_progress\_updates(self) \-\> None:  
        """Emit progress updates for active runs."""  
        active\_runs \= await self.db.get\_runs\_by\_state(RunState.EXECUTING)  
          
        for run in active\_runs:  
            progress \= await self.\_calculate\_progress(run.id)  
              
            await self.event\_bus.publish(Event.create(  
                EventType.PROGRESS\_UPDATED,  
                run\_id\=run.id,  
                completed\=progress.completed,  
                total\=progress.total,  
                percentage\=progress.completed / progress.total \* 100 if progress.total \> 0 else 0  
            ))  
      
    async def \_check\_deadlines(self) \-\> None:  
        """Check for runs approaching or past deadline."""  
        now \= datetime.utcnow()  
        warning\_threshold \= now \+ timedelta(minutes\=5)  
          
        *\# Find runs with approaching deadlines*  
        runs \= await self.db.get\_runs\_with\_deadline\_before(warning\_threshold)  
          
        for run in runs:  
            if run.deadline\_at \<= now:  
                *\# Past deadline \- cancel remaining work*  
                await self.\_cancel\_pending\_subtasks(run.id)  
                await self.\_transition\_run\_state(run, RunState.AGGREGATING)  
            else:  
                *\# Approaching deadline \- emit warning*  
                await self.event\_bus.publish(Event.create(  
                    EventType.DEADLINE\_WARNING,  
                    run\_id\=run.id,  
                    deadline\_at\=run.deadline\_at.isoformat(),  
                    minutes\_remaining\=(run.deadline\_at \- now).seconds // 60  
                ))  
      
    async def \_detect\_stalled\_runs(self) \-\> None:  
        """Detect and recover stalled runs."""  
        stalled\_threshold \= datetime.utcnow() \- timedelta(minutes\=10)  
          
        *\# Find runs that haven't progressed*  
        stalled \= await self.db.get\_stalled\_runs(stalled\_threshold)  
          
        for run in stalled:  
            *\# Re-trigger processing*  
            await self.job\_queue.enqueue(  
                queue\="orchestrator.process\_run",  
                job\_id\=f"unstall:{run.id}",  
                data\={"run\_id": run.id},  
                dedup\_key\=f"unstall:{run.id}:{datetime.utcnow().hour}"  
            )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# HELPER METHODS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    async def \_get\_completed\_subtask\_ids(self, run\_id: str) \-\> Set\[str\]:  
        """Get IDs of completed subtasks for a run."""  
        subtasks \= await self.db.get\_subtasks\_by\_run(  
            run\_id\=run\_id,  
            states\=\[SubtaskState.COMPLETED\]  
        )  
        return {s.id for s in subtasks}  
      
    async def \_cancel\_pending\_subtasks(self, run\_id: str) \-\> None:  
        """Cancel all pending subtasks for a run."""  
        await self.db.update\_subtasks\_by\_run(  
            run\_id\=run\_id,  
            from\_states\=\[SubtaskState.PENDING, SubtaskState.QUEUED\],  
            updates\={"state": SubtaskState.CANCELLED.value}  
        )  
      
    async def \_schedule\_subtask\_retry(self, subtask: Subtask) \-\> None:  
        """Schedule a subtask for retry."""  
        *\# Calculate backoff*  
        delay \= min(30 \* (2 \*\* subtask.attempt\_count), 300)  
          
        *\# Reset state*  
        await self.db.update\_subtask(  
            subtask\_id\=subtask.id,  
            state\_version\=subtask.state\_version,  
            updates\={  
                "state": SubtaskState.PENDING.value,  
                "attempt\_count": subtask.attempt\_count \+ 1,  
                "state\_version": subtask.state\_version \+ 1  
            }  
        )  
          
        *\# Re-enqueue with delay*  
        decision \= SchedulingDecision(  
            subtask\_id\=subtask.id,  
            queue\_name\="workers.subtask",  
            priority\=5,  
            delay\_seconds\=delay,  
            worker\_affinity\=None  
        )  
        await self.\_enqueue\_subtask(subtask, decision)  
          
        await self.event\_bus.publish(Event.create(  
            EventType.SUBTASK\_RETRIED,  
            run\_id\=subtask.run\_id,  
            subtask\_id\=subtask.id,  
            attempt\=subtask.attempt\_count \+ 1  
        ))

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# SUPPORTING CLASSES*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@dataclass  
class RunProgress:  
    """Progress information for a run."""  
    total: int  
    completed: int  
    failed: int  
    skipped: int  
    cancelled: int  
    in\_progress: int  
    is\_complete: bool

@dataclass  
class OrchestratorConfig:  
    """Configuration for the orchestrator."""  
    max\_failure\_ratio: float \= 0.3  
    deduplicate\_queries: bool \= True  
    progress\_update\_interval: int \= 10  
    deadline\_check\_interval: int \= 30  
    stall\_detection\_interval: int \= 60  
    stall\_threshold\_minutes: int \= 10

*\# Exception classes*  
class ValidationError(Exception):  
    pass

class QuotaExceededError(Exception):  
    pass

class DecompositionError(Exception):  
    pass

class InvalidTransitionError(Exception):  
    pass

class ConcurrencyError(Exception):  
    pass

## **4\. Task Decomposer Implementation**

Python  
*\#\!/usr/bin/env python3*  
"""  
Task Decomposer for Query Analysis and Subtask Generation  
"""

class TaskDecomposer:  
    """  
    Decomposes research queries into parallel subtasks.  
      
    Strategies:  
    \- Entity-based: Split by entities mentioned in query  
    \- Dimension-based: Split by analytical dimensions  
    \- Source-based: Split by data source types  
    \- Temporal-based: Split by time periods  
    """  
      
    def \_\_init\_\_(self, llm\_client: LLMClient):  
        self.llm \= llm\_client  
      
    async def validate\_query(self, query: str) \-\> ValidationResult:  
        """Validate that a query can be decomposed."""  
        *\# Check basic requirements*  
        if len(query.strip()) \< 10:  
            return ValidationResult(False, "Query too short")  
          
        *\# Use LLM to assess query quality*  
        assessment \= await self.llm.invoke(  
            messages\=\[  
                {"role": "system", "content": QUERY\_VALIDATION\_PROMPT},  
                {"role": "user", "content": query}  
            \],  
            response\_format\={"type": "json\_schema", "json\_schema": VALIDATION\_SCHEMA}  
        )  
          
        result \= json.loads(assessment.content)  
        return ValidationResult(  
            is\_valid\=result\["is\_valid"\],  
            error\_message\=result.get("error\_message"),  
            suggestions\=result.get("suggestions", \[\])  
        )  
      
    async def decompose(  
        self,  
        query: str,  
        config: RunConfig,  
        max\_subtasks: Optional\[int\] \= None  
    ) \-\> DecompositionResult:  
        """  
        Decompose a query into subtasks.  
          
        Process:  
        1\. Analyze query to identify decomposition strategy  
        2\. Extract entities/dimensions  
        3\. Generate subtask definitions  
        4\. Build dependency graph  
        5\. Estimate resources  
        """  
        max\_subtasks \= max\_subtasks or config.max\_subtasks  
          
        *\# Step 1: Analyze query*  
        analysis \= await self.\_analyze\_query(query)  
          
        *\# Step 2: Select decomposition strategy*  
        strategy \= self.\_select\_strategy(analysis, config)  
          
        *\# Step 3: Generate subtasks based on strategy*  
        if strategy \== "entity\_based":  
            subtasks \= await self.\_decompose\_by\_entity(query, analysis, max\_subtasks)  
        elif strategy \== "dimension\_based":  
            subtasks \= await self.\_decompose\_by\_dimension(query, analysis, max\_subtasks)  
        elif strategy \== "source\_based":  
            subtasks \= await self.\_decompose\_by\_source(query, analysis, max\_subtasks)  
        else:  
            subtasks \= await self.\_decompose\_generic(query, analysis, max\_subtasks)  
          
        *\# Step 4: Build dependency graph*  
        dependencies \= self.\_build\_dependency\_graph(subtasks)  
          
        *\# Step 5: Estimate resources*  
        estimates \= self.\_estimate\_resources(subtasks)  
          
        return DecompositionResult(  
            subtasks\=subtasks,  
            dependency\_graph\=dependencies,  
            estimated\_duration\_minutes\=estimates\["duration"\],  
            estimated\_cost\_usd\=estimates\["cost"\],  
            decomposition\_reasoning\=analysis\["reasoning"\]  
        )  
      
    async def \_analyze\_query(self, query: str) \-\> Dict\[str, Any\]:  
        """Analyze query to understand structure and intent."""  
        response \= await self.llm.invoke(  
            messages\=\[  
                {"role": "system", "content": QUERY\_ANALYSIS\_PROMPT},  
                {"role": "user", "content": query}  
            \],  
            response\_format\={"type": "json\_schema", "json\_schema": ANALYSIS\_SCHEMA}  
        )  
          
        return json.loads(response.content)  
      
    def \_select\_strategy(  
        self,  
        analysis: Dict\[str, Any\],  
        config: RunConfig  
    ) \-\> str:  
        """Select the best decomposition strategy."""  
        *\# Check for explicit strategy in config*  
        if config.decomposition\_strategy \!= "auto":  
            return config.decomposition\_strategy  
          
        *\# Select based on query characteristics*  
        if analysis.get("entities") and len(analysis\["entities"\]) \> 1:  
            return "entity\_based"  
          
        if analysis.get("dimensions") and len(analysis\["dimensions"\]) \> 1:  
            return "dimension\_based"  
          
        if analysis.get("requires\_multiple\_sources"):  
            return "source\_based"  
          
        return "generic"  
      
    async def \_decompose\_by\_entity(  
        self,  
        query: str,  
        analysis: Dict\[str, Any\],  
        max\_subtasks: int  
    ) \-\> List\[SubtaskDefinition\]:  
        """Decompose query by entities."""  
        entities \= analysis.get("entities", \[\])\[:max\_subtasks\]  
          
        subtasks \= \[\]  
        for i, entity in enumerate(entities):  
            subtasks.append(SubtaskDefinition(  
                task\_type\="entity\_research",  
                entity\_id\=entity\["id"\],  
                input\_data\={  
                    "entity\_name": entity\["name"\],  
                    "entity\_type": entity\["type"\],  
                    "research\_aspects": analysis.get("aspects", \[\]),  
                    "original\_query": query  
                },  
                priority\=entity.get("priority", 5),  
                estimated\_duration\_seconds\=120,  
                depends\_on\_indices\=\[\]  *\# Entity tasks are independent*  
            ))  
          
        *\# Add aggregation subtask*  
        subtasks.append(SubtaskDefinition(  
            task\_type\="aggregate\_entities",  
            entity\_id\=None,  
            input\_data\={  
                "entity\_count": len(entities),  
                "original\_query": query  
            },  
            priority\=10,  
            estimated\_duration\_seconds\=60,  
            depends\_on\_indices\=list(range(len(entities)))  *\# Depends on all entity tasks*  
        ))  
          
        return subtasks  
      
    async def \_decompose\_by\_dimension(  
        self,  
        query: str,  
        analysis: Dict\[str, Any\],  
        max\_subtasks: int  
    ) \-\> List\[SubtaskDefinition\]:  
        """Decompose query by analytical dimensions."""  
        dimensions \= analysis.get("dimensions", \[\])\[:max\_subtasks\]  
          
        subtasks \= \[\]  
        for i, dimension in enumerate(dimensions):  
            subtasks.append(SubtaskDefinition(  
                task\_type\="dimension\_research",  
                entity\_id\=None,  
                input\_data\={  
                    "dimension": dimension\["name"\],  
                    "scope": dimension.get("scope"),  
                    "metrics": dimension.get("metrics", \[\]),  
                    "original\_query": query  
                },  
                priority\=dimension.get("priority", 5),  
                estimated\_duration\_seconds\=180,  
                depends\_on\_indices\=\[\]  
            ))  
          
        return subtasks  
      
    def \_build\_dependency\_graph(  
        self,  
        subtasks: List\[SubtaskDefinition\]  
    ) \-\> Dict\[str, List\[str\]\]:  
        """Build dependency graph from subtask definitions."""  
        graph \= {}  
          
        for i, subtask in enumerate(subtasks):  
            subtask\_id \= f"subtask\_{i}"  
            dependencies \= \[f"subtask\_{dep}" for dep in subtask.depends\_on\_indices\]  
            graph\[subtask\_id\] \= dependencies  
          
        return graph  
      
    def \_estimate\_resources(  
        self,  
        subtasks: List\[SubtaskDefinition\]  
    ) \-\> Dict\[str, Any\]:  
        """Estimate resource requirements for subtasks."""  
        total\_duration \= sum(s.estimated\_duration\_seconds for s in subtasks)  
          
        *\# Estimate parallelism*  
        independent \= sum(1 for s in subtasks if not s.depends\_on\_indices)  
        parallel\_factor \= min(independent, 10)  *\# Assume max 10 parallel workers*  
          
        effective\_duration \= total\_duration / parallel\_factor if parallel\_factor \> 0 else total\_duration  
          
        *\# Estimate cost (simplified)*  
        llm\_calls\_per\_subtask \= 5  
        cost\_per\_llm\_call \= 0.01  
        estimated\_cost \= len(subtasks) \* llm\_calls\_per\_subtask \* cost\_per\_llm\_call  
          
        return {  
            "duration": int(effective\_duration / 60),  *\# Minutes*  
            "cost": round(estimated\_cost, 2)  
        }

*\# Prompt templates*  
QUERY\_ANALYSIS\_PROMPT \= """  
Analyze the following research query and extract:  
1\. Entities mentioned (companies, people, products, etc.)  
2\. Analytical dimensions (market size, competition, trends, etc.)  
3\. Required data sources  
4\. Temporal scope  
5\. Decomposition reasoning

Return structured JSON.  
"""

ANALYSIS\_SCHEMA \= {  
    "name": "query\_analysis",  
    "strict": True,  
    "schema": {  
        "type": "object",  
        "properties": {  
            "entities": {  
                "type": "array",  
                "items": {  
                    "type": "object",  
                    "properties": {  
                        "id": {"type": "string"},  
                        "name": {"type": "string"},  
                        "type": {"type": "string"},  
                        "priority": {"type": "integer"}  
                    },  
                    "required": \["id", "name", "type"\]  
                }  
            },  
            "dimensions": {  
                "type": "array",  
                "items": {  
                    "type": "object",  
                    "properties": {  
                        "name": {"type": "string"},  
                        "scope": {"type": "string"},  
                        "metrics": {"type": "array", "items": {"type": "string"}}  
                    },  
                    "required": \["name"\]  
                }  
            },  
            "aspects": {"type": "array", "items": {"type": "string"}},  
            "requires\_multiple\_sources": {"type": "boolean"},  
            "reasoning": {"type": "string"}  
        },  
        "required": \["entities", "dimensions", "reasoning"\]  
    }  
}

## **5\. Subtask Scheduler Implementation**

Python  
*\#\!/usr/bin/env python3*  
"""  
Subtask Scheduler for Queue Assignment and Prioritization  
"""

class SubtaskScheduler:  
    """  
    Schedules subtasks to appropriate queues with proper prioritization.  
      
    Considerations:  
    \- Task type and resource requirements  
    \- Tenant fairness  
    \- Worker affinity  
    \- Priority and deadlines  
    """  
      
    def \_\_init\_\_(  
        self,  
        queue\_config: Dict\[str, QueueConfig\],  
        fairness\_tracker: FairnessTracker  
    ):  
        self.queue\_config \= queue\_config  
        self.fairness\_tracker \= fairness\_tracker  
      
    async def schedule(  
        self,  
        subtask: Subtask,  
        run: ResearchRun  
    ) \-\> SchedulingDecision:  
        """  
        Determine how to schedule a subtask.  
          
        Returns scheduling decision with:  
        \- Queue name  
        \- Priority  
        \- Delay  
        \- Worker affinity  
        """  
        *\# Step 1: Select queue based on task type*  
        queue\_name \= self.\_select\_queue(subtask.task\_type)  
          
        *\# Step 2: Calculate priority*  
        priority \= self.\_calculate\_priority(subtask, run)  
          
        *\# Step 3: Apply fairness adjustments*  
        priority \= await self.\_apply\_fairness(priority, run.tenant\_id)  
          
        *\# Step 4: Calculate delay (for rate limiting)*  
        delay \= await self.\_calculate\_delay(subtask, run)  
          
        *\# Step 5: Determine worker affinity*  
        affinity \= self.\_determine\_affinity(subtask)  
          
        return SchedulingDecision(  
            subtask\_id\=subtask.id,  
            queue\_name\=queue\_name,  
            priority\=priority,  
            delay\_seconds\=delay,  
            worker\_affinity\=affinity  
        )  
      
    def \_select\_queue(self, task\_type: str) \-\> str:  
        """Select the appropriate queue for a task type."""  
        queue\_mapping \= {  
            "entity\_research": "workers.research",  
            "dimension\_research": "workers.research",  
            "web\_scrape": "workers.scrape",  
            "llm\_analysis": "workers.llm",  
            "aggregate\_entities": "workers.aggregate",  
            "aggregate\_dimensions": "workers.aggregate"  
        }  
          
        return queue\_mapping.get(task\_type, "workers.default")  
      
    def \_calculate\_priority(  
        self,  
        subtask: Subtask,  
        run: ResearchRun  
    ) \-\> int:  
        """  
        Calculate subtask priority (1-100, higher \= more urgent).  
          
        Factors:  
        \- Run priority  
        \- Deadline proximity  
        \- Dependency depth  
        \- Retry count  
        """  
        base\_priority \= run.config.priority \* 10  *\# 10-100*  
          
        *\# Deadline factor*  
        if run.deadline\_at:  
            time\_remaining \= (run.deadline\_at \- datetime.utcnow()).total\_seconds()  
            if time\_remaining \< 300:  *\# \< 5 minutes*  
                base\_priority \+= 20  
            elif time\_remaining \< 900:  *\# \< 15 minutes*  
                base\_priority \+= 10  
          
        *\# Retry penalty (lower priority for retries)*  
        base\_priority \-= subtask.attempt\_count \* 5  
          
        *\# Dependency bonus (tasks with dependents get higher priority)*  
        *\# This would require knowing the dependency graph*  
          
        return max(1, min(100, base\_priority))  
      
    async def \_apply\_fairness(  
        self,  
        priority: int,  
        tenant\_id: str  
    ) \-\> int:  
        """Apply fairness adjustments based on tenant usage."""  
        *\# Get tenant's recent usage*  
        usage \= await self.fairness\_tracker.get\_tenant\_usage(tenant\_id)  
          
        *\# Apply deficit-based adjustment*  
        if usage.is\_over\_fair\_share:  
            *\# Reduce priority for over-users*  
            priority \= int(priority \* 0.8)  
        elif usage.is\_under\_fair\_share:  
            *\# Boost priority for under-users*  
            priority \= int(priority \* 1.2)  
          
        return max(1, min(100, priority))  
      
    async def \_calculate\_delay(  
        self,  
        subtask: Subtask,  
        run: ResearchRun  
    ) \-\> int:  
        """Calculate delay before scheduling (for rate limiting)."""  
        *\# No delay for first attempt*  
        if subtask.attempt\_count \== 0:  
            return 0  
          
        *\# Exponential backoff for retries*  
        return min(30 \* (2 \*\* (subtask.attempt\_count \- 1)), 300)  
      
    def \_determine\_affinity(self, subtask: Subtask) \-\> Optional\[str\]:  
        """Determine if subtask should run on a specific worker."""  
        *\# For checkpoint resumption, prefer the same worker*  
        if subtask.checkpoint\_id and subtask.assigned\_worker\_id:  
            return subtask.assigned\_worker\_id  
          
        return None

## **Summary**

This Orchestrator implementation provides:

1. Complete State Machine: Manages runs through CREATED → VALIDATING → DECOMPOSING → SCHEDULING → EXECUTING → AGGREGATING → FINALIZING → COMPLETED states with proper transitions.  
2. Task Decomposition: Uses LLM-powered analysis to break queries into parallel subtasks with dependency tracking.  
3. Fair Scheduling: Prioritizes subtasks based on deadlines, retries, and tenant fairness.  
4. Event-Driven Architecture: Uses an event bus for loose coupling between components.  
5. Failure Handling: Automatic retry scheduling with exponential backoff.  
6. Background Monitoring: Continuous monitoring for progress, deadlines, and stalled runs.  
7. Concurrency Safety: Database-level locking with fencing tokens ensures safe concurrent operation.

# **Part 1: Python ORM Models for ResearchRun and Subtask**

Below are complete SQLAlchemy ORM models for the research orchestration schemas.

Python  
*\#\!/usr/bin/env python3*  
"""  
SQLAlchemy ORM Models for Research Orchestration

This module defines the ORM models for ResearchRun and Subtask entities,  
including all relationships, validations, and helper methods.

Dependencies:  
    \- sqlalchemy \>= 2.0  
    \- sqlalchemy-utils  
    \- pydantic (for validation)  
"""

from \_\_future\_\_ import annotations

import enum  
import hashlib  
from datetime import datetime, timedelta  
from typing import Any, Dict, List, Optional, TYPE\_CHECKING  
from uuid import uuid4

from sqlalchemy import (  
    BigInteger,  
    Boolean,  
    CheckConstraint,  
    Column,  
    Computed,  
    DateTime,  
    Enum,  
    ForeignKey,  
    Index,  
    Integer,  
    Numeric,  
    String,  
    Text,  
    UniqueConstraint,  
    event,  
    func,  
    select,  
)  
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID  
from sqlalchemy.ext.hybrid import hybrid\_property  
from sqlalchemy.orm import (  
    DeclarativeBase,  
    Mapped,  
    mapped\_column,  
    relationship,  
    validates,  
)

if TYPE\_CHECKING:  
    from sqlalchemy.orm import Session

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# BASE CLASS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class Base(DeclarativeBase):  
    """Base class for all ORM models."""  
    pass

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# ENUMS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class RunState(enum.Enum):  
    """States in the research run lifecycle."""  
    CREATED \= "created"  
    VALIDATING \= "validating"  
    DECOMPOSING \= "decomposing"  
    SCHEDULING \= "scheduling"  
    EXECUTING \= "executing"  
    AGGREGATING \= "aggregating"  
    FINALIZING \= "finalizing"  
    COMPLETED \= "completed"  
    FAILED \= "failed"  
    CANCELLED \= "cancelled"

class SubtaskState(enum.Enum):  
    """States in the subtask lifecycle."""  
    PENDING \= "pending"  
    QUEUED \= "queued"  
    ASSIGNED \= "assigned"  
    RUNNING \= "running"  
    CHECKPOINTED \= "checkpointed"  
    COMPLETED \= "completed"  
    FAILED \= "failed"  
    SKIPPED \= "skipped"  
    CANCELLED \= "cancelled"

class TaskType(enum.Enum):  
    """Types of subtasks."""  
    ENTITY\_RESEARCH \= "entity\_research"  
    DIMENSION\_RESEARCH \= "dimension\_research"  
    WEB\_SCRAPE \= "web\_scrape"  
    LLM\_ANALYSIS \= "llm\_analysis"  
    AGGREGATE\_ENTITIES \= "aggregate\_entities"  
    AGGREGATE\_DIMENSIONS \= "aggregate\_dimensions"  
    CONFLICT\_RESOLUTION \= "conflict\_resolution"  
    REPORT\_GENERATION \= "report\_generation"

class DecompositionStrategy(enum.Enum):  
    """Strategies for decomposing queries."""  
    AUTO \= "auto"  
    ENTITY\_BASED \= "entity\_based"  
    DIMENSION\_BASED \= "dimension\_based"  
    SOURCE\_BASED \= "source\_based"  
    TEMPORAL\_BASED \= "temporal\_based"  
    HYBRID \= "hybrid"

*\# Valid state transitions*  
RUN\_TRANSITIONS: Dict\[RunState, set\[RunState\]\] \= {  
    RunState.CREATED: {RunState.VALIDATING, RunState.CANCELLED},  
    RunState.VALIDATING: {RunState.DECOMPOSING, RunState.FAILED, RunState.CANCELLED},  
    RunState.DECOMPOSING: {RunState.SCHEDULING, RunState.FAILED, RunState.CANCELLED},  
    RunState.SCHEDULING: {RunState.EXECUTING, RunState.FAILED, RunState.CANCELLED},  
    RunState.EXECUTING: {RunState.AGGREGATING, RunState.FAILED, RunState.CANCELLED},  
    RunState.AGGREGATING: {RunState.FINALIZING, RunState.FAILED, RunState.CANCELLED},  
    RunState.FINALIZING: {RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED},  
    RunState.COMPLETED: set(),  
    RunState.FAILED: set(),  
    RunState.CANCELLED: set(),  
}

SUBTASK\_TRANSITIONS: Dict\[SubtaskState, set\[SubtaskState\]\] \= {  
    SubtaskState.PENDING: {SubtaskState.QUEUED, SubtaskState.CANCELLED},  
    SubtaskState.QUEUED: {SubtaskState.ASSIGNED, SubtaskState.CANCELLED},  
    SubtaskState.ASSIGNED: {SubtaskState.RUNNING, SubtaskState.PENDING, SubtaskState.CANCELLED},  
    SubtaskState.RUNNING: {SubtaskState.CHECKPOINTED, SubtaskState.COMPLETED,   
                           SubtaskState.FAILED, SubtaskState.CANCELLED},  
    SubtaskState.CHECKPOINTED: {SubtaskState.RUNNING, SubtaskState.COMPLETED,  
                                 SubtaskState.FAILED, SubtaskState.CANCELLED},  
    SubtaskState.COMPLETED: set(),  
    SubtaskState.FAILED: {SubtaskState.PENDING},  
    SubtaskState.SKIPPED: set(),  
    SubtaskState.CANCELLED: set(),  
}

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# TENANT MODEL*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class Tenant(Base):  
    """Tenant model for multi-tenancy isolation."""  
      
    \_\_tablename\_\_ \= "tenants"  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    name: Mapped\[str\] \= mapped\_column(String(255), nullable\=False)  
    tier: Mapped\[str\] \= mapped\_column(  
        String(50),   
        nullable\=False,   
        default\="free"  
    )  
    settings: Mapped\[Dict\[str, Any\]\] \= mapped\_column(  
        JSONB,   
        nullable\=False,   
        default\=dict  
    )  
      
    *\# Quotas*  
    max\_concurrent\_runs: Mapped\[int\] \= mapped\_column(Integer, default\=5)  
    max\_subtasks\_per\_run: Mapped\[int\] \= mapped\_column(Integer, default\=100)  
    monthly\_budget\_usd: Mapped\[Optional\[float\]\] \= mapped\_column(Numeric(10, 2))  
      
    *\# Timestamps*  
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
    updated\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now(),   
        onupdate\=func.now()  
    )  
    deleted\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# Relationships*  
    users: Mapped\[List\["User"\]\] \= relationship(back\_populates\="tenant")  
    runs: Mapped\[List\["ResearchRun"\]\] \= relationship(back\_populates\="tenant")  
      
    \_\_table\_args\_\_ \= (  
        CheckConstraint(  
            "tier IN ('free', 'starter', 'pro', 'business', 'enterprise')",  
            name\="chk\_tenant\_tier"  
        ),  
        Index("idx\_tenants\_tier", "tier", postgresql\_where\=deleted\_at.is\_(None)),  
    )

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# USER MODEL*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class User(Base):  
    """User model."""  
      
    \_\_tablename\_\_ \= "users"  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    tenant\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("tenants.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
    email: Mapped\[str\] \= mapped\_column(String(255), nullable\=False)  
    name: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
    role: Mapped\[str\] \= mapped\_column(String(50), default\="user")  
      
    *\# Timestamps*  
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
    updated\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now(),   
        onupdate\=func.now()  
    )  
    last\_active\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    deleted\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# Relationships*  
    tenant: Mapped\["Tenant"\] \= relationship(back\_populates\="users")  
    runs: Mapped\[List\["ResearchRun"\]\] \= relationship(back\_populates\="user")  
      
    \_\_table\_args\_\_ \= (  
        UniqueConstraint("tenant\_id", "email", name\="uq\_users\_email\_tenant"),  
        CheckConstraint("role IN ('admin', 'user', 'viewer')", name\="chk\_user\_role"),  
    )

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# RESEARCH RUN MODEL*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class ResearchRun(Base):  
    """  
    Research Run model representing a complete research task.  
      
    A run goes through multiple states from creation to completion,  
    managing subtasks that execute in parallel.  
    """  
      
    \_\_tablename\_\_ \= "research\_runs"  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# IDENTITY*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    tenant\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("tenants.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
    user\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("users.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# QUERY AND CONFIGURATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    query: Mapped\[str\] \= mapped\_column(Text, nullable\=False)  
    query\_hash: Mapped\[str\] \= mapped\_column(String(64), nullable\=False)  
      
    config: Mapped\[Dict\[str, Any\]\] \= mapped\_column(  
        JSONB,   
        nullable\=False,   
        default\=lambda: {  
            "max\_subtasks": 100,  
            "max\_sources\_per\_subtask": 10,  
            "max\_retries": 3,  
            "timeout\_minutes": 60,  
            "priority": 5,  
            "decomposition\_strategy": "auto",  
            "min\_confidence": 0.7,  
            "require\_multiple\_sources": True,  
            "max\_llm\_calls": 1000,  
            "max\_web\_requests": 500  
        }  
    )  
      
    *\# Parsed config fields for indexing*  
    priority: Mapped\[int\] \= mapped\_column(Integer, default\=5)  
    decomposition\_strategy: Mapped\[DecompositionStrategy\] \= mapped\_column(  
        Enum(DecompositionStrategy),   
        default\=DecompositionStrategy.AUTO  
    )  
    timeout\_minutes: Mapped\[int\] \= mapped\_column(Integer, default\=60)  
    budget\_limit\_usd: Mapped\[Optional\[float\]\] \= mapped\_column(Numeric(10, 2))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# STATE MACHINE*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    state: Mapped\[RunState\] \= mapped\_column(  
        Enum(RunState),   
        default\=RunState.CREATED,  
        nullable\=False  
    )  
    state\_version: Mapped\[int\] \= mapped\_column(BigInteger, default\=1, nullable\=False)  
    previous\_state: Mapped\[Optional\[RunState\]\] \= mapped\_column(Enum(RunState))  
    state\_changed\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# FENCING TOKENS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    lock\_token: Mapped\[Optional\[str\]\] \= mapped\_column(UUID(as\_uuid\=False))  
    lock\_holder\_id: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
    lock\_acquired\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    lock\_expires\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# PROGRESS TRACKING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    total\_subtasks: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    completed\_subtasks: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    failed\_subtasks: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    skipped\_subtasks: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    cancelled\_subtasks: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# TIMING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
    started\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    completed\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    deadline\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RESULTS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    result\_summary: Mapped\[Optional\[Dict\[str, Any\]\]\] \= mapped\_column(JSONB)  
    artifacts: Mapped\[List\[str\]\] \= mapped\_column(ARRAY(Text), default\=list)  
      
    *\# Error information*  
    error\_code: Mapped\[Optional\[str\]\] \= mapped\_column(String(100))  
    error\_message: Mapped\[Optional\[str\]\] \= mapped\_column(Text)  
    error\_details: Mapped\[Optional\[Dict\[str, Any\]\]\] \= mapped\_column(JSONB)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RESOURCE TRACKING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    llm\_calls\_used: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    web\_requests\_used: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    tokens\_used: Mapped\[int\] \= mapped\_column(BigInteger, default\=0)  
    estimated\_cost\_usd: Mapped\[float\] \= mapped\_column(Numeric(10, 4), default\=0)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# METADATA*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    metadata: Mapped\[Dict\[str, Any\]\] \= mapped\_column(JSONB, default\=dict)  
    tags: Mapped\[List\[str\]\] \= mapped\_column(ARRAY(Text), default\=list)  
    deleted\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RELATIONSHIPS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    tenant: Mapped\["Tenant"\] \= relationship(back\_populates\="runs")  
    user: Mapped\["User"\] \= relationship(back\_populates\="runs")  
    subtasks: Mapped\[List\["Subtask"\]\] \= relationship(  
        back\_populates\="run",  
        cascade\="all, delete-orphan",  
        order\_by\="Subtask.index"  
    )  
    state\_transitions: Mapped\[List\["RunStateTransition"\]\] \= relationship(  
        back\_populates\="run",  
        cascade\="all, delete-orphan"  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# TABLE CONFIGURATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    \_\_table\_args\_\_ \= (  
        *\# Constraints*  
        CheckConstraint("priority BETWEEN 1 AND 10", name\="chk\_runs\_priority"),  
        CheckConstraint("state\_version \> 0", name\="chk\_runs\_state\_version"),  
        CheckConstraint(  
            "completed\_subtasks \>= 0 AND failed\_subtasks \>= 0",  
            name\="chk\_runs\_progress\_positive"  
        ),  
          
        *\# Indexes*  
        Index(  
            "idx\_runs\_tenant\_state",   
            "tenant\_id", "state",  
            postgresql\_where\=deleted\_at.is\_(None)  
        ),  
        Index(  
            "idx\_runs\_user",   
            "user\_id", "created\_at",  
            postgresql\_where\=deleted\_at.is\_(None)  
        ),  
        Index(  
            "idx\_runs\_active",  
            "tenant\_id", "created\_at",  
            postgresql\_where\=(  
                deleted\_at.is\_(None) &   
                \~state.in\_(\[RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED\])  
            )  
        ),  
        Index(  
            "idx\_runs\_deadline",  
            "deadline\_at",  
            postgresql\_where\=(  
                deleted\_at.is\_(None) &   
                (state \== RunState.EXECUTING) &  
                deadline\_at.isnot(None)  
            )  
        ),  
        Index(  
            "idx\_runs\_lock\_expires",  
            "lock\_expires\_at",  
            postgresql\_where\=(  
                lock\_token.isnot(None) &   
                lock\_expires\_at.isnot(None)  
            )  
        ),  
        Index("idx\_runs\_query\_hash", "tenant\_id", "query\_hash"),  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# COMPUTED PROPERTIES*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    @hybrid\_property  
    def progress\_percentage(self) \-\> float:  
        """Calculate progress as a percentage."""  
        if self.total\_subtasks \== 0:  
            return 0.0  
        return round((self.completed\_subtasks / self.total\_subtasks) \* 100, 2)  
      
    @hybrid\_property  
    def is\_terminal(self) \-\> bool:  
        """Check if run is in a terminal state."""  
        return self.state in {RunState.COMPLETED, RunState.FAILED, RunState.CANCELLED}  
      
    @hybrid\_property  
    def is\_locked(self) \-\> bool:  
        """Check if run is currently locked."""  
        if self.lock\_token is None:  
            return False  
        if self.lock\_expires\_at is None:  
            return True  
        return datetime.utcnow() \< self.lock\_expires\_at  
      
    @hybrid\_property  
    def duration\_seconds(self) \-\> Optional\[int\]:  
        """Calculate duration in seconds."""  
        if self.started\_at and self.completed\_at:  
            return int((self.completed\_at \- self.started\_at).total\_seconds())  
        return None  
      
    @hybrid\_property  
    def in\_progress\_subtasks(self) \-\> int:  
        """Calculate number of in-progress subtasks."""  
        terminal \= (  
            self.completed\_subtasks \+   
            self.failed\_subtasks \+   
            self.skipped\_subtasks \+   
            self.cancelled\_subtasks  
        )  
        return self.total\_subtasks \- terminal  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# VALIDATORS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    @validates("query")  
    def validate\_query(self, key: str, value: str) \-\> str:  
        """Validate and hash the query."""  
        if len(value.strip()) \< 10:  
            raise ValueError("Query must be at least 10 characters")  
        if len(value) \> 10000:  
            raise ValueError("Query must not exceed 10000 characters")  
        *\# Auto-compute hash*  
        self.query\_hash \= hashlib.sha256(value.encode()).hexdigest()  
        return value  
      
    @validates("priority")  
    def validate\_priority(self, key: str, value: int) \-\> int:  
        """Validate priority is in range."""  
        if not 1 \<= value \<= 10:  
            raise ValueError("Priority must be between 1 and 10")  
        return value  
      
    @validates("state")  
    def validate\_state\_transition(self, key: str, new\_state: RunState) \-\> RunState:  
        """Validate state transitions."""  
        if hasattr(self, "\_sa\_instance\_state") and self.\_sa\_instance\_state.persistent:  
            *\# Only validate if this is an update (not insert)*  
            current\_state \= self.state  
            if current\_state and new\_state not in RUN\_TRANSITIONS.get(current\_state, set()):  
                raise ValueError(  
                    f"Invalid state transition from {current\_state} to {new\_state}"  
                )  
        return new\_state  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# METHODS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    def acquire\_lock(  
        self,   
        holder\_id: str,   
        ttl\_seconds: int \= 300  
    ) \-\> Optional\[str\]:  
        """  
        Attempt to acquire a lock on this run.  
          
        Returns lock token if successful, None if already locked.  
        """  
        if self.is\_locked:  
            return None  
          
        self.lock\_token \= str(uuid4())  
        self.lock\_holder\_id \= holder\_id  
        self.lock\_acquired\_at \= datetime.utcnow()  
        self.lock\_expires\_at \= datetime.utcnow() \+ timedelta(seconds\=ttl\_seconds)  
          
        return self.lock\_token  
      
    def release\_lock(self, token: str) \-\> bool:  
        """  
        Release the lock if the token matches.  
          
        Returns True if released, False if token doesn't match.  
        """  
        if self.lock\_token \!= token:  
            return False  
          
        self.lock\_token \= None  
        self.lock\_holder\_id \= None  
        self.lock\_acquired\_at \= None  
        self.lock\_expires\_at \= None  
          
        return True  
      
    def transition\_to(self, new\_state: RunState) \-\> None:  
        """Transition to a new state with validation."""  
        self.previous\_state \= self.state  
        self.state \= new\_state  
        self.state\_version \+= 1  
        self.state\_changed\_at \= datetime.utcnow()  
      
    def to\_dict(self) \-\> Dict\[str, Any\]:  
        """Convert to dictionary representation."""  
        return {  
            "id": self.id,  
            "tenant\_id": self.tenant\_id,  
            "user\_id": self.user\_id,  
            "query": self.query,  
            "state": self.state.value,  
            "state\_version": self.state\_version,  
            "progress": {  
                "total": self.total\_subtasks,  
                "completed": self.completed\_subtasks,  
                "failed": self.failed\_subtasks,  
                "percentage": self.progress\_percentage,  
            },  
            "created\_at": self.created\_at.isoformat() if self.created\_at else None,  
            "started\_at": self.started\_at.isoformat() if self.started\_at else None,  
            "completed\_at": self.completed\_at.isoformat() if self.completed\_at else None,  
            "deadline\_at": self.deadline\_at.isoformat() if self.deadline\_at else None,  
            "duration\_seconds": self.duration\_seconds,  
            "result\_summary": self.result\_summary,  
            "artifacts": self.artifacts,  
            "error": {  
                "code": self.error\_code,  
                "message": self.error\_message,  
            } if self.error\_code else None,  
        }  
      
    def \_\_repr\_\_(self) \-\> str:  
        return f"\<ResearchRun(id={self.id}, state={self.state.value}, progress={self.progress\_percentage}%)\>"

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# SUBTASK MODEL*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class Subtask(Base):  
    """  
    Subtask model representing a unit of work within a research run.  
      
    Subtasks execute independently (respecting dependencies) and  
    report results back to the parent run.  
    """  
      
    \_\_tablename\_\_ \= "subtasks"  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# IDENTITY*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    run\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("research\_runs.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
    index: Mapped\[int\] \= mapped\_column(Integer, nullable\=False)  
    idempotency\_key: Mapped\[str\] \= mapped\_column(String(255), nullable\=False, unique\=True)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# TASK DEFINITION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    task\_type: Mapped\[TaskType\] \= mapped\_column(Enum(TaskType), nullable\=False)  
    entity\_id: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
    input\_data: Mapped\[Dict\[str, Any\]\] \= mapped\_column(JSONB, default\=dict)  
      
    priority: Mapped\[int\] \= mapped\_column(Integer, default\=5)  
    estimated\_duration\_seconds: Mapped\[Optional\[int\]\] \= mapped\_column(Integer)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# STATE MACHINE*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    state: Mapped\[SubtaskState\] \= mapped\_column(  
        Enum(SubtaskState),   
        default\=SubtaskState.PENDING,  
        nullable\=False  
    )  
    state\_version: Mapped\[int\] \= mapped\_column(BigInteger, default\=1, nullable\=False)  
    previous\_state: Mapped\[Optional\[SubtaskState\]\] \= mapped\_column(Enum(SubtaskState))  
    state\_changed\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# EXECUTION TRACKING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    attempt\_count: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    max\_attempts: Mapped\[int\] \= mapped\_column(Integer, default\=3)  
      
    assigned\_worker\_id: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
    assigned\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    heartbeat\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    execution\_token: Mapped\[Optional\[str\]\] \= mapped\_column(UUID(as\_uuid\=False))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# CHECKPOINTING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    checkpoint\_id: Mapped\[Optional\[str\]\] \= mapped\_column(UUID(as\_uuid\=False))  
    checkpoint\_step: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    checkpoint\_data: Mapped\[Optional\[Dict\[str, Any\]\]\] \= mapped\_column(JSONB)  
    checkpoint\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RESULTS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    result\_data: Mapped\[Optional\[Dict\[str, Any\]\]\] \= mapped\_column(JSONB)  
    artifacts: Mapped\[List\[str\]\] \= mapped\_column(ARRAY(Text), default\=list)  
      
    confidence\_score: Mapped\[Optional\[float\]\] \= mapped\_column(Numeric(4, 3))  
    source\_count: Mapped\[Optional\[int\]\] \= mapped\_column(Integer)  
    claim\_count: Mapped\[Optional\[int\]\] \= mapped\_column(Integer)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# ERROR TRACKING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    last\_error\_code: Mapped\[Optional\[str\]\] \= mapped\_column(String(100))  
    last\_error\_message: Mapped\[Optional\[str\]\] \= mapped\_column(Text)  
    last\_error\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    error\_history: Mapped\[List\[Dict\[str, Any\]\]\] \= mapped\_column(JSONB, default\=list)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# TIMING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
    queued\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    started\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
    completed\_at: Mapped\[Optional\[datetime\]\] \= mapped\_column(DateTime(timezone\=True))  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RESOURCE TRACKING*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    llm\_calls\_used: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    web\_requests\_used: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    tokens\_used: Mapped\[int\] \= mapped\_column(BigInteger, default\=0)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# DEPENDENCIES*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    depends\_on: Mapped\[List\[str\]\] \= mapped\_column(ARRAY(UUID(as\_uuid\=False)), default\=list)  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# RELATIONSHIPS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    run: Mapped\["ResearchRun"\] \= relationship(back\_populates\="subtasks")  
    checkpoints: Mapped\[List\["SubtaskCheckpoint"\]\] \= relationship(  
        back\_populates\="subtask",  
        cascade\="all, delete-orphan"  
    )  
    state\_transitions: Mapped\[List\["SubtaskStateTransition"\]\] \= relationship(  
        back\_populates\="subtask",  
        cascade\="all, delete-orphan"  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# TABLE CONFIGURATION*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    \_\_table\_args\_\_ \= (  
        *\# Constraints*  
        UniqueConstraint("run\_id", "index", name\="uq\_subtasks\_run\_index"),  
        CheckConstraint("priority BETWEEN 1 AND 100", name\="chk\_subtasks\_priority"),  
        CheckConstraint("state\_version \> 0", name\="chk\_subtasks\_state\_version"),  
        CheckConstraint("attempt\_count \>= 0", name\="chk\_subtasks\_attempts"),  
        CheckConstraint("checkpoint\_step \>= 0", name\="chk\_subtasks\_checkpoint"),  
        CheckConstraint(  
            "confidence\_score IS NULL OR (confidence\_score \>= 0 AND confidence\_score \<= 1)",  
            name\="chk\_subtasks\_confidence"  
        ),  
          
        *\# Indexes*  
        Index("idx\_subtasks\_run", "run\_id", "index"),  
        Index("idx\_subtasks\_run\_state", "run\_id", "state"),  
        Index(  
            "idx\_subtasks\_pending",  
            "run\_id", "created\_at",  
            postgresql\_where\=(state \== SubtaskState.PENDING)  
        ),  
        Index(  
            "idx\_subtasks\_running",  
            "assigned\_worker\_id", "heartbeat\_at",  
            postgresql\_where\=state.in\_(\[  
                SubtaskState.ASSIGNED,   
                SubtaskState.RUNNING,   
                SubtaskState.CHECKPOINTED  
            \])  
        ),  
        Index(  
            "idx\_subtasks\_heartbeat",  
            "heartbeat\_at",  
            postgresql\_where\=(  
                state.in\_(\[SubtaskState.ASSIGNED, SubtaskState.RUNNING\]) &  
                heartbeat\_at.isnot(None)  
            )  
        ),  
        Index(  
            "idx\_subtasks\_entity",  
            "entity\_id",  
            postgresql\_where\=entity\_id.isnot(None)  
        ),  
    )  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# COMPUTED PROPERTIES*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    @hybrid\_property  
    def is\_terminal(self) \-\> bool:  
        """Check if subtask is in a terminal state."""  
        return self.state in {  
            SubtaskState.COMPLETED,   
            SubtaskState.FAILED,   
            SubtaskState.SKIPPED,   
            SubtaskState.CANCELLED  
        }  
      
    @hybrid\_property  
    def is\_retryable(self) \-\> bool:  
        """Check if subtask can be retried."""  
        return (  
            self.state \== SubtaskState.FAILED and   
            self.attempt\_count \< self.max\_attempts  
        )  
      
    @hybrid\_property  
    def duration\_seconds(self) \-\> Optional\[int\]:  
        """Calculate execution duration in seconds."""  
        if self.started\_at and self.completed\_at:  
            return int((self.completed\_at \- self.started\_at).total\_seconds())  
        return None  
      
    @hybrid\_property  
    def queue\_wait\_seconds(self) \-\> Optional\[int\]:  
        """Calculate time spent waiting in queue."""  
        if self.queued\_at and self.started\_at:  
            return int((self.started\_at \- self.queued\_at).total\_seconds())  
        return None  
      
    @hybrid\_property  
    def is\_stalled(self) \-\> bool:  
        """Check if subtask appears stalled (no recent heartbeat)."""  
        if self.state not in {SubtaskState.ASSIGNED, SubtaskState.RUNNING}:  
            return False  
        if self.heartbeat\_at is None:  
            return True  
        return (datetime.utcnow() \- self.heartbeat\_at).total\_seconds() \> 120  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# VALIDATORS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    @validates("state")  
    def validate\_state\_transition(  
        self,   
        key: str,   
        new\_state: SubtaskState  
    ) \-\> SubtaskState:  
        """Validate state transitions."""  
        if hasattr(self, "\_sa\_instance\_state") and self.\_sa\_instance\_state.persistent:  
            current\_state \= self.state  
            if current\_state and new\_state not in SUBTASK\_TRANSITIONS.get(current\_state, set()):  
                raise ValueError(  
                    f"Invalid state transition from {current\_state} to {new\_state}"  
                )  
        return new\_state  
      
    @validates("confidence\_score")  
    def validate\_confidence(  
        self,   
        key: str,   
        value: Optional\[float\]  
    ) \-\> Optional\[float\]:  
        """Validate confidence score is in range."""  
        if value is not None and not 0 \<= value \<= 1:  
            raise ValueError("Confidence score must be between 0 and 1")  
        return value  
      
    *\# ═══════════════════════════════════════════════════════════════════════════*  
    *\# METHODS*  
    *\# ═══════════════════════════════════════════════════════════════════════════*  
      
    def assign\_to\_worker(self, worker\_id: str) \-\> str:  
        """Assign subtask to a worker and return execution token."""  
        self.assigned\_worker\_id \= worker\_id  
        self.assigned\_at \= datetime.utcnow()  
        self.heartbeat\_at \= datetime.utcnow()  
        self.execution\_token \= str(uuid4())  
        self.transition\_to(SubtaskState.ASSIGNED)  
        return self.execution\_token  
      
    def update\_heartbeat(self) \-\> None:  
        """Update the heartbeat timestamp."""  
        self.heartbeat\_at \= datetime.utcnow()  
      
    def transition\_to(self, new\_state: SubtaskState) \-\> None:  
        """Transition to a new state with validation."""  
        self.previous\_state \= self.state  
        self.state \= new\_state  
        self.state\_version \+= 1  
        self.state\_changed\_at \= datetime.utcnow()  
      
    def record\_error(self, code: str, message: str) \-\> None:  
        """Record an error for this subtask."""  
        error\_entry \= {  
            "code": code,  
            "message": message,  
            "timestamp": datetime.utcnow().isoformat(),  
            "attempt": self.attempt\_count,  
        }  
          
        self.last\_error\_code \= code  
        self.last\_error\_message \= message  
        self.last\_error\_at \= datetime.utcnow()  
          
        *\# Append to history*  
        if self.error\_history is None:  
            self.error\_history \= \[\]  
        self.error\_history \= self.error\_history \+ \[error\_entry\]  
      
    def create\_checkpoint(  
        self,   
        step: int,   
        state\_data: Dict\[str, Any\]  
    ) \-\> None:  
        """Create a checkpoint at the current step."""  
        self.checkpoint\_id \= str(uuid4())  
        self.checkpoint\_step \= step  
        self.checkpoint\_data \= state\_data  
        self.checkpoint\_at \= datetime.utcnow()  
      
    def complete\_with\_result(  
        self,   
        result: Dict\[str, Any\],  
        confidence: Optional\[float\] \= None,  
        artifacts: Optional\[List\[str\]\] \= None  
    ) \-\> None:  
        """Mark subtask as completed with results."""  
        self.result\_data \= result  
        self.confidence\_score \= confidence  
        self.artifacts \= artifacts or \[\]  
        self.completed\_at \= datetime.utcnow()  
        self.transition\_to(SubtaskState.COMPLETED)  
      
    def is\_ready(self, completed\_subtask\_ids: set\[str\]) \-\> bool:  
        """Check if all dependencies are satisfied."""  
        if not self.depends\_on:  
            return True  
        return all(dep\_id in completed\_subtask\_ids for dep\_id in self.depends\_on)  
      
    def to\_dict(self) \-\> Dict\[str, Any\]:  
        """Convert to dictionary representation."""  
        return {  
            "id": self.id,  
            "run\_id": self.run\_id,  
            "index": self.index,  
            "task\_type": self.task\_type.value,  
            "entity\_id": self.entity\_id,  
            "state": self.state.value,  
            "state\_version": self.state\_version,  
            "attempt\_count": self.attempt\_count,  
            "max\_attempts": self.max\_attempts,  
            "assigned\_worker\_id": self.assigned\_worker\_id,  
            "checkpoint\_step": self.checkpoint\_step,  
            "created\_at": self.created\_at.isoformat() if self.created\_at else None,  
            "started\_at": self.started\_at.isoformat() if self.started\_at else None,  
            "completed\_at": self.completed\_at.isoformat() if self.completed\_at else None,  
            "duration\_seconds": self.duration\_seconds,  
            "result\_data": self.result\_data,  
            "confidence\_score": float(self.confidence\_score) if self.confidence\_score else None,  
            "error": {  
                "code": self.last\_error\_code,  
                "message": self.last\_error\_message,  
            } if self.last\_error\_code else None,  
        }  
      
    def \_\_repr\_\_(self) \-\> str:  
        return f"\<Subtask(id={self.id}, type={self.task\_type.value}, state={self.state.value})\>"

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# SUPPORTING MODELS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

class RunStateTransition(Base):  
    """Audit log for run state transitions."""  
      
    \_\_tablename\_\_ \= "run\_state\_transitions"  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    run\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("research\_runs.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
      
    from\_state: Mapped\[Optional\[RunState\]\] \= mapped\_column(Enum(RunState))  
    to\_state: Mapped\[RunState\] \= mapped\_column(Enum(RunState), nullable\=False)  
    state\_version: Mapped\[int\] \= mapped\_column(BigInteger, nullable\=False)  
      
    triggered\_by: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
    trigger\_reason: Mapped\[Optional\[str\]\] \= mapped\_column(Text)  
      
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
      
    run: Mapped\["ResearchRun"\] \= relationship(back\_populates\="state\_transitions")  
      
    \_\_table\_args\_\_ \= (  
        UniqueConstraint("run\_id", "state\_version", name\="uq\_run\_transitions\_version"),  
        Index("idx\_run\_transitions\_run", "run\_id", "created\_at"),  
    )

class SubtaskStateTransition(Base):  
    """Audit log for subtask state transitions."""  
      
    \_\_tablename\_\_ \= "subtask\_state\_transitions"  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    subtask\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("subtasks.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
    run\_id: Mapped\[str\] \= mapped\_column(UUID(as\_uuid\=False), nullable\=False)  
      
    from\_state: Mapped\[Optional\[SubtaskState\]\] \= mapped\_column(Enum(SubtaskState))  
    to\_state: Mapped\[SubtaskState\] \= mapped\_column(Enum(SubtaskState), nullable\=False)  
    state\_version: Mapped\[int\] \= mapped\_column(BigInteger, nullable\=False)  
      
    triggered\_by: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
    trigger\_reason: Mapped\[Optional\[str\]\] \= mapped\_column(Text)  
    worker\_id: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
      
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
      
    subtask: Mapped\["Subtask"\] \= relationship(back\_populates\="state\_transitions")  
      
    \_\_table\_args\_\_ \= (  
        UniqueConstraint("subtask\_id", "state\_version", name\="uq\_subtask\_transitions\_version"),  
        Index("idx\_subtask\_transitions\_subtask", "subtask\_id", "created\_at"),  
        Index("idx\_subtask\_transitions\_run", "run\_id", "created\_at"),  
    )

class SubtaskCheckpoint(Base):  
    """Checkpoint data for subtask recovery."""  
      
    \_\_tablename\_\_ \= "subtask\_checkpoints"  
      
    id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        primary\_key\=True,   
        default\=lambda: str(uuid4())  
    )  
    subtask\_id: Mapped\[str\] \= mapped\_column(  
        UUID(as\_uuid\=False),   
        ForeignKey("subtasks.id", ondelete\="CASCADE"),  
        nullable\=False  
    )  
      
    step: Mapped\[int\] \= mapped\_column(Integer, nullable\=False)  
    step\_name: Mapped\[Optional\[str\]\] \= mapped\_column(String(255))  
      
    state\_data: Mapped\[Dict\[str, Any\]\] \= mapped\_column(JSONB, nullable\=False)  
    intermediate\_results: Mapped\[Optional\[Dict\[str, Any\]\]\] \= mapped\_column(JSONB)  
      
    completed\_operations: Mapped\[List\[str\]\] \= mapped\_column(ARRAY(Text), default\=list)  
    visited\_urls: Mapped\[List\[str\]\] \= mapped\_column(ARRAY(Text), default\=list)  
      
    llm\_calls\_used: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
    web\_requests\_used: Mapped\[int\] \= mapped\_column(Integer, default\=0)  
      
    created\_at: Mapped\[datetime\] \= mapped\_column(  
        DateTime(timezone\=True),   
        default\=func.now()  
    )  
      
    subtask: Mapped\["Subtask"\] \= relationship(back\_populates\="checkpoints")  
      
    \_\_table\_args\_\_ \= (  
        UniqueConstraint("subtask\_id", "step", name\="uq\_checkpoints\_subtask\_step"),  
        Index("idx\_checkpoints\_subtask", "subtask\_id", "step"),  
    )

*\# ═══════════════════════════════════════════════════════════════════════════════*  
*\# EVENT LISTENERS*  
*\# ═══════════════════════════════════════════════════════════════════════════════*

@event.listens\_for(ResearchRun, "before\_update")  
def run\_before\_update(mapper, connection, target):  
    """Track state changes before update."""  
    if target.state \!= target.previous\_state:  
        target.state\_changed\_at \= datetime.utcnow()

@event.listens\_for(Subtask, "before\_update")  
def subtask\_before\_update(mapper, connection, target):  
    """Track state changes before update."""  
    if target.state \!= target.previous\_state:  
        target.state\_changed\_at \= datetime.utcnow()

