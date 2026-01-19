-- Healthcare Agents Schema for SwissBrain.ai
-- HIPAA-compliant tables with encryption for PII/PHI
-- All tables use healthcare_ prefix to avoid conflicts

-- =============================================================================
-- 1. HEALTHCARE_PROVIDERS - Doctors, clinics, healthcare organizations
-- =============================================================================
CREATE TABLE IF NOT EXISTS healthcare_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Provider identification
    provider_type TEXT NOT NULL CHECK (provider_type IN ('physician', 'nurse', 'clinic', 'hospital', 'pharmacy', 'lab', 'specialist', 'therapist', 'other')),
    license_number TEXT,
    npi_number TEXT, -- National Provider Identifier (US)

    -- Organization details
    organization_name TEXT,
    organization_type TEXT,
    specializations TEXT[] DEFAULT '{}',

    -- Contact (encrypted for additional privacy)
    contact_email_encrypted TEXT,
    contact_phone_encrypted TEXT,
    address_encrypted TEXT,

    -- Compliance
    hipaa_certified_at TIMESTAMPTZ,
    certification_expires_at TIMESTAMPTZ,

    -- Status
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMPTZ,
    verified_by UUID REFERENCES auth.users(id),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    UNIQUE(user_id),
    UNIQUE(npi_number)
);

-- =============================================================================
-- 2. HEALTHCARE_PATIENTS - Patient records with encrypted PII
-- =============================================================================
CREATE TABLE IF NOT EXISTS healthcare_patients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL, -- Patient may have account
    provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,

    -- Patient identification (ALL ENCRYPTED)
    encrypted_first_name TEXT NOT NULL,
    encrypted_last_name TEXT NOT NULL,
    encrypted_dob TEXT NOT NULL, -- Date of birth
    encrypted_ssn TEXT, -- Social Security Number (optional)
    encrypted_mrn TEXT, -- Medical Record Number

    -- Medical info (encrypted where needed)
    blood_type TEXT CHECK (blood_type IN ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', NULL)),
    allergies_encrypted TEXT, -- JSON array of allergies
    current_medications_encrypted TEXT, -- JSON array of medications
    medical_conditions_encrypted TEXT, -- JSON array of conditions

    -- Contact (encrypted)
    encrypted_email TEXT,
    encrypted_phone TEXT,
    encrypted_address TEXT,
    emergency_contact_encrypted TEXT, -- JSON with name, phone, relationship

    -- Insurance (encrypted)
    insurance_info_encrypted TEXT, -- JSON with provider, policy, group numbers

    -- Consent and legal
    consent_signed_at TIMESTAMPTZ,
    consent_document_id UUID, -- Reference to stored consent document
    hipaa_authorization_signed_at TIMESTAMPTZ,

    -- Demographics (non-identifying)
    gender TEXT CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say', NULL)),
    preferred_language TEXT DEFAULT 'en',

    -- Status
    is_active BOOLEAN DEFAULT true,

    -- Encryption key reference (for key rotation)
    encryption_key_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 3. HEALTHCARE_RECORDS - Medical records with encrypted PHI
-- =============================================================================
CREATE TABLE IF NOT EXISTS healthcare_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES healthcare_patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,

    -- Record classification
    record_type TEXT NOT NULL CHECK (record_type IN (
        'visit_note', 'lab_result', 'imaging', 'prescription', 'referral',
        'discharge_summary', 'progress_note', 'consultation', 'procedure',
        'immunization', 'vital_signs', 'allergy_update', 'diagnosis', 'other'
    )),

    -- Clinical content (ENCRYPTED)
    encrypted_content TEXT NOT NULL, -- Main record content (JSON or text)
    encrypted_diagnosis TEXT, -- Primary diagnosis
    encrypted_notes TEXT, -- Additional provider notes
    encrypted_treatment_plan TEXT, -- Treatment recommendations

    -- Medical coding (not encrypted - for analytics/billing)
    icd10_codes TEXT[] DEFAULT '{}', -- International Classification of Diseases
    cpt_codes TEXT[] DEFAULT '{}', -- Current Procedural Terminology
    loinc_codes TEXT[] DEFAULT '{}', -- Lab test codes
    snomed_codes TEXT[] DEFAULT '{}', -- Clinical terminology

    -- Visit details
    visit_date TIMESTAMPTZ NOT NULL,
    visit_type TEXT CHECK (visit_type IN ('in_person', 'telehealth', 'phone', 'async', NULL)),
    duration_minutes INTEGER,

    -- Vital signs (can be stored separately or in encrypted_content)
    vital_signs JSONB, -- Non-identifying aggregate vitals

    -- Attachments
    attachment_ids UUID[] DEFAULT '{}', -- References to secure file storage

    -- Record status
    status TEXT DEFAULT 'final' CHECK (status IN ('draft', 'final', 'amended', 'deleted')),
    amended_from_id UUID REFERENCES healthcare_records(id),

    -- Signatures
    signed_by UUID REFERENCES auth.users(id),
    signed_at TIMESTAMPTZ,
    co_signed_by UUID REFERENCES auth.users(id),
    co_signed_at TIMESTAMPTZ,

    -- Encryption key reference
    encryption_key_id UUID,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. HEALTHCARE_APPOINTMENTS - Scheduling with conflict detection
-- =============================================================================
CREATE TABLE IF NOT EXISTS healthcare_appointments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES healthcare_patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,

    -- Appointment details
    appointment_type TEXT NOT NULL CHECK (appointment_type IN (
        'initial_consultation', 'follow_up', 'routine_checkup', 'urgent',
        'procedure', 'lab_work', 'imaging', 'telehealth', 'phone', 'other'
    )),
    reason_for_visit TEXT, -- Not encrypted - general reason
    notes_encrypted TEXT, -- Detailed notes (encrypted)

    -- Scheduling
    scheduled_at TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 30,
    end_at TIMESTAMPTZ GENERATED ALWAYS AS (scheduled_at + (duration_minutes || ' minutes')::INTERVAL) STORED,
    timezone TEXT DEFAULT 'UTC',

    -- Status
    status TEXT DEFAULT 'scheduled' CHECK (status IN (
        'scheduled', 'confirmed', 'checked_in', 'in_progress',
        'completed', 'cancelled', 'no_show', 'rescheduled'
    )),
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES auth.users(id),
    cancellation_reason TEXT,

    -- Telehealth
    is_telehealth BOOLEAN DEFAULT false,
    telehealth_url TEXT,
    telehealth_provider TEXT, -- 'zoom', 'doxy', 'custom', etc.

    -- Reminders
    reminder_sent_at TIMESTAMPTZ,
    reminder_24h_sent BOOLEAN DEFAULT false,
    reminder_1h_sent BOOLEAN DEFAULT false,

    -- Check-in
    checked_in_at TIMESTAMPTZ,

    -- Linked records
    created_record_id UUID REFERENCES healthcare_records(id),

    -- Recurring appointments
    recurrence_rule TEXT, -- iCal RRULE format
    recurrence_parent_id UUID REFERENCES healthcare_appointments(id),

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraint to prevent double-booking (same provider, overlapping times)
    EXCLUDE USING gist (
        provider_id WITH =,
        tstzrange(scheduled_at, scheduled_at + (duration_minutes || ' minutes')::INTERVAL) WITH &&
    ) WHERE (status NOT IN ('cancelled', 'rescheduled'))
);

-- =============================================================================
-- 5. HEALTHCARE_PRESCRIPTIONS - Medication prescriptions
-- =============================================================================
CREATE TABLE IF NOT EXISTS healthcare_prescriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id UUID NOT NULL REFERENCES healthcare_patients(id) ON DELETE CASCADE,
    provider_id UUID NOT NULL REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    record_id UUID REFERENCES healthcare_records(id), -- Associated visit record

    -- Medication details
    medication_name TEXT NOT NULL,
    medication_code TEXT, -- NDC code or RxNorm
    dosage TEXT NOT NULL, -- e.g., "500mg"
    dosage_form TEXT, -- tablet, capsule, liquid, injection, etc.
    frequency TEXT NOT NULL, -- e.g., "twice daily", "every 8 hours"
    route TEXT DEFAULT 'oral', -- oral, topical, injection, etc.

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE,
    duration_days INTEGER,
    is_ongoing BOOLEAN DEFAULT false,

    -- Quantity and refills
    quantity INTEGER,
    quantity_unit TEXT, -- tablets, ml, etc.
    refills_authorized INTEGER DEFAULT 0,
    refills_remaining INTEGER DEFAULT 0,

    -- Pharmacy (encrypted)
    pharmacy_encrypted TEXT, -- JSON with pharmacy name, address, phone

    -- Instructions (encrypted for detailed notes)
    instructions TEXT, -- Patient-facing instructions
    provider_notes_encrypted TEXT, -- Provider notes

    -- Safety
    is_controlled_substance BOOLEAN DEFAULT false,
    dea_schedule TEXT CHECK (dea_schedule IN ('I', 'II', 'III', 'IV', 'V', NULL)),

    -- Status
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'discontinued', 'on_hold', 'cancelled')),
    discontinued_at TIMESTAMPTZ,
    discontinued_by UUID REFERENCES auth.users(id),
    discontinue_reason TEXT,

    -- E-prescribing
    e_prescribed BOOLEAN DEFAULT false,
    e_prescribe_sent_at TIMESTAMPTZ,
    e_prescribe_status TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. HEALTHCARE_AUDIT_LOGS - HIPAA-compliant audit trail (IMMUTABLE)
-- =============================================================================
CREATE TABLE IF NOT EXISTS healthcare_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Actor information
    user_id UUID REFERENCES auth.users(id),
    provider_id UUID REFERENCES healthcare_providers(id),
    actor_email TEXT,
    actor_name TEXT,
    actor_role TEXT, -- 'provider', 'patient', 'admin', 'system'

    -- Patient context (for PHI access tracking)
    patient_id UUID REFERENCES healthcare_patients(id),

    -- Action details
    action TEXT NOT NULL CHECK (action IN (
        'view', 'create', 'update', 'delete', 'export', 'print',
        'access_denied', 'login', 'logout', 'share', 'fax', 'email',
        'consent_signed', 'consent_revoked', 'emergency_access'
    )),

    -- Resource information
    resource_type TEXT NOT NULL CHECK (resource_type IN (
        'patient', 'record', 'prescription', 'appointment',
        'provider', 'document', 'report', 'system'
    )),
    resource_id UUID,
    resource_description TEXT, -- Human-readable description

    -- Access context (HIPAA requirement)
    access_reason TEXT NOT NULL, -- Why was this data accessed?
    is_emergency_access BOOLEAN DEFAULT false, -- Break-the-glass access
    emergency_override_reason TEXT,

    -- Request metadata
    ip_address INET,
    user_agent TEXT,
    request_id TEXT,
    session_id TEXT,

    -- Location (for security monitoring)
    geo_country TEXT,
    geo_region TEXT,

    -- Details (additional context)
    details JSONB DEFAULT '{}',

    -- Status
    status TEXT DEFAULT 'success' CHECK (status IN ('success', 'failure', 'blocked')),
    error_message TEXT,

    -- Timestamp (NO updated_at - logs are immutable)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

    -- NOTE: No updated_at column - audit logs must be immutable for HIPAA compliance
);

-- =============================================================================
-- ROW LEVEL SECURITY POLICIES
-- =============================================================================

-- Enable RLS on all healthcare tables
ALTER TABLE healthcare_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_prescriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_audit_logs ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------------
-- HEALTHCARE_PROVIDERS Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Providers can view own profile"
    ON healthcare_providers FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Providers can update own profile"
    ON healthcare_providers FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can create provider profile"
    ON healthcare_providers FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Service role full access to providers"
    ON healthcare_providers FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- HEALTHCARE_PATIENTS Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Providers can view their patients"
    ON healthcare_patients FOR SELECT
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view own record"
    ON healthcare_patients FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Providers can create patients"
    ON healthcare_patients FOR INSERT
    WITH CHECK (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can update their patients"
    ON healthcare_patients FOR UPDATE
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to patients"
    ON healthcare_patients FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- HEALTHCARE_RECORDS Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Providers can view their patient records"
    ON healthcare_records FOR SELECT
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view own records"
    ON healthcare_records FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM healthcare_patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can create records"
    ON healthcare_records FOR INSERT
    WITH CHECK (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can update their records"
    ON healthcare_records FOR UPDATE
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to records"
    ON healthcare_records FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- HEALTHCARE_APPOINTMENTS Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Providers can view their appointments"
    ON healthcare_appointments FOR SELECT
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view own appointments"
    ON healthcare_appointments FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM healthcare_patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can create appointments"
    ON healthcare_appointments FOR INSERT
    WITH CHECK (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can update their appointments"
    ON healthcare_appointments FOR UPDATE
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can update own appointments"
    ON healthcare_appointments FOR UPDATE
    USING (
        patient_id IN (
            SELECT id FROM healthcare_patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to appointments"
    ON healthcare_appointments FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- HEALTHCARE_PRESCRIPTIONS Policies
-- -----------------------------------------------------------------------------
CREATE POLICY "Providers can view their prescriptions"
    ON healthcare_prescriptions FOR SELECT
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Patients can view own prescriptions"
    ON healthcare_prescriptions FOR SELECT
    USING (
        patient_id IN (
            SELECT id FROM healthcare_patients WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can create prescriptions"
    ON healthcare_prescriptions FOR INSERT
    WITH CHECK (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Providers can update their prescriptions"
    ON healthcare_prescriptions FOR UPDATE
    USING (
        provider_id IN (
            SELECT id FROM healthcare_providers WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Service role full access to prescriptions"
    ON healthcare_prescriptions FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- -----------------------------------------------------------------------------
-- HEALTHCARE_AUDIT_LOGS Policies (Very Restrictive - HIPAA Requirement)
-- -----------------------------------------------------------------------------
-- Only service role can INSERT audit logs
CREATE POLICY "Service role can insert audit logs"
    ON healthcare_audit_logs FOR INSERT
    WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Providers can view audit logs for their patients only
CREATE POLICY "Providers can view patient audit logs"
    ON healthcare_audit_logs FOR SELECT
    USING (
        patient_id IN (
            SELECT hp.id FROM healthcare_patients hp
            JOIN healthcare_providers prov ON hp.provider_id = prov.id
            WHERE prov.user_id = auth.uid()
        )
        OR user_id = auth.uid()
    );

-- Service role can read all audit logs
CREATE POLICY "Service role can read all audit logs"
    ON healthcare_audit_logs FOR SELECT
    USING (auth.jwt() ->> 'role' = 'service_role');

-- NO UPDATE OR DELETE POLICIES - Audit logs are immutable

-- =============================================================================
-- INDEXES
-- =============================================================================

-- Healthcare Providers indexes
CREATE INDEX IF NOT EXISTS idx_healthcare_providers_user_id ON healthcare_providers(user_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_providers_type ON healthcare_providers(provider_type);
CREATE INDEX IF NOT EXISTS idx_healthcare_providers_active ON healthcare_providers(is_active) WHERE is_active = true;

-- Healthcare Patients indexes
CREATE INDEX IF NOT EXISTS idx_healthcare_patients_user_id ON healthcare_patients(user_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_patients_provider_id ON healthcare_patients(provider_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_patients_active ON healthcare_patients(provider_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_healthcare_patients_created ON healthcare_patients(created_at DESC);

-- Healthcare Records indexes
CREATE INDEX IF NOT EXISTS idx_healthcare_records_patient_id ON healthcare_records(patient_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_records_provider_id ON healthcare_records(provider_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_records_type ON healthcare_records(record_type);
CREATE INDEX IF NOT EXISTS idx_healthcare_records_visit_date ON healthcare_records(visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_healthcare_records_patient_date ON healthcare_records(patient_id, visit_date DESC);
CREATE INDEX IF NOT EXISTS idx_healthcare_records_icd10 ON healthcare_records USING GIN (icd10_codes);
CREATE INDEX IF NOT EXISTS idx_healthcare_records_cpt ON healthcare_records USING GIN (cpt_codes);

-- Healthcare Appointments indexes
CREATE INDEX IF NOT EXISTS idx_healthcare_appointments_patient_id ON healthcare_appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_appointments_provider_id ON healthcare_appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_appointments_scheduled ON healthcare_appointments(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_healthcare_appointments_status ON healthcare_appointments(status);
CREATE INDEX IF NOT EXISTS idx_healthcare_appointments_provider_schedule ON healthcare_appointments(provider_id, scheduled_at)
    WHERE status NOT IN ('cancelled', 'rescheduled');
CREATE INDEX IF NOT EXISTS idx_healthcare_appointments_upcoming ON healthcare_appointments(scheduled_at)
    WHERE status IN ('scheduled', 'confirmed') AND scheduled_at > NOW();

-- Healthcare Prescriptions indexes
CREATE INDEX IF NOT EXISTS idx_healthcare_prescriptions_patient_id ON healthcare_prescriptions(patient_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_prescriptions_provider_id ON healthcare_prescriptions(provider_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_prescriptions_medication ON healthcare_prescriptions(medication_name);
CREATE INDEX IF NOT EXISTS idx_healthcare_prescriptions_active ON healthcare_prescriptions(patient_id, status)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_healthcare_prescriptions_controlled ON healthcare_prescriptions(provider_id, created_at)
    WHERE is_controlled_substance = true;

-- Healthcare Audit Logs indexes (Critical for HIPAA compliance queries)
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_user_id ON healthcare_audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_patient_id ON healthcare_audit_logs(patient_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_action ON healthcare_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_resource ON healthcare_audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_created ON healthcare_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_patient_created ON healthcare_audit_logs(patient_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_emergency ON healthcare_audit_logs(created_at DESC)
    WHERE is_emergency_access = true;
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_details ON healthcare_audit_logs USING GIN (details);

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Function to log healthcare audit events
CREATE OR REPLACE FUNCTION log_healthcare_audit(
    p_user_id UUID,
    p_patient_id UUID,
    p_action TEXT,
    p_resource_type TEXT,
    p_resource_id UUID DEFAULT NULL,
    p_access_reason TEXT DEFAULT 'routine_care',
    p_details JSONB DEFAULT '{}',
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_is_emergency BOOLEAN DEFAULT false,
    p_emergency_reason TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
    v_provider_id UUID;
    v_actor_email TEXT;
    v_actor_name TEXT;
    v_actor_role TEXT;
BEGIN
    -- Get provider info if user is a provider
    SELECT hp.id, u.email, hp.organization_name, 'provider'
    INTO v_provider_id, v_actor_email, v_actor_name, v_actor_role
    FROM healthcare_providers hp
    JOIN auth.users u ON hp.user_id = u.id
    WHERE hp.user_id = p_user_id;

    -- If not a provider, check if patient
    IF v_provider_id IS NULL THEN
        SELECT u.email, 'patient'
        INTO v_actor_email, v_actor_role
        FROM auth.users u
        WHERE u.id = p_user_id;

        IF v_actor_role IS NULL THEN
            v_actor_role := 'system';
        END IF;
    END IF;

    INSERT INTO healthcare_audit_logs (
        user_id, provider_id, actor_email, actor_name, actor_role,
        patient_id, action, resource_type, resource_id,
        access_reason, is_emergency_access, emergency_override_reason,
        ip_address, user_agent, details
    )
    VALUES (
        p_user_id, v_provider_id, v_actor_email, v_actor_name, v_actor_role,
        p_patient_id, p_action, p_resource_type, p_resource_id,
        p_access_reason, p_is_emergency, p_emergency_reason,
        p_ip_address, p_user_agent, p_details
    )
    RETURNING id INTO v_log_id;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check appointment conflicts
CREATE OR REPLACE FUNCTION check_appointment_conflict(
    p_provider_id UUID,
    p_scheduled_at TIMESTAMPTZ,
    p_duration_minutes INTEGER,
    p_exclude_appointment_id UUID DEFAULT NULL
)
RETURNS TABLE (
    has_conflict BOOLEAN,
    conflicting_appointment_id UUID,
    conflicting_start TIMESTAMPTZ,
    conflicting_end TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        true AS has_conflict,
        a.id AS conflicting_appointment_id,
        a.scheduled_at AS conflicting_start,
        a.end_at AS conflicting_end
    FROM healthcare_appointments a
    WHERE a.provider_id = p_provider_id
        AND a.status NOT IN ('cancelled', 'rescheduled')
        AND (p_exclude_appointment_id IS NULL OR a.id != p_exclude_appointment_id)
        AND tstzrange(a.scheduled_at, a.end_at) &&
            tstzrange(p_scheduled_at, p_scheduled_at + (p_duration_minutes || ' minutes')::INTERVAL)
    LIMIT 1;

    -- Return no conflict if nothing found
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::TIMESTAMPTZ, NULL::TIMESTAMPTZ;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get patient activity summary (for audit)
CREATE OR REPLACE FUNCTION get_patient_access_summary(
    p_patient_id UUID,
    p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'total_accesses', COUNT(*),
            'unique_users', COUNT(DISTINCT user_id),
            'by_action', (
                SELECT jsonb_object_agg(action, cnt)
                FROM (
                    SELECT action, COUNT(*) as cnt
                    FROM healthcare_audit_logs
                    WHERE patient_id = p_patient_id
                        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
                    GROUP BY action
                ) sub
            ),
            'emergency_accesses', (
                SELECT COUNT(*) FROM healthcare_audit_logs
                WHERE patient_id = p_patient_id
                    AND is_emergency_access = true
                    AND created_at >= NOW() - (p_days || ' days')::INTERVAL
            ),
            'by_resource_type', (
                SELECT jsonb_object_agg(resource_type, cnt)
                FROM (
                    SELECT resource_type, COUNT(*) as cnt
                    FROM healthcare_audit_logs
                    WHERE patient_id = p_patient_id
                        AND created_at >= NOW() - (p_days || ' days')::INTERVAL
                    GROUP BY resource_type
                ) sub
            )
        )
        FROM healthcare_audit_logs
        WHERE patient_id = p_patient_id
            AND created_at >= NOW() - (p_days || ' days')::INTERVAL
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_healthcare_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_healthcare_providers_timestamp
    BEFORE UPDATE ON healthcare_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_healthcare_timestamp();

CREATE TRIGGER update_healthcare_patients_timestamp
    BEFORE UPDATE ON healthcare_patients
    FOR EACH ROW
    EXECUTE FUNCTION update_healthcare_timestamp();

CREATE TRIGGER update_healthcare_records_timestamp
    BEFORE UPDATE ON healthcare_records
    FOR EACH ROW
    EXECUTE FUNCTION update_healthcare_timestamp();

CREATE TRIGGER update_healthcare_appointments_timestamp
    BEFORE UPDATE ON healthcare_appointments
    FOR EACH ROW
    EXECUTE FUNCTION update_healthcare_timestamp();

CREATE TRIGGER update_healthcare_prescriptions_timestamp
    BEFORE UPDATE ON healthcare_prescriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_healthcare_timestamp();

-- NOTE: No trigger for healthcare_audit_logs - they are immutable

-- =============================================================================
-- TABLE COMMENTS
-- =============================================================================

COMMENT ON TABLE healthcare_providers IS 'Healthcare providers (doctors, clinics, etc.) with HIPAA certification tracking';
COMMENT ON TABLE healthcare_patients IS 'Patient records with encrypted PII - all identifying information is encrypted';
COMMENT ON TABLE healthcare_records IS 'Medical records with encrypted PHI - diagnosis and treatment information encrypted';
COMMENT ON TABLE healthcare_appointments IS 'Appointment scheduling with conflict detection';
COMMENT ON TABLE healthcare_prescriptions IS 'Prescription management with controlled substance tracking';
COMMENT ON TABLE healthcare_audit_logs IS 'HIPAA-compliant immutable audit log - tracks all PHI access';

-- Column comments for encryption fields
COMMENT ON COLUMN healthcare_patients.encrypted_first_name IS 'AES-256-GCM encrypted patient first name';
COMMENT ON COLUMN healthcare_patients.encrypted_last_name IS 'AES-256-GCM encrypted patient last name';
COMMENT ON COLUMN healthcare_patients.encrypted_dob IS 'AES-256-GCM encrypted date of birth';
COMMENT ON COLUMN healthcare_patients.encrypted_ssn IS 'AES-256-GCM encrypted SSN (optional)';
COMMENT ON COLUMN healthcare_records.encrypted_content IS 'AES-256-GCM encrypted medical record content';
COMMENT ON COLUMN healthcare_audit_logs.access_reason IS 'HIPAA-required field documenting why PHI was accessed';
