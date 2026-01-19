"""
Email Task Ingestion Module

Implements:
- Email parsing and classification (task, question, information)
- Security framework with DKIM/SPF validation
- Rate limiting for email ingestion
- Task extraction from email content
- Blocked actions and confirmation requirements
- Audit trail integration
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple, Pattern
import asyncio
import hashlib
import hmac
import re
import uuid


class EmailClassification(Enum):
    """Classification types for emails."""
    TASK_REQUEST = "task_request"
    QUESTION = "question"
    INFORMATION = "information"
    SPAM = "spam"
    BLOCKED = "blocked"


class EmailPriority(Enum):
    """Priority levels for email-derived tasks."""
    CRITICAL = "critical"    # Due in < 4 hours
    HIGH = "high"            # Due in < 24 hours
    MEDIUM = "medium"        # Due in < 1 week
    LOW = "low"              # No deadline or > 1 week
    NONE = "none"            # Information only


class TaskAction(Enum):
    """Types of task actions extracted from emails."""
    CREATE = "create"
    UPDATE = "update"
    DELETE = "delete"
    SEND = "send"
    SCHEDULE = "schedule"
    BOOK = "book"
    REVIEW = "review"
    APPROVE = "approve"
    GENERATE = "generate"
    ANALYZE = "analyze"
    RESEARCH = "research"
    UNKNOWN = "unknown"


class SecurityStatus(Enum):
    """Security validation status."""
    VALID = "valid"
    INVALID_DKIM = "invalid_dkim"
    INVALID_SPF = "invalid_spf"
    DOMAIN_NOT_WHITELISTED = "domain_not_whitelisted"
    RATE_LIMITED = "rate_limited"
    CONTENT_TOO_LARGE = "content_too_large"
    TOO_MANY_ATTACHMENTS = "too_many_attachments"
    ATTACHMENT_TOO_LARGE = "attachment_too_large"
    BLOCKED_ACTION = "blocked_action"


class ConfirmationStatus(Enum):
    """Status for actions requiring confirmation."""
    NOT_REQUIRED = "not_required"
    PENDING = "pending"
    CONFIRMED = "confirmed"
    REJECTED = "rejected"
    EXPIRED = "expired"


@dataclass
class EmailAttachment:
    """An email attachment."""
    filename: str
    content_type: str
    size_bytes: int
    checksum: str = ""
    content: Optional[bytes] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class EmailAddress:
    """Parsed email address."""
    address: str
    name: str = ""
    domain: str = ""

    def __post_init__(self):
        if not self.domain and "@" in self.address:
            self.domain = self.address.split("@")[-1].lower()


@dataclass
class EmailMessage:
    """A parsed email message."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    message_id: str = ""
    subject: str = ""
    body_text: str = ""
    body_html: str = ""
    sender: Optional[EmailAddress] = None
    recipients: List[EmailAddress] = field(default_factory=list)
    cc: List[EmailAddress] = field(default_factory=list)
    reply_to: Optional[EmailAddress] = None
    in_reply_to: str = ""
    references: List[str] = field(default_factory=list)
    attachments: List[EmailAttachment] = field(default_factory=list)
    headers: Dict[str, str] = field(default_factory=dict)
    received_at: datetime = field(default_factory=datetime.utcnow)
    raw_content: str = ""

    def total_attachment_size(self) -> int:
        """Get total size of all attachments."""
        return sum(a.size_bytes for a in self.attachments)


@dataclass
class SecurityValidation:
    """Result of security validation."""
    is_valid: bool
    status: SecurityStatus
    dkim_valid: bool = False
    spf_valid: bool = False
    domain_whitelisted: bool = False
    rate_limit_remaining: int = 0
    issues: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ClassificationResult:
    """Result of email classification."""
    classification: EmailClassification
    confidence: float
    task_probability: float = 0.0
    question_probability: float = 0.0
    info_probability: float = 0.0
    signals: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ExtractedTask:
    """A task extracted from an email."""
    id: str = field(default_factory=lambda: str(uuid.uuid4()))
    email_id: str = ""
    action: TaskAction = TaskAction.UNKNOWN
    title: str = ""
    description: str = ""
    priority: EmailPriority = EmailPriority.NONE
    due_date: Optional[datetime] = None
    assignee: str = ""
    dependencies: List[str] = field(default_factory=list)
    attachments: List[str] = field(default_factory=list)
    requires_confirmation: bool = False
    confirmation_status: ConfirmationStatus = ConfirmationStatus.NOT_REQUIRED
    confidence: float = 0.0
    extracted_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "email_id": self.email_id,
            "action": self.action.value,
            "title": self.title,
            "description": self.description,
            "priority": self.priority.value,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "requires_confirmation": self.requires_confirmation,
            "confirmation_status": self.confirmation_status.value,
            "confidence": self.confidence,
        }


@dataclass
class IngestResult:
    """Result of email ingestion."""
    email_id: str
    success: bool
    security: SecurityValidation
    classification: Optional[ClassificationResult] = None
    tasks: List[ExtractedTask] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    processed_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class EmailIngestConfig:
    """Configuration for email ingestion."""
    # Domain whitelist
    whitelisted_domains: Set[str] = field(default_factory=lambda: {
        "swissbrain.ai",
    })

    # Rate limiting
    max_emails_per_hour: int = 10
    max_emails_per_day: int = 50
    rate_limit_window_hours: int = 24

    # Content limits
    max_body_length: int = 50000  # 50KB
    max_attachments: int = 10
    max_attachment_size: int = 25 * 1024 * 1024  # 25MB
    max_total_attachment_size: int = 100 * 1024 * 1024  # 100MB

    # Security
    require_dkim: bool = True
    require_spf: bool = True
    allow_unknown_domains: bool = False

    # Confirmation settings
    confirmation_timeout_hours: int = 24

    # Blocked actions (never allow from email)
    blocked_actions: Set[str] = field(default_factory=lambda: {
        "delete_account",
        "change_password",
        "export_all_data",
        "modify_permissions",
        "delete_all",
    })

    # Actions requiring confirmation
    confirmation_required_actions: Set[str] = field(default_factory=lambda: {
        "send_email",
        "publish",
        "payment",
        "booking",
        "share_externally",
        "delete",
    })


class EmailSecurityValidator:
    """
    Validates email security (DKIM, SPF, domain whitelist).

    Ensures emails are from trusted sources before processing.
    """

    def __init__(self, config: Optional[EmailIngestConfig] = None):
        self.config = config or EmailIngestConfig()
        self._rate_limits: Dict[str, List[datetime]] = {}
        self._lock = asyncio.Lock()

    async def validate(self, email: EmailMessage) -> SecurityValidation:
        """
        Validate email security.

        Args:
            email: The email to validate

        Returns:
            SecurityValidation result
        """
        issues = []
        status = SecurityStatus.VALID

        # Check sender
        if not email.sender:
            return SecurityValidation(
                is_valid=False,
                status=SecurityStatus.INVALID_DKIM,
                issues=["No sender specified"],
            )

        domain = email.sender.domain

        # Check domain whitelist
        domain_whitelisted = self._is_domain_whitelisted(domain)
        if not domain_whitelisted and not self.config.allow_unknown_domains:
            issues.append(f"Domain not whitelisted: {domain}")
            status = SecurityStatus.DOMAIN_NOT_WHITELISTED

        # Check DKIM (simulated - in production would verify actual headers)
        dkim_valid = self._verify_dkim(email)
        if self.config.require_dkim and not dkim_valid:
            issues.append("DKIM validation failed")
            if status == SecurityStatus.VALID:
                status = SecurityStatus.INVALID_DKIM

        # Check SPF (simulated - in production would verify actual records)
        spf_valid = self._verify_spf(email)
        if self.config.require_spf and not spf_valid:
            issues.append("SPF validation failed")
            if status == SecurityStatus.VALID:
                status = SecurityStatus.INVALID_SPF

        # Check rate limits
        rate_limit_remaining = await self._check_rate_limit(domain)
        if rate_limit_remaining <= 0:
            issues.append(f"Rate limit exceeded for domain: {domain}")
            status = SecurityStatus.RATE_LIMITED

        # Check content size
        if len(email.body_text) > self.config.max_body_length:
            issues.append(f"Body too large: {len(email.body_text)} > {self.config.max_body_length}")
            status = SecurityStatus.CONTENT_TOO_LARGE

        # Check attachments
        if len(email.attachments) > self.config.max_attachments:
            issues.append(f"Too many attachments: {len(email.attachments)} > {self.config.max_attachments}")
            status = SecurityStatus.TOO_MANY_ATTACHMENTS

        for att in email.attachments:
            if att.size_bytes > self.config.max_attachment_size:
                issues.append(f"Attachment too large: {att.filename} ({att.size_bytes} bytes)")
                status = SecurityStatus.ATTACHMENT_TOO_LARGE
                break

        if email.total_attachment_size() > self.config.max_total_attachment_size:
            issues.append(f"Total attachment size too large: {email.total_attachment_size()} bytes")
            status = SecurityStatus.ATTACHMENT_TOO_LARGE

        is_valid = status == SecurityStatus.VALID

        return SecurityValidation(
            is_valid=is_valid,
            status=status,
            dkim_valid=dkim_valid,
            spf_valid=spf_valid,
            domain_whitelisted=domain_whitelisted,
            rate_limit_remaining=rate_limit_remaining,
            issues=issues,
        )

    def _is_domain_whitelisted(self, domain: str) -> bool:
        """Check if domain is whitelisted."""
        domain_lower = domain.lower()
        # Check exact match and parent domains
        for whitelisted in self.config.whitelisted_domains:
            if domain_lower == whitelisted.lower():
                return True
            if domain_lower.endswith("." + whitelisted.lower()):
                return True
        return False

    def _verify_dkim(self, email: EmailMessage) -> bool:
        """
        Verify DKIM signature.

        In production, this would verify the actual DKIM header.
        For now, simulates based on header presence.
        """
        dkim_header = email.headers.get("DKIM-Signature", "")
        if dkim_header:
            # Simulate verification - in production would do actual crypto verification
            return True
        # If no DKIM header but domain is whitelisted, assume valid for internal emails
        if email.sender and self._is_domain_whitelisted(email.sender.domain):
            return True
        return False

    def _verify_spf(self, email: EmailMessage) -> bool:
        """
        Verify SPF record.

        In production, this would check DNS SPF records.
        For now, simulates based on header presence.
        """
        received_spf = email.headers.get("Received-SPF", "")
        if "pass" in received_spf.lower():
            return True
        # If domain is whitelisted, assume valid for internal emails
        if email.sender and self._is_domain_whitelisted(email.sender.domain):
            return True
        return False

    async def _check_rate_limit(self, domain: str) -> int:
        """Check and update rate limit for domain."""
        async with self._lock:
            now = datetime.utcnow()
            window = timedelta(hours=self.config.rate_limit_window_hours)
            cutoff = now - window

            if domain not in self._rate_limits:
                self._rate_limits[domain] = []

            # Remove old entries
            self._rate_limits[domain] = [
                ts for ts in self._rate_limits[domain] if ts > cutoff
            ]

            # Check hourly limit
            hour_ago = now - timedelta(hours=1)
            hourly_count = sum(1 for ts in self._rate_limits[domain] if ts > hour_ago)
            if hourly_count >= self.config.max_emails_per_hour:
                return 0

            # Check daily limit
            daily_count = len(self._rate_limits[domain])
            if daily_count >= self.config.max_emails_per_day:
                return 0

            # Record this email
            self._rate_limits[domain].append(now)

            return min(
                self.config.max_emails_per_hour - hourly_count - 1,
                self.config.max_emails_per_day - daily_count - 1,
            )

    def add_whitelisted_domain(self, domain: str) -> None:
        """Add a domain to the whitelist."""
        self.config.whitelisted_domains.add(domain.lower())

    def remove_whitelisted_domain(self, domain: str) -> None:
        """Remove a domain from the whitelist."""
        self.config.whitelisted_domains.discard(domain.lower())


class EmailClassifier:
    """
    Classifies emails into categories (task, question, information).

    Uses keyword analysis and pattern matching to determine intent.
    """

    # Imperative verbs that indicate task requests
    TASK_VERBS = {
        "create", "make", "build", "generate", "send", "schedule", "book",
        "update", "modify", "change", "add", "remove", "delete", "review",
        "approve", "reject", "prepare", "draft", "write", "complete",
        "finish", "submit", "upload", "download", "export", "import",
        "analyze", "research", "investigate", "check", "verify", "confirm",
    }

    # Patterns for deadline detection
    DEADLINE_PATTERNS = [
        r"\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b",
        r"\bby\s+(\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\b",
        r"\b(eod|end\s+of\s+day|cob|close\s+of\s+business)\b",
        r"\b(asap|urgent|immediately)\b",
        r"\bby\s+(\d{1,2}:\d{2})\b",
        r"\bdeadline[:\s]+(.+?)(?:\.|$)",
        r"\bdue[:\s]+(.+?)(?:\.|$)",
    ]

    # Question indicators
    QUESTION_PATTERNS = [
        r"\?",
        r"\b(what|where|when|why|how|who|which|can\s+you|could\s+you|would\s+you)\b",
    ]

    def __init__(self):
        self._deadline_regexes = [
            re.compile(p, re.IGNORECASE) for p in self.DEADLINE_PATTERNS
        ]
        self._question_regexes = [
            re.compile(p, re.IGNORECASE) for p in self.QUESTION_PATTERNS
        ]

    def classify(self, email: EmailMessage) -> ClassificationResult:
        """
        Classify an email.

        Args:
            email: The email to classify

        Returns:
            ClassificationResult with probabilities
        """
        signals = []
        subject_lower = email.subject.lower()
        body_lower = email.body_text.lower()
        combined = f"{subject_lower} {body_lower}"

        # Check for task indicators
        task_score = 0.0
        has_imperative = self._has_imperative_verb(subject_lower)
        has_deadline = self._has_deadline(combined)

        if has_imperative:
            task_score += 0.5
            signals.append("imperative_verb_in_subject")

        if has_deadline:
            task_score += 0.3
            signals.append("deadline_detected")

        # Check verb density in body
        verb_count = sum(1 for verb in self.TASK_VERBS if verb in body_lower)
        if verb_count >= 3:
            task_score += 0.2
            signals.append(f"high_verb_density:{verb_count}")

        # Check for question indicators
        question_score = 0.0
        question_mark_count = combined.count("?")

        if question_mark_count > 2:
            question_score += 0.5
            signals.append(f"multiple_questions:{question_mark_count}")
        elif question_mark_count > 0:
            question_score += 0.2
            signals.append("has_question")

        # Check for question words
        question_word_count = sum(
            1 for regex in self._question_regexes
            if regex.search(combined)
        )
        if question_word_count > 3:
            question_score += 0.3
            signals.append("high_question_word_density")

        # Calculate info score as remainder
        info_score = max(0.3, 1.0 - task_score - question_score)

        # Normalize scores
        total = task_score + question_score + info_score
        if total > 0:
            task_prob = task_score / total
            question_prob = question_score / total
            info_prob = info_score / total
        else:
            task_prob = 0.0
            question_prob = 0.0
            info_prob = 1.0

        # Determine classification
        if task_prob >= 0.5:
            classification = EmailClassification.TASK_REQUEST
            confidence = task_prob
        elif question_prob >= 0.5:
            classification = EmailClassification.QUESTION
            confidence = question_prob
        else:
            classification = EmailClassification.INFORMATION
            confidence = info_prob

        return ClassificationResult(
            classification=classification,
            confidence=confidence,
            task_probability=task_prob,
            question_probability=question_prob,
            info_probability=info_prob,
            signals=signals,
        )

    def _has_imperative_verb(self, text: str) -> bool:
        """Check if text starts with an imperative verb."""
        words = text.split()
        if words:
            first_word = words[0].strip("[]():,")
            return first_word in self.TASK_VERBS
        return False

    def _has_deadline(self, text: str) -> bool:
        """Check if text contains a deadline."""
        for regex in self._deadline_regexes:
            if regex.search(text):
                return True
        return False


class TaskExtractor:
    """
    Extracts actionable tasks from emails.

    Parses email content to identify tasks, deadlines, and priorities.
    """

    # Action verb to TaskAction mapping
    ACTION_MAPPING = {
        "create": TaskAction.CREATE,
        "make": TaskAction.CREATE,
        "build": TaskAction.CREATE,
        "generate": TaskAction.GENERATE,
        "send": TaskAction.SEND,
        "schedule": TaskAction.SCHEDULE,
        "book": TaskAction.BOOK,
        "update": TaskAction.UPDATE,
        "modify": TaskAction.UPDATE,
        "change": TaskAction.UPDATE,
        "delete": TaskAction.DELETE,
        "remove": TaskAction.DELETE,
        "review": TaskAction.REVIEW,
        "approve": TaskAction.APPROVE,
        "analyze": TaskAction.ANALYZE,
        "research": TaskAction.RESEARCH,
    }

    # Day name to offset mapping
    DAY_OFFSETS = {
        "monday": 0, "tuesday": 1, "wednesday": 2, "thursday": 3,
        "friday": 4, "saturday": 5, "sunday": 6,
    }

    def __init__(self, config: Optional[EmailIngestConfig] = None):
        self.config = config or EmailIngestConfig()
        self._deadline_regex = re.compile(
            r"\bby\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday"
            r"|\d{1,2}[/\-]\d{1,2}(?:[/\-]\d{2,4})?)\b",
            re.IGNORECASE
        )
        self._time_regex = re.compile(r"\b(\d{1,2}):(\d{2})\s*(am|pm)?\b", re.IGNORECASE)

    def extract(self, email: EmailMessage) -> List[ExtractedTask]:
        """
        Extract tasks from an email.

        Args:
            email: The email to extract tasks from

        Returns:
            List of extracted tasks
        """
        tasks = []
        subject = email.subject
        body = email.body_text

        # Try to extract primary task from subject
        primary_task = self._extract_from_subject(email)
        if primary_task:
            tasks.append(primary_task)

        # Extract additional tasks from body
        body_tasks = self._extract_from_body(email)
        tasks.extend(body_tasks)

        # Deduplicate similar tasks
        tasks = self._deduplicate_tasks(tasks)

        # Check for blocked/confirmation-required actions
        for task in tasks:
            action_str = task.action.value
            # Check exact match or prefix match (e.g., "send" matches "send_email")
            is_blocked = any(
                action_str == blocked or blocked.startswith(action_str)
                for blocked in self.config.blocked_actions
            )
            is_confirmation_required = any(
                action_str == req or req.startswith(action_str)
                for req in self.config.confirmation_required_actions
            )

            if is_blocked:
                task.requires_confirmation = True
                task.confirmation_status = ConfirmationStatus.REJECTED
                task.metadata["blocked_reason"] = "Action not allowed from email"
            elif is_confirmation_required:
                task.requires_confirmation = True
                task.confirmation_status = ConfirmationStatus.PENDING

        return tasks

    def _extract_from_subject(self, email: EmailMessage) -> Optional[ExtractedTask]:
        """Extract task from email subject."""
        subject = email.subject.strip()
        if not subject:
            return None

        words = subject.lower().split()
        if not words:
            return None

        # Check for action verb
        first_word = words[0].strip("[]():,")
        action = self.ACTION_MAPPING.get(first_word, TaskAction.UNKNOWN)

        if action == TaskAction.UNKNOWN:
            return None

        # Extract deadline from subject or body
        due_date = self._extract_deadline(f"{email.subject} {email.body_text}")

        # Determine priority based on deadline
        priority = self._calculate_priority(due_date)

        # Build title from subject
        title = subject

        return ExtractedTask(
            email_id=email.id,
            action=action,
            title=title,
            description=email.body_text[:500] if email.body_text else "",
            priority=priority,
            due_date=due_date,
            assignee=email.recipients[0].address if email.recipients else "",
            attachments=[a.filename for a in email.attachments],
            confidence=0.8 if due_date else 0.6,
        )

    def _extract_from_body(self, email: EmailMessage) -> List[ExtractedTask]:
        """Extract tasks from email body."""
        tasks = []
        body = email.body_text

        # Split into sentences/lines
        lines = re.split(r'[.\n]', body)

        for line in lines:
            line = line.strip()
            if not line:
                continue

            words = line.lower().split()
            if not words:
                continue

            first_word = words[0].strip("[]():,-•")
            action = self.ACTION_MAPPING.get(first_word)

            if action:
                due_date = self._extract_deadline(line)
                priority = self._calculate_priority(due_date)

                tasks.append(ExtractedTask(
                    email_id=email.id,
                    action=action,
                    title=line[:100],
                    description=line,
                    priority=priority,
                    due_date=due_date,
                    confidence=0.5,
                ))

        return tasks

    def _extract_deadline(self, text: str) -> Optional[datetime]:
        """Extract deadline from text."""
        text_lower = text.lower()

        # Check for ASAP/urgent
        if any(word in text_lower for word in ["asap", "urgent", "immediately"]):
            return datetime.utcnow() + timedelta(hours=4)

        # Check for EOD/COB
        if any(phrase in text_lower for phrase in ["eod", "end of day", "cob", "close of business"]):
            today = datetime.utcnow().replace(hour=17, minute=0, second=0, microsecond=0)
            if datetime.utcnow().hour >= 17:
                today += timedelta(days=1)
            return today

        # Check for day names
        match = self._deadline_regex.search(text)
        if match:
            deadline_str = match.group(1).lower()

            # Check if it's a day name
            if deadline_str in self.DAY_OFFSETS:
                target_day = self.DAY_OFFSETS[deadline_str]
                today = datetime.utcnow()
                current_day = today.weekday()
                days_ahead = target_day - current_day
                if days_ahead <= 0:
                    days_ahead += 7
                return today + timedelta(days=days_ahead)

            # Try to parse as date
            try:
                # Handle various date formats
                for fmt in ["%m/%d/%Y", "%m-%d-%Y", "%m/%d/%y", "%m-%d-%y", "%m/%d", "%m-%d"]:
                    try:
                        parsed = datetime.strptime(deadline_str, fmt)
                        if parsed.year == 1900:  # No year specified
                            parsed = parsed.replace(year=datetime.utcnow().year)
                        return parsed
                    except ValueError:
                        continue
            except Exception:
                pass

        return None

    def _calculate_priority(self, due_date: Optional[datetime]) -> EmailPriority:
        """Calculate priority based on deadline."""
        if not due_date:
            return EmailPriority.LOW

        now = datetime.utcnow()
        delta = due_date - now

        if delta.total_seconds() < 4 * 3600:  # < 4 hours
            return EmailPriority.CRITICAL
        elif delta.total_seconds() < 24 * 3600:  # < 24 hours
            return EmailPriority.HIGH
        elif delta.days < 7:  # < 1 week
            return EmailPriority.MEDIUM
        else:
            return EmailPriority.LOW

    def _deduplicate_tasks(self, tasks: List[ExtractedTask]) -> List[ExtractedTask]:
        """Remove duplicate tasks."""
        seen_titles = set()
        unique_tasks = []

        for task in tasks:
            # Normalize title for comparison
            normalized = task.title.lower().strip()
            if normalized not in seen_titles:
                seen_titles.add(normalized)
                unique_tasks.append(task)

        return unique_tasks


class EmailIngestManager:
    """
    Manages the complete email ingestion pipeline.

    Coordinates security validation, classification, and task extraction.
    """

    def __init__(self, config: Optional[EmailIngestConfig] = None):
        self.config = config or EmailIngestConfig()
        self.security = EmailSecurityValidator(self.config)
        self.classifier = EmailClassifier()
        self.extractor = TaskExtractor(self.config)
        self._lock = asyncio.Lock()
        self._processed: Dict[str, IngestResult] = {}
        self._pending_confirmations: Dict[str, ExtractedTask] = {}
        self._callbacks: Dict[str, List[Callable]] = {
            "on_task_extracted": [],
            "on_confirmation_required": [],
            "on_security_failure": [],
            "on_rate_limited": [],
        }

    async def ingest(self, email: EmailMessage) -> IngestResult:
        """
        Ingest and process an email.

        Args:
            email: The email to ingest

        Returns:
            IngestResult with processing details
        """
        errors = []

        # Step 1: Security validation
        security = await self.security.validate(email)
        if not security.is_valid:
            await self._trigger_callback("on_security_failure", email, security)
            if security.status == SecurityStatus.RATE_LIMITED:
                await self._trigger_callback("on_rate_limited", email)
            return IngestResult(
                email_id=email.id,
                success=False,
                security=security,
                errors=security.issues,
            )

        # Step 2: Classification
        classification = self.classifier.classify(email)

        # Step 3: Task extraction (if task or has actionable content)
        tasks = []
        if classification.classification in [
            EmailClassification.TASK_REQUEST,
            EmailClassification.QUESTION,
        ]:
            tasks = self.extractor.extract(email)

            # Handle tasks requiring confirmation
            for task in tasks:
                if task.requires_confirmation:
                    async with self._lock:
                        self._pending_confirmations[task.id] = task
                    await self._trigger_callback("on_confirmation_required", task)
                else:
                    await self._trigger_callback("on_task_extracted", task)

        result = IngestResult(
            email_id=email.id,
            success=True,
            security=security,
            classification=classification,
            tasks=tasks,
            errors=errors,
        )

        # Store result
        async with self._lock:
            self._processed[email.id] = result

        return result

    async def confirm_task(self, task_id: str, confirmed: bool) -> Optional[ExtractedTask]:
        """
        Confirm or reject a pending task.

        Args:
            task_id: The task ID
            confirmed: Whether to confirm or reject

        Returns:
            Updated task or None if not found
        """
        async with self._lock:
            task = self._pending_confirmations.get(task_id)
            if not task:
                return None

            if confirmed:
                task.confirmation_status = ConfirmationStatus.CONFIRMED
                await self._trigger_callback("on_task_extracted", task)
            else:
                task.confirmation_status = ConfirmationStatus.REJECTED

            del self._pending_confirmations[task_id]
            return task

    async def get_pending_confirmations(self) -> List[ExtractedTask]:
        """Get all tasks pending confirmation."""
        async with self._lock:
            return list(self._pending_confirmations.values())

    def get_result(self, email_id: str) -> Optional[IngestResult]:
        """Get the result for a processed email."""
        return self._processed.get(email_id)

    def register_callback(
        self, event: str, callback: Callable
    ) -> None:
        """Register a callback for an event."""
        if event in self._callbacks:
            self._callbacks[event].append(callback)

    async def _trigger_callback(self, event: str, *args) -> None:
        """Trigger callbacks for an event."""
        for callback in self._callbacks.get(event, []):
            try:
                if asyncio.iscoroutinefunction(callback):
                    await callback(*args)
                else:
                    callback(*args)
            except Exception:
                pass  # Don't let callback errors break the pipeline

    def get_stats(self) -> Dict[str, Any]:
        """Get ingestion statistics."""
        total = len(self._processed)
        successful = sum(1 for r in self._processed.values() if r.success)
        tasks_extracted = sum(len(r.tasks) for r in self._processed.values())
        pending = len(self._pending_confirmations)

        classifications = {}
        for result in self._processed.values():
            if result.classification:
                cls = result.classification.classification.value
                classifications[cls] = classifications.get(cls, 0) + 1

        return {
            "total_processed": total,
            "successful": successful,
            "failed": total - successful,
            "tasks_extracted": tasks_extracted,
            "pending_confirmations": pending,
            "classifications": classifications,
        }


# Global instance management
_email_ingest_manager: Optional[EmailIngestManager] = None


def get_email_ingest_manager() -> Optional[EmailIngestManager]:
    """Get the global email ingest manager."""
    return _email_ingest_manager


def set_email_ingest_manager(manager: EmailIngestManager) -> None:
    """Set the global email ingest manager."""
    global _email_ingest_manager
    _email_ingest_manager = manager


def reset_email_ingest_manager() -> None:
    """Reset the global email ingest manager."""
    global _email_ingest_manager
    _email_ingest_manager = None
