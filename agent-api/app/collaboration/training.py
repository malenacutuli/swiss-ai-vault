"""
Training & Learning Management module for enterprise collaboration.

This module provides comprehensive training and learning management including:
- Training courses and programs
- Learning paths and curricula
- Certifications and credentials
- Training sessions and enrollments
- Progress tracking and completion
- Assessments and quizzes
- Training analytics
"""

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional


# ============================================================================
# Enums
# ============================================================================


class CourseType(Enum):
    """Types of training courses."""

    ONBOARDING = "onboarding"
    COMPLIANCE = "compliance"
    SAFETY = "safety"
    TECHNICAL = "technical"
    SOFT_SKILLS = "soft_skills"
    LEADERSHIP = "leadership"
    PRODUCT = "product"
    SALES = "sales"
    CUSTOMER_SERVICE = "customer_service"
    SECURITY = "security"
    DIVERSITY = "diversity"
    PROFESSIONAL_DEVELOPMENT = "professional_development"
    CERTIFICATION_PREP = "certification_prep"
    CUSTOM = "custom"


class CourseStatus(Enum):
    """Status of a course."""

    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    UNDER_REVIEW = "under_review"
    RETIRED = "retired"


class CourseFormat(Enum):
    """Format of course delivery."""

    ONLINE_SELF_PACED = "online_self_paced"
    ONLINE_INSTRUCTOR_LED = "online_instructor_led"
    IN_PERSON = "in_person"
    BLENDED = "blended"
    VIDEO = "video"
    WEBINAR = "webinar"
    WORKSHOP = "workshop"
    SIMULATION = "simulation"
    MENTORING = "mentoring"


class DifficultyLevel(Enum):
    """Difficulty level of course content."""

    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class EnrollmentStatus(Enum):
    """Status of an enrollment."""

    PENDING = "pending"
    ENROLLED = "enrolled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    DROPPED = "dropped"
    WAITLISTED = "waitlisted"
    EXPIRED = "expired"


class SessionStatus(Enum):
    """Status of a training session."""

    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    POSTPONED = "postponed"


class ContentType(Enum):
    """Type of course content."""

    VIDEO = "video"
    DOCUMENT = "document"
    PRESENTATION = "presentation"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    INTERACTIVE = "interactive"
    AUDIO = "audio"
    SCORM = "scorm"
    EXTERNAL_LINK = "external_link"
    DISCUSSION = "discussion"


class AssessmentType(Enum):
    """Type of assessment."""

    QUIZ = "quiz"
    EXAM = "exam"
    ASSIGNMENT = "assignment"
    PROJECT = "project"
    PRACTICAL = "practical"
    PEER_REVIEW = "peer_review"
    SELF_ASSESSMENT = "self_assessment"
    SURVEY = "survey"


class QuestionType(Enum):
    """Type of quiz question."""

    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_SELECT = "multiple_select"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    MATCHING = "matching"
    ORDERING = "ordering"
    FILL_IN_BLANK = "fill_in_blank"


class CertificationStatus(Enum):
    """Status of a certification."""

    ACTIVE = "active"
    EXPIRED = "expired"
    REVOKED = "revoked"
    PENDING_RENEWAL = "pending_renewal"
    SUSPENDED = "suspended"


class PathStatus(Enum):
    """Status of a learning path."""

    DRAFT = "draft"
    ACTIVE = "active"
    ARCHIVED = "archived"


class ProgressStatus(Enum):
    """Status of content progress."""

    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    SKIPPED = "skipped"


class NotificationType(Enum):
    """Types of training notifications."""

    ENROLLMENT_CONFIRMED = "enrollment_confirmed"
    SESSION_REMINDER = "session_reminder"
    DEADLINE_APPROACHING = "deadline_approaching"
    COURSE_COMPLETED = "course_completed"
    CERTIFICATE_ISSUED = "certificate_issued"
    CERTIFICATE_EXPIRING = "certificate_expiring"
    NEW_COURSE_AVAILABLE = "new_course_available"
    ASSESSMENT_DUE = "assessment_due"
    FEEDBACK_REQUESTED = "feedback_requested"


# ============================================================================
# Data Models
# ============================================================================


@dataclass
class Instructor:
    """Represents a training instructor."""

    id: str
    user_id: str
    name: str
    email: str
    bio: Optional[str] = None
    specializations: List[str] = field(default_factory=list)
    certifications: List[str] = field(default_factory=list)
    rating: float = 0.0
    total_sessions: int = 0
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CourseModule:
    """Represents a module within a course."""

    id: str
    course_id: str
    title: str
    description: Optional[str] = None
    order: int = 0
    duration_minutes: int = 0
    required: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CourseContent:
    """Represents content within a module."""

    id: str
    module_id: str
    title: str
    content_type: ContentType = ContentType.DOCUMENT
    content_url: Optional[str] = None
    content_data: Optional[str] = None
    duration_minutes: int = 0
    order: int = 0
    required: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Course:
    """Represents a training course."""

    id: str
    title: str
    description: Optional[str] = None
    course_type: CourseType = CourseType.CUSTOM
    status: CourseStatus = CourseStatus.DRAFT
    format: CourseFormat = CourseFormat.ONLINE_SELF_PACED
    difficulty: DifficultyLevel = DifficultyLevel.BEGINNER
    duration_hours: float = 0.0
    passing_score: float = 70.0
    max_attempts: int = 3
    prerequisites: List[str] = field(default_factory=list)
    tags: List[str] = field(default_factory=list)
    category: Optional[str] = None
    instructor_id: Optional[str] = None
    thumbnail_url: Optional[str] = None
    enrollment_limit: Optional[int] = None
    auto_enroll_groups: List[str] = field(default_factory=list)
    mandatory: bool = False
    deadline_days: Optional[int] = None
    certificate_template_id: Optional[str] = None
    version: str = "1.0"
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_published(self) -> bool:
        """Check if course is published."""
        return self.status == CourseStatus.PUBLISHED

    def is_mandatory(self) -> bool:
        """Check if course is mandatory."""
        return self.mandatory


@dataclass
class LearningPath:
    """Represents a learning path or curriculum."""

    id: str
    title: str
    description: Optional[str] = None
    status: PathStatus = PathStatus.DRAFT
    course_ids: List[str] = field(default_factory=list)
    duration_hours: float = 0.0
    target_roles: List[str] = field(default_factory=list)
    target_departments: List[str] = field(default_factory=list)
    mandatory: bool = False
    order_enforced: bool = True
    certificate_template_id: Optional[str] = None
    created_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingSession:
    """Represents a scheduled training session."""

    id: str
    course_id: str
    title: Optional[str] = None
    instructor_id: Optional[str] = None
    status: SessionStatus = SessionStatus.SCHEDULED
    format: CourseFormat = CourseFormat.IN_PERSON
    location: Optional[str] = None
    virtual_meeting_url: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    capacity: int = 30
    enrolled_count: int = 0
    waitlist_count: int = 0
    notes: Optional[str] = None
    materials_url: Optional[str] = None
    recording_url: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_full(self) -> bool:
        """Check if session is at capacity."""
        return self.enrolled_count >= self.capacity

    def has_availability(self) -> bool:
        """Check if session has availability."""
        return self.enrolled_count < self.capacity


@dataclass
class Enrollment:
    """Represents a user enrollment in a course."""

    id: str
    user_id: str
    course_id: str
    session_id: Optional[str] = None
    status: EnrollmentStatus = EnrollmentStatus.ENROLLED
    enrolled_at: datetime = field(default_factory=datetime.utcnow)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    deadline: Optional[datetime] = None
    progress_percent: float = 0.0
    score: Optional[float] = None
    attempts: int = 0
    time_spent_minutes: int = 0
    last_accessed_at: Optional[datetime] = None
    certificate_id: Optional[str] = None
    assigned_by: Optional[str] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_complete(self) -> bool:
        """Check if enrollment is complete."""
        return self.status == EnrollmentStatus.COMPLETED

    def is_overdue(self) -> bool:
        """Check if enrollment is past deadline."""
        if not self.deadline:
            return False
        return datetime.utcnow() > self.deadline and self.status not in (
            EnrollmentStatus.COMPLETED,
            EnrollmentStatus.DROPPED,
        )


@dataclass
class ContentProgress:
    """Tracks progress on specific content."""

    id: str
    enrollment_id: str
    content_id: str
    status: ProgressStatus = ProgressStatus.NOT_STARTED
    progress_percent: float = 0.0
    time_spent_minutes: int = 0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    score: Optional[float] = None
    attempts: int = 0
    last_position: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Question:
    """Represents a quiz/exam question."""

    id: str
    assessment_id: str
    question_type: QuestionType = QuestionType.MULTIPLE_CHOICE
    question_text: str = ""
    options: List[Dict[str, Any]] = field(default_factory=list)
    correct_answer: Optional[Any] = None
    points: float = 1.0
    order: int = 0
    explanation: Optional[str] = None
    time_limit_seconds: Optional[int] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Assessment:
    """Represents an assessment (quiz, exam, etc.)."""

    id: str
    course_id: str
    module_id: Optional[str] = None
    title: str = ""
    assessment_type: AssessmentType = AssessmentType.QUIZ
    description: Optional[str] = None
    passing_score: float = 70.0
    time_limit_minutes: Optional[int] = None
    max_attempts: int = 3
    randomize_questions: bool = False
    show_correct_answers: bool = True
    required: bool = True
    weight: float = 1.0
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AssessmentAttempt:
    """Represents an attempt at an assessment."""

    id: str
    assessment_id: str
    enrollment_id: str
    user_id: str
    attempt_number: int = 1
    started_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None
    score: Optional[float] = None
    passed: bool = False
    answers: Dict[str, Any] = field(default_factory=dict)
    time_spent_minutes: int = 0
    graded_by: Optional[str] = None
    graded_at: Optional[datetime] = None
    feedback: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CertificateTemplate:
    """Template for generating certificates."""

    id: str
    name: str
    description: Optional[str] = None
    template_html: Optional[str] = None
    template_url: Optional[str] = None
    valid_for_days: Optional[int] = None
    requires_renewal: bool = False
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Certificate:
    """Represents an issued certificate."""

    id: str
    user_id: str
    course_id: Optional[str] = None
    learning_path_id: Optional[str] = None
    template_id: str = ""
    certificate_number: str = ""
    title: str = ""
    status: CertificationStatus = CertificationStatus.ACTIVE
    issued_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    score: Optional[float] = None
    completion_date: Optional[datetime] = None
    issued_by: Optional[str] = None
    certificate_url: Optional[str] = None
    verification_code: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def is_valid(self) -> bool:
        """Check if certificate is valid."""
        if self.status != CertificationStatus.ACTIVE:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def days_until_expiry(self) -> Optional[int]:
        """Get days until certificate expires."""
        if not self.expires_at:
            return None
        delta = self.expires_at - datetime.utcnow()
        return max(0, delta.days)


@dataclass
class Credential:
    """Represents a professional credential or certification."""

    id: str
    user_id: str
    name: str
    issuing_organization: str
    credential_id: Optional[str] = None
    status: CertificationStatus = CertificationStatus.ACTIVE
    issued_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    verification_url: Optional[str] = None
    skills: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingRequest:
    """Represents a training request from an employee."""

    id: str
    user_id: str
    course_id: Optional[str] = None
    title: str = ""
    description: Optional[str] = None
    justification: Optional[str] = None
    requested_at: datetime = field(default_factory=datetime.utcnow)
    approved: Optional[bool] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    denial_reason: Optional[str] = None
    budget_amount: Optional[float] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingBudget:
    """Represents training budget allocation."""

    id: str
    department_id: Optional[str] = None
    user_id: Optional[str] = None
    fiscal_year: int = 2024
    allocated_amount: float = 0.0
    spent_amount: float = 0.0
    reserved_amount: float = 0.0
    currency: str = "USD"
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def available_amount(self) -> float:
        """Get available budget amount."""
        return self.allocated_amount - self.spent_amount - self.reserved_amount


@dataclass
class CourseFeedback:
    """Feedback on a course from a user."""

    id: str
    course_id: str
    user_id: str
    enrollment_id: str
    rating: int = 0
    content_rating: Optional[int] = None
    instructor_rating: Optional[int] = None
    difficulty_rating: Optional[int] = None
    comments: Optional[str] = None
    would_recommend: bool = True
    submitted_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingNotification:
    """Notification related to training."""

    id: str
    user_id: str
    notification_type: NotificationType = NotificationType.ENROLLMENT_CONFIRMED
    title: str = ""
    message: str = ""
    course_id: Optional[str] = None
    session_id: Optional[str] = None
    read: bool = False
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TrainingAnalytics:
    """Analytics for training programs."""

    total_courses: int = 0
    published_courses: int = 0
    total_enrollments: int = 0
    active_enrollments: int = 0
    completed_enrollments: int = 0
    average_completion_rate: float = 0.0
    average_score: float = 0.0
    total_certificates: int = 0
    total_training_hours: float = 0.0
    courses_by_type: Dict[str, int] = field(default_factory=dict)
    enrollments_by_status: Dict[str, int] = field(default_factory=dict)
    completion_trend: List[Dict[str, Any]] = field(default_factory=list)
    top_courses: List[Dict[str, Any]] = field(default_factory=list)
    generated_at: datetime = field(default_factory=datetime.utcnow)


# ============================================================================
# Registry
# ============================================================================


class TrainingRegistry:
    """Registry for managing training data."""

    def __init__(self) -> None:
        """Initialize the training registry."""
        self._courses: Dict[str, Course] = {}
        self._modules: Dict[str, CourseModule] = {}
        self._contents: Dict[str, CourseContent] = {}
        self._instructors: Dict[str, Instructor] = {}
        self._sessions: Dict[str, TrainingSession] = {}
        self._enrollments: Dict[str, Enrollment] = {}
        self._progress: Dict[str, ContentProgress] = {}
        self._learning_paths: Dict[str, LearningPath] = {}
        self._assessments: Dict[str, Assessment] = {}
        self._questions: Dict[str, Question] = {}
        self._attempts: Dict[str, AssessmentAttempt] = {}
        self._certificates: Dict[str, Certificate] = {}
        self._templates: Dict[str, CertificateTemplate] = {}
        self._credentials: Dict[str, Credential] = {}
        self._requests: Dict[str, TrainingRequest] = {}
        self._budgets: Dict[str, TrainingBudget] = {}
        self._feedback: Dict[str, CourseFeedback] = {}
        self._notifications: Dict[str, TrainingNotification] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._courses.clear()
        self._modules.clear()
        self._contents.clear()
        self._instructors.clear()
        self._sessions.clear()
        self._enrollments.clear()
        self._progress.clear()
        self._learning_paths.clear()
        self._assessments.clear()
        self._questions.clear()
        self._attempts.clear()
        self._certificates.clear()
        self._templates.clear()
        self._credentials.clear()
        self._requests.clear()
        self._budgets.clear()
        self._feedback.clear()
        self._notifications.clear()

    # Course management
    def create_course(self, course: Course) -> Course:
        """Create a new course."""
        self._courses[course.id] = course
        return course

    def get_course(self, course_id: str) -> Optional[Course]:
        """Get a course by ID."""
        return self._courses.get(course_id)

    def update_course(
        self, course_id: str, updates: Dict[str, Any]
    ) -> Optional[Course]:
        """Update a course."""
        course = self._courses.get(course_id)
        if not course:
            return None
        for key, value in updates.items():
            if hasattr(course, key):
                setattr(course, key, value)
        course.updated_at = datetime.utcnow()
        return course

    def delete_course(self, course_id: str) -> bool:
        """Delete a course."""
        if course_id in self._courses:
            del self._courses[course_id]
            return True
        return False

    def list_courses(
        self,
        course_type: Optional[CourseType] = None,
        status: Optional[CourseStatus] = None,
        category: Optional[str] = None,
        instructor_id: Optional[str] = None,
        mandatory: Optional[bool] = None,
    ) -> List[Course]:
        """List courses with optional filters."""
        courses = list(self._courses.values())
        if course_type:
            courses = [c for c in courses if c.course_type == course_type]
        if status:
            courses = [c for c in courses if c.status == status]
        if category:
            courses = [c for c in courses if c.category == category]
        if instructor_id:
            courses = [c for c in courses if c.instructor_id == instructor_id]
        if mandatory is not None:
            courses = [c for c in courses if c.mandatory == mandatory]
        return courses

    def search_courses(self, query: str) -> List[Course]:
        """Search courses by title or description."""
        query_lower = query.lower()
        return [
            c
            for c in self._courses.values()
            if query_lower in c.title.lower()
            or (c.description and query_lower in c.description.lower())
        ]

    # Module management
    def create_module(self, module: CourseModule) -> CourseModule:
        """Create a course module."""
        self._modules[module.id] = module
        return module

    def get_module(self, module_id: str) -> Optional[CourseModule]:
        """Get a module by ID."""
        return self._modules.get(module_id)

    def update_module(
        self, module_id: str, updates: Dict[str, Any]
    ) -> Optional[CourseModule]:
        """Update a module."""
        module = self._modules.get(module_id)
        if not module:
            return None
        for key, value in updates.items():
            if hasattr(module, key):
                setattr(module, key, value)
        return module

    def delete_module(self, module_id: str) -> bool:
        """Delete a module."""
        if module_id in self._modules:
            del self._modules[module_id]
            return True
        return False

    def get_course_modules(self, course_id: str) -> List[CourseModule]:
        """Get all modules for a course."""
        modules = [m for m in self._modules.values() if m.course_id == course_id]
        return sorted(modules, key=lambda m: m.order)

    # Content management
    def create_content(self, content: CourseContent) -> CourseContent:
        """Create course content."""
        self._contents[content.id] = content
        return content

    def get_content(self, content_id: str) -> Optional[CourseContent]:
        """Get content by ID."""
        return self._contents.get(content_id)

    def update_content(
        self, content_id: str, updates: Dict[str, Any]
    ) -> Optional[CourseContent]:
        """Update content."""
        content = self._contents.get(content_id)
        if not content:
            return None
        for key, value in updates.items():
            if hasattr(content, key):
                setattr(content, key, value)
        return content

    def delete_content(self, content_id: str) -> bool:
        """Delete content."""
        if content_id in self._contents:
            del self._contents[content_id]
            return True
        return False

    def get_module_contents(self, module_id: str) -> List[CourseContent]:
        """Get all contents for a module."""
        contents = [c for c in self._contents.values() if c.module_id == module_id]
        return sorted(contents, key=lambda c: c.order)

    # Instructor management
    def create_instructor(self, instructor: Instructor) -> Instructor:
        """Create an instructor."""
        self._instructors[instructor.id] = instructor
        return instructor

    def get_instructor(self, instructor_id: str) -> Optional[Instructor]:
        """Get an instructor by ID."""
        return self._instructors.get(instructor_id)

    def update_instructor(
        self, instructor_id: str, updates: Dict[str, Any]
    ) -> Optional[Instructor]:
        """Update an instructor."""
        instructor = self._instructors.get(instructor_id)
        if not instructor:
            return None
        for key, value in updates.items():
            if hasattr(instructor, key):
                setattr(instructor, key, value)
        return instructor

    def list_instructors(self, active: Optional[bool] = None) -> List[Instructor]:
        """List all instructors."""
        instructors = list(self._instructors.values())
        if active is not None:
            instructors = [i for i in instructors if i.active == active]
        return instructors

    # Session management
    def create_session(self, session: TrainingSession) -> TrainingSession:
        """Create a training session."""
        self._sessions[session.id] = session
        return session

    def get_session(self, session_id: str) -> Optional[TrainingSession]:
        """Get a session by ID."""
        return self._sessions.get(session_id)

    def update_session(
        self, session_id: str, updates: Dict[str, Any]
    ) -> Optional[TrainingSession]:
        """Update a session."""
        session = self._sessions.get(session_id)
        if not session:
            return None
        for key, value in updates.items():
            if hasattr(session, key):
                setattr(session, key, value)
        return session

    def delete_session(self, session_id: str) -> bool:
        """Delete a session."""
        if session_id in self._sessions:
            del self._sessions[session_id]
            return True
        return False

    def list_sessions(
        self,
        course_id: Optional[str] = None,
        instructor_id: Optional[str] = None,
        status: Optional[SessionStatus] = None,
    ) -> List[TrainingSession]:
        """List sessions with optional filters."""
        sessions = list(self._sessions.values())
        if course_id:
            sessions = [s for s in sessions if s.course_id == course_id]
        if instructor_id:
            sessions = [s for s in sessions if s.instructor_id == instructor_id]
        if status:
            sessions = [s for s in sessions if s.status == status]
        return sessions

    def get_upcoming_sessions(
        self, course_id: Optional[str] = None
    ) -> List[TrainingSession]:
        """Get upcoming sessions."""
        now = datetime.utcnow()
        sessions = [
            s
            for s in self._sessions.values()
            if s.start_time and s.start_time > now and s.status == SessionStatus.SCHEDULED
        ]
        if course_id:
            sessions = [s for s in sessions if s.course_id == course_id]
        return sorted(sessions, key=lambda s: s.start_time or now)

    # Enrollment management
    def create_enrollment(self, enrollment: Enrollment) -> Enrollment:
        """Create an enrollment."""
        self._enrollments[enrollment.id] = enrollment
        return enrollment

    def get_enrollment(self, enrollment_id: str) -> Optional[Enrollment]:
        """Get an enrollment by ID."""
        return self._enrollments.get(enrollment_id)

    def get_enrollment_by_user_course(
        self, user_id: str, course_id: str
    ) -> Optional[Enrollment]:
        """Get enrollment for a user in a course."""
        for enrollment in self._enrollments.values():
            if enrollment.user_id == user_id and enrollment.course_id == course_id:
                return enrollment
        return None

    def update_enrollment(
        self, enrollment_id: str, updates: Dict[str, Any]
    ) -> Optional[Enrollment]:
        """Update an enrollment."""
        enrollment = self._enrollments.get(enrollment_id)
        if not enrollment:
            return None
        for key, value in updates.items():
            if hasattr(enrollment, key):
                setattr(enrollment, key, value)
        return enrollment

    def delete_enrollment(self, enrollment_id: str) -> bool:
        """Delete an enrollment."""
        if enrollment_id in self._enrollments:
            del self._enrollments[enrollment_id]
            return True
        return False

    def list_enrollments(
        self,
        user_id: Optional[str] = None,
        course_id: Optional[str] = None,
        session_id: Optional[str] = None,
        status: Optional[EnrollmentStatus] = None,
    ) -> List[Enrollment]:
        """List enrollments with optional filters."""
        enrollments = list(self._enrollments.values())
        if user_id:
            enrollments = [e for e in enrollments if e.user_id == user_id]
        if course_id:
            enrollments = [e for e in enrollments if e.course_id == course_id]
        if session_id:
            enrollments = [e for e in enrollments if e.session_id == session_id]
        if status:
            enrollments = [e for e in enrollments if e.status == status]
        return enrollments

    def get_overdue_enrollments(self) -> List[Enrollment]:
        """Get enrollments past deadline."""
        now = datetime.utcnow()
        return [
            e
            for e in self._enrollments.values()
            if e.deadline
            and e.deadline < now
            and e.status not in (EnrollmentStatus.COMPLETED, EnrollmentStatus.DROPPED)
        ]

    # Progress management
    def create_progress(self, progress: ContentProgress) -> ContentProgress:
        """Create content progress."""
        self._progress[progress.id] = progress
        return progress

    def get_progress(self, progress_id: str) -> Optional[ContentProgress]:
        """Get progress by ID."""
        return self._progress.get(progress_id)

    def get_progress_by_enrollment_content(
        self, enrollment_id: str, content_id: str
    ) -> Optional[ContentProgress]:
        """Get progress for specific content in an enrollment."""
        for progress in self._progress.values():
            if (
                progress.enrollment_id == enrollment_id
                and progress.content_id == content_id
            ):
                return progress
        return None

    def update_progress(
        self, progress_id: str, updates: Dict[str, Any]
    ) -> Optional[ContentProgress]:
        """Update progress."""
        progress = self._progress.get(progress_id)
        if not progress:
            return None
        for key, value in updates.items():
            if hasattr(progress, key):
                setattr(progress, key, value)
        return progress

    def get_enrollment_progress(self, enrollment_id: str) -> List[ContentProgress]:
        """Get all progress for an enrollment."""
        return [p for p in self._progress.values() if p.enrollment_id == enrollment_id]

    # Learning path management
    def create_learning_path(self, path: LearningPath) -> LearningPath:
        """Create a learning path."""
        self._learning_paths[path.id] = path
        return path

    def get_learning_path(self, path_id: str) -> Optional[LearningPath]:
        """Get a learning path by ID."""
        return self._learning_paths.get(path_id)

    def update_learning_path(
        self, path_id: str, updates: Dict[str, Any]
    ) -> Optional[LearningPath]:
        """Update a learning path."""
        path = self._learning_paths.get(path_id)
        if not path:
            return None
        for key, value in updates.items():
            if hasattr(path, key):
                setattr(path, key, value)
        path.updated_at = datetime.utcnow()
        return path

    def delete_learning_path(self, path_id: str) -> bool:
        """Delete a learning path."""
        if path_id in self._learning_paths:
            del self._learning_paths[path_id]
            return True
        return False

    def list_learning_paths(
        self, status: Optional[PathStatus] = None
    ) -> List[LearningPath]:
        """List learning paths."""
        paths = list(self._learning_paths.values())
        if status:
            paths = [p for p in paths if p.status == status]
        return paths

    # Assessment management
    def create_assessment(self, assessment: Assessment) -> Assessment:
        """Create an assessment."""
        self._assessments[assessment.id] = assessment
        return assessment

    def get_assessment(self, assessment_id: str) -> Optional[Assessment]:
        """Get an assessment by ID."""
        return self._assessments.get(assessment_id)

    def update_assessment(
        self, assessment_id: str, updates: Dict[str, Any]
    ) -> Optional[Assessment]:
        """Update an assessment."""
        assessment = self._assessments.get(assessment_id)
        if not assessment:
            return None
        for key, value in updates.items():
            if hasattr(assessment, key):
                setattr(assessment, key, value)
        return assessment

    def get_course_assessments(self, course_id: str) -> List[Assessment]:
        """Get all assessments for a course."""
        return [a for a in self._assessments.values() if a.course_id == course_id]

    # Question management
    def create_question(self, question: Question) -> Question:
        """Create a question."""
        self._questions[question.id] = question
        return question

    def get_question(self, question_id: str) -> Optional[Question]:
        """Get a question by ID."""
        return self._questions.get(question_id)

    def get_assessment_questions(self, assessment_id: str) -> List[Question]:
        """Get all questions for an assessment."""
        questions = [
            q for q in self._questions.values() if q.assessment_id == assessment_id
        ]
        return sorted(questions, key=lambda q: q.order)

    # Attempt management
    def create_attempt(self, attempt: AssessmentAttempt) -> AssessmentAttempt:
        """Create an assessment attempt."""
        self._attempts[attempt.id] = attempt
        return attempt

    def get_attempt(self, attempt_id: str) -> Optional[AssessmentAttempt]:
        """Get an attempt by ID."""
        return self._attempts.get(attempt_id)

    def update_attempt(
        self, attempt_id: str, updates: Dict[str, Any]
    ) -> Optional[AssessmentAttempt]:
        """Update an attempt."""
        attempt = self._attempts.get(attempt_id)
        if not attempt:
            return None
        for key, value in updates.items():
            if hasattr(attempt, key):
                setattr(attempt, key, value)
        return attempt

    def get_user_attempts(
        self, user_id: str, assessment_id: Optional[str] = None
    ) -> List[AssessmentAttempt]:
        """Get attempts for a user."""
        attempts = [a for a in self._attempts.values() if a.user_id == user_id]
        if assessment_id:
            attempts = [a for a in attempts if a.assessment_id == assessment_id]
        return attempts

    # Certificate management
    def create_certificate(self, certificate: Certificate) -> Certificate:
        """Create a certificate."""
        self._certificates[certificate.id] = certificate
        return certificate

    def get_certificate(self, certificate_id: str) -> Optional[Certificate]:
        """Get a certificate by ID."""
        return self._certificates.get(certificate_id)

    def get_certificate_by_number(
        self, certificate_number: str
    ) -> Optional[Certificate]:
        """Get a certificate by number."""
        for cert in self._certificates.values():
            if cert.certificate_number == certificate_number:
                return cert
        return None

    def update_certificate(
        self, certificate_id: str, updates: Dict[str, Any]
    ) -> Optional[Certificate]:
        """Update a certificate."""
        certificate = self._certificates.get(certificate_id)
        if not certificate:
            return None
        for key, value in updates.items():
            if hasattr(certificate, key):
                setattr(certificate, key, value)
        return certificate

    def get_user_certificates(
        self, user_id: str, status: Optional[CertificationStatus] = None
    ) -> List[Certificate]:
        """Get certificates for a user."""
        certs = [c for c in self._certificates.values() if c.user_id == user_id]
        if status:
            certs = [c for c in certs if c.status == status]
        return certs

    def get_expiring_certificates(self, days: int = 30) -> List[Certificate]:
        """Get certificates expiring within specified days."""
        cutoff = datetime.utcnow() + timedelta(days=days)
        return [
            c
            for c in self._certificates.values()
            if c.expires_at
            and c.expires_at <= cutoff
            and c.status == CertificationStatus.ACTIVE
        ]

    # Template management
    def create_template(self, template: CertificateTemplate) -> CertificateTemplate:
        """Create a certificate template."""
        self._templates[template.id] = template
        return template

    def get_template(self, template_id: str) -> Optional[CertificateTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def list_templates(self, active: Optional[bool] = None) -> List[CertificateTemplate]:
        """List certificate templates."""
        templates = list(self._templates.values())
        if active is not None:
            templates = [t for t in templates if t.active == active]
        return templates

    # Credential management
    def create_credential(self, credential: Credential) -> Credential:
        """Create a credential."""
        self._credentials[credential.id] = credential
        return credential

    def get_credential(self, credential_id: str) -> Optional[Credential]:
        """Get a credential by ID."""
        return self._credentials.get(credential_id)

    def update_credential(
        self, credential_id: str, updates: Dict[str, Any]
    ) -> Optional[Credential]:
        """Update a credential."""
        credential = self._credentials.get(credential_id)
        if not credential:
            return None
        for key, value in updates.items():
            if hasattr(credential, key):
                setattr(credential, key, value)
        return credential

    def get_user_credentials(self, user_id: str) -> List[Credential]:
        """Get credentials for a user."""
        return [c for c in self._credentials.values() if c.user_id == user_id]

    # Request management
    def create_request(self, request: TrainingRequest) -> TrainingRequest:
        """Create a training request."""
        self._requests[request.id] = request
        return request

    def get_request(self, request_id: str) -> Optional[TrainingRequest]:
        """Get a request by ID."""
        return self._requests.get(request_id)

    def update_request(
        self, request_id: str, updates: Dict[str, Any]
    ) -> Optional[TrainingRequest]:
        """Update a request."""
        request = self._requests.get(request_id)
        if not request:
            return None
        for key, value in updates.items():
            if hasattr(request, key):
                setattr(request, key, value)
        return request

    def list_requests(
        self, user_id: Optional[str] = None, approved: Optional[bool] = None
    ) -> List[TrainingRequest]:
        """List training requests."""
        requests = list(self._requests.values())
        if user_id:
            requests = [r for r in requests if r.user_id == user_id]
        if approved is not None:
            requests = [r for r in requests if r.approved == approved]
        return requests

    # Budget management
    def create_budget(self, budget: TrainingBudget) -> TrainingBudget:
        """Create a training budget."""
        self._budgets[budget.id] = budget
        return budget

    def get_budget(self, budget_id: str) -> Optional[TrainingBudget]:
        """Get a budget by ID."""
        return self._budgets.get(budget_id)

    def update_budget(
        self, budget_id: str, updates: Dict[str, Any]
    ) -> Optional[TrainingBudget]:
        """Update a budget."""
        budget = self._budgets.get(budget_id)
        if not budget:
            return None
        for key, value in updates.items():
            if hasattr(budget, key):
                setattr(budget, key, value)
        return budget

    def get_department_budget(
        self, department_id: str, fiscal_year: int
    ) -> Optional[TrainingBudget]:
        """Get budget for a department."""
        for budget in self._budgets.values():
            if (
                budget.department_id == department_id
                and budget.fiscal_year == fiscal_year
            ):
                return budget
        return None

    # Feedback management
    def create_feedback(self, feedback: CourseFeedback) -> CourseFeedback:
        """Create course feedback."""
        self._feedback[feedback.id] = feedback
        return feedback

    def get_feedback(self, feedback_id: str) -> Optional[CourseFeedback]:
        """Get feedback by ID."""
        return self._feedback.get(feedback_id)

    def get_course_feedback(self, course_id: str) -> List[CourseFeedback]:
        """Get all feedback for a course."""
        return [f for f in self._feedback.values() if f.course_id == course_id]

    def get_average_course_rating(self, course_id: str) -> Optional[float]:
        """Get average rating for a course."""
        feedback = self.get_course_feedback(course_id)
        if not feedback:
            return None
        return sum(f.rating for f in feedback) / len(feedback)

    # Notification management
    def create_notification(
        self, notification: TrainingNotification
    ) -> TrainingNotification:
        """Create a notification."""
        self._notifications[notification.id] = notification
        return notification

    def get_notification(self, notification_id: str) -> Optional[TrainingNotification]:
        """Get a notification by ID."""
        return self._notifications.get(notification_id)

    def get_user_notifications(
        self, user_id: str, unread_only: bool = False
    ) -> List[TrainingNotification]:
        """Get notifications for a user."""
        notifications = [
            n for n in self._notifications.values() if n.user_id == user_id
        ]
        if unread_only:
            notifications = [n for n in notifications if not n.read]
        return sorted(notifications, key=lambda n: n.created_at, reverse=True)

    def mark_notification_read(self, notification_id: str) -> bool:
        """Mark a notification as read."""
        notification = self._notifications.get(notification_id)
        if notification:
            notification.read = True
            return True
        return False


# ============================================================================
# Manager
# ============================================================================


class TrainingManager:
    """High-level API for training management."""

    def __init__(self, registry: Optional[TrainingRegistry] = None) -> None:
        """Initialize the training manager."""
        self.registry = registry or TrainingRegistry()

    # Course Management
    def create_course(
        self,
        title: str,
        course_type: CourseType = CourseType.CUSTOM,
        description: Optional[str] = None,
        format: CourseFormat = CourseFormat.ONLINE_SELF_PACED,
        difficulty: DifficultyLevel = DifficultyLevel.BEGINNER,
        created_by: Optional[str] = None,
        **kwargs: Any,
    ) -> Course:
        """Create a new course."""
        course = Course(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            course_type=course_type,
            format=format,
            difficulty=difficulty,
            created_by=created_by,
            **kwargs,
        )
        return self.registry.create_course(course)

    def get_course(self, course_id: str) -> Optional[Course]:
        """Get a course by ID."""
        return self.registry.get_course(course_id)

    def update_course(
        self, course_id: str, **updates: Any
    ) -> Optional[Course]:
        """Update a course."""
        return self.registry.update_course(course_id, updates)

    def delete_course(self, course_id: str) -> bool:
        """Delete a course."""
        return self.registry.delete_course(course_id)

    def publish_course(self, course_id: str) -> Optional[Course]:
        """Publish a course."""
        return self.registry.update_course(
            course_id,
            {"status": CourseStatus.PUBLISHED, "published_at": datetime.utcnow()},
        )

    def archive_course(self, course_id: str) -> Optional[Course]:
        """Archive a course."""
        return self.registry.update_course(
            course_id, {"status": CourseStatus.ARCHIVED}
        )

    def list_courses(
        self,
        course_type: Optional[CourseType] = None,
        status: Optional[CourseStatus] = None,
        category: Optional[str] = None,
        mandatory: Optional[bool] = None,
    ) -> List[Course]:
        """List courses with optional filters."""
        return self.registry.list_courses(
            course_type=course_type,
            status=status,
            category=category,
            mandatory=mandatory,
        )

    def search_courses(self, query: str) -> List[Course]:
        """Search courses."""
        return self.registry.search_courses(query)

    # Module Management
    def add_module(
        self,
        course_id: str,
        title: str,
        description: Optional[str] = None,
        order: int = 0,
        duration_minutes: int = 0,
        **kwargs: Any,
    ) -> Optional[CourseModule]:
        """Add a module to a course."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        module = CourseModule(
            id=str(uuid.uuid4()),
            course_id=course_id,
            title=title,
            description=description,
            order=order,
            duration_minutes=duration_minutes,
            **kwargs,
        )
        return self.registry.create_module(module)

    def get_module(self, module_id: str) -> Optional[CourseModule]:
        """Get a module by ID."""
        return self.registry.get_module(module_id)

    def update_module(
        self, module_id: str, **updates: Any
    ) -> Optional[CourseModule]:
        """Update a module."""
        return self.registry.update_module(module_id, updates)

    def delete_module(self, module_id: str) -> bool:
        """Delete a module."""
        return self.registry.delete_module(module_id)

    def get_course_modules(self, course_id: str) -> List[CourseModule]:
        """Get all modules for a course."""
        return self.registry.get_course_modules(course_id)

    # Content Management
    def add_content(
        self,
        module_id: str,
        title: str,
        content_type: ContentType = ContentType.DOCUMENT,
        content_url: Optional[str] = None,
        content_data: Optional[str] = None,
        duration_minutes: int = 0,
        order: int = 0,
        **kwargs: Any,
    ) -> Optional[CourseContent]:
        """Add content to a module."""
        module = self.registry.get_module(module_id)
        if not module:
            return None

        content = CourseContent(
            id=str(uuid.uuid4()),
            module_id=module_id,
            title=title,
            content_type=content_type,
            content_url=content_url,
            content_data=content_data,
            duration_minutes=duration_minutes,
            order=order,
            **kwargs,
        )
        return self.registry.create_content(content)

    def get_content(self, content_id: str) -> Optional[CourseContent]:
        """Get content by ID."""
        return self.registry.get_content(content_id)

    def get_module_contents(self, module_id: str) -> List[CourseContent]:
        """Get all contents for a module."""
        return self.registry.get_module_contents(module_id)

    # Instructor Management
    def add_instructor(
        self,
        user_id: str,
        name: str,
        email: str,
        bio: Optional[str] = None,
        specializations: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Instructor:
        """Add an instructor."""
        instructor = Instructor(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            email=email,
            bio=bio,
            specializations=specializations or [],
            **kwargs,
        )
        return self.registry.create_instructor(instructor)

    def get_instructor(self, instructor_id: str) -> Optional[Instructor]:
        """Get an instructor by ID."""
        return self.registry.get_instructor(instructor_id)

    def list_instructors(self, active: Optional[bool] = None) -> List[Instructor]:
        """List instructors."""
        return self.registry.list_instructors(active=active)

    # Session Management
    def schedule_session(
        self,
        course_id: str,
        start_time: datetime,
        end_time: datetime,
        instructor_id: Optional[str] = None,
        location: Optional[str] = None,
        capacity: int = 30,
        format: CourseFormat = CourseFormat.IN_PERSON,
        **kwargs: Any,
    ) -> Optional[TrainingSession]:
        """Schedule a training session."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        session = TrainingSession(
            id=str(uuid.uuid4()),
            course_id=course_id,
            instructor_id=instructor_id,
            start_time=start_time,
            end_time=end_time,
            location=location,
            capacity=capacity,
            format=format,
            **kwargs,
        )
        return self.registry.create_session(session)

    def get_session(self, session_id: str) -> Optional[TrainingSession]:
        """Get a session by ID."""
        return self.registry.get_session(session_id)

    def update_session(
        self, session_id: str, **updates: Any
    ) -> Optional[TrainingSession]:
        """Update a session."""
        return self.registry.update_session(session_id, updates)

    def cancel_session(self, session_id: str) -> Optional[TrainingSession]:
        """Cancel a session."""
        return self.registry.update_session(
            session_id, {"status": SessionStatus.CANCELLED}
        )

    def complete_session(self, session_id: str) -> Optional[TrainingSession]:
        """Mark a session as completed."""
        return self.registry.update_session(
            session_id, {"status": SessionStatus.COMPLETED}
        )

    def list_sessions(
        self,
        course_id: Optional[str] = None,
        instructor_id: Optional[str] = None,
        status: Optional[SessionStatus] = None,
    ) -> List[TrainingSession]:
        """List sessions."""
        return self.registry.list_sessions(
            course_id=course_id,
            instructor_id=instructor_id,
            status=status,
        )

    def get_upcoming_sessions(
        self, course_id: Optional[str] = None
    ) -> List[TrainingSession]:
        """Get upcoming sessions."""
        return self.registry.get_upcoming_sessions(course_id=course_id)

    # Enrollment Management
    def enroll_user(
        self,
        user_id: str,
        course_id: str,
        session_id: Optional[str] = None,
        assigned_by: Optional[str] = None,
        deadline: Optional[datetime] = None,
        **kwargs: Any,
    ) -> Optional[Enrollment]:
        """Enroll a user in a course."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        # Check if already enrolled
        existing = self.registry.get_enrollment_by_user_course(user_id, course_id)
        if existing and existing.status not in (
            EnrollmentStatus.DROPPED,
            EnrollmentStatus.EXPIRED,
        ):
            return existing

        # Check session capacity if specified
        if session_id:
            session = self.registry.get_session(session_id)
            if session and session.is_full():
                # Add to waitlist
                enrollment = Enrollment(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    course_id=course_id,
                    session_id=session_id,
                    status=EnrollmentStatus.WAITLISTED,
                    assigned_by=assigned_by,
                    deadline=deadline,
                    **kwargs,
                )
                self.registry.update_session(
                    session_id, {"waitlist_count": session.waitlist_count + 1}
                )
                return self.registry.create_enrollment(enrollment)

            if session:
                self.registry.update_session(
                    session_id, {"enrolled_count": session.enrolled_count + 1}
                )

        # Calculate deadline if course has deadline_days
        if not deadline and course.deadline_days:
            deadline = datetime.utcnow() + timedelta(days=course.deadline_days)

        enrollment = Enrollment(
            id=str(uuid.uuid4()),
            user_id=user_id,
            course_id=course_id,
            session_id=session_id,
            status=EnrollmentStatus.ENROLLED,
            assigned_by=assigned_by,
            deadline=deadline,
            **kwargs,
        )
        return self.registry.create_enrollment(enrollment)

    def get_enrollment(self, enrollment_id: str) -> Optional[Enrollment]:
        """Get an enrollment by ID."""
        return self.registry.get_enrollment(enrollment_id)

    def start_course(self, enrollment_id: str) -> Optional[Enrollment]:
        """Mark an enrollment as started."""
        return self.registry.update_enrollment(
            enrollment_id,
            {
                "status": EnrollmentStatus.IN_PROGRESS,
                "started_at": datetime.utcnow(),
                "last_accessed_at": datetime.utcnow(),
            },
        )

    def complete_enrollment(
        self, enrollment_id: str, score: Optional[float] = None
    ) -> Optional[Enrollment]:
        """Mark an enrollment as completed."""
        return self.registry.update_enrollment(
            enrollment_id,
            {
                "status": EnrollmentStatus.COMPLETED,
                "completed_at": datetime.utcnow(),
                "progress_percent": 100.0,
                "score": score,
            },
        )

    def drop_enrollment(self, enrollment_id: str) -> Optional[Enrollment]:
        """Drop an enrollment."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if enrollment and enrollment.session_id:
            session = self.registry.get_session(enrollment.session_id)
            if session:
                self.registry.update_session(
                    enrollment.session_id,
                    {"enrolled_count": max(0, session.enrolled_count - 1)},
                )
        return self.registry.update_enrollment(
            enrollment_id, {"status": EnrollmentStatus.DROPPED}
        )

    def update_progress(
        self,
        enrollment_id: str,
        progress_percent: float,
        time_spent_minutes: Optional[int] = None,
    ) -> Optional[Enrollment]:
        """Update enrollment progress."""
        updates: Dict[str, Any] = {
            "progress_percent": min(100.0, progress_percent),
            "last_accessed_at": datetime.utcnow(),
        }
        if time_spent_minutes is not None:
            enrollment = self.registry.get_enrollment(enrollment_id)
            if enrollment:
                updates["time_spent_minutes"] = (
                    enrollment.time_spent_minutes + time_spent_minutes
                )
        return self.registry.update_enrollment(enrollment_id, updates)

    def list_enrollments(
        self,
        user_id: Optional[str] = None,
        course_id: Optional[str] = None,
        status: Optional[EnrollmentStatus] = None,
    ) -> List[Enrollment]:
        """List enrollments."""
        return self.registry.list_enrollments(
            user_id=user_id, course_id=course_id, status=status
        )

    def get_user_enrollments(self, user_id: str) -> List[Enrollment]:
        """Get all enrollments for a user."""
        return self.registry.list_enrollments(user_id=user_id)

    def get_overdue_enrollments(self) -> List[Enrollment]:
        """Get enrollments past deadline."""
        return self.registry.get_overdue_enrollments()

    # Content Progress
    def track_content_progress(
        self,
        enrollment_id: str,
        content_id: str,
        progress_percent: float = 0.0,
        time_spent_minutes: int = 0,
    ) -> Optional[ContentProgress]:
        """Track progress on specific content."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not enrollment:
            return None

        existing = self.registry.get_progress_by_enrollment_content(
            enrollment_id, content_id
        )
        if existing:
            status = existing.status
            if progress_percent >= 100:
                status = ProgressStatus.COMPLETED
            elif progress_percent > 0:
                status = ProgressStatus.IN_PROGRESS

            return self.registry.update_progress(
                existing.id,
                {
                    "progress_percent": progress_percent,
                    "time_spent_minutes": existing.time_spent_minutes
                    + time_spent_minutes,
                    "status": status,
                    "completed_at": datetime.utcnow()
                    if status == ProgressStatus.COMPLETED
                    else None,
                },
            )

        status = ProgressStatus.NOT_STARTED
        if progress_percent >= 100:
            status = ProgressStatus.COMPLETED
        elif progress_percent > 0:
            status = ProgressStatus.IN_PROGRESS

        progress = ContentProgress(
            id=str(uuid.uuid4()),
            enrollment_id=enrollment_id,
            content_id=content_id,
            status=status,
            progress_percent=progress_percent,
            time_spent_minutes=time_spent_minutes,
            started_at=datetime.utcnow() if progress_percent > 0 else None,
            completed_at=datetime.utcnow() if status == ProgressStatus.COMPLETED else None,
        )
        return self.registry.create_progress(progress)

    def complete_content(
        self, enrollment_id: str, content_id: str
    ) -> Optional[ContentProgress]:
        """Mark content as completed."""
        return self.track_content_progress(enrollment_id, content_id, 100.0)

    # Learning Path Management
    def create_learning_path(
        self,
        title: str,
        description: Optional[str] = None,
        course_ids: Optional[List[str]] = None,
        created_by: Optional[str] = None,
        **kwargs: Any,
    ) -> LearningPath:
        """Create a learning path."""
        path = LearningPath(
            id=str(uuid.uuid4()),
            title=title,
            description=description,
            course_ids=course_ids or [],
            created_by=created_by,
            **kwargs,
        )
        return self.registry.create_learning_path(path)

    def get_learning_path(self, path_id: str) -> Optional[LearningPath]:
        """Get a learning path by ID."""
        return self.registry.get_learning_path(path_id)

    def update_learning_path(
        self, path_id: str, **updates: Any
    ) -> Optional[LearningPath]:
        """Update a learning path."""
        return self.registry.update_learning_path(path_id, updates)

    def add_course_to_path(
        self, path_id: str, course_id: str
    ) -> Optional[LearningPath]:
        """Add a course to a learning path."""
        path = self.registry.get_learning_path(path_id)
        if not path:
            return None
        if course_id not in path.course_ids:
            path.course_ids.append(course_id)
            path.updated_at = datetime.utcnow()
        return path

    def remove_course_from_path(
        self, path_id: str, course_id: str
    ) -> Optional[LearningPath]:
        """Remove a course from a learning path."""
        path = self.registry.get_learning_path(path_id)
        if not path:
            return None
        if course_id in path.course_ids:
            path.course_ids.remove(course_id)
            path.updated_at = datetime.utcnow()
        return path

    def activate_learning_path(self, path_id: str) -> Optional[LearningPath]:
        """Activate a learning path."""
        return self.registry.update_learning_path(path_id, {"status": PathStatus.ACTIVE})

    def list_learning_paths(
        self, status: Optional[PathStatus] = None
    ) -> List[LearningPath]:
        """List learning paths."""
        return self.registry.list_learning_paths(status=status)

    # Assessment Management
    def create_assessment(
        self,
        course_id: str,
        title: str,
        assessment_type: AssessmentType = AssessmentType.QUIZ,
        module_id: Optional[str] = None,
        passing_score: float = 70.0,
        time_limit_minutes: Optional[int] = None,
        max_attempts: int = 3,
        **kwargs: Any,
    ) -> Optional[Assessment]:
        """Create an assessment."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        assessment = Assessment(
            id=str(uuid.uuid4()),
            course_id=course_id,
            module_id=module_id,
            title=title,
            assessment_type=assessment_type,
            passing_score=passing_score,
            time_limit_minutes=time_limit_minutes,
            max_attempts=max_attempts,
            **kwargs,
        )
        return self.registry.create_assessment(assessment)

    def get_assessment(self, assessment_id: str) -> Optional[Assessment]:
        """Get an assessment by ID."""
        return self.registry.get_assessment(assessment_id)

    def add_question(
        self,
        assessment_id: str,
        question_text: str,
        question_type: QuestionType = QuestionType.MULTIPLE_CHOICE,
        options: Optional[List[Dict[str, Any]]] = None,
        correct_answer: Optional[Any] = None,
        points: float = 1.0,
        order: int = 0,
        **kwargs: Any,
    ) -> Optional[Question]:
        """Add a question to an assessment."""
        assessment = self.registry.get_assessment(assessment_id)
        if not assessment:
            return None

        question = Question(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            question_type=question_type,
            question_text=question_text,
            options=options or [],
            correct_answer=correct_answer,
            points=points,
            order=order,
            **kwargs,
        )
        return self.registry.create_question(question)

    def get_assessment_questions(self, assessment_id: str) -> List[Question]:
        """Get all questions for an assessment."""
        return self.registry.get_assessment_questions(assessment_id)

    def start_assessment_attempt(
        self, assessment_id: str, enrollment_id: str, user_id: str
    ) -> Optional[AssessmentAttempt]:
        """Start an assessment attempt."""
        assessment = self.registry.get_assessment(assessment_id)
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not assessment or not enrollment:
            return None

        # Check max attempts
        existing_attempts = self.registry.get_user_attempts(user_id, assessment_id)
        if len(existing_attempts) >= assessment.max_attempts:
            return None

        attempt = AssessmentAttempt(
            id=str(uuid.uuid4()),
            assessment_id=assessment_id,
            enrollment_id=enrollment_id,
            user_id=user_id,
            attempt_number=len(existing_attempts) + 1,
        )
        return self.registry.create_attempt(attempt)

    def submit_assessment_attempt(
        self,
        attempt_id: str,
        answers: Dict[str, Any],
    ) -> Optional[AssessmentAttempt]:
        """Submit an assessment attempt."""
        attempt = self.registry.get_attempt(attempt_id)
        if not attempt:
            return None

        assessment = self.registry.get_assessment(attempt.assessment_id)
        if not assessment:
            return None

        # Calculate score
        questions = self.registry.get_assessment_questions(attempt.assessment_id)
        total_points = sum(q.points for q in questions)
        earned_points = 0.0

        for question in questions:
            if question.id in answers:
                if answers[question.id] == question.correct_answer:
                    earned_points += question.points

        score = (earned_points / total_points * 100) if total_points > 0 else 0
        passed = score >= assessment.passing_score

        time_spent = int(
            (datetime.utcnow() - attempt.started_at).total_seconds() / 60
        )

        return self.registry.update_attempt(
            attempt_id,
            {
                "answers": answers,
                "submitted_at": datetime.utcnow(),
                "score": score,
                "passed": passed,
                "time_spent_minutes": time_spent,
            },
        )

    # Certificate Management
    def create_certificate_template(
        self,
        name: str,
        description: Optional[str] = None,
        valid_for_days: Optional[int] = None,
        **kwargs: Any,
    ) -> CertificateTemplate:
        """Create a certificate template."""
        template = CertificateTemplate(
            id=str(uuid.uuid4()),
            name=name,
            description=description,
            valid_for_days=valid_for_days,
            **kwargs,
        )
        return self.registry.create_template(template)

    def issue_certificate(
        self,
        user_id: str,
        template_id: str,
        title: str,
        course_id: Optional[str] = None,
        learning_path_id: Optional[str] = None,
        score: Optional[float] = None,
        issued_by: Optional[str] = None,
        **kwargs: Any,
    ) -> Optional[Certificate]:
        """Issue a certificate to a user."""
        template = self.registry.get_template(template_id)
        if not template:
            return None

        expires_at = None
        if template.valid_for_days:
            expires_at = datetime.utcnow() + timedelta(days=template.valid_for_days)

        certificate = Certificate(
            id=str(uuid.uuid4()),
            user_id=user_id,
            course_id=course_id,
            learning_path_id=learning_path_id,
            template_id=template_id,
            certificate_number=f"CERT-{uuid.uuid4().hex[:8].upper()}",
            title=title,
            score=score,
            completion_date=datetime.utcnow(),
            expires_at=expires_at,
            issued_by=issued_by,
            verification_code=uuid.uuid4().hex[:12].upper(),
            **kwargs,
        )
        return self.registry.create_certificate(certificate)

    def get_certificate(self, certificate_id: str) -> Optional[Certificate]:
        """Get a certificate by ID."""
        return self.registry.get_certificate(certificate_id)

    def verify_certificate(self, certificate_number: str) -> Optional[Certificate]:
        """Verify a certificate by its number."""
        certificate = self.registry.get_certificate_by_number(certificate_number)
        if certificate and certificate.is_valid():
            return certificate
        return None

    def get_user_certificates(
        self, user_id: str, status: Optional[CertificationStatus] = None
    ) -> List[Certificate]:
        """Get certificates for a user."""
        return self.registry.get_user_certificates(user_id, status=status)

    def get_expiring_certificates(self, days: int = 30) -> List[Certificate]:
        """Get certificates expiring soon."""
        return self.registry.get_expiring_certificates(days=days)

    def renew_certificate(
        self, certificate_id: str, new_expiry: Optional[datetime] = None
    ) -> Optional[Certificate]:
        """Renew a certificate."""
        certificate = self.registry.get_certificate(certificate_id)
        if not certificate:
            return None

        template = self.registry.get_template(certificate.template_id)
        if not new_expiry and template and template.valid_for_days:
            new_expiry = datetime.utcnow() + timedelta(days=template.valid_for_days)

        return self.registry.update_certificate(
            certificate_id,
            {"expires_at": new_expiry, "status": CertificationStatus.ACTIVE},
        )

    # Credential Management
    def add_credential(
        self,
        user_id: str,
        name: str,
        issuing_organization: str,
        credential_id: Optional[str] = None,
        issued_date: Optional[datetime] = None,
        expiry_date: Optional[datetime] = None,
        skills: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Credential:
        """Add a credential for a user."""
        credential = Credential(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            issuing_organization=issuing_organization,
            credential_id=credential_id,
            issued_date=issued_date,
            expiry_date=expiry_date,
            skills=skills or [],
            **kwargs,
        )
        return self.registry.create_credential(credential)

    def get_credential(self, credential_id: str) -> Optional[Credential]:
        """Get a credential by ID."""
        return self.registry.get_credential(credential_id)

    def get_user_credentials(self, user_id: str) -> List[Credential]:
        """Get all credentials for a user."""
        return self.registry.get_user_credentials(user_id)

    # Training Request Management
    def submit_training_request(
        self,
        user_id: str,
        title: str,
        course_id: Optional[str] = None,
        description: Optional[str] = None,
        justification: Optional[str] = None,
        budget_amount: Optional[float] = None,
        **kwargs: Any,
    ) -> TrainingRequest:
        """Submit a training request."""
        request = TrainingRequest(
            id=str(uuid.uuid4()),
            user_id=user_id,
            course_id=course_id,
            title=title,
            description=description,
            justification=justification,
            budget_amount=budget_amount,
            **kwargs,
        )
        return self.registry.create_request(request)

    def approve_request(
        self, request_id: str, approved_by: str
    ) -> Optional[TrainingRequest]:
        """Approve a training request."""
        return self.registry.update_request(
            request_id,
            {"approved": True, "approved_by": approved_by, "approved_at": datetime.utcnow()},
        )

    def deny_request(
        self, request_id: str, denied_by: str, reason: Optional[str] = None
    ) -> Optional[TrainingRequest]:
        """Deny a training request."""
        return self.registry.update_request(
            request_id,
            {
                "approved": False,
                "approved_by": denied_by,
                "approved_at": datetime.utcnow(),
                "denial_reason": reason,
            },
        )

    def list_training_requests(
        self, user_id: Optional[str] = None, approved: Optional[bool] = None
    ) -> List[TrainingRequest]:
        """List training requests."""
        return self.registry.list_requests(user_id=user_id, approved=approved)

    # Budget Management
    def allocate_budget(
        self,
        allocated_amount: float,
        fiscal_year: int = 2024,
        department_id: Optional[str] = None,
        user_id: Optional[str] = None,
        currency: str = "USD",
        **kwargs: Any,
    ) -> TrainingBudget:
        """Allocate training budget."""
        budget = TrainingBudget(
            id=str(uuid.uuid4()),
            department_id=department_id,
            user_id=user_id,
            fiscal_year=fiscal_year,
            allocated_amount=allocated_amount,
            currency=currency,
            **kwargs,
        )
        return self.registry.create_budget(budget)

    def get_budget(self, budget_id: str) -> Optional[TrainingBudget]:
        """Get a budget by ID."""
        return self.registry.get_budget(budget_id)

    def spend_from_budget(
        self, budget_id: str, amount: float
    ) -> Optional[TrainingBudget]:
        """Record spending from budget."""
        budget = self.registry.get_budget(budget_id)
        if not budget or budget.available_amount() < amount:
            return None
        return self.registry.update_budget(
            budget_id, {"spent_amount": budget.spent_amount + amount}
        )

    # Feedback Management
    def submit_feedback(
        self,
        course_id: str,
        user_id: str,
        enrollment_id: str,
        rating: int,
        comments: Optional[str] = None,
        content_rating: Optional[int] = None,
        instructor_rating: Optional[int] = None,
        **kwargs: Any,
    ) -> CourseFeedback:
        """Submit course feedback."""
        feedback = CourseFeedback(
            id=str(uuid.uuid4()),
            course_id=course_id,
            user_id=user_id,
            enrollment_id=enrollment_id,
            rating=rating,
            comments=comments,
            content_rating=content_rating,
            instructor_rating=instructor_rating,
            **kwargs,
        )
        return self.registry.create_feedback(feedback)

    def get_course_feedback(self, course_id: str) -> List[CourseFeedback]:
        """Get all feedback for a course."""
        return self.registry.get_course_feedback(course_id)

    def get_average_course_rating(self, course_id: str) -> Optional[float]:
        """Get average rating for a course."""
        return self.registry.get_average_course_rating(course_id)

    # Notification Management
    def send_notification(
        self,
        user_id: str,
        notification_type: NotificationType,
        title: str,
        message: str,
        course_id: Optional[str] = None,
        session_id: Optional[str] = None,
        **kwargs: Any,
    ) -> TrainingNotification:
        """Send a training notification."""
        notification = TrainingNotification(
            id=str(uuid.uuid4()),
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            message=message,
            course_id=course_id,
            session_id=session_id,
            **kwargs,
        )
        return self.registry.create_notification(notification)

    def get_user_notifications(
        self, user_id: str, unread_only: bool = False
    ) -> List[TrainingNotification]:
        """Get notifications for a user."""
        return self.registry.get_user_notifications(user_id, unread_only=unread_only)

    def mark_notification_read(self, notification_id: str) -> bool:
        """Mark a notification as read."""
        return self.registry.mark_notification_read(notification_id)

    # Analytics
    def generate_analytics(self) -> TrainingAnalytics:
        """Generate training analytics."""
        courses = self.registry.list_courses()
        enrollments = self.registry.list_enrollments()
        certificates = list(self.registry._certificates.values())

        # Count courses by type
        courses_by_type: Dict[str, int] = {}
        for course in courses:
            type_name = course.course_type.value
            courses_by_type[type_name] = courses_by_type.get(type_name, 0) + 1

        # Count enrollments by status
        enrollments_by_status: Dict[str, int] = {}
        for enrollment in enrollments:
            status_name = enrollment.status.value
            enrollments_by_status[status_name] = (
                enrollments_by_status.get(status_name, 0) + 1
            )

        # Calculate completion rate
        completed = len(
            [e for e in enrollments if e.status == EnrollmentStatus.COMPLETED]
        )
        completion_rate = (completed / len(enrollments) * 100) if enrollments else 0

        # Calculate average score
        scores = [e.score for e in enrollments if e.score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0

        # Calculate total training hours
        total_hours = sum(e.time_spent_minutes for e in enrollments) / 60

        # Top courses by enrollment
        course_enrollment_counts: Dict[str, int] = {}
        for enrollment in enrollments:
            course_enrollment_counts[enrollment.course_id] = (
                course_enrollment_counts.get(enrollment.course_id, 0) + 1
            )

        top_courses = []
        for course_id, count in sorted(
            course_enrollment_counts.items(), key=lambda x: x[1], reverse=True
        )[:5]:
            course = self.registry.get_course(course_id)
            if course:
                top_courses.append({"course_id": course_id, "title": course.title, "enrollments": count})

        return TrainingAnalytics(
            total_courses=len(courses),
            published_courses=len(
                [c for c in courses if c.status == CourseStatus.PUBLISHED]
            ),
            total_enrollments=len(enrollments),
            active_enrollments=len(
                [
                    e
                    for e in enrollments
                    if e.status in (EnrollmentStatus.ENROLLED, EnrollmentStatus.IN_PROGRESS)
                ]
            ),
            completed_enrollments=completed,
            average_completion_rate=completion_rate,
            average_score=avg_score,
            total_certificates=len(certificates),
            total_training_hours=total_hours,
            courses_by_type=courses_by_type,
            enrollments_by_status=enrollments_by_status,
            top_courses=top_courses,
        )


# ============================================================================
# Global Instance
# ============================================================================

_training_manager: Optional[TrainingManager] = None


def get_training_manager() -> TrainingManager:
    """Get the global training manager instance."""
    global _training_manager
    if _training_manager is None:
        _training_manager = TrainingManager()
    return _training_manager


def set_training_manager(manager: TrainingManager) -> None:
    """Set the global training manager instance."""
    global _training_manager
    _training_manager = manager


def reset_training_manager() -> None:
    """Reset the global training manager instance."""
    global _training_manager
    _training_manager = None
