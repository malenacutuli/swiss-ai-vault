"""
Tests for the Feedback & Performance Reviews module.
"""

import pytest
from datetime import datetime, timedelta

from app.collaboration.feedback import (
    FeedbackManager,
    FeedbackRegistry,
    PerformanceReview,
    ReviewType,
    ReviewStatus,
    ReviewTemplate,
    ReviewCycle,
    CycleStatus,
    ReviewQuestion,
    ReviewResponse,
    Feedback,
    FeedbackType,
    FeedbackVisibility,
    FeedbackRequest,
    Recognition,
    Competency,
    CompetencyLevel,
    CompetencyAssessment,
    PerformanceRating,
    ReviewRelationship,
    RatingScale,
    CalibrationSession,
    OneOnOne,
    get_feedback_manager,
    set_feedback_manager,
    reset_feedback_manager,
)


# ============== Enum Tests ==============

class TestReviewType:
    """Tests for ReviewType enum."""

    def test_all_types_exist(self):
        """Test all review types are defined."""
        assert ReviewType.ANNUAL.value == "annual"
        assert ReviewType.SEMI_ANNUAL.value == "semi_annual"
        assert ReviewType.QUARTERLY.value == "quarterly"
        assert ReviewType.PROBATION.value == "probation"
        assert ReviewType.THREE_SIXTY.value == "360_degree"


class TestReviewStatus:
    """Tests for ReviewStatus enum."""

    def test_all_statuses_exist(self):
        """Test all review statuses are defined."""
        assert ReviewStatus.DRAFT.value == "draft"
        assert ReviewStatus.IN_PROGRESS.value == "in_progress"
        assert ReviewStatus.PENDING_SELF.value == "pending_self"
        assert ReviewStatus.PENDING_MANAGER.value == "pending_manager"
        assert ReviewStatus.COMPLETED.value == "completed"
        assert ReviewStatus.ACKNOWLEDGED.value == "acknowledged"


class TestFeedbackType:
    """Tests for FeedbackType enum."""

    def test_all_types_exist(self):
        """Test all feedback types are defined."""
        assert FeedbackType.PRAISE.value == "praise"
        assert FeedbackType.CONSTRUCTIVE.value == "constructive"
        assert FeedbackType.SUGGESTION.value == "suggestion"
        assert FeedbackType.RECOGNITION.value == "recognition"


class TestPerformanceRating:
    """Tests for PerformanceRating enum."""

    def test_all_ratings_exist(self):
        """Test all performance ratings are defined."""
        assert PerformanceRating.EXCEPTIONAL.value == "exceptional"
        assert PerformanceRating.EXCEEDS_EXPECTATIONS.value == "exceeds_expectations"
        assert PerformanceRating.MEETS_EXPECTATIONS.value == "meets_expectations"
        assert PerformanceRating.NEEDS_IMPROVEMENT.value == "needs_improvement"
        assert PerformanceRating.UNSATISFACTORY.value == "unsatisfactory"


class TestCompetencyLevel:
    """Tests for CompetencyLevel enum."""

    def test_all_levels_exist(self):
        """Test all competency levels are defined."""
        assert CompetencyLevel.NOVICE.value == "novice"
        assert CompetencyLevel.BEGINNER.value == "beginner"
        assert CompetencyLevel.INTERMEDIATE.value == "intermediate"
        assert CompetencyLevel.ADVANCED.value == "advanced"
        assert CompetencyLevel.EXPERT.value == "expert"


# ============== Data Model Tests ==============

class TestCompetency:
    """Tests for Competency class."""

    def test_create_competency(self):
        """Test creating a competency."""
        comp = Competency(
            name="Communication",
            description="Effective communication skills",
            category="Soft Skills",
            is_core=True
        )
        assert comp.name == "Communication"
        assert comp.is_core is True


class TestReviewQuestion:
    """Tests for ReviewQuestion class."""

    def test_create_question(self):
        """Test creating a review question."""
        question = ReviewQuestion(
            text="How would you rate overall performance?",
            question_type="rating",
            required=True,
            section="Overall Assessment"
        )
        assert question.text == "How would you rate overall performance?"
        assert question.question_type == "rating"


class TestReviewTemplate:
    """Tests for ReviewTemplate class."""

    def test_create_template(self):
        """Test creating a review template."""
        template = ReviewTemplate(
            name="Annual Review Template",
            review_type=ReviewType.ANNUAL,
            rating_scale=RatingScale.NUMERIC_5,
            organization_id="org-1"
        )
        assert template.name == "Annual Review Template"
        assert template.review_type == ReviewType.ANNUAL

    def test_template_with_questions(self):
        """Test template with questions."""
        questions = [
            ReviewQuestion(text="Q1", question_type="text"),
            ReviewQuestion(text="Q2", question_type="rating")
        ]
        template = ReviewTemplate(
            name="Template",
            questions=questions
        )
        assert len(template.questions) == 2


class TestReviewCycle:
    """Tests for ReviewCycle class."""

    def test_create_cycle(self):
        """Test creating a review cycle."""
        now = datetime.now()
        cycle = ReviewCycle(
            name="Q1 2024 Reviews",
            start_date=now,
            end_date=now + timedelta(days=30),
            review_type=ReviewType.QUARTERLY,
            organization_id="org-1"
        )
        assert cycle.name == "Q1 2024 Reviews"
        assert cycle.status == CycleStatus.PLANNING

    def test_completion_rate(self):
        """Test completion rate calculation."""
        cycle = ReviewCycle(
            name="Test",
            total_reviews=10,
            completed_reviews=5
        )
        assert cycle.completion_rate == 0.5

    def test_completion_rate_zero(self):
        """Test completion rate with no reviews."""
        cycle = ReviewCycle(name="Test")
        assert cycle.completion_rate == 0.0

    def test_is_active(self):
        """Test is_active check."""
        now = datetime.now()
        cycle = ReviewCycle(
            name="Test",
            status=CycleStatus.ACTIVE,
            start_date=now - timedelta(days=1),
            end_date=now + timedelta(days=30)
        )
        assert cycle.is_active() is True


class TestPerformanceReview:
    """Tests for PerformanceReview class."""

    def test_create_review(self):
        """Test creating a review."""
        review = PerformanceReview(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1",
            review_type=ReviewType.ANNUAL
        )
        assert review.reviewee_id == "user-1"
        assert review.status == ReviewStatus.DRAFT

    def test_submit_review(self):
        """Test submitting a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        review.submit()

        assert review.status == ReviewStatus.IN_PROGRESS
        assert review.submitted_at is not None

    def test_complete_review(self):
        """Test completing a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        review.complete()

        assert review.status == ReviewStatus.COMPLETED
        assert review.completed_at is not None

    def test_acknowledge_review(self):
        """Test acknowledging a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        review.acknowledge("Thanks for the feedback")

        assert review.status == ReviewStatus.ACKNOWLEDGED
        assert review.acknowledged_at is not None
        assert review.acknowledgment_comments == "Thanks for the feedback"

    def test_calibrate_review(self):
        """Test calibrating a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        review.calibrate(PerformanceRating.EXCEEDS_EXPECTATIONS, "calibrator-1", "Adjusted")

        assert review.calibrated_rating == PerformanceRating.EXCEEDS_EXPECTATIONS
        assert review.calibrated_by == "calibrator-1"


class TestFeedback:
    """Tests for Feedback class."""

    def test_create_feedback(self):
        """Test creating feedback."""
        feedback = Feedback(
            from_user_id="user-1",
            to_user_id="user-2",
            content="Great work on the project!",
            feedback_type=FeedbackType.PRAISE,
            organization_id="org-1"
        )
        assert feedback.from_user_id == "user-1"
        assert feedback.feedback_type == FeedbackType.PRAISE

    def test_anonymous_feedback(self):
        """Test anonymous feedback."""
        feedback = Feedback(
            from_user_id="",
            to_user_id="user-2",
            content="Consider improving communication",
            is_anonymous=True
        )
        assert feedback.is_anonymous is True
        assert feedback.from_user_id == ""


class TestRecognition:
    """Tests for Recognition class."""

    def test_create_recognition(self):
        """Test creating a recognition."""
        recognition = Recognition(
            from_user_id="user-1",
            to_user_ids=["user-2", "user-3"],
            title="Team Players",
            message="Thanks for the collaboration!",
            points=50
        )
        assert len(recognition.to_user_ids) == 2
        assert recognition.points == 50


class TestOneOnOne:
    """Tests for OneOnOne class."""

    def test_create_one_on_one(self):
        """Test creating a one-on-one."""
        meeting = OneOnOne(
            manager_id="manager-1",
            employee_id="user-1",
            scheduled_at=datetime.now() + timedelta(days=1),
            agenda_items=["Career goals", "Project updates"]
        )
        assert meeting.manager_id == "manager-1"
        assert len(meeting.agenda_items) == 2


# ============== FeedbackRegistry Tests ==============

class TestFeedbackRegistry:
    """Tests for FeedbackRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return FeedbackRegistry()

    # Review CRUD
    def test_create_review(self, registry):
        """Test creating a review in registry."""
        review = PerformanceReview(
            reviewee_id="user-1",
            reviewer_id="manager-1"
        )
        created = registry.create_review(review)
        assert created.id == review.id

    def test_get_review(self, registry):
        """Test getting a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        registry.create_review(review)

        retrieved = registry.get_review(review.id)
        assert retrieved is not None
        assert retrieved.reviewee_id == "user-1"

    def test_update_review(self, registry):
        """Test updating a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        registry.create_review(review)

        review.summary = "Great year!"
        updated = registry.update_review(review)
        assert updated.summary == "Great year!"

    def test_delete_review(self, registry):
        """Test deleting a review."""
        review = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        registry.create_review(review)

        assert registry.delete_review(review.id) is True
        assert registry.get_review(review.id) is None

    def test_list_reviews(self, registry):
        """Test listing reviews."""
        r1 = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1", organization_id="org-1")
        r2 = PerformanceReview(reviewee_id="user-2", reviewer_id="manager-1", organization_id="org-1")
        r3 = PerformanceReview(reviewee_id="user-3", reviewer_id="manager-2", organization_id="org-2")

        registry.create_review(r1)
        registry.create_review(r2)
        registry.create_review(r3)

        all_reviews = registry.list_reviews()
        assert len(all_reviews) == 3

        org1_reviews = registry.list_reviews(organization_id="org-1")
        assert len(org1_reviews) == 2

    def test_list_reviews_by_reviewee(self, registry):
        """Test listing reviews by reviewee."""
        r1 = PerformanceReview(reviewee_id="user-1", reviewer_id="manager-1")
        r2 = PerformanceReview(reviewee_id="user-1", reviewer_id="peer-1")
        r3 = PerformanceReview(reviewee_id="user-2", reviewer_id="manager-1")

        registry.create_review(r1)
        registry.create_review(r2)
        registry.create_review(r3)

        user1_reviews = registry.list_reviews(reviewee_id="user-1")
        assert len(user1_reviews) == 2

    def test_get_pending_reviews(self, registry):
        """Test getting pending reviews."""
        r1 = PerformanceReview(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            status=ReviewStatus.DRAFT
        )
        r2 = PerformanceReview(
            reviewee_id="user-2",
            reviewer_id="manager-1",
            status=ReviewStatus.COMPLETED
        )

        registry.create_review(r1)
        registry.create_review(r2)

        pending = registry.get_pending_reviews("manager-1")
        assert len(pending) == 1

    # Template CRUD
    def test_create_template(self, registry):
        """Test creating a template."""
        template = ReviewTemplate(name="Annual", organization_id="org-1")
        created = registry.create_template(template)
        assert created.id == template.id

    def test_get_template(self, registry):
        """Test getting a template."""
        template = ReviewTemplate(name="Annual")
        registry.create_template(template)

        retrieved = registry.get_template(template.id)
        assert retrieved is not None

    def test_list_templates(self, registry):
        """Test listing templates."""
        t1 = ReviewTemplate(name="Annual", organization_id="org-1", review_type=ReviewType.ANNUAL)
        t2 = ReviewTemplate(name="Quarterly", organization_id="org-1", review_type=ReviewType.QUARTERLY)

        registry.create_template(t1)
        registry.create_template(t2)

        all_templates = registry.list_templates(organization_id="org-1")
        assert len(all_templates) == 2

        annual = registry.list_templates(review_type=ReviewType.ANNUAL)
        assert len(annual) == 1

    def test_get_default_template(self, registry):
        """Test getting default template."""
        t1 = ReviewTemplate(name="Default", organization_id="org-1", is_default=True)
        t2 = ReviewTemplate(name="Other", organization_id="org-1", is_default=False)

        registry.create_template(t1)
        registry.create_template(t2)

        default = registry.get_default_template("org-1")
        assert default is not None
        assert default.name == "Default"

    # Cycle CRUD
    def test_create_cycle(self, registry):
        """Test creating a cycle."""
        cycle = ReviewCycle(name="Q1 2024", organization_id="org-1")
        created = registry.create_cycle(cycle)
        assert created.id == cycle.id

    def test_get_cycle(self, registry):
        """Test getting a cycle."""
        cycle = ReviewCycle(name="Q1 2024")
        registry.create_cycle(cycle)

        retrieved = registry.get_cycle(cycle.id)
        assert retrieved is not None

    def test_list_cycles(self, registry):
        """Test listing cycles."""
        c1 = ReviewCycle(name="Q1", organization_id="org-1", status=CycleStatus.ACTIVE)
        c2 = ReviewCycle(name="Q2", organization_id="org-1", status=CycleStatus.PLANNING)

        registry.create_cycle(c1)
        registry.create_cycle(c2)

        active = registry.list_cycles(status=CycleStatus.ACTIVE)
        assert len(active) == 1

    # Feedback CRUD
    def test_create_feedback(self, registry):
        """Test creating feedback."""
        feedback = Feedback(from_user_id="user-1", to_user_id="user-2", content="Good job!")
        created = registry.create_feedback(feedback)
        assert created.id == feedback.id

    def test_list_feedback(self, registry):
        """Test listing feedback."""
        f1 = Feedback(from_user_id="user-1", to_user_id="user-2", content="Good!", organization_id="org-1")
        f2 = Feedback(from_user_id="user-2", to_user_id="user-1", content="Thanks!", organization_id="org-1")

        registry.create_feedback(f1)
        registry.create_feedback(f2)

        user2_feedback = registry.list_feedback(to_user_id="user-2")
        assert len(user2_feedback) == 1

    def test_get_feedback_for_user(self, registry):
        """Test getting feedback for a user."""
        f1 = Feedback(from_user_id="user-1", to_user_id="user-2", content="Good!")
        f2 = Feedback(from_user_id="user-2", to_user_id="user-3", content="Nice!")

        registry.create_feedback(f1)
        registry.create_feedback(f2)

        received = registry.get_feedback_for_user("user-2", include_received=True)
        assert len(received) == 1

    # Recognition CRUD
    def test_create_recognition(self, registry):
        """Test creating recognition."""
        recognition = Recognition(
            from_user_id="user-1",
            to_user_ids=["user-2"],
            message="Thanks!"
        )
        created = registry.create_recognition(recognition)
        assert created.id == recognition.id

    def test_list_recognitions(self, registry):
        """Test listing recognitions."""
        r1 = Recognition(from_user_id="user-1", to_user_ids=["user-2"], message="Thanks!", organization_id="org-1")
        r2 = Recognition(from_user_id="user-3", to_user_ids=["user-2"], message="Great!", organization_id="org-1")

        registry.create_recognition(r1)
        registry.create_recognition(r2)

        user2_recs = registry.list_recognitions(to_user_id="user-2")
        assert len(user2_recs) == 2

    def test_get_user_recognition_count(self, registry):
        """Test getting recognition count."""
        r1 = Recognition(from_user_id="user-1", to_user_ids=["user-2"], message="Thanks!")
        r2 = Recognition(from_user_id="user-3", to_user_ids=["user-2"], message="Great!")

        registry.create_recognition(r1)
        registry.create_recognition(r2)

        count = registry.get_user_recognition_count("user-2")
        assert count == 2

    def test_get_user_points(self, registry):
        """Test getting user points."""
        r1 = Recognition(from_user_id="user-1", to_user_ids=["user-2"], message="Thanks!", points=50)
        r2 = Recognition(from_user_id="user-3", to_user_ids=["user-2"], message="Great!", points=25)

        registry.create_recognition(r1)
        registry.create_recognition(r2)

        points = registry.get_user_points("user-2")
        assert points == 75

    # Competency CRUD
    def test_create_competency(self, registry):
        """Test creating a competency."""
        comp = Competency(name="Communication", organization_id="org-1")
        created = registry.create_competency(comp)
        assert created.id == comp.id

    def test_list_competencies(self, registry):
        """Test listing competencies."""
        c1 = Competency(name="Communication", organization_id="org-1", is_core=True)
        c2 = Competency(name="Technical", organization_id="org-1", is_core=False)

        registry.create_competency(c1)
        registry.create_competency(c2)

        core = registry.list_competencies(is_core=True)
        assert len(core) == 1

    # Calibration CRUD
    def test_create_calibration_session(self, registry):
        """Test creating a calibration session."""
        session = CalibrationSession(
            name="Q1 Calibration",
            cycle_id="cycle-1",
            facilitator_id="user-1"
        )
        created = registry.create_calibration_session(session)
        assert created.id == session.id

    def test_list_calibration_sessions(self, registry):
        """Test listing calibration sessions."""
        s1 = CalibrationSession(name="S1", cycle_id="cycle-1", facilitator_id="user-1")
        s2 = CalibrationSession(name="S2", cycle_id="cycle-1", facilitator_id="user-2")

        registry.create_calibration_session(s1)
        registry.create_calibration_session(s2)

        sessions = registry.list_calibration_sessions(cycle_id="cycle-1")
        assert len(sessions) == 2

    # One-on-One CRUD
    def test_create_one_on_one(self, registry):
        """Test creating a one-on-one."""
        meeting = OneOnOne(
            manager_id="manager-1",
            employee_id="user-1",
            scheduled_at=datetime.now()
        )
        created = registry.create_one_on_one(meeting)
        assert created.id == meeting.id

    def test_list_one_on_ones(self, registry):
        """Test listing one-on-ones."""
        m1 = OneOnOne(manager_id="manager-1", employee_id="user-1", scheduled_at=datetime.now())
        m2 = OneOnOne(manager_id="manager-1", employee_id="user-2", scheduled_at=datetime.now())

        registry.create_one_on_one(m1)
        registry.create_one_on_one(m2)

        meetings = registry.list_one_on_ones(manager_id="manager-1")
        assert len(meetings) == 2


# ============== FeedbackManager Tests ==============

class TestFeedbackManager:
    """Tests for FeedbackManager class."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return FeedbackManager()

    # Review Cycle Management
    def test_create_review_cycle(self, manager):
        """Test creating a review cycle via manager."""
        now = datetime.now()
        cycle = manager.create_review_cycle(
            name="Annual Review 2024",
            organization_id="org-1",
            start_date=now,
            end_date=now + timedelta(days=30),
            review_type=ReviewType.ANNUAL
        )
        assert cycle.name == "Annual Review 2024"

    def test_launch_cycle(self, manager):
        """Test launching a cycle."""
        now = datetime.now()
        cycle = manager.create_review_cycle(
            name="Test",
            organization_id="org-1",
            start_date=now,
            end_date=now + timedelta(days=30)
        )
        launched = manager.launch_cycle(cycle.id)
        assert launched.status == CycleStatus.ACTIVE

    def test_close_cycle(self, manager):
        """Test closing a cycle."""
        now = datetime.now()
        cycle = manager.create_review_cycle(
            name="Test",
            organization_id="org-1",
            start_date=now,
            end_date=now + timedelta(days=30)
        )
        manager.launch_cycle(cycle.id)
        closed = manager.close_cycle(cycle.id)
        assert closed.status == CycleStatus.CLOSED

    def test_get_cycle_progress(self, manager):
        """Test getting cycle progress."""
        now = datetime.now()
        cycle = manager.create_review_cycle(
            name="Test",
            organization_id="org-1",
            start_date=now,
            end_date=now + timedelta(days=30)
        )

        # Create some reviews
        manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1",
            cycle_id=cycle.id
        )

        progress = manager.get_cycle_progress(cycle.id)
        assert progress["total_reviews"] == 1

    # Template Management
    def test_create_template(self, manager):
        """Test creating a template via manager."""
        template = manager.create_template(
            name="Annual Template",
            organization_id="org-1",
            review_type=ReviewType.ANNUAL
        )
        assert template.name == "Annual Template"

    def test_add_question_to_template(self, manager):
        """Test adding question to template."""
        template = manager.create_template("Test", "org-1")

        updated = manager.add_question_to_template(
            template.id,
            text="How would you rate performance?",
            question_type="rating"
        )
        assert len(updated.questions) == 1

    # Review Management
    def test_create_review(self, manager):
        """Test creating a review via manager."""
        review = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1",
            review_type=ReviewType.ANNUAL
        )
        assert review.reviewee_id == "user-1"

    def test_create_360_review(self, manager):
        """Test creating 360-degree review set."""
        reviews = manager.create_360_review(
            reviewee_id="user-1",
            organization_id="org-1",
            manager_id="manager-1",
            peer_ids=["peer-1", "peer-2"],
            direct_report_ids=["dr-1"]
        )

        assert len(reviews) == 5  # self + manager + 2 peers + 1 direct report

        relationships = [r.relationship for r in reviews]
        assert ReviewRelationship.SELF in relationships
        assert ReviewRelationship.MANAGER in relationships
        assert ReviewRelationship.PEER in relationships
        assert ReviewRelationship.DIRECT_REPORT in relationships

    def test_submit_review(self, manager):
        """Test submitting review via manager."""
        review = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        submitted = manager.submit_review(review.id)
        assert submitted.status == ReviewStatus.IN_PROGRESS

    def test_complete_review(self, manager):
        """Test completing review via manager."""
        review = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        completed = manager.complete_review(
            review.id,
            overall_rating=PerformanceRating.MEETS_EXPECTATIONS,
            summary="Good performance"
        )
        assert completed.status == ReviewStatus.COMPLETED
        assert completed.overall_rating == PerformanceRating.MEETS_EXPECTATIONS

    def test_acknowledge_review(self, manager):
        """Test acknowledging review via manager."""
        review = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        manager.complete_review(review.id)
        acknowledged = manager.acknowledge_review(review.id, "Understood")
        assert acknowledged.status == ReviewStatus.ACKNOWLEDGED

    def test_add_response(self, manager):
        """Test adding response to review."""
        review = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        updated = manager.add_response(
            review.id,
            question_id="q-1",
            question_text="Performance?",
            text_response="Excellent"
        )
        assert len(updated.responses) == 1

    def test_get_pending_reviews(self, manager):
        """Test getting pending reviews via manager."""
        r1 = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        r2 = manager.create_review(
            reviewee_id="user-2",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        manager.complete_review(r2.id)

        pending = manager.get_pending_reviews("manager-1")
        assert len(pending) == 1

    # Feedback Management
    def test_give_feedback(self, manager):
        """Test giving feedback via manager."""
        feedback = manager.give_feedback(
            from_user_id="user-1",
            to_user_id="user-2",
            content="Great work on the project!",
            organization_id="org-1",
            feedback_type=FeedbackType.PRAISE
        )
        assert feedback.content == "Great work on the project!"

    def test_give_anonymous_feedback(self, manager):
        """Test giving anonymous feedback."""
        feedback = manager.give_feedback(
            from_user_id="user-1",
            to_user_id="user-2",
            content="Consider improving...",
            organization_id="org-1",
            is_anonymous=True
        )
        assert feedback.is_anonymous is True
        assert feedback.from_user_id == ""

    def test_request_feedback(self, manager):
        """Test requesting feedback."""
        request = manager.request_feedback(
            requester_id="manager-1",
            about_user_id="user-1",
            requested_from_ids=["peer-1", "peer-2"],
            organization_id="org-1",
            context="Project review"
        )
        assert len(request.requested_from_ids) == 2

    def test_get_feedback_received(self, manager):
        """Test getting feedback received."""
        manager.give_feedback("user-1", "user-2", "Good!", "org-1")
        manager.give_feedback("user-3", "user-2", "Nice!", "org-1")

        received = manager.get_feedback_received("user-2")
        assert len(received) == 2

    # Recognition Management
    def test_give_recognition(self, manager):
        """Test giving recognition via manager."""
        recognition = manager.give_recognition(
            from_user_id="user-1",
            to_user_ids=["user-2", "user-3"],
            message="Great teamwork!",
            organization_id="org-1",
            title="Team Players",
            points=100
        )
        assert recognition.title == "Team Players"
        assert recognition.points == 100

    def test_get_recognition_feed(self, manager):
        """Test getting recognition feed."""
        manager.give_recognition("user-1", ["user-2"], "Thanks!", "org-1")
        manager.give_recognition("user-3", ["user-4"], "Great!", "org-1")

        feed = manager.get_recognition_feed("org-1")
        assert len(feed) == 2

    def test_get_user_recognition_stats(self, manager):
        """Test getting user recognition stats."""
        manager.give_recognition("user-1", ["user-2"], "Thanks!", "org-1", points=50)
        manager.give_recognition("user-3", ["user-2"], "Great!", "org-1", points=30)

        stats = manager.get_user_recognition_stats("user-2")
        assert stats["total_received"] == 2
        assert stats["total_points"] == 80

    # Calibration Management
    def test_create_calibration_session(self, manager):
        """Test creating calibration session via manager."""
        session = manager.create_calibration_session(
            name="Q1 Calibration",
            cycle_id="cycle-1",
            facilitator_id="hr-1",
            organization_id="org-1",
            review_ids=["r-1", "r-2"],
            participant_ids=["manager-1", "manager-2"]
        )
        assert session.name == "Q1 Calibration"
        assert len(session.review_ids) == 2

    def test_calibrate_review(self, manager):
        """Test calibrating review via manager."""
        review = manager.create_review(
            reviewee_id="user-1",
            reviewer_id="manager-1",
            organization_id="org-1"
        )
        calibrated = manager.calibrate_review(
            review.id,
            PerformanceRating.EXCEEDS_EXPECTATIONS,
            "calibrator-1",
            "Adjusted based on peer comparison"
        )
        assert calibrated.calibrated_rating == PerformanceRating.EXCEEDS_EXPECTATIONS

    # One-on-One Management
    def test_schedule_one_on_one(self, manager):
        """Test scheduling one-on-one via manager."""
        meeting = manager.schedule_one_on_one(
            manager_id="manager-1",
            employee_id="user-1",
            organization_id="org-1",
            scheduled_at=datetime.now() + timedelta(days=1),
            agenda_items=["Career goals", "Project updates"]
        )
        assert meeting.manager_id == "manager-1"
        assert len(meeting.agenda_items) == 2

    def test_add_one_on_one_notes(self, manager):
        """Test adding notes to one-on-one."""
        meeting = manager.schedule_one_on_one(
            manager_id="manager-1",
            employee_id="user-1",
            organization_id="org-1",
            scheduled_at=datetime.now()
        )
        updated = manager.add_one_on_one_notes(
            meeting.id,
            shared_notes="Discussed career path",
            action_items=["Update goals", "Schedule training"]
        )
        assert updated.shared_notes == "Discussed career path"
        assert len(updated.action_items) == 2

    def test_complete_one_on_one(self, manager):
        """Test completing one-on-one."""
        meeting = manager.schedule_one_on_one(
            manager_id="manager-1",
            employee_id="user-1",
            organization_id="org-1",
            scheduled_at=datetime.now()
        )
        completed = manager.complete_one_on_one(meeting.id)
        assert completed.is_completed is True

    def test_get_one_on_one_history(self, manager):
        """Test getting one-on-one history."""
        for i in range(3):
            manager.schedule_one_on_one(
                manager_id="manager-1",
                employee_id="user-1",
                organization_id="org-1",
                scheduled_at=datetime.now() + timedelta(days=i)
            )

        history = manager.get_one_on_one_history("manager-1", "user-1")
        assert len(history) == 3

    # Competency Management
    def test_create_competency(self, manager):
        """Test creating competency via manager."""
        comp = manager.create_competency(
            name="Communication",
            organization_id="org-1",
            description="Effective communication",
            is_core=True
        )
        assert comp.name == "Communication"
        assert comp.is_core is True

    def test_get_competency_framework(self, manager):
        """Test getting competency framework."""
        manager.create_competency("Communication", "org-1", is_core=True)
        manager.create_competency("Technical", "org-1", is_core=True)
        manager.create_competency("Domain", "org-1", is_core=False)

        framework = manager.get_competency_framework("org-1")
        assert len(framework) == 3

        core_only = manager.get_competency_framework("org-1", core_only=True)
        assert len(core_only) == 2

    # Analytics
    def test_get_review_analytics(self, manager):
        """Test getting review analytics."""
        r1 = manager.create_review("user-1", "manager-1", "org-1")
        r2 = manager.create_review("user-2", "manager-1", "org-1")

        manager.complete_review(r1.id, PerformanceRating.MEETS_EXPECTATIONS)

        analytics = manager.get_review_analytics("org-1")
        assert analytics["total"] == 2
        assert analytics["completed"] == 1

    def test_get_feedback_analytics(self, manager):
        """Test getting feedback analytics."""
        manager.give_feedback("user-1", "user-2", "Good!", "org-1", feedback_type=FeedbackType.PRAISE)
        manager.give_feedback("user-2", "user-1", "Thanks!", "org-1", feedback_type=FeedbackType.PRAISE)
        manager.give_feedback("user-3", "user-1", "Consider...", "org-1", feedback_type=FeedbackType.CONSTRUCTIVE)

        analytics = manager.get_feedback_analytics("org-1")
        assert analytics["total"] == 3
        assert analytics["type_distribution"]["praise"] == 2


# ============== Global Instance Tests ==============

class TestGlobalInstance:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_feedback_manager()

    def teardown_method(self):
        """Reset global instance after each test."""
        reset_feedback_manager()

    def test_get_feedback_manager(self):
        """Test getting global manager."""
        manager = get_feedback_manager()
        assert manager is not None
        assert isinstance(manager, FeedbackManager)

    def test_get_same_instance(self):
        """Test getting same instance."""
        manager1 = get_feedback_manager()
        manager2 = get_feedback_manager()
        assert manager1 is manager2

    def test_set_feedback_manager(self):
        """Test setting global manager."""
        custom_manager = FeedbackManager()
        set_feedback_manager(custom_manager)

        assert get_feedback_manager() is custom_manager

    def test_reset_feedback_manager(self):
        """Test resetting global manager."""
        manager1 = get_feedback_manager()
        reset_feedback_manager()
        manager2 = get_feedback_manager()

        assert manager1 is not manager2
