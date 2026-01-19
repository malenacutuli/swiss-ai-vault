"""
Tests for the Expense Management module.
"""

import pytest
from datetime import datetime, date, timedelta
from decimal import Decimal

from app.collaboration.expenses import (
    ExpenseManager,
    ExpenseRegistry,
    Expense,
    ExpenseType,
    ExpenseStatus,
    ExpenseLineItem,
    Receipt,
    ReceiptStatus,
    ExpenseReport,
    ReportStatus,
    ApprovalStep,
    ApprovalAction,
    Reimbursement,
    ReimbursementMethod,
    ReimbursementStatus,
    ExpensePolicy,
    PolicyType,
    PolicyViolation,
    ViolationSeverity,
    ExpenseCategory,
    MileageLog,
    MileageUnit,
    PerDiemAllowance,
    PaymentMethod,
    ExpenseAnalytics,
    get_expense_manager,
    set_expense_manager,
    reset_expense_manager,
)


# ============================================================
# Enum Tests
# ============================================================

class TestEnums:
    """Tests for enum definitions."""

    def test_expense_type_values(self):
        """Test ExpenseType enum values."""
        assert ExpenseType.TRAVEL.value == "travel"
        assert ExpenseType.MEALS.value == "meals"
        assert ExpenseType.LODGING.value == "lodging"
        assert ExpenseType.MILEAGE.value == "mileage"
        assert ExpenseType.EQUIPMENT.value == "equipment"
        assert ExpenseType.OTHER.value == "other"

    def test_expense_status_values(self):
        """Test ExpenseStatus enum values."""
        assert ExpenseStatus.DRAFT.value == "draft"
        assert ExpenseStatus.PENDING.value == "pending"
        assert ExpenseStatus.SUBMITTED.value == "submitted"
        assert ExpenseStatus.APPROVED.value == "approved"
        assert ExpenseStatus.REJECTED.value == "rejected"
        assert ExpenseStatus.REIMBURSED.value == "reimbursed"

    def test_report_status_values(self):
        """Test ReportStatus enum values."""
        assert ReportStatus.DRAFT.value == "draft"
        assert ReportStatus.SUBMITTED.value == "submitted"
        assert ReportStatus.APPROVED.value == "approved"
        assert ReportStatus.REJECTED.value == "rejected"
        assert ReportStatus.PAID.value == "paid"

    def test_payment_method_values(self):
        """Test PaymentMethod enum values."""
        assert PaymentMethod.CASH.value == "cash"
        assert PaymentMethod.PERSONAL_CARD.value == "personal_card"
        assert PaymentMethod.CORPORATE_CARD.value == "corporate_card"

    def test_reimbursement_status_values(self):
        """Test ReimbursementStatus enum values."""
        assert ReimbursementStatus.PENDING.value == "pending"
        assert ReimbursementStatus.PROCESSING.value == "processing"
        assert ReimbursementStatus.COMPLETED.value == "completed"
        assert ReimbursementStatus.FAILED.value == "failed"

    def test_policy_type_values(self):
        """Test PolicyType enum values."""
        assert PolicyType.SPENDING_LIMIT.value == "spending_limit"
        assert PolicyType.RECEIPT_REQUIRED.value == "receipt_required"
        assert PolicyType.MILEAGE_RATE.value == "mileage_rate"
        assert PolicyType.PER_DIEM.value == "per_diem"


# ============================================================
# Data Model Tests
# ============================================================

class TestDataModels:
    """Tests for data models."""

    def test_expense_creation(self):
        """Test Expense creation."""
        expense = Expense(
            workspace_id="ws-1",
            user_id="user-1",
            expense_type=ExpenseType.MEALS,
            amount=Decimal("45.50"),
            description="Team lunch",
        )
        assert expense.workspace_id == "ws-1"
        assert expense.user_id == "user-1"
        assert expense.expense_type == ExpenseType.MEALS
        assert expense.amount == Decimal("45.50")
        assert expense.status == ExpenseStatus.DRAFT
        assert expense.id is not None

    def test_receipt_creation(self):
        """Test Receipt creation."""
        receipt = Receipt(
            expense_id="exp-1",
            file_url="https://example.com/receipt.jpg",
            file_name="receipt.jpg",
            file_type="image/jpeg",
            uploaded_by="user-1",
        )
        assert receipt.expense_id == "exp-1"
        assert receipt.status == ReceiptStatus.PENDING
        assert receipt.id is not None

    def test_expense_report_creation(self):
        """Test ExpenseReport creation."""
        report = ExpenseReport(
            workspace_id="ws-1",
            user_id="user-1",
            title="Q1 Travel Expenses",
        )
        assert report.workspace_id == "ws-1"
        assert report.title == "Q1 Travel Expenses"
        assert report.status == ReportStatus.DRAFT
        assert report.total_amount == Decimal("0")

    def test_approval_step_creation(self):
        """Test ApprovalStep creation."""
        step = ApprovalStep(
            report_id="report-1",
            approver_id="manager-1",
            step_order=0,
        )
        assert step.report_id == "report-1"
        assert step.approver_id == "manager-1"
        assert step.is_current is False
        assert step.is_completed is False

    def test_reimbursement_creation(self):
        """Test Reimbursement creation."""
        reimbursement = Reimbursement(
            workspace_id="ws-1",
            user_id="user-1",
            report_id="report-1",
            amount=Decimal("500.00"),
        )
        assert reimbursement.amount == Decimal("500.00")
        assert reimbursement.status == ReimbursementStatus.PENDING
        assert reimbursement.method == ReimbursementMethod.DIRECT_DEPOSIT

    def test_expense_policy_creation(self):
        """Test ExpensePolicy creation."""
        policy = ExpensePolicy(
            workspace_id="ws-1",
            name="Travel Policy",
            policy_type=PolicyType.SPENDING_LIMIT,
            limit_amount=Decimal("500.00"),
        )
        assert policy.name == "Travel Policy"
        assert policy.policy_type == PolicyType.SPENDING_LIMIT
        assert policy.limit_amount == Decimal("500.00")
        assert policy.is_active is True

    def test_policy_violation_creation(self):
        """Test PolicyViolation creation."""
        violation = PolicyViolation(
            expense_id="exp-1",
            policy_id="policy-1",
            policy_name="Spending Limit",
            violation_type="spending_limit_exceeded",
            description="Amount exceeds limit",
            severity=ViolationSeverity.WARNING,
        )
        assert violation.expense_id == "exp-1"
        assert violation.severity == ViolationSeverity.WARNING
        assert violation.is_resolved is False

    def test_expense_category_creation(self):
        """Test ExpenseCategory creation."""
        category = ExpenseCategory(
            workspace_id="ws-1",
            name="Travel",
            expense_type=ExpenseType.TRAVEL,
            gl_code="6000",
        )
        assert category.name == "Travel"
        assert category.gl_code == "6000"
        assert category.is_active is True

    def test_mileage_log_creation(self):
        """Test MileageLog creation."""
        log = MileageLog(
            expense_id="exp-1",
            user_id="user-1",
            start_location="Office",
            end_location="Client Site",
            distance=Decimal("25.5"),
            purpose="Client meeting",
        )
        assert log.distance == Decimal("25.5")
        assert log.unit == MileageUnit.MILES

    def test_per_diem_allowance_creation(self):
        """Test PerDiemAllowance creation."""
        allowance = PerDiemAllowance(
            workspace_id="ws-1",
            location="New York, NY",
            meals_rate=Decimal("79.00"),
            lodging_rate=Decimal("282.00"),
            incidentals_rate=Decimal("20.00"),
        )
        assert allowance.meals_rate == Decimal("79.00")
        assert allowance.location == "New York, NY"


# ============================================================
# Registry Tests
# ============================================================

class TestExpenseRegistry:
    """Tests for ExpenseRegistry."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return ExpenseRegistry()

    def test_create_expense(self, registry):
        """Test creating an expense."""
        expense = Expense(
            workspace_id="ws-1",
            user_id="user-1",
            expense_type=ExpenseType.MEALS,
            amount=Decimal("50.00"),
            description="Lunch",
        )
        created = registry.create_expense(expense)
        assert created.id == expense.id
        assert registry.get_expense(expense.id) is not None

    def test_update_expense(self, registry):
        """Test updating an expense."""
        expense = Expense(workspace_id="ws-1", user_id="user-1", amount=Decimal("50.00"), description="Original")
        registry.create_expense(expense)
        expense.description = "Updated"
        updated = registry.update_expense(expense)
        assert updated.description == "Updated"

    def test_delete_expense(self, registry):
        """Test deleting an expense."""
        expense = Expense(workspace_id="ws-1", user_id="user-1", amount=Decimal("50.00"), description="Test")
        registry.create_expense(expense)
        result = registry.delete_expense(expense.id)
        assert result is True
        assert registry.get_expense(expense.id) is None

    def test_list_expenses_by_user(self, registry):
        """Test listing expenses by user."""
        exp1 = Expense(workspace_id="ws-1", user_id="user-1", amount=Decimal("50.00"), description="E1")
        exp2 = Expense(workspace_id="ws-1", user_id="user-2", amount=Decimal("30.00"), description="E2")
        registry.create_expense(exp1)
        registry.create_expense(exp2)
        expenses = registry.list_expenses(user_id="user-1")
        assert len(expenses) == 1
        assert expenses[0].user_id == "user-1"

    def test_list_expenses_by_status(self, registry):
        """Test listing expenses by status."""
        exp1 = Expense(workspace_id="ws-1", user_id="user-1", amount=Decimal("50.00"), description="E1", status=ExpenseStatus.DRAFT)
        exp2 = Expense(workspace_id="ws-1", user_id="user-1", amount=Decimal("30.00"), description="E2", status=ExpenseStatus.SUBMITTED)
        registry.create_expense(exp1)
        registry.create_expense(exp2)
        expenses = registry.list_expenses(status=ExpenseStatus.SUBMITTED)
        assert len(expenses) == 1
        assert expenses[0].status == ExpenseStatus.SUBMITTED

    def test_create_receipt(self, registry):
        """Test creating a receipt."""
        receipt = Receipt(expense_id="exp-1", file_url="url", file_name="receipt.jpg", uploaded_by="user-1")
        created = registry.create_receipt(receipt)
        assert created.id == receipt.id

    def test_get_expense_receipts(self, registry):
        """Test getting receipts for an expense."""
        r1 = Receipt(expense_id="exp-1", file_url="url1", file_name="r1.jpg", uploaded_by="user-1")
        r2 = Receipt(expense_id="exp-2", file_url="url2", file_name="r2.jpg", uploaded_by="user-1")
        registry.create_receipt(r1)
        registry.create_receipt(r2)
        receipts = registry.get_expense_receipts("exp-1")
        assert len(receipts) == 1

    def test_create_report(self, registry):
        """Test creating an expense report."""
        report = ExpenseReport(workspace_id="ws-1", user_id="user-1", title="Test Report")
        created = registry.create_report(report)
        assert created.id == report.id

    def test_list_reports_by_user(self, registry):
        """Test listing reports by user."""
        r1 = ExpenseReport(workspace_id="ws-1", user_id="user-1", title="R1")
        r2 = ExpenseReport(workspace_id="ws-1", user_id="user-2", title="R2")
        registry.create_report(r1)
        registry.create_report(r2)
        reports = registry.list_reports(user_id="user-1")
        assert len(reports) == 1

    def test_create_approval_step(self, registry):
        """Test creating an approval step."""
        step = ApprovalStep(report_id="report-1", approver_id="manager-1")
        created = registry.create_approval_step(step)
        assert created.id == step.id

    def test_get_pending_approvals(self, registry):
        """Test getting pending approvals."""
        step = ApprovalStep(report_id="report-1", approver_id="manager-1", is_current=True, is_completed=False)
        registry.create_approval_step(step)
        pending = registry.get_pending_approvals("manager-1")
        assert len(pending) == 1

    def test_create_reimbursement(self, registry):
        """Test creating a reimbursement."""
        reimbursement = Reimbursement(workspace_id="ws-1", user_id="user-1", report_id="report-1", amount=Decimal("500.00"))
        created = registry.create_reimbursement(reimbursement)
        assert created.id == reimbursement.id

    def test_create_policy(self, registry):
        """Test creating a policy."""
        policy = ExpensePolicy(workspace_id="ws-1", name="Test Policy", policy_type=PolicyType.SPENDING_LIMIT, created_by="admin")
        created = registry.create_policy(policy)
        assert created.id == policy.id

    def test_list_policies(self, registry):
        """Test listing policies."""
        p1 = ExpensePolicy(workspace_id="ws-1", name="P1", policy_type=PolicyType.SPENDING_LIMIT, created_by="admin")
        p2 = ExpensePolicy(workspace_id="ws-1", name="P2", policy_type=PolicyType.RECEIPT_REQUIRED, created_by="admin")
        registry.create_policy(p1)
        registry.create_policy(p2)
        policies = registry.list_policies(policy_type=PolicyType.SPENDING_LIMIT)
        assert len(policies) == 1

    def test_create_category(self, registry):
        """Test creating a category."""
        category = ExpenseCategory(workspace_id="ws-1", name="Travel")
        created = registry.create_category(category)
        assert created.id == category.id

    def test_clear_registry(self, registry):
        """Test clearing the registry."""
        expense = Expense(workspace_id="ws-1", user_id="user-1", amount=Decimal("50.00"), description="Test")
        registry.create_expense(expense)
        registry.clear()
        assert registry.get_expense(expense.id) is None


# ============================================================
# Manager Tests
# ============================================================

class TestExpenseManager:
    """Tests for ExpenseManager."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return ExpenseManager()

    def test_create_expense(self, manager):
        """Test creating an expense."""
        expense = manager.create_expense(
            workspace_id="ws-1",
            user_id="user-1",
            expense_type=ExpenseType.MEALS,
            amount=Decimal("45.50"),
            description="Team lunch",
            vendor="Restaurant ABC",
        )
        assert expense.amount == Decimal("45.50")
        assert expense.expense_type == ExpenseType.MEALS
        assert expense.vendor == "Restaurant ABC"

    def test_create_mileage_expense(self, manager):
        """Test creating a mileage expense."""
        expense = manager.create_mileage_expense(
            workspace_id="ws-1",
            user_id="user-1",
            distance=Decimal("25.5"),
            start_location="Office",
            end_location="Client Site",
            purpose="Client meeting",
            mileage_rate=Decimal("0.67"),
        )
        assert expense.is_mileage is True
        assert expense.mileage_distance == Decimal("25.5")
        assert expense.amount == Decimal("25.5") * Decimal("0.67")

    def test_create_per_diem_expense(self, manager):
        """Test creating a per diem expense."""
        # First set up per diem rate
        manager.set_per_diem_rate(
            workspace_id="ws-1",
            location="New York, NY",
            meals_rate=Decimal("79.00"),
            lodging_rate=Decimal("282.00"),
            incidentals_rate=Decimal("20.00"),
        )
        expense = manager.create_per_diem_expense(
            workspace_id="ws-1",
            user_id="user-1",
            location="New York, NY",
            days=Decimal("3"),
            include_meals=True,
            include_lodging=False,
            include_incidentals=True,
        )
        assert expense is not None
        assert expense.is_per_diem is True
        expected_rate = Decimal("79.00") + Decimal("20.00")  # meals + incidentals
        assert expense.amount == expected_rate * Decimal("3")

    def test_update_expense(self, manager):
        """Test updating an expense."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Original")
        updated = manager.update_expense(expense.id, description="Updated", amount=Decimal("55.00"))
        assert updated.description == "Updated"
        assert updated.amount == Decimal("55.00")

    def test_update_expense_only_draft(self, manager):
        """Test that only draft expenses can be updated."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Test")
        expense.status = ExpenseStatus.SUBMITTED
        manager.registry.update_expense(expense)
        result = manager.update_expense(expense.id, description="Should fail")
        assert result is None

    def test_delete_expense(self, manager):
        """Test deleting an expense."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Test")
        result = manager.delete_expense(expense.id)
        assert result is True
        assert manager.get_expense(expense.id) is None

    def test_delete_expense_only_draft(self, manager):
        """Test that only draft expenses can be deleted."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Test")
        expense.status = ExpenseStatus.SUBMITTED
        manager.registry.update_expense(expense)
        result = manager.delete_expense(expense.id)
        assert result is False

    def test_attach_receipt(self, manager):
        """Test attaching a receipt to an expense."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        receipt = manager.attach_receipt(
            expense.id,
            file_url="https://example.com/receipt.jpg",
            file_name="receipt.jpg",
            file_type="image/jpeg",
            file_size=1024,
            uploaded_by="user-1",
        )
        assert receipt is not None
        assert receipt.expense_id == expense.id

    def test_verify_receipt(self, manager):
        """Test verifying a receipt."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        receipt = manager.attach_receipt(expense.id, "url", "file.jpg", "image/jpeg", 1024, "user-1")
        verified = manager.verify_receipt(receipt.id, "admin-1", is_valid=True)
        assert verified.status == ReceiptStatus.VERIFIED

    def test_reject_receipt(self, manager):
        """Test rejecting a receipt."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        receipt = manager.attach_receipt(expense.id, "url", "file.jpg", "image/jpeg", 1024, "user-1")
        rejected = manager.verify_receipt(receipt.id, "admin-1", is_valid=False, rejection_reason="Blurry image")
        assert rejected.status == ReceiptStatus.REJECTED
        assert rejected.rejection_reason == "Blurry image"

    def test_create_report(self, manager):
        """Test creating an expense report."""
        exp1 = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        exp2 = manager.create_expense("ws-1", "user-1", ExpenseType.TRAVEL, Decimal("100.00"), "Taxi")
        report = manager.create_report(
            workspace_id="ws-1",
            user_id="user-1",
            title="March Expenses",
            expense_ids=[exp1.id, exp2.id],
        )
        assert report.title == "March Expenses"
        assert report.total_amount == Decimal("150.00")
        assert report.expense_count == 2

    def test_add_expense_to_report(self, manager):
        """Test adding an expense to a report."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report")
        added = manager.add_expense_to_report(report.id, expense.id)
        assert added is not None
        assert added.report_id == report.id
        updated_report = manager.get_report(report.id)
        assert updated_report.total_amount == Decimal("50.00")

    def test_remove_expense_from_report(self, manager):
        """Test removing an expense from a report."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        result = manager.remove_expense_from_report(report.id, expense.id)
        assert result is True
        updated_report = manager.get_report(report.id)
        assert updated_report.total_amount == Decimal("0")

    def test_submit_report(self, manager):
        """Test submitting a report for approval."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        submitted = manager.submit_report(report.id, "manager-1")
        assert submitted.status == ReportStatus.SUBMITTED
        assert submitted.submitted_at is not None

    def test_approve_report(self, manager):
        """Test approving a report."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        manager.submit_report(report.id, "manager-1")
        approved = manager.approve_report(report.id, "manager-1", comments="Looks good")
        assert approved.status == ReportStatus.APPROVED
        assert approved.approved_by == "manager-1"

    def test_reject_report(self, manager):
        """Test rejecting a report."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        manager.submit_report(report.id, "manager-1")
        rejected = manager.reject_report(report.id, "manager-1", "Missing receipts")
        assert rejected.status == ReportStatus.REJECTED
        assert rejected.rejection_reason == "Missing receipts"

    def test_create_reimbursement(self, manager):
        """Test creating a reimbursement."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        manager.submit_report(report.id, "manager-1")
        manager.approve_report(report.id, "manager-1")
        reimbursement = manager.create_reimbursement(report.id)
        assert reimbursement is not None
        assert reimbursement.amount == Decimal("50.00")

    def test_process_reimbursement(self, manager):
        """Test processing a reimbursement."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        manager.submit_report(report.id, "manager-1")
        manager.approve_report(report.id, "manager-1")
        reimbursement = manager.create_reimbursement(report.id)
        processed = manager.process_reimbursement(reimbursement.id, reference_number="REF123")
        assert processed.status == ReimbursementStatus.PROCESSING
        assert processed.reference_number == "REF123"

    def test_complete_reimbursement(self, manager):
        """Test completing a reimbursement."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        manager.submit_report(report.id, "manager-1")
        manager.approve_report(report.id, "manager-1")
        reimbursement = manager.create_reimbursement(report.id)
        manager.process_reimbursement(reimbursement.id)
        completed = manager.complete_reimbursement(reimbursement.id)
        assert completed.status == ReimbursementStatus.COMPLETED
        # Check report and expense status
        updated_report = manager.get_report(report.id)
        assert updated_report.status == ReportStatus.PAID

    def test_fail_reimbursement(self, manager):
        """Test failing a reimbursement."""
        expense = manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        report = manager.create_report("ws-1", "user-1", "Test Report", expense_ids=[expense.id])
        manager.submit_report(report.id, "manager-1")
        manager.approve_report(report.id, "manager-1")
        reimbursement = manager.create_reimbursement(report.id)
        manager.process_reimbursement(reimbursement.id)
        failed = manager.fail_reimbursement(reimbursement.id, "Invalid bank account")
        assert failed.status == ReimbursementStatus.FAILED
        assert failed.failure_reason == "Invalid bank account"

    def test_create_policy(self, manager):
        """Test creating an expense policy."""
        policy = manager.create_policy(
            workspace_id="ws-1",
            name="Meal Limit",
            policy_type=PolicyType.SPENDING_LIMIT,
            created_by="admin-1",
            limit_amount=Decimal("100.00"),
        )
        assert policy.name == "Meal Limit"
        assert policy.limit_amount == Decimal("100.00")

    def test_create_mileage_policy(self, manager):
        """Test creating a mileage rate policy."""
        policy = manager.create_mileage_policy(
            workspace_id="ws-1",
            name="2024 Mileage Rate",
            rate=Decimal("0.67"),
            created_by="admin-1",
        )
        assert policy.policy_type == PolicyType.MILEAGE_RATE
        assert policy.mileage_rate == Decimal("0.67")

    def test_update_policy(self, manager):
        """Test updating a policy."""
        policy = manager.create_policy("ws-1", "Test Policy", PolicyType.SPENDING_LIMIT, "admin-1", limit_amount=Decimal("100.00"))
        updated = manager.update_policy(policy.id, limit_amount=Decimal("150.00"))
        assert updated.limit_amount == Decimal("150.00")

    def test_create_category(self, manager):
        """Test creating an expense category."""
        category = manager.create_category(
            workspace_id="ws-1",
            name="Travel",
            expense_type=ExpenseType.TRAVEL,
            gl_code="6000",
        )
        assert category.name == "Travel"
        assert category.gl_code == "6000"

    def test_set_per_diem_rate(self, manager):
        """Test setting per diem rate."""
        allowance = manager.set_per_diem_rate(
            workspace_id="ws-1",
            location="San Francisco, CA",
            meals_rate=Decimal("79.00"),
            lodging_rate=Decimal("370.00"),
            incidentals_rate=Decimal("20.00"),
        )
        assert allowance.location == "San Francisco, CA"
        assert allowance.total_rate == Decimal("469.00")

    def test_get_per_diem_rate(self, manager):
        """Test getting per diem rate."""
        manager.set_per_diem_rate("ws-1", "Chicago, IL", Decimal("79.00"), Decimal("250.00"), Decimal("20.00"))
        rate = manager.get_per_diem_rate("ws-1", "Chicago, IL")
        assert rate is not None
        assert rate.meals_rate == Decimal("79.00")

    def test_get_expense_analytics(self, manager):
        """Test getting expense analytics."""
        today = date.today()
        manager.create_expense("ws-1", "user-1", ExpenseType.MEALS, Decimal("50.00"), "Lunch")
        manager.create_expense("ws-1", "user-1", ExpenseType.TRAVEL, Decimal("100.00"), "Taxi")
        manager.create_expense("ws-1", "user-2", ExpenseType.MEALS, Decimal("30.00"), "Coffee")
        analytics = manager.get_expense_analytics(
            workspace_id="ws-1",
            period_start=today - timedelta(days=1),
            period_end=today + timedelta(days=1),
        )
        assert analytics.total_expenses == 3
        assert analytics.total_amount == Decimal("180.00")
        assert analytics.expenses_by_type.get("meals", 0) == 2
        assert analytics.amount_by_type.get("travel", Decimal("0")) == Decimal("100.00")


# ============================================================
# Global Instance Tests
# ============================================================

class TestGlobalInstances:
    """Tests for global instance management."""

    def setup_method(self):
        """Reset global instance before each test."""
        reset_expense_manager()

    def test_get_expense_manager(self):
        """Test getting the global expense manager."""
        manager = get_expense_manager()
        assert manager is not None
        assert isinstance(manager, ExpenseManager)

    def test_set_expense_manager(self):
        """Test setting the global expense manager."""
        custom_manager = ExpenseManager()
        set_expense_manager(custom_manager)
        assert get_expense_manager() is custom_manager

    def test_reset_expense_manager(self):
        """Test resetting the global expense manager."""
        manager1 = get_expense_manager()
        reset_expense_manager()
        manager2 = get_expense_manager()
        assert manager1 is not manager2
