-- HELIOS Medical Triage System - Booking & Provider Directory
-- Migration: 20260129180001_helios_booking_providers.sql
--
-- This migration creates:
-- - PostGIS extension for geolocation
-- - Provider directory with geospatial search
-- - Appointment booking system
-- - User feedback collection (Doctronic-style)

-- ============================================
-- POSTGIS EXTENSION
-- ============================================
CREATE EXTENSION IF NOT EXISTS postgis;

-- ============================================
-- 1. PROVIDERS - Healthcare Provider Directory
-- ============================================
CREATE TABLE IF NOT EXISTS providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Provider identity
  name VARCHAR(200) NOT NULL,
  specialty VARCHAR(100) NOT NULL,
  credentials VARCHAR(100),  -- e.g., "MD", "DO", "NP", "PA"
  npi_number VARCHAR(10),    -- National Provider Identifier

  -- Facility information
  facility_name VARCHAR(200),
  facility_type VARCHAR(50),  -- 'hospital', 'clinic', 'urgent_care', 'private_practice'

  -- Location details
  address TEXT NOT NULL,
  address_line_2 TEXT,
  city VARCHAR(100) NOT NULL,
  state VARCHAR(50) NOT NULL,
  postal_code VARCHAR(20) NOT NULL,
  country VARCHAR(50) NOT NULL DEFAULT 'US',

  -- PostGIS geography point for geospatial queries
  location geography(POINT, 4326),

  -- Contact
  phone VARCHAR(20),
  email VARCHAR(200),
  website VARCHAR(500),

  -- Video visit capabilities
  video_visit_available BOOLEAN DEFAULT true,
  video_visit_price DECIMAL(10,2),
  video_visit_platform VARCHAR(50),  -- 'zoom', 'doxy', 'custom'

  -- Insurance
  accepts_insurance BOOLEAN DEFAULT true,
  insurance_networks TEXT[] DEFAULT '{}',
  accepts_medicare BOOLEAN DEFAULT false,
  accepts_medicaid BOOLEAN DEFAULT false,

  -- Scheduling info
  average_wait_minutes INTEGER,
  next_available_slot TIMESTAMPTZ,
  accepts_same_day BOOLEAN DEFAULT false,
  accepts_walk_ins BOOLEAN DEFAULT false,

  -- Quality metrics
  rating DECIMAL(2,1)
    CONSTRAINT valid_rating CHECK (rating IS NULL OR (rating >= 1.0 AND rating <= 5.0)),
  review_count INTEGER DEFAULT 0,
  years_experience INTEGER,

  -- Languages spoken
  languages TEXT[] DEFAULT ARRAY['en'],

  -- Status
  is_active BOOLEAN DEFAULT true,
  verified BOOLEAN DEFAULT false,
  verified_at TIMESTAMPTZ,

  -- Operating hours (JSONB for flexibility)
  -- Format: {"monday": {"open": "09:00", "close": "17:00"}, "tuesday": {...}, ...}
  operating_hours JSONB DEFAULT '{}'::jsonb,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update trigger for providers
CREATE OR REPLACE FUNCTION update_providers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS providers_updated_at ON providers;
CREATE TRIGGER providers_updated_at
  BEFORE UPDATE ON providers
  FOR EACH ROW
  EXECUTE FUNCTION update_providers_updated_at();

-- ============================================
-- 2. APPOINTMENTS - Booking Records
-- ============================================
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkages
  session_id UUID REFERENCES triage_sessions(id) ON DELETE SET NULL,
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Appointment details
  appointment_type VARCHAR(20) NOT NULL
    CONSTRAINT valid_appointment_type CHECK (appointment_type IN ('video', 'in_person', 'phone')),

  -- Scheduling
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER DEFAULT 30,
  timezone VARCHAR(50) DEFAULT 'America/New_York',

  -- Status workflow
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CONSTRAINT valid_status CHECK (status IN (
      'pending',      -- Just created, awaiting confirmation
      'confirmed',    -- Provider confirmed
      'reminded',     -- Reminder sent
      'checked_in',   -- Patient checked in
      'in_progress',  -- Appointment ongoing
      'completed',    -- Successfully completed
      'cancelled',    -- Cancelled by patient or provider
      'no_show'       -- Patient did not attend
    )),

  -- Cancellation details
  cancelled_at TIMESTAMPTZ,
  cancelled_by VARCHAR(20),  -- 'patient', 'provider', 'system'
  cancellation_reason TEXT,

  -- Clinical context
  chief_complaint TEXT,
  triage_summary TEXT,
  include_soap_note BOOLEAN DEFAULT false,
  soap_note_id UUID REFERENCES soap_notes(id) ON DELETE SET NULL,

  -- Video visit details
  video_room_url TEXT,
  video_room_id VARCHAR(100),

  -- Payment
  payment_status VARCHAR(20) DEFAULT 'pending'
    CONSTRAINT valid_payment CHECK (payment_status IN ('pending', 'paid', 'refunded', 'waived')),
  payment_amount DECIMAL(10,2),
  payment_method VARCHAR(50),

  -- Notes
  patient_notes TEXT,
  provider_notes TEXT,

  -- Reminders
  reminder_sent_at TIMESTAMPTZ,
  reminder_method VARCHAR(20),  -- 'sms', 'email', 'push'

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update trigger for appointments
CREATE OR REPLACE FUNCTION update_appointments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS appointments_updated_at ON appointments;
CREATE TRIGGER appointments_updated_at
  BEFORE UPDATE ON appointments
  FOR EACH ROW
  EXECUTE FUNCTION update_appointments_updated_at();

-- ============================================
-- 3. USER FEEDBACK - Doctronic-style Ratings
-- ============================================
CREATE TABLE IF NOT EXISTS user_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Linkages
  session_id UUID NOT NULL REFERENCES triage_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Feedback type (what are they rating?)
  feedback_type VARCHAR(30) NOT NULL DEFAULT 'overall'
    CONSTRAINT valid_feedback_type CHECK (feedback_type IN (
      'overall',           -- Overall experience
      'diagnosis',         -- Accuracy of assessment
      'communication',     -- Clarity of AI responses
      'recommendation',    -- Usefulness of recommendations
      'booking'            -- Booking experience
    )),

  -- Simple rating (Doctronic-style buttons)
  rating VARCHAR(20) NOT NULL
    CONSTRAINT valid_rating CHECK (rating IN ('not_helpful', 'so_so', 'helpful')),

  -- Numeric score (derived from rating for analytics)
  score INTEGER GENERATED ALWAYS AS (
    CASE rating
      WHEN 'not_helpful' THEN 1
      WHEN 'so_so' THEN 3
      WHEN 'helpful' THEN 5
    END
  ) STORED,

  -- Optional detailed feedback
  feedback_text TEXT,

  -- Specific issues (checkboxes)
  issues TEXT[] DEFAULT '{}',
  -- Possible values: 'inaccurate', 'confusing', 'too_slow', 'missing_info', 'other'

  -- Context at time of feedback
  phase_at_feedback VARCHAR(30),
  message_count_at_feedback INTEGER,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One feedback per session per type
  CONSTRAINT unique_session_feedback_type UNIQUE (session_id, feedback_type)
);

-- ============================================
-- 4. PROVIDER AVAILABILITY SLOTS (Optional)
-- ============================================
CREATE TABLE IF NOT EXISTS provider_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_id UUID NOT NULL REFERENCES providers(id) ON DELETE CASCADE,

  -- Slot details
  slot_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_type VARCHAR(20) DEFAULT 'available'
    CONSTRAINT valid_slot_type CHECK (slot_type IN ('available', 'booked', 'blocked', 'break')),

  -- Appointment type this slot supports
  supports_video BOOLEAN DEFAULT true,
  supports_in_person BOOLEAN DEFAULT true,

  -- Booking reference
  appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,

  -- Recurrence (for recurring availability patterns)
  is_recurring BOOLEAN DEFAULT false,
  recurrence_pattern VARCHAR(20),  -- 'daily', 'weekly', 'monthly'
  recurrence_end_date DATE,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Unique constraint for non-overlapping slots
  CONSTRAINT unique_provider_slot UNIQUE (provider_id, slot_date, start_time)
);

-- ============================================
-- INDEXES
-- ============================================

-- Provider geospatial index (critical for location-based search)
CREATE INDEX IF NOT EXISTS idx_providers_location
  ON providers USING GIST(location);

-- Provider search indexes
CREATE INDEX IF NOT EXISTS idx_providers_specialty
  ON providers(specialty)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_providers_city_state
  ON providers(city, state)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_providers_video_available
  ON providers(video_visit_available)
  WHERE is_active = true AND video_visit_available = true;

CREATE INDEX IF NOT EXISTS idx_providers_rating
  ON providers(rating DESC NULLS LAST)
  WHERE is_active = true;

-- Appointment indexes
CREATE INDEX IF NOT EXISTS idx_appointments_patient
  ON appointments(patient_id, scheduled_at DESC);

CREATE INDEX IF NOT EXISTS idx_appointments_provider
  ON appointments(provider_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_appointments_session
  ON appointments(session_id)
  WHERE session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_appointments_status
  ON appointments(status, scheduled_at)
  WHERE status NOT IN ('completed', 'cancelled', 'no_show');

CREATE INDEX IF NOT EXISTS idx_appointments_upcoming
  ON appointments(scheduled_at)
  WHERE status IN ('pending', 'confirmed', 'reminded');

-- Feedback indexes
CREATE INDEX IF NOT EXISTS idx_feedback_session
  ON user_feedback(session_id);

CREATE INDEX IF NOT EXISTS idx_feedback_rating
  ON user_feedback(rating, created_at DESC);

-- Availability indexes
CREATE INDEX IF NOT EXISTS idx_availability_provider_date
  ON provider_availability(provider_id, slot_date, start_time);

CREATE INDEX IF NOT EXISTS idx_availability_available_slots
  ON provider_availability(slot_date, start_time)
  WHERE slot_type = 'available';

-- ============================================
-- GEOSPATIAL SEARCH FUNCTION
-- ============================================

-- Find nearby providers with optional filters
CREATE OR REPLACE FUNCTION find_nearby_providers(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  radius_miles INTEGER DEFAULT 25,
  specialty_filter VARCHAR DEFAULT NULL,
  video_only BOOLEAN DEFAULT false,
  min_rating DECIMAL DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  specialty VARCHAR,
  credentials VARCHAR,
  facility_name VARCHAR,
  address TEXT,
  city VARCHAR,
  state VARCHAR,
  distance_miles DOUBLE PRECISION,
  video_visit_available BOOLEAN,
  video_visit_price DECIMAL,
  rating DECIMAL,
  review_count INTEGER,
  next_available_slot TIMESTAMPTZ,
  accepts_same_day BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.specialty,
    p.credentials,
    p.facility_name,
    p.address,
    p.city,
    p.state,
    ROUND(
      (ST_Distance(
        p.location::geography,
        ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography
      ) / 1609.34)::NUMERIC,
      1
    )::DOUBLE PRECISION AS distance_miles,
    p.video_visit_available,
    p.video_visit_price,
    p.rating,
    p.review_count,
    p.next_available_slot,
    p.accepts_same_day
  FROM providers p
  WHERE p.is_active = true
    AND p.location IS NOT NULL
    -- Specialty filter
    AND (specialty_filter IS NULL OR LOWER(p.specialty) = LOWER(specialty_filter))
    -- Video only filter
    AND (video_only = false OR p.video_visit_available = true)
    -- Minimum rating filter
    AND (min_rating IS NULL OR p.rating >= min_rating)
    -- Distance filter (convert miles to meters: 1 mile = 1609.34 meters)
    AND ST_DWithin(
      p.location::geography,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      radius_miles * 1609.34
    )
  ORDER BY distance_miles ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Find providers by specialty without location (for video visits)
CREATE OR REPLACE FUNCTION find_video_providers(
  specialty_filter VARCHAR DEFAULT NULL,
  min_rating DECIMAL DEFAULT NULL,
  max_price DECIMAL DEFAULT NULL,
  limit_count INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  name VARCHAR,
  specialty VARCHAR,
  credentials VARCHAR,
  video_visit_price DECIMAL,
  rating DECIMAL,
  review_count INTEGER,
  next_available_slot TIMESTAMPTZ,
  languages TEXT[]
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.name,
    p.specialty,
    p.credentials,
    p.video_visit_price,
    p.rating,
    p.review_count,
    p.next_available_slot,
    p.languages
  FROM providers p
  WHERE p.is_active = true
    AND p.video_visit_available = true
    AND (specialty_filter IS NULL OR LOWER(p.specialty) = LOWER(specialty_filter))
    AND (min_rating IS NULL OR p.rating >= min_rating)
    AND (max_price IS NULL OR p.video_visit_price <= max_price)
  ORDER BY
    CASE WHEN p.next_available_slot IS NOT NULL THEN 0 ELSE 1 END,
    p.next_available_slot ASC NULLS LAST,
    p.rating DESC NULLS LAST
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Check provider availability for a specific date
CREATE OR REPLACE FUNCTION get_provider_availability(
  p_provider_id UUID,
  p_date DATE,
  p_appointment_type VARCHAR DEFAULT 'video'
)
RETURNS TABLE (
  slot_time TIME,
  is_available BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    pa.start_time AS slot_time,
    (pa.slot_type = 'available') AS is_available
  FROM provider_availability pa
  WHERE pa.provider_id = p_provider_id
    AND pa.slot_date = p_date
    AND (
      (p_appointment_type = 'video' AND pa.supports_video = true)
      OR (p_appointment_type = 'in_person' AND pa.supports_in_person = true)
      OR (p_appointment_type = 'phone' AND pa.supports_video = true)
    )
  ORDER BY pa.start_time;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
ALTER TABLE providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_availability ENABLE ROW LEVEL SECURITY;

-- Providers: Public read for active providers, admin write
CREATE POLICY providers_read_policy ON providers
  FOR SELECT
  USING (is_active = true OR auth.role() = 'service_role');

CREATE POLICY providers_write_policy ON providers
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Appointments: Users can only access their own appointments
CREATE POLICY appointments_user_policy ON appointments
  FOR SELECT
  USING (
    patient_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY appointments_insert_policy ON appointments
  FOR INSERT
  WITH CHECK (
    patient_id = auth.uid()
    OR patient_id IS NULL  -- Allow anonymous bookings initially
    OR auth.role() = 'service_role'
  );

CREATE POLICY appointments_update_policy ON appointments
  FOR UPDATE
  USING (
    patient_id = auth.uid()
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    patient_id = auth.uid()
    OR auth.role() = 'service_role'
  );

CREATE POLICY appointments_delete_policy ON appointments
  FOR DELETE
  USING (auth.role() = 'service_role');

-- User feedback: Users can only access their own feedback
CREATE POLICY feedback_user_policy ON user_feedback
  FOR ALL
  USING (
    user_id = auth.uid()
    OR user_id IS NULL  -- Anonymous feedback allowed
    OR auth.role() = 'service_role'
  )
  WITH CHECK (
    user_id = auth.uid()
    OR user_id IS NULL
    OR auth.role() = 'service_role'
  );

-- Provider availability: Public read, service role write
CREATE POLICY availability_read_policy ON provider_availability
  FOR SELECT
  USING (true);

CREATE POLICY availability_write_policy ON provider_availability
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- SAMPLE DATA FUNCTION (for testing)
-- ============================================
CREATE OR REPLACE FUNCTION seed_sample_providers()
RETURNS void AS $$
BEGIN
  -- Only insert if table is empty
  IF (SELECT COUNT(*) FROM providers) = 0 THEN
    INSERT INTO providers (
      name, specialty, credentials, facility_name, facility_type,
      address, city, state, postal_code, country,
      location, phone,
      video_visit_available, video_visit_price,
      accepts_insurance, insurance_networks,
      rating, review_count, years_experience,
      languages, is_active, verified
    ) VALUES
    (
      'Dr. Sarah Chen', 'Internal Medicine', 'MD', 'CityHealth Medical Group', 'clinic',
      '123 Health Ave', 'San Francisco', 'CA', '94102', 'US',
      ST_SetSRID(ST_MakePoint(-122.4194, 37.7749), 4326)::geography,
      '(415) 555-0100',
      true, 75.00,
      true, ARRAY['Aetna', 'Blue Cross', 'United'],
      4.8, 127, 12,
      ARRAY['en', 'zh'], true, true
    ),
    (
      'Dr. Michael Rodriguez', 'Family Medicine', 'MD', 'Bay Area Family Care', 'private_practice',
      '456 Wellness Blvd', 'Oakland', 'CA', '94612', 'US',
      ST_SetSRID(ST_MakePoint(-122.2711, 37.8044), 4326)::geography,
      '(510) 555-0200',
      true, 65.00,
      true, ARRAY['Kaiser', 'Blue Shield', 'Cigna'],
      4.6, 89, 8,
      ARRAY['en', 'es'], true, true
    ),
    (
      'Dr. Emily Thompson', 'Urgent Care', 'DO', 'QuickCare Urgent Center', 'urgent_care',
      '789 Express Lane', 'San Jose', 'CA', '95112', 'US',
      ST_SetSRID(ST_MakePoint(-121.8863, 37.3382), 4326)::geography,
      '(408) 555-0300',
      true, 85.00,
      true, ARRAY['Most major insurances accepted'],
      4.4, 203, 6,
      ARRAY['en'], true, true
    ),
    (
      'Dr. James Park', 'Cardiology', 'MD, FACC', 'Heart Health Specialists', 'clinic',
      '321 Cardio Center Dr', 'Palo Alto', 'CA', '94301', 'US',
      ST_SetSRID(ST_MakePoint(-122.1430, 37.4419), 4326)::geography,
      '(650) 555-0400',
      true, 150.00,
      true, ARRAY['Aetna', 'Blue Cross', 'United', 'Cigna'],
      4.9, 156, 18,
      ARRAY['en', 'ko'], true, true
    ),
    (
      'Dr. Lisa Williams', 'Dermatology', 'MD', 'SkinCare Dermatology', 'private_practice',
      '555 Skin Health Rd', 'Berkeley', 'CA', '94704', 'US',
      ST_SetSRID(ST_MakePoint(-122.2585, 37.8716), 4326)::geography,
      '(510) 555-0500',
      true, 95.00,
      true, ARRAY['Blue Cross', 'Aetna', 'UnitedHealth'],
      4.7, 112, 10,
      ARRAY['en'], true, true
    );
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- COMMENTS
-- ============================================

COMMENT ON TABLE providers IS 'Healthcare provider directory with PostGIS geolocation for proximity search';
COMMENT ON TABLE appointments IS 'Patient appointment bookings linked to triage sessions and providers';
COMMENT ON TABLE user_feedback IS 'Doctronic-style user feedback with simple helpful/so-so/not-helpful ratings';
COMMENT ON TABLE provider_availability IS 'Provider scheduling slots for availability management';

COMMENT ON FUNCTION find_nearby_providers IS 'Find providers within radius miles of a location with optional filters';
COMMENT ON FUNCTION find_video_providers IS 'Find video-visit providers filtered by specialty, rating, and price';
COMMENT ON FUNCTION get_provider_availability IS 'Get available time slots for a provider on a specific date';
COMMENT ON FUNCTION seed_sample_providers IS 'Insert sample provider data for testing (only if table is empty)';
