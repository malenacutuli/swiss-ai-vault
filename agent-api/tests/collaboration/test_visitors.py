"""
Tests for the Visitor Management module.
"""

import pytest
from datetime import datetime, timedelta

from app.collaboration.visitors import (
    # Enums
    VisitorType,
    VisitStatus,
    BadgeStatus,
    BadgeType,
    AccessLevel,
    AgreementType,
    AgreementStatus,
    CheckInMethod,
    NotificationType,
    VisitPurpose,
    # Data Models
    Visitor,
    Host,
    Visit,
    RecurringVisit,
    GroupVisit,
    Badge,
    Agreement,
    SignedAgreement,
    Watchlist,
    VisitorNotification,
    Location,
    VisitorAnalytics,
    # Registry and Manager
    VisitorRegistry,
    VisitorManager,
    # Global instance functions
    get_visitor_manager,
    set_visitor_manager,
    reset_visitor_manager,
)


class TestEnums:
    """Test enum definitions."""

    def test_visitor_type_values(self):
        """Test VisitorType enum values."""
        assert VisitorType.GUEST.value == "guest"
        assert VisitorType.CONTRACTOR.value == "contractor"
        assert VisitorType.VENDOR.value == "vendor"
        assert VisitorType.INTERVIEW_CANDIDATE.value == "interview_candidate"
        assert VisitorType.VIP.value == "vip"
        assert len(VisitorType) == 14

    def test_visit_status_values(self):
        """Test VisitStatus enum values."""
        assert VisitStatus.SCHEDULED.value == "scheduled"
        assert VisitStatus.CHECKED_IN.value == "checked_in"
        assert VisitStatus.CHECKED_OUT.value == "checked_out"
        assert VisitStatus.CANCELLED.value == "cancelled"
        assert VisitStatus.NO_SHOW.value == "no_show"

    def test_badge_status_values(self):
        """Test BadgeStatus enum values."""
        assert BadgeStatus.ISSUED.value == "issued"
        assert BadgeStatus.ACTIVE.value == "active"
        assert BadgeStatus.RETURNED.value == "returned"
        assert BadgeStatus.LOST.value == "lost"

    def test_access_level_values(self):
        """Test AccessLevel enum values."""
        assert AccessLevel.LOBBY_ONLY.value == "lobby_only"
        assert AccessLevel.ESCORTED.value == "escorted"
        assert AccessLevel.STANDARD.value == "standard"
        assert AccessLevel.VIP.value == "vip"

    def test_agreement_type_values(self):
        """Test AgreementType enum values."""
        assert AgreementType.NDA.value == "nda"
        assert AgreementType.SAFETY_WAIVER.value == "safety_waiver"
        assert AgreementType.CONFIDENTIALITY.value == "confidentiality"

    def test_visit_purpose_values(self):
        """Test VisitPurpose enum values."""
        assert VisitPurpose.MEETING.value == "meeting"
        assert VisitPurpose.INTERVIEW.value == "interview"
        assert VisitPurpose.DELIVERY.value == "delivery"
        assert VisitPurpose.TOUR.value == "tour"


class TestVisitorModel:
    """Test Visitor data model."""

    def test_create_visitor(self):
        """Test creating a visitor."""
        visitor = Visitor(
            id="v-001",
            first_name="John",
            last_name="Doe",
            email="john.doe@example.com",
            phone="+1234567890",
            company="Acme Corp",
            visitor_type=VisitorType.GUEST,
        )
        assert visitor.id == "v-001"
        assert visitor.first_name == "John"
        assert visitor.last_name == "Doe"
        assert visitor.email == "john.doe@example.com"
        assert visitor.company == "Acme Corp"

    def test_visitor_full_name(self):
        """Test visitor full name property."""
        visitor = Visitor(
            id="v-001",
            first_name="Jane",
            last_name="Smith",
            email="jane@example.com",
        )
        assert visitor.full_name == "Jane Smith"

    def test_visitor_to_dict(self):
        """Test visitor to_dict method."""
        visitor = Visitor(
            id="v-001",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            visitor_type=VisitorType.VIP,
            vip=True,
        )
        data = visitor.to_dict()
        assert data["id"] == "v-001"
        assert data["full_name"] == "John Doe"
        assert data["visitor_type"] == "vip"
        assert data["vip"] is True


class TestHostModel:
    """Test Host data model."""

    def test_create_host(self):
        """Test creating a host."""
        host = Host(
            id="h-001",
            user_id="user-001",
            name="Alice Johnson",
            email="alice@company.com",
            department="Engineering",
            location="Building A",
        )
        assert host.id == "h-001"
        assert host.user_id == "user-001"
        assert host.name == "Alice Johnson"
        assert host.department == "Engineering"

    def test_host_notification_preferences(self):
        """Test host notification preferences."""
        host = Host(
            id="h-001",
            user_id="user-001",
            name="Bob",
            email="bob@company.com",
        )
        assert host.notification_preferences["email"] is True
        assert host.notification_preferences["push"] is True


class TestVisitModel:
    """Test Visit data model."""

    def test_create_visit(self):
        """Test creating a visit."""
        visit = Visit(
            id="visit-001",
            visitor_id="v-001",
            host_id="h-001",
            purpose=VisitPurpose.MEETING,
            scheduled_start=datetime.utcnow(),
        )
        assert visit.id == "visit-001"
        assert visit.visitor_id == "v-001"
        assert visit.purpose == VisitPurpose.MEETING
        assert visit.status == VisitStatus.SCHEDULED

    def test_visit_duration(self):
        """Test visit duration calculation."""
        now = datetime.utcnow()
        visit = Visit(
            id="visit-001",
            visitor_id="v-001",
            host_id="h-001",
            actual_check_in=now,
            actual_check_out=now + timedelta(hours=2),
        )
        assert visit.duration_minutes == 120

    def test_visit_is_active(self):
        """Test visit is_active property."""
        visit = Visit(
            id="visit-001",
            visitor_id="v-001",
            host_id="h-001",
            status=VisitStatus.CHECKED_IN,
        )
        assert visit.is_active is True

        visit.status = VisitStatus.CHECKED_OUT
        assert visit.is_active is False


class TestBadgeModel:
    """Test Badge data model."""

    def test_create_badge(self):
        """Test creating a badge."""
        badge = Badge(
            id="b-001",
            badge_number="VB-1001",
            badge_type=BadgeType.TEMPORARY,
            access_level=AccessLevel.ESCORTED,
        )
        assert badge.id == "b-001"
        assert badge.badge_number == "VB-1001"
        assert badge.badge_type == BadgeType.TEMPORARY

    def test_badge_expiry(self):
        """Test badge expiry check."""
        badge = Badge(
            id="b-001",
            badge_number="VB-1001",
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        assert badge.is_expired is True

        badge.expires_at = datetime.utcnow() + timedelta(hours=1)
        assert badge.is_expired is False


class TestAgreementModel:
    """Test Agreement data model."""

    def test_create_agreement(self):
        """Test creating an agreement."""
        agreement = Agreement(
            id="a-001",
            agreement_type=AgreementType.NDA,
            title="Non-Disclosure Agreement",
            content="Agreement content here...",
            version="1.0",
        )
        assert agreement.id == "a-001"
        assert agreement.agreement_type == AgreementType.NDA
        assert agreement.active is True


class TestSignedAgreementModel:
    """Test SignedAgreement data model."""

    def test_signed_agreement_validity(self):
        """Test signed agreement validity check."""
        signed = SignedAgreement(
            id="sa-001",
            agreement_id="a-001",
            visitor_id="v-001",
            status=AgreementStatus.SIGNED,
            signed_at=datetime.utcnow(),
        )
        assert signed.is_valid is True

        signed.status = AgreementStatus.DECLINED
        assert signed.is_valid is False


class TestVisitorRegistry:
    """Test VisitorRegistry functionality."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return VisitorRegistry()

    def test_create_and_get_visitor(self, registry):
        """Test creating and retrieving a visitor."""
        visitor = Visitor(
            id="v-001",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        registry.create_visitor(visitor)

        result = registry.get_visitor("v-001")
        assert result is not None
        assert result.first_name == "John"

    def test_get_visitor_by_email(self, registry):
        """Test retrieving visitor by email."""
        visitor = Visitor(
            id="v-001",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        registry.create_visitor(visitor)

        result = registry.get_visitor_by_email("john@example.com")
        assert result is not None
        assert result.id == "v-001"

    def test_update_visitor(self, registry):
        """Test updating a visitor."""
        visitor = Visitor(
            id="v-001",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        registry.create_visitor(visitor)

        updated = registry.update_visitor("v-001", {"company": "New Corp"})
        assert updated.company == "New Corp"

    def test_list_visitors_with_filters(self, registry):
        """Test listing visitors with filters."""
        registry.create_visitor(Visitor(
            id="v-001",
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            visitor_type=VisitorType.GUEST,
            vip=True,
        ))
        registry.create_visitor(Visitor(
            id="v-002",
            first_name="Jane",
            last_name="Smith",
            email="jane@example.com",
            visitor_type=VisitorType.CONTRACTOR,
        ))

        guests = registry.list_visitors(visitor_type=VisitorType.GUEST)
        assert len(guests) == 1
        assert guests[0].first_name == "John"

        vips = registry.list_visitors(vip=True)
        assert len(vips) == 1

    def test_create_and_get_host(self, registry):
        """Test creating and retrieving a host."""
        host = Host(
            id="h-001",
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )
        registry.create_host(host)

        result = registry.get_host("h-001")
        assert result is not None
        assert result.name == "Alice"

    def test_create_and_get_visit(self, registry):
        """Test creating and retrieving a visit."""
        visit = Visit(
            id="visit-001",
            visitor_id="v-001",
            host_id="h-001",
            scheduled_start=datetime.utcnow(),
        )
        registry.create_visit(visit)

        result = registry.get_visit("visit-001")
        assert result is not None
        assert result.visitor_id == "v-001"

    def test_list_visits_with_filters(self, registry):
        """Test listing visits with filters."""
        now = datetime.utcnow()
        registry.create_visit(Visit(
            id="visit-001",
            visitor_id="v-001",
            host_id="h-001",
            scheduled_start=now,
            purpose=VisitPurpose.MEETING,
        ))
        registry.create_visit(Visit(
            id="visit-002",
            visitor_id="v-002",
            host_id="h-001",
            scheduled_start=now + timedelta(hours=1),
            purpose=VisitPurpose.INTERVIEW,
        ))

        meetings = registry.list_visits(purpose=VisitPurpose.MEETING)
        assert len(meetings) == 1

        host_visits = registry.list_visits(host_id="h-001")
        assert len(host_visits) == 2

    def test_get_active_visits(self, registry):
        """Test getting active visits."""
        registry.create_visit(Visit(
            id="visit-001",
            visitor_id="v-001",
            host_id="h-001",
            status=VisitStatus.CHECKED_IN,
        ))
        registry.create_visit(Visit(
            id="visit-002",
            visitor_id="v-002",
            host_id="h-001",
            status=VisitStatus.SCHEDULED,
        ))

        active = registry.get_active_visits()
        assert len(active) == 1
        assert active[0].id == "visit-001"

    def test_badge_management(self, registry):
        """Test badge CRUD operations."""
        badge = Badge(
            id="b-001",
            badge_number="VB-1001",
            badge_type=BadgeType.TEMPORARY,
        )
        registry.create_badge(badge)

        result = registry.get_badge("b-001")
        assert result is not None

        by_number = registry.get_badge_by_number("VB-1001")
        assert by_number is not None

    def test_agreement_management(self, registry):
        """Test agreement CRUD operations."""
        agreement = Agreement(
            id="a-001",
            agreement_type=AgreementType.NDA,
            title="NDA",
            content="Content",
        )
        registry.create_agreement(agreement)

        result = registry.get_agreement("a-001")
        assert result is not None

    def test_watchlist_check(self, registry):
        """Test watchlist checking."""
        entry = Watchlist(
            id="w-001",
            email="blocked@example.com",
            reason="Security concern",
            severity="block",
            action="block",
            added_by="admin",
        )
        registry.create_watchlist_entry(entry)

        matches = registry.check_watchlist(email="blocked@example.com")
        assert len(matches) == 1
        assert matches[0].action == "block"


class TestVisitorManager:
    """Test VisitorManager functionality."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return VisitorManager()

    def test_register_visitor(self, manager):
        """Test registering a new visitor."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            phone="+1234567890",
            company="Acme Corp",
        )
        assert visitor is not None
        assert visitor.first_name == "John"
        assert visitor.email == "john@example.com"

    def test_register_existing_visitor(self, manager):
        """Test registering an existing visitor returns the existing one."""
        visitor1 = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        visitor2 = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        assert visitor1.id == visitor2.id

    def test_blacklist_visitor(self, manager):
        """Test blacklisting a visitor."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )

        result = manager.blacklist_visitor(
            visitor.id,
            reason="Security violation",
            added_by="admin",
        )
        assert result.blacklisted is True

    def test_register_host(self, manager):
        """Test registering a host."""
        host = manager.register_host(
            user_id="user-001",
            name="Alice Johnson",
            email="alice@company.com",
            department="Engineering",
        )
        assert host is not None
        assert host.name == "Alice Johnson"

    def test_schedule_visit(self, manager):
        """Test scheduling a visit."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )

        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow() + timedelta(days=1),
            purpose=VisitPurpose.MEETING,
        )
        assert visit is not None
        assert visit.status == VisitStatus.SCHEDULED
        assert visit.pre_registration_code is not None

    def test_schedule_visit_blacklisted_visitor(self, manager):
        """Test scheduling visit for blacklisted visitor fails."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )
        manager.blacklist_visitor(visitor.id, "Test", "admin")

        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
        )
        assert visit is None

    def test_check_in_visitor(self, manager):
        """Test checking in a visitor."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
        )

        checked_in = manager.check_in_visitor(
            visit.id,
            method=CheckInMethod.RECEPTION,
        )
        assert checked_in.status == VisitStatus.CHECKED_IN
        assert checked_in.actual_check_in is not None

    def test_check_out_visitor(self, manager):
        """Test checking out a visitor."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
        )
        manager.check_in_visitor(visit.id)

        checked_out = manager.check_out_visitor(visit.id)
        assert checked_out.status == VisitStatus.CHECKED_OUT
        assert checked_out.actual_check_out is not None

    def test_cancel_visit(self, manager):
        """Test cancelling a visit."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow() + timedelta(days=1),
        )

        cancelled = manager.cancel_visit(
            visit.id,
            reason="Meeting rescheduled",
            cancelled_by="host",
        )
        assert cancelled.status == VisitStatus.CANCELLED
        assert cancelled.cancellation_reason == "Meeting rescheduled"

    def test_create_badge(self, manager):
        """Test creating a badge."""
        badge = manager.create_badge(
            badge_number="VB-1001",
            badge_type=BadgeType.TEMPORARY,
            access_level=AccessLevel.ESCORTED,
        )
        assert badge is not None
        assert badge.badge_number == "VB-1001"
        assert badge.status == BadgeStatus.RETURNED  # Available

    def test_issue_and_return_badge(self, manager):
        """Test issuing and returning a badge."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
        )
        badge = manager.create_badge(badge_number="VB-1001")

        issued = manager.issue_badge(
            badge.id,
            visitor_id=visitor.id,
            visit_id=visit.id,
            issued_by="reception",
        )
        assert issued.status == BadgeStatus.ISSUED
        assert issued.visitor_id == visitor.id

        returned = manager.return_badge(badge.id, returned_to="reception")
        assert returned.status == BadgeStatus.RETURNED
        assert returned.visitor_id is None

    def test_create_agreement(self, manager):
        """Test creating an agreement."""
        agreement = manager.create_agreement(
            agreement_type=AgreementType.NDA,
            title="Non-Disclosure Agreement",
            content="Agreement content...",
        )
        assert agreement is not None
        assert agreement.agreement_type == AgreementType.NDA

    def test_sign_agreement(self, manager):
        """Test signing an agreement."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        agreement = manager.create_agreement(
            agreement_type=AgreementType.NDA,
            title="NDA",
            content="Content",
        )

        signed = manager.sign_agreement(
            agreement_id=agreement.id,
            visitor_id=visitor.id,
            signature_data="base64signature",
        )
        assert signed is not None
        assert signed.status == AgreementStatus.SIGNED

    def test_has_valid_agreement(self, manager):
        """Test checking for valid agreement."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        agreement = manager.create_agreement(
            agreement_type=AgreementType.NDA,
            title="NDA",
            content="Content",
        )

        assert manager.has_valid_agreement(visitor.id, agreement.id) is False

        manager.sign_agreement(agreement.id, visitor.id)
        assert manager.has_valid_agreement(visitor.id, agreement.id) is True

    def test_add_to_watchlist(self, manager):
        """Test adding to watchlist."""
        entry = manager.add_to_watchlist(
            email="suspicious@example.com",
            reason="Security concern",
            severity="warning",
            action="require_approval",
            added_by="security",
        )
        assert entry is not None
        assert entry.email == "suspicious@example.com"

    def test_check_watchlist(self, manager):
        """Test checking watchlist."""
        manager.add_to_watchlist(
            email="blocked@example.com",
            reason="Banned",
            severity="block",
            action="block",
            added_by="admin",
        )

        matches = manager.check_watchlist(email="blocked@example.com")
        assert len(matches) == 1
        assert matches[0].action == "block"

    def test_create_location(self, manager):
        """Test creating a location."""
        location = manager.create_location(
            name="Main Office",
            building="Building A",
            address="123 Main St",
        )
        assert location is not None
        assert location.name == "Main Office"

    def test_recurring_visit(self, manager):
        """Test creating a recurring visit."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )

        recurring = manager.create_recurring_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            purpose=VisitPurpose.MEETING,
            recurrence_pattern="weekly",
            days_of_week=[0, 2, 4],  # Mon, Wed, Fri
            start_time="09:00",
            end_time="17:00",
            start_date=datetime.utcnow(),
        )
        assert recurring is not None
        assert recurring.recurrence_pattern == "weekly"
        assert len(recurring.days_of_week) == 3

    def test_group_visit(self, manager):
        """Test creating a group visit."""
        visitors = []
        for i in range(3):
            v = manager.register_visitor(
                first_name=f"Visitor{i}",
                last_name="Test",
                email=f"visitor{i}@example.com",
            )
            visitors.append(v)

        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )

        group = manager.create_group_visit(
            name="Office Tour",
            host_id=host.id,
            purpose=VisitPurpose.TOUR,
            scheduled_start=datetime.utcnow() + timedelta(days=1),
            visitor_ids=[v.id for v in visitors],
        )
        assert group is not None
        assert group.group_size == 3

    def test_generate_analytics(self, manager):
        """Test generating analytics."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )

        # Create some visits
        for i in range(5):
            visit = manager.schedule_visit(
                visitor_id=visitor.id,
                host_id=host.id,
                scheduled_start=datetime.utcnow(),
                purpose=VisitPurpose.MEETING,
            )
            manager.check_in_visitor(visit.id)
            manager.check_out_visitor(visit.id)

        analytics = manager.generate_analytics(
            period_start=datetime.utcnow() - timedelta(days=1),
            period_end=datetime.utcnow() + timedelta(days=1),
        )
        assert analytics.total_visits == 5
        assert analytics.check_ins == 5

    def test_get_visitor_history(self, manager):
        """Test getting visitor history."""
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
        )
        host = manager.register_host(
            user_id="user-001",
            name="Alice",
            email="alice@company.com",
        )

        for _ in range(3):
            manager.schedule_visit(
                visitor_id=visitor.id,
                host_id=host.id,
                scheduled_start=datetime.utcnow(),
            )

        history = manager.get_visitor_history(visitor.id)
        assert history["total_visits"] == 3
        assert len(history["visits"]) == 3


class TestGlobalInstances:
    """Test global instance management."""

    def test_get_visitor_manager(self):
        """Test getting global visitor manager."""
        reset_visitor_manager()
        manager = get_visitor_manager()
        assert manager is not None
        assert isinstance(manager, VisitorManager)

    def test_set_visitor_manager(self):
        """Test setting custom visitor manager."""
        reset_visitor_manager()
        custom_manager = VisitorManager()
        set_visitor_manager(custom_manager)

        manager = get_visitor_manager()
        assert manager is custom_manager

    def test_reset_visitor_manager(self):
        """Test resetting visitor manager."""
        manager1 = get_visitor_manager()
        reset_visitor_manager()
        manager2 = get_visitor_manager()
        assert manager1 is not manager2


class TestVisitorWorkflows:
    """Test complete visitor workflows."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return VisitorManager()

    def test_complete_visitor_journey(self, manager):
        """Test a complete visitor journey from registration to checkout."""
        # Register visitor
        visitor = manager.register_visitor(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            company="Client Corp",
            visitor_type=VisitorType.GUEST,
        )

        # Register host
        host = manager.register_host(
            user_id="user-001",
            name="Alice Johnson",
            email="alice@company.com",
            department="Sales",
        )

        # Create required agreement
        nda = manager.create_agreement(
            agreement_type=AgreementType.NDA,
            title="Visitor NDA",
            content="NDA content...",
        )

        # Sign agreement
        manager.sign_agreement(nda.id, visitor.id)

        # Create badge
        badge = manager.create_badge(
            badge_number="VB-1001",
            badge_type=BadgeType.TEMPORARY,
        )

        # Schedule visit
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
            purpose=VisitPurpose.MEETING,
            created_by=host.user_id,
        )
        assert visit.status == VisitStatus.SCHEDULED

        # Issue badge and check in
        manager.issue_badge(badge.id, visitor.id, visit.id, "reception")
        checked_in = manager.check_in_visitor(
            visit.id,
            method=CheckInMethod.RECEPTION,
            badge_id=badge.id,
        )
        assert checked_in.status == VisitStatus.CHECKED_IN

        # Check out and return badge
        checked_out = manager.check_out_visitor(visit.id)
        assert checked_out.status == VisitStatus.CHECKED_OUT

        # Verify badge returned
        updated_badge = manager.get_badge(badge.id)
        assert updated_badge.status == BadgeStatus.RETURNED

        # Check visitor stats updated
        updated_visitor = manager.get_visitor(visitor.id)
        assert updated_visitor.total_visits == 1

    def test_watchlist_blocking_workflow(self, manager):
        """Test watchlist blocking a visitor."""
        # Add to watchlist first
        manager.add_to_watchlist(
            email="blocked@example.com",
            reason="Security concern",
            severity="block",
            action="block",
            added_by="security",
        )

        # Try to register visitor with blocked email
        visitor = manager.register_visitor(
            first_name="Bad",
            last_name="Actor",
            email="blocked@example.com",
        )

        host = manager.register_host(
            user_id="user-001",
            name="Host",
            email="host@company.com",
        )

        # Visit should be blocked
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
        )
        assert visit is None

    def test_approval_required_workflow(self, manager):
        """Test visit requiring approval."""
        # Add to watchlist with approval requirement
        manager.add_to_watchlist(
            email="contractor@example.com",
            reason="Contractor - requires approval",
            severity="warning",
            action="require_approval",
            added_by="hr",
        )

        visitor = manager.register_visitor(
            first_name="Contract",
            last_name="Worker",
            email="contractor@example.com",
            visitor_type=VisitorType.CONTRACTOR,
        )

        host = manager.register_host(
            user_id="user-001",
            name="Project Manager",
            email="pm@company.com",
        )

        # Visit should be pending approval
        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow() + timedelta(days=1),
        )
        assert visit.status == VisitStatus.PENDING_APPROVAL

        # Approve the visit
        approved = manager.approve_visit(visit.id, approved_by="security")
        assert approved.status == VisitStatus.APPROVED

    def test_vip_visitor_workflow(self, manager):
        """Test VIP visitor handling."""
        visitor = manager.register_visitor(
            first_name="Important",
            last_name="Executive",
            email="ceo@bigclient.com",
            company="Big Client Corp",
            visitor_type=VisitorType.VIP,
        )
        manager.mark_as_vip(visitor.id)

        host = manager.register_host(
            user_id="exec-001",
            name="Our CEO",
            email="ceo@company.com",
            default_access_level=AccessLevel.VIP,
        )

        # Create VIP badge
        vip_badge = manager.create_badge(
            badge_number="VIP-001",
            badge_type=BadgeType.VIP,
            access_level=AccessLevel.VIP,
        )

        visit = manager.schedule_visit(
            visitor_id=visitor.id,
            host_id=host.id,
            scheduled_start=datetime.utcnow(),
            access_level=AccessLevel.VIP,
        )

        manager.issue_badge(vip_badge.id, visitor.id, visit.id, "concierge")
        manager.check_in_visitor(visit.id, CheckInMethod.RECEPTION, vip_badge.id)

        updated_visitor = manager.get_visitor(visitor.id)
        assert updated_visitor.vip is True
