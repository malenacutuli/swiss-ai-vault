"""
Inventory & Asset Management module for enterprise collaboration.

This module provides comprehensive inventory and asset management functionality including:
- Asset registration and tracking
- Asset categories and types
- Check-out/check-in workflows
- Employee and department assignments
- Maintenance scheduling and records
- Depreciation tracking
- Warranty management
- Inventory audits and counts
- Disposal and retirement workflows
- Analytics and reporting
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, date
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
import uuid


# ============================================================
# Enums
# ============================================================

class AssetType(Enum):
    """Types of assets."""
    COMPUTER = "computer"
    LAPTOP = "laptop"
    MONITOR = "monitor"
    PHONE = "phone"
    TABLET = "tablet"
    PRINTER = "printer"
    FURNITURE = "furniture"
    VEHICLE = "vehicle"
    EQUIPMENT = "equipment"
    TOOL = "tool"
    SOFTWARE_LICENSE = "software_license"
    SERVER = "server"
    NETWORK_DEVICE = "network_device"
    AUDIO_VIDEO = "audio_video"
    SAFETY_EQUIPMENT = "safety_equipment"
    MEDICAL_EQUIPMENT = "medical_equipment"
    LAB_EQUIPMENT = "lab_equipment"
    OTHER = "other"


class AssetStatus(Enum):
    """Status of an asset."""
    AVAILABLE = "available"
    IN_USE = "in_use"
    CHECKED_OUT = "checked_out"
    RESERVED = "reserved"
    IN_MAINTENANCE = "in_maintenance"
    IN_REPAIR = "in_repair"
    DAMAGED = "damaged"
    LOST = "lost"
    STOLEN = "stolen"
    RETIRED = "retired"
    DISPOSED = "disposed"
    PENDING_DISPOSAL = "pending_disposal"


class AssetCondition(Enum):
    """Condition of an asset."""
    NEW = "new"
    EXCELLENT = "excellent"
    GOOD = "good"
    FAIR = "fair"
    POOR = "poor"
    NON_FUNCTIONAL = "non_functional"


class CheckoutStatus(Enum):
    """Status of a checkout."""
    ACTIVE = "active"
    RETURNED = "returned"
    OVERDUE = "overdue"
    LOST = "lost"
    CANCELLED = "cancelled"


class MaintenanceType(Enum):
    """Types of maintenance."""
    PREVENTIVE = "preventive"
    CORRECTIVE = "corrective"
    PREDICTIVE = "predictive"
    EMERGENCY = "emergency"
    CALIBRATION = "calibration"
    INSPECTION = "inspection"
    CLEANING = "cleaning"
    UPGRADE = "upgrade"


class MaintenanceStatus(Enum):
    """Status of maintenance."""
    SCHEDULED = "scheduled"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    OVERDUE = "overdue"


class DepreciationMethod(Enum):
    """Depreciation calculation methods."""
    STRAIGHT_LINE = "straight_line"
    DECLINING_BALANCE = "declining_balance"
    DOUBLE_DECLINING = "double_declining"
    SUM_OF_YEARS = "sum_of_years"
    UNITS_OF_PRODUCTION = "units_of_production"


class AuditStatus(Enum):
    """Status of an inventory audit."""
    PLANNED = "planned"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


class AuditResult(Enum):
    """Result of an asset audit."""
    VERIFIED = "verified"
    MISSING = "missing"
    DAMAGED = "damaged"
    LOCATION_MISMATCH = "location_mismatch"
    NOT_SCANNED = "not_scanned"


class DisposalMethod(Enum):
    """Methods for disposing assets."""
    SOLD = "sold"
    DONATED = "donated"
    RECYCLED = "recycled"
    SCRAPPED = "scrapped"
    RETURNED_TO_VENDOR = "returned_to_vendor"
    TRADED_IN = "traded_in"
    DESTROYED = "destroyed"


class ReservationStatus(Enum):
    """Status of an asset reservation."""
    PENDING = "pending"
    CONFIRMED = "confirmed"
    CHECKED_OUT = "checked_out"
    CANCELLED = "cancelled"
    EXPIRED = "expired"


# ============================================================
# Data Models
# ============================================================

@dataclass
class AssetCategory:
    """Represents an asset category."""
    id: str
    name: str
    description: Optional[str] = None
    parent_id: Optional[str] = None
    asset_type: AssetType = AssetType.OTHER
    depreciation_method: DepreciationMethod = DepreciationMethod.STRAIGHT_LINE
    useful_life_years: int = 5
    salvage_value_percent: float = 10.0
    requires_checkout: bool = True
    requires_approval: bool = False
    max_checkout_days: Optional[int] = None
    maintenance_interval_days: Optional[int] = None
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "asset_type": self.asset_type.value,
            "useful_life_years": self.useful_life_years,
            "active": self.active,
        }


@dataclass
class Asset:
    """Represents an asset."""
    id: str
    name: str
    asset_tag: str
    category_id: str
    asset_type: AssetType = AssetType.OTHER
    status: AssetStatus = AssetStatus.AVAILABLE
    condition: AssetCondition = AssetCondition.NEW
    serial_number: Optional[str] = None
    model: Optional[str] = None
    manufacturer: Optional[str] = None
    description: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: float = 0.0
    purchase_order: Optional[str] = None
    vendor_id: Optional[str] = None
    warranty_expiry: Optional[date] = None
    location_id: Optional[str] = None
    department_id: Optional[str] = None
    assigned_to: Optional[str] = None
    assigned_at: Optional[datetime] = None
    current_value: float = 0.0
    accumulated_depreciation: float = 0.0
    last_maintenance_date: Optional[date] = None
    next_maintenance_date: Optional[date] = None
    notes: Optional[str] = None
    tags: List[str] = field(default_factory=list)
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    qr_code: Optional[str] = None
    barcode: Optional[str] = None
    image_urls: List[str] = field(default_factory=list)
    documents: List[str] = field(default_factory=list)
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_available(self) -> bool:
        """Check if asset is available."""
        return self.status == AssetStatus.AVAILABLE

    @property
    def is_under_warranty(self) -> bool:
        """Check if asset is under warranty."""
        if self.warranty_expiry:
            return date.today() <= self.warranty_expiry
        return False

    @property
    def age_days(self) -> Optional[int]:
        """Calculate asset age in days."""
        if self.purchase_date:
            return (date.today() - self.purchase_date).days
        return None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "asset_tag": self.asset_tag,
            "category_id": self.category_id,
            "asset_type": self.asset_type.value,
            "status": self.status.value,
            "condition": self.condition.value,
            "serial_number": self.serial_number,
            "model": self.model,
            "manufacturer": self.manufacturer,
            "purchase_price": self.purchase_price,
            "current_value": self.current_value,
            "assigned_to": self.assigned_to,
            "is_available": self.is_available,
            "is_under_warranty": self.is_under_warranty,
        }


@dataclass
class AssetCheckout:
    """Represents an asset checkout."""
    id: str
    asset_id: str
    checked_out_to: str
    checked_out_by: str
    status: CheckoutStatus = CheckoutStatus.ACTIVE
    checkout_date: datetime = field(default_factory=datetime.utcnow)
    expected_return_date: Optional[datetime] = None
    actual_return_date: Optional[datetime] = None
    returned_to: Optional[str] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    condition_at_checkout: AssetCondition = AssetCondition.GOOD
    condition_at_return: Optional[AssetCondition] = None
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_overdue(self) -> bool:
        """Check if checkout is overdue."""
        if self.status == CheckoutStatus.ACTIVE and self.expected_return_date:
            return datetime.utcnow() > self.expected_return_date
        return False

    @property
    def duration_days(self) -> Optional[int]:
        """Calculate checkout duration in days."""
        end_date = self.actual_return_date or datetime.utcnow()
        delta = end_date - self.checkout_date
        return delta.days

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "checked_out_to": self.checked_out_to,
            "status": self.status.value,
            "checkout_date": self.checkout_date.isoformat(),
            "expected_return_date": self.expected_return_date.isoformat() if self.expected_return_date else None,
            "is_overdue": self.is_overdue,
            "duration_days": self.duration_days,
        }


@dataclass
class AssetReservation:
    """Represents an asset reservation."""
    id: str
    asset_id: str
    reserved_by: str
    status: ReservationStatus = ReservationStatus.PENDING
    start_date: datetime = field(default_factory=datetime.utcnow)
    end_date: Optional[datetime] = None
    purpose: Optional[str] = None
    notes: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    cancelled_at: Optional[datetime] = None
    cancellation_reason: Optional[str] = None
    checkout_id: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "reserved_by": self.reserved_by,
            "status": self.status.value,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
        }


@dataclass
class MaintenanceRecord:
    """Represents a maintenance record."""
    id: str
    asset_id: str
    maintenance_type: MaintenanceType
    status: MaintenanceStatus = MaintenanceStatus.SCHEDULED
    scheduled_date: date = field(default_factory=date.today)
    completed_date: Optional[date] = None
    description: str = ""
    performed_by: Optional[str] = None
    vendor_id: Optional[str] = None
    cost: float = 0.0
    parts_replaced: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    next_maintenance_date: Optional[date] = None
    work_order_number: Optional[str] = None
    documents: List[str] = field(default_factory=list)
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "maintenance_type": self.maintenance_type.value,
            "status": self.status.value,
            "scheduled_date": self.scheduled_date.isoformat(),
            "completed_date": self.completed_date.isoformat() if self.completed_date else None,
            "cost": self.cost,
        }


@dataclass
class DepreciationRecord:
    """Represents a depreciation record."""
    id: str
    asset_id: str
    period_start: date
    period_end: date
    method: DepreciationMethod
    depreciation_amount: float = 0.0
    accumulated_depreciation: float = 0.0
    book_value: float = 0.0
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "depreciation_amount": self.depreciation_amount,
            "book_value": self.book_value,
        }


@dataclass
class Warranty:
    """Represents warranty information."""
    id: str
    asset_id: str
    provider: str
    warranty_type: str = "standard"
    start_date: date = field(default_factory=date.today)
    end_date: Optional[date] = None
    coverage_details: Optional[str] = None
    contact_info: Optional[str] = None
    claim_process: Optional[str] = None
    documents: List[str] = field(default_factory=list)
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def is_valid(self) -> bool:
        """Check if warranty is valid."""
        if not self.active:
            return False
        if self.end_date:
            return date.today() <= self.end_date
        return True

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "provider": self.provider,
            "start_date": self.start_date.isoformat(),
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "is_valid": self.is_valid,
        }


@dataclass
class InventoryAudit:
    """Represents an inventory audit."""
    id: str
    name: str
    status: AuditStatus = AuditStatus.PLANNED
    scheduled_date: date = field(default_factory=date.today)
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    location_id: Optional[str] = None
    department_id: Optional[str] = None
    category_id: Optional[str] = None
    audited_by: List[str] = field(default_factory=list)
    total_assets: int = 0
    verified_count: int = 0
    missing_count: int = 0
    damaged_count: int = 0
    discrepancy_count: int = 0
    notes: Optional[str] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def completion_rate(self) -> float:
        """Calculate audit completion rate."""
        if self.total_assets == 0:
            return 0.0
        scanned = self.verified_count + self.missing_count + self.damaged_count
        return (scanned / self.total_assets) * 100

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value,
            "scheduled_date": self.scheduled_date.isoformat(),
            "total_assets": self.total_assets,
            "verified_count": self.verified_count,
            "missing_count": self.missing_count,
            "completion_rate": self.completion_rate,
        }


@dataclass
class AuditItem:
    """Represents an item in an inventory audit."""
    id: str
    audit_id: str
    asset_id: str
    result: AuditResult = AuditResult.NOT_SCANNED
    scanned_at: Optional[datetime] = None
    scanned_by: Optional[str] = None
    expected_location: Optional[str] = None
    actual_location: Optional[str] = None
    condition_noted: Optional[AssetCondition] = None
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "audit_id": self.audit_id,
            "asset_id": self.asset_id,
            "result": self.result.value,
            "scanned_at": self.scanned_at.isoformat() if self.scanned_at else None,
        }


@dataclass
class AssetDisposal:
    """Represents an asset disposal."""
    id: str
    asset_id: str
    disposal_method: DisposalMethod
    status: str = "pending"  # pending, approved, completed
    disposal_date: Optional[date] = None
    reason: str = ""
    proceeds: float = 0.0
    disposal_cost: float = 0.0
    approved_by: Optional[str] = None
    approved_at: Optional[datetime] = None
    completed_by: Optional[str] = None
    completed_at: Optional[datetime] = None
    recipient: Optional[str] = None
    documents: List[str] = field(default_factory=list)
    notes: Optional[str] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    @property
    def net_proceeds(self) -> float:
        """Calculate net proceeds from disposal."""
        return self.proceeds - self.disposal_cost

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "asset_id": self.asset_id,
            "disposal_method": self.disposal_method.value,
            "status": self.status,
            "disposal_date": self.disposal_date.isoformat() if self.disposal_date else None,
            "proceeds": self.proceeds,
            "net_proceeds": self.net_proceeds,
        }


@dataclass
class Location:
    """Represents a storage location."""
    id: str
    name: str
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    address: Optional[str] = None
    parent_id: Optional[str] = None
    capacity: Optional[int] = None
    current_count: int = 0
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "building": self.building,
            "floor": self.floor,
            "room": self.room,
            "current_count": self.current_count,
            "active": self.active,
        }


@dataclass
class Vendor:
    """Represents a vendor/supplier."""
    id: str
    name: str
    contact_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    website: Optional[str] = None
    vendor_type: str = "supplier"  # supplier, manufacturer, service
    payment_terms: Optional[str] = None
    notes: Optional[str] = None
    active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "phone": self.phone,
            "vendor_type": self.vendor_type,
            "active": self.active,
        }


@dataclass
class InventoryAnalytics:
    """Analytics data for inventory management."""
    id: str
    period_start: date
    period_end: date
    total_assets: int = 0
    total_value: float = 0.0
    assets_by_status: Dict[str, int] = field(default_factory=dict)
    assets_by_type: Dict[str, int] = field(default_factory=dict)
    assets_by_category: Dict[str, int] = field(default_factory=dict)
    assets_by_location: Dict[str, int] = field(default_factory=dict)
    checkouts_count: int = 0
    returns_count: int = 0
    overdue_checkouts: int = 0
    maintenance_count: int = 0
    maintenance_cost: float = 0.0
    depreciation_total: float = 0.0
    disposals_count: int = 0
    disposal_proceeds: float = 0.0
    new_assets_count: int = 0
    new_assets_value: float = 0.0
    utilization_rate: float = 0.0
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return {
            "id": self.id,
            "period_start": self.period_start.isoformat(),
            "period_end": self.period_end.isoformat(),
            "total_assets": self.total_assets,
            "total_value": self.total_value,
            "checkouts_count": self.checkouts_count,
            "overdue_checkouts": self.overdue_checkouts,
            "maintenance_cost": self.maintenance_cost,
            "utilization_rate": self.utilization_rate,
        }


# ============================================================
# Registry
# ============================================================

class InventoryRegistry:
    """Registry for managing inventory data."""

    def __init__(self) -> None:
        """Initialize the registry."""
        self._categories: Dict[str, AssetCategory] = {}
        self._assets: Dict[str, Asset] = {}
        self._checkouts: Dict[str, AssetCheckout] = {}
        self._reservations: Dict[str, AssetReservation] = {}
        self._maintenance: Dict[str, MaintenanceRecord] = {}
        self._depreciation: Dict[str, DepreciationRecord] = {}
        self._warranties: Dict[str, Warranty] = {}
        self._audits: Dict[str, InventoryAudit] = {}
        self._audit_items: Dict[str, AuditItem] = {}
        self._disposals: Dict[str, AssetDisposal] = {}
        self._locations: Dict[str, Location] = {}
        self._vendors: Dict[str, Vendor] = {}
        self._analytics: Dict[str, InventoryAnalytics] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._categories.clear()
        self._assets.clear()
        self._checkouts.clear()
        self._reservations.clear()
        self._maintenance.clear()
        self._depreciation.clear()
        self._warranties.clear()
        self._audits.clear()
        self._audit_items.clear()
        self._disposals.clear()
        self._locations.clear()
        self._vendors.clear()
        self._analytics.clear()

    # Category CRUD
    def create_category(self, category: AssetCategory) -> AssetCategory:
        """Create a category."""
        self._categories[category.id] = category
        return category

    def get_category(self, category_id: str) -> Optional[AssetCategory]:
        """Get a category by ID."""
        return self._categories.get(category_id)

    def update_category(
        self, category_id: str, updates: Dict[str, Any]
    ) -> Optional[AssetCategory]:
        """Update a category."""
        category = self._categories.get(category_id)
        if category:
            for key, value in updates.items():
                if hasattr(category, key):
                    setattr(category, key, value)
        return category

    def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        if category_id in self._categories:
            del self._categories[category_id]
            return True
        return False

    def list_categories(
        self,
        asset_type: Optional[AssetType] = None,
        active: Optional[bool] = None,
    ) -> List[AssetCategory]:
        """List categories."""
        results = list(self._categories.values())
        if asset_type:
            results = [c for c in results if c.asset_type == asset_type]
        if active is not None:
            results = [c for c in results if c.active == active]
        return results

    # Asset CRUD
    def create_asset(self, asset: Asset) -> Asset:
        """Create an asset."""
        self._assets[asset.id] = asset
        return asset

    def get_asset(self, asset_id: str) -> Optional[Asset]:
        """Get an asset by ID."""
        return self._assets.get(asset_id)

    def get_asset_by_tag(self, asset_tag: str) -> Optional[Asset]:
        """Get an asset by tag."""
        for asset in self._assets.values():
            if asset.asset_tag == asset_tag:
                return asset
        return None

    def get_asset_by_serial(self, serial_number: str) -> Optional[Asset]:
        """Get an asset by serial number."""
        for asset in self._assets.values():
            if asset.serial_number == serial_number:
                return asset
        return None

    def update_asset(self, asset_id: str, updates: Dict[str, Any]) -> Optional[Asset]:
        """Update an asset."""
        asset = self._assets.get(asset_id)
        if asset:
            for key, value in updates.items():
                if hasattr(asset, key):
                    setattr(asset, key, value)
            asset.updated_at = datetime.utcnow()
        return asset

    def delete_asset(self, asset_id: str) -> bool:
        """Delete an asset."""
        if asset_id in self._assets:
            del self._assets[asset_id]
            return True
        return False

    def list_assets(
        self,
        category_id: Optional[str] = None,
        asset_type: Optional[AssetType] = None,
        status: Optional[AssetStatus] = None,
        condition: Optional[AssetCondition] = None,
        location_id: Optional[str] = None,
        department_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
        search: Optional[str] = None,
    ) -> List[Asset]:
        """List assets with filters."""
        results = list(self._assets.values())

        if category_id:
            results = [a for a in results if a.category_id == category_id]
        if asset_type:
            results = [a for a in results if a.asset_type == asset_type]
        if status:
            results = [a for a in results if a.status == status]
        if condition:
            results = [a for a in results if a.condition == condition]
        if location_id:
            results = [a for a in results if a.location_id == location_id]
        if department_id:
            results = [a for a in results if a.department_id == department_id]
        if assigned_to:
            results = [a for a in results if a.assigned_to == assigned_to]
        if search:
            search_lower = search.lower()
            results = [
                a for a in results
                if search_lower in a.name.lower()
                or search_lower in a.asset_tag.lower()
                or (a.serial_number and search_lower in a.serial_number.lower())
            ]

        return results

    def get_available_assets(
        self, category_id: Optional[str] = None
    ) -> List[Asset]:
        """Get available assets."""
        results = [
            a for a in self._assets.values()
            if a.status == AssetStatus.AVAILABLE
        ]
        if category_id:
            results = [a for a in results if a.category_id == category_id]
        return results

    # Checkout CRUD
    def create_checkout(self, checkout: AssetCheckout) -> AssetCheckout:
        """Create a checkout."""
        self._checkouts[checkout.id] = checkout
        return checkout

    def get_checkout(self, checkout_id: str) -> Optional[AssetCheckout]:
        """Get a checkout by ID."""
        return self._checkouts.get(checkout_id)

    def update_checkout(
        self, checkout_id: str, updates: Dict[str, Any]
    ) -> Optional[AssetCheckout]:
        """Update a checkout."""
        checkout = self._checkouts.get(checkout_id)
        if checkout:
            for key, value in updates.items():
                if hasattr(checkout, key):
                    setattr(checkout, key, value)
        return checkout

    def list_checkouts(
        self,
        asset_id: Optional[str] = None,
        checked_out_to: Optional[str] = None,
        status: Optional[CheckoutStatus] = None,
    ) -> List[AssetCheckout]:
        """List checkouts."""
        results = list(self._checkouts.values())

        if asset_id:
            results = [c for c in results if c.asset_id == asset_id]
        if checked_out_to:
            results = [c for c in results if c.checked_out_to == checked_out_to]
        if status:
            results = [c for c in results if c.status == status]

        return sorted(results, key=lambda c: c.checkout_date, reverse=True)

    def get_active_checkout(self, asset_id: str) -> Optional[AssetCheckout]:
        """Get active checkout for an asset."""
        for checkout in self._checkouts.values():
            if checkout.asset_id == asset_id and checkout.status == CheckoutStatus.ACTIVE:
                return checkout
        return None

    def get_overdue_checkouts(self) -> List[AssetCheckout]:
        """Get all overdue checkouts."""
        return [c for c in self._checkouts.values() if c.is_overdue]

    # Reservation CRUD
    def create_reservation(self, reservation: AssetReservation) -> AssetReservation:
        """Create a reservation."""
        self._reservations[reservation.id] = reservation
        return reservation

    def get_reservation(self, reservation_id: str) -> Optional[AssetReservation]:
        """Get a reservation by ID."""
        return self._reservations.get(reservation_id)

    def update_reservation(
        self, reservation_id: str, updates: Dict[str, Any]
    ) -> Optional[AssetReservation]:
        """Update a reservation."""
        reservation = self._reservations.get(reservation_id)
        if reservation:
            for key, value in updates.items():
                if hasattr(reservation, key):
                    setattr(reservation, key, value)
        return reservation

    def list_reservations(
        self,
        asset_id: Optional[str] = None,
        reserved_by: Optional[str] = None,
        status: Optional[ReservationStatus] = None,
    ) -> List[AssetReservation]:
        """List reservations."""
        results = list(self._reservations.values())

        if asset_id:
            results = [r for r in results if r.asset_id == asset_id]
        if reserved_by:
            results = [r for r in results if r.reserved_by == reserved_by]
        if status:
            results = [r for r in results if r.status == status]

        return sorted(results, key=lambda r: r.start_date)

    # Maintenance CRUD
    def create_maintenance(self, record: MaintenanceRecord) -> MaintenanceRecord:
        """Create a maintenance record."""
        self._maintenance[record.id] = record
        return record

    def get_maintenance(self, record_id: str) -> Optional[MaintenanceRecord]:
        """Get a maintenance record by ID."""
        return self._maintenance.get(record_id)

    def update_maintenance(
        self, record_id: str, updates: Dict[str, Any]
    ) -> Optional[MaintenanceRecord]:
        """Update a maintenance record."""
        record = self._maintenance.get(record_id)
        if record:
            for key, value in updates.items():
                if hasattr(record, key):
                    setattr(record, key, value)
        return record

    def list_maintenance(
        self,
        asset_id: Optional[str] = None,
        maintenance_type: Optional[MaintenanceType] = None,
        status: Optional[MaintenanceStatus] = None,
    ) -> List[MaintenanceRecord]:
        """List maintenance records."""
        results = list(self._maintenance.values())

        if asset_id:
            results = [m for m in results if m.asset_id == asset_id]
        if maintenance_type:
            results = [m for m in results if m.maintenance_type == maintenance_type]
        if status:
            results = [m for m in results if m.status == status]

        return sorted(results, key=lambda m: m.scheduled_date)

    def get_upcoming_maintenance(self, days: int = 30) -> List[MaintenanceRecord]:
        """Get upcoming maintenance in the next N days."""
        cutoff = date.today() + timedelta(days=days)
        return [
            m for m in self._maintenance.values()
            if m.status == MaintenanceStatus.SCHEDULED
            and m.scheduled_date <= cutoff
        ]

    # Depreciation CRUD
    def create_depreciation(self, record: DepreciationRecord) -> DepreciationRecord:
        """Create a depreciation record."""
        self._depreciation[record.id] = record
        return record

    def get_depreciation(self, record_id: str) -> Optional[DepreciationRecord]:
        """Get a depreciation record by ID."""
        return self._depreciation.get(record_id)

    def list_depreciation(
        self, asset_id: Optional[str] = None
    ) -> List[DepreciationRecord]:
        """List depreciation records."""
        results = list(self._depreciation.values())
        if asset_id:
            results = [d for d in results if d.asset_id == asset_id]
        return sorted(results, key=lambda d: d.period_start)

    # Warranty CRUD
    def create_warranty(self, warranty: Warranty) -> Warranty:
        """Create a warranty."""
        self._warranties[warranty.id] = warranty
        return warranty

    def get_warranty(self, warranty_id: str) -> Optional[Warranty]:
        """Get a warranty by ID."""
        return self._warranties.get(warranty_id)

    def update_warranty(
        self, warranty_id: str, updates: Dict[str, Any]
    ) -> Optional[Warranty]:
        """Update a warranty."""
        warranty = self._warranties.get(warranty_id)
        if warranty:
            for key, value in updates.items():
                if hasattr(warranty, key):
                    setattr(warranty, key, value)
        return warranty

    def list_warranties(
        self, asset_id: Optional[str] = None, active: Optional[bool] = None
    ) -> List[Warranty]:
        """List warranties."""
        results = list(self._warranties.values())
        if asset_id:
            results = [w for w in results if w.asset_id == asset_id]
        if active is not None:
            results = [w for w in results if w.active == active]
        return results

    def get_expiring_warranties(self, days: int = 30) -> List[Warranty]:
        """Get warranties expiring in the next N days."""
        cutoff = date.today() + timedelta(days=days)
        return [
            w for w in self._warranties.values()
            if w.is_valid and w.end_date and w.end_date <= cutoff
        ]

    # Audit CRUD
    def create_audit(self, audit: InventoryAudit) -> InventoryAudit:
        """Create an audit."""
        self._audits[audit.id] = audit
        return audit

    def get_audit(self, audit_id: str) -> Optional[InventoryAudit]:
        """Get an audit by ID."""
        return self._audits.get(audit_id)

    def update_audit(
        self, audit_id: str, updates: Dict[str, Any]
    ) -> Optional[InventoryAudit]:
        """Update an audit."""
        audit = self._audits.get(audit_id)
        if audit:
            for key, value in updates.items():
                if hasattr(audit, key):
                    setattr(audit, key, value)
        return audit

    def list_audits(self, status: Optional[AuditStatus] = None) -> List[InventoryAudit]:
        """List audits."""
        results = list(self._audits.values())
        if status:
            results = [a for a in results if a.status == status]
        return sorted(results, key=lambda a: a.scheduled_date, reverse=True)

    # Audit Item CRUD
    def create_audit_item(self, item: AuditItem) -> AuditItem:
        """Create an audit item."""
        self._audit_items[item.id] = item
        return item

    def get_audit_item(self, item_id: str) -> Optional[AuditItem]:
        """Get an audit item by ID."""
        return self._audit_items.get(item_id)

    def update_audit_item(
        self, item_id: str, updates: Dict[str, Any]
    ) -> Optional[AuditItem]:
        """Update an audit item."""
        item = self._audit_items.get(item_id)
        if item:
            for key, value in updates.items():
                if hasattr(item, key):
                    setattr(item, key, value)
        return item

    def list_audit_items(
        self, audit_id: str, result: Optional[AuditResult] = None
    ) -> List[AuditItem]:
        """List audit items."""
        results = [i for i in self._audit_items.values() if i.audit_id == audit_id]
        if result:
            results = [i for i in results if i.result == result]
        return results

    # Disposal CRUD
    def create_disposal(self, disposal: AssetDisposal) -> AssetDisposal:
        """Create a disposal."""
        self._disposals[disposal.id] = disposal
        return disposal

    def get_disposal(self, disposal_id: str) -> Optional[AssetDisposal]:
        """Get a disposal by ID."""
        return self._disposals.get(disposal_id)

    def update_disposal(
        self, disposal_id: str, updates: Dict[str, Any]
    ) -> Optional[AssetDisposal]:
        """Update a disposal."""
        disposal = self._disposals.get(disposal_id)
        if disposal:
            for key, value in updates.items():
                if hasattr(disposal, key):
                    setattr(disposal, key, value)
        return disposal

    def list_disposals(
        self, asset_id: Optional[str] = None, status: Optional[str] = None
    ) -> List[AssetDisposal]:
        """List disposals."""
        results = list(self._disposals.values())
        if asset_id:
            results = [d for d in results if d.asset_id == asset_id]
        if status:
            results = [d for d in results if d.status == status]
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

    def list_locations(self, active: Optional[bool] = None) -> List[Location]:
        """List locations."""
        results = list(self._locations.values())
        if active is not None:
            results = [loc for loc in results if loc.active == active]
        return results

    # Vendor CRUD
    def create_vendor(self, vendor: Vendor) -> Vendor:
        """Create a vendor."""
        self._vendors[vendor.id] = vendor
        return vendor

    def get_vendor(self, vendor_id: str) -> Optional[Vendor]:
        """Get a vendor by ID."""
        return self._vendors.get(vendor_id)

    def update_vendor(
        self, vendor_id: str, updates: Dict[str, Any]
    ) -> Optional[Vendor]:
        """Update a vendor."""
        vendor = self._vendors.get(vendor_id)
        if vendor:
            for key, value in updates.items():
                if hasattr(vendor, key):
                    setattr(vendor, key, value)
        return vendor

    def list_vendors(self, active: Optional[bool] = None) -> List[Vendor]:
        """List vendors."""
        results = list(self._vendors.values())
        if active is not None:
            results = [v for v in results if v.active == active]
        return results

    # Analytics CRUD
    def create_analytics(self, analytics: InventoryAnalytics) -> InventoryAnalytics:
        """Create an analytics record."""
        self._analytics[analytics.id] = analytics
        return analytics

    def get_analytics(self, analytics_id: str) -> Optional[InventoryAnalytics]:
        """Get an analytics record by ID."""
        return self._analytics.get(analytics_id)

    def list_analytics(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ) -> List[InventoryAnalytics]:
        """List analytics records."""
        results = list(self._analytics.values())
        if start_date:
            results = [a for a in results if a.period_start >= start_date]
        if end_date:
            results = [a for a in results if a.period_end <= end_date]
        return sorted(results, key=lambda a: a.period_start)


# ============================================================
# Manager
# ============================================================

class InventoryManager:
    """High-level API for inventory management."""

    def __init__(self, registry: Optional[InventoryRegistry] = None) -> None:
        """Initialize the manager."""
        self.registry = registry or InventoryRegistry()
        self._notification_handler: Optional[Callable] = None
        self._asset_tag_counter: int = 0

    def set_notification_handler(self, handler: Callable) -> None:
        """Set handler for sending notifications."""
        self._notification_handler = handler

    def _generate_asset_tag(self) -> str:
        """Generate a unique asset tag."""
        self._asset_tag_counter += 1
        return f"AST-{self._asset_tag_counter:06d}"

    # Category Management
    def create_category(
        self,
        name: str,
        asset_type: AssetType = AssetType.OTHER,
        description: Optional[str] = None,
        useful_life_years: int = 5,
        **kwargs: Any,
    ) -> AssetCategory:
        """Create an asset category."""
        category = AssetCategory(
            id=str(uuid.uuid4()),
            name=name,
            asset_type=asset_type,
            description=description,
            useful_life_years=useful_life_years,
            **kwargs,
        )
        return self.registry.create_category(category)

    def get_category(self, category_id: str) -> Optional[AssetCategory]:
        """Get a category by ID."""
        return self.registry.get_category(category_id)

    def list_categories(
        self,
        asset_type: Optional[AssetType] = None,
        active: Optional[bool] = None,
    ) -> List[AssetCategory]:
        """List categories."""
        return self.registry.list_categories(asset_type=asset_type, active=active)

    # Asset Management
    def register_asset(
        self,
        name: str,
        category_id: str,
        asset_type: Optional[AssetType] = None,
        serial_number: Optional[str] = None,
        model: Optional[str] = None,
        manufacturer: Optional[str] = None,
        purchase_date: Optional[date] = None,
        purchase_price: float = 0.0,
        location_id: Optional[str] = None,
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[Asset]:
        """Register a new asset."""
        category = self.registry.get_category(category_id)
        if not category:
            return None

        asset_tag = self._generate_asset_tag()

        asset = Asset(
            id=str(uuid.uuid4()),
            name=name,
            asset_tag=asset_tag,
            category_id=category_id,
            asset_type=asset_type or category.asset_type,
            serial_number=serial_number,
            model=model,
            manufacturer=manufacturer,
            purchase_date=purchase_date,
            purchase_price=purchase_price,
            current_value=purchase_price,
            location_id=location_id,
            created_by=created_by,
            **kwargs,
        )
        return self.registry.create_asset(asset)

    def get_asset(self, asset_id: str) -> Optional[Asset]:
        """Get an asset by ID."""
        return self.registry.get_asset(asset_id)

    def get_asset_by_tag(self, asset_tag: str) -> Optional[Asset]:
        """Get an asset by tag."""
        return self.registry.get_asset_by_tag(asset_tag)

    def update_asset(self, asset_id: str, updates: Dict[str, Any]) -> Optional[Asset]:
        """Update an asset."""
        return self.registry.update_asset(asset_id, updates)

    def search_assets(self, query: str) -> List[Asset]:
        """Search assets by name, tag, or serial number."""
        return self.registry.list_assets(search=query)

    def list_assets(
        self,
        category_id: Optional[str] = None,
        asset_type: Optional[AssetType] = None,
        status: Optional[AssetStatus] = None,
        location_id: Optional[str] = None,
        assigned_to: Optional[str] = None,
    ) -> List[Asset]:
        """List assets with filters."""
        return self.registry.list_assets(
            category_id=category_id,
            asset_type=asset_type,
            status=status,
            location_id=location_id,
            assigned_to=assigned_to,
        )

    def get_available_assets(
        self, category_id: Optional[str] = None
    ) -> List[Asset]:
        """Get available assets."""
        return self.registry.get_available_assets(category_id=category_id)

    def assign_asset(
        self, asset_id: str, employee_id: str, department_id: Optional[str] = None
    ) -> Optional[Asset]:
        """Assign an asset to an employee."""
        asset = self.registry.get_asset(asset_id)
        if not asset or asset.status != AssetStatus.AVAILABLE:
            return None

        return self.registry.update_asset(
            asset_id,
            {
                "assigned_to": employee_id,
                "assigned_at": datetime.utcnow(),
                "department_id": department_id,
                "status": AssetStatus.IN_USE,
            },
        )

    def unassign_asset(self, asset_id: str) -> Optional[Asset]:
        """Unassign an asset from an employee."""
        return self.registry.update_asset(
            asset_id,
            {
                "assigned_to": None,
                "assigned_at": None,
                "status": AssetStatus.AVAILABLE,
            },
        )

    def move_asset(self, asset_id: str, location_id: str) -> Optional[Asset]:
        """Move an asset to a new location."""
        return self.registry.update_asset(asset_id, {"location_id": location_id})

    def update_condition(
        self, asset_id: str, condition: AssetCondition, notes: Optional[str] = None
    ) -> Optional[Asset]:
        """Update asset condition."""
        updates: Dict[str, Any] = {"condition": condition}
        if notes:
            updates["notes"] = notes
        return self.registry.update_asset(asset_id, updates)

    # Checkout Management
    def checkout_asset(
        self,
        asset_id: str,
        checked_out_to: str,
        checked_out_by: str,
        expected_return_date: Optional[datetime] = None,
        purpose: Optional[str] = None,
        **kwargs: Any,
    ) -> Optional[AssetCheckout]:
        """Check out an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset or asset.status not in (AssetStatus.AVAILABLE, AssetStatus.RESERVED):
            return None

        checkout = AssetCheckout(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            checked_out_to=checked_out_to,
            checked_out_by=checked_out_by,
            expected_return_date=expected_return_date,
            purpose=purpose,
            condition_at_checkout=asset.condition,
            **kwargs,
        )
        checkout = self.registry.create_checkout(checkout)

        # Update asset status
        self.registry.update_asset(
            asset_id,
            {
                "status": AssetStatus.CHECKED_OUT,
                "assigned_to": checked_out_to,
                "assigned_at": datetime.utcnow(),
            },
        )

        return checkout

    def return_asset(
        self,
        checkout_id: str,
        returned_to: str,
        condition_at_return: Optional[AssetCondition] = None,
        notes: Optional[str] = None,
    ) -> Optional[AssetCheckout]:
        """Return a checked-out asset."""
        checkout = self.registry.get_checkout(checkout_id)
        if not checkout or checkout.status != CheckoutStatus.ACTIVE:
            return None

        checkout = self.registry.update_checkout(
            checkout_id,
            {
                "status": CheckoutStatus.RETURNED,
                "actual_return_date": datetime.utcnow(),
                "returned_to": returned_to,
                "condition_at_return": condition_at_return,
                "notes": notes,
            },
        )

        # Update asset
        asset_updates: Dict[str, Any] = {
            "status": AssetStatus.AVAILABLE,
            "assigned_to": None,
            "assigned_at": None,
        }
        if condition_at_return:
            asset_updates["condition"] = condition_at_return

        self.registry.update_asset(checkout.asset_id, asset_updates)

        return checkout

    def get_checkout(self, checkout_id: str) -> Optional[AssetCheckout]:
        """Get a checkout by ID."""
        return self.registry.get_checkout(checkout_id)

    def list_checkouts(
        self,
        asset_id: Optional[str] = None,
        checked_out_to: Optional[str] = None,
        status: Optional[CheckoutStatus] = None,
    ) -> List[AssetCheckout]:
        """List checkouts."""
        return self.registry.list_checkouts(
            asset_id=asset_id,
            checked_out_to=checked_out_to,
            status=status,
        )

    def get_overdue_checkouts(self) -> List[AssetCheckout]:
        """Get all overdue checkouts."""
        return self.registry.get_overdue_checkouts()

    def get_user_checkouts(self, user_id: str) -> List[AssetCheckout]:
        """Get all active checkouts for a user."""
        return self.registry.list_checkouts(
            checked_out_to=user_id,
            status=CheckoutStatus.ACTIVE,
        )

    # Reservation Management
    def reserve_asset(
        self,
        asset_id: str,
        reserved_by: str,
        start_date: datetime,
        end_date: Optional[datetime] = None,
        purpose: Optional[str] = None,
        **kwargs: Any,
    ) -> Optional[AssetReservation]:
        """Reserve an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return None

        reservation = AssetReservation(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            reserved_by=reserved_by,
            start_date=start_date,
            end_date=end_date,
            purpose=purpose,
            **kwargs,
        )
        return self.registry.create_reservation(reservation)

    def confirm_reservation(self, reservation_id: str) -> Optional[AssetReservation]:
        """Confirm a reservation."""
        reservation = self.registry.get_reservation(reservation_id)
        if not reservation or reservation.status != ReservationStatus.PENDING:
            return None

        # Mark asset as reserved
        self.registry.update_asset(
            reservation.asset_id,
            {"status": AssetStatus.RESERVED},
        )

        return self.registry.update_reservation(
            reservation_id,
            {
                "status": ReservationStatus.CONFIRMED,
                "confirmed_at": datetime.utcnow(),
            },
        )

    def cancel_reservation(
        self, reservation_id: str, reason: Optional[str] = None
    ) -> Optional[AssetReservation]:
        """Cancel a reservation."""
        reservation = self.registry.get_reservation(reservation_id)
        if not reservation:
            return None

        # Make asset available again
        self.registry.update_asset(
            reservation.asset_id,
            {"status": AssetStatus.AVAILABLE},
        )

        return self.registry.update_reservation(
            reservation_id,
            {
                "status": ReservationStatus.CANCELLED,
                "cancelled_at": datetime.utcnow(),
                "cancellation_reason": reason,
            },
        )

    def list_reservations(
        self,
        asset_id: Optional[str] = None,
        reserved_by: Optional[str] = None,
        status: Optional[ReservationStatus] = None,
    ) -> List[AssetReservation]:
        """List reservations."""
        return self.registry.list_reservations(
            asset_id=asset_id,
            reserved_by=reserved_by,
            status=status,
        )

    # Maintenance Management
    def schedule_maintenance(
        self,
        asset_id: str,
        maintenance_type: MaintenanceType,
        scheduled_date: date,
        description: str = "",
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[MaintenanceRecord]:
        """Schedule maintenance for an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return None

        record = MaintenanceRecord(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            maintenance_type=maintenance_type,
            scheduled_date=scheduled_date,
            description=description,
            created_by=created_by,
            **kwargs,
        )
        return self.registry.create_maintenance(record)

    def start_maintenance(self, record_id: str) -> Optional[MaintenanceRecord]:
        """Start maintenance on an asset."""
        record = self.registry.get_maintenance(record_id)
        if not record:
            return None

        # Update asset status
        self.registry.update_asset(
            record.asset_id,
            {"status": AssetStatus.IN_MAINTENANCE},
        )

        return self.registry.update_maintenance(
            record_id,
            {"status": MaintenanceStatus.IN_PROGRESS},
        )

    def complete_maintenance(
        self,
        record_id: str,
        performed_by: str,
        cost: float = 0.0,
        parts_replaced: Optional[List[str]] = None,
        next_maintenance_date: Optional[date] = None,
        notes: Optional[str] = None,
    ) -> Optional[MaintenanceRecord]:
        """Complete maintenance on an asset."""
        record = self.registry.get_maintenance(record_id)
        if not record:
            return None

        record = self.registry.update_maintenance(
            record_id,
            {
                "status": MaintenanceStatus.COMPLETED,
                "completed_date": date.today(),
                "performed_by": performed_by,
                "cost": cost,
                "parts_replaced": parts_replaced or [],
                "next_maintenance_date": next_maintenance_date,
                "notes": notes,
            },
        )

        # Update asset
        asset_updates: Dict[str, Any] = {
            "status": AssetStatus.AVAILABLE,
            "last_maintenance_date": date.today(),
        }
        if next_maintenance_date:
            asset_updates["next_maintenance_date"] = next_maintenance_date

        self.registry.update_asset(record.asset_id, asset_updates)

        return record

    def get_maintenance_record(self, record_id: str) -> Optional[MaintenanceRecord]:
        """Get a maintenance record by ID."""
        return self.registry.get_maintenance(record_id)

    def list_maintenance(
        self,
        asset_id: Optional[str] = None,
        maintenance_type: Optional[MaintenanceType] = None,
        status: Optional[MaintenanceStatus] = None,
    ) -> List[MaintenanceRecord]:
        """List maintenance records."""
        return self.registry.list_maintenance(
            asset_id=asset_id,
            maintenance_type=maintenance_type,
            status=status,
        )

    def get_upcoming_maintenance(self, days: int = 30) -> List[MaintenanceRecord]:
        """Get upcoming maintenance."""
        return self.registry.get_upcoming_maintenance(days=days)

    def get_asset_maintenance_history(self, asset_id: str) -> List[MaintenanceRecord]:
        """Get maintenance history for an asset."""
        return self.registry.list_maintenance(asset_id=asset_id)

    # Depreciation Management
    def calculate_depreciation(
        self,
        asset_id: str,
        period_end: date,
        method: Optional[DepreciationMethod] = None,
    ) -> Optional[DepreciationRecord]:
        """Calculate depreciation for an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset or not asset.purchase_date or asset.purchase_price <= 0:
            return None

        category = self.registry.get_category(asset.category_id)
        if not category:
            return None

        method = method or category.depreciation_method
        useful_life_years = category.useful_life_years
        salvage_value = asset.purchase_price * (category.salvage_value_percent / 100)

        # Get last depreciation record
        existing = self.registry.list_depreciation(asset_id=asset_id)
        if existing:
            last_record = existing[-1]
            period_start = last_record.period_end + timedelta(days=1)
            accumulated = last_record.accumulated_depreciation
        else:
            period_start = asset.purchase_date
            accumulated = 0.0

        # Calculate depreciation (simplified straight-line)
        depreciable_amount = asset.purchase_price - salvage_value
        annual_depreciation = depreciable_amount / useful_life_years
        days_in_period = (period_end - period_start).days + 1
        period_depreciation = (annual_depreciation / 365) * days_in_period

        new_accumulated = accumulated + period_depreciation
        book_value = asset.purchase_price - new_accumulated

        record = DepreciationRecord(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            period_start=period_start,
            period_end=period_end,
            method=method,
            depreciation_amount=period_depreciation,
            accumulated_depreciation=new_accumulated,
            book_value=max(book_value, salvage_value),
        )
        record = self.registry.create_depreciation(record)

        # Update asset
        self.registry.update_asset(
            asset_id,
            {
                "current_value": record.book_value,
                "accumulated_depreciation": new_accumulated,
            },
        )

        return record

    def get_depreciation_history(self, asset_id: str) -> List[DepreciationRecord]:
        """Get depreciation history for an asset."""
        return self.registry.list_depreciation(asset_id=asset_id)

    # Warranty Management
    def add_warranty(
        self,
        asset_id: str,
        provider: str,
        start_date: date,
        end_date: Optional[date] = None,
        warranty_type: str = "standard",
        coverage_details: Optional[str] = None,
        **kwargs: Any,
    ) -> Optional[Warranty]:
        """Add warranty to an asset."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return None

        warranty = Warranty(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            provider=provider,
            warranty_type=warranty_type,
            start_date=start_date,
            end_date=end_date,
            coverage_details=coverage_details,
            **kwargs,
        )
        warranty = self.registry.create_warranty(warranty)

        # Update asset warranty expiry
        if end_date:
            self.registry.update_asset(asset_id, {"warranty_expiry": end_date})

        return warranty

    def get_warranty(self, warranty_id: str) -> Optional[Warranty]:
        """Get a warranty by ID."""
        return self.registry.get_warranty(warranty_id)

    def list_warranties(
        self, asset_id: Optional[str] = None, active: Optional[bool] = None
    ) -> List[Warranty]:
        """List warranties."""
        return self.registry.list_warranties(asset_id=asset_id, active=active)

    def get_expiring_warranties(self, days: int = 30) -> List[Warranty]:
        """Get warranties expiring soon."""
        return self.registry.get_expiring_warranties(days=days)

    # Audit Management
    def create_audit(
        self,
        name: str,
        scheduled_date: date,
        location_id: Optional[str] = None,
        category_id: Optional[str] = None,
        created_by: str = "",
        **kwargs: Any,
    ) -> InventoryAudit:
        """Create an inventory audit."""
        # Count assets to be audited
        assets = self.registry.list_assets(
            location_id=location_id,
            category_id=category_id,
        )

        audit = InventoryAudit(
            id=str(uuid.uuid4()),
            name=name,
            scheduled_date=scheduled_date,
            location_id=location_id,
            category_id=category_id,
            total_assets=len(assets),
            created_by=created_by,
            **kwargs,
        )
        audit = self.registry.create_audit(audit)

        # Create audit items for each asset
        for asset in assets:
            item = AuditItem(
                id=str(uuid.uuid4()),
                audit_id=audit.id,
                asset_id=asset.id,
                expected_location=asset.location_id,
            )
            self.registry.create_audit_item(item)

        return audit

    def start_audit(self, audit_id: str, auditors: List[str]) -> Optional[InventoryAudit]:
        """Start an audit."""
        return self.registry.update_audit(
            audit_id,
            {
                "status": AuditStatus.IN_PROGRESS,
                "started_at": datetime.utcnow(),
                "audited_by": auditors,
            },
        )

    def scan_asset(
        self,
        audit_id: str,
        asset_id: str,
        result: AuditResult,
        scanned_by: str,
        actual_location: Optional[str] = None,
        condition_noted: Optional[AssetCondition] = None,
        notes: Optional[str] = None,
    ) -> Optional[AuditItem]:
        """Record an asset scan during audit."""
        # Find the audit item
        items = self.registry.list_audit_items(audit_id)
        item = next((i for i in items if i.asset_id == asset_id), None)
        if not item:
            return None

        item = self.registry.update_audit_item(
            item.id,
            {
                "result": result,
                "scanned_at": datetime.utcnow(),
                "scanned_by": scanned_by,
                "actual_location": actual_location,
                "condition_noted": condition_noted,
                "notes": notes,
            },
        )

        # Update audit counts
        audit = self.registry.get_audit(audit_id)
        if audit:
            counts = {
                "verified_count": sum(
                    1 for i in self.registry.list_audit_items(audit_id)
                    if i.result == AuditResult.VERIFIED
                ),
                "missing_count": sum(
                    1 for i in self.registry.list_audit_items(audit_id)
                    if i.result == AuditResult.MISSING
                ),
                "damaged_count": sum(
                    1 for i in self.registry.list_audit_items(audit_id)
                    if i.result == AuditResult.DAMAGED
                ),
                "discrepancy_count": sum(
                    1 for i in self.registry.list_audit_items(audit_id)
                    if i.result == AuditResult.LOCATION_MISMATCH
                ),
            }
            self.registry.update_audit(audit_id, counts)

        return item

    def complete_audit(self, audit_id: str) -> Optional[InventoryAudit]:
        """Complete an audit."""
        return self.registry.update_audit(
            audit_id,
            {
                "status": AuditStatus.COMPLETED,
                "completed_at": datetime.utcnow(),
            },
        )

    def get_audit(self, audit_id: str) -> Optional[InventoryAudit]:
        """Get an audit by ID."""
        return self.registry.get_audit(audit_id)

    def list_audits(self, status: Optional[AuditStatus] = None) -> List[InventoryAudit]:
        """List audits."""
        return self.registry.list_audits(status=status)

    def get_audit_items(
        self, audit_id: str, result: Optional[AuditResult] = None
    ) -> List[AuditItem]:
        """Get audit items."""
        return self.registry.list_audit_items(audit_id, result=result)

    # Disposal Management
    def initiate_disposal(
        self,
        asset_id: str,
        disposal_method: DisposalMethod,
        reason: str,
        created_by: str = "",
        **kwargs: Any,
    ) -> Optional[AssetDisposal]:
        """Initiate asset disposal."""
        asset = self.registry.get_asset(asset_id)
        if not asset:
            return None

        disposal = AssetDisposal(
            id=str(uuid.uuid4()),
            asset_id=asset_id,
            disposal_method=disposal_method,
            reason=reason,
            created_by=created_by,
            **kwargs,
        )
        disposal = self.registry.create_disposal(disposal)

        # Update asset status
        self.registry.update_asset(
            asset_id,
            {"status": AssetStatus.PENDING_DISPOSAL},
        )

        return disposal

    def approve_disposal(
        self, disposal_id: str, approved_by: str
    ) -> Optional[AssetDisposal]:
        """Approve a disposal."""
        return self.registry.update_disposal(
            disposal_id,
            {
                "status": "approved",
                "approved_by": approved_by,
                "approved_at": datetime.utcnow(),
            },
        )

    def complete_disposal(
        self,
        disposal_id: str,
        completed_by: str,
        proceeds: float = 0.0,
        disposal_cost: float = 0.0,
        recipient: Optional[str] = None,
    ) -> Optional[AssetDisposal]:
        """Complete a disposal."""
        disposal = self.registry.get_disposal(disposal_id)
        if not disposal or disposal.status != "approved":
            return None

        disposal = self.registry.update_disposal(
            disposal_id,
            {
                "status": "completed",
                "disposal_date": date.today(),
                "completed_by": completed_by,
                "completed_at": datetime.utcnow(),
                "proceeds": proceeds,
                "disposal_cost": disposal_cost,
                "recipient": recipient,
            },
        )

        # Update asset status
        self.registry.update_asset(
            disposal.asset_id,
            {"status": AssetStatus.DISPOSED},
        )

        return disposal

    def get_disposal(self, disposal_id: str) -> Optional[AssetDisposal]:
        """Get a disposal by ID."""
        return self.registry.get_disposal(disposal_id)

    def list_disposals(
        self, asset_id: Optional[str] = None, status: Optional[str] = None
    ) -> List[AssetDisposal]:
        """List disposals."""
        return self.registry.list_disposals(asset_id=asset_id, status=status)

    # Location Management
    def create_location(
        self,
        name: str,
        building: Optional[str] = None,
        floor: Optional[str] = None,
        room: Optional[str] = None,
        **kwargs: Any,
    ) -> Location:
        """Create a storage location."""
        location = Location(
            id=str(uuid.uuid4()),
            name=name,
            building=building,
            floor=floor,
            room=room,
            **kwargs,
        )
        return self.registry.create_location(location)

    def get_location(self, location_id: str) -> Optional[Location]:
        """Get a location by ID."""
        return self.registry.get_location(location_id)

    def list_locations(self, active: Optional[bool] = None) -> List[Location]:
        """List locations."""
        return self.registry.list_locations(active=active)

    # Vendor Management
    def create_vendor(
        self,
        name: str,
        email: Optional[str] = None,
        phone: Optional[str] = None,
        vendor_type: str = "supplier",
        **kwargs: Any,
    ) -> Vendor:
        """Create a vendor."""
        vendor = Vendor(
            id=str(uuid.uuid4()),
            name=name,
            email=email,
            phone=phone,
            vendor_type=vendor_type,
            **kwargs,
        )
        return self.registry.create_vendor(vendor)

    def get_vendor(self, vendor_id: str) -> Optional[Vendor]:
        """Get a vendor by ID."""
        return self.registry.get_vendor(vendor_id)

    def list_vendors(self, active: Optional[bool] = None) -> List[Vendor]:
        """List vendors."""
        return self.registry.list_vendors(active=active)

    # Analytics
    def generate_analytics(
        self, period_start: date, period_end: date
    ) -> InventoryAnalytics:
        """Generate inventory analytics."""
        assets = self.registry.list_assets()

        # Count by status
        assets_by_status: Dict[str, int] = {}
        assets_by_type: Dict[str, int] = {}
        assets_by_category: Dict[str, int] = {}
        assets_by_location: Dict[str, int] = {}
        total_value = 0.0

        for asset in assets:
            status_key = asset.status.value
            assets_by_status[status_key] = assets_by_status.get(status_key, 0) + 1

            type_key = asset.asset_type.value
            assets_by_type[type_key] = assets_by_type.get(type_key, 0) + 1

            assets_by_category[asset.category_id] = (
                assets_by_category.get(asset.category_id, 0) + 1
            )

            if asset.location_id:
                assets_by_location[asset.location_id] = (
                    assets_by_location.get(asset.location_id, 0) + 1
                )

            total_value += asset.current_value

        # Count checkouts
        checkouts = self.registry.list_checkouts()
        checkouts_in_period = [
            c for c in checkouts
            if c.checkout_date.date() >= period_start
            and c.checkout_date.date() <= period_end
        ]
        returns_in_period = [
            c for c in checkouts
            if c.actual_return_date
            and c.actual_return_date.date() >= period_start
            and c.actual_return_date.date() <= period_end
        ]
        overdue = len(self.registry.get_overdue_checkouts())

        # Maintenance
        maintenance = self.registry.list_maintenance()
        maintenance_in_period = [
            m for m in maintenance
            if m.completed_date
            and m.completed_date >= period_start
            and m.completed_date <= period_end
        ]
        maintenance_cost = sum(m.cost for m in maintenance_in_period)

        # Disposals
        disposals = self.registry.list_disposals(status="completed")
        disposals_in_period = [
            d for d in disposals
            if d.disposal_date
            and d.disposal_date >= period_start
            and d.disposal_date <= period_end
        ]
        disposal_proceeds = sum(d.net_proceeds for d in disposals_in_period)

        # Utilization rate (assets in use vs total)
        in_use = assets_by_status.get("in_use", 0) + assets_by_status.get("checked_out", 0)
        total = len(assets)
        utilization_rate = (in_use / total * 100) if total > 0 else 0.0

        analytics = InventoryAnalytics(
            id=str(uuid.uuid4()),
            period_start=period_start,
            period_end=period_end,
            total_assets=len(assets),
            total_value=total_value,
            assets_by_status=assets_by_status,
            assets_by_type=assets_by_type,
            assets_by_category=assets_by_category,
            assets_by_location=assets_by_location,
            checkouts_count=len(checkouts_in_period),
            returns_count=len(returns_in_period),
            overdue_checkouts=overdue,
            maintenance_count=len(maintenance_in_period),
            maintenance_cost=maintenance_cost,
            disposals_count=len(disposals_in_period),
            disposal_proceeds=disposal_proceeds,
            utilization_rate=utilization_rate,
        )
        return self.registry.create_analytics(analytics)


# ============================================================
# Global Instance
# ============================================================

_inventory_manager: Optional[InventoryManager] = None


def get_inventory_manager() -> InventoryManager:
    """Get the global inventory manager instance."""
    global _inventory_manager
    if _inventory_manager is None:
        _inventory_manager = InventoryManager()
    return _inventory_manager


def set_inventory_manager(manager: InventoryManager) -> None:
    """Set the global inventory manager instance."""
    global _inventory_manager
    _inventory_manager = manager


def reset_inventory_manager() -> None:
    """Reset the global inventory manager instance."""
    global _inventory_manager
    _inventory_manager = None
