"""
Feedback & Performance Reviews module for enterprise collaboration.

This module provides comprehensive feedback and performance review management including:
- Performance reviews with customizable templates
- Review cycles (quarterly, annual, etc.)
- 360-degree feedback (self, peer, manager, direct reports)
- Continuous feedback and recognition
- Goal alignment with reviews
- Competency assessments
- Calibration sessions
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class ReviewType(Enum):
    """Types of performance reviews."""
    ANNUAL = "annual"
    SEMI_ANNUAL = "semi_annual"
    QUARTERLY = "quarterly"
    PROBATION = "probation"
    PROJECT = "project"
    PROMOTION = "promotion"
    PIP = "pip"  # Performance Improvement Plan
    SELF_ASSESSMENT = "self_assessment"
    PEER_REVIEW = "peer_review"
    MANAGER_REVIEW = "manager_review"
    UPWARD_REVIEW = "upward_review"
    THREE_SIXTY = "360_degree"


class ReviewStatus(Enum):
    """Status of a review."""
    DRAFT = "draft"
    IN_PROGRESS = "in_progress"
    PENDING_SELF = "pending_self"
    PENDING_MANAGER = "pending_manager"
    PENDING_CALIBRATION = "pending_calibration"
    COMPLETED = "completed"
    ACKNOWLEDGED = "acknowledged"
    CANCELLED = "cancelled"


class FeedbackType(Enum):
    """Types of feedback."""
    PRAISE = "praise"
    CONSTRUCTIVE = "constructive"
    SUGGESTION = "suggestion"
    RECOGNITION = "recognition"
    CONCERN = "concern"
    GENERAL = "general"


class FeedbackVisibility(Enum):
    """Visibility settings for feedback."""
    PUBLIC = "public"
    PRIVATE = "private"
    MANAGER_ONLY = "manager_only"
    HR_ONLY = "hr_only"
    ANONYMOUS = "anonymous"


class RatingScale(Enum):
    """Rating scale types."""
    NUMERIC_5 = "numeric_5"  # 1-5
    NUMERIC_10 = "numeric_10"  # 1-10
    LETTER = "letter"  # A, B, C, D, F
    DESCRIPTIVE = "descriptive"  # Exceeds, Meets, Below, etc.
    CUSTOM = "custom"


class PerformanceRating(Enum):
    """Standard performance ratings."""
    EXCEPTIONAL = "exceptional"
    EXCEEDS_EXPECTATIONS = "exceeds_expectations"
    MEETS_EXPECTATIONS = "meets_expectations"
    NEEDS_IMPROVEMENT = "needs_improvement"
    UNSATISFACTORY = "unsatisfactory"


class CompetencyLevel(Enum):
    """Competency proficiency levels."""
    NOVICE = "novice"
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class ReviewRelationship(Enum):
    """Relationship of reviewer to reviewee."""
    SELF = "self"
    MANAGER = "manager"
    DIRECT_REPORT = "direct_report"
    PEER = "peer"
    SKIP_LEVEL = "skip_level"
    EXTERNAL = "external"
    HR = "hr"


class CycleStatus(Enum):
    """Status of a review cycle."""
    PLANNING = "planning"
    ACTIVE = "active"
    CALIBRATION = "calibration"
    CLOSED = "closed"
    ARCHIVED = "archived"


@dataclass
class Competency:
    """A competency to be assessed."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    category: str = ""
    indicators: list[str] = field(default_factory=list)
    weight: float = 1.0
    is_core: bool = False
    organization_id: str = ""
    created_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CompetencyAssessment:
    """Assessment of a competency."""
    id: str = field(default_factory=lambda: str(uuid4()))
    competency_id: str = ""
    competency_name: str = ""
    level: CompetencyLevel = CompetencyLevel.INTERMEDIATE
    rating: Optional[int] = None
    comments: str = ""
    examples: list[str] = field(default_factory=list)
    assessor_id: str = ""
    assessed_at: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReviewQuestion:
    """A question in a review template."""
    id: str = field(default_factory=lambda: str(uuid4()))
    text: str = ""
    description: str = ""
    question_type: str = "text"  # text, rating, multiple_choice, competency
    required: bool = True
    order: int = 0
    section: str = ""
    options: list[str] = field(default_factory=list)
    competency_id: Optional[str] = None
    weight: float = 1.0
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReviewTemplate:
    """Template for performance reviews."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    review_type: ReviewType = ReviewType.ANNUAL
    rating_scale: RatingScale = RatingScale.NUMERIC_5

    # Questions and structure
    questions: list[ReviewQuestion] = field(default_factory=list)
    sections: list[str] = field(default_factory=list)

    # Settings
    include_self_assessment: bool = True
    include_peer_feedback: bool = False
    include_competencies: bool = True
    include_goals: bool = True
    require_examples: bool = False

    # Ownership
    organization_id: str = ""
    created_by: str = ""

    # State
    is_active: bool = True
    is_default: bool = False

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ReviewCycle:
    """A review cycle (e.g., Q1 2024 Reviews)."""
    id: str = field(default_factory=lambda: str(uuid4()))
    name: str = ""
    description: str = ""
    review_type: ReviewType = ReviewType.ANNUAL
    status: CycleStatus = CycleStatus.PLANNING

    # Timeline
    start_date: datetime = field(default_factory=datetime.now)
    end_date: datetime = field(default_factory=datetime.now)
    self_review_deadline: Optional[datetime] = None
    manager_review_deadline: Optional[datetime] = None
    calibration_deadline: Optional[datetime] = None

    # Template
    template_id: str = ""

    # Ownership
    organization_id: str = ""
    created_by: str = ""

    # Settings
    require_calibration: bool = True
    allow_late_submissions: bool = False
    auto_close: bool = True

    # Stats
    total_reviews: int = 0
    completed_reviews: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def completion_rate(self) -> float:
        """Calculate completion rate."""
        if self.total_reviews == 0:
            return 0.0
        return self.completed_reviews / self.total_reviews

    def is_active(self) -> bool:
        """Check if cycle is currently active."""
        now = datetime.now()
        return self.status == CycleStatus.ACTIVE and self.start_date <= now <= self.end_date


@dataclass
class ReviewResponse:
    """A response to a review question."""
    id: str = field(default_factory=lambda: str(uuid4()))
    question_id: str = ""
    question_text: str = ""
    response_type: str = "text"
    text_response: str = ""
    rating_response: Optional[int] = None
    choice_response: Optional[str] = None
    competency_assessment: Optional[CompetencyAssessment] = None
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)


@dataclass
class PerformanceReview:
    """A performance review for an employee."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Participants
    reviewee_id: str = ""
    reviewer_id: str = ""
    relationship: ReviewRelationship = ReviewRelationship.MANAGER

    # Review details
    review_type: ReviewType = ReviewType.ANNUAL
    status: ReviewStatus = ReviewStatus.DRAFT
    cycle_id: Optional[str] = None
    template_id: Optional[str] = None

    # Ratings
    overall_rating: Optional[PerformanceRating] = None
    numeric_rating: Optional[float] = None

    # Content
    responses: list[ReviewResponse] = field(default_factory=list)
    competency_assessments: list[CompetencyAssessment] = field(default_factory=list)
    strengths: list[str] = field(default_factory=list)
    areas_for_improvement: list[str] = field(default_factory=list)
    goals_achieved: list[str] = field(default_factory=list)
    goals_missed: list[str] = field(default_factory=list)

    # Summary
    summary: str = ""
    private_notes: str = ""  # Manager-only notes

    # Development
    development_plan: str = ""
    recommended_training: list[str] = field(default_factory=list)
    career_aspirations: str = ""

    # Calibration
    calibrated_rating: Optional[PerformanceRating] = None
    calibration_notes: str = ""
    calibrated_by: Optional[str] = None
    calibrated_at: Optional[datetime] = None

    # Acknowledgment
    acknowledged_at: Optional[datetime] = None
    acknowledgment_comments: str = ""

    # Ownership
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def submit(self) -> None:
        """Submit the review."""
        self.status = ReviewStatus.IN_PROGRESS
        self.submitted_at = datetime.now()
        self.updated_at = datetime.now()

    def complete(self) -> None:
        """Mark review as completed."""
        self.status = ReviewStatus.COMPLETED
        self.completed_at = datetime.now()
        self.updated_at = datetime.now()

    def acknowledge(self, comments: str = "") -> None:
        """Acknowledge the review."""
        self.status = ReviewStatus.ACKNOWLEDGED
        self.acknowledged_at = datetime.now()
        self.acknowledgment_comments = comments
        self.updated_at = datetime.now()

    def calibrate(self, rating: PerformanceRating, calibrator_id: str, notes: str = "") -> None:
        """Calibrate the review rating."""
        self.calibrated_rating = rating
        self.calibrated_by = calibrator_id
        self.calibration_notes = notes
        self.calibrated_at = datetime.now()
        self.updated_at = datetime.now()


@dataclass
class Feedback:
    """Continuous feedback between employees."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Participants
    from_user_id: str = ""
    to_user_id: str = ""

    # Content
    feedback_type: FeedbackType = FeedbackType.GENERAL
    visibility: FeedbackVisibility = FeedbackVisibility.PRIVATE
    content: str = ""
    context: str = ""  # Project, meeting, etc.

    # Recognition
    is_recognition: bool = False
    recognition_badge: Optional[str] = None
    company_value: Optional[str] = None  # Linked company value

    # Engagement
    is_anonymous: bool = False
    is_actionable: bool = False
    follow_up_required: bool = False
    followed_up: bool = False
    follow_up_notes: str = ""

    # Reactions
    reaction_count: int = 0

    # Ownership
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class FeedbackRequest:
    """A request for feedback."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Participants
    requester_id: str = ""
    requested_from_ids: list[str] = field(default_factory=list)
    about_user_id: str = ""  # Who the feedback is about

    # Details
    context: str = ""
    questions: list[str] = field(default_factory=list)
    due_date: Optional[datetime] = None

    # Settings
    is_anonymous: bool = False
    visibility: FeedbackVisibility = FeedbackVisibility.PRIVATE

    # Tracking
    responses_received: int = 0
    is_completed: bool = False

    # Ownership
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Recognition:
    """Public recognition/kudos."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Participants
    from_user_id: str = ""
    to_user_ids: list[str] = field(default_factory=list)

    # Content
    title: str = ""
    message: str = ""
    badge: Optional[str] = None
    company_value: Optional[str] = None
    points: int = 0

    # Visibility
    is_public: bool = True
    channel: Optional[str] = None  # Team, department, company-wide

    # Engagement
    reaction_count: int = 0
    comment_count: int = 0

    # Ownership
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CalibrationSession:
    """A calibration session for reviews."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Details
    name: str = ""
    description: str = ""
    cycle_id: str = ""

    # Participants
    facilitator_id: str = ""
    participant_ids: list[str] = field(default_factory=list)

    # Reviews
    review_ids: list[str] = field(default_factory=list)

    # Schedule
    scheduled_at: Optional[datetime] = None
    duration_minutes: int = 60

    # Status
    is_completed: bool = False
    completed_at: Optional[datetime] = None

    # Notes
    notes: str = ""
    decisions: list[str] = field(default_factory=list)

    # Ownership
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class OneOnOne:
    """A one-on-one meeting record."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Participants
    manager_id: str = ""
    employee_id: str = ""

    # Schedule
    scheduled_at: datetime = field(default_factory=datetime.now)
    duration_minutes: int = 30
    is_recurring: bool = False
    recurrence_pattern: Optional[str] = None

    # Agenda
    agenda_items: list[str] = field(default_factory=list)
    talking_points: list[str] = field(default_factory=list)

    # Notes
    manager_notes: str = ""
    employee_notes: str = ""
    shared_notes: str = ""

    # Action items
    action_items: list[str] = field(default_factory=list)

    # Status
    is_completed: bool = False
    completed_at: Optional[datetime] = None

    # Ownership
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


class FeedbackRegistry:
    """Registry for managing feedback and reviews."""

    def __init__(self):
        self._reviews: dict[str, PerformanceReview] = {}
        self._templates: dict[str, ReviewTemplate] = {}
        self._cycles: dict[str, ReviewCycle] = {}
        self._feedback: dict[str, Feedback] = {}
        self._feedback_requests: dict[str, FeedbackRequest] = {}
        self._recognitions: dict[str, Recognition] = {}
        self._competencies: dict[str, Competency] = {}
        self._calibration_sessions: dict[str, CalibrationSession] = {}
        self._one_on_ones: dict[str, OneOnOne] = {}

    # Review CRUD
    def create_review(self, review: PerformanceReview) -> PerformanceReview:
        """Create a new performance review."""
        self._reviews[review.id] = review

        # Update cycle stats if linked
        if review.cycle_id:
            cycle = self.get_cycle(review.cycle_id)
            if cycle:
                cycle.total_reviews += 1

        return review

    def get_review(self, review_id: str) -> Optional[PerformanceReview]:
        """Get a review by ID."""
        return self._reviews.get(review_id)

    def update_review(self, review: PerformanceReview) -> PerformanceReview:
        """Update an existing review."""
        old_review = self._reviews.get(review.id)
        review.updated_at = datetime.now()
        self._reviews[review.id] = review

        # Update cycle stats if status changed to completed
        if old_review and review.cycle_id:
            old_completed = old_review.status in [ReviewStatus.COMPLETED, ReviewStatus.ACKNOWLEDGED]
            new_completed = review.status in [ReviewStatus.COMPLETED, ReviewStatus.ACKNOWLEDGED]

            if not old_completed and new_completed:
                cycle = self.get_cycle(review.cycle_id)
                if cycle:
                    cycle.completed_reviews += 1

        return review

    def delete_review(self, review_id: str) -> bool:
        """Delete a review."""
        review = self._reviews.get(review_id)
        if not review:
            return False

        # Update cycle stats
        if review.cycle_id:
            cycle = self.get_cycle(review.cycle_id)
            if cycle:
                cycle.total_reviews = max(0, cycle.total_reviews - 1)
                if review.status in [ReviewStatus.COMPLETED, ReviewStatus.ACKNOWLEDGED]:
                    cycle.completed_reviews = max(0, cycle.completed_reviews - 1)

        del self._reviews[review_id]
        return True

    def list_reviews(
        self,
        organization_id: str = None,
        reviewee_id: str = None,
        reviewer_id: str = None,
        cycle_id: str = None,
        status: ReviewStatus = None,
        review_type: ReviewType = None
    ) -> list[PerformanceReview]:
        """List reviews with optional filters."""
        results = []

        for review in self._reviews.values():
            if organization_id and review.organization_id != organization_id:
                continue
            if reviewee_id and review.reviewee_id != reviewee_id:
                continue
            if reviewer_id and review.reviewer_id != reviewer_id:
                continue
            if cycle_id and review.cycle_id != cycle_id:
                continue
            if status and review.status != status:
                continue
            if review_type and review.review_type != review_type:
                continue

            results.append(review)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_reviews_for_user(
        self,
        user_id: str,
        as_reviewee: bool = True,
        as_reviewer: bool = False
    ) -> list[PerformanceReview]:
        """Get all reviews involving a user."""
        results = []

        for review in self._reviews.values():
            if as_reviewee and review.reviewee_id == user_id:
                results.append(review)
            elif as_reviewer and review.reviewer_id == user_id:
                results.append(review)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_pending_reviews(self, user_id: str) -> list[PerformanceReview]:
        """Get pending reviews for a user to complete."""
        return [
            r for r in self._reviews.values()
            if r.reviewer_id == user_id and r.status in [
                ReviewStatus.DRAFT, ReviewStatus.IN_PROGRESS,
                ReviewStatus.PENDING_MANAGER
            ]
        ]

    # Template CRUD
    def create_template(self, template: ReviewTemplate) -> ReviewTemplate:
        """Create a new review template."""
        self._templates[template.id] = template
        return template

    def get_template(self, template_id: str) -> Optional[ReviewTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def update_template(self, template: ReviewTemplate) -> ReviewTemplate:
        """Update an existing template."""
        template.updated_at = datetime.now()
        self._templates[template.id] = template
        return template

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        if template_id in self._templates:
            del self._templates[template_id]
            return True
        return False

    def list_templates(
        self,
        organization_id: str = None,
        review_type: ReviewType = None,
        is_active: bool = None
    ) -> list[ReviewTemplate]:
        """List templates with optional filters."""
        results = []

        for template in self._templates.values():
            if organization_id and template.organization_id != organization_id:
                continue
            if review_type and template.review_type != review_type:
                continue
            if is_active is not None and template.is_active != is_active:
                continue

            results.append(template)

        return sorted(results, key=lambda x: x.name)

    def get_default_template(self, organization_id: str, review_type: ReviewType = None) -> Optional[ReviewTemplate]:
        """Get the default template for an organization."""
        for template in self._templates.values():
            if template.organization_id != organization_id:
                continue
            if not template.is_default:
                continue
            if review_type and template.review_type != review_type:
                continue
            return template
        return None

    # Cycle CRUD
    def create_cycle(self, cycle: ReviewCycle) -> ReviewCycle:
        """Create a new review cycle."""
        self._cycles[cycle.id] = cycle
        return cycle

    def get_cycle(self, cycle_id: str) -> Optional[ReviewCycle]:
        """Get a cycle by ID."""
        return self._cycles.get(cycle_id)

    def update_cycle(self, cycle: ReviewCycle) -> ReviewCycle:
        """Update an existing cycle."""
        cycle.updated_at = datetime.now()
        self._cycles[cycle.id] = cycle
        return cycle

    def delete_cycle(self, cycle_id: str) -> bool:
        """Delete a cycle."""
        if cycle_id in self._cycles:
            del self._cycles[cycle_id]
            return True
        return False

    def list_cycles(
        self,
        organization_id: str = None,
        status: CycleStatus = None,
        review_type: ReviewType = None
    ) -> list[ReviewCycle]:
        """List cycles with optional filters."""
        results = []

        for cycle in self._cycles.values():
            if organization_id and cycle.organization_id != organization_id:
                continue
            if status and cycle.status != status:
                continue
            if review_type and cycle.review_type != review_type:
                continue

            results.append(cycle)

        return sorted(results, key=lambda x: x.start_date, reverse=True)

    def get_active_cycle(self, organization_id: str) -> Optional[ReviewCycle]:
        """Get the currently active cycle."""
        for cycle in self._cycles.values():
            if cycle.organization_id == organization_id and cycle.is_active():
                return cycle
        return None

    # Feedback CRUD
    def create_feedback(self, feedback: Feedback) -> Feedback:
        """Create new feedback."""
        self._feedback[feedback.id] = feedback
        return feedback

    def get_feedback(self, feedback_id: str) -> Optional[Feedback]:
        """Get feedback by ID."""
        return self._feedback.get(feedback_id)

    def update_feedback(self, feedback: Feedback) -> Feedback:
        """Update existing feedback."""
        feedback.updated_at = datetime.now()
        self._feedback[feedback.id] = feedback
        return feedback

    def delete_feedback(self, feedback_id: str) -> bool:
        """Delete feedback."""
        if feedback_id in self._feedback:
            del self._feedback[feedback_id]
            return True
        return False

    def list_feedback(
        self,
        organization_id: str = None,
        to_user_id: str = None,
        from_user_id: str = None,
        feedback_type: FeedbackType = None,
        visibility: FeedbackVisibility = None
    ) -> list[Feedback]:
        """List feedback with optional filters."""
        results = []

        for fb in self._feedback.values():
            if organization_id and fb.organization_id != organization_id:
                continue
            if to_user_id and fb.to_user_id != to_user_id:
                continue
            if from_user_id and fb.from_user_id != from_user_id:
                continue
            if feedback_type and fb.feedback_type != feedback_type:
                continue
            if visibility and fb.visibility != visibility:
                continue

            results.append(fb)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_feedback_for_user(
        self,
        user_id: str,
        include_given: bool = False,
        include_received: bool = True
    ) -> list[Feedback]:
        """Get feedback involving a user."""
        results = []

        for fb in self._feedback.values():
            if include_received and fb.to_user_id == user_id:
                results.append(fb)
            elif include_given and fb.from_user_id == user_id:
                results.append(fb)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    # Feedback Request CRUD
    def create_feedback_request(self, request: FeedbackRequest) -> FeedbackRequest:
        """Create a feedback request."""
        self._feedback_requests[request.id] = request
        return request

    def get_feedback_request(self, request_id: str) -> Optional[FeedbackRequest]:
        """Get a feedback request by ID."""
        return self._feedback_requests.get(request_id)

    def list_feedback_requests(
        self,
        requester_id: str = None,
        requested_from_id: str = None
    ) -> list[FeedbackRequest]:
        """List feedback requests."""
        results = []

        for req in self._feedback_requests.values():
            if requester_id and req.requester_id != requester_id:
                continue
            if requested_from_id and requested_from_id not in req.requested_from_ids:
                continue

            results.append(req)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_pending_feedback_requests(self, user_id: str) -> list[FeedbackRequest]:
        """Get pending feedback requests for a user."""
        return [
            req for req in self._feedback_requests.values()
            if user_id in req.requested_from_ids and not req.is_completed
        ]

    # Recognition CRUD
    def create_recognition(self, recognition: Recognition) -> Recognition:
        """Create a recognition."""
        self._recognitions[recognition.id] = recognition
        return recognition

    def get_recognition(self, recognition_id: str) -> Optional[Recognition]:
        """Get a recognition by ID."""
        return self._recognitions.get(recognition_id)

    def list_recognitions(
        self,
        organization_id: str = None,
        to_user_id: str = None,
        from_user_id: str = None,
        is_public: bool = None
    ) -> list[Recognition]:
        """List recognitions with optional filters."""
        results = []

        for rec in self._recognitions.values():
            if organization_id and rec.organization_id != organization_id:
                continue
            if to_user_id and to_user_id not in rec.to_user_ids:
                continue
            if from_user_id and rec.from_user_id != from_user_id:
                continue
            if is_public is not None and rec.is_public != is_public:
                continue

            results.append(rec)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def get_user_recognition_count(self, user_id: str) -> int:
        """Get total recognitions received by a user."""
        return sum(
            1 for rec in self._recognitions.values()
            if user_id in rec.to_user_ids
        )

    def get_user_points(self, user_id: str) -> int:
        """Get total recognition points for a user."""
        return sum(
            rec.points for rec in self._recognitions.values()
            if user_id in rec.to_user_ids
        )

    # Competency CRUD
    def create_competency(self, competency: Competency) -> Competency:
        """Create a competency."""
        self._competencies[competency.id] = competency
        return competency

    def get_competency(self, competency_id: str) -> Optional[Competency]:
        """Get a competency by ID."""
        return self._competencies.get(competency_id)

    def list_competencies(
        self,
        organization_id: str = None,
        category: str = None,
        is_core: bool = None
    ) -> list[Competency]:
        """List competencies with optional filters."""
        results = []

        for comp in self._competencies.values():
            if organization_id and comp.organization_id != organization_id:
                continue
            if category and comp.category != category:
                continue
            if is_core is not None and comp.is_core != is_core:
                continue

            results.append(comp)

        return sorted(results, key=lambda x: x.name)

    # Calibration Session CRUD
    def create_calibration_session(self, session: CalibrationSession) -> CalibrationSession:
        """Create a calibration session."""
        self._calibration_sessions[session.id] = session
        return session

    def get_calibration_session(self, session_id: str) -> Optional[CalibrationSession]:
        """Get a calibration session by ID."""
        return self._calibration_sessions.get(session_id)

    def list_calibration_sessions(
        self,
        cycle_id: str = None,
        facilitator_id: str = None,
        is_completed: bool = None
    ) -> list[CalibrationSession]:
        """List calibration sessions."""
        results = []

        for session in self._calibration_sessions.values():
            if cycle_id and session.cycle_id != cycle_id:
                continue
            if facilitator_id and session.facilitator_id != facilitator_id:
                continue
            if is_completed is not None and session.is_completed != is_completed:
                continue

            results.append(session)

        return sorted(results, key=lambda x: x.scheduled_at or x.created_at)

    # One-on-One CRUD
    def create_one_on_one(self, meeting: OneOnOne) -> OneOnOne:
        """Create a one-on-one meeting."""
        self._one_on_ones[meeting.id] = meeting
        return meeting

    def get_one_on_one(self, meeting_id: str) -> Optional[OneOnOne]:
        """Get a one-on-one by ID."""
        return self._one_on_ones.get(meeting_id)

    def update_one_on_one(self, meeting: OneOnOne) -> OneOnOne:
        """Update a one-on-one."""
        meeting.updated_at = datetime.now()
        self._one_on_ones[meeting.id] = meeting
        return meeting

    def list_one_on_ones(
        self,
        manager_id: str = None,
        employee_id: str = None,
        is_completed: bool = None
    ) -> list[OneOnOne]:
        """List one-on-ones."""
        results = []

        for meeting in self._one_on_ones.values():
            if manager_id and meeting.manager_id != manager_id:
                continue
            if employee_id and meeting.employee_id != employee_id:
                continue
            if is_completed is not None and meeting.is_completed != is_completed:
                continue

            results.append(meeting)

        return sorted(results, key=lambda x: x.scheduled_at, reverse=True)


class FeedbackManager:
    """High-level API for managing feedback and reviews."""

    def __init__(self, registry: FeedbackRegistry = None):
        self.registry = registry or FeedbackRegistry()

    # Review Cycle Management
    def create_review_cycle(
        self,
        name: str,
        organization_id: str,
        start_date: datetime,
        end_date: datetime,
        review_type: ReviewType = ReviewType.ANNUAL,
        template_id: str = None,
        created_by: str = "",
        **kwargs
    ) -> ReviewCycle:
        """Create a new review cycle."""
        cycle = ReviewCycle(
            name=name,
            organization_id=organization_id,
            start_date=start_date,
            end_date=end_date,
            review_type=review_type,
            template_id=template_id or "",
            created_by=created_by,
            **kwargs
        )
        return self.registry.create_cycle(cycle)

    def launch_cycle(self, cycle_id: str) -> Optional[ReviewCycle]:
        """Launch a review cycle."""
        cycle = self.registry.get_cycle(cycle_id)
        if not cycle:
            return None

        cycle.status = CycleStatus.ACTIVE
        return self.registry.update_cycle(cycle)

    def close_cycle(self, cycle_id: str) -> Optional[ReviewCycle]:
        """Close a review cycle."""
        cycle = self.registry.get_cycle(cycle_id)
        if not cycle:
            return None

        cycle.status = CycleStatus.CLOSED
        return self.registry.update_cycle(cycle)

    def get_cycle_progress(self, cycle_id: str) -> dict[str, Any]:
        """Get progress statistics for a cycle."""
        cycle = self.registry.get_cycle(cycle_id)
        if not cycle:
            return {}

        reviews = self.registry.list_reviews(cycle_id=cycle_id)

        status_counts = {}
        for review in reviews:
            status_key = review.status.value
            status_counts[status_key] = status_counts.get(status_key, 0) + 1

        return {
            "total_reviews": cycle.total_reviews,
            "completed_reviews": cycle.completed_reviews,
            "completion_rate": cycle.completion_rate,
            "status_breakdown": status_counts
        }

    # Review Template Management
    def create_template(
        self,
        name: str,
        organization_id: str,
        review_type: ReviewType = ReviewType.ANNUAL,
        questions: list[ReviewQuestion] = None,
        created_by: str = "",
        **kwargs
    ) -> ReviewTemplate:
        """Create a review template."""
        template = ReviewTemplate(
            name=name,
            organization_id=organization_id,
            review_type=review_type,
            questions=questions or [],
            created_by=created_by,
            **kwargs
        )
        return self.registry.create_template(template)

    def add_question_to_template(
        self,
        template_id: str,
        text: str,
        question_type: str = "text",
        required: bool = True,
        section: str = "",
        **kwargs
    ) -> Optional[ReviewTemplate]:
        """Add a question to a template."""
        template = self.registry.get_template(template_id)
        if not template:
            return None

        question = ReviewQuestion(
            text=text,
            question_type=question_type,
            required=required,
            section=section,
            order=len(template.questions),
            **kwargs
        )
        template.questions.append(question)
        return self.registry.update_template(template)

    # Performance Review Management
    def create_review(
        self,
        reviewee_id: str,
        reviewer_id: str,
        organization_id: str,
        review_type: ReviewType = ReviewType.ANNUAL,
        relationship: ReviewRelationship = ReviewRelationship.MANAGER,
        cycle_id: str = None,
        template_id: str = None,
        **kwargs
    ) -> PerformanceReview:
        """Create a performance review."""
        review = PerformanceReview(
            reviewee_id=reviewee_id,
            reviewer_id=reviewer_id,
            organization_id=organization_id,
            review_type=review_type,
            relationship=relationship,
            cycle_id=cycle_id,
            template_id=template_id,
            **kwargs
        )
        return self.registry.create_review(review)

    def create_360_review(
        self,
        reviewee_id: str,
        organization_id: str,
        manager_id: str,
        peer_ids: list[str],
        direct_report_ids: list[str] = None,
        cycle_id: str = None,
        template_id: str = None
    ) -> list[PerformanceReview]:
        """Create a 360-degree review set."""
        reviews = []

        # Self assessment
        self_review = self.create_review(
            reviewee_id=reviewee_id,
            reviewer_id=reviewee_id,
            organization_id=organization_id,
            review_type=ReviewType.THREE_SIXTY,
            relationship=ReviewRelationship.SELF,
            cycle_id=cycle_id,
            template_id=template_id
        )
        reviews.append(self_review)

        # Manager review
        manager_review = self.create_review(
            reviewee_id=reviewee_id,
            reviewer_id=manager_id,
            organization_id=organization_id,
            review_type=ReviewType.THREE_SIXTY,
            relationship=ReviewRelationship.MANAGER,
            cycle_id=cycle_id,
            template_id=template_id
        )
        reviews.append(manager_review)

        # Peer reviews
        for peer_id in peer_ids:
            peer_review = self.create_review(
                reviewee_id=reviewee_id,
                reviewer_id=peer_id,
                organization_id=organization_id,
                review_type=ReviewType.THREE_SIXTY,
                relationship=ReviewRelationship.PEER,
                cycle_id=cycle_id,
                template_id=template_id
            )
            reviews.append(peer_review)

        # Direct report reviews (upward feedback)
        if direct_report_ids:
            for dr_id in direct_report_ids:
                dr_review = self.create_review(
                    reviewee_id=reviewee_id,
                    reviewer_id=dr_id,
                    organization_id=organization_id,
                    review_type=ReviewType.THREE_SIXTY,
                    relationship=ReviewRelationship.DIRECT_REPORT,
                    cycle_id=cycle_id,
                    template_id=template_id
                )
                reviews.append(dr_review)

        return reviews

    def submit_review(self, review_id: str) -> Optional[PerformanceReview]:
        """Submit a review."""
        review = self.registry.get_review(review_id)
        if not review:
            return None

        review.submit()
        return self.registry.update_review(review)

    def complete_review(
        self,
        review_id: str,
        overall_rating: PerformanceRating = None,
        summary: str = ""
    ) -> Optional[PerformanceReview]:
        """Complete a review."""
        review = self.registry.get_review(review_id)
        if not review:
            return None

        if overall_rating:
            review.overall_rating = overall_rating
        review.summary = summary
        review.complete()
        return self.registry.update_review(review)

    def acknowledge_review(
        self,
        review_id: str,
        comments: str = ""
    ) -> Optional[PerformanceReview]:
        """Acknowledge a review."""
        review = self.registry.get_review(review_id)
        if not review:
            return None

        review.acknowledge(comments)
        return self.registry.update_review(review)

    def add_response(
        self,
        review_id: str,
        question_id: str,
        question_text: str,
        text_response: str = "",
        rating_response: int = None,
        **kwargs
    ) -> Optional[PerformanceReview]:
        """Add a response to a review."""
        review = self.registry.get_review(review_id)
        if not review:
            return None

        response = ReviewResponse(
            question_id=question_id,
            question_text=question_text,
            text_response=text_response,
            rating_response=rating_response,
            **kwargs
        )
        review.responses.append(response)
        return self.registry.update_review(review)

    def get_user_reviews(
        self,
        user_id: str,
        include_as_reviewee: bool = True,
        include_as_reviewer: bool = False
    ) -> list[PerformanceReview]:
        """Get all reviews for a user."""
        return self.registry.get_reviews_for_user(
            user_id,
            as_reviewee=include_as_reviewee,
            as_reviewer=include_as_reviewer
        )

    def get_pending_reviews(self, user_id: str) -> list[PerformanceReview]:
        """Get pending reviews for a user to complete."""
        return self.registry.get_pending_reviews(user_id)

    # Feedback Management
    def give_feedback(
        self,
        from_user_id: str,
        to_user_id: str,
        content: str,
        organization_id: str,
        feedback_type: FeedbackType = FeedbackType.GENERAL,
        visibility: FeedbackVisibility = FeedbackVisibility.PRIVATE,
        context: str = "",
        is_anonymous: bool = False,
        **kwargs
    ) -> Feedback:
        """Give feedback to someone."""
        feedback = Feedback(
            from_user_id="" if is_anonymous else from_user_id,
            to_user_id=to_user_id,
            content=content,
            organization_id=organization_id,
            feedback_type=feedback_type,
            visibility=visibility,
            context=context,
            is_anonymous=is_anonymous,
            **kwargs
        )
        return self.registry.create_feedback(feedback)

    def request_feedback(
        self,
        requester_id: str,
        about_user_id: str,
        requested_from_ids: list[str],
        organization_id: str,
        context: str = "",
        questions: list[str] = None,
        due_date: datetime = None,
        is_anonymous: bool = False
    ) -> FeedbackRequest:
        """Request feedback about someone."""
        request = FeedbackRequest(
            requester_id=requester_id,
            about_user_id=about_user_id,
            requested_from_ids=requested_from_ids,
            organization_id=organization_id,
            context=context,
            questions=questions or [],
            due_date=due_date,
            is_anonymous=is_anonymous
        )
        return self.registry.create_feedback_request(request)

    def get_feedback_received(self, user_id: str) -> list[Feedback]:
        """Get all feedback received by a user."""
        return self.registry.get_feedback_for_user(
            user_id,
            include_given=False,
            include_received=True
        )

    def get_feedback_given(self, user_id: str) -> list[Feedback]:
        """Get all feedback given by a user."""
        return self.registry.get_feedback_for_user(
            user_id,
            include_given=True,
            include_received=False
        )

    # Recognition Management
    def give_recognition(
        self,
        from_user_id: str,
        to_user_ids: list[str],
        message: str,
        organization_id: str,
        title: str = "",
        badge: str = None,
        company_value: str = None,
        points: int = 0,
        is_public: bool = True,
        **kwargs
    ) -> Recognition:
        """Give recognition to someone."""
        recognition = Recognition(
            from_user_id=from_user_id,
            to_user_ids=to_user_ids,
            title=title,
            message=message,
            badge=badge,
            company_value=company_value,
            points=points,
            organization_id=organization_id,
            is_public=is_public,
            **kwargs
        )
        return self.registry.create_recognition(recognition)

    def get_recognition_feed(
        self,
        organization_id: str,
        limit: int = 50
    ) -> list[Recognition]:
        """Get public recognition feed."""
        recognitions = self.registry.list_recognitions(
            organization_id=organization_id,
            is_public=True
        )
        return recognitions[:limit]

    def get_user_recognitions(self, user_id: str) -> list[Recognition]:
        """Get recognitions received by a user."""
        return self.registry.list_recognitions(to_user_id=user_id)

    def get_user_recognition_stats(self, user_id: str) -> dict[str, Any]:
        """Get recognition statistics for a user."""
        return {
            "total_received": self.registry.get_user_recognition_count(user_id),
            "total_points": self.registry.get_user_points(user_id)
        }

    # Calibration Management
    def create_calibration_session(
        self,
        name: str,
        cycle_id: str,
        facilitator_id: str,
        organization_id: str,
        review_ids: list[str],
        participant_ids: list[str],
        scheduled_at: datetime = None,
        **kwargs
    ) -> CalibrationSession:
        """Create a calibration session."""
        session = CalibrationSession(
            name=name,
            cycle_id=cycle_id,
            facilitator_id=facilitator_id,
            organization_id=organization_id,
            review_ids=review_ids,
            participant_ids=participant_ids,
            scheduled_at=scheduled_at,
            **kwargs
        )
        return self.registry.create_calibration_session(session)

    def calibrate_review(
        self,
        review_id: str,
        rating: PerformanceRating,
        calibrator_id: str,
        notes: str = ""
    ) -> Optional[PerformanceReview]:
        """Calibrate a review's rating."""
        review = self.registry.get_review(review_id)
        if not review:
            return None

        review.calibrate(rating, calibrator_id, notes)
        return self.registry.update_review(review)

    # One-on-One Management
    def schedule_one_on_one(
        self,
        manager_id: str,
        employee_id: str,
        organization_id: str,
        scheduled_at: datetime,
        duration_minutes: int = 30,
        agenda_items: list[str] = None,
        is_recurring: bool = False,
        **kwargs
    ) -> OneOnOne:
        """Schedule a one-on-one meeting."""
        meeting = OneOnOne(
            manager_id=manager_id,
            employee_id=employee_id,
            organization_id=organization_id,
            scheduled_at=scheduled_at,
            duration_minutes=duration_minutes,
            agenda_items=agenda_items or [],
            is_recurring=is_recurring,
            **kwargs
        )
        return self.registry.create_one_on_one(meeting)

    def add_one_on_one_notes(
        self,
        meeting_id: str,
        shared_notes: str = None,
        manager_notes: str = None,
        employee_notes: str = None,
        action_items: list[str] = None
    ) -> Optional[OneOnOne]:
        """Add notes to a one-on-one."""
        meeting = self.registry.get_one_on_one(meeting_id)
        if not meeting:
            return None

        if shared_notes is not None:
            meeting.shared_notes = shared_notes
        if manager_notes is not None:
            meeting.manager_notes = manager_notes
        if employee_notes is not None:
            meeting.employee_notes = employee_notes
        if action_items is not None:
            meeting.action_items = action_items

        return self.registry.update_one_on_one(meeting)

    def complete_one_on_one(self, meeting_id: str) -> Optional[OneOnOne]:
        """Mark a one-on-one as completed."""
        meeting = self.registry.get_one_on_one(meeting_id)
        if not meeting:
            return None

        meeting.is_completed = True
        meeting.completed_at = datetime.now()
        return self.registry.update_one_on_one(meeting)

    def get_one_on_one_history(
        self,
        manager_id: str,
        employee_id: str,
        limit: int = 10
    ) -> list[OneOnOne]:
        """Get one-on-one history between manager and employee."""
        meetings = self.registry.list_one_on_ones(
            manager_id=manager_id,
            employee_id=employee_id
        )
        return meetings[:limit]

    # Competency Management
    def create_competency(
        self,
        name: str,
        organization_id: str,
        description: str = "",
        category: str = "",
        indicators: list[str] = None,
        is_core: bool = False,
        **kwargs
    ) -> Competency:
        """Create a competency."""
        competency = Competency(
            name=name,
            organization_id=organization_id,
            description=description,
            category=category,
            indicators=indicators or [],
            is_core=is_core,
            **kwargs
        )
        return self.registry.create_competency(competency)

    def get_competency_framework(
        self,
        organization_id: str,
        core_only: bool = False
    ) -> list[Competency]:
        """Get competency framework for an organization."""
        return self.registry.list_competencies(
            organization_id=organization_id,
            is_core=True if core_only else None
        )

    # Analytics
    def get_review_analytics(
        self,
        organization_id: str,
        cycle_id: str = None
    ) -> dict[str, Any]:
        """Get review analytics."""
        reviews = self.registry.list_reviews(
            organization_id=organization_id,
            cycle_id=cycle_id
        )

        if not reviews:
            return {"total": 0}

        # Rating distribution
        rating_dist = {}
        for review in reviews:
            if review.overall_rating:
                rating = review.overall_rating.value
                rating_dist[rating] = rating_dist.get(rating, 0) + 1

        # Status distribution
        status_dist = {}
        for review in reviews:
            status = review.status.value
            status_dist[status] = status_dist.get(status, 0) + 1

        completed = sum(
            1 for r in reviews
            if r.status in [ReviewStatus.COMPLETED, ReviewStatus.ACKNOWLEDGED]
        )

        return {
            "total": len(reviews),
            "completed": completed,
            "completion_rate": completed / len(reviews) if reviews else 0,
            "rating_distribution": rating_dist,
            "status_distribution": status_dist
        }

    def get_feedback_analytics(
        self,
        organization_id: str,
        start_date: datetime = None,
        end_date: datetime = None
    ) -> dict[str, Any]:
        """Get feedback analytics."""
        all_feedback = self.registry.list_feedback(organization_id=organization_id)

        if start_date:
            all_feedback = [f for f in all_feedback if f.created_at >= start_date]
        if end_date:
            all_feedback = [f for f in all_feedback if f.created_at <= end_date]

        type_dist = {}
        for fb in all_feedback:
            fb_type = fb.feedback_type.value
            type_dist[fb_type] = type_dist.get(fb_type, 0) + 1

        return {
            "total": len(all_feedback),
            "type_distribution": type_dist,
            "recognition_count": sum(1 for f in all_feedback if f.is_recognition)
        }


# Global instance management
_feedback_manager: Optional[FeedbackManager] = None


def get_feedback_manager() -> FeedbackManager:
    """Get the global feedback manager instance."""
    global _feedback_manager
    if _feedback_manager is None:
        _feedback_manager = FeedbackManager()
    return _feedback_manager


def set_feedback_manager(manager: FeedbackManager) -> None:
    """Set the global feedback manager instance."""
    global _feedback_manager
    _feedback_manager = manager


def reset_feedback_manager() -> None:
    """Reset the global feedback manager instance."""
    global _feedback_manager
    _feedback_manager = None
