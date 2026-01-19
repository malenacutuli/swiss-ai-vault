"""
Goals & OKRs module for SwissBrain.ai collaboration system.

This module provides enterprise goal tracking features including:
- Objectives and Key Results (OKRs)
- Goal alignment and cascading
- Progress tracking and check-ins
- Goal scoring and analytics
- Team and individual goals
"""

from dataclasses import dataclass, field
from datetime import datetime, date, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional, Set
import uuid


class GoalStatus(str, Enum):
    """Status of a goal."""
    DRAFT = "draft"
    ACTIVE = "active"
    ON_TRACK = "on_track"
    AT_RISK = "at_risk"
    BEHIND = "behind"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    DEFERRED = "deferred"


class GoalType(str, Enum):
    """Type of goal."""
    OBJECTIVE = "objective"
    KEY_RESULT = "key_result"
    INITIATIVE = "initiative"
    MILESTONE = "milestone"
    TASK = "task"


class GoalLevel(str, Enum):
    """Level of goal in hierarchy."""
    COMPANY = "company"
    DEPARTMENT = "department"
    TEAM = "team"
    INDIVIDUAL = "individual"


class GoalPriority(str, Enum):
    """Priority of a goal."""
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class GoalPeriod(str, Enum):
    """Time period for goals."""
    WEEKLY = "weekly"
    MONTHLY = "monthly"
    QUARTERLY = "quarterly"
    SEMI_ANNUAL = "semi_annual"
    ANNUAL = "annual"
    CUSTOM = "custom"


class KeyResultType(str, Enum):
    """Type of key result measurement."""
    NUMBER = "number"
    PERCENTAGE = "percentage"
    CURRENCY = "currency"
    BOOLEAN = "boolean"
    MILESTONE = "milestone"


class CheckInStatus(str, Enum):
    """Status of a check-in."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    REVIEWED = "reviewed"


@dataclass
class KeyResult:
    """A key result for measuring objective progress."""
    id: str
    objective_id: str
    title: str
    owner_id: str
    result_type: KeyResultType = KeyResultType.PERCENTAGE
    start_value: float = 0.0
    target_value: float = 100.0
    current_value: float = 0.0
    unit: str = ""
    weight: float = 1.0
    description: str = ""
    status: GoalStatus = GoalStatus.ACTIVE
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None

    @property
    def progress(self) -> float:
        """Calculate progress percentage."""
        if self.result_type == KeyResultType.BOOLEAN:
            return 100.0 if self.current_value >= 1.0 else 0.0

        if self.target_value == self.start_value:
            return 100.0 if self.current_value >= self.target_value else 0.0

        progress = ((self.current_value - self.start_value) /
                    (self.target_value - self.start_value)) * 100
        return max(0.0, min(100.0, progress))

    @property
    def is_complete(self) -> bool:
        """Check if key result is complete."""
        if self.result_type == KeyResultType.BOOLEAN:
            return self.current_value >= 1.0
        return self.current_value >= self.target_value

    def update_value(self, value: float) -> None:
        """Update the current value."""
        self.current_value = value
        self.updated_at = datetime.utcnow()

        if self.is_complete and not self.completed_at:
            self.completed_at = datetime.utcnow()
            self.status = GoalStatus.COMPLETED

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "objective_id": self.objective_id,
            "title": self.title,
            "owner_id": self.owner_id,
            "result_type": self.result_type.value,
            "start_value": self.start_value,
            "target_value": self.target_value,
            "current_value": self.current_value,
            "unit": self.unit,
            "weight": self.weight,
            "description": self.description,
            "status": self.status.value,
            "progress": self.progress,
            "is_complete": self.is_complete,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class Goal:
    """A goal or objective."""
    id: str
    title: str
    owner_id: str
    goal_type: GoalType = GoalType.OBJECTIVE
    level: GoalLevel = GoalLevel.INDIVIDUAL
    status: GoalStatus = GoalStatus.DRAFT
    priority: GoalPriority = GoalPriority.MEDIUM
    period: GoalPeriod = GoalPeriod.QUARTERLY
    description: str = ""
    workspace_id: Optional[str] = None
    team_id: Optional[str] = None
    parent_id: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    progress: float = 0.0
    score: Optional[float] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    tags: Set[str] = field(default_factory=set)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def activate(self) -> None:
        """Activate the goal."""
        self.status = GoalStatus.ACTIVE
        self.updated_at = datetime.utcnow()

    def complete(self, score: Optional[float] = None) -> None:
        """Mark goal as completed."""
        self.status = GoalStatus.COMPLETED
        self.completed_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()
        if score is not None:
            self.score = score

    def cancel(self) -> None:
        """Cancel the goal."""
        self.status = GoalStatus.CANCELLED
        self.updated_at = datetime.utcnow()

    def defer(self) -> None:
        """Defer the goal."""
        self.status = GoalStatus.DEFERRED
        self.updated_at = datetime.utcnow()

    def update_progress(self, progress: float) -> None:
        """Update progress and status."""
        self.progress = max(0.0, min(100.0, progress))
        self.updated_at = datetime.utcnow()

        if self.progress >= 100.0:
            self.status = GoalStatus.COMPLETED
            if not self.completed_at:
                self.completed_at = datetime.utcnow()
        elif self.progress >= 70.0:
            self.status = GoalStatus.ON_TRACK
        elif self.progress >= 40.0:
            self.status = GoalStatus.AT_RISK
        elif self.status not in (GoalStatus.DRAFT, GoalStatus.CANCELLED, GoalStatus.DEFERRED):
            self.status = GoalStatus.BEHIND

    @property
    def is_overdue(self) -> bool:
        """Check if goal is overdue."""
        if self.end_date and self.status not in (GoalStatus.COMPLETED, GoalStatus.CANCELLED):
            return date.today() > self.end_date
        return False

    @property
    def days_remaining(self) -> Optional[int]:
        """Get days remaining until due date."""
        if self.end_date:
            delta = self.end_date - date.today()
            return delta.days
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "title": self.title,
            "owner_id": self.owner_id,
            "goal_type": self.goal_type.value,
            "level": self.level.value,
            "status": self.status.value,
            "priority": self.priority.value,
            "period": self.period.value,
            "description": self.description,
            "workspace_id": self.workspace_id,
            "team_id": self.team_id,
            "parent_id": self.parent_id,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "progress": self.progress,
            "score": self.score,
            "is_overdue": self.is_overdue,
            "days_remaining": self.days_remaining,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "tags": list(self.tags),
            "metadata": self.metadata,
        }


@dataclass
class CheckIn:
    """A progress check-in for a goal."""
    id: str
    goal_id: str
    author_id: str
    status: CheckInStatus = CheckInStatus.DRAFT
    progress: Optional[float] = None
    confidence: Optional[float] = None
    notes: str = ""
    blockers: str = ""
    next_steps: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    reviewed_by: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    key_result_updates: Dict[str, float] = field(default_factory=dict)

    def submit(self) -> None:
        """Submit the check-in."""
        self.status = CheckInStatus.SUBMITTED
        self.submitted_at = datetime.utcnow()

    def review(self, reviewer_id: str) -> None:
        """Mark check-in as reviewed."""
        self.status = CheckInStatus.REVIEWED
        self.reviewed_by = reviewer_id
        self.reviewed_at = datetime.utcnow()

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "goal_id": self.goal_id,
            "author_id": self.author_id,
            "status": self.status.value,
            "progress": self.progress,
            "confidence": self.confidence,
            "notes": self.notes,
            "blockers": self.blockers,
            "next_steps": self.next_steps,
            "created_at": self.created_at.isoformat(),
            "submitted_at": self.submitted_at.isoformat() if self.submitted_at else None,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "key_result_updates": self.key_result_updates,
        }


@dataclass
class GoalAlignment:
    """Alignment between goals."""
    id: str
    source_goal_id: str
    target_goal_id: str
    alignment_type: str = "supports"
    weight: float = 1.0
    description: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    created_by: str = ""

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "source_goal_id": self.source_goal_id,
            "target_goal_id": self.target_goal_id,
            "alignment_type": self.alignment_type,
            "weight": self.weight,
            "description": self.description,
            "created_at": self.created_at.isoformat(),
            "created_by": self.created_by,
        }


@dataclass
class GoalCycle:
    """A goal cycle/period."""
    id: str
    name: str
    period: GoalPeriod
    start_date: date
    end_date: date
    workspace_id: Optional[str] = None
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)

    @property
    def is_current(self) -> bool:
        """Check if cycle is current."""
        today = date.today()
        return self.start_date <= today <= self.end_date

    @property
    def progress_percentage(self) -> float:
        """Get cycle progress percentage."""
        today = date.today()
        if today < self.start_date:
            return 0.0
        if today > self.end_date:
            return 100.0

        total_days = (self.end_date - self.start_date).days
        elapsed_days = (today - self.start_date).days

        if total_days > 0:
            return (elapsed_days / total_days) * 100
        return 100.0

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "period": self.period.value,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat(),
            "workspace_id": self.workspace_id,
            "is_active": self.is_active,
            "is_current": self.is_current,
            "progress_percentage": self.progress_percentage,
            "created_at": self.created_at.isoformat(),
        }


class GoalRegistry:
    """Registry for goal entities."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._goals: Dict[str, Goal] = {}
        self._key_results: Dict[str, List[KeyResult]] = {}
        self._check_ins: Dict[str, List[CheckIn]] = {}
        self._alignments: Dict[str, GoalAlignment] = {}
        self._cycles: Dict[str, GoalCycle] = {}

    # Goal CRUD
    def create_goal(
        self,
        title: str,
        owner_id: str,
        goal_type: GoalType = GoalType.OBJECTIVE,
        level: GoalLevel = GoalLevel.INDIVIDUAL,
        priority: GoalPriority = GoalPriority.MEDIUM,
        period: GoalPeriod = GoalPeriod.QUARTERLY,
        description: str = "",
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tags: Optional[Set[str]] = None,
    ) -> Goal:
        """Create a goal."""
        goal_id = str(uuid.uuid4())
        goal = Goal(
            id=goal_id,
            title=title,
            owner_id=owner_id,
            goal_type=goal_type,
            level=level,
            priority=priority,
            period=period,
            description=description,
            workspace_id=workspace_id,
            team_id=team_id,
            parent_id=parent_id,
            start_date=start_date,
            end_date=end_date,
            tags=tags or set(),
        )

        self._goals[goal_id] = goal
        self._key_results[goal_id] = []
        self._check_ins[goal_id] = []

        return goal

    def get_goal(self, goal_id: str) -> Optional[Goal]:
        """Get a goal by ID."""
        return self._goals.get(goal_id)

    def update_goal(
        self,
        goal_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        priority: Optional[GoalPriority] = None,
        status: Optional[GoalStatus] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        tags: Optional[Set[str]] = None,
    ) -> Optional[Goal]:
        """Update a goal."""
        goal = self._goals.get(goal_id)
        if not goal:
            return None

        if title is not None:
            goal.title = title
        if description is not None:
            goal.description = description
        if priority is not None:
            goal.priority = priority
        if status is not None:
            goal.status = status
        if start_date is not None:
            goal.start_date = start_date
        if end_date is not None:
            goal.end_date = end_date
        if tags is not None:
            goal.tags = tags

        goal.updated_at = datetime.utcnow()
        return goal

    def delete_goal(self, goal_id: str) -> bool:
        """Delete a goal."""
        if goal_id not in self._goals:
            return False

        del self._goals[goal_id]
        self._key_results.pop(goal_id, None)
        self._check_ins.pop(goal_id, None)

        # Remove alignments
        to_remove = [
            aid for aid, a in self._alignments.items()
            if a.source_goal_id == goal_id or a.target_goal_id == goal_id
        ]
        for aid in to_remove:
            del self._alignments[aid]

        return True

    def activate_goal(self, goal_id: str) -> Optional[Goal]:
        """Activate a goal."""
        goal = self._goals.get(goal_id)
        if goal:
            goal.activate()
        return goal

    def complete_goal(self, goal_id: str, score: Optional[float] = None) -> Optional[Goal]:
        """Complete a goal."""
        goal = self._goals.get(goal_id)
        if goal:
            goal.complete(score)
        return goal

    def list_goals(
        self,
        owner_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        goal_type: Optional[GoalType] = None,
        level: Optional[GoalLevel] = None,
        status: Optional[GoalStatus] = None,
        parent_id: Optional[str] = None,
        period: Optional[GoalPeriod] = None,
        tags: Optional[Set[str]] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> List[Goal]:
        """List goals with filters."""
        goals = list(self._goals.values())

        if owner_id:
            goals = [g for g in goals if g.owner_id == owner_id]
        if workspace_id:
            goals = [g for g in goals if g.workspace_id == workspace_id]
        if team_id:
            goals = [g for g in goals if g.team_id == team_id]
        if goal_type:
            goals = [g for g in goals if g.goal_type == goal_type]
        if level:
            goals = [g for g in goals if g.level == level]
        if status:
            goals = [g for g in goals if g.status == status]
        if parent_id:
            goals = [g for g in goals if g.parent_id == parent_id]
        if period:
            goals = [g for g in goals if g.period == period]
        if tags:
            goals = [g for g in goals if tags & g.tags]

        goals.sort(key=lambda g: g.created_at, reverse=True)
        return goals[offset:offset + limit]

    def get_child_goals(self, parent_id: str) -> List[Goal]:
        """Get child goals of a parent."""
        return [g for g in self._goals.values() if g.parent_id == parent_id]

    def get_goal_tree(self, goal_id: str) -> Dict[str, Any]:
        """Get goal with its children as a tree."""
        goal = self._goals.get(goal_id)
        if not goal:
            return {}

        children = self.get_child_goals(goal_id)
        key_results = self._key_results.get(goal_id, [])

        return {
            "goal": goal.to_dict(),
            "key_results": [kr.to_dict() for kr in key_results],
            "children": [self.get_goal_tree(c.id) for c in children],
        }

    # Key Result methods
    def add_key_result(
        self,
        objective_id: str,
        title: str,
        owner_id: str,
        result_type: KeyResultType = KeyResultType.PERCENTAGE,
        start_value: float = 0.0,
        target_value: float = 100.0,
        unit: str = "",
        weight: float = 1.0,
        description: str = "",
        due_date: Optional[date] = None,
    ) -> Optional[KeyResult]:
        """Add a key result to an objective."""
        if objective_id not in self._goals:
            return None

        kr_id = str(uuid.uuid4())
        key_result = KeyResult(
            id=kr_id,
            objective_id=objective_id,
            title=title,
            owner_id=owner_id,
            result_type=result_type,
            start_value=start_value,
            target_value=target_value,
            unit=unit,
            weight=weight,
            description=description,
            due_date=due_date,
        )

        self._key_results[objective_id].append(key_result)
        self._recalculate_goal_progress(objective_id)

        return key_result

    def get_key_result(self, objective_id: str, kr_id: str) -> Optional[KeyResult]:
        """Get a key result by ID."""
        key_results = self._key_results.get(objective_id, [])
        for kr in key_results:
            if kr.id == kr_id:
                return kr
        return None

    def update_key_result_value(
        self,
        objective_id: str,
        kr_id: str,
        value: float,
    ) -> Optional[KeyResult]:
        """Update a key result value."""
        kr = self.get_key_result(objective_id, kr_id)
        if not kr:
            return None

        kr.update_value(value)
        self._recalculate_goal_progress(objective_id)

        return kr

    def delete_key_result(self, objective_id: str, kr_id: str) -> bool:
        """Delete a key result."""
        key_results = self._key_results.get(objective_id, [])
        for i, kr in enumerate(key_results):
            if kr.id == kr_id:
                del key_results[i]
                self._recalculate_goal_progress(objective_id)
                return True
        return False

    def get_key_results(self, objective_id: str) -> List[KeyResult]:
        """Get all key results for an objective."""
        return self._key_results.get(objective_id, [])

    def _recalculate_goal_progress(self, goal_id: str) -> None:
        """Recalculate goal progress from key results."""
        goal = self._goals.get(goal_id)
        if not goal:
            return

        key_results = self._key_results.get(goal_id, [])
        if not key_results:
            return

        total_weight = sum(kr.weight for kr in key_results)
        if total_weight == 0:
            return

        weighted_progress = sum(
            kr.progress * kr.weight for kr in key_results
        )
        progress = weighted_progress / total_weight

        goal.update_progress(progress)

    # Check-in methods
    def create_check_in(
        self,
        goal_id: str,
        author_id: str,
        progress: Optional[float] = None,
        confidence: Optional[float] = None,
        notes: str = "",
        blockers: str = "",
        next_steps: str = "",
        key_result_updates: Optional[Dict[str, float]] = None,
    ) -> Optional[CheckIn]:
        """Create a check-in for a goal."""
        if goal_id not in self._goals:
            return None

        check_in_id = str(uuid.uuid4())
        check_in = CheckIn(
            id=check_in_id,
            goal_id=goal_id,
            author_id=author_id,
            progress=progress,
            confidence=confidence,
            notes=notes,
            blockers=blockers,
            next_steps=next_steps,
            key_result_updates=key_result_updates or {},
        )

        self._check_ins[goal_id].append(check_in)

        # Apply key result updates
        for kr_id, value in (key_result_updates or {}).items():
            self.update_key_result_value(goal_id, kr_id, value)

        # Update goal progress if provided
        if progress is not None:
            goal = self._goals.get(goal_id)
            if goal:
                goal.update_progress(progress)

        return check_in

    def get_check_in(self, goal_id: str, check_in_id: str) -> Optional[CheckIn]:
        """Get a check-in by ID."""
        check_ins = self._check_ins.get(goal_id, [])
        for ci in check_ins:
            if ci.id == check_in_id:
                return ci
        return None

    def submit_check_in(self, goal_id: str, check_in_id: str) -> Optional[CheckIn]:
        """Submit a check-in."""
        check_in = self.get_check_in(goal_id, check_in_id)
        if check_in:
            check_in.submit()
        return check_in

    def review_check_in(self, goal_id: str, check_in_id: str, reviewer_id: str) -> Optional[CheckIn]:
        """Review a check-in."""
        check_in = self.get_check_in(goal_id, check_in_id)
        if check_in:
            check_in.review(reviewer_id)
        return check_in

    def get_check_ins(
        self,
        goal_id: str,
        status: Optional[CheckInStatus] = None,
        limit: int = 50,
    ) -> List[CheckIn]:
        """Get check-ins for a goal."""
        check_ins = self._check_ins.get(goal_id, [])

        if status:
            check_ins = [ci for ci in check_ins if ci.status == status]

        check_ins.sort(key=lambda c: c.created_at, reverse=True)
        return check_ins[:limit]

    def get_latest_check_in(self, goal_id: str) -> Optional[CheckIn]:
        """Get the latest check-in for a goal."""
        check_ins = self._check_ins.get(goal_id, [])
        if check_ins:
            return max(check_ins, key=lambda c: c.created_at)
        return None

    # Alignment methods
    def create_alignment(
        self,
        source_goal_id: str,
        target_goal_id: str,
        alignment_type: str = "supports",
        weight: float = 1.0,
        description: str = "",
        created_by: str = "",
    ) -> Optional[GoalAlignment]:
        """Create an alignment between goals."""
        if source_goal_id not in self._goals or target_goal_id not in self._goals:
            return None

        alignment_id = str(uuid.uuid4())
        alignment = GoalAlignment(
            id=alignment_id,
            source_goal_id=source_goal_id,
            target_goal_id=target_goal_id,
            alignment_type=alignment_type,
            weight=weight,
            description=description,
            created_by=created_by,
        )

        self._alignments[alignment_id] = alignment
        return alignment

    def get_alignment(self, alignment_id: str) -> Optional[GoalAlignment]:
        """Get an alignment by ID."""
        return self._alignments.get(alignment_id)

    def delete_alignment(self, alignment_id: str) -> bool:
        """Delete an alignment."""
        if alignment_id in self._alignments:
            del self._alignments[alignment_id]
            return True
        return False

    def get_alignments_from(self, goal_id: str) -> List[GoalAlignment]:
        """Get alignments from a goal."""
        return [a for a in self._alignments.values() if a.source_goal_id == goal_id]

    def get_alignments_to(self, goal_id: str) -> List[GoalAlignment]:
        """Get alignments to a goal."""
        return [a for a in self._alignments.values() if a.target_goal_id == goal_id]

    def get_aligned_goals(self, goal_id: str) -> List[Goal]:
        """Get goals aligned to a goal."""
        alignments = self.get_alignments_to(goal_id)
        goal_ids = [a.source_goal_id for a in alignments]
        return [g for g in self._goals.values() if g.id in goal_ids]

    # Cycle methods
    def create_cycle(
        self,
        name: str,
        period: GoalPeriod,
        start_date: date,
        end_date: date,
        workspace_id: Optional[str] = None,
    ) -> GoalCycle:
        """Create a goal cycle."""
        cycle_id = str(uuid.uuid4())
        cycle = GoalCycle(
            id=cycle_id,
            name=name,
            period=period,
            start_date=start_date,
            end_date=end_date,
            workspace_id=workspace_id,
        )

        self._cycles[cycle_id] = cycle
        return cycle

    def get_cycle(self, cycle_id: str) -> Optional[GoalCycle]:
        """Get a cycle by ID."""
        return self._cycles.get(cycle_id)

    def get_current_cycle(self, workspace_id: Optional[str] = None) -> Optional[GoalCycle]:
        """Get the current active cycle."""
        for cycle in self._cycles.values():
            if cycle.is_current and cycle.is_active:
                if workspace_id is None or cycle.workspace_id == workspace_id:
                    return cycle
        return None

    def list_cycles(
        self,
        workspace_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[GoalCycle]:
        """List cycles."""
        cycles = list(self._cycles.values())

        if workspace_id:
            cycles = [c for c in cycles if c.workspace_id == workspace_id]
        if is_active is not None:
            cycles = [c for c in cycles if c.is_active == is_active]

        cycles.sort(key=lambda c: c.start_date, reverse=True)
        return cycles

    # Statistics
    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
        team_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get goal statistics."""
        goals = self.list_goals(
            workspace_id=workspace_id,
            owner_id=owner_id,
            team_id=team_id,
        )

        total_progress = sum(g.progress for g in goals)
        avg_progress = total_progress / len(goals) if goals else 0

        status_counts = {}
        for status in GoalStatus:
            status_counts[status.value] = len([g for g in goals if g.status == status])

        level_counts = {}
        for level in GoalLevel:
            level_counts[level.value] = len([g for g in goals if g.level == level])

        completed = [g for g in goals if g.status == GoalStatus.COMPLETED]
        completion_rate = (len(completed) / len(goals) * 100) if goals else 0

        overdue = len([g for g in goals if g.is_overdue])

        return {
            "total_goals": len(goals),
            "average_progress": avg_progress,
            "completion_rate": completion_rate,
            "goals_by_status": status_counts,
            "goals_by_level": level_counts,
            "overdue_goals": overdue,
            "completed_goals": len(completed),
            "active_goals": status_counts.get(GoalStatus.ACTIVE.value, 0),
        }


class GoalManager:
    """High-level API for goal operations."""

    def __init__(self, registry: Optional[GoalRegistry] = None) -> None:
        """Initialize the manager."""
        self._registry = registry or GoalRegistry()

    @property
    def registry(self) -> GoalRegistry:
        """Get the registry."""
        return self._registry

    # Goal methods
    def create_objective(
        self,
        title: str,
        owner_id: str,
        description: str = "",
        level: GoalLevel = GoalLevel.INDIVIDUAL,
        period: GoalPeriod = GoalPeriod.QUARTERLY,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Goal:
        """Create an objective."""
        return self._registry.create_goal(
            title=title,
            owner_id=owner_id,
            goal_type=GoalType.OBJECTIVE,
            level=level,
            period=period,
            description=description,
            workspace_id=workspace_id,
            team_id=team_id,
            start_date=start_date,
            end_date=end_date,
        )

    def create_company_objective(
        self,
        title: str,
        owner_id: str,
        description: str = "",
        workspace_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Goal:
        """Create a company-level objective."""
        return self.create_objective(
            title=title,
            owner_id=owner_id,
            description=description,
            level=GoalLevel.COMPANY,
            workspace_id=workspace_id,
            start_date=start_date,
            end_date=end_date,
        )

    def create_team_objective(
        self,
        title: str,
        owner_id: str,
        team_id: str,
        description: str = "",
        parent_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Goal:
        """Create a team-level objective."""
        goal = self._registry.create_goal(
            title=title,
            owner_id=owner_id,
            goal_type=GoalType.OBJECTIVE,
            level=GoalLevel.TEAM,
            description=description,
            workspace_id=workspace_id,
            team_id=team_id,
            parent_id=parent_id,
            start_date=start_date,
            end_date=end_date,
        )

        if parent_id:
            self._registry.create_alignment(
                source_goal_id=goal.id,
                target_goal_id=parent_id,
                alignment_type="supports",
                created_by=owner_id,
            )

        return goal

    def create_individual_objective(
        self,
        title: str,
        owner_id: str,
        description: str = "",
        parent_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> Goal:
        """Create an individual-level objective."""
        goal = self._registry.create_goal(
            title=title,
            owner_id=owner_id,
            goal_type=GoalType.OBJECTIVE,
            level=GoalLevel.INDIVIDUAL,
            description=description,
            workspace_id=workspace_id,
            parent_id=parent_id,
            start_date=start_date,
            end_date=end_date,
        )

        if parent_id:
            self._registry.create_alignment(
                source_goal_id=goal.id,
                target_goal_id=parent_id,
                alignment_type="supports",
                created_by=owner_id,
            )

        return goal

    def get_goal(self, goal_id: str) -> Optional[Goal]:
        """Get a goal."""
        return self._registry.get_goal(goal_id)

    def update_goal(
        self,
        goal_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        priority: Optional[GoalPriority] = None,
    ) -> Optional[Goal]:
        """Update a goal."""
        return self._registry.update_goal(
            goal_id, title, description, priority
        )

    def delete_goal(self, goal_id: str) -> bool:
        """Delete a goal."""
        return self._registry.delete_goal(goal_id)

    def activate_goal(self, goal_id: str) -> Optional[Goal]:
        """Activate a goal."""
        return self._registry.activate_goal(goal_id)

    def complete_goal(self, goal_id: str, score: Optional[float] = None) -> Optional[Goal]:
        """Complete a goal."""
        return self._registry.complete_goal(goal_id, score)

    def list_goals(
        self,
        owner_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
        team_id: Optional[str] = None,
        status: Optional[GoalStatus] = None,
    ) -> List[Goal]:
        """List goals."""
        return self._registry.list_goals(
            owner_id=owner_id,
            workspace_id=workspace_id,
            team_id=team_id,
            status=status,
        )

    def list_objectives(
        self,
        owner_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> List[Goal]:
        """List objectives."""
        return self._registry.list_goals(
            owner_id=owner_id,
            workspace_id=workspace_id,
            goal_type=GoalType.OBJECTIVE,
        )

    def get_my_goals(self, user_id: str) -> List[Goal]:
        """Get goals for a user."""
        return self._registry.list_goals(owner_id=user_id)

    def get_team_goals(self, team_id: str) -> List[Goal]:
        """Get goals for a team."""
        return self._registry.list_goals(team_id=team_id)

    def get_goal_tree(self, goal_id: str) -> Dict[str, Any]:
        """Get goal tree with children."""
        return self._registry.get_goal_tree(goal_id)

    # Key Result methods
    def add_key_result(
        self,
        objective_id: str,
        title: str,
        owner_id: str,
        target_value: float = 100.0,
        result_type: KeyResultType = KeyResultType.PERCENTAGE,
        unit: str = "",
        due_date: Optional[date] = None,
    ) -> Optional[KeyResult]:
        """Add a key result to an objective."""
        return self._registry.add_key_result(
            objective_id=objective_id,
            title=title,
            owner_id=owner_id,
            result_type=result_type,
            target_value=target_value,
            unit=unit,
            due_date=due_date,
        )

    def add_numeric_key_result(
        self,
        objective_id: str,
        title: str,
        owner_id: str,
        start_value: float,
        target_value: float,
        unit: str = "",
    ) -> Optional[KeyResult]:
        """Add a numeric key result."""
        return self._registry.add_key_result(
            objective_id=objective_id,
            title=title,
            owner_id=owner_id,
            result_type=KeyResultType.NUMBER,
            start_value=start_value,
            target_value=target_value,
            unit=unit,
        )

    def add_percentage_key_result(
        self,
        objective_id: str,
        title: str,
        owner_id: str,
        target_value: float = 100.0,
    ) -> Optional[KeyResult]:
        """Add a percentage key result."""
        return self._registry.add_key_result(
            objective_id=objective_id,
            title=title,
            owner_id=owner_id,
            result_type=KeyResultType.PERCENTAGE,
            target_value=target_value,
        )

    def add_boolean_key_result(
        self,
        objective_id: str,
        title: str,
        owner_id: str,
    ) -> Optional[KeyResult]:
        """Add a boolean (yes/no) key result."""
        return self._registry.add_key_result(
            objective_id=objective_id,
            title=title,
            owner_id=owner_id,
            result_type=KeyResultType.BOOLEAN,
            start_value=0.0,
            target_value=1.0,
        )

    def update_key_result(
        self,
        objective_id: str,
        kr_id: str,
        value: float,
    ) -> Optional[KeyResult]:
        """Update a key result value."""
        return self._registry.update_key_result_value(objective_id, kr_id, value)

    def complete_key_result(
        self,
        objective_id: str,
        kr_id: str,
    ) -> Optional[KeyResult]:
        """Mark a boolean key result as complete."""
        return self._registry.update_key_result_value(objective_id, kr_id, 1.0)

    def get_key_results(self, objective_id: str) -> List[KeyResult]:
        """Get key results for an objective."""
        return self._registry.get_key_results(objective_id)

    # Check-in methods
    def create_check_in(
        self,
        goal_id: str,
        author_id: str,
        progress: Optional[float] = None,
        confidence: Optional[float] = None,
        notes: str = "",
        blockers: str = "",
    ) -> Optional[CheckIn]:
        """Create a check-in."""
        return self._registry.create_check_in(
            goal_id=goal_id,
            author_id=author_id,
            progress=progress,
            confidence=confidence,
            notes=notes,
            blockers=blockers,
        )

    def update_progress(
        self,
        goal_id: str,
        author_id: str,
        progress: float,
        notes: str = "",
    ) -> Optional[CheckIn]:
        """Quick progress update via check-in."""
        check_in = self._registry.create_check_in(
            goal_id=goal_id,
            author_id=author_id,
            progress=progress,
            notes=notes,
        )
        if check_in:
            check_in.submit()
        return check_in

    def submit_check_in(self, goal_id: str, check_in_id: str) -> Optional[CheckIn]:
        """Submit a check-in."""
        return self._registry.submit_check_in(goal_id, check_in_id)

    def get_check_ins(self, goal_id: str) -> List[CheckIn]:
        """Get check-ins for a goal."""
        return self._registry.get_check_ins(goal_id)

    def get_latest_check_in(self, goal_id: str) -> Optional[CheckIn]:
        """Get latest check-in."""
        return self._registry.get_latest_check_in(goal_id)

    # Alignment methods
    def align_goal(
        self,
        goal_id: str,
        parent_goal_id: str,
        alignment_type: str = "supports",
        created_by: str = "",
    ) -> Optional[GoalAlignment]:
        """Align a goal to a parent goal."""
        return self._registry.create_alignment(
            source_goal_id=goal_id,
            target_goal_id=parent_goal_id,
            alignment_type=alignment_type,
            created_by=created_by,
        )

    def get_aligned_goals(self, goal_id: str) -> List[Goal]:
        """Get goals aligned to a goal."""
        return self._registry.get_aligned_goals(goal_id)

    def get_parent_goals(self, goal_id: str) -> List[Goal]:
        """Get parent goals."""
        alignments = self._registry.get_alignments_from(goal_id)
        parent_ids = [a.target_goal_id for a in alignments]
        return [g for g in self._registry._goals.values() if g.id in parent_ids]

    # Cycle methods
    def create_quarterly_cycle(
        self,
        name: str,
        start_date: date,
        workspace_id: Optional[str] = None,
    ) -> GoalCycle:
        """Create a quarterly cycle."""
        end_date = date(
            start_date.year + (start_date.month + 2) // 12,
            ((start_date.month + 2) % 12) + 1,
            1
        ) - timedelta(days=1)

        return self._registry.create_cycle(
            name=name,
            period=GoalPeriod.QUARTERLY,
            start_date=start_date,
            end_date=end_date,
            workspace_id=workspace_id,
        )

    def create_annual_cycle(
        self,
        year: int,
        workspace_id: Optional[str] = None,
    ) -> GoalCycle:
        """Create an annual cycle."""
        return self._registry.create_cycle(
            name=f"FY{year}",
            period=GoalPeriod.ANNUAL,
            start_date=date(year, 1, 1),
            end_date=date(year, 12, 31),
            workspace_id=workspace_id,
        )

    def get_current_cycle(self, workspace_id: Optional[str] = None) -> Optional[GoalCycle]:
        """Get current cycle."""
        return self._registry.get_current_cycle(workspace_id)

    def list_cycles(self, workspace_id: Optional[str] = None) -> List[GoalCycle]:
        """List cycles."""
        return self._registry.list_cycles(workspace_id)

    # Summary methods
    def get_goal_summary(self, goal_id: str) -> Dict[str, Any]:
        """Get goal summary with key results and check-ins."""
        goal = self._registry.get_goal(goal_id)
        if not goal:
            return {}

        key_results = self._registry.get_key_results(goal_id)
        check_ins = self._registry.get_check_ins(goal_id, limit=5)
        latest_check_in = self._registry.get_latest_check_in(goal_id)
        aligned_goals = self._registry.get_aligned_goals(goal_id)
        child_goals = self._registry.get_child_goals(goal_id)

        return {
            "goal": goal.to_dict(),
            "key_results": [kr.to_dict() for kr in key_results],
            "recent_check_ins": [ci.to_dict() for ci in check_ins],
            "latest_check_in": latest_check_in.to_dict() if latest_check_in else None,
            "aligned_goals_count": len(aligned_goals),
            "child_goals_count": len(child_goals),
        }

    def get_okr_summary(
        self,
        owner_id: Optional[str] = None,
        workspace_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get OKR summary."""
        objectives = self._registry.list_goals(
            owner_id=owner_id,
            workspace_id=workspace_id,
            goal_type=GoalType.OBJECTIVE,
        )

        total_key_results = 0
        completed_key_results = 0
        total_progress = 0

        for obj in objectives:
            key_results = self._registry.get_key_results(obj.id)
            total_key_results += len(key_results)
            completed_key_results += len([kr for kr in key_results if kr.is_complete])
            total_progress += obj.progress

        avg_progress = total_progress / len(objectives) if objectives else 0

        return {
            "total_objectives": len(objectives),
            "total_key_results": total_key_results,
            "completed_key_results": completed_key_results,
            "average_progress": avg_progress,
            "objectives_on_track": len([o for o in objectives if o.status == GoalStatus.ON_TRACK]),
            "objectives_at_risk": len([o for o in objectives if o.status == GoalStatus.AT_RISK]),
            "objectives_behind": len([o for o in objectives if o.status == GoalStatus.BEHIND]),
        }

    def get_stats(
        self,
        workspace_id: Optional[str] = None,
        owner_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Get statistics."""
        return self._registry.get_stats(workspace_id=workspace_id, owner_id=owner_id)


# Global instance management
_goal_manager: Optional[GoalManager] = None


def get_goal_manager() -> GoalManager:
    """Get the global goal manager instance."""
    global _goal_manager
    if _goal_manager is None:
        _goal_manager = GoalManager()
    return _goal_manager


def set_goal_manager(manager: GoalManager) -> None:
    """Set the global goal manager instance."""
    global _goal_manager
    _goal_manager = manager


def reset_goal_manager() -> None:
    """Reset the global goal manager instance."""
    global _goal_manager
    _goal_manager = None
