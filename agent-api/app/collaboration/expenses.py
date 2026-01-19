"""
Expense Management module for enterprise collaboration.

This module provides comprehensive expense management functionality including:
- Expense tracking and categorization
- Receipt management and OCR support
- Expense reports and approval workflows
- Reimbursement tracking
- Expense policies and compliance
- Mileage and per diem tracking
- Analytics and reporting
"""

from dataclasses import dataclass, field
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


# ============================================================
# Enums
# ============================================================

class ExpenseType(Enum):
    """Types of expenses."""
    TRAVEL = "travel"
    MEALS = "meals"
    LODGING = "lodging"
    TRANSPORTATION = "transportation"
    MILEAGE = "mileage"
    OFFICE_SUPPLIES = "office_supplies"
    EQUIPMENT = "equipment"
    SOFTWARE = "software"
    TRAINING = "training"
    CONFERENCE = "conference"
    ENTERTAINMENT = "entertainment"
    COMMUNICATION = "communication"
    PROFESSIONAL_SERVICES = "professional_services"
    MARKETING = "marketing"
    OTHER = "other"


class ExpenseStatus(Enum):
    """Status of an expense."""
    DRAFT = "draft"
    PENDING = "pending"
    SUBMITTED = "submitted"
    APPROVED = "approved"
    REJECTED = "rejected"
    REIMBURSED = "reimbursed"
    CANCELLED = "cancelled"


class ReportStatus(Enum):
    """Status of an expense report."""
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    APPROVED = "approved"
    PARTIALLY_APPROVED = "partially_approved"
    REJECTED = "rejected"
    PAID = "paid"
    CANCELLED = "cancelled"


class PaymentMethod(Enum):
    """Payment methods for expenses."""
    CASH = "cash"
    PERSONAL_CARD = "personal_card"
    CORPORATE_CARD = "corporate_card"
    BANK_TRANSFER = "bank_transfer"
    CHECK = "check"
    PREPAID = "prepaid"
    OTHER = "other"


class ReceiptStatus(Enum):
    """Status of a receipt."""
    PENDING = "pending"
    VERIFIED = "verified"
    REJECTED = "rejected"
    MISSING = "missing"


class ReimbursementMethod(Enum):
    """Methods for reimbursement."""
    DIRECT_DEPOSIT = "direct_deposit"
    CHECK = "check"
    PAYROLL = "payroll"
    WIRE_TRANSFER = "wire_transfer"
    CASH = "cash"


class ReimbursementStatus(Enum):
    """Status of a reimbursement."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PolicyType(Enum):
    """Types of expense policies."""
    SPENDING_LIMIT = "spending_limit"
    CATEGORY_LIMIT = "category_limit"
    APPROVAL_THRESHOLD = "approval_threshold"
    RECEIPT_REQUIRED = "receipt_required"
    ADVANCE_BOOKING = "advance_booking"
    VENDOR_RESTRICTION = "vendor_restriction"
    PER_DIEM = "per_diem"
    MILEAGE_RATE = "mileage_rate"


class ViolationSeverity(Enum):
    """Severity of policy violations."""
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"


class ApprovalAction(Enum):
    """Actions in approval workflow."""
    APPROVE = "approve"
    REJECT = "reject"
    REQUEST_INFO = "request_info"
    ESCALATE = "escalate"
    DELEGATE = "delegate"


class MileageUnit(Enum):
    """Units for mileage tracking."""
    MILES = "miles"
    KILOMETERS = "kilometers"


# ============================================================
# Data Models
# ============================================================

@dataclass
class Receipt:
    """Receipt attached to an expense."""
    id: str = field(default_factory=lambda: str(uuid4()))
    expense_id: str = ""
    file_url: str = ""
    file_name: str = ""
    file_type: str = ""
    file_size: int = 0
    status: ReceiptStatus = ReceiptStatus.PENDING
    # OCR extracted data
    ocr_vendor: Optional[str] = None
    ocr_amount: Optional[Decimal] = None
    ocr_date: Optional[date] = None
    ocr_tax: Optional[Decimal] = None
    ocr_confidence: float = 0.0
    # Verification
    verified_by: Optional[str] = None
    verified_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    # Metadata
    uploaded_by: str = ""
    uploaded_at: datetime = field(default_factory=datetime.utcnow)
    notes: Optional[str] = None


@dataclass
class ExpenseLineItem:
    """Line item within an expense."""
    id: str = field(default_factory=lambda: str(uuid4()))
    expense_id: str = ""
    description: str = ""
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    total: Decimal = Decimal("0")
    tax_amount: Optional[Decimal] = None
    category: Optional[str] = None


@dataclass
class Expense:
    """Individual expense entry."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    user_id: str = ""
    report_id: Optional[str] = None
    # Expense details
    expense_type: ExpenseType = ExpenseType.OTHER
    description: str = ""
    vendor: Optional[str] = None
    amount: Decimal = Decimal("0")
    currency: str = "USD"
    exchange_rate: Optional[Decimal] = None
    original_amount: Optional[Decimal] = None
    original_currency: Optional[str] = None
    # Date and location
    expense_date: date = field(default_factory=date.today)
    location: Optional[str] = None
    country: Optional[str] = None
    # Payment
    payment_method: PaymentMethod = PaymentMethod.PERSONAL_CARD
    is_billable: bool = False
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    cost_center: Optional[str] = None
    # Tax
    tax_amount: Optional[Decimal] = None
    tax_rate: Optional[Decimal] = None
    is_tax_deductible: bool = True
    # Status
    status: ExpenseStatus = ExpenseStatus.DRAFT
    # Mileage specific
    is_mileage: bool = False
    mileage_distance: Optional[Decimal] = None
    mileage_unit: MileageUnit = MileageUnit.MILES
    mileage_rate: Optional[Decimal] = None
    start_location: Optional[str] = None
    end_location: Optional[str] = None
    # Per diem specific
    is_per_diem: bool = False
    per_diem_rate: Optional[Decimal] = None
    per_diem_days: Optional[Decimal] = None
    # Metadata
    tags: List[str] = field(default_factory=list)
    custom_fields: Dict[str, Any] = field(default_factory=dict)
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)
    submitted_at: Optional[datetime] = None


@dataclass
class ExpenseReport:
    """Collection of expenses for approval."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    user_id: str = ""
    title: str = ""
    description: Optional[str] = None
    status: ReportStatus = ReportStatus.DRAFT
    # Period
    period_start: Optional[date] = None
    period_end: Optional[date] = None
    # Amounts
    total_amount: Decimal = Decimal("0")
    approved_amount: Decimal = Decimal("0")
    rejected_amount: Decimal = Decimal("0")
    currency: str = "USD"
    # Business purpose
    business_purpose: Optional[str] = None
    project_id: Optional[str] = None
    client_id: Optional[str] = None
    trip_id: Optional[str] = None
    # Approval
    submitted_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    approved_by: Optional[str] = None
    rejection_reason: Optional[str] = None
    # Reimbursement
    reimbursement_id: Optional[str] = None
    # Metadata
    expense_count: int = 0
    receipt_count: int = 0
    violation_count: int = 0
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ApprovalStep:
    """Step in the approval workflow."""
    id: str = field(default_factory=lambda: str(uuid4()))
    report_id: str = ""
    step_order: int = 0
    approver_id: str = ""
    approver_role: Optional[str] = None
    action: Optional[ApprovalAction] = None
    comments: Optional[str] = None
    # Status
    is_current: bool = False
    is_completed: bool = False
    # Timing
    assigned_at: datetime = field(default_factory=datetime.utcnow)
    due_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Delegation
    delegated_to: Optional[str] = None
    delegated_at: Optional[datetime] = None


@dataclass
class Reimbursement:
    """Reimbursement payment record."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    user_id: str = ""
    report_id: str = ""
    amount: Decimal = Decimal("0")
    currency: str = "USD"
    method: ReimbursementMethod = ReimbursementMethod.DIRECT_DEPOSIT
    status: ReimbursementStatus = ReimbursementStatus.PENDING
    # Payment details
    reference_number: Optional[str] = None
    bank_account_last4: Optional[str] = None
    check_number: Optional[str] = None
    # Timing
    scheduled_date: Optional[date] = None
    processed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    # Failure handling
    failure_reason: Optional[str] = None
    retry_count: int = 0
    # Metadata
    notes: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExpensePolicy:
    """Policy for expense management."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    name: str = ""
    description: Optional[str] = None
    policy_type: PolicyType = PolicyType.SPENDING_LIMIT
    is_active: bool = True
    # Scope
    applies_to_all: bool = True
    applies_to_roles: List[str] = field(default_factory=list)
    applies_to_users: List[str] = field(default_factory=list)
    applies_to_departments: List[str] = field(default_factory=list)
    # Policy rules
    expense_types: List[ExpenseType] = field(default_factory=list)
    limit_amount: Optional[Decimal] = None
    limit_currency: str = "USD"
    limit_period: Optional[str] = None  # daily, weekly, monthly, yearly, per_trip
    # Per diem and mileage rates
    per_diem_rates: Dict[str, Decimal] = field(default_factory=dict)  # country/city -> rate
    mileage_rate: Optional[Decimal] = None
    mileage_unit: MileageUnit = MileageUnit.MILES
    # Receipt requirements
    receipt_threshold: Optional[Decimal] = None  # Amount above which receipt is required
    # Approval thresholds
    auto_approve_threshold: Optional[Decimal] = None
    manager_approve_threshold: Optional[Decimal] = None
    executive_approve_threshold: Optional[Decimal] = None
    # Violations
    violation_severity: ViolationSeverity = ViolationSeverity.WARNING
    block_submission: bool = False
    # Metadata
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None
    created_by: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PolicyViolation:
    """Violation of an expense policy."""
    id: str = field(default_factory=lambda: str(uuid4()))
    expense_id: str = ""
    report_id: Optional[str] = None
    policy_id: str = ""
    policy_name: str = ""
    violation_type: str = ""
    description: str = ""
    severity: ViolationSeverity = ViolationSeverity.WARNING
    # Amounts
    limit_amount: Optional[Decimal] = None
    actual_amount: Optional[Decimal] = None
    overage_amount: Optional[Decimal] = None
    # Resolution
    is_resolved: bool = False
    resolution_notes: Optional[str] = None
    resolved_by: Optional[str] = None
    resolved_at: Optional[datetime] = None
    # Approval override
    is_approved_override: bool = False
    override_by: Optional[str] = None
    override_reason: Optional[str] = None
    # Metadata
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExpenseCategory:
    """Category for organizing expenses."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    name: str = ""
    description: Optional[str] = None
    parent_id: Optional[str] = None
    expense_type: Optional[ExpenseType] = None
    gl_code: Optional[str] = None  # General ledger code
    tax_code: Optional[str] = None
    is_active: bool = True
    requires_receipt: bool = False
    requires_approval: bool = True
    order: int = 0
    icon: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class MileageLog:
    """Log entry for mileage tracking."""
    id: str = field(default_factory=lambda: str(uuid4()))
    expense_id: str = ""
    user_id: str = ""
    date: date = field(default_factory=date.today)
    start_location: str = ""
    end_location: str = ""
    distance: Decimal = Decimal("0")
    unit: MileageUnit = MileageUnit.MILES
    purpose: str = ""
    rate: Decimal = Decimal("0")
    amount: Decimal = Decimal("0")
    # GPS data if available
    start_lat: Optional[float] = None
    start_lng: Optional[float] = None
    end_lat: Optional[float] = None
    end_lng: Optional[float] = None
    route_polyline: Optional[str] = None
    # Metadata
    vehicle_id: Optional[str] = None
    odometer_start: Optional[int] = None
    odometer_end: Optional[int] = None
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class PerDiemAllowance:
    """Per diem allowance configuration."""
    id: str = field(default_factory=lambda: str(uuid4()))
    workspace_id: str = ""
    location: str = ""  # City, state, or country
    country_code: Optional[str] = None
    # Rates
    meals_rate: Decimal = Decimal("0")
    lodging_rate: Decimal = Decimal("0")
    incidentals_rate: Decimal = Decimal("0")
    total_rate: Decimal = Decimal("0")
    currency: str = "USD"
    # Breakdown (optional)
    breakfast_rate: Optional[Decimal] = None
    lunch_rate: Optional[Decimal] = None
    dinner_rate: Optional[Decimal] = None
    # Effective dates
    effective_from: date = field(default_factory=date.today)
    effective_to: Optional[date] = None
    # Source
    source: Optional[str] = None  # e.g., "GSA", "Company Policy"
    is_active: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)
    updated_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ExpenseAnalytics:
    """Analytics for expense reporting."""
    workspace_id: str = ""
    period_start: date = field(default_factory=date.today)
    period_end: date = field(default_factory=date.today)
    # Totals
    total_expenses: int = 0
    total_amount: Decimal = Decimal("0")
    total_reports: int = 0
    # By status
    expenses_by_status: Dict[str, int] = field(default_factory=dict)
    amount_by_status: Dict[str, Decimal] = field(default_factory=dict)
    # By type
    expenses_by_type: Dict[str, int] = field(default_factory=dict)
    amount_by_type: Dict[str, Decimal] = field(default_factory=dict)
    # By user
    expenses_by_user: Dict[str, int] = field(default_factory=dict)
    amount_by_user: Dict[str, Decimal] = field(default_factory=dict)
    # Processing metrics
    average_approval_time_hours: float = 0.0
    average_reimbursement_time_hours: float = 0.0
    violation_count: int = 0
    receipt_compliance_rate: float = 0.0
    # Trends
    daily_totals: Dict[str, Decimal] = field(default_factory=dict)
    calculated_at: datetime = field(default_factory=datetime.utcnow)


# ============================================================
# Registry
# ============================================================

class ExpenseRegistry:
    """Registry for managing expenses and related data."""

    def __init__(self) -> None:
        self._expenses: Dict[str, Expense] = {}
        self._receipts: Dict[str, Receipt] = {}
        self._line_items: Dict[str, ExpenseLineItem] = {}
        self._reports: Dict[str, ExpenseReport] = {}
        self._approval_steps: Dict[str, ApprovalStep] = {}
        self._reimbursements: Dict[str, Reimbursement] = {}
        self._policies: Dict[str, ExpensePolicy] = {}
        self._violations: Dict[str, PolicyViolation] = {}
        self._categories: Dict[str, ExpenseCategory] = {}
        self._mileage_logs: Dict[str, MileageLog] = {}
        self._per_diem_allowances: Dict[str, PerDiemAllowance] = {}

    def clear(self) -> None:
        """Clear all data."""
        self._expenses.clear()
        self._receipts.clear()
        self._line_items.clear()
        self._reports.clear()
        self._approval_steps.clear()
        self._reimbursements.clear()
        self._policies.clear()
        self._violations.clear()
        self._categories.clear()
        self._mileage_logs.clear()
        self._per_diem_allowances.clear()

    # Expense CRUD
    def create_expense(self, expense: Expense) -> Expense:
        """Create a new expense."""
        self._expenses[expense.id] = expense
        return expense

    def get_expense(self, expense_id: str) -> Optional[Expense]:
        """Get an expense by ID."""
        return self._expenses.get(expense_id)

    def update_expense(self, expense: Expense) -> Optional[Expense]:
        """Update an expense."""
        if expense.id not in self._expenses:
            return None
        expense.updated_at = datetime.utcnow()
        self._expenses[expense.id] = expense
        return expense

    def delete_expense(self, expense_id: str) -> bool:
        """Delete an expense."""
        if expense_id not in self._expenses:
            return False
        # Delete related data
        self._receipts = {k: v for k, v in self._receipts.items() if v.expense_id != expense_id}
        self._line_items = {k: v for k, v in self._line_items.items() if v.expense_id != expense_id}
        self._violations = {k: v for k, v in self._violations.items() if v.expense_id != expense_id}
        del self._expenses[expense_id]
        return True

    def list_expenses(
        self,
        workspace_id: Optional[str] = None,
        user_id: Optional[str] = None,
        report_id: Optional[str] = None,
        status: Optional[ExpenseStatus] = None,
        expense_type: Optional[ExpenseType] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Expense]:
        """List expenses with optional filters."""
        expenses = list(self._expenses.values())
        if workspace_id:
            expenses = [e for e in expenses if e.workspace_id == workspace_id]
        if user_id:
            expenses = [e for e in expenses if e.user_id == user_id]
        if report_id:
            expenses = [e for e in expenses if e.report_id == report_id]
        if status:
            expenses = [e for e in expenses if e.status == status]
        if expense_type:
            expenses = [e for e in expenses if e.expense_type == expense_type]
        if date_from:
            expenses = [e for e in expenses if e.expense_date >= date_from]
        if date_to:
            expenses = [e for e in expenses if e.expense_date <= date_to]
        return sorted(expenses, key=lambda e: e.expense_date, reverse=True)

    # Receipt CRUD
    def create_receipt(self, receipt: Receipt) -> Receipt:
        """Create a receipt."""
        self._receipts[receipt.id] = receipt
        return receipt

    def get_receipt(self, receipt_id: str) -> Optional[Receipt]:
        """Get a receipt by ID."""
        return self._receipts.get(receipt_id)

    def update_receipt(self, receipt: Receipt) -> Optional[Receipt]:
        """Update a receipt."""
        if receipt.id not in self._receipts:
            return None
        self._receipts[receipt.id] = receipt
        return receipt

    def delete_receipt(self, receipt_id: str) -> bool:
        """Delete a receipt."""
        if receipt_id not in self._receipts:
            return False
        del self._receipts[receipt_id]
        return True

    def get_expense_receipts(self, expense_id: str) -> List[Receipt]:
        """Get receipts for an expense."""
        return [r for r in self._receipts.values() if r.expense_id == expense_id]

    # Report CRUD
    def create_report(self, report: ExpenseReport) -> ExpenseReport:
        """Create an expense report."""
        self._reports[report.id] = report
        return report

    def get_report(self, report_id: str) -> Optional[ExpenseReport]:
        """Get a report by ID."""
        return self._reports.get(report_id)

    def update_report(self, report: ExpenseReport) -> Optional[ExpenseReport]:
        """Update a report."""
        if report.id not in self._reports:
            return None
        report.updated_at = datetime.utcnow()
        self._reports[report.id] = report
        return report

    def delete_report(self, report_id: str) -> bool:
        """Delete a report."""
        if report_id not in self._reports:
            return False
        # Remove report reference from expenses
        for expense in self._expenses.values():
            if expense.report_id == report_id:
                expense.report_id = None
        # Delete related data
        self._approval_steps = {k: v for k, v in self._approval_steps.items() if v.report_id != report_id}
        del self._reports[report_id]
        return True

    def list_reports(
        self,
        workspace_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[ReportStatus] = None,
        approver_id: Optional[str] = None,
    ) -> List[ExpenseReport]:
        """List reports with optional filters."""
        reports = list(self._reports.values())
        if workspace_id:
            reports = [r for r in reports if r.workspace_id == workspace_id]
        if user_id:
            reports = [r for r in reports if r.user_id == user_id]
        if status:
            reports = [r for r in reports if r.status == status]
        if approver_id:
            # Filter by current approver
            approver_report_ids = {
                s.report_id for s in self._approval_steps.values()
                if s.approver_id == approver_id and s.is_current
            }
            reports = [r for r in reports if r.id in approver_report_ids]
        return sorted(reports, key=lambda r: r.created_at, reverse=True)

    # Approval Step CRUD
    def create_approval_step(self, step: ApprovalStep) -> ApprovalStep:
        """Create an approval step."""
        self._approval_steps[step.id] = step
        return step

    def get_approval_step(self, step_id: str) -> Optional[ApprovalStep]:
        """Get an approval step by ID."""
        return self._approval_steps.get(step_id)

    def update_approval_step(self, step: ApprovalStep) -> Optional[ApprovalStep]:
        """Update an approval step."""
        if step.id not in self._approval_steps:
            return None
        self._approval_steps[step.id] = step
        return step

    def get_report_approval_steps(self, report_id: str) -> List[ApprovalStep]:
        """Get approval steps for a report."""
        steps = [s for s in self._approval_steps.values() if s.report_id == report_id]
        return sorted(steps, key=lambda s: s.step_order)

    def get_pending_approvals(self, approver_id: str) -> List[ApprovalStep]:
        """Get pending approvals for an approver."""
        return [
            s for s in self._approval_steps.values()
            if s.approver_id == approver_id and s.is_current and not s.is_completed
        ]

    # Reimbursement CRUD
    def create_reimbursement(self, reimbursement: Reimbursement) -> Reimbursement:
        """Create a reimbursement."""
        self._reimbursements[reimbursement.id] = reimbursement
        return reimbursement

    def get_reimbursement(self, reimbursement_id: str) -> Optional[Reimbursement]:
        """Get a reimbursement by ID."""
        return self._reimbursements.get(reimbursement_id)

    def update_reimbursement(self, reimbursement: Reimbursement) -> Optional[Reimbursement]:
        """Update a reimbursement."""
        if reimbursement.id not in self._reimbursements:
            return None
        reimbursement.updated_at = datetime.utcnow()
        self._reimbursements[reimbursement.id] = reimbursement
        return reimbursement

    def list_reimbursements(
        self,
        workspace_id: Optional[str] = None,
        user_id: Optional[str] = None,
        status: Optional[ReimbursementStatus] = None,
    ) -> List[Reimbursement]:
        """List reimbursements with optional filters."""
        reimbursements = list(self._reimbursements.values())
        if workspace_id:
            reimbursements = [r for r in reimbursements if r.workspace_id == workspace_id]
        if user_id:
            reimbursements = [r for r in reimbursements if r.user_id == user_id]
        if status:
            reimbursements = [r for r in reimbursements if r.status == status]
        return sorted(reimbursements, key=lambda r: r.created_at, reverse=True)

    # Policy CRUD
    def create_policy(self, policy: ExpensePolicy) -> ExpensePolicy:
        """Create an expense policy."""
        self._policies[policy.id] = policy
        return policy

    def get_policy(self, policy_id: str) -> Optional[ExpensePolicy]:
        """Get a policy by ID."""
        return self._policies.get(policy_id)

    def update_policy(self, policy: ExpensePolicy) -> Optional[ExpensePolicy]:
        """Update a policy."""
        if policy.id not in self._policies:
            return None
        policy.updated_at = datetime.utcnow()
        self._policies[policy.id] = policy
        return policy

    def delete_policy(self, policy_id: str) -> bool:
        """Delete a policy."""
        if policy_id not in self._policies:
            return False
        del self._policies[policy_id]
        return True

    def list_policies(
        self,
        workspace_id: Optional[str] = None,
        policy_type: Optional[PolicyType] = None,
        is_active: Optional[bool] = None,
    ) -> List[ExpensePolicy]:
        """List policies with optional filters."""
        policies = list(self._policies.values())
        if workspace_id:
            policies = [p for p in policies if p.workspace_id == workspace_id]
        if policy_type:
            policies = [p for p in policies if p.policy_type == policy_type]
        if is_active is not None:
            policies = [p for p in policies if p.is_active == is_active]
        return policies

    # Violation CRUD
    def create_violation(self, violation: PolicyViolation) -> PolicyViolation:
        """Create a policy violation."""
        self._violations[violation.id] = violation
        return violation

    def get_violation(self, violation_id: str) -> Optional[PolicyViolation]:
        """Get a violation by ID."""
        return self._violations.get(violation_id)

    def update_violation(self, violation: PolicyViolation) -> Optional[PolicyViolation]:
        """Update a violation."""
        if violation.id not in self._violations:
            return None
        self._violations[violation.id] = violation
        return violation

    def get_expense_violations(self, expense_id: str) -> List[PolicyViolation]:
        """Get violations for an expense."""
        return [v for v in self._violations.values() if v.expense_id == expense_id]

    def get_report_violations(self, report_id: str) -> List[PolicyViolation]:
        """Get violations for a report."""
        return [v for v in self._violations.values() if v.report_id == report_id]

    # Category CRUD
    def create_category(self, category: ExpenseCategory) -> ExpenseCategory:
        """Create an expense category."""
        self._categories[category.id] = category
        return category

    def get_category(self, category_id: str) -> Optional[ExpenseCategory]:
        """Get a category by ID."""
        return self._categories.get(category_id)

    def update_category(self, category: ExpenseCategory) -> Optional[ExpenseCategory]:
        """Update a category."""
        if category.id not in self._categories:
            return None
        category.updated_at = datetime.utcnow()
        self._categories[category.id] = category
        return category

    def delete_category(self, category_id: str) -> bool:
        """Delete a category."""
        if category_id not in self._categories:
            return False
        del self._categories[category_id]
        return True

    def list_categories(
        self,
        workspace_id: Optional[str] = None,
        parent_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[ExpenseCategory]:
        """List categories with optional filters."""
        categories = list(self._categories.values())
        if workspace_id:
            categories = [c for c in categories if c.workspace_id == workspace_id]
        if parent_id is not None:
            categories = [c for c in categories if c.parent_id == parent_id]
        if is_active is not None:
            categories = [c for c in categories if c.is_active == is_active]
        return sorted(categories, key=lambda c: c.order)

    # Mileage Log CRUD
    def create_mileage_log(self, log: MileageLog) -> MileageLog:
        """Create a mileage log."""
        self._mileage_logs[log.id] = log
        return log

    def get_mileage_log(self, log_id: str) -> Optional[MileageLog]:
        """Get a mileage log by ID."""
        return self._mileage_logs.get(log_id)

    def get_expense_mileage_logs(self, expense_id: str) -> List[MileageLog]:
        """Get mileage logs for an expense."""
        return [m for m in self._mileage_logs.values() if m.expense_id == expense_id]

    # Per Diem Allowance CRUD
    def create_per_diem_allowance(self, allowance: PerDiemAllowance) -> PerDiemAllowance:
        """Create a per diem allowance."""
        self._per_diem_allowances[allowance.id] = allowance
        return allowance

    def get_per_diem_allowance(self, allowance_id: str) -> Optional[PerDiemAllowance]:
        """Get a per diem allowance by ID."""
        return self._per_diem_allowances.get(allowance_id)

    def get_per_diem_for_location(self, workspace_id: str, location: str) -> Optional[PerDiemAllowance]:
        """Get per diem allowance for a location."""
        for allowance in self._per_diem_allowances.values():
            if allowance.workspace_id == workspace_id and allowance.location == location and allowance.is_active:
                return allowance
        return None

    def list_per_diem_allowances(
        self,
        workspace_id: Optional[str] = None,
        is_active: Optional[bool] = None,
    ) -> List[PerDiemAllowance]:
        """List per diem allowances."""
        allowances = list(self._per_diem_allowances.values())
        if workspace_id:
            allowances = [a for a in allowances if a.workspace_id == workspace_id]
        if is_active is not None:
            allowances = [a for a in allowances if a.is_active == is_active]
        return allowances


# ============================================================
# Manager
# ============================================================

class ExpenseManager:
    """High-level API for expense management."""

    def __init__(self, registry: Optional[ExpenseRegistry] = None) -> None:
        self.registry = registry or ExpenseRegistry()

    # Expense Management
    def create_expense(
        self,
        workspace_id: str,
        user_id: str,
        expense_type: ExpenseType,
        amount: Decimal,
        description: str,
        expense_date: Optional[date] = None,
        vendor: Optional[str] = None,
        payment_method: PaymentMethod = PaymentMethod.PERSONAL_CARD,
        currency: str = "USD",
        is_billable: bool = False,
        project_id: Optional[str] = None,
    ) -> Expense:
        """Create a new expense."""
        expense = Expense(
            workspace_id=workspace_id,
            user_id=user_id,
            expense_type=expense_type,
            amount=amount,
            description=description,
            expense_date=expense_date or date.today(),
            vendor=vendor,
            payment_method=payment_method,
            currency=currency,
            is_billable=is_billable,
            project_id=project_id,
        )
        return self.registry.create_expense(expense)

    def create_mileage_expense(
        self,
        workspace_id: str,
        user_id: str,
        distance: Decimal,
        start_location: str,
        end_location: str,
        purpose: str,
        expense_date: Optional[date] = None,
        mileage_rate: Optional[Decimal] = None,
        unit: MileageUnit = MileageUnit.MILES,
    ) -> Expense:
        """Create a mileage expense."""
        # Get mileage rate from policy if not provided
        if mileage_rate is None:
            policies = self.registry.list_policies(workspace_id=workspace_id, policy_type=PolicyType.MILEAGE_RATE)
            for policy in policies:
                if policy.is_active and policy.mileage_rate:
                    mileage_rate = policy.mileage_rate
                    break
            if mileage_rate is None:
                mileage_rate = Decimal("0.67")  # Default IRS rate

        amount = distance * mileage_rate

        expense = Expense(
            workspace_id=workspace_id,
            user_id=user_id,
            expense_type=ExpenseType.MILEAGE,
            amount=amount,
            description=f"Mileage: {start_location} to {end_location}",
            expense_date=expense_date or date.today(),
            is_mileage=True,
            mileage_distance=distance,
            mileage_unit=unit,
            mileage_rate=mileage_rate,
            start_location=start_location,
            end_location=end_location,
        )
        expense = self.registry.create_expense(expense)

        # Create mileage log
        log = MileageLog(
            expense_id=expense.id,
            user_id=user_id,
            date=expense_date or date.today(),
            start_location=start_location,
            end_location=end_location,
            distance=distance,
            unit=unit,
            purpose=purpose,
            rate=mileage_rate,
            amount=amount,
        )
        self.registry.create_mileage_log(log)

        return expense

    def create_per_diem_expense(
        self,
        workspace_id: str,
        user_id: str,
        location: str,
        days: Decimal,
        expense_date: Optional[date] = None,
        include_meals: bool = True,
        include_lodging: bool = False,
        include_incidentals: bool = True,
    ) -> Optional[Expense]:
        """Create a per diem expense."""
        # Get per diem rate for location
        allowance = self.registry.get_per_diem_for_location(workspace_id, location)
        if not allowance:
            return None

        rate = Decimal("0")
        if include_meals:
            rate += allowance.meals_rate
        if include_lodging:
            rate += allowance.lodging_rate
        if include_incidentals:
            rate += allowance.incidentals_rate

        amount = rate * days

        expense = Expense(
            workspace_id=workspace_id,
            user_id=user_id,
            expense_type=ExpenseType.MEALS if include_meals else ExpenseType.LODGING,
            amount=amount,
            description=f"Per diem: {location} ({days} days)",
            expense_date=expense_date or date.today(),
            location=location,
            is_per_diem=True,
            per_diem_rate=rate,
            per_diem_days=days,
            currency=allowance.currency,
        )
        return self.registry.create_expense(expense)

    def get_expense(self, expense_id: str) -> Optional[Expense]:
        """Get an expense by ID."""
        return self.registry.get_expense(expense_id)

    def update_expense(
        self,
        expense_id: str,
        amount: Optional[Decimal] = None,
        description: Optional[str] = None,
        vendor: Optional[str] = None,
        expense_date: Optional[date] = None,
        expense_type: Optional[ExpenseType] = None,
        notes: Optional[str] = None,
    ) -> Optional[Expense]:
        """Update an expense."""
        expense = self.registry.get_expense(expense_id)
        if not expense:
            return None

        # Can only update draft or rejected expenses
        if expense.status not in [ExpenseStatus.DRAFT, ExpenseStatus.REJECTED]:
            return None

        if amount is not None:
            expense.amount = amount
        if description is not None:
            expense.description = description
        if vendor is not None:
            expense.vendor = vendor
        if expense_date is not None:
            expense.expense_date = expense_date
        if expense_type is not None:
            expense.expense_type = expense_type
        if notes is not None:
            expense.notes = notes

        return self.registry.update_expense(expense)

    def delete_expense(self, expense_id: str) -> bool:
        """Delete an expense."""
        expense = self.registry.get_expense(expense_id)
        if not expense:
            return False

        # Can only delete draft expenses
        if expense.status != ExpenseStatus.DRAFT:
            return False

        return self.registry.delete_expense(expense_id)

    def list_user_expenses(
        self,
        workspace_id: str,
        user_id: str,
        status: Optional[ExpenseStatus] = None,
        date_from: Optional[date] = None,
        date_to: Optional[date] = None,
    ) -> List[Expense]:
        """List expenses for a user."""
        return self.registry.list_expenses(
            workspace_id=workspace_id,
            user_id=user_id,
            status=status,
            date_from=date_from,
            date_to=date_to,
        )

    # Receipt Management
    def attach_receipt(
        self,
        expense_id: str,
        file_url: str,
        file_name: str,
        file_type: str,
        file_size: int,
        uploaded_by: str,
    ) -> Optional[Receipt]:
        """Attach a receipt to an expense."""
        expense = self.registry.get_expense(expense_id)
        if not expense:
            return None

        receipt = Receipt(
            expense_id=expense_id,
            file_url=file_url,
            file_name=file_name,
            file_type=file_type,
            file_size=file_size,
            uploaded_by=uploaded_by,
        )
        return self.registry.create_receipt(receipt)

    def verify_receipt(
        self,
        receipt_id: str,
        verified_by: str,
        is_valid: bool,
        rejection_reason: Optional[str] = None,
    ) -> Optional[Receipt]:
        """Verify or reject a receipt."""
        receipt = self.registry.get_receipt(receipt_id)
        if not receipt:
            return None

        receipt.status = ReceiptStatus.VERIFIED if is_valid else ReceiptStatus.REJECTED
        receipt.verified_by = verified_by
        receipt.verified_at = datetime.utcnow()
        if not is_valid:
            receipt.rejection_reason = rejection_reason

        return self.registry.update_receipt(receipt)

    def get_expense_receipts(self, expense_id: str) -> List[Receipt]:
        """Get receipts for an expense."""
        return self.registry.get_expense_receipts(expense_id)

    # Report Management
    def create_report(
        self,
        workspace_id: str,
        user_id: str,
        title: str,
        description: Optional[str] = None,
        expense_ids: Optional[List[str]] = None,
        period_start: Optional[date] = None,
        period_end: Optional[date] = None,
        business_purpose: Optional[str] = None,
    ) -> ExpenseReport:
        """Create an expense report."""
        report = ExpenseReport(
            workspace_id=workspace_id,
            user_id=user_id,
            title=title,
            description=description,
            period_start=period_start,
            period_end=period_end,
            business_purpose=business_purpose,
        )
        report = self.registry.create_report(report)

        # Add expenses to report
        if expense_ids:
            for expense_id in expense_ids:
                self.add_expense_to_report(report.id, expense_id)

        return report

    def add_expense_to_report(self, report_id: str, expense_id: str) -> Optional[Expense]:
        """Add an expense to a report."""
        report = self.registry.get_report(report_id)
        expense = self.registry.get_expense(expense_id)
        if not report or not expense:
            return None

        # Can only add to draft reports
        if report.status != ReportStatus.DRAFT:
            return None

        expense.report_id = report_id
        self.registry.update_expense(expense)

        # Update report totals
        self._recalculate_report_totals(report_id)

        return expense

    def remove_expense_from_report(self, report_id: str, expense_id: str) -> bool:
        """Remove an expense from a report."""
        report = self.registry.get_report(report_id)
        expense = self.registry.get_expense(expense_id)
        if not report or not expense:
            return False

        if expense.report_id != report_id:
            return False

        # Can only modify draft reports
        if report.status != ReportStatus.DRAFT:
            return False

        expense.report_id = None
        self.registry.update_expense(expense)

        # Update report totals
        self._recalculate_report_totals(report_id)

        return True

    def _recalculate_report_totals(self, report_id: str) -> None:
        """Recalculate report totals."""
        report = self.registry.get_report(report_id)
        if not report:
            return

        expenses = self.registry.list_expenses(report_id=report_id)
        report.total_amount = sum(e.amount for e in expenses)
        report.expense_count = len(expenses)
        report.receipt_count = sum(
            len(self.registry.get_expense_receipts(e.id)) for e in expenses
        )
        report.violation_count = sum(
            len(self.registry.get_expense_violations(e.id)) for e in expenses
        )

        self.registry.update_report(report)

    def submit_report(self, report_id: str, approver_id: str) -> Optional[ExpenseReport]:
        """Submit a report for approval."""
        report = self.registry.get_report(report_id)
        if not report or report.status != ReportStatus.DRAFT:
            return None

        # Check policy violations
        self._check_report_policy_violations(report_id)

        # Check if any violations block submission
        violations = self.registry.get_report_violations(report_id)
        blocking_violations = [v for v in violations if not v.is_resolved]
        for v in blocking_violations:
            policy = self.registry.get_policy(v.policy_id)
            if policy and policy.block_submission:
                return None  # Cannot submit with blocking violations

        # Update report status
        report.status = ReportStatus.SUBMITTED
        report.submitted_at = datetime.utcnow()
        self.registry.update_report(report)

        # Update expense statuses
        expenses = self.registry.list_expenses(report_id=report_id)
        for expense in expenses:
            expense.status = ExpenseStatus.SUBMITTED
            expense.submitted_at = datetime.utcnow()
            self.registry.update_expense(expense)

        # Create approval step
        step = ApprovalStep(
            report_id=report_id,
            step_order=0,
            approver_id=approver_id,
            is_current=True,
        )
        self.registry.create_approval_step(step)

        return report

    def _check_report_policy_violations(self, report_id: str) -> None:
        """Check for policy violations in a report."""
        report = self.registry.get_report(report_id)
        if not report:
            return

        expenses = self.registry.list_expenses(report_id=report_id)
        policies = self.registry.list_policies(workspace_id=report.workspace_id, is_active=True)

        for expense in expenses:
            for policy in policies:
                violation = self._check_expense_policy(expense, policy)
                if violation:
                    violation.report_id = report_id
                    self.registry.create_violation(violation)

    def _check_expense_policy(self, expense: Expense, policy: ExpensePolicy) -> Optional[PolicyViolation]:
        """Check if an expense violates a policy."""
        # Check spending limit
        if policy.policy_type == PolicyType.SPENDING_LIMIT:
            if policy.limit_amount and expense.amount > policy.limit_amount:
                return PolicyViolation(
                    expense_id=expense.id,
                    policy_id=policy.id,
                    policy_name=policy.name,
                    violation_type="spending_limit_exceeded",
                    description=f"Expense amount {expense.amount} exceeds limit {policy.limit_amount}",
                    severity=policy.violation_severity,
                    limit_amount=policy.limit_amount,
                    actual_amount=expense.amount,
                    overage_amount=expense.amount - policy.limit_amount,
                )

        # Check receipt requirement
        if policy.policy_type == PolicyType.RECEIPT_REQUIRED:
            if policy.receipt_threshold and expense.amount >= policy.receipt_threshold:
                receipts = self.registry.get_expense_receipts(expense.id)
                if not receipts:
                    return PolicyViolation(
                        expense_id=expense.id,
                        policy_id=policy.id,
                        policy_name=policy.name,
                        violation_type="receipt_required",
                        description=f"Receipt required for expenses over {policy.receipt_threshold}",
                        severity=policy.violation_severity,
                        limit_amount=policy.receipt_threshold,
                        actual_amount=expense.amount,
                    )

        return None

    def approve_report(
        self,
        report_id: str,
        approver_id: str,
        comments: Optional[str] = None,
    ) -> Optional[ExpenseReport]:
        """Approve an expense report."""
        report = self.registry.get_report(report_id)
        if not report or report.status not in [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW]:
            return None

        # Get current approval step
        steps = self.registry.get_report_approval_steps(report_id)
        current_step = next((s for s in steps if s.is_current and s.approver_id == approver_id), None)
        if not current_step:
            return None

        # Complete the step
        current_step.action = ApprovalAction.APPROVE
        current_step.comments = comments
        current_step.is_completed = True
        current_step.is_current = False
        current_step.completed_at = datetime.utcnow()
        self.registry.update_approval_step(current_step)

        # Update report
        report.status = ReportStatus.APPROVED
        report.approved_at = datetime.utcnow()
        report.approved_by = approver_id
        report.approved_amount = report.total_amount
        self.registry.update_report(report)

        # Update expense statuses
        expenses = self.registry.list_expenses(report_id=report_id)
        for expense in expenses:
            expense.status = ExpenseStatus.APPROVED
            self.registry.update_expense(expense)

        return report

    def reject_report(
        self,
        report_id: str,
        approver_id: str,
        reason: str,
        comments: Optional[str] = None,
    ) -> Optional[ExpenseReport]:
        """Reject an expense report."""
        report = self.registry.get_report(report_id)
        if not report or report.status not in [ReportStatus.SUBMITTED, ReportStatus.UNDER_REVIEW]:
            return None

        # Get current approval step
        steps = self.registry.get_report_approval_steps(report_id)
        current_step = next((s for s in steps if s.is_current and s.approver_id == approver_id), None)
        if not current_step:
            return None

        # Complete the step
        current_step.action = ApprovalAction.REJECT
        current_step.comments = comments or reason
        current_step.is_completed = True
        current_step.is_current = False
        current_step.completed_at = datetime.utcnow()
        self.registry.update_approval_step(current_step)

        # Update report
        report.status = ReportStatus.REJECTED
        report.rejection_reason = reason
        self.registry.update_report(report)

        # Update expense statuses
        expenses = self.registry.list_expenses(report_id=report_id)
        for expense in expenses:
            expense.status = ExpenseStatus.REJECTED
            self.registry.update_expense(expense)

        return report

    def get_report(self, report_id: str) -> Optional[ExpenseReport]:
        """Get an expense report by ID."""
        return self.registry.get_report(report_id)

    def get_pending_approvals(self, approver_id: str) -> List[ExpenseReport]:
        """Get reports pending approval for an approver."""
        return self.registry.list_reports(approver_id=approver_id)

    def list_reports(
        self,
        workspace_id: str,
        user_id: Optional[str] = None,
        status: Optional[ReportStatus] = None,
    ) -> List[ExpenseReport]:
        """List expense reports."""
        return self.registry.list_reports(
            workspace_id=workspace_id,
            user_id=user_id,
            status=status,
        )

    # Reimbursement Management
    def create_reimbursement(
        self,
        report_id: str,
        method: ReimbursementMethod = ReimbursementMethod.DIRECT_DEPOSIT,
        scheduled_date: Optional[date] = None,
    ) -> Optional[Reimbursement]:
        """Create a reimbursement for an approved report."""
        report = self.registry.get_report(report_id)
        if not report or report.status != ReportStatus.APPROVED:
            return None

        reimbursement = Reimbursement(
            workspace_id=report.workspace_id,
            user_id=report.user_id,
            report_id=report_id,
            amount=report.approved_amount,
            currency=report.currency,
            method=method,
            scheduled_date=scheduled_date,
        )
        reimbursement = self.registry.create_reimbursement(reimbursement)

        # Update report
        report.reimbursement_id = reimbursement.id
        self.registry.update_report(report)

        return reimbursement

    def process_reimbursement(
        self,
        reimbursement_id: str,
        reference_number: Optional[str] = None,
    ) -> Optional[Reimbursement]:
        """Mark a reimbursement as processing."""
        reimbursement = self.registry.get_reimbursement(reimbursement_id)
        if not reimbursement or reimbursement.status != ReimbursementStatus.PENDING:
            return None

        reimbursement.status = ReimbursementStatus.PROCESSING
        reimbursement.processed_at = datetime.utcnow()
        reimbursement.reference_number = reference_number

        return self.registry.update_reimbursement(reimbursement)

    def complete_reimbursement(self, reimbursement_id: str) -> Optional[Reimbursement]:
        """Mark a reimbursement as completed."""
        reimbursement = self.registry.get_reimbursement(reimbursement_id)
        if not reimbursement or reimbursement.status != ReimbursementStatus.PROCESSING:
            return None

        reimbursement.status = ReimbursementStatus.COMPLETED
        reimbursement.completed_at = datetime.utcnow()
        self.registry.update_reimbursement(reimbursement)

        # Update report status
        report = self.registry.get_report(reimbursement.report_id)
        if report:
            report.status = ReportStatus.PAID
            self.registry.update_report(report)

        # Update expense statuses
        expenses = self.registry.list_expenses(report_id=reimbursement.report_id)
        for expense in expenses:
            expense.status = ExpenseStatus.REIMBURSED
            self.registry.update_expense(expense)

        return reimbursement

    def fail_reimbursement(
        self,
        reimbursement_id: str,
        reason: str,
    ) -> Optional[Reimbursement]:
        """Mark a reimbursement as failed."""
        reimbursement = self.registry.get_reimbursement(reimbursement_id)
        if not reimbursement:
            return None

        reimbursement.status = ReimbursementStatus.FAILED
        reimbursement.failure_reason = reason
        reimbursement.retry_count += 1

        return self.registry.update_reimbursement(reimbursement)

    def get_user_reimbursements(
        self,
        workspace_id: str,
        user_id: str,
        status: Optional[ReimbursementStatus] = None,
    ) -> List[Reimbursement]:
        """Get reimbursements for a user."""
        return self.registry.list_reimbursements(
            workspace_id=workspace_id,
            user_id=user_id,
            status=status,
        )

    # Policy Management
    def create_policy(
        self,
        workspace_id: str,
        name: str,
        policy_type: PolicyType,
        created_by: str,
        description: Optional[str] = None,
        limit_amount: Optional[Decimal] = None,
        receipt_threshold: Optional[Decimal] = None,
        violation_severity: ViolationSeverity = ViolationSeverity.WARNING,
        block_submission: bool = False,
    ) -> ExpensePolicy:
        """Create an expense policy."""
        policy = ExpensePolicy(
            workspace_id=workspace_id,
            name=name,
            description=description,
            policy_type=policy_type,
            limit_amount=limit_amount,
            receipt_threshold=receipt_threshold,
            violation_severity=violation_severity,
            block_submission=block_submission,
            created_by=created_by,
        )
        return self.registry.create_policy(policy)

    def create_mileage_policy(
        self,
        workspace_id: str,
        name: str,
        rate: Decimal,
        created_by: str,
        unit: MileageUnit = MileageUnit.MILES,
    ) -> ExpensePolicy:
        """Create a mileage rate policy."""
        policy = ExpensePolicy(
            workspace_id=workspace_id,
            name=name,
            policy_type=PolicyType.MILEAGE_RATE,
            mileage_rate=rate,
            mileage_unit=unit,
            created_by=created_by,
        )
        return self.registry.create_policy(policy)

    def get_policy(self, policy_id: str) -> Optional[ExpensePolicy]:
        """Get a policy by ID."""
        return self.registry.get_policy(policy_id)

    def update_policy(
        self,
        policy_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        limit_amount: Optional[Decimal] = None,
        is_active: Optional[bool] = None,
    ) -> Optional[ExpensePolicy]:
        """Update a policy."""
        policy = self.registry.get_policy(policy_id)
        if not policy:
            return None

        if name is not None:
            policy.name = name
        if description is not None:
            policy.description = description
        if limit_amount is not None:
            policy.limit_amount = limit_amount
        if is_active is not None:
            policy.is_active = is_active

        return self.registry.update_policy(policy)

    def list_policies(
        self,
        workspace_id: str,
        policy_type: Optional[PolicyType] = None,
        is_active: Optional[bool] = None,
    ) -> List[ExpensePolicy]:
        """List expense policies."""
        return self.registry.list_policies(
            workspace_id=workspace_id,
            policy_type=policy_type,
            is_active=is_active,
        )

    # Category Management
    def create_category(
        self,
        workspace_id: str,
        name: str,
        expense_type: Optional[ExpenseType] = None,
        parent_id: Optional[str] = None,
        gl_code: Optional[str] = None,
        requires_receipt: bool = False,
    ) -> ExpenseCategory:
        """Create an expense category."""
        category = ExpenseCategory(
            workspace_id=workspace_id,
            name=name,
            expense_type=expense_type,
            parent_id=parent_id,
            gl_code=gl_code,
            requires_receipt=requires_receipt,
        )
        return self.registry.create_category(category)

    def list_categories(
        self,
        workspace_id: str,
        parent_id: Optional[str] = None,
    ) -> List[ExpenseCategory]:
        """List expense categories."""
        return self.registry.list_categories(
            workspace_id=workspace_id,
            parent_id=parent_id,
            is_active=True,
        )

    # Per Diem Management
    def set_per_diem_rate(
        self,
        workspace_id: str,
        location: str,
        meals_rate: Decimal,
        lodging_rate: Decimal,
        incidentals_rate: Decimal,
        currency: str = "USD",
        country_code: Optional[str] = None,
    ) -> PerDiemAllowance:
        """Set per diem rate for a location."""
        # Deactivate existing rates for location
        existing = self.registry.get_per_diem_for_location(workspace_id, location)
        if existing:
            existing.is_active = False
            self.registry._per_diem_allowances[existing.id] = existing

        allowance = PerDiemAllowance(
            workspace_id=workspace_id,
            location=location,
            country_code=country_code,
            meals_rate=meals_rate,
            lodging_rate=lodging_rate,
            incidentals_rate=incidentals_rate,
            total_rate=meals_rate + lodging_rate + incidentals_rate,
            currency=currency,
        )
        return self.registry.create_per_diem_allowance(allowance)

    def get_per_diem_rate(self, workspace_id: str, location: str) -> Optional[PerDiemAllowance]:
        """Get per diem rate for a location."""
        return self.registry.get_per_diem_for_location(workspace_id, location)

    # Analytics
    def get_expense_analytics(
        self,
        workspace_id: str,
        period_start: date,
        period_end: date,
        user_id: Optional[str] = None,
    ) -> ExpenseAnalytics:
        """Get expense analytics for a period."""
        expenses = self.registry.list_expenses(
            workspace_id=workspace_id,
            user_id=user_id,
            date_from=period_start,
            date_to=period_end,
        )

        analytics = ExpenseAnalytics(
            workspace_id=workspace_id,
            period_start=period_start,
            period_end=period_end,
            total_expenses=len(expenses),
            total_amount=sum(e.amount for e in expenses),
        )

        # By status
        for expense in expenses:
            status = expense.status.value
            analytics.expenses_by_status[status] = analytics.expenses_by_status.get(status, 0) + 1
            analytics.amount_by_status[status] = analytics.amount_by_status.get(status, Decimal("0")) + expense.amount

        # By type
        for expense in expenses:
            exp_type = expense.expense_type.value
            analytics.expenses_by_type[exp_type] = analytics.expenses_by_type.get(exp_type, 0) + 1
            analytics.amount_by_type[exp_type] = analytics.amount_by_type.get(exp_type, Decimal("0")) + expense.amount

        # By user
        for expense in expenses:
            analytics.expenses_by_user[expense.user_id] = analytics.expenses_by_user.get(expense.user_id, 0) + 1
            analytics.amount_by_user[expense.user_id] = analytics.amount_by_user.get(expense.user_id, Decimal("0")) + expense.amount

        # Daily totals
        for expense in expenses:
            date_key = expense.expense_date.isoformat()
            analytics.daily_totals[date_key] = analytics.daily_totals.get(date_key, Decimal("0")) + expense.amount

        # Receipt compliance
        expenses_needing_receipts = [e for e in expenses if e.amount >= Decimal("25")]
        if expenses_needing_receipts:
            with_receipts = sum(
                1 for e in expenses_needing_receipts
                if self.registry.get_expense_receipts(e.id)
            )
            analytics.receipt_compliance_rate = with_receipts / len(expenses_needing_receipts)

        # Violation count
        for expense in expenses:
            analytics.violation_count += len(self.registry.get_expense_violations(expense.id))

        # Reports
        reports = self.registry.list_reports(workspace_id=workspace_id)
        analytics.total_reports = len(reports)

        return analytics


# ============================================================
# Global Instance Management
# ============================================================

_expense_manager: Optional[ExpenseManager] = None


def get_expense_manager() -> ExpenseManager:
    """Get the global expense manager instance."""
    global _expense_manager
    if _expense_manager is None:
        _expense_manager = ExpenseManager()
    return _expense_manager


def set_expense_manager(manager: ExpenseManager) -> None:
    """Set the global expense manager instance."""
    global _expense_manager
    _expense_manager = manager


def reset_expense_manager() -> None:
    """Reset the global expense manager instance."""
    global _expense_manager
    _expense_manager = None
