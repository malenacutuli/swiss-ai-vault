"""
Surveys & Polls module for enterprise collaboration.

This module provides comprehensive survey and polling functionality including:
- Survey creation and management
- Multiple question types (multiple choice, rating, text, matrix, etc.)
- Poll creation for quick votes
- Survey templates
- Response collection and analysis
- Anonymous response support
- Distribution management
- Results analytics and reporting
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ============================================================
# Enums
# ============================================================

class SurveyType(Enum):
    """Types of surveys."""
    GENERAL = "general"
    FEEDBACK = "feedback"
    PULSE = "pulse"
    ENGAGEMENT = "engagement"
    SATISFACTION = "satisfaction"
    EXIT = "exit"
    ONBOARDING = "onboarding"
    TRAINING = "training"
    EVENT = "event"
    PRODUCT = "product"
    RESEARCH = "research"
    ASSESSMENT = "assessment"


class SurveyStatus(Enum):
    """Survey lifecycle status."""
    DRAFT = "draft"
    SCHEDULED = "scheduled"
    ACTIVE = "active"
    PAUSED = "paused"
    CLOSED = "closed"
    ARCHIVED = "archived"


class QuestionType(Enum):
    """Types of survey questions."""
    SINGLE_CHOICE = "single_choice"
    MULTIPLE_CHOICE = "multiple_choice"
    TEXT = "text"
    LONG_TEXT = "long_text"
    RATING = "rating"
    SCALE = "scale"
    NPS = "nps"
    MATRIX = "matrix"
    RANKING = "ranking"
    DATE = "date"
    FILE_UPLOAD = "file_upload"
    DROPDOWN = "dropdown"
    YES_NO = "yes_no"
    SLIDER = "slider"


class ResponseStatus(Enum):
    """Status of a survey response."""
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    ABANDONED = "abandoned"


class DistributionMethod(Enum):
    """Methods for distributing surveys."""
    EMAIL = "email"
    LINK = "link"
    EMBEDDED = "embedded"
    QR_CODE = "qr_code"
    SMS = "sms"
    IN_APP = "in_app"
    SLACK = "slack"
    TEAMS = "teams"


class DistributionStatus(Enum):
    """Status of survey distribution."""
    PENDING = "pending"
    SENT = "sent"
    DELIVERED = "delivered"
    OPENED = "opened"
    STARTED = "started"
    COMPLETED = "completed"
    BOUNCED = "bounced"
    FAILED = "failed"


class PollType(Enum):
    """Types of polls."""
    SINGLE_VOTE = "single_vote"
    MULTIPLE_VOTE = "multiple_vote"
    RANKED_CHOICE = "ranked_choice"
    RATING = "rating"


class PollStatus(Enum):
    """Poll lifecycle status."""
    DRAFT = "draft"
    ACTIVE = "active"
    CLOSED = "closed"
    ARCHIVED = "archived"


class SurveyVisibility(Enum):
    """Visibility settings for surveys."""
    PUBLIC = "public"
    PRIVATE = "private"
    PASSWORD_PROTECTED = "password_protected"
    INVITE_ONLY = "invite_only"


# ============================================================
# Data Models
# ============================================================

@dataclass
class QuestionOption:
    """Option for choice-based questions."""
    id: str = field(default_factory=lambda: str(uuid4()))
    text: str = ""
    value: Optional[str] = None
    image_url: Optional[str] = None
    order: int = 0
    is_other: bool = False
    skip_logic_target: Optional[str] = None  # Question ID to skip to


@dataclass
class QuestionValidation:
    """Validation rules for questions."""
    required: bool = False
    min_length: Optional[int] = None
    max_length: Optional[int] = None
    min_value: Optional[float] = None
    max_value: Optional[float] = None
    min_selections: Optional[int] = None
    max_selections: Optional[int] = None
    pattern: Optional[str] = None  # Regex pattern
    custom_error_message: Optional[str] = None


@dataclass
class MatrixRow:
    """Row in a matrix question."""
    id: str = field(default_factory=lambda: str(uuid4()))
    text: str = ""
    order: int = 0


@dataclass
class MatrixColumn:
    """Column in a matrix question."""
    id: str = field(default_factory=lambda: str(uuid4()))
    text: str = ""
    value: Optional[str] = None
    order: int = 0


@dataclass
class SurveyQuestion:
    """Question in a survey."""
    id: str = field(default_factory=lambda: str(uuid4()))
    survey_id: str = ""
    section_id: Optional[str] = None
    question_type: QuestionType = QuestionType.TEXT
    text: str = ""
    description: Optional[str] = None
    order: int = 0
    options: List[QuestionOption] = field(default_factory=list)
    validation: QuestionValidation = field(default_factory=QuestionValidation)
    # For rating/scale questions
    scale_min: int = 1
    scale_max: int = 5
    scale_min_label: Optional[str] = None
    scale_max_label: Optional[str] = None
    # For matrix questions
    matrix_rows: List[MatrixRow] = field(default_factory=list)
    matrix_columns: List[MatrixColumn] = field(default_factory=list)
    # Skip logic
    show_if_question_id: Optional[str] = None
    show_if_answer_values: List[str] = field(default_factory=list)
    # Metadata
    is_randomized: bool = False
    allow_other: bool = False
    other_text_label: str = "Other"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SurveySection:
    """Section/page in a survey."""
    id: str = field(default_factory=lambda: str(uuid4()))
    survey_id: str = ""
    title: str = ""
    description: Optional[str] = None
    order: int = 0
    is_randomized: bool = False
    show_if_question_id: Optional[str] = None
    show_if_answer_values: List[str] = field(default_factory=list)
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SurveySettings:
    """Settings for a survey."""
    allow_anonymous: bool = True
    show_progress_bar: bool = True
    allow_save_and_continue: bool = True
    randomize_questions: bool = False
    randomize_options: bool = False
    one_response_per_user: bool = True
    require_login: bool = False
    show_question_numbers: bool = True
    allow_back_navigation: bool = True
    auto_save: bool = True
    completion_redirect_url: Optional[str] = None
    time_limit_minutes: Optional[int] = None
    response_limit: Optional[int] = None
    password: Optional[str] = None
    start_message: Optional[str] = None
    end_message: str = "Thank you for completing this survey!"
    closed_message: str = "This survey is no longer accepting responses."


@dataclass
class Survey:
    """Survey definition."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    title: str = ""
    description: Optional[str] = None
    survey_type: SurveyType = SurveyType.GENERAL
    status: SurveyStatus = SurveyStatus.DRAFT
    visibility: SurveyVisibility = SurveyVisibility.PRIVATE
    settings: SurveySettings = field(default_factory=SurveySettings)
    created_by: str = ""
    owner_id: str = ""
    template_id: Optional[str] = None
    # Scheduling
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    # Branding
    logo_url: Optional[str] = None
    theme_color: Optional[str] = None
    background_color: Optional[str] = None
    # Statistics (cached)
    response_count: int = 0
    completion_rate: float = 0.0
    average_completion_time: Optional[float] = None  # seconds
    # Metadata
    tags: List[str] = field(default_factory=list)
    category: Optional[str] = None
    language: str = "en"
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    published_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None


@dataclass
class QuestionAnswer:
    """Answer to a single question."""
    question_id: str = ""
    answer_value: Any = None  # Can be string, list, dict depending on question type
    answer_text: Optional[str] = None  # For "other" option or text questions
    answered_at: datetime = field(default_factory=datetime.utcnow)
    time_spent_seconds: Optional[float] = None


@dataclass
class SurveyResponse:
    """Response to a survey."""
    id: str = field(default_factory=lambda: str(uuid4()))
    survey_id: str = ""
    respondent_id: Optional[str] = None  # None if anonymous
    respondent_email: Optional[str] = None
    distribution_id: Optional[str] = None
    status: ResponseStatus = ResponseStatus.IN_PROGRESS
    answers: List[QuestionAnswer] = field(default_factory=list)
    # Tracking
    started_at: datetime = field(default_factory=datetime.utcnow)
    completed_at: Optional[datetime] = None
    last_activity_at: datetime = field(default_factory=datetime.utcnow)
    time_spent_seconds: Optional[float] = None
    # Metadata
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    device_type: Optional[str] = None
    location: Optional[str] = None
    referrer: Optional[str] = None
    current_question_index: int = 0
    is_anonymous: bool = False


@dataclass
class SurveyDistribution:
    """Distribution of a survey to recipients."""
    id: str = field(default_factory=lambda: str(uuid4()))
    survey_id: str = ""
    method: DistributionMethod = DistributionMethod.LINK
    status: DistributionStatus = DistributionStatus.PENDING
    recipient_email: Optional[str] = None
    recipient_id: Optional[str] = None
    recipient_name: Optional[str] = None
    # Link distribution
    unique_link: Optional[str] = None
    link_expires_at: Optional[datetime] = None
    # Tracking
    sent_at: Optional[datetime] = None
    opened_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Reminders
    reminder_count: int = 0
    last_reminder_at: Optional[datetime] = None
    next_reminder_at: Optional[datetime] = None
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SurveyTemplate:
    """Reusable survey template."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: Optional[str] = None  # None for system templates
    name: str = ""
    description: Optional[str] = None
    survey_type: SurveyType = SurveyType.GENERAL
    category: Optional[str] = None
    questions: List[dict] = field(default_factory=list)  # Serialized questions
    settings: dict = field(default_factory=dict)  # Serialized settings
    is_system: bool = False
    is_public: bool = False
    use_count: int = 0
    created_by: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    preview_image_url: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PollOption:
    """Option in a poll."""
    id: str = field(default_factory=lambda: str(uuid4()))
    poll_id: str = ""
    text: str = ""
    image_url: Optional[str] = None
    order: int = 0
    vote_count: int = 0
    percentage: float = 0.0


@dataclass
class Poll:
    """Quick poll for voting."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    channel_id: Optional[str] = None  # If posted in a channel
    question: str = ""
    description: Optional[str] = None
    poll_type: PollType = PollType.SINGLE_VOTE
    status: PollStatus = PollStatus.DRAFT
    created_by: str = ""
    # Settings
    allow_anonymous: bool = False
    show_results_before_vote: bool = False
    show_results_after_vote: bool = True
    show_voter_names: bool = False
    allow_add_options: bool = False
    max_votes_per_user: int = 1
    # Scheduling
    scheduled_start: Optional[datetime] = None
    scheduled_end: Optional[datetime] = None
    # Statistics
    total_votes: int = 0
    unique_voters: int = 0
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    closed_at: Optional[datetime] = None


@dataclass
class PollVote:
    """Vote in a poll."""
    id: str = field(default_factory=lambda: str(uuid4()))
    poll_id: str = ""
    option_id: str = ""
    voter_id: Optional[str] = None  # None if anonymous
    rank: Optional[int] = None  # For ranked choice
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SurveyReminder:
    """Reminder for incomplete survey responses."""
    id: str = field(default_factory=lambda: str(uuid4()))
    survey_id: str = ""
    distribution_id: str = ""
    reminder_number: int = 1
    scheduled_at: datetime = field(default_factory=datetime.utcnow)
    sent_at: Optional[datetime] = None
    subject: str = ""
    message: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SurveyAnalytics:
    """Analytics for a survey."""
    survey_id: str = ""
    total_responses: int = 0
    completed_responses: int = 0
    in_progress_responses: int = 0
    abandoned_responses: int = 0
    completion_rate: float = 0.0
    average_time_seconds: float = 0.0
    median_time_seconds: float = 0.0
    response_rate: float = 0.0  # If distributed
    # Time series
    responses_by_date: Dict[str, int] = field(default_factory=dict)
    responses_by_hour: Dict[int, int] = field(default_factory=dict)
    # Demographics
    responses_by_device: Dict[str, int] = field(default_factory=dict)
    responses_by_location: Dict[str, int] = field(default_factory=dict)
    # Per-question analytics stored separately
    calculated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class QuestionAnalytics:
    """Analytics for a single question."""
    question_id: str = ""
    survey_id: str = ""
    response_count: int = 0
    skip_count: int = 0
    average_time_seconds: float = 0.0
    # For choice questions
    option_counts: Dict[str, int] = field(default_factory=dict)
    option_percentages: Dict[str, float] = field(default_factory=dict)
    # For rating/scale questions
    average_rating: Optional[float] = None
    rating_distribution: Dict[str, int] = field(default_factory=dict)
    # For NPS
    nps_score: Optional[float] = None
    promoters: int = 0
    passives: int = 0
    detractors: int = 0
    # For text questions
    word_frequency: Dict[str, int] = field(default_factory=dict)
    sentiment_positive: int = 0
    sentiment_neutral: int = 0
    sentiment_negative: int = 0
    calculated_at: datetime = field(default_factory=datetime.utcnow)


# ============================================================
# Registry
# ============================================================

class SurveyRegistry:
    """Registry for managing surveys and polls."""

    def __init__(self) -> None:
        self._surveys: Dict[str, Survey] = {}
        self._questions: Dict[str, SurveyQuestion] = {}
        self._sections: Dict[str, SurveySection] = {}
        self._responses: Dict[str, SurveyResponse] = {}
        self._distributions: Dict[str, SurveyDistribution] = {}
        self._templates: Dict[str, SurveyTemplate] = {}
        self._polls: Dict[str, Poll] = {}
        self._poll_options: Dict[str, PollOption] = {}
        self._poll_votes: Dict[str, PollVote] = {}
        self._reminders: Dict[str, SurveyReminder] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._surveys.clear()
        self._questions.clear()
        self._sections.clear()
        self._responses.clear()
        self._distributions.clear()
        self._templates.clear()
        self._polls.clear()
        self._poll_options.clear()
        self._poll_votes.clear()
        self._reminders.clear()

    # Survey CRUD
    def create_survey(self, survey: Survey) -> Survey:
        """Create a new survey."""
        self._surveys[survey.id] = survey
        return survey

    def get_survey(self, survey_id: str) -> Optional[Survey]:
        """Get a survey by ID."""
        return self._surveys.get(survey_id)

    def update_survey(self, survey: Survey) -> Optional[Survey]:
        """Update a survey."""
        if survey.id not in self._surveys:
            return None
        survey.updated_at = datetime.utcnow()
        self._surveys[survey.id] = survey
        return survey

    def delete_survey(self, survey_id: str) -> bool:
        """Delete a survey and related data."""
        if survey_id not in self._surveys:
            return False
        # Delete related data
        self._questions = {k: v for k, v in self._questions.items() if v.survey_id != survey_id}
        self._sections = {k: v for k, v in self._sections.items() if v.survey_id != survey_id}
        self._responses = {k: v for k, v in self._responses.items() if v.survey_id != survey_id}
        self._distributions = {k: v for k, v in self._distributions.items() if v.survey_id != survey_id}
        del self._surveys[survey_id]
        return True

    def list_surveys(
        self,
        workspace_id: Optional[str] = None,
        status: Optional[SurveyStatus] = None,
        survey_type: Optional[SurveyType] = None,
        created_by: Optional[str] = None,
        tag: Optional[str] = None,
    ) -> list[Survey]:
        """List surveys with optional filters."""
        surveys = list(self._surveys.values())
        if workspace_id:
            surveys = [s for s in surveys if s.workspace_id == workspace_id]
        if status:
            surveys = [s for s in surveys if s.status == status]
        if survey_type:
            surveys = [s for s in surveys if s.survey_type == survey_type]
        if created_by:
            surveys = [s for s in surveys if s.created_by == created_by]
        if tag:
            surveys = [s for s in surveys if tag in s.tags]
        return sorted(surveys, key=lambda s: s.created_at, reverse=True)

    # Question CRUD
    def create_question(self, question: SurveyQuestion) -> SurveyQuestion:
        """Create a survey question."""
        self._questions[question.id] = question
        return question

    def get_question(self, question_id: str) -> Optional[SurveyQuestion]:
        """Get a question by ID."""
        return self._questions.get(question_id)

    def update_question(self, question: SurveyQuestion) -> Optional[SurveyQuestion]:
        """Update a question."""
        if question.id not in self._questions:
            return None
        question.updated_at = datetime.utcnow()
        self._questions[question.id] = question
        return question

    def delete_question(self, question_id: str) -> bool:
        """Delete a question."""
        if question_id not in self._questions:
            return False
        del self._questions[question_id]
        return True

    def get_survey_questions(self, survey_id: str, section_id: Optional[str] = None) -> list[SurveyQuestion]:
        """Get questions for a survey."""
        questions = [q for q in self._questions.values() if q.survey_id == survey_id]
        if section_id:
            questions = [q for q in questions if q.section_id == section_id]
        return sorted(questions, key=lambda q: q.order)

    # Section CRUD
    def create_section(self, section: SurveySection) -> SurveySection:
        """Create a survey section."""
        self._sections[section.id] = section
        return section

    def get_section(self, section_id: str) -> Optional[SurveySection]:
        """Get a section by ID."""
        return self._sections.get(section_id)

    def update_section(self, section: SurveySection) -> Optional[SurveySection]:
        """Update a section."""
        if section.id not in self._sections:
            return None
        section.updated_at = datetime.utcnow()
        self._sections[section.id] = section
        return section

    def delete_section(self, section_id: str) -> bool:
        """Delete a section."""
        if section_id not in self._sections:
            return False
        # Update questions to remove section reference
        for q in self._questions.values():
            if q.section_id == section_id:
                q.section_id = None
        del self._sections[section_id]
        return True

    def get_survey_sections(self, survey_id: str) -> list[SurveySection]:
        """Get sections for a survey."""
        sections = [s for s in self._sections.values() if s.survey_id == survey_id]
        return sorted(sections, key=lambda s: s.order)

    # Response CRUD
    def create_response(self, response: SurveyResponse) -> SurveyResponse:
        """Create a survey response."""
        self._responses[response.id] = response
        return response

    def get_response(self, response_id: str) -> Optional[SurveyResponse]:
        """Get a response by ID."""
        return self._responses.get(response_id)

    def update_response(self, response: SurveyResponse) -> Optional[SurveyResponse]:
        """Update a response."""
        if response.id not in self._responses:
            return None
        response.last_activity_at = datetime.utcnow()
        self._responses[response.id] = response
        return response

    def delete_response(self, response_id: str) -> bool:
        """Delete a response."""
        if response_id not in self._responses:
            return False
        del self._responses[response_id]
        return True

    def get_survey_responses(
        self,
        survey_id: str,
        status: Optional[ResponseStatus] = None,
        respondent_id: Optional[str] = None,
    ) -> list[SurveyResponse]:
        """Get responses for a survey."""
        responses = [r for r in self._responses.values() if r.survey_id == survey_id]
        if status:
            responses = [r for r in responses if r.status == status]
        if respondent_id:
            responses = [r for r in responses if r.respondent_id == respondent_id]
        return sorted(responses, key=lambda r: r.started_at, reverse=True)

    def get_user_responses(self, respondent_id: str) -> list[SurveyResponse]:
        """Get all responses by a user."""
        responses = [r for r in self._responses.values() if r.respondent_id == respondent_id]
        return sorted(responses, key=lambda r: r.started_at, reverse=True)

    # Distribution CRUD
    def create_distribution(self, distribution: SurveyDistribution) -> SurveyDistribution:
        """Create a survey distribution."""
        self._distributions[distribution.id] = distribution
        return distribution

    def get_distribution(self, distribution_id: str) -> Optional[SurveyDistribution]:
        """Get a distribution by ID."""
        return self._distributions.get(distribution_id)

    def get_distribution_by_link(self, unique_link: str) -> Optional[SurveyDistribution]:
        """Get a distribution by unique link."""
        for d in self._distributions.values():
            if d.unique_link == unique_link:
                return d
        return None

    def update_distribution(self, distribution: SurveyDistribution) -> Optional[SurveyDistribution]:
        """Update a distribution."""
        if distribution.id not in self._distributions:
            return None
        distribution.updated_at = datetime.utcnow()
        self._distributions[distribution.id] = distribution
        return distribution

    def delete_distribution(self, distribution_id: str) -> bool:
        """Delete a distribution."""
        if distribution_id not in self._distributions:
            return False
        del self._distributions[distribution_id]
        return True

    def get_survey_distributions(
        self,
        survey_id: str,
        method: Optional[DistributionMethod] = None,
        status: Optional[DistributionStatus] = None,
    ) -> list[SurveyDistribution]:
        """Get distributions for a survey."""
        distributions = [d for d in self._distributions.values() if d.survey_id == survey_id]
        if method:
            distributions = [d for d in distributions if d.method == method]
        if status:
            distributions = [d for d in distributions if d.status == status]
        return sorted(distributions, key=lambda d: d.created_at, reverse=True)

    # Template CRUD
    def create_template(self, template: SurveyTemplate) -> SurveyTemplate:
        """Create a survey template."""
        self._templates[template.id] = template
        return template

    def get_template(self, template_id: str) -> Optional[SurveyTemplate]:
        """Get a template by ID."""
        return self._templates.get(template_id)

    def update_template(self, template: SurveyTemplate) -> Optional[SurveyTemplate]:
        """Update a template."""
        if template.id not in self._templates:
            return None
        template.updated_at = datetime.utcnow()
        self._templates[template.id] = template
        return template

    def delete_template(self, template_id: str) -> bool:
        """Delete a template."""
        if template_id not in self._templates:
            return False
        del self._templates[template_id]
        return True

    def list_templates(
        self,
        workspace_id: Optional[str] = None,
        survey_type: Optional[SurveyType] = None,
        category: Optional[str] = None,
        is_system: Optional[bool] = None,
        is_public: Optional[bool] = None,
    ) -> list[SurveyTemplate]:
        """List templates with optional filters."""
        templates = list(self._templates.values())
        if workspace_id is not None:
            templates = [t for t in templates if t.workspace_id == workspace_id or t.is_system]
        if survey_type:
            templates = [t for t in templates if t.survey_type == survey_type]
        if category:
            templates = [t for t in templates if t.category == category]
        if is_system is not None:
            templates = [t for t in templates if t.is_system == is_system]
        if is_public is not None:
            templates = [t for t in templates if t.is_public == is_public]
        return sorted(templates, key=lambda t: t.use_count, reverse=True)

    # Poll CRUD
    def create_poll(self, poll: Poll) -> Poll:
        """Create a poll."""
        self._polls[poll.id] = poll
        return poll

    def get_poll(self, poll_id: str) -> Optional[Poll]:
        """Get a poll by ID."""
        return self._polls.get(poll_id)

    def update_poll(self, poll: Poll) -> Optional[Poll]:
        """Update a poll."""
        if poll.id not in self._polls:
            return None
        poll.updated_at = datetime.utcnow()
        self._polls[poll.id] = poll
        return poll

    def delete_poll(self, poll_id: str) -> bool:
        """Delete a poll and related data."""
        if poll_id not in self._polls:
            return False
        self._poll_options = {k: v for k, v in self._poll_options.items() if v.poll_id != poll_id}
        self._poll_votes = {k: v for k, v in self._poll_votes.items() if v.poll_id != poll_id}
        del self._polls[poll_id]
        return True

    def list_polls(
        self,
        workspace_id: Optional[str] = None,
        channel_id: Optional[str] = None,
        status: Optional[PollStatus] = None,
        created_by: Optional[str] = None,
    ) -> list[Poll]:
        """List polls with optional filters."""
        polls = list(self._polls.values())
        if workspace_id:
            polls = [p for p in polls if p.workspace_id == workspace_id]
        if channel_id:
            polls = [p for p in polls if p.channel_id == channel_id]
        if status:
            polls = [p for p in polls if p.status == status]
        if created_by:
            polls = [p for p in polls if p.created_by == created_by]
        return sorted(polls, key=lambda p: p.created_at, reverse=True)

    # Poll Option CRUD
    def create_poll_option(self, option: PollOption) -> PollOption:
        """Create a poll option."""
        self._poll_options[option.id] = option
        return option

    def get_poll_option(self, option_id: str) -> Optional[PollOption]:
        """Get a poll option by ID."""
        return self._poll_options.get(option_id)

    def update_poll_option(self, option: PollOption) -> Optional[PollOption]:
        """Update a poll option."""
        if option.id not in self._poll_options:
            return None
        self._poll_options[option.id] = option
        return option

    def delete_poll_option(self, option_id: str) -> bool:
        """Delete a poll option."""
        if option_id not in self._poll_options:
            return False
        # Delete related votes
        self._poll_votes = {k: v for k, v in self._poll_votes.items() if v.option_id != option_id}
        del self._poll_options[option_id]
        return True

    def get_poll_options(self, poll_id: str) -> list[PollOption]:
        """Get options for a poll."""
        options = [o for o in self._poll_options.values() if o.poll_id == poll_id]
        return sorted(options, key=lambda o: o.order)

    # Poll Vote CRUD
    def create_poll_vote(self, vote: PollVote) -> PollVote:
        """Create a poll vote."""
        self._poll_votes[vote.id] = vote
        return vote

    def get_poll_vote(self, vote_id: str) -> Optional[PollVote]:
        """Get a poll vote by ID."""
        return self._poll_votes.get(vote_id)

    def delete_poll_vote(self, vote_id: str) -> bool:
        """Delete a poll vote."""
        if vote_id not in self._poll_votes:
            return False
        del self._poll_votes[vote_id]
        return True

    def get_poll_votes(self, poll_id: str, option_id: Optional[str] = None, voter_id: Optional[str] = None) -> list[PollVote]:
        """Get votes for a poll."""
        votes = [v for v in self._poll_votes.values() if v.poll_id == poll_id]
        if option_id:
            votes = [v for v in votes if v.option_id == option_id]
        if voter_id:
            votes = [v for v in votes if v.voter_id == voter_id]
        return votes

    def get_user_poll_votes(self, poll_id: str, voter_id: str) -> list[PollVote]:
        """Get a user's votes for a poll."""
        return [v for v in self._poll_votes.values() if v.poll_id == poll_id and v.voter_id == voter_id]

    # Reminder CRUD
    def create_reminder(self, reminder: SurveyReminder) -> SurveyReminder:
        """Create a survey reminder."""
        self._reminders[reminder.id] = reminder
        return reminder

    def get_reminder(self, reminder_id: str) -> Optional[SurveyReminder]:
        """Get a reminder by ID."""
        return self._reminders.get(reminder_id)

    def update_reminder(self, reminder: SurveyReminder) -> Optional[SurveyReminder]:
        """Update a reminder."""
        if reminder.id not in self._reminders:
            return None
        self._reminders[reminder.id] = reminder
        return reminder

    def delete_reminder(self, reminder_id: str) -> bool:
        """Delete a reminder."""
        if reminder_id not in self._reminders:
            return False
        del self._reminders[reminder_id]
        return True

    def get_pending_reminders(self, before: Optional[datetime] = None) -> list[SurveyReminder]:
        """Get pending reminders."""
        now = before or datetime.utcnow()
        reminders = [r for r in self._reminders.values() if r.sent_at is None and r.scheduled_at <= now]
        return sorted(reminders, key=lambda r: r.scheduled_at)


# ============================================================
# Manager
# ============================================================

class SurveyManager:
    """High-level API for survey and poll management."""

    def __init__(self, registry: Optional[SurveyRegistry] = None) -> None:
        self.registry = registry or SurveyRegistry()

    # Survey Management
    def create_survey(
        self,
        workspace_id: str,
        title: str,
        created_by: str,
        description: Optional[str] = None,
        survey_type: SurveyType = SurveyType.GENERAL,
        template_id: Optional[str] = None,
        settings: Optional[SurveySettings] = None,
    ) -> Survey:
        """Create a new survey."""
        survey = Survey(
            workspace_id=workspace_id,
            title=title,
            description=description,
            survey_type=survey_type,
            created_by=created_by,
            owner_id=created_by,
            template_id=template_id,
            settings=settings or SurveySettings(),
        )

        # If using template, copy questions
        if template_id:
            template = self.registry.get_template(template_id)
            if template:
                template.use_count += 1
                self.registry.update_template(template)

        return self.registry.create_survey(survey)

    def get_survey(self, survey_id: str) -> Optional[Survey]:
        """Get a survey by ID."""
        return self.registry.get_survey(survey_id)

    def update_survey(
        self,
        survey_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        settings: Optional[SurveySettings] = None,
        tags: Optional[List[str]] = None,
    ) -> Optional[Survey]:
        """Update survey details."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        if title is not None:
            survey.title = title
        if description is not None:
            survey.description = description
        if settings is not None:
            survey.settings = settings
        if tags is not None:
            survey.tags = tags

        return self.registry.update_survey(survey)

    def publish_survey(
        self,
        survey_id: str,
        scheduled_start: Optional[datetime] = None,
        scheduled_end: Optional[datetime] = None,
    ) -> Optional[Survey]:
        """Publish a survey (make it active or scheduled)."""
        survey = self.registry.get_survey(survey_id)
        if not survey or survey.status not in [SurveyStatus.DRAFT, SurveyStatus.PAUSED]:
            return None

        now = datetime.utcnow()
        survey.scheduled_start = scheduled_start
        survey.scheduled_end = scheduled_end

        if scheduled_start and scheduled_start > now:
            survey.status = SurveyStatus.SCHEDULED
        else:
            survey.status = SurveyStatus.ACTIVE
            survey.published_at = now

        return self.registry.update_survey(survey)

    def pause_survey(self, survey_id: str) -> Optional[Survey]:
        """Pause an active survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey or survey.status != SurveyStatus.ACTIVE:
            return None

        survey.status = SurveyStatus.PAUSED
        return self.registry.update_survey(survey)

    def close_survey(self, survey_id: str) -> Optional[Survey]:
        """Close a survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey or survey.status in [SurveyStatus.CLOSED, SurveyStatus.ARCHIVED]:
            return None

        survey.status = SurveyStatus.CLOSED
        survey.closed_at = datetime.utcnow()
        return self.registry.update_survey(survey)

    def archive_survey(self, survey_id: str) -> Optional[Survey]:
        """Archive a survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        survey.status = SurveyStatus.ARCHIVED
        return self.registry.update_survey(survey)

    def delete_survey(self, survey_id: str) -> bool:
        """Delete a survey."""
        return self.registry.delete_survey(survey_id)

    def list_surveys(
        self,
        workspace_id: str,
        status: Optional[SurveyStatus] = None,
        survey_type: Optional[SurveyType] = None,
        created_by: Optional[str] = None,
    ) -> list[Survey]:
        """List surveys in a workspace."""
        return self.registry.list_surveys(
            workspace_id=workspace_id,
            status=status,
            survey_type=survey_type,
            created_by=created_by,
        )

    # Question Management
    def add_question(
        self,
        survey_id: str,
        question_type: QuestionType,
        text: str,
        description: Optional[str] = None,
        options: Optional[List[QuestionOption]] = None,
        validation: Optional[QuestionValidation] = None,
        section_id: Optional[str] = None,
        order: Optional[int] = None,
    ) -> Optional[SurveyQuestion]:
        """Add a question to a survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        # Determine order
        if order is None:
            existing = self.registry.get_survey_questions(survey_id, section_id)
            order = len(existing)

        question = SurveyQuestion(
            survey_id=survey_id,
            section_id=section_id,
            question_type=question_type,
            text=text,
            description=description,
            options=options or [],
            validation=validation or QuestionValidation(),
            order=order,
        )

        return self.registry.create_question(question)

    def update_question(
        self,
        question_id: str,
        text: Optional[str] = None,
        description: Optional[str] = None,
        options: Optional[List[QuestionOption]] = None,
        validation: Optional[QuestionValidation] = None,
        order: Optional[int] = None,
    ) -> Optional[SurveyQuestion]:
        """Update a question."""
        question = self.registry.get_question(question_id)
        if not question:
            return None

        if text is not None:
            question.text = text
        if description is not None:
            question.description = description
        if options is not None:
            question.options = options
        if validation is not None:
            question.validation = validation
        if order is not None:
            question.order = order

        return self.registry.update_question(question)

    def delete_question(self, question_id: str) -> bool:
        """Delete a question."""
        return self.registry.delete_question(question_id)

    def get_survey_questions(self, survey_id: str) -> list[SurveyQuestion]:
        """Get all questions for a survey."""
        return self.registry.get_survey_questions(survey_id)

    def reorder_questions(self, survey_id: str, question_order: List[str]) -> bool:
        """Reorder questions in a survey."""
        for i, question_id in enumerate(question_order):
            question = self.registry.get_question(question_id)
            if question and question.survey_id == survey_id:
                question.order = i
                self.registry.update_question(question)
        return True

    # Section Management
    def add_section(
        self,
        survey_id: str,
        title: str,
        description: Optional[str] = None,
        order: Optional[int] = None,
    ) -> Optional[SurveySection]:
        """Add a section to a survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        if order is None:
            existing = self.registry.get_survey_sections(survey_id)
            order = len(existing)

        section = SurveySection(
            survey_id=survey_id,
            title=title,
            description=description,
            order=order,
        )

        return self.registry.create_section(section)

    def update_section(
        self,
        section_id: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        order: Optional[int] = None,
    ) -> Optional[SurveySection]:
        """Update a section."""
        section = self.registry.get_section(section_id)
        if not section:
            return None

        if title is not None:
            section.title = title
        if description is not None:
            section.description = description
        if order is not None:
            section.order = order

        return self.registry.update_section(section)

    def delete_section(self, section_id: str) -> bool:
        """Delete a section."""
        return self.registry.delete_section(section_id)

    # Response Management
    def start_response(
        self,
        survey_id: str,
        respondent_id: Optional[str] = None,
        respondent_email: Optional[str] = None,
        distribution_id: Optional[str] = None,
        is_anonymous: bool = False,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ) -> Optional[SurveyResponse]:
        """Start a new survey response."""
        survey = self.registry.get_survey(survey_id)
        if not survey or survey.status != SurveyStatus.ACTIVE:
            return None

        # Check if user already responded (if one response per user)
        if survey.settings.one_response_per_user and respondent_id:
            existing = self.registry.get_survey_responses(survey_id, respondent_id=respondent_id)
            if existing:
                return None

        # Check response limit
        if survey.settings.response_limit:
            current_responses = self.registry.get_survey_responses(survey_id, status=ResponseStatus.COMPLETED)
            if len(current_responses) >= survey.settings.response_limit:
                return None

        response = SurveyResponse(
            survey_id=survey_id,
            respondent_id=None if is_anonymous else respondent_id,
            respondent_email=None if is_anonymous else respondent_email,
            distribution_id=distribution_id,
            is_anonymous=is_anonymous,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        # Update distribution status
        if distribution_id:
            distribution = self.registry.get_distribution(distribution_id)
            if distribution:
                distribution.status = DistributionStatus.STARTED
                distribution.started_at = datetime.utcnow()
                self.registry.update_distribution(distribution)

        return self.registry.create_response(response)

    def submit_answer(
        self,
        response_id: str,
        question_id: str,
        answer_value: Any,
        answer_text: Optional[str] = None,
    ) -> Optional[SurveyResponse]:
        """Submit an answer to a question."""
        response = self.registry.get_response(response_id)
        if not response or response.status == ResponseStatus.COMPLETED:
            return None

        # Find or create answer
        answer = None
        for a in response.answers:
            if a.question_id == question_id:
                answer = a
                break

        if answer:
            answer.answer_value = answer_value
            answer.answer_text = answer_text
            answer.answered_at = datetime.utcnow()
        else:
            answer = QuestionAnswer(
                question_id=question_id,
                answer_value=answer_value,
                answer_text=answer_text,
            )
            response.answers.append(answer)

        response.current_question_index = len(response.answers)
        return self.registry.update_response(response)

    def complete_response(self, response_id: str) -> Optional[SurveyResponse]:
        """Mark a response as completed."""
        response = self.registry.get_response(response_id)
        if not response or response.status == ResponseStatus.COMPLETED:
            return None

        now = datetime.utcnow()
        response.status = ResponseStatus.COMPLETED
        response.completed_at = now
        response.time_spent_seconds = (now - response.started_at).total_seconds()

        # Update survey stats
        survey = self.registry.get_survey(response.survey_id)
        if survey:
            survey.response_count += 1
            completed = self.registry.get_survey_responses(response.survey_id, status=ResponseStatus.COMPLETED)
            total = self.registry.get_survey_responses(response.survey_id)
            survey.completion_rate = len(completed) / len(total) if total else 0
            self.registry.update_survey(survey)

        # Update distribution status
        if response.distribution_id:
            distribution = self.registry.get_distribution(response.distribution_id)
            if distribution:
                distribution.status = DistributionStatus.COMPLETED
                distribution.completed_at = now
                self.registry.update_distribution(distribution)

        return self.registry.update_response(response)

    def abandon_response(self, response_id: str) -> Optional[SurveyResponse]:
        """Mark a response as abandoned."""
        response = self.registry.get_response(response_id)
        if not response or response.status == ResponseStatus.COMPLETED:
            return None

        response.status = ResponseStatus.ABANDONED
        return self.registry.update_response(response)

    def get_response(self, response_id: str) -> Optional[SurveyResponse]:
        """Get a response by ID."""
        return self.registry.get_response(response_id)

    def get_survey_responses(
        self,
        survey_id: str,
        status: Optional[ResponseStatus] = None,
    ) -> list[SurveyResponse]:
        """Get all responses for a survey."""
        return self.registry.get_survey_responses(survey_id, status=status)

    # Distribution Management
    def create_distribution(
        self,
        survey_id: str,
        method: DistributionMethod,
        recipient_email: Optional[str] = None,
        recipient_id: Optional[str] = None,
        recipient_name: Optional[str] = None,
        link_expires_days: Optional[int] = None,
    ) -> Optional[SurveyDistribution]:
        """Create a survey distribution."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        distribution = SurveyDistribution(
            survey_id=survey_id,
            method=method,
            recipient_email=recipient_email,
            recipient_id=recipient_id,
            recipient_name=recipient_name,
        )

        # Generate unique link for link-based distribution
        if method in [DistributionMethod.LINK, DistributionMethod.EMAIL, DistributionMethod.QR_CODE]:
            distribution.unique_link = str(uuid4())
            if link_expires_days:
                distribution.link_expires_at = datetime.utcnow() + timedelta(days=link_expires_days)

        return self.registry.create_distribution(distribution)

    def send_distribution(self, distribution_id: str) -> Optional[SurveyDistribution]:
        """Mark a distribution as sent."""
        distribution = self.registry.get_distribution(distribution_id)
        if not distribution:
            return None

        distribution.status = DistributionStatus.SENT
        distribution.sent_at = datetime.utcnow()
        return self.registry.update_distribution(distribution)

    def bulk_distribute(
        self,
        survey_id: str,
        method: DistributionMethod,
        recipients: List[dict],  # [{"email": ..., "name": ...}, ...]
    ) -> list[SurveyDistribution]:
        """Create distributions for multiple recipients."""
        distributions = []
        for recipient in recipients:
            distribution = self.create_distribution(
                survey_id=survey_id,
                method=method,
                recipient_email=recipient.get("email"),
                recipient_id=recipient.get("id"),
                recipient_name=recipient.get("name"),
            )
            if distribution:
                distributions.append(distribution)
        return distributions

    def get_distribution_by_link(self, unique_link: str) -> Optional[SurveyDistribution]:
        """Get a distribution by its unique link."""
        return self.registry.get_distribution_by_link(unique_link)

    # Template Management
    def create_template(
        self,
        name: str,
        survey_type: SurveyType,
        created_by: str,
        workspace_id: Optional[str] = None,
        description: Optional[str] = None,
        category: Optional[str] = None,
        is_public: bool = False,
    ) -> SurveyTemplate:
        """Create a survey template."""
        template = SurveyTemplate(
            workspace_id=workspace_id,
            name=name,
            description=description,
            survey_type=survey_type,
            category=category,
            is_public=is_public,
            created_by=created_by,
        )
        return self.registry.create_template(template)

    def create_template_from_survey(
        self,
        survey_id: str,
        name: str,
        created_by: str,
        description: Optional[str] = None,
        is_public: bool = False,
    ) -> Optional[SurveyTemplate]:
        """Create a template from an existing survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        questions = self.registry.get_survey_questions(survey_id)

        template = SurveyTemplate(
            workspace_id=survey.workspace_id,
            name=name,
            description=description or survey.description,
            survey_type=survey.survey_type,
            category=survey.category,
            questions=[self._serialize_question(q) for q in questions],
            settings=self._serialize_settings(survey.settings),
            is_public=is_public,
            created_by=created_by,
        )

        return self.registry.create_template(template)

    def _serialize_question(self, question: SurveyQuestion) -> dict:
        """Serialize a question for template storage."""
        return {
            "question_type": question.question_type.value,
            "text": question.text,
            "description": question.description,
            "options": [{"text": o.text, "value": o.value} for o in question.options],
            "validation": {
                "required": question.validation.required,
                "min_length": question.validation.min_length,
                "max_length": question.validation.max_length,
            },
            "scale_min": question.scale_min,
            "scale_max": question.scale_max,
            "order": question.order,
        }

    def _serialize_settings(self, settings: SurveySettings) -> dict:
        """Serialize survey settings for template storage."""
        return {
            "allow_anonymous": settings.allow_anonymous,
            "show_progress_bar": settings.show_progress_bar,
            "randomize_questions": settings.randomize_questions,
            "one_response_per_user": settings.one_response_per_user,
        }

    def get_template(self, template_id: str) -> Optional[SurveyTemplate]:
        """Get a template by ID."""
        return self.registry.get_template(template_id)

    def list_templates(
        self,
        workspace_id: Optional[str] = None,
        survey_type: Optional[SurveyType] = None,
        category: Optional[str] = None,
    ) -> list[SurveyTemplate]:
        """List available templates."""
        return self.registry.list_templates(
            workspace_id=workspace_id,
            survey_type=survey_type,
            category=category,
        )

    # Poll Management
    def create_poll(
        self,
        workspace_id: str,
        question: str,
        options: List[str],
        created_by: str,
        description: Optional[str] = None,
        poll_type: PollType = PollType.SINGLE_VOTE,
        channel_id: Optional[str] = None,
        allow_anonymous: bool = False,
        scheduled_end: Optional[datetime] = None,
    ) -> Poll:
        """Create a new poll."""
        poll = Poll(
            workspace_id=workspace_id,
            question=question,
            description=description,
            poll_type=poll_type,
            created_by=created_by,
            channel_id=channel_id,
            allow_anonymous=allow_anonymous,
            scheduled_end=scheduled_end,
        )
        poll = self.registry.create_poll(poll)

        # Create options
        for i, option_text in enumerate(options):
            option = PollOption(
                poll_id=poll.id,
                text=option_text,
                order=i,
            )
            self.registry.create_poll_option(option)

        return poll

    def get_poll(self, poll_id: str) -> Optional[Poll]:
        """Get a poll by ID."""
        return self.registry.get_poll(poll_id)

    def activate_poll(self, poll_id: str) -> Optional[Poll]:
        """Activate a poll."""
        poll = self.registry.get_poll(poll_id)
        if not poll or poll.status != PollStatus.DRAFT:
            return None

        poll.status = PollStatus.ACTIVE
        return self.registry.update_poll(poll)

    def close_poll(self, poll_id: str) -> Optional[Poll]:
        """Close a poll."""
        poll = self.registry.get_poll(poll_id)
        if not poll or poll.status != PollStatus.ACTIVE:
            return None

        poll.status = PollStatus.CLOSED
        poll.closed_at = datetime.utcnow()
        return self.registry.update_poll(poll)

    def vote(
        self,
        poll_id: str,
        option_id: str,
        voter_id: Optional[str] = None,
        rank: Optional[int] = None,
    ) -> Optional[PollVote]:
        """Cast a vote on a poll."""
        poll = self.registry.get_poll(poll_id)
        if not poll or poll.status != PollStatus.ACTIVE:
            return None

        option = self.registry.get_poll_option(option_id)
        if not option or option.poll_id != poll_id:
            return None

        # Check if user already voted (for single vote polls)
        if poll.poll_type == PollType.SINGLE_VOTE and voter_id:
            existing_votes = self.registry.get_user_poll_votes(poll_id, voter_id)
            if existing_votes:
                return None

        # Check max votes
        if voter_id:
            existing_votes = self.registry.get_user_poll_votes(poll_id, voter_id)
            if len(existing_votes) >= poll.max_votes_per_user:
                return None

        vote = PollVote(
            poll_id=poll_id,
            option_id=option_id,
            voter_id=None if poll.allow_anonymous else voter_id,
            rank=rank,
        )
        vote = self.registry.create_poll_vote(vote)

        # Update option vote count
        option.vote_count += 1
        self.registry.update_poll_option(option)

        # Update poll statistics
        poll.total_votes += 1
        if voter_id and voter_id not in [v.voter_id for v in self.registry.get_poll_votes(poll_id)]:
            poll.unique_voters += 1

        # Update percentages
        options = self.registry.get_poll_options(poll_id)
        for opt in options:
            opt.percentage = (opt.vote_count / poll.total_votes * 100) if poll.total_votes > 0 else 0
            self.registry.update_poll_option(opt)

        self.registry.update_poll(poll)

        return vote

    def remove_vote(self, poll_id: str, voter_id: str, option_id: str) -> bool:
        """Remove a vote from a poll."""
        poll = self.registry.get_poll(poll_id)
        if not poll or poll.status != PollStatus.ACTIVE:
            return False

        votes = self.registry.get_poll_votes(poll_id, option_id=option_id, voter_id=voter_id)
        if not votes:
            return False

        for vote in votes:
            self.registry.delete_poll_vote(vote.id)

            # Update option vote count
            option = self.registry.get_poll_option(option_id)
            if option:
                option.vote_count = max(0, option.vote_count - 1)
                self.registry.update_poll_option(option)

            # Update poll statistics
            poll.total_votes = max(0, poll.total_votes - 1)

        # Recalculate percentages
        options = self.registry.get_poll_options(poll_id)
        for opt in options:
            opt.percentage = (opt.vote_count / poll.total_votes * 100) if poll.total_votes > 0 else 0
            self.registry.update_poll_option(opt)

        self.registry.update_poll(poll)
        return True

    def get_poll_results(self, poll_id: str) -> Optional[dict]:
        """Get poll results."""
        poll = self.registry.get_poll(poll_id)
        if not poll:
            return None

        options = self.registry.get_poll_options(poll_id)

        return {
            "poll_id": poll_id,
            "question": poll.question,
            "status": poll.status.value,
            "total_votes": poll.total_votes,
            "unique_voters": poll.unique_voters,
            "options": [
                {
                    "id": opt.id,
                    "text": opt.text,
                    "vote_count": opt.vote_count,
                    "percentage": opt.percentage,
                }
                for opt in options
            ],
        }

    def add_poll_option(self, poll_id: str, text: str, added_by: str) -> Optional[PollOption]:
        """Add an option to a poll (if allowed)."""
        poll = self.registry.get_poll(poll_id)
        if not poll or not poll.allow_add_options:
            return None

        if poll.status not in [PollStatus.DRAFT, PollStatus.ACTIVE]:
            return None

        existing = self.registry.get_poll_options(poll_id)
        option = PollOption(
            poll_id=poll_id,
            text=text,
            order=len(existing),
        )

        return self.registry.create_poll_option(option)

    def list_polls(
        self,
        workspace_id: str,
        status: Optional[PollStatus] = None,
        channel_id: Optional[str] = None,
    ) -> list[Poll]:
        """List polls in a workspace."""
        return self.registry.list_polls(
            workspace_id=workspace_id,
            status=status,
            channel_id=channel_id,
        )

    # Analytics
    def get_survey_analytics(self, survey_id: str) -> Optional[SurveyAnalytics]:
        """Get analytics for a survey."""
        survey = self.registry.get_survey(survey_id)
        if not survey:
            return None

        responses = self.registry.get_survey_responses(survey_id)
        completed = [r for r in responses if r.status == ResponseStatus.COMPLETED]
        in_progress = [r for r in responses if r.status == ResponseStatus.IN_PROGRESS]
        abandoned = [r for r in responses if r.status == ResponseStatus.ABANDONED]

        # Calculate time statistics
        completion_times = [r.time_spent_seconds for r in completed if r.time_spent_seconds]
        avg_time = sum(completion_times) / len(completion_times) if completion_times else 0
        sorted_times = sorted(completion_times)
        median_time = sorted_times[len(sorted_times) // 2] if sorted_times else 0

        # Response by date
        responses_by_date: Dict[str, int] = {}
        for r in responses:
            date_key = r.started_at.strftime("%Y-%m-%d")
            responses_by_date[date_key] = responses_by_date.get(date_key, 0) + 1

        # Response by hour
        responses_by_hour: Dict[int, int] = {}
        for r in responses:
            hour = r.started_at.hour
            responses_by_hour[hour] = responses_by_hour.get(hour, 0) + 1

        # Response by device
        responses_by_device: Dict[str, int] = {}
        for r in responses:
            device = r.device_type or "unknown"
            responses_by_device[device] = responses_by_device.get(device, 0) + 1

        # Calculate response rate
        distributions = self.registry.get_survey_distributions(survey_id)
        sent_distributions = [d for d in distributions if d.status != DistributionStatus.PENDING]
        response_rate = len(completed) / len(sent_distributions) if sent_distributions else 0

        return SurveyAnalytics(
            survey_id=survey_id,
            total_responses=len(responses),
            completed_responses=len(completed),
            in_progress_responses=len(in_progress),
            abandoned_responses=len(abandoned),
            completion_rate=len(completed) / len(responses) if responses else 0,
            average_time_seconds=avg_time,
            median_time_seconds=median_time,
            response_rate=response_rate,
            responses_by_date=responses_by_date,
            responses_by_hour=responses_by_hour,
            responses_by_device=responses_by_device,
        )

    def get_question_analytics(self, question_id: str) -> Optional[QuestionAnalytics]:
        """Get analytics for a specific question."""
        question = self.registry.get_question(question_id)
        if not question:
            return None

        responses = self.registry.get_survey_responses(question.survey_id, status=ResponseStatus.COMPLETED)

        # Collect answers for this question
        answers = []
        for response in responses:
            for answer in response.answers:
                if answer.question_id == question_id:
                    answers.append(answer)
                    break

        analytics = QuestionAnalytics(
            question_id=question_id,
            survey_id=question.survey_id,
            response_count=len(answers),
            skip_count=len(responses) - len(answers),
        )

        # Process based on question type
        if question.question_type in [QuestionType.SINGLE_CHOICE, QuestionType.MULTIPLE_CHOICE, QuestionType.DROPDOWN]:
            for answer in answers:
                values = answer.answer_value if isinstance(answer.answer_value, list) else [answer.answer_value]
                for val in values:
                    if val:
                        analytics.option_counts[str(val)] = analytics.option_counts.get(str(val), 0) + 1

            # Calculate percentages
            total = sum(analytics.option_counts.values())
            for key, count in analytics.option_counts.items():
                analytics.option_percentages[key] = (count / total * 100) if total > 0 else 0

        elif question.question_type in [QuestionType.RATING, QuestionType.SCALE]:
            ratings = [a.answer_value for a in answers if isinstance(a.answer_value, (int, float))]
            if ratings:
                analytics.average_rating = sum(ratings) / len(ratings)
                for rating in ratings:
                    key = str(int(rating))
                    analytics.rating_distribution[key] = analytics.rating_distribution.get(key, 0) + 1

        elif question.question_type == QuestionType.NPS:
            scores = [a.answer_value for a in answers if isinstance(a.answer_value, (int, float))]
            for score in scores:
                if score >= 9:
                    analytics.promoters += 1
                elif score >= 7:
                    analytics.passives += 1
                else:
                    analytics.detractors += 1

            if scores:
                analytics.nps_score = ((analytics.promoters - analytics.detractors) / len(scores)) * 100

        return analytics

    def export_responses(
        self,
        survey_id: str,
        format: str = "json",
        include_incomplete: bool = False,
    ) -> list[dict]:
        """Export survey responses."""
        status = None if include_incomplete else ResponseStatus.COMPLETED
        responses = self.registry.get_survey_responses(survey_id, status=status)
        questions = self.registry.get_survey_questions(survey_id)

        # Build question lookup
        question_map = {q.id: q for q in questions}

        exported = []
        for response in responses:
            row = {
                "response_id": response.id,
                "respondent_id": response.respondent_id,
                "respondent_email": response.respondent_email,
                "status": response.status.value,
                "started_at": response.started_at.isoformat(),
                "completed_at": response.completed_at.isoformat() if response.completed_at else None,
                "time_spent_seconds": response.time_spent_seconds,
            }

            # Add answers
            for answer in response.answers:
                question = question_map.get(answer.question_id)
                if question:
                    key = f"q_{question.order}_{question.id[:8]}"
                    row[key] = answer.answer_value
                    if answer.answer_text:
                        row[f"{key}_text"] = answer.answer_text

            exported.append(row)

        return exported


# ============================================================
# Global Instance Management
# ============================================================

_survey_manager: Optional[SurveyManager] = None


def get_survey_manager() -> SurveyManager:
    """Get the global survey manager instance."""
    global _survey_manager
    if _survey_manager is None:
        _survey_manager = SurveyManager()
    return _survey_manager


def set_survey_manager(manager: SurveyManager) -> None:
    """Set the global survey manager instance."""
    global _survey_manager
    _survey_manager = manager


def reset_survey_manager() -> None:
    """Reset the global survey manager instance."""
    global _survey_manager
    _survey_manager = None
