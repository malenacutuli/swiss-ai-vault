"""
Tests for the Learning & Development module.
"""

import pytest
from datetime import datetime, timedelta

from app.collaboration.learning import (
    LearningManager,
    LearningRegistry,
    Course,
    CourseType,
    CourseStatus,
    CourseLevel,
    Module,
    Lesson,
    LearningContent,
    ContentType,
    LearningPath,
    Enrollment,
    EnrollmentStatus,
    AssignmentType,
    Assessment,
    AssessmentType,
    AssessmentQuestion,
    QuestionType,
    AssessmentAttempt,
    Certificate,
    CertificationType,
    SkillProgress,
    CourseReview,
    get_learning_manager,
    set_learning_manager,
    reset_learning_manager,
)


# ============== Enum Tests ==============

class TestCourseType:
    """Tests for CourseType enum."""

    def test_all_types_exist(self):
        """Test all course types are defined."""
        assert CourseType.SELF_PACED.value == "self_paced"
        assert CourseType.INSTRUCTOR_LED.value == "instructor_led"
        assert CourseType.BLENDED.value == "blended"
        assert CourseType.WEBINAR.value == "webinar"
        assert CourseType.VIDEO.value == "video"


class TestCourseStatus:
    """Tests for CourseStatus enum."""

    def test_all_statuses_exist(self):
        """Test all course statuses are defined."""
        assert CourseStatus.DRAFT.value == "draft"
        assert CourseStatus.PUBLISHED.value == "published"
        assert CourseStatus.ARCHIVED.value == "archived"


class TestEnrollmentStatus:
    """Tests for EnrollmentStatus enum."""

    def test_all_statuses_exist(self):
        """Test all enrollment statuses are defined."""
        assert EnrollmentStatus.ENROLLED.value == "enrolled"
        assert EnrollmentStatus.IN_PROGRESS.value == "in_progress"
        assert EnrollmentStatus.COMPLETED.value == "completed"
        assert EnrollmentStatus.FAILED.value == "failed"
        assert EnrollmentStatus.DROPPED.value == "dropped"


class TestQuestionType:
    """Tests for QuestionType enum."""

    def test_all_types_exist(self):
        """Test all question types are defined."""
        assert QuestionType.MULTIPLE_CHOICE.value == "multiple_choice"
        assert QuestionType.MULTIPLE_SELECT.value == "multiple_select"
        assert QuestionType.TRUE_FALSE.value == "true_false"
        assert QuestionType.SHORT_ANSWER.value == "short_answer"


# ============== Data Model Tests ==============

class TestLearningContent:
    """Tests for LearningContent class."""

    def test_create_content(self):
        """Test creating learning content."""
        content = LearningContent(
            title="Introduction Video",
            content_type=ContentType.VIDEO,
            url="https://example.com/video.mp4",
            duration_minutes=15
        )
        assert content.title == "Introduction Video"
        assert content.duration_minutes == 15


class TestLesson:
    """Tests for Lesson class."""

    def test_create_lesson(self):
        """Test creating a lesson."""
        lesson = Lesson(
            title="Getting Started",
            description="Introduction to the course"
        )
        assert lesson.title == "Getting Started"

    def test_total_duration(self):
        """Test calculating total duration."""
        content = [
            LearningContent(title="C1", duration_minutes=10),
            LearningContent(title="C2", duration_minutes=20)
        ]
        lesson = Lesson(title="Lesson", content=content)
        assert lesson.total_duration == 30


class TestModule:
    """Tests for Module class."""

    def test_create_module(self):
        """Test creating a module."""
        module = Module(
            title="Module 1",
            description="First module"
        )
        assert module.title == "Module 1"

    def test_total_lessons(self):
        """Test counting total lessons."""
        lessons = [
            Lesson(title="L1"),
            Lesson(title="L2")
        ]
        module = Module(title="Module", lessons=lessons)
        assert module.total_lessons == 2


class TestCourse:
    """Tests for Course class."""

    def test_create_course(self):
        """Test creating a course."""
        course = Course(
            title="Python Basics",
            description="Learn Python",
            course_type=CourseType.SELF_PACED,
            level=CourseLevel.BEGINNER,
            organization_id="org-1"
        )
        assert course.title == "Python Basics"
        assert course.status == CourseStatus.DRAFT

    def test_total_modules(self):
        """Test counting total modules."""
        modules = [
            Module(title="M1"),
            Module(title="M2")
        ]
        course = Course(title="Course", modules=modules)
        assert course.total_modules == 2

    def test_total_lessons(self):
        """Test counting total lessons across modules."""
        modules = [
            Module(title="M1", lessons=[Lesson(title="L1"), Lesson(title="L2")]),
            Module(title="M2", lessons=[Lesson(title="L3")])
        ]
        course = Course(title="Course", modules=modules)
        assert course.total_lessons == 3

    def test_completion_rate(self):
        """Test completion rate calculation."""
        course = Course(
            title="Course",
            enrollment_count=10,
            completion_count=5
        )
        assert course.completion_rate == 0.5

    def test_publish(self):
        """Test publishing a course."""
        course = Course(title="Course")
        course.publish()

        assert course.status == CourseStatus.PUBLISHED
        assert course.published_at is not None

    def test_archive(self):
        """Test archiving a course."""
        course = Course(title="Course")
        course.archive()

        assert course.status == CourseStatus.ARCHIVED


class TestLearningPath:
    """Tests for LearningPath class."""

    def test_create_learning_path(self):
        """Test creating a learning path."""
        path = LearningPath(
            title="Data Science Track",
            course_ids=["course-1", "course-2"],
            organization_id="org-1"
        )
        assert path.title == "Data Science Track"
        assert len(path.course_ids) == 2


class TestEnrollment:
    """Tests for Enrollment class."""

    def test_create_enrollment(self):
        """Test creating an enrollment."""
        enrollment = Enrollment(
            user_id="user-1",
            course_id="course-1",
            organization_id="org-1"
        )
        assert enrollment.user_id == "user-1"
        assert enrollment.status == EnrollmentStatus.ENROLLED

    def test_start(self):
        """Test starting an enrollment."""
        enrollment = Enrollment(user_id="user-1", course_id="course-1")
        enrollment.start()

        assert enrollment.status == EnrollmentStatus.IN_PROGRESS
        assert enrollment.started_at is not None

    def test_complete(self):
        """Test completing an enrollment."""
        enrollment = Enrollment(user_id="user-1", course_id="course-1")
        enrollment.complete(score=85.0)

        assert enrollment.status == EnrollmentStatus.COMPLETED
        assert enrollment.final_score == 85.0
        assert enrollment.progress_percentage == 100.0

    def test_drop(self):
        """Test dropping an enrollment."""
        enrollment = Enrollment(user_id="user-1", course_id="course-1")
        enrollment.drop()

        assert enrollment.status == EnrollmentStatus.DROPPED

    def test_is_overdue(self):
        """Test checking if enrollment is overdue."""
        enrollment = Enrollment(
            user_id="user-1",
            course_id="course-1",
            due_date=datetime.now() - timedelta(days=1)
        )
        assert enrollment.is_overdue() is True

        enrollment.due_date = datetime.now() + timedelta(days=1)
        assert enrollment.is_overdue() is False


class TestAssessment:
    """Tests for Assessment class."""

    def test_create_assessment(self):
        """Test creating an assessment."""
        assessment = Assessment(
            title="Module 1 Quiz",
            assessment_type=AssessmentType.QUIZ,
            passing_score=70.0
        )
        assert assessment.title == "Module 1 Quiz"

    def test_total_points(self):
        """Test calculating total points."""
        questions = [
            AssessmentQuestion(question_text="Q1", points=1.0),
            AssessmentQuestion(question_text="Q2", points=2.0)
        ]
        assessment = Assessment(title="Quiz", questions=questions)
        assert assessment.total_points == 3.0


class TestCertificate:
    """Tests for Certificate class."""

    def test_create_certificate(self):
        """Test creating a certificate."""
        certificate = Certificate(
            user_id="user-1",
            course_id="course-1",
            title="Completion Certificate",
            organization_id="org-1"
        )
        assert certificate.user_id == "user-1"
        assert certificate.is_valid is True

    def test_revoke(self):
        """Test revoking a certificate."""
        certificate = Certificate(user_id="user-1", course_id="course-1")
        certificate.revoke()

        assert certificate.is_valid is False

    def test_is_expired(self):
        """Test checking if certificate is expired."""
        certificate = Certificate(
            user_id="user-1",
            course_id="course-1",
            expires_at=datetime.now() - timedelta(days=1)
        )
        assert certificate.is_expired() is True

        certificate.expires_at = datetime.now() + timedelta(days=1)
        assert certificate.is_expired() is False


# ============== LearningRegistry Tests ==============

class TestLearningRegistry:
    """Tests for LearningRegistry class."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return LearningRegistry()

    # Course CRUD
    def test_create_course(self, registry):
        """Test creating a course in registry."""
        course = Course(title="Test Course", organization_id="org-1")
        created = registry.create_course(course)
        assert created.id == course.id

    def test_get_course(self, registry):
        """Test getting a course."""
        course = Course(title="Test Course")
        registry.create_course(course)

        retrieved = registry.get_course(course.id)
        assert retrieved is not None
        assert retrieved.title == "Test Course"

    def test_update_course(self, registry):
        """Test updating a course."""
        course = Course(title="Test Course")
        registry.create_course(course)

        course.title = "Updated Course"
        updated = registry.update_course(course)
        assert updated.title == "Updated Course"

    def test_delete_course(self, registry):
        """Test deleting a course."""
        course = Course(title="Test Course")
        registry.create_course(course)

        assert registry.delete_course(course.id) is True
        assert registry.get_course(course.id) is None

    def test_list_courses(self, registry):
        """Test listing courses."""
        c1 = Course(title="C1", organization_id="org-1", level=CourseLevel.BEGINNER)
        c2 = Course(title="C2", organization_id="org-1", level=CourseLevel.ADVANCED)
        c3 = Course(title="C3", organization_id="org-2", level=CourseLevel.BEGINNER)

        registry.create_course(c1)
        registry.create_course(c2)
        registry.create_course(c3)

        all_courses = registry.list_courses()
        assert len(all_courses) == 3

        org1_courses = registry.list_courses(organization_id="org-1")
        assert len(org1_courses) == 2

        beginner = registry.list_courses(level=CourseLevel.BEGINNER)
        assert len(beginner) == 2

    def test_search_courses(self, registry):
        """Test searching courses."""
        c1 = Course(title="Python Basics", organization_id="org-1", status=CourseStatus.PUBLISHED)
        c2 = Course(title="Java Basics", organization_id="org-1", status=CourseStatus.PUBLISHED)

        registry.create_course(c1)
        registry.create_course(c2)

        results = registry.search_courses("python")
        assert len(results) == 1

    # Learning Path CRUD
    def test_create_learning_path(self, registry):
        """Test creating a learning path."""
        path = LearningPath(title="Data Track", organization_id="org-1")
        created = registry.create_learning_path(path)
        assert created.id == path.id

    def test_get_learning_path(self, registry):
        """Test getting a learning path."""
        path = LearningPath(title="Data Track")
        registry.create_learning_path(path)

        retrieved = registry.get_learning_path(path.id)
        assert retrieved is not None

    def test_list_learning_paths(self, registry):
        """Test listing learning paths."""
        p1 = LearningPath(title="P1", organization_id="org-1")
        p2 = LearningPath(title="P2", organization_id="org-1")

        registry.create_learning_path(p1)
        registry.create_learning_path(p2)

        paths = registry.list_learning_paths(organization_id="org-1")
        assert len(paths) == 2

    # Enrollment CRUD
    def test_create_enrollment(self, registry):
        """Test creating an enrollment."""
        course = Course(title="Course")
        registry.create_course(course)

        enrollment = Enrollment(user_id="user-1", course_id=course.id)
        created = registry.create_enrollment(enrollment)
        assert created.id == enrollment.id

        # Check course enrollment count
        updated_course = registry.get_course(course.id)
        assert updated_course.enrollment_count == 1

    def test_get_enrollment_by_user(self, registry):
        """Test getting enrollment by user."""
        enrollment = Enrollment(user_id="user-1", course_id="course-1")
        registry.create_enrollment(enrollment)

        found = registry.get_enrollment_by_user("user-1", course_id="course-1")
        assert found is not None
        assert found.user_id == "user-1"

    def test_list_enrollments(self, registry):
        """Test listing enrollments."""
        e1 = Enrollment(user_id="user-1", course_id="course-1", organization_id="org-1")
        e2 = Enrollment(user_id="user-1", course_id="course-2", organization_id="org-1")
        e3 = Enrollment(user_id="user-2", course_id="course-1", organization_id="org-1")

        registry.create_enrollment(e1)
        registry.create_enrollment(e2)
        registry.create_enrollment(e3)

        user1_enrollments = registry.list_enrollments(user_id="user-1")
        assert len(user1_enrollments) == 2

        course1_enrollments = registry.list_enrollments(course_id="course-1")
        assert len(course1_enrollments) == 2

    def test_get_user_enrollments(self, registry):
        """Test getting user enrollments."""
        e1 = Enrollment(user_id="user-1", course_id="course-1", status=EnrollmentStatus.IN_PROGRESS)
        e2 = Enrollment(user_id="user-1", course_id="course-2", status=EnrollmentStatus.COMPLETED)

        registry.create_enrollment(e1)
        registry.create_enrollment(e2)

        all_enrollments = registry.get_user_enrollments("user-1")
        assert len(all_enrollments) == 2

        active_only = registry.get_user_enrollments("user-1", active_only=True)
        assert len(active_only) == 1

    def test_get_overdue_enrollments(self, registry):
        """Test getting overdue enrollments."""
        e1 = Enrollment(
            user_id="user-1",
            course_id="course-1",
            due_date=datetime.now() - timedelta(days=1)
        )
        e2 = Enrollment(
            user_id="user-1",
            course_id="course-2",
            due_date=datetime.now() + timedelta(days=1)
        )

        registry.create_enrollment(e1)
        registry.create_enrollment(e2)

        overdue = registry.get_overdue_enrollments()
        assert len(overdue) == 1

    # Assessment CRUD
    def test_create_assessment(self, registry):
        """Test creating an assessment."""
        assessment = Assessment(title="Quiz 1", organization_id="org-1")
        created = registry.create_assessment(assessment)
        assert created.id == assessment.id

    def test_list_assessments(self, registry):
        """Test listing assessments."""
        a1 = Assessment(title="A1", course_id="course-1")
        a2 = Assessment(title="A2", course_id="course-1")
        a3 = Assessment(title="A3", course_id="course-2")

        registry.create_assessment(a1)
        registry.create_assessment(a2)
        registry.create_assessment(a3)

        course1_assessments = registry.list_assessments(course_id="course-1")
        assert len(course1_assessments) == 2

    # Attempt CRUD
    def test_create_attempt(self, registry):
        """Test creating an assessment attempt."""
        attempt = AssessmentAttempt(
            assessment_id="assessment-1",
            user_id="user-1"
        )
        created = registry.create_attempt(attempt)
        assert created.id == attempt.id

    def test_get_user_attempts(self, registry):
        """Test getting user attempts."""
        a1 = AssessmentAttempt(assessment_id="assessment-1", user_id="user-1", attempt_number=1)
        a2 = AssessmentAttempt(assessment_id="assessment-1", user_id="user-1", attempt_number=2)

        registry.create_attempt(a1)
        registry.create_attempt(a2)

        attempts = registry.get_user_attempts("user-1", "assessment-1")
        assert len(attempts) == 2

    # Certificate CRUD
    def test_create_certificate(self, registry):
        """Test creating a certificate."""
        certificate = Certificate(user_id="user-1", course_id="course-1")
        created = registry.create_certificate(certificate)
        assert created.id == certificate.id

    def test_get_certificate_by_number(self, registry):
        """Test getting certificate by number."""
        certificate = Certificate(user_id="user-1", course_id="course-1")
        registry.create_certificate(certificate)

        found = registry.get_certificate_by_number(certificate.certificate_number)
        assert found is not None
        assert found.id == certificate.id

    def test_list_certificates(self, registry):
        """Test listing certificates."""
        c1 = Certificate(user_id="user-1", course_id="course-1")
        c2 = Certificate(user_id="user-1", course_id="course-2")

        registry.create_certificate(c1)
        registry.create_certificate(c2)

        user_certs = registry.list_certificates(user_id="user-1")
        assert len(user_certs) == 2

    # Review CRUD
    def test_create_review(self, registry):
        """Test creating a review."""
        course = Course(title="Course")
        registry.create_course(course)

        review = CourseReview(course_id=course.id, user_id="user-1", rating=5)
        created = registry.create_review(review)
        assert created.id == review.id

        # Check course rating updated
        updated_course = registry.get_course(course.id)
        assert updated_course.average_rating == 5.0
        assert updated_course.rating_count == 1


# ============== LearningManager Tests ==============

class TestLearningManager:
    """Tests for LearningManager class."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return LearningManager()

    # Course Management
    def test_create_course(self, manager):
        """Test creating a course via manager."""
        course = manager.create_course(
            title="Python Basics",
            organization_id="org-1",
            created_by="user-1",
            level=CourseLevel.BEGINNER
        )
        assert course.title == "Python Basics"

    def test_add_module(self, manager):
        """Test adding a module to a course."""
        course = manager.create_course("Course", "org-1", "user-1")
        updated = manager.add_module(course.id, "Module 1", "First module")

        assert len(updated.modules) == 1
        assert updated.modules[0].title == "Module 1"

    def test_add_lesson(self, manager):
        """Test adding a lesson to a module."""
        course = manager.create_course("Course", "org-1", "user-1")
        manager.add_module(course.id, "Module 1")

        module_id = manager.registry.get_course(course.id).modules[0].id
        updated = manager.add_lesson(course.id, module_id, "Lesson 1")

        assert len(updated.modules[0].lessons) == 1

    def test_publish_course(self, manager):
        """Test publishing a course via manager."""
        course = manager.create_course("Course", "org-1", "user-1")
        published = manager.publish_course(course.id)

        assert published.status == CourseStatus.PUBLISHED

    def test_archive_course(self, manager):
        """Test archiving a course via manager."""
        course = manager.create_course("Course", "org-1", "user-1")
        archived = manager.archive_course(course.id)

        assert archived.status == CourseStatus.ARCHIVED

    def test_get_course_catalog(self, manager):
        """Test getting course catalog."""
        c1 = manager.create_course("C1", "org-1", "user-1")
        c2 = manager.create_course("C2", "org-1", "user-1")

        manager.publish_course(c1.id)
        manager.publish_course(c2.id)

        catalog = manager.get_course_catalog("org-1")
        assert len(catalog) == 2

    # Learning Path Management
    def test_create_learning_path(self, manager):
        """Test creating a learning path via manager."""
        path = manager.create_learning_path(
            title="Data Science",
            organization_id="org-1",
            created_by="user-1",
            course_ids=["course-1", "course-2"]
        )
        assert path.title == "Data Science"
        assert len(path.course_ids) == 2

    def test_add_course_to_path(self, manager):
        """Test adding course to a learning path."""
        path = manager.create_learning_path("Path", "org-1", "user-1", [])
        updated = manager.add_course_to_path(path.id, "course-1")

        assert "course-1" in updated.course_ids

    # Enrollment Management
    def test_enroll_user(self, manager):
        """Test enrolling a user via manager."""
        course = manager.create_course("Course", "org-1", "user-1")
        enrollment = manager.enroll_user(
            user_id="student-1",
            organization_id="org-1",
            course_id=course.id
        )
        assert enrollment.user_id == "student-1"

    def test_enroll_user_already_enrolled(self, manager):
        """Test enrolling already enrolled user returns existing."""
        course = manager.create_course("Course", "org-1", "user-1")
        e1 = manager.enroll_user("student-1", "org-1", course_id=course.id)
        e2 = manager.enroll_user("student-1", "org-1", course_id=course.id)

        assert e1.id == e2.id

    def test_bulk_enroll(self, manager):
        """Test bulk enrolling users."""
        course = manager.create_course("Course", "org-1", "user-1")
        enrollments = manager.bulk_enroll(
            user_ids=["user-1", "user-2", "user-3"],
            organization_id="org-1",
            course_id=course.id,
            assigned_by="admin"
        )
        assert len(enrollments) == 3

    def test_start_course(self, manager):
        """Test starting a course."""
        course = manager.create_course("Course", "org-1", "user-1")
        enrollment = manager.enroll_user("student-1", "org-1", course_id=course.id)

        started = manager.start_course(enrollment.id)
        assert started.status == EnrollmentStatus.IN_PROGRESS

    def test_complete_lesson(self, manager):
        """Test completing a lesson."""
        course = manager.create_course("Course", "org-1", "user-1")
        manager.add_module(course.id, "Module 1")
        updated_course = manager.registry.get_course(course.id)
        module_id = updated_course.modules[0].id
        manager.add_lesson(course.id, module_id, "Lesson 1")
        updated_course = manager.registry.get_course(course.id)
        lesson_id = updated_course.modules[0].lessons[0].id

        enrollment = manager.enroll_user("student-1", "org-1", course_id=course.id)
        manager.start_course(enrollment.id)

        updated = manager.complete_lesson(enrollment.id, lesson_id, time_spent_minutes=30)
        assert lesson_id in updated.completed_lessons
        assert updated.time_spent_minutes == 30

    def test_complete_course(self, manager):
        """Test completing a course."""
        course = manager.create_course("Course", "org-1", "user-1")
        enrollment = manager.enroll_user("student-1", "org-1", course_id=course.id)

        completed = manager.complete_course(enrollment.id, score=90.0)
        assert completed.status == EnrollmentStatus.COMPLETED
        assert completed.final_score == 90.0

    def test_drop_enrollment(self, manager):
        """Test dropping an enrollment."""
        course = manager.create_course("Course", "org-1", "user-1")
        enrollment = manager.enroll_user("student-1", "org-1", course_id=course.id)

        dropped = manager.drop_enrollment(enrollment.id)
        assert dropped.status == EnrollmentStatus.DROPPED

    def test_get_my_learning(self, manager):
        """Test getting user's learning."""
        c1 = manager.create_course("C1", "org-1", "user-1")
        c2 = manager.create_course("C2", "org-1", "user-1")

        manager.enroll_user("student-1", "org-1", course_id=c1.id)
        manager.enroll_user("student-1", "org-1", course_id=c2.id)

        learning = manager.get_my_learning("student-1")
        assert len(learning) == 2

    def test_get_assigned_training(self, manager):
        """Test getting assigned training."""
        course = manager.create_course("Course", "org-1", "user-1")
        manager.enroll_user(
            "student-1", "org-1",
            course_id=course.id,
            assigned_by="admin",
            assignment_type=AssignmentType.REQUIRED
        )

        assigned = manager.get_assigned_training("student-1")
        assert len(assigned) == 1

    # Assessment Management
    def test_create_assessment(self, manager):
        """Test creating an assessment via manager."""
        assessment = manager.create_assessment(
            title="Module Quiz",
            organization_id="org-1",
            passing_score=70.0
        )
        assert assessment.title == "Module Quiz"

    def test_add_question(self, manager):
        """Test adding question to assessment."""
        assessment = manager.create_assessment("Quiz", "org-1")
        updated = manager.add_question(
            assessment.id,
            question_text="What is 2+2?",
            question_type=QuestionType.MULTIPLE_CHOICE,
            options=["3", "4", "5"],
            correct_answer="4"
        )
        assert len(updated.questions) == 1

    def test_start_assessment(self, manager):
        """Test starting an assessment."""
        assessment = manager.create_assessment("Quiz", "org-1")
        attempt = manager.start_assessment(assessment.id, "user-1")

        assert attempt is not None
        assert attempt.attempt_number == 1

    def test_start_assessment_max_attempts(self, manager):
        """Test max attempts reached."""
        assessment = manager.create_assessment("Quiz", "org-1", max_attempts=1)
        manager.start_assessment(assessment.id, "user-1")

        # Second attempt should fail
        attempt2 = manager.start_assessment(assessment.id, "user-1")
        assert attempt2 is None

    def test_submit_assessment(self, manager):
        """Test submitting an assessment."""
        assessment = manager.create_assessment("Quiz", "org-1", passing_score=50.0)
        manager.add_question(
            assessment.id,
            question_text="What is 2+2?",
            question_type=QuestionType.MULTIPLE_CHOICE,
            options=["3", "4", "5"],
            correct_answer="4",
            points=10.0
        )

        # Get the question ID
        updated_assessment = manager.registry.get_assessment(assessment.id)
        question_id = updated_assessment.questions[0].id

        attempt = manager.start_assessment(assessment.id, "user-1")
        submitted = manager.submit_assessment(attempt.id, {question_id: "4"})

        assert submitted.passed is True
        assert submitted.percentage == 100.0

    def test_get_assessment_results(self, manager):
        """Test getting assessment results."""
        assessment = manager.create_assessment("Quiz", "org-1")
        attempt = manager.start_assessment(assessment.id, "user-1")
        manager.submit_assessment(attempt.id, {})

        results = manager.get_assessment_results("user-1", assessment.id)
        assert len(results) == 1

    # Certificate Management
    def test_issue_certificate(self, manager):
        """Test issuing a certificate via manager."""
        course = manager.create_course("Python", "org-1", "user-1")
        certificate = manager.issue_certificate(
            user_id="student-1",
            organization_id="org-1",
            course_id=course.id
        )
        assert certificate is not None
        assert "Python" in certificate.title

    def test_verify_certificate(self, manager):
        """Test verifying a certificate."""
        certificate = manager.issue_certificate(
            user_id="student-1",
            organization_id="org-1"
        )

        verified = manager.verify_certificate(certificate.certificate_number)
        assert verified is not None
        assert verified.id == certificate.id

    def test_get_user_certificates(self, manager):
        """Test getting user certificates."""
        manager.issue_certificate("student-1", "org-1", course_id="course-1")
        manager.issue_certificate("student-1", "org-1", course_id="course-2")

        certs = manager.get_user_certificates("student-1")
        assert len(certs) == 2

    # Progress & Analytics
    def test_get_learning_progress(self, manager):
        """Test getting learning progress."""
        c1 = manager.create_course("C1", "org-1", "user-1")
        c2 = manager.create_course("C2", "org-1", "user-1")

        e1 = manager.enroll_user("student-1", "org-1", course_id=c1.id)
        manager.enroll_user("student-1", "org-1", course_id=c2.id)

        manager.complete_course(e1.id)

        progress = manager.get_learning_progress("student-1")
        assert progress["total_enrollments"] == 2
        assert progress["completed"] == 1

    def test_get_course_analytics(self, manager):
        """Test getting course analytics."""
        course = manager.create_course("Course", "org-1", "user-1")

        e1 = manager.enroll_user("user-1", "org-1", course_id=course.id)
        manager.enroll_user("user-2", "org-1", course_id=course.id)

        manager.complete_course(e1.id, score=80.0)

        analytics = manager.get_course_analytics(course.id)
        assert analytics["enrollment_count"] == 2
        # Check status distribution shows completed enrollment
        assert analytics["status_distribution"].get("completed", 0) >= 1

    # Review Management
    def test_add_review(self, manager):
        """Test adding a review via manager."""
        course = manager.create_course("Course", "org-1", "user-1")
        review = manager.add_review(course.id, "student-1", rating=5, title="Great!")

        assert review.rating == 5

    def test_get_course_reviews(self, manager):
        """Test getting course reviews."""
        course = manager.create_course("Course", "org-1", "user-1")
        manager.add_review(course.id, "user-1", rating=5)
        manager.add_review(course.id, "user-2", rating=4)

        reviews = manager.get_course_reviews(course.id)
        assert len(reviews) == 2


# ============== Global Instance Tests ==============

class TestGlobalInstance:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_learning_manager()

    def teardown_method(self):
        """Reset global instance after each test."""
        reset_learning_manager()

    def test_get_learning_manager(self):
        """Test getting global manager."""
        manager = get_learning_manager()
        assert manager is not None
        assert isinstance(manager, LearningManager)

    def test_get_same_instance(self):
        """Test getting same instance."""
        manager1 = get_learning_manager()
        manager2 = get_learning_manager()
        assert manager1 is manager2

    def test_set_learning_manager(self):
        """Test setting global manager."""
        custom_manager = LearningManager()
        set_learning_manager(custom_manager)

        assert get_learning_manager() is custom_manager

    def test_reset_learning_manager(self):
        """Test resetting global manager."""
        manager1 = get_learning_manager()
        reset_learning_manager()
        manager2 = get_learning_manager()

        assert manager1 is not manager2
