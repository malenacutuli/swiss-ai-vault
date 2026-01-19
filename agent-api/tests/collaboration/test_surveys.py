"""
Tests for the Surveys & Polls module.
"""

import pytest
from datetime import datetime, timedelta

from app.collaboration.surveys import (
    SurveyManager,
    SurveyRegistry,
    Survey,
    SurveyType,
    SurveyStatus,
    SurveyVisibility,
    SurveySettings,
    SurveySection,
    SurveyQuestion,
    QuestionType,
    QuestionOption,
    QuestionValidation,
    MatrixRow,
    MatrixColumn,
    SurveyResponse,
    ResponseStatus,
    QuestionAnswer,
    SurveyDistribution,
    DistributionMethod,
    DistributionStatus,
    SurveyTemplate,
    Poll,
    PollType,
    PollStatus,
    PollOption,
    PollVote,
    SurveyReminder,
    SurveyAnalytics,
    QuestionAnalytics,
    get_survey_manager,
    set_survey_manager,
    reset_survey_manager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestEnums:
    """Tests for enum definitions."""

    def test_survey_type_values(self):
        """Test SurveyType enum values."""
        assert SurveyType.GENERAL.value == "general"
        assert SurveyType.FEEDBACK.value == "feedback"
        assert SurveyType.PULSE.value == "pulse"
        assert SurveyType.ENGAGEMENT.value == "engagement"
        assert SurveyType.SATISFACTION.value == "satisfaction"
        assert SurveyType.EXIT.value == "exit"

    def test_survey_status_values(self):
        """Test SurveyStatus enum values."""
        assert SurveyStatus.DRAFT.value == "draft"
        assert SurveyStatus.SCHEDULED.value == "scheduled"
        assert SurveyStatus.ACTIVE.value == "active"
        assert SurveyStatus.PAUSED.value == "paused"
        assert SurveyStatus.CLOSED.value == "closed"
        assert SurveyStatus.ARCHIVED.value == "archived"

    def test_question_type_values(self):
        """Test QuestionType enum values."""
        assert QuestionType.SINGLE_CHOICE.value == "single_choice"
        assert QuestionType.MULTIPLE_CHOICE.value == "multiple_choice"
        assert QuestionType.TEXT.value == "text"
        assert QuestionType.RATING.value == "rating"
        assert QuestionType.NPS.value == "nps"
        assert QuestionType.MATRIX.value == "matrix"

    def test_response_status_values(self):
        """Test ResponseStatus enum values."""
        assert ResponseStatus.IN_PROGRESS.value == "in_progress"
        assert ResponseStatus.COMPLETED.value == "completed"
        assert ResponseStatus.ABANDONED.value == "abandoned"

    def test_distribution_method_values(self):
        """Test DistributionMethod enum values."""
        assert DistributionMethod.EMAIL.value == "email"
        assert DistributionMethod.LINK.value == "link"
        assert DistributionMethod.QR_CODE.value == "qr_code"
        assert DistributionMethod.IN_APP.value == "in_app"

    def test_poll_type_values(self):
        """Test PollType enum values."""
        assert PollType.SINGLE_VOTE.value == "single_vote"
        assert PollType.MULTIPLE_VOTE.value == "multiple_vote"
        assert PollType.RANKED_CHOICE.value == "ranked_choice"
        assert PollType.RATING.value == "rating"


# ============================================================
# Data Model Tests
# ============================================================

class TestDataModels:
    """Tests for data models."""

    def test_question_option_creation(self):
        """Test QuestionOption creation."""
        option = QuestionOption(
            text="Option A",
            value="a",
            order=0,
        )
        assert option.text == "Option A"
        assert option.value == "a"
        assert option.order == 0
        assert option.is_other is False
        assert option.id is not None

    def test_question_validation_creation(self):
        """Test QuestionValidation creation."""
        validation = QuestionValidation(
            required=True,
            min_length=10,
            max_length=500,
        )
        assert validation.required is True
        assert validation.min_length == 10
        assert validation.max_length == 500

    def test_survey_question_creation(self):
        """Test SurveyQuestion creation."""
        question = SurveyQuestion(
            survey_id="survey-1",
            question_type=QuestionType.SINGLE_CHOICE,
            text="What is your favorite color?",
            order=0,
        )
        assert question.survey_id == "survey-1"
        assert question.question_type == QuestionType.SINGLE_CHOICE
        assert question.text == "What is your favorite color?"
        assert question.id is not None

    def test_survey_section_creation(self):
        """Test SurveySection creation."""
        section = SurveySection(
            survey_id="survey-1",
            title="Demographics",
            description="Tell us about yourself",
            order=0,
        )
        assert section.survey_id == "survey-1"
        assert section.title == "Demographics"
        assert section.order == 0

    def test_survey_settings_defaults(self):
        """Test SurveySettings default values."""
        settings = SurveySettings()
        assert settings.allow_anonymous is True
        assert settings.show_progress_bar is True
        assert settings.allow_save_and_continue is True
        assert settings.one_response_per_user is True

    def test_survey_creation(self):
        """Test Survey creation."""
        survey = Survey(
            workspace_id="ws-1",
            title="Customer Satisfaction Survey",
            survey_type=SurveyType.SATISFACTION,
            created_by="user-1",
        )
        assert survey.workspace_id == "ws-1"
        assert survey.title == "Customer Satisfaction Survey"
        assert survey.survey_type == SurveyType.SATISFACTION
        assert survey.status == SurveyStatus.DRAFT
        assert survey.id is not None

    def test_survey_response_creation(self):
        """Test SurveyResponse creation."""
        response = SurveyResponse(
            survey_id="survey-1",
            respondent_id="user-1",
        )
        assert response.survey_id == "survey-1"
        assert response.respondent_id == "user-1"
        assert response.status == ResponseStatus.IN_PROGRESS
        assert response.answers == []

    def test_question_answer_creation(self):
        """Test QuestionAnswer creation."""
        answer = QuestionAnswer(
            question_id="q-1",
            answer_value="option_a",
        )
        assert answer.question_id == "q-1"
        assert answer.answer_value == "option_a"

    def test_survey_distribution_creation(self):
        """Test SurveyDistribution creation."""
        distribution = SurveyDistribution(
            survey_id="survey-1",
            method=DistributionMethod.EMAIL,
            recipient_email="test@example.com",
        )
        assert distribution.survey_id == "survey-1"
        assert distribution.method == DistributionMethod.EMAIL
        assert distribution.recipient_email == "test@example.com"
        assert distribution.status == DistributionStatus.PENDING

    def test_survey_template_creation(self):
        """Test SurveyTemplate creation."""
        template = SurveyTemplate(
            name="NPS Template",
            survey_type=SurveyType.FEEDBACK,
            category="Customer Feedback",
        )
        assert template.name == "NPS Template"
        assert template.survey_type == SurveyType.FEEDBACK
        assert template.use_count == 0

    def test_poll_creation(self):
        """Test Poll creation."""
        poll = Poll(
            workspace_id="ws-1",
            question="What day works best for the meeting?",
            created_by="user-1",
        )
        assert poll.workspace_id == "ws-1"
        assert poll.question == "What day works best for the meeting?"
        assert poll.poll_type == PollType.SINGLE_VOTE
        assert poll.status == PollStatus.DRAFT

    def test_poll_option_creation(self):
        """Test PollOption creation."""
        option = PollOption(
            poll_id="poll-1",
            text="Monday",
            order=0,
        )
        assert option.poll_id == "poll-1"
        assert option.text == "Monday"
        assert option.vote_count == 0

    def test_poll_vote_creation(self):
        """Test PollVote creation."""
        vote = PollVote(
            poll_id="poll-1",
            option_id="opt-1",
            voter_id="user-1",
        )
        assert vote.poll_id == "poll-1"
        assert vote.option_id == "opt-1"
        assert vote.voter_id == "user-1"

    def test_matrix_row_creation(self):
        """Test MatrixRow creation."""
        row = MatrixRow(
            text="Product Quality",
            order=0,
        )
        assert row.text == "Product Quality"
        assert row.order == 0

    def test_matrix_column_creation(self):
        """Test MatrixColumn creation."""
        column = MatrixColumn(
            text="Very Satisfied",
            value="5",
            order=0,
        )
        assert column.text == "Very Satisfied"
        assert column.value == "5"


# ============================================================
# Registry Tests
# ============================================================

class TestSurveyRegistry:
    """Tests for SurveyRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return SurveyRegistry()

    def test_create_survey(self, registry):
        """Test creating a survey."""
        survey = Survey(
            workspace_id="ws-1",
            title="Test Survey",
            created_by="user-1",
        )
        created = registry.create_survey(survey)
        assert created.id == survey.id
        assert registry.get_survey(survey.id) is not None

    def test_get_survey(self, registry):
        """Test getting a survey."""
        survey = Survey(workspace_id="ws-1", title="Test", created_by="user-1")
        registry.create_survey(survey)
        retrieved = registry.get_survey(survey.id)
        assert retrieved is not None
        assert retrieved.title == "Test"

    def test_update_survey(self, registry):
        """Test updating a survey."""
        survey = Survey(workspace_id="ws-1", title="Original", created_by="user-1")
        registry.create_survey(survey)
        survey.title = "Updated"
        updated = registry.update_survey(survey)
        assert updated.title == "Updated"

    def test_delete_survey(self, registry):
        """Test deleting a survey."""
        survey = Survey(workspace_id="ws-1", title="Test", created_by="user-1")
        registry.create_survey(survey)
        result = registry.delete_survey(survey.id)
        assert result is True
        assert registry.get_survey(survey.id) is None

    def test_list_surveys_by_workspace(self, registry):
        """Test listing surveys by workspace."""
        survey1 = Survey(workspace_id="ws-1", title="Survey 1", created_by="user-1")
        survey2 = Survey(workspace_id="ws-2", title="Survey 2", created_by="user-1")
        registry.create_survey(survey1)
        registry.create_survey(survey2)
        surveys = registry.list_surveys(workspace_id="ws-1")
        assert len(surveys) == 1
        assert surveys[0].title == "Survey 1"

    def test_list_surveys_by_status(self, registry):
        """Test listing surveys by status."""
        survey1 = Survey(workspace_id="ws-1", title="Draft", created_by="user-1", status=SurveyStatus.DRAFT)
        survey2 = Survey(workspace_id="ws-1", title="Active", created_by="user-1", status=SurveyStatus.ACTIVE)
        registry.create_survey(survey1)
        registry.create_survey(survey2)
        surveys = registry.list_surveys(status=SurveyStatus.ACTIVE)
        assert len(surveys) == 1
        assert surveys[0].title == "Active"

    def test_create_question(self, registry):
        """Test creating a question."""
        question = SurveyQuestion(
            survey_id="survey-1",
            question_type=QuestionType.TEXT,
            text="What is your name?",
        )
        created = registry.create_question(question)
        assert created.id == question.id
        assert registry.get_question(question.id) is not None

    def test_get_survey_questions(self, registry):
        """Test getting questions for a survey."""
        q1 = SurveyQuestion(survey_id="survey-1", question_type=QuestionType.TEXT, text="Q1", order=0)
        q2 = SurveyQuestion(survey_id="survey-1", question_type=QuestionType.TEXT, text="Q2", order=1)
        q3 = SurveyQuestion(survey_id="survey-2", question_type=QuestionType.TEXT, text="Q3", order=0)
        registry.create_question(q1)
        registry.create_question(q2)
        registry.create_question(q3)
        questions = registry.get_survey_questions("survey-1")
        assert len(questions) == 2
        assert questions[0].text == "Q1"
        assert questions[1].text == "Q2"

    def test_create_section(self, registry):
        """Test creating a section."""
        section = SurveySection(
            survey_id="survey-1",
            title="Demographics",
        )
        created = registry.create_section(section)
        assert created.id == section.id

    def test_create_response(self, registry):
        """Test creating a response."""
        response = SurveyResponse(
            survey_id="survey-1",
            respondent_id="user-1",
        )
        created = registry.create_response(response)
        assert created.id == response.id

    def test_get_survey_responses(self, registry):
        """Test getting responses for a survey."""
        r1 = SurveyResponse(survey_id="survey-1", respondent_id="user-1")
        r2 = SurveyResponse(survey_id="survey-1", respondent_id="user-2")
        registry.create_response(r1)
        registry.create_response(r2)
        responses = registry.get_survey_responses("survey-1")
        assert len(responses) == 2

    def test_create_distribution(self, registry):
        """Test creating a distribution."""
        distribution = SurveyDistribution(
            survey_id="survey-1",
            method=DistributionMethod.EMAIL,
            recipient_email="test@example.com",
        )
        created = registry.create_distribution(distribution)
        assert created.id == distribution.id

    def test_get_distribution_by_link(self, registry):
        """Test getting distribution by link."""
        distribution = SurveyDistribution(
            survey_id="survey-1",
            method=DistributionMethod.LINK,
            unique_link="abc123",
        )
        registry.create_distribution(distribution)
        retrieved = registry.get_distribution_by_link("abc123")
        assert retrieved is not None
        assert retrieved.id == distribution.id

    def test_create_template(self, registry):
        """Test creating a template."""
        template = SurveyTemplate(
            name="Test Template",
            survey_type=SurveyType.GENERAL,
        )
        created = registry.create_template(template)
        assert created.id == template.id

    def test_create_poll(self, registry):
        """Test creating a poll."""
        poll = Poll(
            workspace_id="ws-1",
            question="Best day?",
            created_by="user-1",
        )
        created = registry.create_poll(poll)
        assert created.id == poll.id

    def test_create_poll_option(self, registry):
        """Test creating a poll option."""
        option = PollOption(
            poll_id="poll-1",
            text="Monday",
        )
        created = registry.create_poll_option(option)
        assert created.id == option.id

    def test_create_poll_vote(self, registry):
        """Test creating a poll vote."""
        vote = PollVote(
            poll_id="poll-1",
            option_id="opt-1",
            voter_id="user-1",
        )
        created = registry.create_poll_vote(vote)
        assert created.id == vote.id

    def test_get_user_poll_votes(self, registry):
        """Test getting user's poll votes."""
        vote1 = PollVote(poll_id="poll-1", option_id="opt-1", voter_id="user-1")
        vote2 = PollVote(poll_id="poll-1", option_id="opt-2", voter_id="user-2")
        registry.create_poll_vote(vote1)
        registry.create_poll_vote(vote2)
        votes = registry.get_user_poll_votes("poll-1", "user-1")
        assert len(votes) == 1
        assert votes[0].voter_id == "user-1"

    def test_clear_registry(self, registry):
        """Test clearing the registry."""
        survey = Survey(workspace_id="ws-1", title="Test", created_by="user-1")
        registry.create_survey(survey)
        registry.clear()
        assert registry.get_survey(survey.id) is None


# ============================================================
# Manager Tests
# ============================================================

class TestSurveyManager:
    """Tests for SurveyManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return SurveyManager()

    def test_create_survey(self, manager):
        """Test creating a survey."""
        survey = manager.create_survey(
            workspace_id="ws-1",
            title="Customer Survey",
            created_by="user-1",
            survey_type=SurveyType.SATISFACTION,
        )
        assert survey.title == "Customer Survey"
        assert survey.survey_type == SurveyType.SATISFACTION
        assert survey.status == SurveyStatus.DRAFT

    def test_update_survey(self, manager):
        """Test updating a survey."""
        survey = manager.create_survey("ws-1", "Original", "user-1")
        updated = manager.update_survey(
            survey.id,
            title="Updated Title",
            tags=["important"],
        )
        assert updated.title == "Updated Title"
        assert "important" in updated.tags

    def test_publish_survey(self, manager):
        """Test publishing a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        published = manager.publish_survey(survey.id)
        assert published.status == SurveyStatus.ACTIVE
        assert published.published_at is not None

    def test_publish_survey_scheduled(self, manager):
        """Test scheduling a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        future = datetime.utcnow() + timedelta(days=1)
        scheduled = manager.publish_survey(survey.id, scheduled_start=future)
        assert scheduled.status == SurveyStatus.SCHEDULED
        assert scheduled.scheduled_start == future

    def test_pause_survey(self, manager):
        """Test pausing a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        paused = manager.pause_survey(survey.id)
        assert paused.status == SurveyStatus.PAUSED

    def test_close_survey(self, manager):
        """Test closing a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        closed = manager.close_survey(survey.id)
        assert closed.status == SurveyStatus.CLOSED
        assert closed.closed_at is not None

    def test_archive_survey(self, manager):
        """Test archiving a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        archived = manager.archive_survey(survey.id)
        assert archived.status == SurveyStatus.ARCHIVED

    def test_delete_survey(self, manager):
        """Test deleting a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        result = manager.delete_survey(survey.id)
        assert result is True
        assert manager.get_survey(survey.id) is None

    def test_add_question(self, manager):
        """Test adding a question to a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        question = manager.add_question(
            survey.id,
            QuestionType.SINGLE_CHOICE,
            "What is your rating?",
            options=[
                QuestionOption(text="Excellent", value="5"),
                QuestionOption(text="Good", value="4"),
            ],
        )
        assert question is not None
        assert question.text == "What is your rating?"
        assert len(question.options) == 2

    def test_update_question(self, manager):
        """Test updating a question."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        question = manager.add_question(survey.id, QuestionType.TEXT, "Original")
        updated = manager.update_question(question.id, text="Updated")
        assert updated.text == "Updated"

    def test_delete_question(self, manager):
        """Test deleting a question."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        question = manager.add_question(survey.id, QuestionType.TEXT, "Test")
        result = manager.delete_question(question.id)
        assert result is True

    def test_reorder_questions(self, manager):
        """Test reordering questions."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        q1 = manager.add_question(survey.id, QuestionType.TEXT, "Q1")
        q2 = manager.add_question(survey.id, QuestionType.TEXT, "Q2")
        manager.reorder_questions(survey.id, [q2.id, q1.id])
        questions = manager.get_survey_questions(survey.id)
        assert questions[0].text == "Q2"
        assert questions[1].text == "Q1"

    def test_add_section(self, manager):
        """Test adding a section."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        section = manager.add_section(survey.id, "Demographics", "About you")
        assert section is not None
        assert section.title == "Demographics"

    def test_start_response(self, manager):
        """Test starting a survey response."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        assert response is not None
        assert response.status == ResponseStatus.IN_PROGRESS

    def test_start_response_anonymous(self, manager):
        """Test starting an anonymous response."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2", is_anonymous=True)
        assert response is not None
        assert response.is_anonymous is True
        assert response.respondent_id is None

    def test_submit_answer(self, manager):
        """Test submitting an answer."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        question = manager.add_question(survey.id, QuestionType.TEXT, "Name?")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        updated = manager.submit_answer(response.id, question.id, "John Doe")
        assert len(updated.answers) == 1
        assert updated.answers[0].answer_value == "John Doe"

    def test_complete_response(self, manager):
        """Test completing a response."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        completed = manager.complete_response(response.id)
        assert completed.status == ResponseStatus.COMPLETED
        assert completed.completed_at is not None

    def test_abandon_response(self, manager):
        """Test abandoning a response."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        abandoned = manager.abandon_response(response.id)
        assert abandoned.status == ResponseStatus.ABANDONED

    def test_create_distribution(self, manager):
        """Test creating a distribution."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        distribution = manager.create_distribution(
            survey.id,
            DistributionMethod.EMAIL,
            recipient_email="test@example.com",
        )
        assert distribution is not None
        assert distribution.unique_link is not None

    def test_send_distribution(self, manager):
        """Test sending a distribution."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        distribution = manager.create_distribution(survey.id, DistributionMethod.EMAIL)
        sent = manager.send_distribution(distribution.id)
        assert sent.status == DistributionStatus.SENT
        assert sent.sent_at is not None

    def test_bulk_distribute(self, manager):
        """Test bulk distribution."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        recipients = [
            {"email": "user1@example.com", "name": "User 1"},
            {"email": "user2@example.com", "name": "User 2"},
        ]
        distributions = manager.bulk_distribute(survey.id, DistributionMethod.EMAIL, recipients)
        assert len(distributions) == 2

    def test_create_template(self, manager):
        """Test creating a template."""
        template = manager.create_template(
            name="NPS Template",
            survey_type=SurveyType.FEEDBACK,
            created_by="user-1",
            workspace_id="ws-1",
        )
        assert template.name == "NPS Template"
        assert template.survey_type == SurveyType.FEEDBACK

    def test_create_template_from_survey(self, manager):
        """Test creating a template from a survey."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.add_question(survey.id, QuestionType.RATING, "Rate us")
        template = manager.create_template_from_survey(
            survey.id,
            "My Template",
            "user-1",
        )
        assert template is not None
        assert template.name == "My Template"
        assert len(template.questions) == 1

    def test_create_poll(self, manager):
        """Test creating a poll."""
        poll = manager.create_poll(
            workspace_id="ws-1",
            question="Best day for meeting?",
            options=["Monday", "Tuesday", "Wednesday"],
            created_by="user-1",
        )
        assert poll.question == "Best day for meeting?"
        options = manager.registry.get_poll_options(poll.id)
        assert len(options) == 3

    def test_activate_poll(self, manager):
        """Test activating a poll."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        activated = manager.activate_poll(poll.id)
        assert activated.status == PollStatus.ACTIVE

    def test_close_poll(self, manager):
        """Test closing a poll."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        manager.activate_poll(poll.id)
        closed = manager.close_poll(poll.id)
        assert closed.status == PollStatus.CLOSED

    def test_vote(self, manager):
        """Test voting on a poll."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        manager.activate_poll(poll.id)
        options = manager.registry.get_poll_options(poll.id)
        vote = manager.vote(poll.id, options[0].id, "user-2")
        assert vote is not None
        assert vote.option_id == options[0].id

    def test_vote_updates_count(self, manager):
        """Test that voting updates counts."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        manager.activate_poll(poll.id)
        options = manager.registry.get_poll_options(poll.id)
        manager.vote(poll.id, options[0].id, "user-2")
        manager.vote(poll.id, options[0].id, "user-3")
        updated_poll = manager.get_poll(poll.id)
        assert updated_poll.total_votes == 2

    def test_vote_single_vote_restriction(self, manager):
        """Test single vote restriction."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        manager.activate_poll(poll.id)
        options = manager.registry.get_poll_options(poll.id)
        manager.vote(poll.id, options[0].id, "user-2")
        # Second vote should fail
        second_vote = manager.vote(poll.id, options[1].id, "user-2")
        assert second_vote is None

    def test_remove_vote(self, manager):
        """Test removing a vote."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        manager.activate_poll(poll.id)
        options = manager.registry.get_poll_options(poll.id)
        manager.vote(poll.id, options[0].id, "user-2")
        result = manager.remove_vote(poll.id, "user-2", options[0].id)
        assert result is True

    def test_get_poll_results(self, manager):
        """Test getting poll results."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        manager.activate_poll(poll.id)
        options = manager.registry.get_poll_options(poll.id)
        manager.vote(poll.id, options[0].id, "user-2")
        results = manager.get_poll_results(poll.id)
        assert results is not None
        assert results["total_votes"] == 1
        assert len(results["options"]) == 2

    def test_add_poll_option(self, manager):
        """Test adding an option to a poll."""
        poll = manager.create_poll("ws-1", "Question?", ["A", "B"], "user-1")
        poll.allow_add_options = True
        manager.registry.update_poll(poll)
        option = manager.add_poll_option(poll.id, "C", "user-2")
        assert option is not None
        assert option.text == "C"

    def test_get_survey_analytics(self, manager):
        """Test getting survey analytics."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        manager.complete_response(response.id)
        analytics = manager.get_survey_analytics(survey.id)
        assert analytics is not None
        assert analytics.total_responses == 1
        assert analytics.completed_responses == 1

    def test_get_question_analytics(self, manager):
        """Test getting question analytics."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        question = manager.add_question(
            survey.id,
            QuestionType.SINGLE_CHOICE,
            "Choose one",
            options=[QuestionOption(text="A", value="a"), QuestionOption(text="B", value="b")],
        )
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        manager.submit_answer(response.id, question.id, "a")
        manager.complete_response(response.id)
        analytics = manager.get_question_analytics(question.id)
        assert analytics is not None
        assert analytics.response_count == 1

    def test_export_responses(self, manager):
        """Test exporting responses."""
        survey = manager.create_survey("ws-1", "Test Survey", "user-1")
        question = manager.add_question(survey.id, QuestionType.TEXT, "Name?")
        manager.publish_survey(survey.id)
        response = manager.start_response(survey.id, respondent_id="user-2")
        manager.submit_answer(response.id, question.id, "John")
        manager.complete_response(response.id)
        exported = manager.export_responses(survey.id)
        assert len(exported) == 1
        assert exported[0]["status"] == "completed"


# ============================================================
# Global Instance Tests
# ============================================================

class TestGlobalInstances:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_survey_manager()

    def test_get_survey_manager(self):
        """Test getting the global survey manager."""
        manager = get_survey_manager()
        assert manager is not None
        assert isinstance(manager, SurveyManager)

    def test_set_survey_manager(self):
        """Test setting the global survey manager."""
        custom_manager = SurveyManager()
        set_survey_manager(custom_manager)
        assert get_survey_manager() is custom_manager

    def test_reset_survey_manager(self):
        """Test resetting the global survey manager."""
        manager1 = get_survey_manager()
        reset_survey_manager()
        manager2 = get_survey_manager()
        assert manager1 is not manager2
