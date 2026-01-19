# SwissBrain Differentiators - Pending Spec Approval

**Status**: AWAITING_SPEC_APPROVAL
**Created**: 2026-01-16
**Last Updated**: 2026-01-16

---

## Overview

This document tracks SwissBrain-specific features that extend beyond Manus.im parity. These modules were implemented proactively but **do not yet have formal specification documents**. They should remain behind feature flags until specs are approved.

---

## Feature Flag Configuration

All differentiator modules are gated by:

```python
# app/config/feature_flags.py
SWISSBRAIN_DIFFERENTIATORS = {
    "training_learning_management": False,  # Disabled until spec approved
    "visitor_management": False,            # Disabled until spec approved
    "shift_scheduling": False,              # Disabled until spec approved
    "inventory_asset_management": False,    # Disabled until spec approved
}
```

---

## Pending Modules

### 1. Training & Learning Management

**File**: `app/collaboration/training.py`
**Tests**: `tests/collaboration/test_training.py`
**Status**: `AWAITING_SPEC_APPROVAL`

**Proposed Functionality**:
- Course management (types, formats, difficulty levels)
- Enrollment and progress tracking
- Assessments and certifications
- Learning paths and curricula
- Training budgets and requests
- Instructor management
- Training analytics

**Enterprise Gaps Identified**:
- [ ] Compliance retention policy not defined
- [ ] RBAC for training admin roles not specified
- [ ] Integration with external LMS systems not defined
- [ ] Audit log requirements not specified

**To Formalize**: Create `docs/specs/TRAINING_MANAGEMENT_SPEC.md`

---

### 2. Visitor Management

**File**: `app/collaboration/visitors.py`
**Tests**: `tests/collaboration/test_visitors.py`
**Status**: `AWAITING_SPEC_APPROVAL`

**Proposed Functionality**:
- Visitor registration and check-in/out
- Badge management
- Host notifications
- Agreement/NDA signing
- Watchlist management
- Recurring and group visits
- Visitor analytics

**Enterprise Gaps Identified**:
- [ ] Physical security integration not defined
- [ ] Data retention for visitor logs not specified
- [ ] GDPR/privacy compliance requirements not defined
- [ ] Emergency evacuation list integration not specified

**To Formalize**: Create `docs/specs/VISITOR_MANAGEMENT_SPEC.md`

---

### 3. Shift Scheduling

**File**: `app/collaboration/shifts.py`
**Tests**: `tests/collaboration/test_shifts.py`
**Status**: `AWAITING_SPEC_APPROVAL`

**Proposed Functionality**:
- Shift definitions and assignments
- Schedule management with templates
- Employee availability tracking
- Time-off requests and balances
- Shift swaps and coverage requests
- Overtime tracking
- Shift analytics

**Enterprise Gaps Identified**:
- [ ] Labor law compliance (breaks, max hours) not defined
- [ ] Union rule integration not specified
- [ ] Payroll system integration not defined
- [ ] Manager approval workflows not specified

**To Formalize**: Create `docs/specs/SHIFT_SCHEDULING_SPEC.md`

---

### 4. Inventory & Asset Management

**File**: `app/collaboration/inventory.py`
**Tests**: `tests/collaboration/test_inventory.py`
**Status**: `AWAITING_SPEC_APPROVAL`

**Proposed Functionality**:
- Asset registration and categorization
- Check-out/check-in tracking
- Reservations
- Maintenance scheduling
- Depreciation tracking
- Warranty management
- Inventory audits
- Asset disposal

**Enterprise Gaps Identified**:
- [ ] Fixed asset accounting integration not defined
- [ ] Insurance tracking not specified
- [ ] Procurement workflow integration not defined
- [ ] Barcode/RFID integration not specified

**To Formalize**: Create `docs/specs/INVENTORY_MANAGEMENT_SPEC.md`

---

## Required Actions Before Enabling

For each module to be enabled in production:

1. **Create Formal Spec**: Document in `docs/specs/` with:
   - Functional requirements
   - Data model
   - API endpoints
   - Security requirements
   - Audit requirements
   - Integration points

2. **Enterprise Policy Review**:
   - RBAC roles and permissions
   - Data retention policies
   - Audit log requirements
   - Compliance requirements

3. **Technical Review**:
   - Idempotency keys for all mutations
   - Exactly-once semantics verification
   - Metrics instrumentation
   - Alert rules definition
   - Runbook creation

4. **Security Review**:
   - Input validation
   - Authorization checks
   - Sensitive data handling
   - Rate limiting

---

## Test Coverage Summary

| Module | Unit Tests | Integration Tests | Total |
|--------|------------|-------------------|-------|
| Training | 50 | 0 | 50 |
| Visitors | 57 | 0 | 57 |
| Shifts | 50 | 0 | 50 |
| Inventory | 43 | 0 | 43 |
| **Total** | **200** | **0** | **200** |

---

## Relationship to Manus Parity

These modules are **not** part of Manus.im core functionality. They represent potential SwissBrain differentiators targeting enterprise HR/Operations use cases.

**Manus Parity Features** (in specs):
- Plan Scoring (`SWISSBRAIN_INTELLIGENCE_STACK.md`)
- Research Orchestration (`SWISSBRAIN_INTELLIGENCE_STACK.md`)
- Confidence Scoring (`SWISSBRAIN_INTELLIGENCE_STACK.md`)
- Presentation Generation (`SWISSBRAIN_INTELLIGENCE_STACK.md`)
- Email Ingestion (`SWISSBRAIN_INTELLIGENCE_STACK.md`)
- Collaboration Conflict Resolution (`SWISSBRAIN_INTELLIGENCE_STACK.md`)
- Prompt Management (`docs/PHASE5_PROMPT_MANAGEMENT.md`)

**SwissBrain Differentiators** (this document):
- Training & Learning Management
- Visitor Management
- Shift Scheduling
- Inventory & Asset Management

---

## Decision Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-01-16 | Mark all 4 modules as AWAITING_SPEC_APPROVAL | No formal specs exist in repo intel docs |
| 2026-01-16 | Keep modules but gate behind feature flags | Preserve work while ensuring spec-driven development |
| 2026-01-16 | Prioritize Manus parity features | SSOT compliance requires implementing spec'd features first |

---

## Next Steps

1. Implement missing Manus parity features per `SWISSBRAIN_INTELLIGENCE_STACK.md`
2. Gather business requirements for differentiator modules
3. Create formal specs for each differentiator
4. Security and compliance review
5. Enable feature flags after approval
