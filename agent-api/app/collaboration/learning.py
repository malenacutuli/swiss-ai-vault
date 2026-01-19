"""
Learning & Development module for enterprise collaboration.

This module provides comprehensive learning management including:
- Courses with modules and lessons
- Learning paths and curricula
- Enrollment and progress tracking
- Assessments and quizzes
- Certifications and badges
- Skills development tracking
- Training assignments
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Optional
from uuid import uuid4


class CourseType(Enum):
    """Types of courses."""
    SELF_PACED = "self_paced"
    INSTRUCTOR_LED = "instructor_led"
    BLENDED = "blended"
    WEBINAR = "webinar"
    WORKSHOP = "workshop"
    VIDEO = "video"
    READING = "reading"
    HANDS_ON = "hands_on"
    EXTERNAL = "external"


class CourseStatus(Enum):
    """Status of a course."""
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"
    RETIRED = "retired"


class CourseLevel(Enum):
    """Difficulty level of a course."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class EnrollmentStatus(Enum):
    """Status of an enrollment."""
    ENROLLED = "enrolled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    DROPPED = "dropped"
    EXPIRED = "expired"


class ContentType(Enum):
    """Types of learning content."""
    VIDEO = "video"
    DOCUMENT = "document"
    PRESENTATION = "presentation"
    QUIZ = "quiz"
    ASSIGNMENT = "assignment"
    INTERACTIVE = "interactive"
    EXTERNAL_LINK = "external_link"
    SCORM = "scorm"
    DISCUSSION = "discussion"


class AssessmentType(Enum):
    """Types of assessments."""
    QUIZ = "quiz"
    EXAM = "exam"
    ASSIGNMENT = "assignment"
    PROJECT = "project"
    PEER_REVIEW = "peer_review"
    SELF_ASSESSMENT = "self_assessment"


class QuestionType(Enum):
    """Types of assessment questions."""
    MULTIPLE_CHOICE = "multiple_choice"
    MULTIPLE_SELECT = "multiple_select"
    TRUE_FALSE = "true_false"
    SHORT_ANSWER = "short_answer"
    ESSAY = "essay"
    MATCHING = "matching"
    ORDERING = "ordering"
    FILL_BLANK = "fill_blank"


class CertificationType(Enum):
    """Types of certifications."""
    COMPLETION = "completion"
    PROFICIENCY = "proficiency"
    PROFESSIONAL = "professional"
    COMPLIANCE = "compliance"
    SKILL = "skill"


class AssignmentType(Enum):
    """Types of training assignments."""
    REQUIRED = "required"
    RECOMMENDED = "recommended"
    OPTIONAL = "optional"
    COMPLIANCE = "compliance"


@dataclass
class LearningContent:
    """A piece of learning content."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    content_type: ContentType = ContentType.VIDEO

    # Content details
    url: Optional[str] = None
    file_path: Optional[str] = None
    duration_minutes: int = 0

    # Settings
    is_required: bool = True
    order: int = 0

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)


@dataclass
class Lesson:
    """A lesson within a module."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    order: int = 0

    # Content
    content: list[LearningContent] = field(default_factory=list)

    # Requirements
    duration_minutes: int = 0
    is_required: bool = True

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def total_duration(self) -> int:
        """Calculate total duration from content."""
        return sum(c.duration_minutes for c in self.content)


@dataclass
class Module:
    """A module within a course."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    order: int = 0

    # Lessons
    lessons: list[Lesson] = field(default_factory=list)

    # Requirements
    is_required: bool = True
    unlock_after_module_id: Optional[str] = None

    # Assessment
    has_assessment: bool = False
    assessment_id: Optional[str] = None
    passing_score: float = 70.0

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)
    created_at: datetime = field(default_factory=datetime.now)

    @property
    def total_lessons(self) -> int:
        """Count total lessons."""
        return len(self.lessons)

    @property
    def total_duration(self) -> int:
        """Calculate total duration."""
        return sum(lesson.total_duration for lesson in self.lessons)


@dataclass
class Course:
    """A learning course."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    summary: str = ""

    # Classification
    course_type: CourseType = CourseType.SELF_PACED
    status: CourseStatus = CourseStatus.DRAFT
    level: CourseLevel = CourseLevel.BEGINNER

    # Structure
    modules: list[Module] = field(default_factory=list)

    # Requirements
    prerequisites: list[str] = field(default_factory=list)  # Course IDs
    skills_taught: list[str] = field(default_factory=list)
    skills_required: list[str] = field(default_factory=list)

    # Settings
    duration_hours: float = 0.0
    passing_score: float = 70.0
    max_attempts: int = 3
    certificate_on_completion: bool = True

    # Scheduling (for instructor-led)
    instructor_id: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    enrollment_deadline: Optional[datetime] = None
    max_enrollments: Optional[int] = None

    # Media
    thumbnail_url: Optional[str] = None
    preview_url: Optional[str] = None

    # Categories and tags
    category: str = ""
    subcategory: str = ""
    tags: list[str] = field(default_factory=list)

    # Ownership
    organization_id: str = ""
    created_by: str = ""

    # Stats
    enrollment_count: int = 0
    completion_count: int = 0
    average_rating: float = 0.0
    rating_count: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    published_at: Optional[datetime] = None

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def total_modules(self) -> int:
        """Count total modules."""
        return len(self.modules)

    @property
    def total_lessons(self) -> int:
        """Count total lessons."""
        return sum(m.total_lessons for m in self.modules)

    @property
    def completion_rate(self) -> float:
        """Calculate completion rate."""
        if self.enrollment_count == 0:
            return 0.0
        return self.completion_count / self.enrollment_count

    def publish(self) -> None:
        """Publish the course."""
        self.status = CourseStatus.PUBLISHED
        self.published_at = datetime.now()
        self.updated_at = datetime.now()

    def archive(self) -> None:
        """Archive the course."""
        self.status = CourseStatus.ARCHIVED
        self.updated_at = datetime.now()


@dataclass
class LearningPath:
    """A learning path (curriculum) of courses."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""

    # Courses in order
    course_ids: list[str] = field(default_factory=list)

    # Classification
    status: CourseStatus = CourseStatus.DRAFT
    level: CourseLevel = CourseLevel.BEGINNER

    # Requirements
    target_role: Optional[str] = None
    skills_taught: list[str] = field(default_factory=list)

    # Settings
    estimated_hours: float = 0.0
    certificate_on_completion: bool = True

    # Media
    thumbnail_url: Optional[str] = None

    # Categories
    category: str = ""
    tags: list[str] = field(default_factory=list)

    # Ownership
    organization_id: str = ""
    created_by: str = ""

    # Stats
    enrollment_count: int = 0
    completion_count: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Enrollment:
    """An enrollment in a course or learning path."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # What they're enrolled in
    user_id: str = ""
    course_id: Optional[str] = None
    learning_path_id: Optional[str] = None

    # Status
    status: EnrollmentStatus = EnrollmentStatus.ENROLLED

    # Progress
    progress_percentage: float = 0.0
    completed_modules: list[str] = field(default_factory=list)
    completed_lessons: list[str] = field(default_factory=list)
    current_module_id: Optional[str] = None
    current_lesson_id: Optional[str] = None

    # Assessment results
    quiz_scores: dict[str, float] = field(default_factory=dict)
    final_score: Optional[float] = None
    attempts_used: int = 0

    # Time tracking
    time_spent_minutes: int = 0
    last_accessed_at: Optional[datetime] = None

    # Completion
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    certificate_id: Optional[str] = None

    # Assignment
    assigned_by: Optional[str] = None
    due_date: Optional[datetime] = None
    assignment_type: AssignmentType = AssignmentType.OPTIONAL

    # Ownership
    organization_id: str = ""

    # Timestamps
    enrolled_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def start(self) -> None:
        """Start the enrollment."""
        self.status = EnrollmentStatus.IN_PROGRESS
        self.started_at = datetime.now()
        self.updated_at = datetime.now()

    def complete(self, score: float = None) -> None:
        """Complete the enrollment."""
        self.status = EnrollmentStatus.COMPLETED
        self.progress_percentage = 100.0
        self.completed_at = datetime.now()
        if score is not None:
            self.final_score = score
        self.updated_at = datetime.now()

    def fail(self) -> None:
        """Mark enrollment as failed."""
        self.status = EnrollmentStatus.FAILED
        self.updated_at = datetime.now()

    def drop(self) -> None:
        """Drop the enrollment."""
        self.status = EnrollmentStatus.DROPPED
        self.updated_at = datetime.now()

    def is_overdue(self) -> bool:
        """Check if enrollment is overdue."""
        if not self.due_date:
            return False
        return datetime.now() > self.due_date and self.status not in [
            EnrollmentStatus.COMPLETED, EnrollmentStatus.DROPPED
        ]


@dataclass
class AssessmentQuestion:
    """A question in an assessment."""
    id: str = field(default_factory=lambda: str(uuid4()))
    question_type: QuestionType = QuestionType.MULTIPLE_CHOICE
    question_text: str = ""

    # Options for multiple choice
    options: list[str] = field(default_factory=list)
    correct_answers: list[str] = field(default_factory=list)  # For multiple select
    correct_answer: Optional[str] = None  # For single answer

    # Scoring
    points: float = 1.0
    partial_credit: bool = False

    # Explanation
    explanation: str = ""

    # Order
    order: int = 0

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Assessment:
    """An assessment (quiz, exam, etc.)."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    assessment_type: AssessmentType = AssessmentType.QUIZ

    # Questions
    questions: list[AssessmentQuestion] = field(default_factory=list)

    # Settings
    passing_score: float = 70.0
    time_limit_minutes: Optional[int] = None
    max_attempts: int = 3
    shuffle_questions: bool = False
    shuffle_options: bool = False
    show_correct_answers: bool = True

    # Availability
    available_from: Optional[datetime] = None
    available_until: Optional[datetime] = None

    # Ownership
    course_id: Optional[str] = None
    module_id: Optional[str] = None
    organization_id: str = ""

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def total_points(self) -> float:
        """Calculate total points."""
        return sum(q.points for q in self.questions)


@dataclass
class AssessmentAttempt:
    """An attempt at an assessment."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Reference
    assessment_id: str = ""
    user_id: str = ""
    enrollment_id: Optional[str] = None

    # Attempt info
    attempt_number: int = 1

    # Answers
    answers: dict[str, Any] = field(default_factory=dict)  # question_id -> answer

    # Results
    score: float = 0.0
    percentage: float = 0.0
    passed: bool = False
    points_earned: float = 0.0
    points_possible: float = 0.0

    # Question results
    question_results: dict[str, bool] = field(default_factory=dict)  # question_id -> correct

    # Timing
    started_at: datetime = field(default_factory=datetime.now)
    submitted_at: Optional[datetime] = None
    time_spent_seconds: int = 0

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Certificate:
    """A certificate earned for completion."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Reference
    user_id: str = ""
    course_id: Optional[str] = None
    learning_path_id: Optional[str] = None

    # Certificate details
    certificate_type: CertificationType = CertificationType.COMPLETION
    title: str = ""
    description: str = ""

    # Verification
    certificate_number: str = field(default_factory=lambda: str(uuid4())[:8].upper())
    verification_url: Optional[str] = None

    # Validity
    issued_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    is_valid: bool = True

    # Achievement details
    final_score: Optional[float] = None
    skills_certified: list[str] = field(default_factory=list)

    # Ownership
    organization_id: str = ""
    issued_by: str = ""

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    def revoke(self) -> None:
        """Revoke the certificate."""
        self.is_valid = False

    def is_expired(self) -> bool:
        """Check if certificate is expired."""
        if not self.expires_at:
            return False
        return datetime.now() > self.expires_at


@dataclass
class SkillProgress:
    """Progress in developing a skill."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Reference
    user_id: str = ""
    skill_name: str = ""

    # Progress
    level: int = 0  # 0-100
    courses_completed: list[str] = field(default_factory=list)
    assessments_passed: list[str] = field(default_factory=list)

    # Evidence
    certificates: list[str] = field(default_factory=list)
    endorsements: int = 0

    # Timestamps
    started_at: datetime = field(default_factory=datetime.now)
    last_updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class CourseReview:
    """A review of a course."""
    id: str = field(default_factory=lambda: str(uuid4()))

    # Reference
    course_id: str = ""
    user_id: str = ""

    # Review
    rating: int = 0  # 1-5
    title: str = ""
    comment: str = ""

    # Helpfulness
    helpful_count: int = 0

    # Moderation
    is_approved: bool = True
    is_featured: bool = False

    # Timestamps
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)

    # Metadata
    metadata: dict[str, Any] = field(default_factory=dict)


class LearningRegistry:
    """Registry for managing learning content."""

    def __init__(self):
        self._courses: dict[str, Course] = {}
        self._learning_paths: dict[str, LearningPath] = {}
        self._enrollments: dict[str, Enrollment] = {}
        self._assessments: dict[str, Assessment] = {}
        self._attempts: dict[str, AssessmentAttempt] = {}
        self._certificates: dict[str, Certificate] = {}
        self._skill_progress: dict[str, SkillProgress] = {}
        self._reviews: dict[str, CourseReview] = {}

    # Course CRUD
    def create_course(self, course: Course) -> Course:
        """Create a new course."""
        self._courses[course.id] = course
        return course

    def get_course(self, course_id: str) -> Optional[Course]:
        """Get a course by ID."""
        return self._courses.get(course_id)

    def update_course(self, course: Course) -> Course:
        """Update an existing course."""
        course.updated_at = datetime.now()
        self._courses[course.id] = course
        return course

    def delete_course(self, course_id: str) -> bool:
        """Delete a course."""
        if course_id in self._courses:
            del self._courses[course_id]
            return True
        return False

    def list_courses(
        self,
        organization_id: str = None,
        status: CourseStatus = None,
        course_type: CourseType = None,
        level: CourseLevel = None,
        category: str = None,
        instructor_id: str = None,
        tags: list[str] = None
    ) -> list[Course]:
        """List courses with optional filters."""
        results = []

        for course in self._courses.values():
            if organization_id and course.organization_id != organization_id:
                continue
            if status and course.status != status:
                continue
            if course_type and course.course_type != course_type:
                continue
            if level and course.level != level:
                continue
            if category and course.category != category:
                continue
            if instructor_id and course.instructor_id != instructor_id:
                continue
            if tags and not any(tag in course.tags for tag in tags):
                continue

            results.append(course)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    def search_courses(self, query: str, organization_id: str = None) -> list[Course]:
        """Search courses by title or description."""
        query_lower = query.lower()
        results = []

        for course in self._courses.values():
            if organization_id and course.organization_id != organization_id:
                continue
            if course.status != CourseStatus.PUBLISHED:
                continue
            if query_lower in course.title.lower() or query_lower in course.description.lower():
                results.append(course)

        return results

    # Learning Path CRUD
    def create_learning_path(self, path: LearningPath) -> LearningPath:
        """Create a new learning path."""
        self._learning_paths[path.id] = path
        return path

    def get_learning_path(self, path_id: str) -> Optional[LearningPath]:
        """Get a learning path by ID."""
        return self._learning_paths.get(path_id)

    def update_learning_path(self, path: LearningPath) -> LearningPath:
        """Update an existing learning path."""
        path.updated_at = datetime.now()
        self._learning_paths[path.id] = path
        return path

    def delete_learning_path(self, path_id: str) -> bool:
        """Delete a learning path."""
        if path_id in self._learning_paths:
            del self._learning_paths[path_id]
            return True
        return False

    def list_learning_paths(
        self,
        organization_id: str = None,
        status: CourseStatus = None,
        category: str = None
    ) -> list[LearningPath]:
        """List learning paths with optional filters."""
        results = []

        for path in self._learning_paths.values():
            if organization_id and path.organization_id != organization_id:
                continue
            if status and path.status != status:
                continue
            if category and path.category != category:
                continue

            results.append(path)

        return sorted(results, key=lambda x: x.created_at, reverse=True)

    # Enrollment CRUD
    def create_enrollment(self, enrollment: Enrollment) -> Enrollment:
        """Create a new enrollment."""
        self._enrollments[enrollment.id] = enrollment

        # Update course/path stats
        if enrollment.course_id:
            course = self.get_course(enrollment.course_id)
            if course:
                course.enrollment_count += 1
        if enrollment.learning_path_id:
            path = self.get_learning_path(enrollment.learning_path_id)
            if path:
                path.enrollment_count += 1

        return enrollment

    def get_enrollment(self, enrollment_id: str) -> Optional[Enrollment]:
        """Get an enrollment by ID."""
        return self._enrollments.get(enrollment_id)

    def get_enrollment_by_user(
        self,
        user_id: str,
        course_id: str = None,
        learning_path_id: str = None
    ) -> Optional[Enrollment]:
        """Get enrollment by user and course/path."""
        for enrollment in self._enrollments.values():
            if enrollment.user_id != user_id:
                continue
            if course_id and enrollment.course_id == course_id:
                return enrollment
            if learning_path_id and enrollment.learning_path_id == learning_path_id:
                return enrollment
        return None

    def update_enrollment(self, enrollment: Enrollment) -> Enrollment:
        """Update an existing enrollment."""
        old_enrollment = self._enrollments.get(enrollment.id)
        enrollment.updated_at = datetime.now()
        self._enrollments[enrollment.id] = enrollment

        # Update completion stats if just completed
        if old_enrollment:
            was_completed = old_enrollment.status == EnrollmentStatus.COMPLETED
            is_completed = enrollment.status == EnrollmentStatus.COMPLETED

            if not was_completed and is_completed:
                if enrollment.course_id:
                    course = self.get_course(enrollment.course_id)
                    if course:
                        course.completion_count += 1
                if enrollment.learning_path_id:
                    path = self.get_learning_path(enrollment.learning_path_id)
                    if path:
                        path.completion_count += 1

        return enrollment

    def delete_enrollment(self, enrollment_id: str) -> bool:
        """Delete an enrollment."""
        if enrollment_id in self._enrollments:
            del self._enrollments[enrollment_id]
            return True
        return False

    def list_enrollments(
        self,
        user_id: str = None,
        course_id: str = None,
        learning_path_id: str = None,
        status: EnrollmentStatus = None,
        organization_id: str = None
    ) -> list[Enrollment]:
        """List enrollments with optional filters."""
        results = []

        for enrollment in self._enrollments.values():
            if user_id and enrollment.user_id != user_id:
                continue
            if course_id and enrollment.course_id != course_id:
                continue
            if learning_path_id and enrollment.learning_path_id != learning_path_id:
                continue
            if status and enrollment.status != status:
                continue
            if organization_id and enrollment.organization_id != organization_id:
                continue

            results.append(enrollment)

        return sorted(results, key=lambda x: x.enrolled_at, reverse=True)

    def get_user_enrollments(
        self,
        user_id: str,
        active_only: bool = False
    ) -> list[Enrollment]:
        """Get all enrollments for a user."""
        enrollments = [e for e in self._enrollments.values() if e.user_id == user_id]

        if active_only:
            enrollments = [
                e for e in enrollments
                if e.status in [EnrollmentStatus.ENROLLED, EnrollmentStatus.IN_PROGRESS]
            ]

        return sorted(enrollments, key=lambda x: x.enrolled_at, reverse=True)

    def get_overdue_enrollments(self, user_id: str = None) -> list[Enrollment]:
        """Get overdue enrollments."""
        results = []
        for enrollment in self._enrollments.values():
            if user_id and enrollment.user_id != user_id:
                continue
            if enrollment.is_overdue():
                results.append(enrollment)
        return results

    # Assessment CRUD
    def create_assessment(self, assessment: Assessment) -> Assessment:
        """Create a new assessment."""
        self._assessments[assessment.id] = assessment
        return assessment

    def get_assessment(self, assessment_id: str) -> Optional[Assessment]:
        """Get an assessment by ID."""
        return self._assessments.get(assessment_id)

    def update_assessment(self, assessment: Assessment) -> Assessment:
        """Update an existing assessment."""
        assessment.updated_at = datetime.now()
        self._assessments[assessment.id] = assessment
        return assessment

    def list_assessments(
        self,
        course_id: str = None,
        module_id: str = None,
        assessment_type: AssessmentType = None
    ) -> list[Assessment]:
        """List assessments with optional filters."""
        results = []

        for assessment in self._assessments.values():
            if course_id and assessment.course_id != course_id:
                continue
            if module_id and assessment.module_id != module_id:
                continue
            if assessment_type and assessment.assessment_type != assessment_type:
                continue

            results.append(assessment)

        return results

    # Assessment Attempt CRUD
    def create_attempt(self, attempt: AssessmentAttempt) -> AssessmentAttempt:
        """Create a new assessment attempt."""
        self._attempts[attempt.id] = attempt
        return attempt

    def get_attempt(self, attempt_id: str) -> Optional[AssessmentAttempt]:
        """Get an attempt by ID."""
        return self._attempts.get(attempt_id)

    def update_attempt(self, attempt: AssessmentAttempt) -> AssessmentAttempt:
        """Update an existing attempt."""
        self._attempts[attempt.id] = attempt
        return attempt

    def list_attempts(
        self,
        user_id: str = None,
        assessment_id: str = None
    ) -> list[AssessmentAttempt]:
        """List attempts with optional filters."""
        results = []

        for attempt in self._attempts.values():
            if user_id and attempt.user_id != user_id:
                continue
            if assessment_id and attempt.assessment_id != assessment_id:
                continue

            results.append(attempt)

        return sorted(results, key=lambda x: x.started_at, reverse=True)

    def get_user_attempts(self, user_id: str, assessment_id: str) -> list[AssessmentAttempt]:
        """Get all attempts by a user for an assessment."""
        return sorted(
            [a for a in self._attempts.values()
             if a.user_id == user_id and a.assessment_id == assessment_id],
            key=lambda x: x.attempt_number
        )

    # Certificate CRUD
    def create_certificate(self, certificate: Certificate) -> Certificate:
        """Create a new certificate."""
        self._certificates[certificate.id] = certificate
        return certificate

    def get_certificate(self, certificate_id: str) -> Optional[Certificate]:
        """Get a certificate by ID."""
        return self._certificates.get(certificate_id)

    def get_certificate_by_number(self, certificate_number: str) -> Optional[Certificate]:
        """Get a certificate by its number."""
        for cert in self._certificates.values():
            if cert.certificate_number == certificate_number:
                return cert
        return None

    def list_certificates(
        self,
        user_id: str = None,
        course_id: str = None,
        is_valid: bool = None
    ) -> list[Certificate]:
        """List certificates with optional filters."""
        results = []

        for cert in self._certificates.values():
            if user_id and cert.user_id != user_id:
                continue
            if course_id and cert.course_id != course_id:
                continue
            if is_valid is not None and cert.is_valid != is_valid:
                continue

            results.append(cert)

        return sorted(results, key=lambda x: x.issued_at, reverse=True)

    # Skill Progress CRUD
    def create_skill_progress(self, progress: SkillProgress) -> SkillProgress:
        """Create skill progress."""
        self._skill_progress[progress.id] = progress
        return progress

    def get_skill_progress(self, user_id: str, skill_name: str) -> Optional[SkillProgress]:
        """Get skill progress for a user."""
        for progress in self._skill_progress.values():
            if progress.user_id == user_id and progress.skill_name == skill_name:
                return progress
        return None

    def update_skill_progress(self, progress: SkillProgress) -> SkillProgress:
        """Update skill progress."""
        progress.last_updated_at = datetime.now()
        self._skill_progress[progress.id] = progress
        return progress

    def list_skill_progress(self, user_id: str) -> list[SkillProgress]:
        """List all skill progress for a user."""
        return [p for p in self._skill_progress.values() if p.user_id == user_id]

    # Review CRUD
    def create_review(self, review: CourseReview) -> CourseReview:
        """Create a course review."""
        self._reviews[review.id] = review

        # Update course rating
        course = self.get_course(review.course_id)
        if course:
            course.rating_count += 1
            total_rating = course.average_rating * (course.rating_count - 1) + review.rating
            course.average_rating = total_rating / course.rating_count

        return review

    def get_review(self, review_id: str) -> Optional[CourseReview]:
        """Get a review by ID."""
        return self._reviews.get(review_id)

    def list_reviews(
        self,
        course_id: str = None,
        user_id: str = None,
        is_approved: bool = None
    ) -> list[CourseReview]:
        """List reviews with optional filters."""
        results = []

        for review in self._reviews.values():
            if course_id and review.course_id != course_id:
                continue
            if user_id and review.user_id != user_id:
                continue
            if is_approved is not None and review.is_approved != is_approved:
                continue

            results.append(review)

        return sorted(results, key=lambda x: x.created_at, reverse=True)


class LearningManager:
    """High-level API for managing learning content."""

    def __init__(self, registry: LearningRegistry = None):
        self.registry = registry or LearningRegistry()

    # Course Management
    def create_course(
        self,
        title: str,
        organization_id: str,
        created_by: str,
        description: str = "",
        course_type: CourseType = CourseType.SELF_PACED,
        level: CourseLevel = CourseLevel.BEGINNER,
        category: str = "",
        tags: list[str] = None,
        **kwargs
    ) -> Course:
        """Create a new course."""
        course = Course(
            title=title,
            description=description,
            organization_id=organization_id,
            created_by=created_by,
            course_type=course_type,
            level=level,
            category=category,
            tags=tags or [],
            **kwargs
        )
        return self.registry.create_course(course)

    def add_module(
        self,
        course_id: str,
        title: str,
        description: str = "",
        **kwargs
    ) -> Optional[Course]:
        """Add a module to a course."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        module = Module(
            title=title,
            description=description,
            order=len(course.modules),
            **kwargs
        )
        course.modules.append(module)
        return self.registry.update_course(course)

    def add_lesson(
        self,
        course_id: str,
        module_id: str,
        title: str,
        description: str = "",
        content: list[LearningContent] = None,
        **kwargs
    ) -> Optional[Course]:
        """Add a lesson to a module."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        for module in course.modules:
            if module.id == module_id:
                lesson = Lesson(
                    title=title,
                    description=description,
                    content=content or [],
                    order=len(module.lessons),
                    **kwargs
                )
                module.lessons.append(lesson)
                return self.registry.update_course(course)

        return None

    def publish_course(self, course_id: str) -> Optional[Course]:
        """Publish a course."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        course.publish()
        return self.registry.update_course(course)

    def archive_course(self, course_id: str) -> Optional[Course]:
        """Archive a course."""
        course = self.registry.get_course(course_id)
        if not course:
            return None

        course.archive()
        return self.registry.update_course(course)

    def get_course_catalog(
        self,
        organization_id: str,
        category: str = None,
        level: CourseLevel = None,
        limit: int = 50
    ) -> list[Course]:
        """Get published course catalog."""
        courses = self.registry.list_courses(
            organization_id=organization_id,
            status=CourseStatus.PUBLISHED,
            category=category,
            level=level
        )
        return courses[:limit]

    # Learning Path Management
    def create_learning_path(
        self,
        title: str,
        organization_id: str,
        created_by: str,
        course_ids: list[str],
        description: str = "",
        **kwargs
    ) -> LearningPath:
        """Create a new learning path."""
        path = LearningPath(
            title=title,
            description=description,
            organization_id=organization_id,
            created_by=created_by,
            course_ids=course_ids,
            **kwargs
        )
        return self.registry.create_learning_path(path)

    def add_course_to_path(
        self,
        path_id: str,
        course_id: str
    ) -> Optional[LearningPath]:
        """Add a course to a learning path."""
        path = self.registry.get_learning_path(path_id)
        if not path:
            return None

        if course_id not in path.course_ids:
            path.course_ids.append(course_id)
            return self.registry.update_learning_path(path)

        return path

    # Enrollment Management
    def enroll_user(
        self,
        user_id: str,
        organization_id: str,
        course_id: str = None,
        learning_path_id: str = None,
        assigned_by: str = None,
        due_date: datetime = None,
        assignment_type: AssignmentType = AssignmentType.OPTIONAL
    ) -> Optional[Enrollment]:
        """Enroll a user in a course or learning path."""
        # Check if already enrolled
        existing = self.registry.get_enrollment_by_user(
            user_id, course_id, learning_path_id
        )
        if existing and existing.status not in [EnrollmentStatus.DROPPED, EnrollmentStatus.EXPIRED]:
            return existing

        enrollment = Enrollment(
            user_id=user_id,
            course_id=course_id,
            learning_path_id=learning_path_id,
            organization_id=organization_id,
            assigned_by=assigned_by,
            due_date=due_date,
            assignment_type=assignment_type
        )
        return self.registry.create_enrollment(enrollment)

    def bulk_enroll(
        self,
        user_ids: list[str],
        organization_id: str,
        course_id: str = None,
        learning_path_id: str = None,
        assigned_by: str = None,
        due_date: datetime = None,
        assignment_type: AssignmentType = AssignmentType.REQUIRED
    ) -> list[Enrollment]:
        """Enroll multiple users."""
        enrollments = []
        for user_id in user_ids:
            enrollment = self.enroll_user(
                user_id=user_id,
                organization_id=organization_id,
                course_id=course_id,
                learning_path_id=learning_path_id,
                assigned_by=assigned_by,
                due_date=due_date,
                assignment_type=assignment_type
            )
            if enrollment:
                enrollments.append(enrollment)
        return enrollments

    def start_course(
        self,
        enrollment_id: str,
        module_id: str = None,
        lesson_id: str = None
    ) -> Optional[Enrollment]:
        """Start a course (mark enrollment as in progress)."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not enrollment:
            return None

        enrollment.start()
        if module_id:
            enrollment.current_module_id = module_id
        if lesson_id:
            enrollment.current_lesson_id = lesson_id

        return self.registry.update_enrollment(enrollment)

    def complete_lesson(
        self,
        enrollment_id: str,
        lesson_id: str,
        time_spent_minutes: int = 0
    ) -> Optional[Enrollment]:
        """Mark a lesson as complete."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not enrollment:
            return None

        if lesson_id not in enrollment.completed_lessons:
            enrollment.completed_lessons.append(lesson_id)
            enrollment.time_spent_minutes += time_spent_minutes
            enrollment.last_accessed_at = datetime.now()

            # Calculate progress
            if enrollment.course_id:
                course = self.registry.get_course(enrollment.course_id)
                if course and course.total_lessons > 0:
                    enrollment.progress_percentage = (
                        len(enrollment.completed_lessons) / course.total_lessons * 100
                    )

        return self.registry.update_enrollment(enrollment)

    def complete_module(
        self,
        enrollment_id: str,
        module_id: str
    ) -> Optional[Enrollment]:
        """Mark a module as complete."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not enrollment:
            return None

        if module_id not in enrollment.completed_modules:
            enrollment.completed_modules.append(module_id)

        return self.registry.update_enrollment(enrollment)

    def complete_course(
        self,
        enrollment_id: str,
        score: float = None
    ) -> Optional[Enrollment]:
        """Complete a course enrollment."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not enrollment:
            return None

        enrollment.complete(score)

        # Issue certificate if applicable
        if enrollment.course_id:
            course = self.registry.get_course(enrollment.course_id)
            if course and course.certificate_on_completion:
                cert = self.issue_certificate(
                    user_id=enrollment.user_id,
                    course_id=enrollment.course_id,
                    organization_id=enrollment.organization_id,
                    final_score=score
                )
                enrollment.certificate_id = cert.id

        return self.registry.update_enrollment(enrollment)

    def drop_enrollment(self, enrollment_id: str) -> Optional[Enrollment]:
        """Drop an enrollment."""
        enrollment = self.registry.get_enrollment(enrollment_id)
        if not enrollment:
            return None

        enrollment.drop()
        return self.registry.update_enrollment(enrollment)

    def get_my_learning(
        self,
        user_id: str,
        active_only: bool = True
    ) -> list[Enrollment]:
        """Get a user's learning enrollments."""
        return self.registry.get_user_enrollments(user_id, active_only)

    def get_assigned_training(
        self,
        user_id: str,
        include_completed: bool = False
    ) -> list[Enrollment]:
        """Get training assigned to a user."""
        enrollments = self.registry.list_enrollments(user_id=user_id)

        if not include_completed:
            enrollments = [
                e for e in enrollments
                if e.status != EnrollmentStatus.COMPLETED
            ]

        return [
            e for e in enrollments
            if e.assignment_type in [AssignmentType.REQUIRED, AssignmentType.COMPLIANCE]
        ]

    # Assessment Management
    def create_assessment(
        self,
        title: str,
        organization_id: str,
        assessment_type: AssessmentType = AssessmentType.QUIZ,
        questions: list[AssessmentQuestion] = None,
        course_id: str = None,
        module_id: str = None,
        passing_score: float = 70.0,
        **kwargs
    ) -> Assessment:
        """Create an assessment."""
        assessment = Assessment(
            title=title,
            organization_id=organization_id,
            assessment_type=assessment_type,
            questions=questions or [],
            course_id=course_id,
            module_id=module_id,
            passing_score=passing_score,
            **kwargs
        )
        return self.registry.create_assessment(assessment)

    def add_question(
        self,
        assessment_id: str,
        question_text: str,
        question_type: QuestionType = QuestionType.MULTIPLE_CHOICE,
        options: list[str] = None,
        correct_answer: str = None,
        points: float = 1.0,
        **kwargs
    ) -> Optional[Assessment]:
        """Add a question to an assessment."""
        assessment = self.registry.get_assessment(assessment_id)
        if not assessment:
            return None

        question = AssessmentQuestion(
            question_text=question_text,
            question_type=question_type,
            options=options or [],
            correct_answer=correct_answer,
            points=points,
            order=len(assessment.questions),
            **kwargs
        )
        assessment.questions.append(question)
        return self.registry.update_assessment(assessment)

    def start_assessment(
        self,
        assessment_id: str,
        user_id: str,
        enrollment_id: str = None
    ) -> Optional[AssessmentAttempt]:
        """Start an assessment attempt."""
        assessment = self.registry.get_assessment(assessment_id)
        if not assessment:
            return None

        # Check max attempts
        existing_attempts = self.registry.get_user_attempts(user_id, assessment_id)
        if len(existing_attempts) >= assessment.max_attempts:
            return None

        attempt = AssessmentAttempt(
            assessment_id=assessment_id,
            user_id=user_id,
            enrollment_id=enrollment_id,
            attempt_number=len(existing_attempts) + 1,
            points_possible=assessment.total_points
        )
        return self.registry.create_attempt(attempt)

    def submit_assessment(
        self,
        attempt_id: str,
        answers: dict[str, Any]
    ) -> Optional[AssessmentAttempt]:
        """Submit an assessment attempt."""
        attempt = self.registry.get_attempt(attempt_id)
        if not attempt:
            return None

        assessment = self.registry.get_assessment(attempt.assessment_id)
        if not assessment:
            return None

        attempt.answers = answers
        attempt.submitted_at = datetime.now()
        attempt.time_spent_seconds = int(
            (attempt.submitted_at - attempt.started_at).total_seconds()
        )

        # Grade the assessment
        points_earned = 0
        for question in assessment.questions:
            user_answer = answers.get(question.id)
            is_correct = False

            if question.question_type == QuestionType.MULTIPLE_CHOICE:
                is_correct = user_answer == question.correct_answer
            elif question.question_type == QuestionType.TRUE_FALSE:
                is_correct = user_answer == question.correct_answer
            elif question.question_type == QuestionType.MULTIPLE_SELECT:
                if user_answer and question.correct_answers:
                    is_correct = set(user_answer) == set(question.correct_answers)

            attempt.question_results[question.id] = is_correct
            if is_correct:
                points_earned += question.points

        attempt.points_earned = points_earned
        attempt.percentage = (points_earned / attempt.points_possible * 100) if attempt.points_possible > 0 else 0
        attempt.passed = attempt.percentage >= assessment.passing_score
        attempt.score = attempt.percentage

        return self.registry.update_attempt(attempt)

    def get_assessment_results(
        self,
        user_id: str,
        assessment_id: str
    ) -> list[AssessmentAttempt]:
        """Get a user's assessment results."""
        return self.registry.get_user_attempts(user_id, assessment_id)

    # Certificate Management
    def issue_certificate(
        self,
        user_id: str,
        organization_id: str,
        course_id: str = None,
        learning_path_id: str = None,
        certificate_type: CertificationType = CertificationType.COMPLETION,
        title: str = None,
        final_score: float = None,
        expires_in_days: int = None,
        issued_by: str = ""
    ) -> Certificate:
        """Issue a certificate."""
        # Generate title if not provided
        if not title:
            if course_id:
                course = self.registry.get_course(course_id)
                title = f"Certificate of Completion: {course.title}" if course else "Certificate"
            elif learning_path_id:
                path = self.registry.get_learning_path(learning_path_id)
                title = f"Certificate of Completion: {path.title}" if path else "Certificate"
            else:
                title = "Certificate of Completion"

        certificate = Certificate(
            user_id=user_id,
            course_id=course_id,
            learning_path_id=learning_path_id,
            organization_id=organization_id,
            certificate_type=certificate_type,
            title=title,
            final_score=final_score,
            issued_by=issued_by,
            expires_at=datetime.now() + timedelta(days=expires_in_days) if expires_in_days else None
        )
        return self.registry.create_certificate(certificate)

    def verify_certificate(self, certificate_number: str) -> Optional[Certificate]:
        """Verify a certificate by its number."""
        cert = self.registry.get_certificate_by_number(certificate_number)
        if cert and cert.is_valid and not cert.is_expired():
            return cert
        return None

    def get_user_certificates(self, user_id: str) -> list[Certificate]:
        """Get all certificates for a user."""
        return self.registry.list_certificates(user_id=user_id, is_valid=True)

    # Progress & Analytics
    def get_learning_progress(self, user_id: str) -> dict[str, Any]:
        """Get overall learning progress for a user."""
        enrollments = self.registry.get_user_enrollments(user_id)

        completed = sum(1 for e in enrollments if e.status == EnrollmentStatus.COMPLETED)
        in_progress = sum(1 for e in enrollments if e.status == EnrollmentStatus.IN_PROGRESS)
        total_time = sum(e.time_spent_minutes for e in enrollments)

        return {
            "total_enrollments": len(enrollments),
            "completed": completed,
            "in_progress": in_progress,
            "completion_rate": completed / len(enrollments) if enrollments else 0,
            "total_time_minutes": total_time,
            "certificates_earned": len(self.registry.list_certificates(user_id=user_id, is_valid=True))
        }

    def get_course_analytics(self, course_id: str) -> dict[str, Any]:
        """Get analytics for a course."""
        course = self.registry.get_course(course_id)
        if not course:
            return {}

        enrollments = self.registry.list_enrollments(course_id=course_id)

        status_dist = {}
        for enrollment in enrollments:
            status = enrollment.status.value
            status_dist[status] = status_dist.get(status, 0) + 1

        total_time = sum(e.time_spent_minutes for e in enrollments)
        avg_time = total_time / len(enrollments) if enrollments else 0

        scores = [e.final_score for e in enrollments if e.final_score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0

        return {
            "enrollment_count": course.enrollment_count,
            "completion_count": course.completion_count,
            "completion_rate": course.completion_rate,
            "average_rating": course.average_rating,
            "rating_count": course.rating_count,
            "status_distribution": status_dist,
            "average_time_minutes": avg_time,
            "average_score": avg_score
        }

    # Review Management
    def add_review(
        self,
        course_id: str,
        user_id: str,
        rating: int,
        title: str = "",
        comment: str = ""
    ) -> CourseReview:
        """Add a course review."""
        review = CourseReview(
            course_id=course_id,
            user_id=user_id,
            rating=rating,
            title=title,
            comment=comment
        )
        return self.registry.create_review(review)

    def get_course_reviews(
        self,
        course_id: str,
        limit: int = 20
    ) -> list[CourseReview]:
        """Get reviews for a course."""
        reviews = self.registry.list_reviews(course_id=course_id, is_approved=True)
        return reviews[:limit]


# Global instance management
_learning_manager: Optional[LearningManager] = None


def get_learning_manager() -> LearningManager:
    """Get the global learning manager instance."""
    global _learning_manager
    if _learning_manager is None:
        _learning_manager = LearningManager()
    return _learning_manager


def set_learning_manager(manager: LearningManager) -> None:
    """Set the global learning manager instance."""
    global _learning_manager
    _learning_manager = manager


def reset_learning_manager() -> None:
    """Reset the global learning manager instance."""
    global _learning_manager
    _learning_manager = None
