"""
Visitor Management module for enterprise collaboration.

This module provides comprehensive visitor management functionality including:
- Visitor registration and pre-registration
- Visit scheduling and recurring visits
- Host assignment and notifications
- Check-in/check-out workflows
- Badge and access pass management
- NDA and legal agreement handling
- Visitor logs and analytics
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import uuid


# ============================================================
# Enums
# ============================================================

class VisitorType(Enum):
    """Types of visitors."""
    GUEST = "guest"
    CONTRACTOR = "contractor"
    VENDOR = "vendor"
    INTERVIEW_CANDIDATE = "interview_candidate"
    DELIVERY = "delivery"
    VIP = "vip"
    GOVERNMENT = "government"
    AUDITOR = "auditor"
    CONSULTANT = "consultant"
    FAMILY = "family"
    TOUR = "tour"
    MEDIA = "media"
    INVESTOR = "investor"
    OTHER = "other"


class VisitStatus(Enum):
    """Status of a visit."""
    SCHEDULED = "scheduled"
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"
    CHECKED_IN = "checked_in"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    EXPIRED = "expired"


class BadgeStatus(Enum):
    """Status of a visitor badge."""
    ISSUED = "issued"
    ACTIVE = "active"
    RETURNED = "returned"
    LOST = "lost"
    EXPIRED = "expired"
    DEACTIVATED = "deactivated"


class BadgeType(Enum):
    """Types of visitor badges."""
    TEMPORARY = "temporary"
    DAY_PASS = "day_pass"
    WEEK_PASS = "week_pass"
    CONTRACTOR = "contractor"
    VIP = "vip"
    ESCORT_REQUIRED = "escort_required"
    RESTRICTED = "restricted"
    FULL_ACCESS = "full_access"


class AccessLevel(Enum):
    """Access levels for visitors."""
    LOBBY_ONLY = "lobby_only"
    ESCORTED = "escorted"
    LIMITED = "limited"
    STANDARD = "standard"
    EXTENDED = "extended"
    FULL = "full"
    VIP = "vip"


class AgreementType(Enum):
    """Types of legal agreements."""
    NDA = "nda"
    SAFETY_WAIVER = "safety_waiver"
    PHOTO_RELEASE = "photo_release"
    CONFIDENTIALITY = "confidentiality"
    TERMS_OF_VISIT = "terms_of_visit"
    HEALTH_DECLARATION = "health_declaration"
    CONTRACTOR_AGREEMENT = "contractor_agreement"
    MEDIA_RELEASE = "media_release"


class AgreementStatus(Enum):
    """Status of agreement signing."""
    PENDING = "pending"
    SIGNED = "signed"
    DECLINED = "declined"
    EXPIRED = "expired"
    REVOKED = "revoked"


class CheckInMethod(Enum):
    """Methods for visitor check-in."""
    RECEPTION = "reception"
    KIOSK = "kiosk"
    MOBILE_APP = "mobile_app"
    QR_CODE = "qr_code"
    PRE_REGISTERED = "pre_registered"
    FACIAL_RECOGNITION = "facial_recognition"
    BADGE_SCAN = "badge_scan"


class NotificationType(Enum):
    """Types of visitor notifications."""
    VISIT_SCHEDULED = "visit_scheduled"
    VISIT_REMINDER = "visit_reminder"
    VISITOR_ARRIVED = "visitor_arrived"
    VISITOR_CHECKED_IN = "visitor_checked_in"
    VISITOR_CHECKED_OUT = "visitor_checked_out"
    VISIT_CANCELLED = "visit_cancelled"
    APPROVAL_REQUIRED = "approval_required"
    APPROVAL_GRANTED = "approval_granted"
    APPROVAL_DENIED = "approval_denied"
    BADGE_ISSUED = "badge_issued"
    BADGE_EXPIRING = "badge_expiring"


class VisitPurpose(Enum):
    """Common purposes for visits."""
    MEETING = "meeting"
    INTERVIEW = "interview"
    DELIVERY = "delivery"
    MAINTENANCE = "maintenance"
    TOUR = "tour"
    TRAINING = "training"
    AUDIT = "audit"
    CONSULTATION = "consultation"
    EVENT = "event"
    SOCIAL = "social"
    OTHER = "other"


# ============================================================
# Data Models
# ============================================================

@dataclass
class Visitor:
    """Represents a visitor profile."""
    id: str
    first_name: str
    last_name: str
    email: str
    phone: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    visitor_type: VisitorType = VisitorType.GUEST
    photo_url: Optional[str] = None
    id_document_type: Optional[str] = None
    id_document_number: Optional[str] = None
    vehicle_info: Optional[str] = None
    license_plate: Optional[str] = None
    emergency_contact: Optional[str] = None
    emergency_phone: Optional[str] = None
    notes: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    blacklisted: bool = False
    blacklist_reason: Optional[str] = None
    vip: bool = False
    frequent_visitor: bool = False
    total_visits: int = 0
    last_visit_date: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def full_name(self) -> str:
        """Get full name."""
        return f"{self.first_name} {self.last_name}"

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "full_name": self.full_name,
            "email": self.email,
            "phone": self.phone,
            "company": self.company,
            "title": self.title,
            "visitor_type": self.visitor_type.value,
            "photo_url": self.photo_url,
            "blacklisted": self.blacklisted,
            "vip": self.vip,
            "frequent_visitor": self.frequent_visitor,
            "total_visits": self.total_visits,
            "last_visit_date": self.last_visit_date.isoformat() if self.last_visit_date else None,
            "created_at": self.created_at.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class Host:
    """Represents a host who receives visitors."""
    id: str
    user_id: str
    name: str
    email: str
    phone: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    assistant_id: Optional[str] = None
    assistant_email: Optional[str] = None
    notification_preferences: Dict[str, bool] = field(default_factory=lambda: {
        "email": True,
        "sms": False,
        "push": True,
        "slack": False,
    })
    auto_approve_known_visitors: bool = False
    default_access_level: AccessLevel = AccessLevel.ESCORTED
    max_visitors_per_day: Optional[int] = None
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "name": self.name,
            "email": self.email,
            "department": self.department,
            "location": self.location,
            "active": self.active,
            "default_access_level": self.default_access_level.value,
        }


@dataclass
class Visit:
    """Represents a scheduled visit."""
    id: str
    visitor_id: str
    host_id: str
    purpose: VisitPurpose = VisitPurpose.MEETING
    purpose_details: Optional[str] = None
    status: VisitStatus = VisitStatus.SCHEDULED
    scheduled_start: datetime = field(default_factory=datetime.utcnow)
    scheduled_end: Optional[datetime] = None
    actual_check_in: Optional[datetime] = None
    actual_check_out: Optional[datetime] = None
    check_in_method: Optional[CheckInMethod] = None
    location: Optional[str] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    access_level: AccessLevel = AccessLevel.ESCORTED
    escort_required: bool = False
    escort_id: Optional[str] = None
    badge_id: Optional[str] = None
    parking_spot: Optional[str] = None
    wifi_credentials: Optional[str] = None
    special_instructions: Optional[str] = None
    items_brought: List[str] = field(default_factory=list)
    items_left_behind: List[str] = field(default_factory=list)
    approval_required: bool = False
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    cancellation_reason: Optional[str] = None
    cancelled_by: Optional[str] = None
    cancelled_at: Optional[datetime] = None
    pre_registered: bool = False
    pre_registration_code: Optional[str] = None
    recurring_visit_id: Optional[str] = None
    group_visit_id: Optional[str] = None
    notifications_sent: List[str] = field(default_factory=list)
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def duration_minutes(self) -> Optional[int]:
        """Calculate visit duration in minutes."""
        if self.actual_check_in and self.actual_check_out:
            delta = self.actual_check_out - self.actual_check_in
            return int(delta.total_seconds() / 60)
        return None

    @property
    def is_active(self) -> bool:
        """Check if visit is currently active."""
        return self.status == VisitStatus.CHECKED_IN

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "visitor_id": self.visitor_id,
            "host_id": self.host_id,
            "purpose": self.purpose.value,
            "status": self.status.value,
            "scheduled_start": self.scheduled_start.isoformat(),
            "scheduled_end": self.scheduled_end.isoformat() if self.scheduled_end else None,
            "actual_check_in": self.actual_check_in.isoformat() if self.actual_check_in else None,
            "actual_check_out": self.actual_check_out.isoformat() if self.actual_check_out else None,
            "location": self.location,
            "access_level": self.access_level.value,
            "duration_minutes": self.duration_minutes,
            "is_active": self.is_active,
        }


@dataclass
class RecurringVisit:
    """Represents a recurring visit schedule."""
    id: str
    visitor_id: str
    host_id: str
    purpose: VisitPurpose
    recurrence_pattern: str  # daily, weekly, biweekly, monthly
    days_of_week: List[int] = field(default_factory=list)  # 0=Monday
    start_time: str = "09:00"  # HH:MM
    end_time: str = "17:00"
    start_date: datetime = field(default_factory=datetime.utcnow)
    end_date: Optional[datetime] = None
    access_level: AccessLevel = AccessLevel.STANDARD
    location: Optional[str] = None
    auto_approve: bool = True
    active: bool = True
    visits_generated: int = 0
    last_generated: Optional[datetime] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "visitor_id": self.visitor_id,
            "host_id": self.host_id,
            "recurrence_pattern": self.recurrence_pattern,
            "days_of_week": self.days_of_week,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "active": self.active,
            "visits_generated": self.visits_generated,
        }


@dataclass
class GroupVisit:
    """Represents a group visit with multiple visitors."""
    id: str
    name: str
    host_id: str
    purpose: VisitPurpose
    scheduled_start: datetime
    scheduled_end: Optional[datetime] = None
    visitor_ids: List[str] = field(default_factory=list)
    location: Optional[str] = None
    access_level: AccessLevel = AccessLevel.ESCORTED
    escort_required: bool = True
    max_group_size: Optional[int] = None
    status: VisitStatus = VisitStatus.SCHEDULED
    notes: Optional[str] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def group_size(self) -> int:
        """Get current group size."""
        return len(self.visitor_ids)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "host_id": self.host_id,
            "purpose": self.purpose.value,
            "scheduled_start": self.scheduled_start.isoformat(),
            "group_size": self.group_size,
            "status": self.status.value,
        }


@dataclass
class Badge:
    """Represents a visitor badge."""
    id: str
    badge_number: str
    badge_type: BadgeType = BadgeType.TEMPORARY
    visitor_id: Optional[str] = None
    visit_id: Optional[str] = None
    status: BadgeStatus = BadgeStatus.ISSUED
    access_level: AccessLevel = AccessLevel.ESCORTED
    access_zones: List[str] = field(default_factory=list)
    issued_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    returned_at: Optional[datetime] = None
    issued_by: Optional[str] = None
    returned_to: Optional[str] = None
    photo_captured: bool = False
    qr_code: Optional[str] = None
    rfid_tag: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """Check if badge is expired."""
        if self.expires_at:
            return datetime.utcnow() > self.expires_at
        return False

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "badge_number": self.badge_number,
            "badge_type": self.badge_type.value,
            "visitor_id": self.visitor_id,
            "status": self.status.value,
            "access_level": self.access_level.value,
            "issued_at": self.issued_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "is_expired": self.is_expired,
        }


@dataclass
class Agreement:
    """Represents a legal agreement for visitors."""
    id: str
    agreement_type: AgreementType
    title: str
    content: str
    version: str = "1.0"
    required_for_visitor_types: List[VisitorType] = field(default_factory=list)
    required_for_access_levels: List[AccessLevel] = field(default_factory=list)
    active: bool = True
    expires_after_days: Optional[int] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "agreement_type": self.agreement_type.value,
            "title": self.title,
            "version": self.version,
            "active": self.active,
        }


@dataclass
class SignedAgreement:
    """Represents a signed agreement by a visitor."""
    id: str
    agreement_id: str
    visitor_id: str
    visit_id: Optional[str] = None
    status: AgreementStatus = AgreementStatus.PENDING
    signed_at: Optional[datetime] = None
    signature_data: Optional[str] = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    revoked_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        """Check if agreement is currently valid."""
        if self.status != AgreementStatus.SIGNED:
            return False
        if self.expires_at and datetime.utcnow() > self.expires_at:
            return False
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "agreement_id": self.agreement_id,
            "visitor_id": self.visitor_id,
            "status": self.status.value,
            "signed_at": self.signed_at.isoformat() if self.signed_at else None,
            "is_valid": self.is_valid,
        }


@dataclass
class Watchlist:
    """Represents a visitor watchlist entry."""
    id: str
    visitor_id: Optional[str] = None
    email: Optional[str] = None
    name: Optional[str] = None
    reason: str = ""
    severity: str = "warning"  # info, warning, block
    action: str = "notify"  # notify, require_approval, block
    notify_users: List[str] = field(default_factory=list)
    active: bool = True
    added_by: str = ""
    added_at: datetime = field(default_factory=datetime.utcnow)
    expires_at: Optional[datetime] = None
    notes: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "visitor_id": self.visitor_id,
            "email": self.email,
            "name": self.name,
            "reason": self.reason,
            "severity": self.severity,
            "action": self.action,
            "active": self.active,
        }


@dataclass
class VisitorNotification:
    """Represents a notification related to visitors."""
    id: str
    notification_type: NotificationType
    visit_id: Optional[str] = None
    visitor_id: Optional[str] = None
    recipient_id: str = ""
    recipient_email: Optional[str] = None
    subject: str = ""
    message: str = ""
    sent: bool = False
    sent_at: Optional[datetime] = None
    channel: str = "email"  # email, sms, push, slack
    error: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "notification_type": self.notification_type.value,
            "visit_id": self.visit_id,
            "recipient_id": self.recipient_id,
            "sent": self.sent,
            "channel": self.channel,
        }


@dataclass
class Location:
    """Represents a visitable location."""
    id: str
    name: str
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    address: Optional[str] = None
    reception_email: Optional[str] = None
    reception_phone: Optional[str] = None
    timezone: str = "UTC"
    check_in_instructions: Optional[str] = None
    parking_info: Optional[str] = None
    wifi_info: Optional[str] = None
    access_instructions: Optional[str] = None
    emergency_procedures: Optional[str] = None
    capacity: Optional[int] = None
    requires_escort: bool = False
    requires_badge: bool = True
    requires_id_verification: bool = False
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "building": self.building,
            "address": self.address,
            "active": self.active,
            "requires_escort": self.requires_escort,
            "requires_badge": self.requires_badge,
        }


@dataclass
class VisitorAnalytics:
    """Analytics data for visitor management."""
    id: str
    period_start: datetime
    period_end: datetime
    location_id: Optional[str] = None
    total_visits: int = 0
    unique_visitors: int = 0
    check_ins: int = 0
    no_shows: int = 0
    average_visit_duration_minutes: float = 0.0
    visits_by_type: Dict[str, int] = field(default_factory=dict)
    visits_by_purpose: Dict[str, int] = field(default_factory=dict)
    visits_by_day: Dict[str, int] = field(default_factory=dict)
    visits_by_hour: Dict[int, int] = field(default_factory=dict)
    peak_hour: Optional[int] = None
    peak_day: Optional[str] = None
    busiest_host_id: Optional[str] = None
    badges_issued: int = 0
    badges_lost: int = 0
    agreements_signed: int = 0
    agreements_declined: int = 0
    watchlist_matches: int = 0
    average_check_in_time_seconds: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "total_visits": self.total_visits,
            "unique_visitors": self.unique_visitors,
            "check_ins": self.check_ins,
            "no_shows": self.no_shows,
            "average_visit_duration_minutes": self.average_visit_duration_minutes,
            "visits_by_type": self.visits_by_type,
            "peak_hour": self.peak_hour,
        }


# ============================================================
# Registry
# ============================================================

class VisitorRegistry:
    """Registry for managing visitor data."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._visitors: Dict[str, Visitor] = {}
        self._hosts: Dict[str, Host] = {}
        self._visits: Dict[str, Visit] = {}
        self._recurring_visits: Dict[str, RecurringVisit] = {}
        self._group_visits: Dict[str, GroupVisit] = {}
        self._badges: Dict[str, Badge] = {}
        self._agreements: Dict[str, Agreement] = {}
        self._signed_agreements: Dict[str, SignedAgreement] = {}
        self._watchlist: Dict[str, Watchlist] = {}
        self._notifications: Dict[str, VisitorNotification] = {}
        self._locations: Dict[str, Location] = {}
        self._analytics: Dict[str, VisitorAnalytics] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._visitors.clear()
        self._hosts.clear()
        self._visits.clear()
        self._recurring_visits.clear()
        self._group_visits.clear()
        self._badges.clear()
        self._agreements.clear()
        self._signed_agreements.clear()
        self._watchlist.clear()
        self._notifications.clear()
        self._locations.clear()
        self._analytics.clear()

    # Visitor CRUD
    def create_visitor(self, visitor: Visitor) -> Visitor:
        """Create a new visitor."""
        self._visitors[visitor.id] = visitor
        return visitor

    def get_visitor(self, visitor_id: str) -> Optional[Visitor]:
        """Get a visitor by ID."""
        return self._visitors.get(visitor_id)

    def get_visitor_by_email(self, email: str) -> Optional[Visitor]:
        """Get a visitor by email."""
        for visitor in self._visitors.values():
            if visitor.email.lower() == email.lower():
                return visitor
        return None

    def update_visitor(self, visitor_id: str, updates: Dict[str, Any]) -> Optional[Visitor]:
        """Update a visitor."""
        visitor = self._visitors.get(visitor_id)
        if visitor:
            for key, value in updates.items():
                if hasattr(visitor, key):
                    setattr(visitor, key, value)
            visitor.updated_at = datetime.utcnow()
        return visitor

    def delete_visitor(self, visitor_id: str) -> bool:
        """Delete a visitor."""
        if visitor_id in self._visitors:
            del self._visitors[visitor_id]
            return True
        return False

    def list_visitors(
        self,
        visitor_type: Optional[VisitorType] = None,
        company: Optional[str] = None,
        blacklisted: Optional[bool] = None,
        vip: Optional[bool] = None,
        search: Optional[str] = None,
    ) -> List[Visitor]:
        """List visitors with optional filters."""
        results = list(self._visitors.values())

        if visitor_type:
            results = [v for v in results if v.visitor_type == visitor_type]
        if company:
            results = [v for v in results if v.company and company.lower() in v.company.lower()]
        if blacklisted is not None:
            results = [v for v in results if v.blacklisted == blacklisted]
        if vip is not None:
            results = [v for v in results if v.vip == vip]
        if search:
            search_lower = search.lower()
            results = [
                v for v in results
                if search_lower in v.full_name.lower()
                or search_lower in v.email.lower()
                or (v.company and search_lower in v.company.lower())
            ]

        return results

    # Host CRUD
    def create_host(self, host: Host) -> Host:
        """Create a new host."""
        self._hosts[host.id] = host
        return host

    def get_host(self, host_id: str) -> Optional[Host]:
        """Get a host by ID."""
        return self._hosts.get(host_id)

    def get_host_by_user_id(self, user_id: str) -> Optional[Host]:
        """Get a host by user ID."""
        for host in self._hosts.values():
            if host.user_id == user_id:
                return host
        return None

    def update_host(self, host_id: str, updates: Dict[str, Any]) -> Optional[Host]:
        """Update a host."""
        host = self._hosts.get(host_id)
        if host:
            for key, value in updates.items():
                if hasattr(host, key):
                    setattr(host, key, value)
        return host

    def delete_host(self, host_id: str) -> bool:
        """Delete a host."""
        if host_id in self._hosts:
            del self._hosts[host_id]
            return True
        return False

    def list_hosts(
        self,
        department: Optional[str] = None,
        location: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> List[Host]:
        """List hosts with optional filters."""
        results = list(self._hosts.values())

        if department:
            results = [h for h in results if h.department == department]
        if location:
            results = [h for h in results if h.location == location]
        if active is not None:
            results = [h for h in results if h.active == active]

        return results

    # Visit CRUD
    def create_visit(self, visit: Visit) -> Visit:
        """Create a new visit."""
        self._visits[visit.id] = visit
        return visit

    def get_visit(self, visit_id: str) -> Optional[Visit]:
        """Get a visit by ID."""
        return self._visits.get(visit_id)

    def update_visit(self, visit_id: str, updates: Dict[str, Any]) -> Optional[Visit]:
        """Update a visit."""
        visit = self._visits.get(visit_id)
        if visit:
            for key, value in updates.items():
                if hasattr(visit, key):
                    setattr(visit, key, value)
            visit.updated_at = datetime.utcnow()
        return visit

    def delete_visit(self, visit_id: str) -> bool:
        """Delete a visit."""
        if visit_id in self._visits:
            del self._visits[visit_id]
            return True
        return False

    def list_visits(
        self,
        visitor_id: Optional[str] = None,
        host_id: Optional[str] = None,
        status: Optional[VisitStatus] = None,
        purpose: Optional[VisitPurpose] = None,
        location: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Visit]:
        """List visits with optional filters."""
        results = list(self._visits.values())

        if visitor_id:
            results = [v for v in results if v.visitor_id == visitor_id]
        if host_id:
            results = [v for v in results if v.host_id == host_id]
        if status:
            results = [v for v in results if v.status == status]
        if purpose:
            results = [v for v in results if v.purpose == purpose]
        if location:
            results = [v for v in results if v.location == location]
        if start_date:
            results = [v for v in results if v.scheduled_start >= start_date]
        if end_date:
            results = [v for v in results if v.scheduled_start <= end_date]

        return sorted(results, key=lambda v: v.scheduled_start)

    def get_active_visits(self) -> List[Visit]:
        """Get all currently active visits."""
        return [v for v in self._visits.values() if v.status == VisitStatus.CHECKED_IN]

    def get_todays_visits(self, location: Optional[str] = None) -> List[Visit]:
        """Get all visits scheduled for today."""
        today = datetime.utcnow().date()
        results = [
            v for v in self._visits.values()
            if v.scheduled_start.date() == today
        ]
        if location:
            results = [v for v in results if v.location == location]
        return sorted(results, key=lambda v: v.scheduled_start)

    # Recurring Visit CRUD
    def create_recurring_visit(self, recurring: RecurringVisit) -> RecurringVisit:
        """Create a recurring visit."""
        self._recurring_visits[recurring.id] = recurring
        return recurring

    def get_recurring_visit(self, recurring_id: str) -> Optional[RecurringVisit]:
        """Get a recurring visit by ID."""
        return self._recurring_visits.get(recurring_id)

    def update_recurring_visit(
        self, recurring_id: str, updates: Dict[str, Any]
    ) -> Optional[RecurringVisit]:
        """Update a recurring visit."""
        recurring = self._recurring_visits.get(recurring_id)
        if recurring:
            for key, value in updates.items():
                if hasattr(recurring, key):
                    setattr(recurring, key, value)
        return recurring

    def delete_recurring_visit(self, recurring_id: str) -> bool:
        """Delete a recurring visit."""
        if recurring_id in self._recurring_visits:
            del self._recurring_visits[recurring_id]
            return True
        return False

    def list_recurring_visits(
        self,
        visitor_id: Optional[str] = None,
        host_id: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> List[RecurringVisit]:
        """List recurring visits."""
        results = list(self._recurring_visits.values())

        if visitor_id:
            results = [r for r in results if r.visitor_id == visitor_id]
        if host_id:
            results = [r for r in results if r.host_id == host_id]
        if active is not None:
            results = [r for r in results if r.active == active]

        return results

    # Group Visit CRUD
    def create_group_visit(self, group: GroupVisit) -> GroupVisit:
        """Create a group visit."""
        self._group_visits[group.id] = group
        return group

    def get_group_visit(self, group_id: str) -> Optional[GroupVisit]:
        """Get a group visit by ID."""
        return self._group_visits.get(group_id)

    def update_group_visit(
        self, group_id: str, updates: Dict[str, Any]
    ) -> Optional[GroupVisit]:
        """Update a group visit."""
        group = self._group_visits.get(group_id)
        if group:
            for key, value in updates.items():
                if hasattr(group, key):
                    setattr(group, key, value)
        return group

    def delete_group_visit(self, group_id: str) -> bool:
        """Delete a group visit."""
        if group_id in self._group_visits:
            del self._group_visits[group_id]
            return True
        return False

    def list_group_visits(
        self,
        host_id: Optional[str] = None,
        status: Optional[VisitStatus] = None,
    ) -> List[GroupVisit]:
        """List group visits."""
        results = list(self._group_visits.values())

        if host_id:
            results = [g for g in results if g.host_id == host_id]
        if status:
            results = [g for g in results if g.status == status]

        return results

    # Badge CRUD
    def create_badge(self, badge: Badge) -> Badge:
        """Create a badge."""
        self._badges[badge.id] = badge
        return badge

    def get_badge(self, badge_id: str) -> Optional[Badge]:
        """Get a badge by ID."""
        return self._badges.get(badge_id)

    def get_badge_by_number(self, badge_number: str) -> Optional[Badge]:
        """Get a badge by badge number."""
        for badge in self._badges.values():
            if badge.badge_number == badge_number:
                return badge
        return None

    def update_badge(self, badge_id: str, updates: Dict[str, Any]) -> Optional[Badge]:
        """Update a badge."""
        badge = self._badges.get(badge_id)
        if badge:
            for key, value in updates.items():
                if hasattr(badge, key):
                    setattr(badge, key, value)
        return badge

    def delete_badge(self, badge_id: str) -> bool:
        """Delete a badge."""
        if badge_id in self._badges:
            del self._badges[badge_id]
            return True
        return False

    def list_badges(
        self,
        status: Optional[BadgeStatus] = None,
        badge_type: Optional[BadgeType] = None,
        visitor_id: Optional[str] = None,
    ) -> List[Badge]:
        """List badges with optional filters."""
        results = list(self._badges.values())

        if status:
            results = [b for b in results if b.status == status]
        if badge_type:
            results = [b for b in results if b.badge_type == badge_type]
        if visitor_id:
            results = [b for b in results if b.visitor_id == visitor_id]

        return results

    def get_available_badges(self, badge_type: Optional[BadgeType] = None) -> List[Badge]:
        """Get badges available for issue."""
        results = [
            b for b in self._badges.values()
            if b.status == BadgeStatus.RETURNED and b.visitor_id is None
        ]
        if badge_type:
            results = [b for b in results if b.badge_type == badge_type]
        return results

    # Agreement CRUD
    def create_agreement(self, agreement: Agreement) -> Agreement:
        """Create an agreement."""
        self._agreements[agreement.id] = agreement
        return agreement

    def get_agreement(self, agreement_id: str) -> Optional[Agreement]:
        """Get an agreement by ID."""
        return self._agreements.get(agreement_id)

    def update_agreement(
        self, agreement_id: str, updates: Dict[str, Any]
    ) -> Optional[Agreement]:
        """Update an agreement."""
        agreement = self._agreements.get(agreement_id)
        if agreement:
            for key, value in updates.items():
                if hasattr(agreement, key):
                    setattr(agreement, key, value)
            agreement.updated_at = datetime.utcnow()
        return agreement

    def delete_agreement(self, agreement_id: str) -> bool:
        """Delete an agreement."""
        if agreement_id in self._agreements:
            del self._agreements[agreement_id]
            return True
        return False

    def list_agreements(
        self,
        agreement_type: Optional[AgreementType] = None,
        active: Optional[bool] = None,
    ) -> List[Agreement]:
        """List agreements."""
        results = list(self._agreements.values())

        if agreement_type:
            results = [a for a in results if a.agreement_type == agreement_type]
        if active is not None:
            results = [a for a in results if a.active == active]

        return results

    def get_required_agreements(
        self,
        visitor_type: VisitorType,
        access_level: AccessLevel,
    ) -> List[Agreement]:
        """Get agreements required for a visitor type and access level."""
        results = []
        for agreement in self._agreements.values():
            if not agreement.active:
                continue
            if (
                not agreement.required_for_visitor_types
                or visitor_type in agreement.required_for_visitor_types
            ):
                if (
                    not agreement.required_for_access_levels
                    or access_level in agreement.required_for_access_levels
                ):
                    results.append(agreement)
        return results

    # Signed Agreement CRUD
    def create_signed_agreement(self, signed: SignedAgreement) -> SignedAgreement:
        """Create a signed agreement."""
        self._signed_agreements[signed.id] = signed
        return signed

    def get_signed_agreement(self, signed_id: str) -> Optional[SignedAgreement]:
        """Get a signed agreement by ID."""
        return self._signed_agreements.get(signed_id)

    def update_signed_agreement(
        self, signed_id: str, updates: Dict[str, Any]
    ) -> Optional[SignedAgreement]:
        """Update a signed agreement."""
        signed = self._signed_agreements.get(signed_id)
        if signed:
            for key, value in updates.items():
                if hasattr(signed, key):
                    setattr(signed, key, value)
        return signed

    def list_signed_agreements(
        self,
        visitor_id: Optional[str] = None,
        agreement_id: Optional[str] = None,
        status: Optional[AgreementStatus] = None,
    ) -> List[SignedAgreement]:
        """List signed agreements."""
        results = list(self._signed_agreements.values())

        if visitor_id:
            results = [s for s in results if s.visitor_id == visitor_id]
        if agreement_id:
            results = [s for s in results if s.agreement_id == agreement_id]
        if status:
            results = [s for s in results if s.status == status]

        return results

    def has_valid_agreement(self, visitor_id: str, agreement_id: str) -> bool:
        """Check if visitor has a valid signed agreement."""
        for signed in self._signed_agreements.values():
            if (
                signed.visitor_id == visitor_id
                and signed.agreement_id == agreement_id
                and signed.is_valid
            ):
                return True
        return False

    # Watchlist CRUD
    def create_watchlist_entry(self, entry: Watchlist) -> Watchlist:
        """Create a watchlist entry."""
        self._watchlist[entry.id] = entry
        return entry

    def get_watchlist_entry(self, entry_id: str) -> Optional[Watchlist]:
        """Get a watchlist entry by ID."""
        return self._watchlist.get(entry_id)

    def update_watchlist_entry(
        self, entry_id: str, updates: Dict[str, Any]
    ) -> Optional[Watchlist]:
        """Update a watchlist entry."""
        entry = self._watchlist.get(entry_id)
        if entry:
            for key, value in updates.items():
                if hasattr(entry, key):
                    setattr(entry, key, value)
        return entry

    def delete_watchlist_entry(self, entry_id: str) -> bool:
        """Delete a watchlist entry."""
        if entry_id in self._watchlist:
            del self._watchlist[entry_id]
            return True
        return False

    def list_watchlist(self, active: Optional[bool] = None) -> List[Watchlist]:
        """List watchlist entries."""
        results = list(self._watchlist.values())
        if active is not None:
            results = [w for w in results if w.active == active]
        return results

    def check_watchlist(
        self,
        visitor_id: Optional[str] = None,
        email: Optional[str] = None,
        name: Optional[str] = None,
    ) -> List[Watchlist]:
        """Check if visitor matches any watchlist entries."""
        matches = []
        for entry in self._watchlist.values():
            if not entry.active:
                continue
            if entry.expires_at and datetime.utcnow() > entry.expires_at:
                continue
            if visitor_id and entry.visitor_id == visitor_id:
                matches.append(entry)
            elif email and entry.email and entry.email.lower() == email.lower():
                matches.append(entry)
            elif name and entry.name and entry.name.lower() in name.lower():
                matches.append(entry)
        return matches

    # Notification CRUD
    def create_notification(self, notification: VisitorNotification) -> VisitorNotification:
        """Create a notification."""
        self._notifications[notification.id] = notification
        return notification

    def get_notification(self, notification_id: str) -> Optional[VisitorNotification]:
        """Get a notification by ID."""
        return self._notifications.get(notification_id)

    def update_notification(
        self, notification_id: str, updates: Dict[str, Any]
    ) -> Optional[VisitorNotification]:
        """Update a notification."""
        notification = self._notifications.get(notification_id)
        if notification:
            for key, value in updates.items():
                if hasattr(notification, key):
                    setattr(notification, key, value)
        return notification

    def list_notifications(
        self,
        visit_id: Optional[str] = None,
        recipient_id: Optional[str] = None,
        notification_type: Optional[NotificationType] = None,
        sent: Optional[bool] = None,
    ) -> List[VisitorNotification]:
        """List notifications."""
        results = list(self._notifications.values())

        if visit_id:
            results = [n for n in results if n.visit_id == visit_id]
        if recipient_id:
            results = [n for n in results if n.recipient_id == recipient_id]
        if notification_type:
            results = [n for n in results if n.notification_type == notification_type]
        if sent is not None:
            results = [n for n in results if n.sent == sent]

        return results

    # Location CRUD
    def create_location(self, location: Location) -> Location:
        """Create a location."""
        self._locations[location.id] = location
        return location

    def get_location(self, location_id: str) -> Optional[Location]:
        """Get a location by ID."""
        return self._locations.get(location_id)

    def update_location(
        self, location_id: str, updates: Dict[str, Any]
    ) -> Optional[Location]:
        """Update a location."""
        location = self._locations.get(location_id)
        if location:
            for key, value in updates.items():
                if hasattr(location, key):
                    setattr(location, key, value)
        return location

    def delete_location(self, location_id: str) -> bool:
        """Delete a location."""
        if location_id in self._locations:
            del self._locations[location_id]
            return True
        return False

    def list_locations(self, active: Optional[bool] = None) -> List[Location]:
        """List locations."""
        results = list(self._locations.values())
        if active is not None:
            results = [loc for loc in results if loc.active == active]
        return results

    # Analytics CRUD
    def create_analytics(self, analytics: VisitorAnalytics) -> VisitorAnalytics:
        """Create analytics record."""
        self._analytics[analytics.id] = analytics
        return analytics

    def get_analytics(self, analytics_id: str) -> Optional[VisitorAnalytics]:
        """Get analytics by ID."""
        return self._analytics.get(analytics_id)

    def list_analytics(
        self,
        location_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[VisitorAnalytics]:
        """List analytics records."""
        results = list(self._analytics.values())

        if location_id:
            results = [a for a in results if a.location_id == location_id]
        if start_date:
            results = [a for a in results if a.period_start >= start_date]
        if end_date:
            results = [a for a in results if a.period_end <= end_date]

        return sorted(results, key=lambda a: a.period_start)


# ============================================================
# Manager
# ============================================================

class VisitorManager:
    """High-level API for visitor management."""

    def __init__(self, registry: Optional[VisitorRegistry] = None) -> None:
        """Initialize the manager."""
        self.registry = registry or VisitorRegistry()
        self._notification_handler: Optional[Callable] = None

    def set_notification_handler(self, handler: Callable) -> None:
        """Set handler for sending notifications."""
        self._notification_handler = handler

    # Visitor Management
    def register_visitor(
        self,
        first_name: str,
        last_name: str,
        email: str,
        phone: Optional[str] = None,
        company: Optional[str] = None,
        visitor_type: VisitorType = VisitorType.GUEST,
        **kwargs: Any,
    ) -> Visitor:
        """Register a new visitor."""
        # Check if visitor already exists
        existing = self.registry.get_visitor_by_email(email)
        if existing:
            return existing

        visitor = Visitor(
            id=str(uuid.uuid4()),
            first_name=first_name,
            last_name=last_name,
            email=email,
            phone=phone,
            company=company,
            visitor_type=visitor_type,
            **kwargs,
        )
        return self.registry.create_visitor(visitor)

    def get_visitor(self, visitor_id: str) -> Optional[Visitor]:
        """Get a visitor by ID."""
        return self.registry.get_visitor(visitor_id)

    def get_visitor_by_email(self, email: str) -> Optional[Visitor]:
        """Get a visitor by email."""
        return self.registry.get_visitor_by_email(email)

    def update_visitor(
        self, visitor_id: str, updates: Dict[str, Any]
    ) -> Optional[Visitor]:
        """Update visitor information."""
        return self.registry.update_visitor(visitor_id, updates)

    def blacklist_visitor(
        self, visitor_id: str, reason: str, added_by: str
    ) -> Optional[Visitor]:
        """Add visitor to blacklist."""
        visitor = self.registry.update_visitor(
            visitor_id,
            {"blacklisted": True, "blacklist_reason": reason},
        )
        if visitor:
            # Also add to watchlist
            entry = Watchlist(
                id=str(uuid.uuid4()),
                visitor_id=visitor_id,
                reason=reason,
                severity="block",
                action="block",
                added_by=added_by,
            )
            self.registry.create_watchlist_entry(entry)
        return visitor

    def remove_from_blacklist(self, visitor_id: str) -> Optional[Visitor]:
        """Remove visitor from blacklist."""
        return self.registry.update_visitor(
            visitor_id,
            {"blacklisted": False, "blacklist_reason": None},
        )

    def mark_as_vip(self, visitor_id: str) -> Optional[Visitor]:
        """Mark visitor as VIP."""
        return self.registry.update_visitor(visitor_id, {"vip": True})

    def search_visitors(self, query: str) -> List[Visitor]:
        """Search visitors by name, email, or company."""
        return self.registry.list_visitors(search=query)

    def list_visitors(
        self,
        visitor_type: Optional[VisitorType] = None,
        company: Optional[str] = None,
        blacklisted: Optional[bool] = None,
        vip: Optional[bool] = None,
    ) -> List[Visitor]:
        """List visitors with filters."""
        return self.registry.list_visitors(
            visitor_type=visitor_type,
            company=company,
            blacklisted=blacklisted,
            vip=vip,
        )

    # Host Management
    def register_host(
        self,
        user_id: str,
        name: str,
        email: str,
        department: Optional[str] = None,
        location: Optional[str] = None,
        **kwargs: Any,
    ) -> Host:
        """Register a new host."""
        existing = self.registry.get_host_by_user_id(user_id)
        if existing:
            return existing

        host = Host(
            id=str(uuid.uuid4()),
            user_id=user_id,
            name=name,
            email=email,
            department=department,
            location=location,
            **kwargs,
        )
        return self.registry.create_host(host)

    def get_host(self, host_id: str) -> Optional[Host]:
        """Get a host by ID."""
        return self.registry.get_host(host_id)

    def get_host_by_user_id(self, user_id: str) -> Optional[Host]:
        """Get a host by user ID."""
        return self.registry.get_host_by_user_id(user_id)

    def update_host(self, host_id: str, updates: Dict[str, Any]) -> Optional[Host]:
        """Update host information."""
        return self.registry.update_host(host_id, updates)

    def list_hosts(
        self,
        department: Optional[str] = None,
        location: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> List[Host]:
        """List hosts."""
        return self.registry.list_hosts(
            department=department,
            location=location,
            active=active,
        )

    # Visit Management
    def schedule_visit(
        self,
        visitor_id: str,
        host_id: str,
        scheduled_start: datetime,
        purpose: VisitPurpose = VisitPurpose.MEETING,
        scheduled_end: Optional[datetime] = None,
        location: Optional[str] = None,
        access_level: AccessLevel = AccessLevel.ESCORTED,
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[Visit]:
        """Schedule a new visit."""
        visitor = self.registry.get_visitor(visitor_id)
        if not visitor:
            return None

        host = self.registry.get_host(host_id)
        if not host:
            return None

        # Check blacklist
        if visitor.blacklisted:
            return None

        # Check watchlist
        watchlist_matches = self.registry.check_watchlist(
            visitor_id=visitor_id,
            email=visitor.email,
            name=visitor.full_name,
        )
        approval_required = any(w.action == "require_approval" for w in watchlist_matches)
        blocked = any(w.action == "block" for w in watchlist_matches)

        if blocked:
            return None

        # Generate pre-registration code
        pre_reg_code = str(uuid.uuid4())[:8].upper()

        visit = Visit(
            id=str(uuid.uuid4()),
            visitor_id=visitor_id,
            host_id=host_id,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            purpose=purpose,
            location=location or host.location,
            access_level=access_level,
            approval_required=approval_required,
            status=VisitStatus.PENDING_APPROVAL if approval_required else VisitStatus.SCHEDULED,
            pre_registered=True,
            pre_registration_code=pre_reg_code,
            created_by=created_by,
            **kwargs,
        )
        visit = self.registry.create_visit(visit)

        # Send notifications
        self._send_notification(
            NotificationType.VISIT_SCHEDULED,
            visit_id=visit.id,
            visitor_id=visitor_id,
            recipient_id=host.user_id,
            recipient_email=host.email,
        )

        return visit

    def get_visit(self, visit_id: str) -> Optional[Visit]:
        """Get a visit by ID."""
        return self.registry.get_visit(visit_id)

    def update_visit(self, visit_id: str, updates: Dict[str, Any]) -> Optional[Visit]:
        """Update a visit."""
        return self.registry.update_visit(visit_id, updates)

    def cancel_visit(
        self, visit_id: str, reason: str, cancelled_by: str
    ) -> Optional[Visit]:
        """Cancel a scheduled visit."""
        visit = self.registry.get_visit(visit_id)
        if not visit:
            return None

        if visit.status not in [
            VisitStatus.SCHEDULED,
            VisitStatus.PENDING_APPROVAL,
            VisitStatus.APPROVED,
        ]:
            return None

        visit = self.registry.update_visit(
            visit_id,
            {
                "status": VisitStatus.CANCELLED,
                "cancellation_reason": reason,
                "cancelled_by": cancelled_by,
                "cancelled_at": datetime.utcnow(),
            },
        )

        # Notify host
        if visit:
            host = self.registry.get_host(visit.host_id)
            if host:
                self._send_notification(
                    NotificationType.VISIT_CANCELLED,
                    visit_id=visit_id,
                    recipient_id=host.user_id,
                    recipient_email=host.email,
                )

        return visit

    def approve_visit(self, visit_id: str, approved_by: str) -> Optional[Visit]:
        """Approve a pending visit."""
        visit = self.registry.get_visit(visit_id)
        if not visit or visit.status != VisitStatus.PENDING_APPROVAL:
            return None

        visit = self.registry.update_visit(
            visit_id,
            {
                "status": VisitStatus.APPROVED,
                "approved_by": approved_by,
                "approved_at": datetime.utcnow(),
            },
        )

        if visit:
            visitor = self.registry.get_visitor(visit.visitor_id)
            if visitor:
                self._send_notification(
                    NotificationType.APPROVAL_GRANTED,
                    visit_id=visit_id,
                    visitor_id=visit.visitor_id,
                    recipient_id=visit.visitor_id,
                    recipient_email=visitor.email,
                )

        return visit

    def reject_visit(
        self, visit_id: str, reason: str, rejected_by: str
    ) -> Optional[Visit]:
        """Reject a pending visit."""
        visit = self.registry.get_visit(visit_id)
        if not visit or visit.status != VisitStatus.PENDING_APPROVAL:
            return None

        visit = self.registry.update_visit(
            visit_id,
            {
                "status": VisitStatus.REJECTED,
                "rejection_reason": reason,
                "approved_by": rejected_by,
                "approved_at": datetime.utcnow(),
            },
        )

        if visit:
            visitor = self.registry.get_visitor(visit.visitor_id)
            if visitor:
                self._send_notification(
                    NotificationType.APPROVAL_DENIED,
                    visit_id=visit_id,
                    visitor_id=visit.visitor_id,
                    recipient_id=visit.visitor_id,
                    recipient_email=visitor.email,
                )

        return visit

    def check_in_visitor(
        self,
        visit_id: str,
        method: CheckInMethod = CheckInMethod.RECEPTION,
        badge_id: Optional[str] = None,
    ) -> Optional[Visit]:
        """Check in a visitor."""
        visit = self.registry.get_visit(visit_id)
        if not visit:
            return None

        if visit.status not in [VisitStatus.SCHEDULED, VisitStatus.APPROVED]:
            return None

        now = datetime.utcnow()
        updates: Dict[str, Any] = {
            "status": VisitStatus.CHECKED_IN,
            "actual_check_in": now,
            "check_in_method": method,
        }

        if badge_id:
            updates["badge_id"] = badge_id
            # Activate badge
            self.registry.update_badge(
                badge_id,
                {
                    "status": BadgeStatus.ACTIVE,
                    "visitor_id": visit.visitor_id,
                    "visit_id": visit_id,
                },
            )

        visit = self.registry.update_visit(visit_id, updates)

        # Update visitor stats
        visitor = self.registry.get_visitor(visit.visitor_id)
        if visitor:
            self.registry.update_visitor(
                visit.visitor_id,
                {
                    "total_visits": visitor.total_visits + 1,
                    "last_visit_date": now,
                },
            )

        # Notify host
        host = self.registry.get_host(visit.host_id)
        if host:
            self._send_notification(
                NotificationType.VISITOR_CHECKED_IN,
                visit_id=visit_id,
                visitor_id=visit.visitor_id,
                recipient_id=host.user_id,
                recipient_email=host.email,
            )

        return visit

    def check_out_visitor(
        self, visit_id: str, items_left_behind: Optional[List[str]] = None
    ) -> Optional[Visit]:
        """Check out a visitor."""
        visit = self.registry.get_visit(visit_id)
        if not visit or visit.status != VisitStatus.CHECKED_IN:
            return None

        updates: Dict[str, Any] = {
            "status": VisitStatus.CHECKED_OUT,
            "actual_check_out": datetime.utcnow(),
        }

        if items_left_behind:
            updates["items_left_behind"] = items_left_behind

        # Return badge
        if visit.badge_id:
            self.registry.update_badge(
                visit.badge_id,
                {
                    "status": BadgeStatus.RETURNED,
                    "returned_at": datetime.utcnow(),
                    "visitor_id": None,
                    "visit_id": None,
                },
            )

        visit = self.registry.update_visit(visit_id, updates)

        # Notify host
        if visit:
            host = self.registry.get_host(visit.host_id)
            if host:
                self._send_notification(
                    NotificationType.VISITOR_CHECKED_OUT,
                    visit_id=visit_id,
                    visitor_id=visit.visitor_id,
                    recipient_id=host.user_id,
                    recipient_email=host.email,
                )

        return visit

    def mark_no_show(self, visit_id: str) -> Optional[Visit]:
        """Mark a visit as no-show."""
        visit = self.registry.get_visit(visit_id)
        if not visit:
            return None

        if visit.status not in [VisitStatus.SCHEDULED, VisitStatus.APPROVED]:
            return None

        return self.registry.update_visit(
            visit_id, {"status": VisitStatus.NO_SHOW}
        )

    def list_visits(
        self,
        visitor_id: Optional[str] = None,
        host_id: Optional[str] = None,
        status: Optional[VisitStatus] = None,
        purpose: Optional[VisitPurpose] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[Visit]:
        """List visits with filters."""
        return self.registry.list_visits(
            visitor_id=visitor_id,
            host_id=host_id,
            status=status,
            purpose=purpose,
            start_date=start_date,
            end_date=end_date,
        )

    def get_todays_visits(self, location: Optional[str] = None) -> List[Visit]:
        """Get all visits scheduled for today."""
        return self.registry.get_todays_visits(location=location)

    def get_active_visits(self) -> List[Visit]:
        """Get all currently active visits."""
        return self.registry.get_active_visits()

    def get_pending_approvals(self, host_id: Optional[str] = None) -> List[Visit]:
        """Get visits pending approval."""
        visits = self.registry.list_visits(status=VisitStatus.PENDING_APPROVAL)
        if host_id:
            visits = [v for v in visits if v.host_id == host_id]
        return visits

    # Recurring Visit Management
    def create_recurring_visit(
        self,
        visitor_id: str,
        host_id: str,
        purpose: VisitPurpose,
        recurrence_pattern: str,
        days_of_week: List[int],
        start_time: str,
        end_time: str,
        start_date: datetime,
        end_date: Optional[datetime] = None,
        access_level: AccessLevel = AccessLevel.STANDARD,
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[RecurringVisit]:
        """Create a recurring visit schedule."""
        visitor = self.registry.get_visitor(visitor_id)
        host = self.registry.get_host(host_id)

        if not visitor or not host:
            return None

        recurring = RecurringVisit(
            id=str(uuid.uuid4()),
            visitor_id=visitor_id,
            host_id=host_id,
            purpose=purpose,
            recurrence_pattern=recurrence_pattern,
            days_of_week=days_of_week,
            start_time=start_time,
            end_time=end_time,
            start_date=start_date,
            end_date=end_date,
            access_level=access_level,
            created_by=created_by,
            **kwargs,
        )
        return self.registry.create_recurring_visit(recurring)

    def get_recurring_visit(self, recurring_id: str) -> Optional[RecurringVisit]:
        """Get a recurring visit."""
        return self.registry.get_recurring_visit(recurring_id)

    def cancel_recurring_visit(self, recurring_id: str) -> Optional[RecurringVisit]:
        """Cancel a recurring visit."""
        return self.registry.update_recurring_visit(recurring_id, {"active": False})

    def list_recurring_visits(
        self,
        visitor_id: Optional[str] = None,
        host_id: Optional[str] = None,
        active: Optional[bool] = None,
    ) -> List[RecurringVisit]:
        """List recurring visits."""
        return self.registry.list_recurring_visits(
            visitor_id=visitor_id,
            host_id=host_id,
            active=active,
        )

    # Group Visit Management
    def create_group_visit(
        self,
        name: str,
        host_id: str,
        purpose: VisitPurpose,
        scheduled_start: datetime,
        visitor_ids: List[str],
        scheduled_end: Optional[datetime] = None,
        location: Optional[str] = None,
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[GroupVisit]:
        """Create a group visit."""
        host = self.registry.get_host(host_id)
        if not host:
            return None

        # Validate all visitors exist
        for vid in visitor_ids:
            if not self.registry.get_visitor(vid):
                return None

        group = GroupVisit(
            id=str(uuid.uuid4()),
            name=name,
            host_id=host_id,
            purpose=purpose,
            scheduled_start=scheduled_start,
            scheduled_end=scheduled_end,
            visitor_ids=visitor_ids,
            location=location or host.location,
            created_by=created_by,
            **kwargs,
        )
        group = self.registry.create_group_visit(group)

        # Create individual visits for each visitor
        for visitor_id in visitor_ids:
            self.schedule_visit(
                visitor_id=visitor_id,
                host_id=host_id,
                scheduled_start=scheduled_start,
                scheduled_end=scheduled_end,
                purpose=purpose,
                location=group.location,
                access_level=group.access_level,
                created_by=created_by,
                group_visit_id=group.id,
            )

        return group

    def get_group_visit(self, group_id: str) -> Optional[GroupVisit]:
        """Get a group visit."""
        return self.registry.get_group_visit(group_id)

    def add_to_group_visit(self, group_id: str, visitor_id: str) -> Optional[GroupVisit]:
        """Add a visitor to a group visit."""
        group = self.registry.get_group_visit(group_id)
        if not group:
            return None

        if visitor_id in group.visitor_ids:
            return group

        if group.max_group_size and len(group.visitor_ids) >= group.max_group_size:
            return None

        group.visitor_ids.append(visitor_id)
        self.registry.update_group_visit(group_id, {"visitor_ids": group.visitor_ids})

        # Create individual visit
        self.schedule_visit(
            visitor_id=visitor_id,
            host_id=group.host_id,
            scheduled_start=group.scheduled_start,
            scheduled_end=group.scheduled_end,
            purpose=group.purpose,
            location=group.location,
            access_level=group.access_level,
            group_visit_id=group_id,
        )

        return group

    def list_group_visits(
        self,
        host_id: Optional[str] = None,
        status: Optional[VisitStatus] = None,
    ) -> List[GroupVisit]:
        """List group visits."""
        return self.registry.list_group_visits(host_id=host_id, status=status)

    # Badge Management
    def create_badge(
        self,
        badge_number: str,
        badge_type: BadgeType = BadgeType.TEMPORARY,
        access_level: AccessLevel = AccessLevel.ESCORTED,
        access_zones: Optional[List[str]] = None,
        **kwargs: Any,
    ) -> Badge:
        """Create a new badge."""
        badge = Badge(
            id=str(uuid.uuid4()),
            badge_number=badge_number,
            badge_type=badge_type,
            status=BadgeStatus.RETURNED,  # Available for issue
            access_level=access_level,
            access_zones=access_zones or [],
            **kwargs,
        )
        return self.registry.create_badge(badge)

    def issue_badge(
        self,
        badge_id: str,
        visitor_id: str,
        visit_id: str,
        issued_by: str,
        expires_at: Optional[datetime] = None,
    ) -> Optional[Badge]:
        """Issue a badge to a visitor."""
        badge = self.registry.get_badge(badge_id)
        if not badge or badge.status != BadgeStatus.RETURNED:
            return None

        if not expires_at:
            expires_at = datetime.utcnow() + timedelta(hours=12)

        return self.registry.update_badge(
            badge_id,
            {
                "status": BadgeStatus.ISSUED,
                "visitor_id": visitor_id,
                "visit_id": visit_id,
                "issued_at": datetime.utcnow(),
                "issued_by": issued_by,
                "expires_at": expires_at,
            },
        )

    def return_badge(
        self, badge_id: str, returned_to: Optional[str] = None
    ) -> Optional[Badge]:
        """Return a badge."""
        badge = self.registry.get_badge(badge_id)
        if not badge:
            return None

        return self.registry.update_badge(
            badge_id,
            {
                "status": BadgeStatus.RETURNED,
                "visitor_id": None,
                "visit_id": None,
                "returned_at": datetime.utcnow(),
                "returned_to": returned_to,
            },
        )

    def report_badge_lost(self, badge_id: str) -> Optional[Badge]:
        """Report a badge as lost."""
        return self.registry.update_badge(
            badge_id,
            {
                "status": BadgeStatus.LOST,
            },
        )

    def get_badge(self, badge_id: str) -> Optional[Badge]:
        """Get a badge by ID."""
        return self.registry.get_badge(badge_id)

    def get_badge_by_number(self, badge_number: str) -> Optional[Badge]:
        """Get a badge by number."""
        return self.registry.get_badge_by_number(badge_number)

    def list_badges(
        self,
        status: Optional[BadgeStatus] = None,
        badge_type: Optional[BadgeType] = None,
    ) -> List[Badge]:
        """List badges."""
        return self.registry.list_badges(status=status, badge_type=badge_type)

    def get_available_badges(
        self, badge_type: Optional[BadgeType] = None
    ) -> List[Badge]:
        """Get available badges for issue."""
        return self.registry.get_available_badges(badge_type=badge_type)

    # Agreement Management
    def create_agreement(
        self,
        agreement_type: AgreementType,
        title: str,
        content: str,
        version: str = "1.0",
        required_for_visitor_types: Optional[List[VisitorType]] = None,
        required_for_access_levels: Optional[List[AccessLevel]] = None,
        expires_after_days: Optional[int] = None,
        **kwargs: Any,
    ) -> Agreement:
        """Create a new agreement."""
        agreement = Agreement(
            id=str(uuid.uuid4()),
            agreement_type=agreement_type,
            title=title,
            content=content,
            version=version,
            required_for_visitor_types=required_for_visitor_types or [],
            required_for_access_levels=required_for_access_levels or [],
            expires_after_days=expires_after_days,
            **kwargs,
        )
        return self.registry.create_agreement(agreement)

    def get_agreement(self, agreement_id: str) -> Optional[Agreement]:
        """Get an agreement by ID."""
        return self.registry.get_agreement(agreement_id)

    def list_agreements(
        self,
        agreement_type: Optional[AgreementType] = None,
        active: Optional[bool] = None,
    ) -> List[Agreement]:
        """List agreements."""
        return self.registry.list_agreements(
            agreement_type=agreement_type, active=active
        )

    def get_required_agreements(
        self, visitor_type: VisitorType, access_level: AccessLevel
    ) -> List[Agreement]:
        """Get required agreements for a visitor."""
        return self.registry.get_required_agreements(visitor_type, access_level)

    def sign_agreement(
        self,
        agreement_id: str,
        visitor_id: str,
        visit_id: Optional[str] = None,
        signature_data: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> Optional[SignedAgreement]:
        """Sign an agreement."""
        agreement = self.registry.get_agreement(agreement_id)
        if not agreement or not agreement.active:
            return None

        visitor = self.registry.get_visitor(visitor_id)
        if not visitor:
            return None

        expires_at = None
        if agreement.expires_after_days:
            expires_at = datetime.utcnow() + timedelta(days=agreement.expires_after_days)

        signed = SignedAgreement(
            id=str(uuid.uuid4()),
            agreement_id=agreement_id,
            visitor_id=visitor_id,
            visit_id=visit_id,
            status=AgreementStatus.SIGNED,
            signed_at=datetime.utcnow(),
            signature_data=signature_data,
            ip_address=ip_address,
            expires_at=expires_at,
        )
        return self.registry.create_signed_agreement(signed)

    def decline_agreement(
        self, agreement_id: str, visitor_id: str
    ) -> Optional[SignedAgreement]:
        """Decline an agreement."""
        signed = SignedAgreement(
            id=str(uuid.uuid4()),
            agreement_id=agreement_id,
            visitor_id=visitor_id,
            status=AgreementStatus.DECLINED,
        )
        return self.registry.create_signed_agreement(signed)

    def has_valid_agreement(self, visitor_id: str, agreement_id: str) -> bool:
        """Check if visitor has valid signed agreement."""
        return self.registry.has_valid_agreement(visitor_id, agreement_id)

    def get_missing_agreements(
        self, visitor_id: str, visitor_type: VisitorType, access_level: AccessLevel
    ) -> List[Agreement]:
        """Get agreements visitor still needs to sign."""
        required = self.registry.get_required_agreements(visitor_type, access_level)
        missing = []
        for agreement in required:
            if not self.registry.has_valid_agreement(visitor_id, agreement.id):
                missing.append(agreement)
        return missing

    # Watchlist Management
    def add_to_watchlist(
        self,
        reason: str,
        severity: str,
        action: str,
        added_by: str,
        visitor_id: Optional[str] = None,
        email: Optional[str] = None,
        name: Optional[str] = None,
        notify_users: Optional[List[str]] = None,
        expires_at: Optional[datetime] = None,
        **kwargs: Any,
    ) -> Watchlist:
        """Add entry to watchlist."""
        entry = Watchlist(
            id=str(uuid.uuid4()),
            visitor_id=visitor_id,
            email=email,
            name=name,
            reason=reason,
            severity=severity,
            action=action,
            added_by=added_by,
            notify_users=notify_users or [],
            expires_at=expires_at,
            **kwargs,
        )
        return self.registry.create_watchlist_entry(entry)

    def remove_from_watchlist(self, entry_id: str) -> bool:
        """Remove entry from watchlist."""
        return self.registry.delete_watchlist_entry(entry_id)

    def check_watchlist(
        self,
        visitor_id: Optional[str] = None,
        email: Optional[str] = None,
        name: Optional[str] = None,
    ) -> List[Watchlist]:
        """Check if visitor matches watchlist."""
        return self.registry.check_watchlist(
            visitor_id=visitor_id, email=email, name=name
        )

    def list_watchlist(self, active: Optional[bool] = None) -> List[Watchlist]:
        """List watchlist entries."""
        return self.registry.list_watchlist(active=active)

    # Location Management
    def create_location(
        self,
        name: str,
        building: Optional[str] = None,
        address: Optional[str] = None,
        **kwargs: Any,
    ) -> Location:
        """Create a new location."""
        location = Location(
            id=str(uuid.uuid4()),
            name=name,
            building=building,
            address=address,
            **kwargs,
        )
        return self.registry.create_location(location)

    def get_location(self, location_id: str) -> Optional[Location]:
        """Get a location by ID."""
        return self.registry.get_location(location_id)

    def update_location(
        self, location_id: str, updates: Dict[str, Any]
    ) -> Optional[Location]:
        """Update a location."""
        return self.registry.update_location(location_id, updates)

    def list_locations(self, active: Optional[bool] = None) -> List[Location]:
        """List locations."""
        return self.registry.list_locations(active=active)

    # Analytics
    def generate_analytics(
        self,
        period_start: datetime,
        period_end: datetime,
        location_id: Optional[str] = None,
    ) -> VisitorAnalytics:
        """Generate analytics for a period."""
        visits = self.registry.list_visits(
            start_date=period_start,
            end_date=period_end,
            location=location_id,
        )

        visitor_ids = set()
        check_ins = 0
        no_shows = 0
        total_duration = 0
        duration_count = 0
        visits_by_type: Dict[str, int] = {}
        visits_by_purpose: Dict[str, int] = {}
        visits_by_day: Dict[str, int] = {}
        visits_by_hour: Dict[int, int] = {}

        for visit in visits:
            visitor_ids.add(visit.visitor_id)

            if visit.status == VisitStatus.CHECKED_OUT:
                check_ins += 1
                if visit.duration_minutes:
                    total_duration += visit.duration_minutes
                    duration_count += 1
            elif visit.status == VisitStatus.CHECKED_IN:
                check_ins += 1
            elif visit.status == VisitStatus.NO_SHOW:
                no_shows += 1

            # Count by purpose
            purpose_key = visit.purpose.value
            visits_by_purpose[purpose_key] = visits_by_purpose.get(purpose_key, 0) + 1

            # Count by day
            day_key = visit.scheduled_start.strftime("%A")
            visits_by_day[day_key] = visits_by_day.get(day_key, 0) + 1

            # Count by hour
            hour = visit.scheduled_start.hour
            visits_by_hour[hour] = visits_by_hour.get(hour, 0) + 1

        # Count visits by visitor type
        for vid in visitor_ids:
            visitor = self.registry.get_visitor(vid)
            if visitor:
                type_key = visitor.visitor_type.value
                visits_by_type[type_key] = visits_by_type.get(type_key, 0) + 1

        # Find peak hour and day
        peak_hour = max(visits_by_hour.keys(), key=lambda h: visits_by_hour[h]) if visits_by_hour else None
        peak_day = max(visits_by_day.keys(), key=lambda d: visits_by_day[d]) if visits_by_day else None

        # Count badges
        badges = self.registry.list_badges()
        badges_issued = sum(1 for b in badges if b.issued_at >= period_start)
        badges_lost = sum(1 for b in badges if b.status == BadgeStatus.LOST)

        # Count agreements
        signed_list = self.registry.list_signed_agreements(status=AgreementStatus.SIGNED)
        signed_in_period = [
            s for s in signed_list
            if s.signed_at and s.signed_at >= period_start and s.signed_at <= period_end
        ]
        declined_list = self.registry.list_signed_agreements(status=AgreementStatus.DECLINED)
        declined_in_period = [
            s for s in declined_list
            if s.created_at >= period_start and s.created_at <= period_end
        ]

        analytics = VisitorAnalytics(
            id=str(uuid.uuid4()),
            period_start=period_start,
            period_end=period_end,
            location_id=location_id,
            total_visits=len(visits),
            unique_visitors=len(visitor_ids),
            check_ins=check_ins,
            no_shows=no_shows,
            average_visit_duration_minutes=(
                total_duration / duration_count if duration_count > 0 else 0.0
            ),
            visits_by_type=visits_by_type,
            visits_by_purpose=visits_by_purpose,
            visits_by_day=visits_by_day,
            visits_by_hour=visits_by_hour,
            peak_hour=peak_hour,
            peak_day=peak_day,
            badges_issued=badges_issued,
            badges_lost=badges_lost,
            agreements_signed=len(signed_in_period),
            agreements_declined=len(declined_in_period),
        )
        return self.registry.create_analytics(analytics)

    def get_visitor_history(self, visitor_id: str) -> Dict[str, Any]:
        """Get complete visit history for a visitor."""
        visitor = self.registry.get_visitor(visitor_id)
        if not visitor:
            return {}

        visits = self.registry.list_visits(visitor_id=visitor_id)
        signed = self.registry.list_signed_agreements(visitor_id=visitor_id)

        return {
            "visitor": visitor.to_dict(),
            "total_visits": len(visits),
            "visits": [v.to_dict() for v in visits],
            "agreements_signed": len([s for s in signed if s.status == AgreementStatus.SIGNED]),
            "last_visit": visits[-1].to_dict() if visits else None,
        }

    # Notification Helper
    def _send_notification(
        self,
        notification_type: NotificationType,
        visit_id: Optional[str] = None,
        visitor_id: Optional[str] = None,
        recipient_id: str = "",
        recipient_email: Optional[str] = None,
        channel: str = "email",
    ) -> Optional[VisitorNotification]:
        """Send a notification."""
        notification = VisitorNotification(
            id=str(uuid.uuid4()),
            notification_type=notification_type,
            visit_id=visit_id,
            visitor_id=visitor_id,
            recipient_id=recipient_id,
            recipient_email=recipient_email,
            channel=channel,
        )
        notification = self.registry.create_notification(notification)

        if self._notification_handler:
            try:
                self._notification_handler(notification)
                notification.sent = True
                notification.sent_at = datetime.utcnow()
            except Exception as e:
                notification.error = str(e)
            self.registry.update_notification(notification.id, {
                "sent": notification.sent,
                "sent_at": notification.sent_at,
                "error": notification.error,
            })

        return notification


# ============================================================
# Global Instance
# ============================================================

_visitor_manager: Optional[VisitorManager] = None


def get_visitor_manager() -> VisitorManager:
    """Get the global visitor manager instance."""
    global _visitor_manager
    if _visitor_manager is None:
        _visitor_manager = VisitorManager()
    return _visitor_manager


def set_visitor_manager(manager: VisitorManager) -> None:
    """Set the global visitor manager instance."""
    global _visitor_manager
    _visitor_manager = manager


def reset_visitor_manager() -> None:
    """Reset the global visitor manager instance."""
    global _visitor_manager
    _visitor_manager = None
