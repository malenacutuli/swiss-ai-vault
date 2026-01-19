"""
Tests for the Inventory & Asset Management module.
"""

import pytest
from datetime import datetime, timedelta, date

from app.collaboration.inventory import (
    # Enums
    AssetType,
    AssetStatus,
    AssetCondition,
    CheckoutStatus,
    MaintenanceType,
    MaintenanceStatus,
    DepreciationMethod,
    AuditStatus,
    AuditResult,
    DisposalMethod,
    ReservationStatus,
    # Data Models
    Asset,
    AssetCategory,
    AssetCheckout,
    AssetReservation,
    MaintenanceRecord,
    DepreciationRecord,
    Warranty,
    InventoryAudit,
    AuditItem,
    AssetDisposal,
    Location,
    Vendor,
    InventoryAnalytics,
    # Registry and Manager
    InventoryRegistry,
    InventoryManager,
    # Global instance functions
    get_inventory_manager,
    set_inventory_manager,
    reset_inventory_manager,
)


class TestEnums:
    """Test enum definitions."""

    def test_asset_type_values(self):
        """Test AssetType enum values."""
        assert AssetType.COMPUTER.value == "computer"
        assert AssetType.LAPTOP.value == "laptop"
        assert AssetType.FURNITURE.value == "furniture"
        assert AssetType.VEHICLE.value == "vehicle"
        assert len(AssetType) == 18

    def test_asset_status_values(self):
        """Test AssetStatus enum values."""
        assert AssetStatus.AVAILABLE.value == "available"
        assert AssetStatus.IN_USE.value == "in_use"
        assert AssetStatus.CHECKED_OUT.value == "checked_out"
        assert AssetStatus.IN_MAINTENANCE.value == "in_maintenance"
        assert AssetStatus.DISPOSED.value == "disposed"

    def test_asset_condition_values(self):
        """Test AssetCondition enum values."""
        assert AssetCondition.NEW.value == "new"
        assert AssetCondition.EXCELLENT.value == "excellent"
        assert AssetCondition.GOOD.value == "good"
        assert AssetCondition.POOR.value == "poor"

    def test_maintenance_type_values(self):
        """Test MaintenanceType enum values."""
        assert MaintenanceType.PREVENTIVE.value == "preventive"
        assert MaintenanceType.CORRECTIVE.value == "corrective"
        assert MaintenanceType.EMERGENCY.value == "emergency"

    def test_depreciation_method_values(self):
        """Test DepreciationMethod enum values."""
        assert DepreciationMethod.STRAIGHT_LINE.value == "straight_line"
        assert DepreciationMethod.DECLINING_BALANCE.value == "declining_balance"


class TestAssetModel:
    """Test Asset data model."""

    def test_create_asset(self):
        """Test creating an asset."""
        asset = Asset(
            id="ast-001",
            name="MacBook Pro 16",
            asset_tag="AST-000001",
            category_id="cat-001",
            asset_type=AssetType.LAPTOP,
            serial_number="C02XL0KSJGH5",
            model="MacBook Pro 16-inch",
            manufacturer="Apple",
            purchase_price=2499.00,
        )
        assert asset.id == "ast-001"
        assert asset.name == "MacBook Pro 16"
        assert asset.asset_type == AssetType.LAPTOP
        assert asset.purchase_price == 2499.00

    def test_asset_is_available(self):
        """Test asset availability check."""
        asset = Asset(
            id="ast-001",
            name="Laptop",
            asset_tag="AST-000001",
            category_id="cat-001",
            status=AssetStatus.AVAILABLE,
        )
        assert asset.is_available is True

        asset.status = AssetStatus.CHECKED_OUT
        assert asset.is_available is False

    def test_asset_warranty_check(self):
        """Test asset warranty check."""
        asset = Asset(
            id="ast-001",
            name="Laptop",
            asset_tag="AST-000001",
            category_id="cat-001",
            warranty_expiry=date.today() + timedelta(days=365),
        )
        assert asset.is_under_warranty is True

        asset.warranty_expiry = date.today() - timedelta(days=1)
        assert asset.is_under_warranty is False

    def test_asset_age_calculation(self):
        """Test asset age calculation."""
        asset = Asset(
            id="ast-001",
            name="Laptop",
            asset_tag="AST-000001",
            category_id="cat-001",
            purchase_date=date.today() - timedelta(days=100),
        )
        assert asset.age_days == 100


class TestAssetCheckoutModel:
    """Test AssetCheckout data model."""

    def test_create_checkout(self):
        """Test creating a checkout."""
        checkout = AssetCheckout(
            id="co-001",
            asset_id="ast-001",
            checked_out_to="emp-001",
            checked_out_by="admin",
        )
        assert checkout.id == "co-001"
        assert checkout.asset_id == "ast-001"
        assert checkout.status == CheckoutStatus.ACTIVE

    def test_checkout_overdue_check(self):
        """Test checkout overdue check."""
        checkout = AssetCheckout(
            id="co-001",
            asset_id="ast-001",
            checked_out_to="emp-001",
            checked_out_by="admin",
            expected_return_date=datetime.utcnow() - timedelta(days=1),
        )
        assert checkout.is_overdue is True

        checkout.expected_return_date = datetime.utcnow() + timedelta(days=1)
        assert checkout.is_overdue is False

    def test_checkout_duration(self):
        """Test checkout duration calculation."""
        now = datetime.utcnow()
        checkout = AssetCheckout(
            id="co-001",
            asset_id="ast-001",
            checked_out_to="emp-001",
            checked_out_by="admin",
            checkout_date=now - timedelta(days=5),
        )
        assert checkout.duration_days == 5


class TestMaintenanceRecordModel:
    """Test MaintenanceRecord data model."""

    def test_create_maintenance_record(self):
        """Test creating a maintenance record."""
        record = MaintenanceRecord(
            id="maint-001",
            asset_id="ast-001",
            maintenance_type=MaintenanceType.PREVENTIVE,
            scheduled_date=date.today(),
            description="Annual inspection",
        )
        assert record.id == "maint-001"
        assert record.maintenance_type == MaintenanceType.PREVENTIVE
        assert record.status == MaintenanceStatus.SCHEDULED


class TestWarrantyModel:
    """Test Warranty data model."""

    def test_warranty_validity(self):
        """Test warranty validity check."""
        warranty = Warranty(
            id="war-001",
            asset_id="ast-001",
            provider="AppleCare",
            start_date=date.today() - timedelta(days=30),
            end_date=date.today() + timedelta(days=335),
        )
        assert warranty.is_valid is True

        warranty.end_date = date.today() - timedelta(days=1)
        assert warranty.is_valid is False


class TestInventoryAuditModel:
    """Test InventoryAudit data model."""

    def test_audit_completion_rate(self):
        """Test audit completion rate calculation."""
        audit = InventoryAudit(
            id="aud-001",
            name="Q1 Audit",
            total_assets=100,
            verified_count=80,
            missing_count=5,
            damaged_count=3,
        )
        assert audit.completion_rate == 88.0


class TestInventoryRegistry:
    """Test InventoryRegistry functionality."""

    @pytest.fixture
    def registry(self):
        """Create a fresh registry for each test."""
        return InventoryRegistry()

    def test_create_and_get_category(self, registry):
        """Test creating and retrieving a category."""
        category = AssetCategory(
            id="cat-001",
            name="Laptops",
            asset_type=AssetType.LAPTOP,
        )
        registry.create_category(category)

        result = registry.get_category("cat-001")
        assert result is not None
        assert result.name == "Laptops"

    def test_create_and_get_asset(self, registry):
        """Test creating and retrieving an asset."""
        asset = Asset(
            id="ast-001",
            name="MacBook Pro",
            asset_tag="AST-000001",
            category_id="cat-001",
        )
        registry.create_asset(asset)

        result = registry.get_asset("ast-001")
        assert result is not None
        assert result.name == "MacBook Pro"

    def test_get_asset_by_tag(self, registry):
        """Test retrieving asset by tag."""
        asset = Asset(
            id="ast-001",
            name="MacBook Pro",
            asset_tag="AST-000001",
            category_id="cat-001",
        )
        registry.create_asset(asset)

        result = registry.get_asset_by_tag("AST-000001")
        assert result is not None
        assert result.id == "ast-001"

    def test_list_assets_with_filters(self, registry):
        """Test listing assets with filters."""
        registry.create_asset(Asset(
            id="ast-001",
            name="Laptop 1",
            asset_tag="AST-000001",
            category_id="cat-001",
            asset_type=AssetType.LAPTOP,
            status=AssetStatus.AVAILABLE,
        ))
        registry.create_asset(Asset(
            id="ast-002",
            name="Monitor 1",
            asset_tag="AST-000002",
            category_id="cat-002",
            asset_type=AssetType.MONITOR,
            status=AssetStatus.IN_USE,
        ))

        laptops = registry.list_assets(asset_type=AssetType.LAPTOP)
        assert len(laptops) == 1

        available = registry.list_assets(status=AssetStatus.AVAILABLE)
        assert len(available) == 1

    def test_checkout_management(self, registry):
        """Test checkout CRUD operations."""
        checkout = AssetCheckout(
            id="co-001",
            asset_id="ast-001",
            checked_out_to="emp-001",
            checked_out_by="admin",
        )
        registry.create_checkout(checkout)

        result = registry.get_checkout("co-001")
        assert result is not None
        assert result.checked_out_to == "emp-001"

    def test_get_overdue_checkouts(self, registry):
        """Test getting overdue checkouts."""
        registry.create_checkout(AssetCheckout(
            id="co-001",
            asset_id="ast-001",
            checked_out_to="emp-001",
            checked_out_by="admin",
            expected_return_date=datetime.utcnow() - timedelta(days=1),
        ))
        registry.create_checkout(AssetCheckout(
            id="co-002",
            asset_id="ast-002",
            checked_out_to="emp-002",
            checked_out_by="admin",
            expected_return_date=datetime.utcnow() + timedelta(days=7),
        ))

        overdue = registry.get_overdue_checkouts()
        assert len(overdue) == 1
        assert overdue[0].id == "co-001"

    def test_maintenance_management(self, registry):
        """Test maintenance CRUD operations."""
        record = MaintenanceRecord(
            id="maint-001",
            asset_id="ast-001",
            maintenance_type=MaintenanceType.PREVENTIVE,
            scheduled_date=date.today() + timedelta(days=7),
        )
        registry.create_maintenance(record)

        upcoming = registry.get_upcoming_maintenance(days=30)
        assert len(upcoming) == 1

    def test_warranty_expiring(self, registry):
        """Test getting expiring warranties."""
        registry.create_warranty(Warranty(
            id="war-001",
            asset_id="ast-001",
            provider="Vendor A",
            end_date=date.today() + timedelta(days=15),
        ))
        registry.create_warranty(Warranty(
            id="war-002",
            asset_id="ast-002",
            provider="Vendor B",
            end_date=date.today() + timedelta(days=60),
        ))

        expiring = registry.get_expiring_warranties(days=30)
        assert len(expiring) == 1
        assert expiring[0].id == "war-001"


class TestInventoryManager:
    """Test InventoryManager functionality."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return InventoryManager()

    def test_create_category(self, manager):
        """Test creating a category."""
        category = manager.create_category(
            name="Laptops",
            asset_type=AssetType.LAPTOP,
            useful_life_years=4,
        )
        assert category is not None
        assert category.name == "Laptops"
        assert category.useful_life_years == 4

    def test_register_asset(self, manager):
        """Test registering an asset."""
        category = manager.create_category(
            name="Laptops",
            asset_type=AssetType.LAPTOP,
        )

        asset = manager.register_asset(
            name="MacBook Pro 16",
            category_id=category.id,
            serial_number="C02XL0KSJGH5",
            model="MacBook Pro 16-inch",
            manufacturer="Apple",
            purchase_date=date.today(),
            purchase_price=2499.00,
        )
        assert asset is not None
        assert asset.name == "MacBook Pro 16"
        assert asset.asset_tag.startswith("AST-")
        assert asset.purchase_price == 2499.00

    def test_search_assets(self, manager):
        """Test searching assets."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        manager.register_asset(
            name="MacBook Pro",
            category_id=category.id,
            serial_number="ABC123",
        )
        manager.register_asset(
            name="Dell XPS",
            category_id=category.id,
            serial_number="DEF456",
        )

        results = manager.search_assets("MacBook")
        assert len(results) == 1
        assert results[0].name == "MacBook Pro"

    def test_assign_and_unassign_asset(self, manager):
        """Test assigning and unassigning an asset."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        asset = manager.register_asset(name="Laptop", category_id=category.id)

        assigned = manager.assign_asset(asset.id, employee_id="emp-001")
        assert assigned.status == AssetStatus.IN_USE
        assert assigned.assigned_to == "emp-001"

        unassigned = manager.unassign_asset(asset.id)
        assert unassigned.status == AssetStatus.AVAILABLE
        assert unassigned.assigned_to is None

    def test_checkout_and_return_asset(self, manager):
        """Test checking out and returning an asset."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        asset = manager.register_asset(name="Laptop", category_id=category.id)

        checkout = manager.checkout_asset(
            asset_id=asset.id,
            checked_out_to="emp-001",
            checked_out_by="admin",
            expected_return_date=datetime.utcnow() + timedelta(days=7),
            purpose="Business trip",
        )
        assert checkout is not None
        assert checkout.status == CheckoutStatus.ACTIVE

        # Verify asset status updated
        updated_asset = manager.get_asset(asset.id)
        assert updated_asset.status == AssetStatus.CHECKED_OUT

        # Return the asset
        returned = manager.return_asset(
            checkout.id,
            returned_to="admin",
            condition_at_return=AssetCondition.GOOD,
        )
        assert returned.status == CheckoutStatus.RETURNED

        # Verify asset available again
        updated_asset = manager.get_asset(asset.id)
        assert updated_asset.status == AssetStatus.AVAILABLE

    def test_reserve_and_cancel_reservation(self, manager):
        """Test reserving and cancelling a reservation."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        asset = manager.register_asset(name="Laptop", category_id=category.id)

        reservation = manager.reserve_asset(
            asset_id=asset.id,
            reserved_by="emp-001",
            start_date=datetime.utcnow() + timedelta(days=1),
            end_date=datetime.utcnow() + timedelta(days=7),
            purpose="Training session",
        )
        assert reservation is not None
        assert reservation.status == ReservationStatus.PENDING

        confirmed = manager.confirm_reservation(reservation.id)
        assert confirmed.status == ReservationStatus.CONFIRMED

        cancelled = manager.cancel_reservation(reservation.id, reason="Training cancelled")
        assert cancelled.status == ReservationStatus.CANCELLED

    def test_schedule_and_complete_maintenance(self, manager):
        """Test scheduling and completing maintenance."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        asset = manager.register_asset(name="Laptop", category_id=category.id)

        record = manager.schedule_maintenance(
            asset_id=asset.id,
            maintenance_type=MaintenanceType.PREVENTIVE,
            scheduled_date=date.today(),
            description="Annual cleaning and inspection",
        )
        assert record is not None
        assert record.status == MaintenanceStatus.SCHEDULED

        started = manager.start_maintenance(record.id)
        assert started.status == MaintenanceStatus.IN_PROGRESS

        # Verify asset in maintenance
        updated_asset = manager.get_asset(asset.id)
        assert updated_asset.status == AssetStatus.IN_MAINTENANCE

        completed = manager.complete_maintenance(
            record.id,
            performed_by="tech-001",
            cost=150.00,
            parts_replaced=["Thermal paste"],
            next_maintenance_date=date.today() + timedelta(days=365),
        )
        assert completed.status == MaintenanceStatus.COMPLETED
        assert completed.cost == 150.00

        # Verify asset available again
        updated_asset = manager.get_asset(asset.id)
        assert updated_asset.status == AssetStatus.AVAILABLE
        assert updated_asset.last_maintenance_date == date.today()

    def test_calculate_depreciation(self, manager):
        """Test calculating depreciation."""
        category = manager.create_category(
            name="Laptops",
            asset_type=AssetType.LAPTOP,
            useful_life_years=4,
            salvage_value_percent=10.0,
        )
        asset = manager.register_asset(
            name="Laptop",
            category_id=category.id,
            purchase_date=date.today() - timedelta(days=365),
            purchase_price=2000.00,
        )

        record = manager.calculate_depreciation(
            asset_id=asset.id,
            period_end=date.today(),
        )
        assert record is not None
        assert record.depreciation_amount > 0
        assert record.book_value < 2000.00

    def test_add_warranty(self, manager):
        """Test adding warranty."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        asset = manager.register_asset(name="Laptop", category_id=category.id)

        warranty = manager.add_warranty(
            asset_id=asset.id,
            provider="AppleCare",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365 * 3),
            warranty_type="extended",
            coverage_details="Full coverage including accidental damage",
        )
        assert warranty is not None
        assert warranty.provider == "AppleCare"
        assert warranty.is_valid is True

    def test_create_and_complete_audit(self, manager):
        """Test creating and completing an audit."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        location = manager.create_location(name="Main Office", building="HQ")

        # Create some assets
        for i in range(5):
            manager.register_asset(
                name=f"Laptop {i+1}",
                category_id=category.id,
                location_id=location.id,
            )

        audit = manager.create_audit(
            name="Q1 Audit",
            scheduled_date=date.today(),
            location_id=location.id,
            created_by="admin",
        )
        assert audit.total_assets == 5

        started = manager.start_audit(audit.id, auditors=["auditor-001"])
        assert started.status == AuditStatus.IN_PROGRESS

        # Scan some assets
        items = manager.get_audit_items(audit.id)
        for item in items[:3]:
            manager.scan_asset(
                audit_id=audit.id,
                asset_id=item.asset_id,
                result=AuditResult.VERIFIED,
                scanned_by="auditor-001",
            )

        # Check audit progress
        updated_audit = manager.get_audit(audit.id)
        assert updated_audit.verified_count == 3

        completed = manager.complete_audit(audit.id)
        assert completed.status == AuditStatus.COMPLETED

    def test_initiate_and_complete_disposal(self, manager):
        """Test initiating and completing disposal."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)
        asset = manager.register_asset(
            name="Old Laptop",
            category_id=category.id,
            purchase_price=1500.00,
        )

        disposal = manager.initiate_disposal(
            asset_id=asset.id,
            disposal_method=DisposalMethod.SOLD,
            reason="End of life - 5 years old",
            created_by="admin",
        )
        assert disposal is not None
        assert disposal.status == "pending"

        # Verify asset status
        updated_asset = manager.get_asset(asset.id)
        assert updated_asset.status == AssetStatus.PENDING_DISPOSAL

        approved = manager.approve_disposal(disposal.id, approved_by="manager")
        assert approved.status == "approved"

        completed = manager.complete_disposal(
            disposal.id,
            completed_by="admin",
            proceeds=200.00,
            disposal_cost=25.00,
            recipient="Employee buyback program",
        )
        assert completed.status == "completed"
        assert completed.net_proceeds == 175.00

        # Verify asset disposed
        updated_asset = manager.get_asset(asset.id)
        assert updated_asset.status == AssetStatus.DISPOSED

    def test_create_location(self, manager):
        """Test creating a location."""
        location = manager.create_location(
            name="Main Office",
            building="Headquarters",
            floor="3rd",
            room="301",
        )
        assert location is not None
        assert location.name == "Main Office"
        assert location.building == "Headquarters"

    def test_create_vendor(self, manager):
        """Test creating a vendor."""
        vendor = manager.create_vendor(
            name="Dell Technologies",
            email="orders@dell.com",
            phone="1-800-999-3355",
            vendor_type="manufacturer",
        )
        assert vendor is not None
        assert vendor.name == "Dell Technologies"
        assert vendor.vendor_type == "manufacturer"

    def test_generate_analytics(self, manager):
        """Test generating analytics."""
        category = manager.create_category(name="Laptops", asset_type=AssetType.LAPTOP)

        # Create some assets
        for i in range(5):
            asset = manager.register_asset(
                name=f"Laptop {i+1}",
                category_id=category.id,
                purchase_price=1500.00,
            )
            if i < 2:
                manager.assign_asset(asset.id, employee_id=f"emp-{i+1}")

        analytics = manager.generate_analytics(
            period_start=date.today() - timedelta(days=30),
            period_end=date.today(),
        )
        assert analytics.total_assets == 5
        assert analytics.total_value == 7500.00
        assert analytics.assets_by_type["laptop"] == 5


class TestGlobalInstances:
    """Test global instance management."""

    def test_get_inventory_manager(self):
        """Test getting global inventory manager."""
        reset_inventory_manager()
        manager = get_inventory_manager()
        assert manager is not None
        assert isinstance(manager, InventoryManager)

    def test_set_inventory_manager(self):
        """Test setting custom inventory manager."""
        reset_inventory_manager()
        custom_manager = InventoryManager()
        set_inventory_manager(custom_manager)

        manager = get_inventory_manager()
        assert manager is custom_manager

    def test_reset_inventory_manager(self):
        """Test resetting inventory manager."""
        manager1 = get_inventory_manager()
        reset_inventory_manager()
        manager2 = get_inventory_manager()
        assert manager1 is not manager2


class TestInventoryWorkflows:
    """Test complete inventory workflows."""

    @pytest.fixture
    def manager(self):
        """Create a fresh manager for each test."""
        return InventoryManager()

    def test_asset_lifecycle(self, manager):
        """Test complete asset lifecycle from purchase to disposal."""
        # Setup
        category = manager.create_category(
            name="Laptops",
            asset_type=AssetType.LAPTOP,
            useful_life_years=4,
        )
        location = manager.create_location(name="IT Storage")
        vendor = manager.create_vendor(name="Dell", vendor_type="manufacturer")

        # 1. Register asset
        asset = manager.register_asset(
            name="Dell XPS 15",
            category_id=category.id,
            serial_number="SVC12345",
            model="XPS 15 9520",
            manufacturer="Dell",
            purchase_date=date.today(),
            purchase_price=1800.00,
            location_id=location.id,
            vendor_id=vendor.id,
        )
        assert asset.status == AssetStatus.AVAILABLE

        # 2. Add warranty
        warranty = manager.add_warranty(
            asset_id=asset.id,
            provider="Dell ProSupport",
            start_date=date.today(),
            end_date=date.today() + timedelta(days=365 * 3),
        )

        # 3. Assign to employee
        assigned = manager.assign_asset(asset.id, employee_id="emp-001")
        assert assigned.status == AssetStatus.IN_USE

        # 4. Schedule maintenance
        maint = manager.schedule_maintenance(
            asset_id=asset.id,
            maintenance_type=MaintenanceType.PREVENTIVE,
            scheduled_date=date.today() + timedelta(days=180),
            description="6-month checkup",
        )

        # 5. Unassign
        manager.unassign_asset(asset.id)

        # 6. Check out for temporary use
        checkout = manager.checkout_asset(
            asset_id=asset.id,
            checked_out_to="emp-002",
            checked_out_by="admin",
            expected_return_date=datetime.utcnow() + timedelta(days=7),
        )

        # 7. Return
        manager.return_asset(checkout.id, returned_to="admin")

        # 8. After years of use, calculate depreciation
        depreciation = manager.calculate_depreciation(
            asset_id=asset.id,
            period_end=date.today(),
        )

        # 9. Eventually dispose
        disposal = manager.initiate_disposal(
            asset_id=asset.id,
            disposal_method=DisposalMethod.DONATED,
            reason="End of useful life",
        )
        manager.approve_disposal(disposal.id, approved_by="manager")
        manager.complete_disposal(
            disposal.id,
            completed_by="admin",
            recipient="Local School",
        )

        # Verify final state
        final_asset = manager.get_asset(asset.id)
        assert final_asset.status == AssetStatus.DISPOSED

    def test_equipment_checkout_workflow(self, manager):
        """Test equipment checkout for events/projects."""
        category = manager.create_category(
            name="AV Equipment",
            asset_type=AssetType.AUDIO_VIDEO,
        )

        # Register projector
        projector = manager.register_asset(
            name="Epson Projector",
            category_id=category.id,
        )

        # Reserve for conference
        reservation = manager.reserve_asset(
            asset_id=projector.id,
            reserved_by="event-coordinator",
            start_date=datetime.utcnow() + timedelta(days=7),
            end_date=datetime.utcnow() + timedelta(days=8),
            purpose="Annual Conference",
        )
        manager.confirm_reservation(reservation.id)

        # Day of event - checkout
        checkout = manager.checkout_asset(
            asset_id=projector.id,
            checked_out_to="event-coordinator",
            checked_out_by="admin",
            purpose="Annual Conference",
        )

        # After event - return with condition note
        returned = manager.return_asset(
            checkout.id,
            returned_to="admin",
            condition_at_return=AssetCondition.GOOD,
            notes="Working perfectly",
        )

        assert returned.status == CheckoutStatus.RETURNED

    def test_maintenance_scheduling_workflow(self, manager):
        """Test maintenance scheduling and tracking."""
        category = manager.create_category(
            name="Vehicles",
            asset_type=AssetType.VEHICLE,
            maintenance_interval_days=90,
        )

        vehicle = manager.register_asset(
            name="Company Van",
            category_id=category.id,
            model="Ford Transit",
        )

        # Schedule quarterly maintenance
        maint = manager.schedule_maintenance(
            asset_id=vehicle.id,
            maintenance_type=MaintenanceType.PREVENTIVE,
            scheduled_date=date.today(),
            description="Oil change and tire rotation",
        )

        # Start maintenance
        manager.start_maintenance(maint.id)

        # Verify vehicle in maintenance
        updated_vehicle = manager.get_asset(vehicle.id)
        assert updated_vehicle.status == AssetStatus.IN_MAINTENANCE

        # Complete maintenance
        completed = manager.complete_maintenance(
            maint.id,
            performed_by="Auto Shop",
            cost=250.00,
            parts_replaced=["Oil filter", "5 quarts oil"],
            next_maintenance_date=date.today() + timedelta(days=90),
        )

        # Verify next maintenance scheduled
        updated_vehicle = manager.get_asset(vehicle.id)
        assert updated_vehicle.next_maintenance_date == date.today() + timedelta(days=90)
