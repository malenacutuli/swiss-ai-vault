"""Tests for Training & Learning Management module."""

from datetime import datetime, timedelta

import pytest

from app.collaboration.training import (
    Assessment,
    AssessmentAttempt,
    AssessmentType,
    Certificate,
    CertificateTemplate,
    CertificationStatus,
    ContentProgress,
    ContentType,
    Course,
    CourseFeedback,
    CourseFormat,
    CourseModule,
    CourseStatus,
    CourseType,
    Credential,
    DifficultyLevel,
    Enrollment,
    EnrollmentStatus,
    Instructor,
    LearningPath,
    NotificationType,
    PathStatus,
    ProgressStatus,
    Question,
    QuestionType,
    SessionStatus,
    TrainingAnalytics,
    TrainingBudget,
    TrainingManager,
    TrainingNotification,
    TrainingRegistry,
    TrainingRequest,
    TrainingSession,
    get_training_manager,
    reset_training_manager,
    set_training_manager,
)


class TestEnums:
    """Test enum values."""

    def test_course_type_values(self):
        """Test course type enum values."""
        assert CourseType.ONBOARDING.value == "onboarding"
        assert CourseType.COMPLIANCE.value == "compliance"
        assert CourseType.SAFETY.value == "safety"
        assert CourseType.TECHNICAL.value == "technical"
        assert CourseType.SOFT_SKILLS.value == "soft_skills"
        assert CourseType.LEADERSHIP.value == "leadership"
        assert len(CourseType) == 14

    def test_course_status_values(self):
        """Test course status enum values."""
        assert CourseStatus.DRAFT.value == "draft"
        assert CourseStatus.PUBLISHED.value == "published"
        assert CourseStatus.ARCHIVED.value == "archived"
        assert len(CourseStatus) == 5

    def test_enrollment_status_values(self):
        """Test enrollment status enum values."""
        assert EnrollmentStatus.PENDING.value == "pending"
        assert EnrollmentStatus.ENROLLED.value == "enrolled"
        assert EnrollmentStatus.IN_PROGRESS.value == "in_progress"
        assert EnrollmentStatus.COMPLETED.value == "completed"
        assert EnrollmentStatus.FAILED.value == "failed"
        assert len(EnrollmentStatus) == 8

    def test_content_type_values(self):
        """Test content type enum values."""
        assert ContentType.VIDEO.value == "video"
        assert ContentType.DOCUMENT.value == "document"
        assert ContentType.QUIZ.value == "quiz"
        assert len(ContentType) == 10

    def test_assessment_type_values(self):
        """Test assessment type enum values."""
        assert AssessmentType.QUIZ.value == "quiz"
        assert AssessmentType.EXAM.value == "exam"
        assert AssessmentType.ASSIGNMENT.value == "assignment"
        assert len(AssessmentType) == 8


class TestCourseModel:
    """Test Course model."""

    def test_create_course(self):
        """Test course creation."""
        course = Course(
            id="course-1",
            title="Python Fundamentals",
            description="Learn Python basics",
            course_type=CourseType.TECHNICAL,
            format=CourseFormat.ONLINE_SELF_PACED,
            difficulty=DifficultyLevel.BEGINNER,
            duration_hours=10.0,
        )
        assert course.id == "course-1"
        assert course.title == "Python Fundamentals"
        assert course.course_type == CourseType.TECHNICAL
        assert course.status == CourseStatus.DRAFT
        assert course.duration_hours == 10.0

    def test_course_is_published(self):
        """Test course published check."""
        course = Course(id="course-1", title="Test")
        assert not course.is_published()

        course.status = CourseStatus.PUBLISHED
        assert course.is_published()

    def test_course_is_mandatory(self):
        """Test course mandatory check."""
        course = Course(id="course-1", title="Test")
        assert not course.is_mandatory()

        course.mandatory = True
        assert course.is_mandatory()


class TestEnrollmentModel:
    """Test Enrollment model."""

    def test_create_enrollment(self):
        """Test enrollment creation."""
        enrollment = Enrollment(
            id="enroll-1",
            user_id="user-1",
            course_id="course-1",
            status=EnrollmentStatus.ENROLLED,
        )
        assert enrollment.id == "enroll-1"
        assert enrollment.user_id == "user-1"
        assert enrollment.status == EnrollmentStatus.ENROLLED
        assert enrollment.progress_percent == 0.0

    def test_enrollment_is_complete(self):
        """Test enrollment completion check."""
        enrollment = Enrollment(id="e-1", user_id="u-1", course_id="c-1")
        assert not enrollment.is_complete()

        enrollment.status = EnrollmentStatus.COMPLETED
        assert enrollment.is_complete()

    def test_enrollment_is_overdue(self):
        """Test enrollment overdue check."""
        enrollment = Enrollment(
            id="e-1",
            user_id="u-1",
            course_id="c-1",
            deadline=datetime.utcnow() - timedelta(days=1),
        )
        assert enrollment.is_overdue()

        enrollment.status = EnrollmentStatus.COMPLETED
        assert not enrollment.is_overdue()


class TestCertificateModel:
    """Test Certificate model."""

    def test_certificate_validity(self):
        """Test certificate validity check."""
        cert = Certificate(
            id="cert-1",
            user_id="user-1",
            template_id="template-1",
            certificate_number="CERT-001",
            title="Python Certification",
            expires_at=datetime.utcnow() + timedelta(days=365),
        )
        assert cert.is_valid()
        assert cert.days_until_expiry() > 0

    def test_expired_certificate(self):
        """Test expired certificate."""
        cert = Certificate(
            id="cert-1",
            user_id="user-1",
            template_id="template-1",
            certificate_number="CERT-001",
            title="Expired Cert",
            expires_at=datetime.utcnow() - timedelta(days=1),
        )
        assert not cert.is_valid()

    def test_revoked_certificate(self):
        """Test revoked certificate."""
        cert = Certificate(
            id="cert-1",
            user_id="user-1",
            template_id="template-1",
            certificate_number="CERT-001",
            title="Revoked Cert",
            status=CertificationStatus.REVOKED,
        )
        assert not cert.is_valid()


class TestTrainingSessionModel:
    """Test TrainingSession model."""

    def test_session_capacity(self):
        """Test session capacity checks."""
        session = TrainingSession(
            id="session-1",
            course_id="course-1",
            capacity=20,
            enrolled_count=15,
        )
        assert session.has_availability()
        assert not session.is_full()

        session.enrolled_count = 20
        assert not session.has_availability()
        assert session.is_full()


class TestTrainingRegistry:
    """Test TrainingRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return TrainingRegistry()

    def test_create_and_get_course(self, registry):
        """Test course creation and retrieval."""
        course = Course(
            id="course-1",
            title="Test Course",
            course_type=CourseType.TECHNICAL,
        )
        registry.create_course(course)

        retrieved = registry.get_course("course-1")
        assert retrieved is not None
        assert retrieved.title == "Test Course"

    def test_list_courses_with_filters(self, registry):
        """Test listing courses with filters."""
        registry.create_course(
            Course(id="c-1", title="Tech 1", course_type=CourseType.TECHNICAL, mandatory=True)
        )
        registry.create_course(
            Course(id="c-2", title="Safety 1", course_type=CourseType.SAFETY, mandatory=False)
        )
        registry.create_course(
            Course(id="c-3", title="Tech 2", course_type=CourseType.TECHNICAL, mandatory=False)
        )

        tech_courses = registry.list_courses(course_type=CourseType.TECHNICAL)
        assert len(tech_courses) == 2

        mandatory = registry.list_courses(mandatory=True)
        assert len(mandatory) == 1

    def test_search_courses(self, registry):
        """Test course search."""
        registry.create_course(Course(id="c-1", title="Python Basics"))
        registry.create_course(Course(id="c-2", title="Java Fundamentals"))
        registry.create_course(
            Course(id="c-3", title="Web Dev", description="Learn Python for web")
        )

        results = registry.search_courses("Python")
        assert len(results) == 2

    def test_enrollment_management(self, registry):
        """Test enrollment CRUD operations."""
        enrollment = Enrollment(
            id="e-1",
            user_id="user-1",
            course_id="course-1",
        )
        registry.create_enrollment(enrollment)

        retrieved = registry.get_enrollment("e-1")
        assert retrieved is not None
        assert retrieved.user_id == "user-1"

        by_user_course = registry.get_enrollment_by_user_course("user-1", "course-1")
        assert by_user_course is not None

    def test_get_overdue_enrollments(self, registry):
        """Test getting overdue enrollments."""
        registry.create_enrollment(
            Enrollment(
                id="e-1",
                user_id="u-1",
                course_id="c-1",
                deadline=datetime.utcnow() - timedelta(days=5),
            )
        )
        registry.create_enrollment(
            Enrollment(
                id="e-2",
                user_id="u-2",
                course_id="c-2",
                deadline=datetime.utcnow() + timedelta(days=5),
            )
        )
        registry.create_enrollment(
            Enrollment(
                id="e-3",
                user_id="u-3",
                course_id="c-3",
                deadline=datetime.utcnow() - timedelta(days=1),
                status=EnrollmentStatus.COMPLETED,
            )
        )

        overdue = registry.get_overdue_enrollments()
        assert len(overdue) == 1
        assert overdue[0].id == "e-1"

    def test_session_management(self, registry):
        """Test session CRUD operations."""
        session = TrainingSession(
            id="s-1",
            course_id="c-1",
            start_time=datetime.utcnow() + timedelta(days=7),
            end_time=datetime.utcnow() + timedelta(days=7, hours=2),
        )
        registry.create_session(session)

        upcoming = registry.get_upcoming_sessions()
        assert len(upcoming) == 1

    def test_certificate_management(self, registry):
        """Test certificate operations."""
        cert = Certificate(
            id="cert-1",
            user_id="user-1",
            template_id="t-1",
            certificate_number="CERT-001",
            title="Test Cert",
            expires_at=datetime.utcnow() + timedelta(days=20),
        )
        registry.create_certificate(cert)

        expiring = registry.get_expiring_certificates(days=30)
        assert len(expiring) == 1

        by_number = registry.get_certificate_by_number("CERT-001")
        assert by_number is not None

    def test_feedback_management(self, registry):
        """Test feedback operations."""
        registry.create_feedback(
            CourseFeedback(
                id="f-1", course_id="c-1", user_id="u-1", enrollment_id="e-1", rating=5
            )
        )
        registry.create_feedback(
            CourseFeedback(
                id="f-2", course_id="c-1", user_id="u-2", enrollment_id="e-2", rating=4
            )
        )

        avg = registry.get_average_course_rating("c-1")
        assert avg == 4.5


class TestTrainingManager:
    """Test TrainingManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return TrainingManager()

    def test_create_course(self, manager):
        """Test course creation via manager."""
        course = manager.create_course(
            title="Python 101",
            course_type=CourseType.TECHNICAL,
            description="Learn Python",
            format=CourseFormat.ONLINE_SELF_PACED,
            difficulty=DifficultyLevel.BEGINNER,
        )
        assert course.id is not None
        assert course.title == "Python 101"
        assert course.status == CourseStatus.DRAFT

    def test_publish_course(self, manager):
        """Test course publishing."""
        course = manager.create_course(title="Test Course")
        published = manager.publish_course(course.id)
        assert published.status == CourseStatus.PUBLISHED
        assert published.published_at is not None

    def test_add_module_and_content(self, manager):
        """Test adding modules and content."""
        course = manager.create_course(title="Full Course")
        module = manager.add_module(
            course_id=course.id,
            title="Module 1",
            order=1,
            duration_minutes=60,
        )
        assert module is not None
        assert module.title == "Module 1"

        content = manager.add_content(
            module_id=module.id,
            title="Video Lecture 1",
            content_type=ContentType.VIDEO,
            duration_minutes=30,
        )
        assert content is not None
        assert content.content_type == ContentType.VIDEO

    def test_add_instructor(self, manager):
        """Test adding instructor."""
        instructor = manager.add_instructor(
            user_id="user-1",
            name="John Doe",
            email="john@example.com",
            bio="Expert trainer",
            specializations=["Python", "Data Science"],
        )
        assert instructor.id is not None
        assert instructor.name == "John Doe"
        assert "Python" in instructor.specializations

    def test_schedule_session(self, manager):
        """Test scheduling a session."""
        course = manager.create_course(title="Workshop")
        instructor = manager.add_instructor(
            user_id="u-1", name="Trainer", email="t@example.com"
        )

        start = datetime.utcnow() + timedelta(days=7)
        end = start + timedelta(hours=4)

        session = manager.schedule_session(
            course_id=course.id,
            start_time=start,
            end_time=end,
            instructor_id=instructor.id,
            location="Room 101",
            capacity=25,
        )
        assert session is not None
        assert session.capacity == 25
        assert session.status == SessionStatus.SCHEDULED

    def test_enroll_user(self, manager):
        """Test user enrollment."""
        course = manager.create_course(title="Enrollment Test")
        enrollment = manager.enroll_user(
            user_id="user-1",
            course_id=course.id,
            assigned_by="admin-1",
        )
        assert enrollment is not None
        assert enrollment.status == EnrollmentStatus.ENROLLED

    def test_enrollment_with_session_capacity(self, manager):
        """Test enrollment respects session capacity."""
        course = manager.create_course(title="Limited Session")
        session = manager.schedule_session(
            course_id=course.id,
            start_time=datetime.utcnow() + timedelta(days=1),
            end_time=datetime.utcnow() + timedelta(days=1, hours=2),
            capacity=1,
        )

        # First enrollment should succeed
        e1 = manager.enroll_user(user_id="u-1", course_id=course.id, session_id=session.id)
        assert e1.status == EnrollmentStatus.ENROLLED

        # Second should be waitlisted
        e2 = manager.enroll_user(user_id="u-2", course_id=course.id, session_id=session.id)
        assert e2.status == EnrollmentStatus.WAITLISTED

    def test_start_and_complete_course(self, manager):
        """Test course start and completion."""
        course = manager.create_course(title="Progression Test")
        enrollment = manager.enroll_user(user_id="u-1", course_id=course.id)

        started = manager.start_course(enrollment.id)
        assert started.status == EnrollmentStatus.IN_PROGRESS
        assert started.started_at is not None

        completed = manager.complete_enrollment(enrollment.id, score=95.0)
        assert completed.status == EnrollmentStatus.COMPLETED
        assert completed.score == 95.0
        assert completed.progress_percent == 100.0

    def test_update_progress(self, manager):
        """Test progress updates."""
        course = manager.create_course(title="Progress Test")
        enrollment = manager.enroll_user(user_id="u-1", course_id=course.id)

        updated = manager.update_progress(enrollment.id, 50.0, time_spent_minutes=30)
        assert updated.progress_percent == 50.0
        assert updated.time_spent_minutes == 30

    def test_content_progress_tracking(self, manager):
        """Test tracking progress on content."""
        course = manager.create_course(title="Content Tracking")
        module = manager.add_module(course_id=course.id, title="Module 1")
        content = manager.add_content(module_id=module.id, title="Lecture 1")
        enrollment = manager.enroll_user(user_id="u-1", course_id=course.id)

        progress = manager.track_content_progress(
            enrollment_id=enrollment.id,
            content_id=content.id,
            progress_percent=50.0,
            time_spent_minutes=15,
        )
        assert progress.status == ProgressStatus.IN_PROGRESS
        assert progress.progress_percent == 50.0

        completed = manager.complete_content(enrollment.id, content.id)
        assert completed.status == ProgressStatus.COMPLETED

    def test_learning_path_management(self, manager):
        """Test learning path operations."""
        c1 = manager.create_course(title="Course 1")
        c2 = manager.create_course(title="Course 2")

        path = manager.create_learning_path(
            title="Developer Path",
            description="Become a developer",
            course_ids=[c1.id],
        )
        assert path.id is not None

        updated = manager.add_course_to_path(path.id, c2.id)
        assert len(updated.course_ids) == 2

        activated = manager.activate_learning_path(path.id)
        assert activated.status == PathStatus.ACTIVE

    def test_assessment_workflow(self, manager):
        """Test assessment creation and attempts."""
        course = manager.create_course(title="Assessment Test")
        assessment = manager.create_assessment(
            course_id=course.id,
            title="Final Quiz",
            assessment_type=AssessmentType.QUIZ,
            passing_score=80.0,
            max_attempts=2,
        )
        assert assessment is not None

        q1 = manager.add_question(
            assessment_id=assessment.id,
            question_text="What is 2+2?",
            question_type=QuestionType.MULTIPLE_CHOICE,
            options=[
                {"id": "a", "text": "3"},
                {"id": "b", "text": "4"},
                {"id": "c", "text": "5"},
            ],
            correct_answer="b",
            points=1.0,
        )
        assert q1 is not None

        enrollment = manager.enroll_user(user_id="u-1", course_id=course.id)
        attempt = manager.start_assessment_attempt(
            assessment_id=assessment.id,
            enrollment_id=enrollment.id,
            user_id="u-1",
        )
        assert attempt is not None
        assert attempt.attempt_number == 1

        submitted = manager.submit_assessment_attempt(
            attempt_id=attempt.id,
            answers={q1.id: "b"},
        )
        assert submitted.passed
        assert submitted.score == 100.0

    def test_certificate_issuance(self, manager):
        """Test certificate template and issuance."""
        template = manager.create_certificate_template(
            name="Course Completion",
            description="Standard completion certificate",
            valid_for_days=365,
        )
        assert template.id is not None

        cert = manager.issue_certificate(
            user_id="u-1",
            template_id=template.id,
            title="Python Fundamentals Certificate",
            course_id="course-1",
            score=95.0,
            issued_by="admin-1",
        )
        assert cert is not None
        assert cert.certificate_number.startswith("CERT-")
        assert cert.verification_code is not None
        assert cert.expires_at is not None

    def test_verify_certificate(self, manager):
        """Test certificate verification."""
        template = manager.create_certificate_template(name="Test Template")
        cert = manager.issue_certificate(
            user_id="u-1",
            template_id=template.id,
            title="Valid Certificate",
        )

        verified = manager.verify_certificate(cert.certificate_number)
        assert verified is not None
        assert verified.id == cert.id

    def test_credential_management(self, manager):
        """Test credential operations."""
        credential = manager.add_credential(
            user_id="u-1",
            name="AWS Solutions Architect",
            issuing_organization="Amazon Web Services",
            credential_id="AWS-SA-12345",
            skills=["Cloud", "AWS", "Architecture"],
        )
        assert credential.id is not None
        assert "AWS" in credential.skills

        creds = manager.get_user_credentials("u-1")
        assert len(creds) == 1

    def test_training_request_workflow(self, manager):
        """Test training request approval workflow."""
        request = manager.submit_training_request(
            user_id="u-1",
            title="AWS Certification Training",
            description="Need training for cloud certification",
            justification="Required for project",
            budget_amount=500.0,
        )
        assert request.id is not None
        assert request.approved is None

        approved = manager.approve_request(request.id, approved_by="manager-1")
        assert approved.approved is True
        assert approved.approved_by == "manager-1"

    def test_deny_request(self, manager):
        """Test training request denial."""
        request = manager.submit_training_request(
            user_id="u-1",
            title="Expensive Training",
        )

        denied = manager.deny_request(
            request.id,
            denied_by="manager-1",
            reason="Budget constraints",
        )
        assert denied.approved is False
        assert denied.denial_reason == "Budget constraints"

    def test_budget_management(self, manager):
        """Test training budget operations."""
        budget = manager.allocate_budget(
            allocated_amount=10000.0,
            fiscal_year=2024,
            department_id="engineering",
        )
        assert budget.id is not None
        assert budget.available_amount() == 10000.0

        updated = manager.spend_from_budget(budget.id, 2500.0)
        assert updated.spent_amount == 2500.0
        assert updated.available_amount() == 7500.0

    def test_feedback_submission(self, manager):
        """Test course feedback."""
        course = manager.create_course(title="Feedback Test")
        enrollment = manager.enroll_user(user_id="u-1", course_id=course.id)

        feedback = manager.submit_feedback(
            course_id=course.id,
            user_id="u-1",
            enrollment_id=enrollment.id,
            rating=5,
            comments="Excellent course!",
            content_rating=5,
            instructor_rating=4,
        )
        assert feedback.id is not None
        assert feedback.rating == 5

        avg = manager.get_average_course_rating(course.id)
        assert avg == 5.0

    def test_notification_management(self, manager):
        """Test notification operations."""
        notification = manager.send_notification(
            user_id="u-1",
            notification_type=NotificationType.ENROLLMENT_CONFIRMED,
            title="Enrollment Confirmed",
            message="You have been enrolled in Python 101",
            course_id="course-1",
        )
        assert notification.id is not None
        assert not notification.read

        notifications = manager.get_user_notifications("u-1", unread_only=True)
        assert len(notifications) == 1

        read = manager.mark_notification_read(notification.id)
        assert read

        unread = manager.get_user_notifications("u-1", unread_only=True)
        assert len(unread) == 0

    def test_generate_analytics(self, manager):
        """Test analytics generation."""
        # Create some data
        c1 = manager.create_course(title="Course 1", course_type=CourseType.TECHNICAL)
        c2 = manager.create_course(title="Course 2", course_type=CourseType.COMPLIANCE)
        manager.publish_course(c1.id)

        e1 = manager.enroll_user(user_id="u-1", course_id=c1.id)
        e2 = manager.enroll_user(user_id="u-2", course_id=c1.id)
        manager.complete_enrollment(e1.id, score=90.0)

        analytics = manager.generate_analytics()
        assert analytics.total_courses == 2
        assert analytics.published_courses == 1
        assert analytics.total_enrollments == 2
        assert analytics.completed_enrollments == 1
        assert "technical" in analytics.courses_by_type


class TestGlobalInstances:
    """Test global instance management."""

    def test_get_training_manager(self):
        """Test getting global manager."""
        reset_training_manager()
        manager = get_training_manager()
        assert manager is not None
        assert isinstance(manager, TrainingManager)

    def test_set_training_manager(self):
        """Test setting global manager."""
        reset_training_manager()
        custom = TrainingManager()
        set_training_manager(custom)
        assert get_training_manager() is custom

    def test_reset_training_manager(self):
        """Test resetting global manager."""
        manager1 = get_training_manager()
        reset_training_manager()
        manager2 = get_training_manager()
        assert manager1 is not manager2


class TestTrainingWorkflows:
    """Test complete training workflows."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return TrainingManager()

    def test_complete_course_workflow(self, manager):
        """Test complete course creation to completion workflow."""
        # Create course
        course = manager.create_course(
            title="Complete Python Course",
            course_type=CourseType.TECHNICAL,
            format=CourseFormat.ONLINE_SELF_PACED,
            difficulty=DifficultyLevel.INTERMEDIATE,
            duration_hours=20.0,
            passing_score=70.0,
            deadline_days=30,
        )

        # Add modules
        m1 = manager.add_module(course.id, "Introduction", order=1, duration_minutes=60)
        m2 = manager.add_module(course.id, "Advanced Topics", order=2, duration_minutes=120)

        # Add content
        c1 = manager.add_content(m1.id, "Welcome Video", ContentType.VIDEO, duration_minutes=10)
        c2 = manager.add_content(m1.id, "Getting Started", ContentType.DOCUMENT, duration_minutes=20)
        c3 = manager.add_content(m2.id, "Advanced Concepts", ContentType.VIDEO, duration_minutes=45)

        # Create assessment
        assessment = manager.create_assessment(
            course_id=course.id,
            title="Final Exam",
            assessment_type=AssessmentType.EXAM,
            passing_score=70.0,
        )
        q1 = manager.add_question(
            assessment.id, "Q1?", QuestionType.MULTIPLE_CHOICE,
            options=[{"id": "a", "text": "A"}, {"id": "b", "text": "B"}],
            correct_answer="a",
        )

        # Create certificate template
        template = manager.create_certificate_template(
            name="Python Course Certificate",
            valid_for_days=730,
        )

        # Publish course
        manager.publish_course(course.id)

        # Enroll user
        enrollment = manager.enroll_user(user_id="student-1", course_id=course.id)
        assert enrollment.deadline is not None

        # Start course
        manager.start_course(enrollment.id)

        # Complete content
        manager.complete_content(enrollment.id, c1.id)
        manager.complete_content(enrollment.id, c2.id)
        manager.complete_content(enrollment.id, c3.id)

        # Take assessment
        attempt = manager.start_assessment_attempt(assessment.id, enrollment.id, "student-1")
        result = manager.submit_assessment_attempt(attempt.id, {q1.id: "a"})
        assert result.passed

        # Complete enrollment
        completed = manager.complete_enrollment(enrollment.id, score=result.score)
        assert completed.status == EnrollmentStatus.COMPLETED

        # Issue certificate
        cert = manager.issue_certificate(
            user_id="student-1",
            template_id=template.id,
            title="Python Course Certificate",
            course_id=course.id,
            score=result.score,
        )
        assert cert.is_valid()

        # Submit feedback
        feedback = manager.submit_feedback(
            course_id=course.id,
            user_id="student-1",
            enrollment_id=enrollment.id,
            rating=5,
            comments="Great course!",
        )
        assert feedback is not None

    def test_instructor_led_training_workflow(self, manager):
        """Test instructor-led training workflow."""
        # Create instructor
        instructor = manager.add_instructor(
            user_id="trainer-1",
            name="Jane Smith",
            email="jane@example.com",
            specializations=["Leadership", "Communication"],
        )

        # Create course
        course = manager.create_course(
            title="Leadership Workshop",
            course_type=CourseType.LEADERSHIP,
            format=CourseFormat.IN_PERSON,
        )
        manager.publish_course(course.id)

        # Schedule session
        start = datetime.utcnow() + timedelta(days=14)
        session = manager.schedule_session(
            course_id=course.id,
            start_time=start,
            end_time=start + timedelta(hours=8),
            instructor_id=instructor.id,
            location="Conference Room A",
            capacity=15,
        )

        # Enroll participants
        enrollments = []
        for i in range(5):
            e = manager.enroll_user(
                user_id=f"employee-{i}",
                course_id=course.id,
                session_id=session.id,
            )
            enrollments.append(e)

        # Verify session enrollment
        updated_session = manager.get_session(session.id)
        assert updated_session.enrolled_count == 5

        # Complete session
        manager.complete_session(session.id)

        # Complete all enrollments
        for e in enrollments:
            manager.complete_enrollment(e.id)

    def test_learning_path_progression(self, manager):
        """Test learning path progression."""
        # Create courses
        c1 = manager.create_course(title="Fundamentals", course_type=CourseType.TECHNICAL)
        c2 = manager.create_course(title="Intermediate", course_type=CourseType.TECHNICAL)
        c3 = manager.create_course(title="Advanced", course_type=CourseType.TECHNICAL)

        for c in [c1, c2, c3]:
            manager.publish_course(c.id)

        # Create learning path
        path = manager.create_learning_path(
            title="Developer Journey",
            course_ids=[c1.id, c2.id, c3.id],
            order_enforced=True,
        )
        manager.activate_learning_path(path.id)

        # Enroll user in first course
        e1 = manager.enroll_user(user_id="learner-1", course_id=c1.id)
        manager.complete_enrollment(e1.id, score=85.0)

        # Progress to second course
        e2 = manager.enroll_user(user_id="learner-1", course_id=c2.id)
        manager.complete_enrollment(e2.id, score=90.0)

        # Complete final course
        e3 = manager.enroll_user(user_id="learner-1", course_id=c3.id)
        manager.complete_enrollment(e3.id, score=95.0)

        # Issue path completion certificate
        template = manager.create_certificate_template(name="Developer Path Certificate")
        cert = manager.issue_certificate(
            user_id="learner-1",
            template_id=template.id,
            title="Developer Journey Certificate",
            learning_path_id=path.id,
        )
        assert cert.is_valid()
