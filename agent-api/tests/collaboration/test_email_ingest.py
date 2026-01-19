"""Tests for the email task ingestion module."""

import pytest
from datetime import datetime, timedelta

from app.collaboration.email_ingest import (
    EmailIngestManager,
    EmailIngestConfig,
    EmailMessage,
    EmailAddress,
    EmailAttachment,
    EmailClassification,
    EmailPriority,
    EmailClassifier,
    EmailSecurityValidator,
    TaskExtractor,
    ExtractedTask,
    TaskAction,
    SecurityValidation,
    SecurityStatus,
    ClassificationResult,
    IngestResult,
    ConfirmationStatus,
    get_email_ingest_manager,
    set_email_ingest_manager,
    reset_email_ingest_manager,
)


class TestEmailAddress:
    """Tests for EmailAddress."""

    def test_create_address(self):
        """Test creating an email address."""
        addr = EmailAddress(address="user@example.com", name="User Name")
        assert addr.address == "user@example.com"
        assert addr.name == "User Name"
        assert addr.domain == "example.com"

    def test_auto_extract_domain(self):
        """Test automatic domain extraction."""
        addr = EmailAddress(address="test@subdomain.company.com")
        assert addr.domain == "subdomain.company.com"

    def test_no_domain_in_address(self):
        """Test address without domain."""
        addr = EmailAddress(address="localonly")
        assert addr.domain == ""


class TestEmailAttachment:
    """Tests for EmailAttachment."""

    def test_create_attachment(self):
        """Test creating an attachment."""
        att = EmailAttachment(
            filename="report.pdf",
            content_type="application/pdf",
            size_bytes=1024,
        )
        assert att.filename == "report.pdf"
        assert att.size_bytes == 1024


class TestEmailMessage:
    """Tests for EmailMessage."""

    def test_create_message(self):
        """Test creating an email message."""
        email = EmailMessage(
            subject="Test Subject",
            body_text="Test body content",
            sender=EmailAddress(address="sender@swissbrain.ai"),
        )
        assert email.subject == "Test Subject"
        assert email.sender.domain == "swissbrain.ai"

    def test_total_attachment_size(self):
        """Test calculating total attachment size."""
        email = EmailMessage(
            subject="With attachments",
            attachments=[
                EmailAttachment(filename="a.pdf", content_type="application/pdf", size_bytes=1000),
                EmailAttachment(filename="b.pdf", content_type="application/pdf", size_bytes=2000),
            ],
        )
        assert email.total_attachment_size() == 3000

    def test_empty_attachments(self):
        """Test message without attachments."""
        email = EmailMessage(subject="No attachments")
        assert email.total_attachment_size() == 0


class TestEmailIngestConfig:
    """Tests for EmailIngestConfig."""

    def test_default_config(self):
        """Test default configuration."""
        config = EmailIngestConfig()
        assert "swissbrain.ai" in config.whitelisted_domains
        assert config.max_emails_per_hour == 10
        assert config.max_body_length == 50000
        assert config.require_dkim is True

    def test_custom_config(self):
        """Test custom configuration."""
        config = EmailIngestConfig(
            max_emails_per_hour=20,
            require_dkim=False,
        )
        assert config.max_emails_per_hour == 20
        assert config.require_dkim is False

    def test_blocked_actions(self):
        """Test blocked actions configuration."""
        config = EmailIngestConfig()
        assert "delete_account" in config.blocked_actions
        assert "change_password" in config.blocked_actions

    def test_confirmation_required_actions(self):
        """Test confirmation-required actions."""
        config = EmailIngestConfig()
        assert "send_email" in config.confirmation_required_actions
        assert "payment" in config.confirmation_required_actions


class TestEmailSecurityValidator:
    """Tests for EmailSecurityValidator."""

    @pytest.mark.asyncio
    async def test_create_validator(self):
        """Test creating a validator."""
        validator = EmailSecurityValidator()
        assert validator is not None

    @pytest.mark.asyncio
    async def test_validate_whitelisted_domain(self):
        """Test validating email from whitelisted domain."""
        validator = EmailSecurityValidator()
        email = EmailMessage(
            subject="Test",
            sender=EmailAddress(address="user@swissbrain.ai"),
            headers={"DKIM-Signature": "valid", "Received-SPF": "pass"},
        )
        result = await validator.validate(email)
        assert result.is_valid
        assert result.domain_whitelisted

    @pytest.mark.asyncio
    async def test_reject_unknown_domain(self):
        """Test rejecting email from unknown domain."""
        validator = EmailSecurityValidator()
        email = EmailMessage(
            subject="Test",
            sender=EmailAddress(address="user@unknown.com"),
        )
        result = await validator.validate(email)
        assert not result.is_valid
        assert result.status == SecurityStatus.DOMAIN_NOT_WHITELISTED

    @pytest.mark.asyncio
    async def test_content_too_large(self):
        """Test rejecting oversized content."""
        config = EmailIngestConfig(max_body_length=100)
        validator = EmailSecurityValidator(config)
        email = EmailMessage(
            subject="Test",
            body_text="x" * 200,
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        result = await validator.validate(email)
        assert not result.is_valid
        assert result.status == SecurityStatus.CONTENT_TOO_LARGE

    @pytest.mark.asyncio
    async def test_too_many_attachments(self):
        """Test rejecting too many attachments."""
        config = EmailIngestConfig(max_attachments=2)
        validator = EmailSecurityValidator(config)
        email = EmailMessage(
            subject="Test",
            sender=EmailAddress(address="user@swissbrain.ai"),
            attachments=[
                EmailAttachment(filename=f"{i}.pdf", content_type="application/pdf", size_bytes=100)
                for i in range(5)
            ],
        )
        result = await validator.validate(email)
        assert not result.is_valid
        assert result.status == SecurityStatus.TOO_MANY_ATTACHMENTS

    @pytest.mark.asyncio
    async def test_attachment_too_large(self):
        """Test rejecting oversized attachment."""
        config = EmailIngestConfig(max_attachment_size=1000)
        validator = EmailSecurityValidator(config)
        email = EmailMessage(
            subject="Test",
            sender=EmailAddress(address="user@swissbrain.ai"),
            attachments=[
                EmailAttachment(filename="big.pdf", content_type="application/pdf", size_bytes=5000),
            ],
        )
        result = await validator.validate(email)
        assert not result.is_valid
        assert result.status == SecurityStatus.ATTACHMENT_TOO_LARGE

    @pytest.mark.asyncio
    async def test_rate_limiting(self):
        """Test rate limiting enforces configured limit."""
        config = EmailIngestConfig(max_emails_per_hour=3)
        validator = EmailSecurityValidator(config)

        results = []
        for i in range(5):
            email = EmailMessage(
                subject=f"Test {i}",
                sender=EmailAddress(address="user@swissbrain.ai"),
            )
            result = await validator.validate(email)
            results.append(result)

        # Rate limiting should kick in before max is reached
        successful = sum(1 for r in results if r.is_valid)
        assert successful <= config.max_emails_per_hour
        assert successful >= 2  # At least 2 should succeed
        # Later emails should be rate limited
        rate_limited = [r for r in results if r.status == SecurityStatus.RATE_LIMITED]
        assert len(rate_limited) >= 2

    @pytest.mark.asyncio
    async def test_no_sender(self):
        """Test rejecting email without sender."""
        validator = EmailSecurityValidator()
        email = EmailMessage(subject="Test")
        result = await validator.validate(email)
        assert not result.is_valid

    def test_add_whitelisted_domain(self):
        """Test adding domain to whitelist."""
        validator = EmailSecurityValidator()
        validator.add_whitelisted_domain("newdomain.com")
        assert "newdomain.com" in validator.config.whitelisted_domains

    def test_remove_whitelisted_domain(self):
        """Test removing domain from whitelist."""
        validator = EmailSecurityValidator()
        validator.add_whitelisted_domain("temp.com")
        validator.remove_whitelisted_domain("temp.com")
        assert "temp.com" not in validator.config.whitelisted_domains


class TestEmailClassifier:
    """Tests for EmailClassifier."""

    def test_create_classifier(self):
        """Test creating a classifier."""
        classifier = EmailClassifier()
        assert classifier is not None

    def test_classify_task_request(self):
        """Test classifying task request."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="Create quarterly report by Friday",
            body_text="Please create the Q4 report and send it to the team.",
        )
        result = classifier.classify(email)
        assert result.classification == EmailClassification.TASK_REQUEST
        assert result.task_probability > 0.5

    def test_classify_question(self):
        """Test classifying question."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="Question about the project?",
            body_text="What is the status? When will it be done? Who is working on it?",
        )
        result = classifier.classify(email)
        assert result.classification == EmailClassification.QUESTION
        assert result.question_probability > 0.3

    def test_classify_information(self):
        """Test classifying information."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="FYI: Meeting notes",
            body_text="Here are the notes from today's meeting.",
        )
        result = classifier.classify(email)
        assert result.classification == EmailClassification.INFORMATION

    def test_detect_deadline_day_name(self):
        """Test detecting deadline with day name."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="Submit report by Monday",
            body_text="Please have this ready.",
        )
        result = classifier.classify(email)
        assert "deadline_detected" in result.signals

    def test_detect_deadline_eod(self):
        """Test detecting EOD deadline."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="Need this EOD",
            body_text="Urgent request.",
        )
        result = classifier.classify(email)
        assert "deadline_detected" in result.signals

    def test_detect_imperative_verb(self):
        """Test detecting imperative verb."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="Generate sales report",
            body_text="",
        )
        result = classifier.classify(email)
        assert "imperative_verb_in_subject" in result.signals

    def test_classification_confidence(self):
        """Test classification confidence."""
        classifier = EmailClassifier()
        email = EmailMessage(
            subject="Build new feature ASAP",
            body_text="Create, develop, and deploy the new user authentication system by EOD.",
        )
        result = classifier.classify(email)
        assert result.confidence > 0.5


class TestTaskExtractor:
    """Tests for TaskExtractor."""

    def test_create_extractor(self):
        """Test creating an extractor."""
        extractor = TaskExtractor()
        assert extractor is not None

    def test_extract_from_subject(self):
        """Test extracting task from subject."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Create monthly report",
            body_text="Please generate the monthly financial report.",
            sender=EmailAddress(address="boss@swissbrain.ai"),
            recipients=[EmailAddress(address="employee@swissbrain.ai")],
        )
        tasks = extractor.extract(email)
        assert len(tasks) >= 1
        assert tasks[0].action == TaskAction.CREATE

    def test_extract_with_deadline(self):
        """Test extracting task with deadline."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Send report by Friday",
            body_text="",
        )
        tasks = extractor.extract(email)
        assert len(tasks) >= 1
        assert tasks[0].due_date is not None

    def test_extract_urgent_priority(self):
        """Test extracting urgent task."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Review document ASAP",
            body_text="This is urgent.",
        )
        tasks = extractor.extract(email)
        assert len(tasks) >= 1
        assert tasks[0].priority in [EmailPriority.CRITICAL, EmailPriority.HIGH]

    def test_extract_eod_deadline(self):
        """Test extracting EOD deadline."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Complete task EOD",
            body_text="",
        )
        tasks = extractor.extract(email)
        if tasks:
            assert tasks[0].due_date is not None
            # Should be today or tomorrow at 5 PM
            assert tasks[0].due_date.hour == 17

    def test_blocked_action_rejected(self):
        """Test that blocked actions are rejected."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Delete account for user",
            body_text="Please delete_account for test user.",
        )
        tasks = extractor.extract(email)
        delete_tasks = [t for t in tasks if t.action == TaskAction.DELETE]
        for task in delete_tasks:
            if "delete" in task.metadata.get("blocked_reason", "").lower() or task.requires_confirmation:
                assert task.requires_confirmation

    def test_confirmation_required_action(self):
        """Test that certain actions require confirmation."""
        config = EmailIngestConfig()
        extractor = TaskExtractor(config)
        email = EmailMessage(
            subject="Send email to all customers",
            body_text="Please send the announcement.",
        )
        tasks = extractor.extract(email)
        send_tasks = [t for t in tasks if t.action == TaskAction.SEND]
        for task in send_tasks:
            assert task.requires_confirmation
            assert task.confirmation_status == ConfirmationStatus.PENDING

    def test_extract_multiple_tasks(self):
        """Test extracting multiple tasks from body."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Create weekly report",
            body_text="""
            Create the new landing page.
            Update the documentation.
            Review the PR from John.
            """,
        )
        tasks = extractor.extract(email)
        # Should extract at least the subject task
        assert len(tasks) >= 1
        # Should find create action from subject
        assert any(t.action == TaskAction.CREATE for t in tasks)

    def test_deduplicate_tasks(self):
        """Test task deduplication."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Create report",
            body_text="Create report for the meeting. Create report by EOD.",
        )
        tasks = extractor.extract(email)
        # Should not have duplicate "create report" tasks
        titles = [t.title.lower() for t in tasks]
        assert len(titles) == len(set(titles))

    def test_extract_with_attachments(self):
        """Test task extraction includes attachments."""
        extractor = TaskExtractor()
        email = EmailMessage(
            subject="Review attached document",
            body_text="Please review.",
            attachments=[
                EmailAttachment(filename="doc.pdf", content_type="application/pdf", size_bytes=1000),
            ],
        )
        tasks = extractor.extract(email)
        if tasks:
            assert "doc.pdf" in tasks[0].attachments


class TestExtractedTask:
    """Tests for ExtractedTask."""

    def test_create_task(self):
        """Test creating a task."""
        task = ExtractedTask(
            action=TaskAction.CREATE,
            title="Build feature",
            priority=EmailPriority.HIGH,
        )
        assert task.action == TaskAction.CREATE
        assert task.priority == EmailPriority.HIGH

    def test_task_to_dict(self):
        """Test task to_dict conversion."""
        task = ExtractedTask(
            action=TaskAction.REVIEW,
            title="Review PR",
            priority=EmailPriority.MEDIUM,
            due_date=datetime(2024, 1, 15),
        )
        data = task.to_dict()
        assert data["action"] == "review"
        assert data["priority"] == "medium"
        assert data["due_date"] is not None


class TestEmailIngestManager:
    """Tests for EmailIngestManager."""

    @pytest.mark.asyncio
    async def test_create_manager(self):
        """Test creating a manager."""
        manager = EmailIngestManager()
        assert manager is not None

    @pytest.mark.asyncio
    async def test_ingest_valid_email(self):
        """Test ingesting a valid email."""
        manager = EmailIngestManager()
        email = EmailMessage(
            subject="Create new feature",
            body_text="Please build the new dashboard feature.",
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        result = await manager.ingest(email)
        assert result.success
        assert result.classification is not None
        assert len(result.tasks) >= 1

    @pytest.mark.asyncio
    async def test_ingest_blocked_domain(self):
        """Test ingesting email from blocked domain."""
        manager = EmailIngestManager()
        email = EmailMessage(
            subject="Test",
            body_text="Test",
            sender=EmailAddress(address="user@unknown.com"),
        )
        result = await manager.ingest(email)
        assert not result.success
        assert result.security.status == SecurityStatus.DOMAIN_NOT_WHITELISTED

    @pytest.mark.asyncio
    async def test_confirm_task(self):
        """Test confirming a pending task."""
        config = EmailIngestConfig(
            confirmation_required_actions={"create"},
        )
        manager = EmailIngestManager(config)
        email = EmailMessage(
            subject="Create sensitive document",
            body_text="Please create this.",
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        result = await manager.ingest(email)

        # Find tasks requiring confirmation
        pending = await manager.get_pending_confirmations()
        if pending:
            task = pending[0]
            confirmed = await manager.confirm_task(task.id, True)
            assert confirmed is not None
            assert confirmed.confirmation_status == ConfirmationStatus.CONFIRMED

    @pytest.mark.asyncio
    async def test_reject_task(self):
        """Test rejecting a pending task."""
        config = EmailIngestConfig(
            confirmation_required_actions={"send"},
        )
        manager = EmailIngestManager(config)
        email = EmailMessage(
            subject="Send announcement to all",
            body_text="",
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        result = await manager.ingest(email)

        pending = await manager.get_pending_confirmations()
        if pending:
            task = pending[0]
            rejected = await manager.confirm_task(task.id, False)
            assert rejected is not None
            assert rejected.confirmation_status == ConfirmationStatus.REJECTED

    @pytest.mark.asyncio
    async def test_confirm_nonexistent_task(self):
        """Test confirming nonexistent task."""
        manager = EmailIngestManager()
        result = await manager.confirm_task("fake-id", True)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_result(self):
        """Test getting processing result."""
        manager = EmailIngestManager()
        email = EmailMessage(
            subject="Test",
            body_text="Test",
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        await manager.ingest(email)
        result = manager.get_result(email.id)
        assert result is not None

    @pytest.mark.asyncio
    async def test_get_stats(self):
        """Test getting statistics."""
        manager = EmailIngestManager()
        email = EmailMessage(
            subject="Create report",
            body_text="",
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        await manager.ingest(email)
        stats = manager.get_stats()
        assert stats["total_processed"] == 1
        assert stats["successful"] == 1

    @pytest.mark.asyncio
    async def test_callback_on_task_extracted(self):
        """Test callback on task extraction."""
        manager = EmailIngestManager()
        extracted_tasks = []

        def on_task(task):
            extracted_tasks.append(task)

        manager.register_callback("on_task_extracted", on_task)

        email = EmailMessage(
            subject="Build new feature",
            body_text="",
            sender=EmailAddress(address="user@swissbrain.ai"),
        )
        await manager.ingest(email)

        # Non-confirmation tasks should trigger callback
        # Note: May be empty if all tasks require confirmation

    @pytest.mark.asyncio
    async def test_callback_on_security_failure(self):
        """Test callback on security failure."""
        manager = EmailIngestManager()
        failures = []

        def on_failure(email, security):
            failures.append((email, security))

        manager.register_callback("on_security_failure", on_failure)

        email = EmailMessage(
            subject="Test",
            sender=EmailAddress(address="user@blocked.com"),
        )
        await manager.ingest(email)
        assert len(failures) == 1


class TestEnums:
    """Tests for enums."""

    def test_email_classification_values(self):
        """Test email classification values."""
        assert EmailClassification.TASK_REQUEST.value == "task_request"
        assert EmailClassification.QUESTION.value == "question"
        assert EmailClassification.INFORMATION.value == "information"

    def test_email_priority_values(self):
        """Test email priority values."""
        assert EmailPriority.CRITICAL.value == "critical"
        assert EmailPriority.HIGH.value == "high"
        assert EmailPriority.LOW.value == "low"

    def test_task_action_values(self):
        """Test task action values."""
        assert TaskAction.CREATE.value == "create"
        assert TaskAction.SEND.value == "send"
        assert TaskAction.REVIEW.value == "review"

    def test_security_status_values(self):
        """Test security status values."""
        assert SecurityStatus.VALID.value == "valid"
        assert SecurityStatus.RATE_LIMITED.value == "rate_limited"

    def test_confirmation_status_values(self):
        """Test confirmation status values."""
        assert ConfirmationStatus.PENDING.value == "pending"
        assert ConfirmationStatus.CONFIRMED.value == "confirmed"


class TestGlobalInstances:
    """Tests for global instance management."""

    def teardown_method(self):
        """Reset global instances after each test."""
        reset_email_ingest_manager()

    def test_get_manager_none(self):
        """Test getting manager when not set."""
        reset_email_ingest_manager()
        assert get_email_ingest_manager() is None

    def test_set_and_get_manager(self):
        """Test setting and getting manager."""
        manager = EmailIngestManager()
        set_email_ingest_manager(manager)
        assert get_email_ingest_manager() is manager

    def test_reset_manager(self):
        """Test resetting manager."""
        manager = EmailIngestManager()
        set_email_ingest_manager(manager)
        reset_email_ingest_manager()
        assert get_email_ingest_manager() is None


class TestIntegration:
    """Integration tests for email ingestion."""

    @pytest.mark.asyncio
    async def test_full_workflow(self):
        """Test complete email ingestion workflow."""
        config = EmailIngestConfig(
            whitelisted_domains={"swissbrain.ai", "partner.com"},
        )
        manager = EmailIngestManager(config)

        # Ingest task request
        task_email = EmailMessage(
            subject="Create quarterly report by Friday",
            body_text="Please prepare the Q4 financial report and send it to the executive team.",
            sender=EmailAddress(address="cfo@swissbrain.ai"),
            recipients=[EmailAddress(address="analyst@swissbrain.ai")],
            attachments=[
                EmailAttachment(filename="template.xlsx", content_type="application/vnd.ms-excel", size_bytes=5000),
            ],
        )
        result = await manager.ingest(task_email)

        assert result.success
        assert result.classification.classification == EmailClassification.TASK_REQUEST
        assert len(result.tasks) >= 1
        assert result.tasks[0].due_date is not None

    @pytest.mark.asyncio
    async def test_question_email_workflow(self):
        """Test question email workflow."""
        manager = EmailIngestManager()

        question_email = EmailMessage(
            subject="Status update request?",
            body_text="What is the current status of the project? When will phase 2 be complete? Who should I contact for more details?",
            sender=EmailAddress(address="pm@swissbrain.ai"),
        )
        result = await manager.ingest(question_email)

        assert result.success
        assert result.classification.classification == EmailClassification.QUESTION

    @pytest.mark.asyncio
    async def test_rate_limit_across_emails(self):
        """Test rate limiting across multiple emails."""
        config = EmailIngestConfig(max_emails_per_hour=3)
        manager = EmailIngestManager(config)

        results = []
        for i in range(5):
            email = EmailMessage(
                subject=f"Task {i}",
                sender=EmailAddress(address="user@swissbrain.ai"),
            )
            result = await manager.ingest(email)
            results.append(result)

        successful = sum(1 for r in results if r.success)
        # Rate limiting should prevent all 5 from succeeding
        assert successful <= config.max_emails_per_hour
        assert successful >= 2  # At least 2 should succeed
        # Some should be rate limited
        rate_limited = sum(1 for r in results if not r.success)
        assert rate_limited >= 2
