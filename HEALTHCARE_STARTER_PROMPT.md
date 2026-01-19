# HEALTHCARE AGENTS - STARTER PROMPT FOR PARALLEL SESSION

**Copy and paste this entire prompt into a new Claude Code session**

---

## CONTEXT

You are building **Healthcare Agents** for SwissBrain.ai (formerly SwissVault.ai) - a Swiss-hosted, privacy-first AI platform. This is a **NEW INDEPENDENT MODULE** that must not modify or conflict with existing functionality.

### Read the full context first:
```bash
cat ~/swiss-ai-vault/SWISSVAULT_CONTEXT_JAN19_2026.md
```

---

## CRITICAL RULES - DO NOT BREAK EXISTING CODE

### 1. FILE NAMING CONVENTIONS (MANDATORY)
All healthcare files MUST use the `healthcare-` prefix or be in `/healthcare/` directories:

```
# Edge Functions - CREATE NEW, DON'T MODIFY EXISTING
supabase/functions/healthcare-*/

# Database Migrations - USE HEALTHCARE PREFIX
supabase/migrations/YYYYMMDD_healthcare_*.sql

# Agent API - CREATE NEW DIRECTORY
agent-api/app/healthcare/

# Frontend Components - CREATE NEW DIRECTORY
src/components/healthcare/
src/pages/healthcare/
src/hooks/useHealthcare*.ts

# Types - CREATE NEW FILE
src/types/healthcare.ts
```

### 2. TABLES - USE `healthcare_` PREFIX
```sql
-- CORRECT:
healthcare_patients
healthcare_records
healthcare_appointments
healthcare_providers
healthcare_audit_logs

-- WRONG (would conflict):
patients
records
appointments
```

### 3. EDGE FUNCTIONS - USE `healthcare-` PREFIX
```
healthcare-patients      -- Patient management
healthcare-records       -- Medical records
healthcare-appointments  -- Scheduling
healthcare-research      -- Medical literature
healthcare-workflow      -- Clinical workflows
healthcare-audit         -- HIPAA audit logs
```

### 4. DO NOT MODIFY THESE FILES
```
# Core agent system (working, don't touch)
supabase/functions/agent-execute/
supabase/functions/agent-status/
supabase/functions/agent-logs/

# Ghost mode (privacy layer, don't touch)
supabase/functions/ghost-*/

# Auth system (working, don't touch)
src/contexts/AuthContext.tsx
src/hooks/useAuth.ts

# Existing connectors (working, don't touch)
agent-api/app/connectors/
```

---

## CURRENT ARCHITECTURE REFERENCE

### Database
- **Supabase Project**: rljnrgscmosgkcjdvlrq
- **151 migrations** already exist
- **RLS enabled** on all tables (you must add RLS to new tables)

### Agent API (Python/FastAPI)
- Location: `~/swiss-ai-vault/agent-api/`
- Running on Swiss K8s at `api.swissbrain.ai`
- Image: `axessvideo/agent-api:v16-auth-fix`

### Edge Functions (Deno/TypeScript)
- Location: `~/swiss-ai-vault/supabase/functions/`
- 83 functions deployed
- Shared code in `_shared/`

### Frontend (React/TypeScript)
- Location: `~/swiss-ai-vault/src/`
- 46 components, 81 hooks, 61 pages
- Uses Radix UI + Tailwind CSS

---

## HEALTHCARE MODULE SPECIFICATION

### Phase 1: Database Schema
Create these tables with HIPAA-compliant design:

```sql
-- 1. Healthcare Providers (doctors, clinics)
healthcare_providers (
  id, user_id, provider_type, license_number,
  specializations, organization_name,
  hipaa_certified_at, created_at, updated_at
)

-- 2. Patients (with encryption)
healthcare_patients (
  id, user_id, provider_id,
  encrypted_name, encrypted_dob, encrypted_ssn,
  blood_type, allergies_encrypted,
  emergency_contact_encrypted,
  consent_signed_at, created_at, updated_at
)

-- 3. Medical Records (encrypted)
healthcare_records (
  id, patient_id, provider_id, record_type,
  encrypted_content, encrypted_diagnosis,
  icd10_codes, cpt_codes,
  visit_date, created_at, updated_at
)

-- 4. Appointments
healthcare_appointments (
  id, patient_id, provider_id,
  appointment_type, scheduled_at, duration_minutes,
  status, notes_encrypted, telehealth_url,
  reminder_sent_at, created_at, updated_at
)

-- 5. HIPAA Audit Log (CRITICAL)
healthcare_audit_logs (
  id, user_id, patient_id, action,
  resource_type, resource_id,
  ip_address, user_agent,
  access_reason, created_at
  -- NO updated_at - audit logs are immutable
)

-- 6. Prescriptions
healthcare_prescriptions (
  id, patient_id, provider_id, record_id,
  medication_name, dosage, frequency,
  start_date, end_date, refills_remaining,
  pharmacy_encrypted, created_at, updated_at
)
```

### Phase 2: Edge Functions
Create these Deno functions:

```typescript
// supabase/functions/healthcare-patients/index.ts
// CRUD for patient management with encryption

// supabase/functions/healthcare-records/index.ts
// Medical record management with audit logging

// supabase/functions/healthcare-appointments/index.ts
// Scheduling with conflict detection

// supabase/functions/healthcare-research/index.ts
// Medical literature search (PubMed, clinical trials)

// supabase/functions/healthcare-workflow/index.ts
// Clinical workflow automation

// supabase/functions/healthcare-audit/index.ts
// HIPAA audit log queries
```

### Phase 3: Agent API Tools
Create Python module:

```python
# agent-api/app/healthcare/__init__.py
# agent-api/app/healthcare/tools.py
# agent-api/app/healthcare/workflows.py
# agent-api/app/healthcare/research.py
# agent-api/app/healthcare/fhir.py  # HL7/FHIR integration
```

### Phase 4: Frontend Components
```typescript
// src/pages/healthcare/Dashboard.tsx
// src/pages/healthcare/Patients.tsx
// src/pages/healthcare/Records.tsx
// src/pages/healthcare/Appointments.tsx
// src/pages/healthcare/Research.tsx

// src/components/healthcare/PatientCard.tsx
// src/components/healthcare/RecordViewer.tsx
// src/components/healthcare/AppointmentScheduler.tsx
// src/components/healthcare/AuditLogViewer.tsx

// src/hooks/useHealthcarePatients.ts
// src/hooks/useHealthcareRecords.ts
// src/hooks/useHealthcareAppointments.ts
```

---

## ENCRYPTION REQUIREMENTS

Healthcare data MUST be encrypted. Use the existing encryption pattern:

```typescript
// Use Supabase Vault or application-level encryption
// Pattern from connector_credentials table:
encrypted_content TEXT NOT NULL,  -- Fernet or AES-256-GCM
encryption_key_id UUID,           -- Reference to key management
```

For the agent-api, encryption utilities exist at:
```python
# Reference: agent-api/app/connectors/oauth/encryption.py
from cryptography.fernet import Fernet
```

---

## HIPAA AUDIT LOGGING

EVERY access to patient data MUST be logged:

```typescript
async function auditLog(
  supabase: Client,
  action: 'view' | 'create' | 'update' | 'delete' | 'export',
  resourceType: 'patient' | 'record' | 'prescription',
  resourceId: string,
  userId: string,
  reason: string
) {
  await supabase.from('healthcare_audit_logs').insert({
    user_id: userId,
    action,
    resource_type: resourceType,
    resource_id: resourceId,
    access_reason: reason,
    ip_address: request.headers.get('x-forwarded-for'),
    user_agent: request.headers.get('user-agent'),
  });
}
```

---

## RLS POLICIES TEMPLATE

All healthcare tables need strict RLS:

```sql
-- Enable RLS
ALTER TABLE healthcare_patients ENABLE ROW LEVEL SECURITY;

-- Providers can only see their patients
CREATE POLICY "Providers see own patients"
ON healthcare_patients FOR SELECT
USING (
  provider_id IN (
    SELECT id FROM healthcare_providers
    WHERE user_id = auth.uid()
  )
);

-- Patients can see their own data
CREATE POLICY "Patients see own data"
ON healthcare_patients FOR SELECT
USING (user_id = auth.uid());

-- Service role for backend operations
CREATE POLICY "Service role full access"
ON healthcare_patients FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');
```

---

## GETTING STARTED

### Step 1: Create the database migration
```bash
cd ~/swiss-ai-vault
# Create migration file
touch supabase/migrations/$(date +%Y%m%d%H%M%S)_healthcare_schema.sql
```

### Step 2: Create edge function skeleton
```bash
cd ~/swiss-ai-vault/supabase/functions
mkdir healthcare-patients
echo 'import { serve } from "https://deno.land/std@0.168.0/http/server.ts";' > healthcare-patients/index.ts
```

### Step 3: Create agent-api module
```bash
mkdir -p ~/swiss-ai-vault/agent-api/app/healthcare
touch ~/swiss-ai-vault/agent-api/app/healthcare/__init__.py
touch ~/swiss-ai-vault/agent-api/app/healthcare/tools.py
```

### Step 4: Create frontend structure
```bash
mkdir -p ~/swiss-ai-vault/src/pages/healthcare
mkdir -p ~/swiss-ai-vault/src/components/healthcare
touch ~/swiss-ai-vault/src/types/healthcare.ts
```

---

## VALIDATION CHECKLIST

Before committing any code, verify:

- [ ] All new tables have `healthcare_` prefix
- [ ] All new functions have `healthcare-` prefix
- [ ] RLS is enabled on all new tables
- [ ] HIPAA audit logging is implemented
- [ ] No existing files were modified
- [ ] Encryption is used for PII/PHI
- [ ] TypeScript types are defined
- [ ] Tests are included

---

## START COMMAND

Begin by creating the database schema. Run this command to start:

```bash
cd ~/swiss-ai-vault
# Then tell Claude: "Create the healthcare database schema following HEALTHCARE_STARTER_PROMPT.md"
```

---

**END OF STARTER PROMPT**
