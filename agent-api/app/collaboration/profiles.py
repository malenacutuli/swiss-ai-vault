"""
User Profiles & Directory Module

Implements user profile and directory functionality with:
- Detailed user profiles with contact information
- Skills and expertise tracking with endorsements
- Availability and status management
- Organization directory and org chart
- User preferences and settings
- Profile verification and badges
- Profile search and discovery
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, time
from enum import Enum
from typing import Any, Callable, Dict, List, Optional, Set, Tuple
import time as time_module
import hashlib


# ==================== Enums ====================

class ProfileStatus(Enum):
    """Profile status."""
    ACTIVE = "active"
    INACTIVE = "inactive"
    SUSPENDED = "suspended"
    PENDING = "pending"


class PresenceStatus(Enum):
    """User presence/availability status."""
    ONLINE = "online"
    AWAY = "away"
    BUSY = "busy"
    DO_NOT_DISTURB = "do_not_disturb"
    OFFLINE = "offline"
    INVISIBLE = "invisible"


class AvailabilityType(Enum):
    """Types of availability."""
    AVAILABLE = "available"
    BUSY = "busy"
    OUT_OF_OFFICE = "out_of_office"
    VACATION = "vacation"
    SICK_LEAVE = "sick_leave"
    MEETING = "meeting"
    FOCUS_TIME = "focus_time"


class SkillLevel(Enum):
    """Skill proficiency levels."""
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    EXPERT = "expert"


class BadgeType(Enum):
    """Types of profile badges."""
    VERIFIED = "verified"
    EMPLOYEE = "employee"
    CONTRACTOR = "contractor"
    ADMIN = "admin"
    FOUNDING_MEMBER = "founding_member"
    TOP_CONTRIBUTOR = "top_contributor"
    MENTOR = "mentor"
    CERTIFIED = "certified"


class ContactType(Enum):
    """Types of contact information."""
    EMAIL = "email"
    PHONE = "phone"
    MOBILE = "mobile"
    SLACK = "slack"
    TEAMS = "teams"
    DISCORD = "discord"
    LINKEDIN = "linkedin"
    TWITTER = "twitter"
    GITHUB = "github"
    WEBSITE = "website"
    OTHER = "other"


class RelationshipType(Enum):
    """Types of organizational relationships."""
    REPORTS_TO = "reports_to"
    MANAGES = "manages"
    WORKS_WITH = "works_with"
    MENTORS = "mentors"
    MENTORED_BY = "mentored_by"


# ==================== Data Classes ====================

@dataclass
class ContactInfo:
    """Contact information entry."""
    type: ContactType
    value: str
    label: Optional[str] = None
    is_primary: bool = False
    is_verified: bool = False
    is_public: bool = True


@dataclass
class Skill:
    """A skill or expertise."""
    id: str
    user_id: str
    name: str
    category: str = ""
    level: SkillLevel = SkillLevel.INTERMEDIATE
    years_experience: float = 0.0
    endorsement_count: int = 0
    endorser_ids: Set[str] = field(default_factory=set)
    is_verified: bool = False
    verified_by: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def add_endorsement(self, endorser_id: str) -> bool:
        """Add an endorsement for this skill."""
        if endorser_id in self.endorser_ids or endorser_id == self.user_id:
            return False

        self.endorser_ids.add(endorser_id)
        self.endorsement_count = len(self.endorser_ids)
        self.updated_at = datetime.utcnow()
        return True

    def remove_endorsement(self, endorser_id: str) -> bool:
        """Remove an endorsement."""
        if endorser_id not in self.endorser_ids:
            return False

        self.endorser_ids.discard(endorser_id)
        self.endorsement_count = len(self.endorser_ids)
        self.updated_at = datetime.utcnow()
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "category": self.category,
            "level": self.level.value,
            "years_experience": self.years_experience,
            "endorsement_count": self.endorsement_count,
            "is_verified": self.is_verified,
        }


@dataclass
class Badge:
    """A profile badge."""
    id: str
    user_id: str
    type: BadgeType
    name: str
    description: str = ""
    icon: Optional[str] = None
    color: Optional[str] = None
    awarded_at: datetime = field(default_factory=datetime.utcnow)
    awarded_by: Optional[str] = None
    expires_at: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        """Check if badge is expired."""
        if not self.expires_at:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_valid(self) -> bool:
        """Check if badge is valid."""
        return not self.is_expired


@dataclass
class WorkingHours:
    """Working hours configuration."""
    timezone: str = "UTC"
    monday: Optional[Tuple[time, time]] = None
    tuesday: Optional[Tuple[time, time]] = None
    wednesday: Optional[Tuple[time, time]] = None
    thursday: Optional[Tuple[time, time]] = None
    friday: Optional[Tuple[time, time]] = None
    saturday: Optional[Tuple[time, time]] = None
    sunday: Optional[Tuple[time, time]] = None

    def get_hours_for_day(self, day: int) -> Optional[Tuple[time, time]]:
        """Get working hours for a day (0=Monday, 6=Sunday)."""
        days = [
            self.monday, self.tuesday, self.wednesday,
            self.thursday, self.friday, self.saturday, self.sunday
        ]
        if 0 <= day < 7:
            return days[day]
        return None

    def is_working_day(self, day: int) -> bool:
        """Check if a day is a working day."""
        return self.get_hours_for_day(day) is not None


@dataclass
class AvailabilityBlock:
    """A block of availability/unavailability."""
    id: str
    user_id: str
    type: AvailabilityType
    title: str = ""
    start_time: datetime = field(default_factory=datetime.utcnow)
    end_time: Optional[datetime] = None
    is_recurring: bool = False
    recurrence_rule: Optional[str] = None  # iCal RRULE format
    notes: str = ""
    is_public: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_active(self) -> bool:
        """Check if block is currently active."""
        now = datetime.utcnow()
        if now < self.start_time:
            return False
        if self.end_time and now > self.end_time:
            return False
        return True

    @property
    def duration_hours(self) -> Optional[float]:
        """Get duration in hours."""
        if not self.end_time:
            return None
        delta = self.end_time - self.start_time
        return delta.total_seconds() / 3600


@dataclass
class UserPresence:
    """User presence information."""
    user_id: str
    status: PresenceStatus = PresenceStatus.OFFLINE
    status_text: str = ""
    status_emoji: Optional[str] = None
    status_expires_at: Optional[datetime] = None
    last_seen_at: Optional[datetime] = None
    current_activity: Optional[str] = None
    device: Optional[str] = None
    location: Optional[str] = None
    updated_at: datetime = field(default_factory=datetime.utcnow)

    def set_status(
        self,
        status: PresenceStatus,
        text: str = "",
        emoji: Optional[str] = None,
        expires_in_minutes: Optional[int] = None
    ) -> None:
        """Set presence status."""
        self.status = status
        self.status_text = text
        self.status_emoji = emoji
        self.updated_at = datetime.utcnow()

        if expires_in_minutes:
            self.status_expires_at = datetime.utcnow() + timedelta(minutes=expires_in_minutes)
        else:
            self.status_expires_at = None

    def clear_status(self) -> None:
        """Clear custom status."""
        self.status_text = ""
        self.status_emoji = None
        self.status_expires_at = None
        self.updated_at = datetime.utcnow()

    def update_last_seen(self) -> None:
        """Update last seen timestamp."""
        self.last_seen_at = datetime.utcnow()

    @property
    def is_status_expired(self) -> bool:
        """Check if status has expired."""
        if not self.status_expires_at:
            return False
        return datetime.utcnow() > self.status_expires_at

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "user_id": self.user_id,
            "status": self.status.value,
            "status_text": self.status_text,
            "status_emoji": self.status_emoji,
            "last_seen_at": self.last_seen_at.isoformat() if self.last_seen_at else None,
        }


@dataclass
class OrgRelationship:
    """Organizational relationship between users."""
    id: str
    from_user_id: str
    to_user_id: str
    type: RelationshipType
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProfilePreferences:
    """User profile preferences."""
    # Visibility settings
    show_email: bool = True
    show_phone: bool = False
    show_location: bool = True
    show_availability: bool = True
    show_skills: bool = True
    show_badges: bool = True

    # Notification preferences
    email_notifications: bool = True
    push_notifications: bool = True
    mention_notifications: bool = True
    digest_frequency: str = "daily"

    # Display preferences
    theme: str = "system"
    language: str = "en"
    date_format: str = "YYYY-MM-DD"
    time_format: str = "24h"
    first_day_of_week: int = 1  # 1=Monday, 0=Sunday

    # Privacy
    profile_visibility: str = "workspace"  # public, workspace, private
    allow_messages_from: str = "anyone"  # anyone, workspace, contacts
    show_online_status: bool = True


@dataclass
class UserProfile:
    """A user profile."""
    id: str
    user_id: str
    status: ProfileStatus = ProfileStatus.ACTIVE

    # Basic info
    display_name: str = ""
    first_name: str = ""
    last_name: str = ""
    pronouns: Optional[str] = None
    bio: str = ""
    headline: str = ""

    # Contact
    email: Optional[str] = None
    phone: Optional[str] = None
    contacts: List[ContactInfo] = field(default_factory=list)

    # Avatar/media
    avatar_url: Optional[str] = None
    cover_image_url: Optional[str] = None

    # Location
    location: Optional[str] = None
    timezone: str = "UTC"
    country: Optional[str] = None
    city: Optional[str] = None

    # Organization
    workspace_id: Optional[str] = None
    department: Optional[str] = None
    title: Optional[str] = None
    employee_id: Optional[str] = None
    start_date: Optional[datetime] = None
    manager_id: Optional[str] = None

    # Working hours
    working_hours: WorkingHours = field(default_factory=WorkingHours)

    # Preferences
    preferences: ProfilePreferences = field(default_factory=ProfilePreferences)

    # Skills and badges (IDs)
    skill_ids: Set[str] = field(default_factory=set)
    badge_ids: Set[str] = field(default_factory=set)

    # Social
    followers_count: int = 0
    following_count: int = 0

    # Timestamps
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    last_active_at: Optional[datetime] = None

    # Verification
    is_verified: bool = False
    verified_at: Optional[datetime] = None

    # Custom fields
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def full_name(self) -> str:
        """Get full name."""
        if self.first_name and self.last_name:
            return f"{self.first_name} {self.last_name}"
        return self.display_name or self.first_name or self.last_name or ""

    @property
    def initials(self) -> str:
        """Get initials."""
        if self.first_name and self.last_name:
            return f"{self.first_name[0]}{self.last_name[0]}".upper()
        if self.display_name:
            parts = self.display_name.split()
            if len(parts) >= 2:
                return f"{parts[0][0]}{parts[1][0]}".upper()
            return self.display_name[0].upper()
        return "?"

    def add_contact(self, contact: ContactInfo) -> None:
        """Add contact information."""
        # If primary, clear other primaries of same type
        if contact.is_primary:
            for c in self.contacts:
                if c.type == contact.type:
                    c.is_primary = False

        self.contacts.append(contact)
        self.updated_at = datetime.utcnow()

    def get_primary_contact(self, contact_type: ContactType) -> Optional[ContactInfo]:
        """Get primary contact of a type."""
        for contact in self.contacts:
            if contact.type == contact_type and contact.is_primary:
                return contact
        # Return first of type if no primary
        for contact in self.contacts:
            if contact.type == contact_type:
                return contact
        return None

    def update_activity(self) -> None:
        """Update last active timestamp."""
        self.last_active_at = datetime.utcnow()

    def verify(self) -> None:
        """Mark profile as verified."""
        self.is_verified = True
        self.verified_at = datetime.utcnow()
        self.updated_at = datetime.utcnow()

    def to_dict(self, include_private: bool = False) -> Dict[str, Any]:
        """Convert to dictionary."""
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "display_name": self.display_name,
            "full_name": self.full_name,
            "initials": self.initials,
            "headline": self.headline,
            "avatar_url": self.avatar_url,
            "location": self.location if self.preferences.show_location else None,
            "timezone": self.timezone,
            "department": self.department,
            "title": self.title,
            "is_verified": self.is_verified,
            "created_at": self.created_at.isoformat(),
        }

        if include_private:
            data.update({
                "email": self.email,
                "phone": self.phone,
                "bio": self.bio,
                "first_name": self.first_name,
                "last_name": self.last_name,
            })

        return data


@dataclass
class DirectoryEntry:
    """An entry in the organization directory."""
    user_id: str
    profile_id: str
    display_name: str
    email: Optional[str] = None
    avatar_url: Optional[str] = None
    title: Optional[str] = None
    department: Optional[str] = None
    location: Optional[str] = None
    manager_id: Optional[str] = None
    direct_reports: Set[str] = field(default_factory=set)
    team_ids: Set[str] = field(default_factory=set)
    is_active: bool = True


# ==================== Profile Registry ====================

class ProfileRegistry:
    """Central registry for managing user profiles."""

    _counter: int = 0

    def __init__(self):
        self._profiles: Dict[str, UserProfile] = {}
        self._skills: Dict[str, Skill] = {}
        self._badges: Dict[str, Badge] = {}
        self._presence: Dict[str, UserPresence] = {}
        self._availability: Dict[str, AvailabilityBlock] = {}
        self._relationships: Dict[str, OrgRelationship] = {}

        # Indexes
        self._user_to_profile: Dict[str, str] = {}  # user_id -> profile_id
        self._user_skills: Dict[str, Set[str]] = {}  # user_id -> skill_ids
        self._user_badges: Dict[str, Set[str]] = {}  # user_id -> badge_ids
        self._user_availability: Dict[str, Set[str]] = {}  # user_id -> availability_ids
        self._workspace_profiles: Dict[str, Set[str]] = {}  # workspace_id -> profile_ids
        self._skill_name_index: Dict[str, Set[str]] = {}  # skill_name -> skill_ids

    # Profile operations
    def create_profile(
        self,
        user_id: str,
        workspace_id: Optional[str] = None,
        **kwargs
    ) -> UserProfile:
        """Create a new user profile."""
        # Check if profile already exists
        if user_id in self._user_to_profile:
            existing = self._profiles.get(self._user_to_profile[user_id])
            if existing:
                return existing

        ProfileRegistry._counter += 1
        profile_id = f"profile_{int(time_module.time() * 1000)}_{ProfileRegistry._counter}"

        profile = UserProfile(
            id=profile_id,
            user_id=user_id,
            workspace_id=workspace_id,
            **kwargs
        )

        self._profiles[profile_id] = profile
        self._user_to_profile[user_id] = profile_id

        # Index by workspace
        if workspace_id:
            if workspace_id not in self._workspace_profiles:
                self._workspace_profiles[workspace_id] = set()
            self._workspace_profiles[workspace_id].add(profile_id)

        # Initialize presence
        self._presence[user_id] = UserPresence(user_id=user_id)

        return profile

    def get_profile(self, profile_id: str) -> Optional[UserProfile]:
        """Get a profile by ID."""
        return self._profiles.get(profile_id)

    def get_profile_by_user(self, user_id: str) -> Optional[UserProfile]:
        """Get a profile by user ID."""
        profile_id = self._user_to_profile.get(user_id)
        if profile_id:
            return self._profiles.get(profile_id)
        return None

    def update_profile(self, profile: UserProfile) -> bool:
        """Update a profile."""
        if profile.id not in self._profiles:
            return False

        profile.updated_at = datetime.utcnow()
        self._profiles[profile.id] = profile
        return True

    def delete_profile(self, profile_id: str) -> bool:
        """Delete a profile."""
        profile = self._profiles.get(profile_id)
        if not profile:
            return False

        # Remove from indexes
        if profile.user_id in self._user_to_profile:
            del self._user_to_profile[profile.user_id]

        if profile.workspace_id and profile.workspace_id in self._workspace_profiles:
            self._workspace_profiles[profile.workspace_id].discard(profile_id)

        # Remove skills
        for skill_id in list(profile.skill_ids):
            self.delete_skill(skill_id)

        # Remove badges
        for badge_id in list(profile.badge_ids):
            self.delete_badge(badge_id)

        # Remove presence
        if profile.user_id in self._presence:
            del self._presence[profile.user_id]

        del self._profiles[profile_id]
        return True

    def list_profiles(
        self,
        workspace_id: Optional[str] = None,
        department: Optional[str] = None,
        status: Optional[ProfileStatus] = None,
        verified_only: bool = False,
        limit: int = 100,
        offset: int = 0
    ) -> List[UserProfile]:
        """List profiles matching criteria."""
        if workspace_id and workspace_id in self._workspace_profiles:
            profile_ids = self._workspace_profiles[workspace_id]
            profiles = [self._profiles[pid] for pid in profile_ids if pid in self._profiles]
        else:
            profiles = list(self._profiles.values())

        # Filter by department
        if department:
            profiles = [p for p in profiles if p.department == department]

        # Filter by status
        if status:
            profiles = [p for p in profiles if p.status == status]

        # Filter verified
        if verified_only:
            profiles = [p for p in profiles if p.is_verified]

        # Sort by name
        profiles.sort(key=lambda p: p.full_name.lower())

        return profiles[offset:offset + limit]

    def search_profiles(
        self,
        query: str,
        workspace_id: Optional[str] = None
    ) -> List[UserProfile]:
        """Search profiles by name, email, or title."""
        query_lower = query.lower()
        profiles = self.list_profiles(workspace_id=workspace_id, limit=10000)

        results = []
        for profile in profiles:
            if (query_lower in profile.full_name.lower() or
                query_lower in (profile.display_name or "").lower() or
                query_lower in (profile.email or "").lower() or
                query_lower in (profile.title or "").lower() or
                query_lower in (profile.department or "").lower()):
                results.append(profile)

        return results

    # Skill operations
    def add_skill(
        self,
        user_id: str,
        name: str,
        category: str = "",
        level: SkillLevel = SkillLevel.INTERMEDIATE,
        years_experience: float = 0.0
    ) -> Optional[Skill]:
        """Add a skill to a user."""
        profile = self.get_profile_by_user(user_id)
        if not profile:
            return None

        ProfileRegistry._counter += 1
        skill_id = f"skill_{int(time_module.time() * 1000)}_{ProfileRegistry._counter}"

        skill = Skill(
            id=skill_id,
            user_id=user_id,
            name=name,
            category=category,
            level=level,
            years_experience=years_experience
        )

        self._skills[skill_id] = skill
        profile.skill_ids.add(skill_id)

        # Update indexes
        if user_id not in self._user_skills:
            self._user_skills[user_id] = set()
        self._user_skills[user_id].add(skill_id)

        name_lower = name.lower()
        if name_lower not in self._skill_name_index:
            self._skill_name_index[name_lower] = set()
        self._skill_name_index[name_lower].add(skill_id)

        return skill

    def get_skill(self, skill_id: str) -> Optional[Skill]:
        """Get a skill by ID."""
        return self._skills.get(skill_id)

    def update_skill(self, skill: Skill) -> bool:
        """Update a skill."""
        if skill.id not in self._skills:
            return False

        skill.updated_at = datetime.utcnow()
        self._skills[skill.id] = skill
        return True

    def delete_skill(self, skill_id: str) -> bool:
        """Delete a skill."""
        skill = self._skills.get(skill_id)
        if not skill:
            return False

        # Remove from profile
        profile = self.get_profile_by_user(skill.user_id)
        if profile:
            profile.skill_ids.discard(skill_id)

        # Remove from indexes
        if skill.user_id in self._user_skills:
            self._user_skills[skill.user_id].discard(skill_id)

        name_lower = skill.name.lower()
        if name_lower in self._skill_name_index:
            self._skill_name_index[name_lower].discard(skill_id)

        del self._skills[skill_id]
        return True

    def get_user_skills(self, user_id: str) -> List[Skill]:
        """Get all skills for a user."""
        skill_ids = self._user_skills.get(user_id, set())
        skills = [self._skills[sid] for sid in skill_ids if sid in self._skills]
        skills.sort(key=lambda s: s.endorsement_count, reverse=True)
        return skills

    def endorse_skill(self, skill_id: str, endorser_id: str) -> bool:
        """Endorse a skill."""
        skill = self._skills.get(skill_id)
        if not skill:
            return False

        return skill.add_endorsement(endorser_id)

    def remove_endorsement(self, skill_id: str, endorser_id: str) -> bool:
        """Remove an endorsement."""
        skill = self._skills.get(skill_id)
        if not skill:
            return False

        return skill.remove_endorsement(endorser_id)

    def find_users_by_skill(self, skill_name: str) -> List[str]:
        """Find users with a specific skill."""
        name_lower = skill_name.lower()
        skill_ids = self._skill_name_index.get(name_lower, set())

        user_ids = set()
        for skill_id in skill_ids:
            skill = self._skills.get(skill_id)
            if skill:
                user_ids.add(skill.user_id)

        return list(user_ids)

    # Badge operations
    def award_badge(
        self,
        user_id: str,
        badge_type: BadgeType,
        name: str,
        description: str = "",
        awarded_by: Optional[str] = None,
        expires_days: Optional[int] = None
    ) -> Optional[Badge]:
        """Award a badge to a user."""
        profile = self.get_profile_by_user(user_id)
        if not profile:
            return None

        ProfileRegistry._counter += 1
        badge_id = f"badge_{int(time_module.time() * 1000)}_{ProfileRegistry._counter}"

        expires_at = None
        if expires_days:
            expires_at = datetime.utcnow() + timedelta(days=expires_days)

        badge = Badge(
            id=badge_id,
            user_id=user_id,
            type=badge_type,
            name=name,
            description=description,
            awarded_by=awarded_by,
            expires_at=expires_at
        )

        self._badges[badge_id] = badge
        profile.badge_ids.add(badge_id)

        # Update index
        if user_id not in self._user_badges:
            self._user_badges[user_id] = set()
        self._user_badges[user_id].add(badge_id)

        return badge

    def get_badge(self, badge_id: str) -> Optional[Badge]:
        """Get a badge by ID."""
        return self._badges.get(badge_id)

    def delete_badge(self, badge_id: str) -> bool:
        """Delete/revoke a badge."""
        badge = self._badges.get(badge_id)
        if not badge:
            return False

        # Remove from profile
        profile = self.get_profile_by_user(badge.user_id)
        if profile:
            profile.badge_ids.discard(badge_id)

        # Remove from index
        if badge.user_id in self._user_badges:
            self._user_badges[badge.user_id].discard(badge_id)

        del self._badges[badge_id]
        return True

    def get_user_badges(self, user_id: str, valid_only: bool = True) -> List[Badge]:
        """Get all badges for a user."""
        badge_ids = self._user_badges.get(user_id, set())
        badges = [self._badges[bid] for bid in badge_ids if bid in self._badges]

        if valid_only:
            badges = [b for b in badges if b.is_valid]

        badges.sort(key=lambda b: b.awarded_at, reverse=True)
        return badges

    def has_badge(self, user_id: str, badge_type: BadgeType) -> bool:
        """Check if user has a specific badge type."""
        badges = self.get_user_badges(user_id)
        return any(b.type == badge_type for b in badges)

    # Presence operations
    def get_presence(self, user_id: str) -> Optional[UserPresence]:
        """Get user presence."""
        return self._presence.get(user_id)

    def update_presence(
        self,
        user_id: str,
        status: PresenceStatus,
        status_text: str = "",
        status_emoji: Optional[str] = None,
        expires_in_minutes: Optional[int] = None
    ) -> Optional[UserPresence]:
        """Update user presence."""
        presence = self._presence.get(user_id)
        if not presence:
            presence = UserPresence(user_id=user_id)
            self._presence[user_id] = presence

        presence.set_status(status, status_text, status_emoji, expires_in_minutes)
        return presence

    def clear_presence_status(self, user_id: str) -> bool:
        """Clear user's custom status."""
        presence = self._presence.get(user_id)
        if not presence:
            return False

        presence.clear_status()
        return True

    def update_last_seen(self, user_id: str) -> None:
        """Update user's last seen timestamp."""
        presence = self._presence.get(user_id)
        if presence:
            presence.update_last_seen()

    def get_online_users(self, workspace_id: Optional[str] = None) -> List[str]:
        """Get list of online users."""
        online_statuses = {PresenceStatus.ONLINE, PresenceStatus.AWAY, PresenceStatus.BUSY}

        online_users = []
        for user_id, presence in self._presence.items():
            if presence.status in online_statuses:
                if workspace_id:
                    profile = self.get_profile_by_user(user_id)
                    if profile and profile.workspace_id == workspace_id:
                        online_users.append(user_id)
                else:
                    online_users.append(user_id)

        return online_users

    # Availability operations
    def add_availability_block(
        self,
        user_id: str,
        availability_type: AvailabilityType,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        title: str = "",
        notes: str = ""
    ) -> Optional[AvailabilityBlock]:
        """Add an availability block."""
        profile = self.get_profile_by_user(user_id)
        if not profile:
            return None

        ProfileRegistry._counter += 1
        block_id = f"avail_{int(time_module.time() * 1000)}_{ProfileRegistry._counter}"

        block = AvailabilityBlock(
            id=block_id,
            user_id=user_id,
            type=availability_type,
            title=title,
            start_time=start_time,
            end_time=end_time,
            notes=notes
        )

        self._availability[block_id] = block

        # Update index
        if user_id not in self._user_availability:
            self._user_availability[user_id] = set()
        self._user_availability[user_id].add(block_id)

        return block

    def get_availability_block(self, block_id: str) -> Optional[AvailabilityBlock]:
        """Get an availability block."""
        return self._availability.get(block_id)

    def delete_availability_block(self, block_id: str) -> bool:
        """Delete an availability block."""
        block = self._availability.get(block_id)
        if not block:
            return False

        # Remove from index
        if block.user_id in self._user_availability:
            self._user_availability[block.user_id].discard(block_id)

        del self._availability[block_id]
        return True

    def get_user_availability(
        self,
        user_id: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> List[AvailabilityBlock]:
        """Get user's availability blocks."""
        block_ids = self._user_availability.get(user_id, set())
        blocks = [self._availability[bid] for bid in block_ids if bid in self._availability]

        # Filter by date range
        if start:
            blocks = [b for b in blocks if b.end_time is None or b.end_time >= start]
        if end:
            blocks = [b for b in blocks if b.start_time <= end]

        blocks.sort(key=lambda b: b.start_time)
        return blocks

    def get_current_availability(self, user_id: str) -> Optional[AvailabilityBlock]:
        """Get user's current availability block if any."""
        blocks = self.get_user_availability(user_id)
        for block in blocks:
            if block.is_active:
                return block
        return None

    # Relationship/org chart operations
    def add_relationship(
        self,
        from_user_id: str,
        to_user_id: str,
        relationship_type: RelationshipType
    ) -> Optional[OrgRelationship]:
        """Add an organizational relationship."""
        ProfileRegistry._counter += 1
        rel_id = f"rel_{int(time_module.time() * 1000)}_{ProfileRegistry._counter}"

        relationship = OrgRelationship(
            id=rel_id,
            from_user_id=from_user_id,
            to_user_id=to_user_id,
            type=relationship_type
        )

        self._relationships[rel_id] = relationship

        # Update profile manager reference if reports_to
        if relationship_type == RelationshipType.REPORTS_TO:
            profile = self.get_profile_by_user(from_user_id)
            if profile:
                profile.manager_id = to_user_id
                self.update_profile(profile)

        return relationship

    def remove_relationship(self, relationship_id: str) -> bool:
        """Remove a relationship."""
        relationship = self._relationships.get(relationship_id)
        if not relationship:
            return False

        # Clear manager reference if needed
        if relationship.type == RelationshipType.REPORTS_TO:
            profile = self.get_profile_by_user(relationship.from_user_id)
            if profile and profile.manager_id == relationship.to_user_id:
                profile.manager_id = None
                self.update_profile(profile)

        del self._relationships[relationship_id]
        return True

    def get_direct_reports(self, manager_id: str) -> List[str]:
        """Get direct reports for a manager."""
        reports = []
        for rel in self._relationships.values():
            if rel.to_user_id == manager_id and rel.type == RelationshipType.REPORTS_TO:
                reports.append(rel.from_user_id)
        return reports

    def get_manager(self, user_id: str) -> Optional[str]:
        """Get user's manager."""
        for rel in self._relationships.values():
            if rel.from_user_id == user_id and rel.type == RelationshipType.REPORTS_TO:
                return rel.to_user_id
        return None

    def get_org_chart(self, root_user_id: Optional[str] = None) -> Dict[str, Any]:
        """Build organization chart starting from root."""
        def build_tree(user_id: str) -> Dict[str, Any]:
            profile = self.get_profile_by_user(user_id)
            if not profile:
                return {"user_id": user_id, "children": []}

            direct_reports = self.get_direct_reports(user_id)

            return {
                "user_id": user_id,
                "name": profile.full_name,
                "title": profile.title,
                "department": profile.department,
                "avatar_url": profile.avatar_url,
                "children": [build_tree(report_id) for report_id in direct_reports]
            }

        # Find root users (no manager)
        if root_user_id:
            return build_tree(root_user_id)

        # Find all users without managers
        all_users = set(self._user_to_profile.keys())
        users_with_managers = set()
        for rel in self._relationships.values():
            if rel.type == RelationshipType.REPORTS_TO:
                users_with_managers.add(rel.from_user_id)

        root_users = all_users - users_with_managers

        return {
            "roots": [build_tree(uid) for uid in root_users]
        }


# ==================== Profile Manager ====================

class ProfileManager:
    """High-level manager for user profiles."""

    def __init__(self):
        self.registry = ProfileRegistry()

    # Profile operations
    def create_profile(
        self,
        user_id: str,
        display_name: str = "",
        email: Optional[str] = None,
        workspace_id: Optional[str] = None,
        **kwargs
    ) -> UserProfile:
        """Create a new user profile."""
        return self.registry.create_profile(
            user_id=user_id,
            display_name=display_name,
            email=email,
            workspace_id=workspace_id,
            **kwargs
        )

    def get_profile(self, profile_id: str) -> Optional[UserProfile]:
        """Get a profile by ID."""
        return self.registry.get_profile(profile_id)

    def get_profile_by_user(self, user_id: str) -> Optional[UserProfile]:
        """Get a profile by user ID."""
        return self.registry.get_profile_by_user(user_id)

    def update_profile(
        self,
        user_id: str,
        display_name: Optional[str] = None,
        first_name: Optional[str] = None,
        last_name: Optional[str] = None,
        bio: Optional[str] = None,
        headline: Optional[str] = None,
        title: Optional[str] = None,
        department: Optional[str] = None,
        location: Optional[str] = None,
        timezone: Optional[str] = None,
        avatar_url: Optional[str] = None
    ) -> Optional[UserProfile]:
        """Update a user profile."""
        profile = self.registry.get_profile_by_user(user_id)
        if not profile:
            return None

        if display_name is not None:
            profile.display_name = display_name
        if first_name is not None:
            profile.first_name = first_name
        if last_name is not None:
            profile.last_name = last_name
        if bio is not None:
            profile.bio = bio
        if headline is not None:
            profile.headline = headline
        if title is not None:
            profile.title = title
        if department is not None:
            profile.department = department
        if location is not None:
            profile.location = location
        if timezone is not None:
            profile.timezone = timezone
        if avatar_url is not None:
            profile.avatar_url = avatar_url

        self.registry.update_profile(profile)
        return profile

    def delete_profile(self, user_id: str) -> bool:
        """Delete a user profile."""
        profile = self.registry.get_profile_by_user(user_id)
        if not profile:
            return False
        return self.registry.delete_profile(profile.id)

    def verify_profile(self, user_id: str) -> Optional[UserProfile]:
        """Verify a user profile."""
        profile = self.registry.get_profile_by_user(user_id)
        if not profile:
            return None

        profile.verify()
        self.registry.update_profile(profile)
        return profile

    def list_profiles(self, **kwargs) -> List[UserProfile]:
        """List profiles."""
        return self.registry.list_profiles(**kwargs)

    def search_profiles(self, query: str, workspace_id: Optional[str] = None) -> List[UserProfile]:
        """Search profiles."""
        return self.registry.search_profiles(query, workspace_id)

    # Skill operations
    def add_skill(
        self,
        user_id: str,
        name: str,
        category: str = "",
        level: SkillLevel = SkillLevel.INTERMEDIATE,
        years_experience: float = 0.0
    ) -> Optional[Skill]:
        """Add a skill to a user."""
        return self.registry.add_skill(user_id, name, category, level, years_experience)

    def update_skill(
        self,
        skill_id: str,
        level: Optional[SkillLevel] = None,
        years_experience: Optional[float] = None
    ) -> Optional[Skill]:
        """Update a skill."""
        skill = self.registry.get_skill(skill_id)
        if not skill:
            return None

        if level is not None:
            skill.level = level
        if years_experience is not None:
            skill.years_experience = years_experience

        self.registry.update_skill(skill)
        return skill

    def remove_skill(self, skill_id: str) -> bool:
        """Remove a skill."""
        return self.registry.delete_skill(skill_id)

    def get_user_skills(self, user_id: str) -> List[Skill]:
        """Get user's skills."""
        return self.registry.get_user_skills(user_id)

    def endorse_skill(self, skill_id: str, endorser_id: str) -> bool:
        """Endorse a skill."""
        return self.registry.endorse_skill(skill_id, endorser_id)

    def remove_endorsement(self, skill_id: str, endorser_id: str) -> bool:
        """Remove an endorsement."""
        return self.registry.remove_endorsement(skill_id, endorser_id)

    def find_users_by_skill(self, skill_name: str) -> List[UserProfile]:
        """Find users with a specific skill."""
        user_ids = self.registry.find_users_by_skill(skill_name)
        profiles = []
        for user_id in user_ids:
            profile = self.registry.get_profile_by_user(user_id)
            if profile:
                profiles.append(profile)
        return profiles

    # Badge operations
    def award_badge(
        self,
        user_id: str,
        badge_type: BadgeType,
        name: str,
        description: str = "",
        awarded_by: Optional[str] = None
    ) -> Optional[Badge]:
        """Award a badge to a user."""
        return self.registry.award_badge(
            user_id, badge_type, name, description, awarded_by
        )

    def revoke_badge(self, badge_id: str) -> bool:
        """Revoke a badge."""
        return self.registry.delete_badge(badge_id)

    def get_user_badges(self, user_id: str) -> List[Badge]:
        """Get user's badges."""
        return self.registry.get_user_badges(user_id)

    def has_badge(self, user_id: str, badge_type: BadgeType) -> bool:
        """Check if user has a badge type."""
        return self.registry.has_badge(user_id, badge_type)

    # Presence operations
    def set_presence(
        self,
        user_id: str,
        status: PresenceStatus,
        status_text: str = "",
        status_emoji: Optional[str] = None,
        expires_in_minutes: Optional[int] = None
    ) -> Optional[UserPresence]:
        """Set user presence."""
        return self.registry.update_presence(
            user_id, status, status_text, status_emoji, expires_in_minutes
        )

    def get_presence(self, user_id: str) -> Optional[UserPresence]:
        """Get user presence."""
        return self.registry.get_presence(user_id)

    def clear_status(self, user_id: str) -> bool:
        """Clear user's custom status."""
        return self.registry.clear_presence_status(user_id)

    def update_activity(self, user_id: str) -> None:
        """Update user's activity."""
        self.registry.update_last_seen(user_id)
        profile = self.registry.get_profile_by_user(user_id)
        if profile:
            profile.update_activity()
            self.registry.update_profile(profile)

    def get_online_users(self, workspace_id: Optional[str] = None) -> List[str]:
        """Get online users."""
        return self.registry.get_online_users(workspace_id)

    # Availability operations
    def set_availability(
        self,
        user_id: str,
        availability_type: AvailabilityType,
        start_time: datetime,
        end_time: Optional[datetime] = None,
        title: str = "",
        notes: str = ""
    ) -> Optional[AvailabilityBlock]:
        """Set user availability."""
        return self.registry.add_availability_block(
            user_id, availability_type, start_time, end_time, title, notes
        )

    def remove_availability(self, block_id: str) -> bool:
        """Remove an availability block."""
        return self.registry.delete_availability_block(block_id)

    def get_availability(
        self,
        user_id: str,
        start: Optional[datetime] = None,
        end: Optional[datetime] = None
    ) -> List[AvailabilityBlock]:
        """Get user's availability."""
        return self.registry.get_user_availability(user_id, start, end)

    def get_current_availability(self, user_id: str) -> Optional[AvailabilityBlock]:
        """Get user's current availability status."""
        return self.registry.get_current_availability(user_id)

    def is_available(self, user_id: str) -> bool:
        """Check if user is currently available."""
        current = self.get_current_availability(user_id)
        if current:
            return current.type == AvailabilityType.AVAILABLE
        return True  # Default to available if no block set

    # Organization operations
    def set_manager(self, user_id: str, manager_id: str) -> Optional[OrgRelationship]:
        """Set user's manager."""
        # Remove existing manager relationship
        profile = self.registry.get_profile_by_user(user_id)
        if profile and profile.manager_id:
            for rel in list(self.registry._relationships.values()):
                if (rel.from_user_id == user_id and
                    rel.type == RelationshipType.REPORTS_TO):
                    self.registry.remove_relationship(rel.id)

        return self.registry.add_relationship(
            user_id, manager_id, RelationshipType.REPORTS_TO
        )

    def remove_manager(self, user_id: str) -> bool:
        """Remove user's manager."""
        for rel in list(self.registry._relationships.values()):
            if rel.from_user_id == user_id and rel.type == RelationshipType.REPORTS_TO:
                return self.registry.remove_relationship(rel.id)
        return False

    def get_manager(self, user_id: str) -> Optional[UserProfile]:
        """Get user's manager profile."""
        manager_id = self.registry.get_manager(user_id)
        if manager_id:
            return self.registry.get_profile_by_user(manager_id)
        return None

    def get_direct_reports(self, manager_id: str) -> List[UserProfile]:
        """Get manager's direct reports."""
        report_ids = self.registry.get_direct_reports(manager_id)
        profiles = []
        for user_id in report_ids:
            profile = self.registry.get_profile_by_user(user_id)
            if profile:
                profiles.append(profile)
        return profiles

    def get_org_chart(self, root_user_id: Optional[str] = None) -> Dict[str, Any]:
        """Get organization chart."""
        return self.registry.get_org_chart(root_user_id)

    # Directory operations
    def get_directory(
        self,
        workspace_id: str,
        department: Optional[str] = None
    ) -> List[DirectoryEntry]:
        """Get organization directory."""
        profiles = self.registry.list_profiles(
            workspace_id=workspace_id,
            department=department,
            status=ProfileStatus.ACTIVE,
            limit=10000
        )

        entries = []
        for profile in profiles:
            direct_reports = set(self.registry.get_direct_reports(profile.user_id))

            entry = DirectoryEntry(
                user_id=profile.user_id,
                profile_id=profile.id,
                display_name=profile.full_name,
                email=profile.email if profile.preferences.show_email else None,
                avatar_url=profile.avatar_url,
                title=profile.title,
                department=profile.department,
                location=profile.location if profile.preferences.show_location else None,
                manager_id=profile.manager_id,
                direct_reports=direct_reports,
                is_active=profile.status == ProfileStatus.ACTIVE
            )
            entries.append(entry)

        return entries

    def get_departments(self, workspace_id: str) -> List[str]:
        """Get list of departments in workspace."""
        profiles = self.registry.list_profiles(workspace_id=workspace_id, limit=10000)
        departments = set()
        for profile in profiles:
            if profile.department:
                departments.add(profile.department)
        return sorted(list(departments))

    # Stats
    def get_stats(self, workspace_id: Optional[str] = None) -> Dict[str, Any]:
        """Get profile statistics."""
        profiles = self.registry.list_profiles(workspace_id=workspace_id, limit=100000)

        total = len(profiles)
        verified = sum(1 for p in profiles if p.is_verified)
        with_skills = sum(1 for p in profiles if p.skill_ids)
        online = len(self.get_online_users(workspace_id))

        departments: Dict[str, int] = {}
        for profile in profiles:
            if profile.department:
                departments[profile.department] = departments.get(profile.department, 0) + 1

        return {
            "total_profiles": total,
            "verified_profiles": verified,
            "profiles_with_skills": with_skills,
            "online_users": online,
            "total_skills": len(self.registry._skills),
            "total_badges": len(self.registry._badges),
            "by_department": departments,
        }


# ==================== Global Instances ====================

_profile_manager: Optional[ProfileManager] = None


def get_profile_manager() -> Optional[ProfileManager]:
    """Get the global profile manager."""
    return _profile_manager


def set_profile_manager(manager: ProfileManager) -> None:
    """Set the global profile manager."""
    global _profile_manager
    _profile_manager = manager


def reset_profile_manager() -> None:
    """Reset the global profile manager."""
    global _profile_manager
    _profile_manager = None
