// ============================================
// HEALTHCARE TYPES FOR SWISSBRAIN.AI
// HIPAA-compliant healthcare module types
// ============================================

// ============================================
// PROVIDER TYPES
// ============================================

export type ProviderType =
  | 'physician'
  | 'nurse'
  | 'clinic'
  | 'hospital'
  | 'pharmacy'
  | 'lab'
  | 'specialist'
  | 'therapist'
  | 'other';

export interface HealthcareProvider {
  id: string;
  user_id: string;
  provider_type: ProviderType;
  license_number: string | null;
  npi_number: string | null;
  organization_name: string | null;
  organization_type: string | null;
  specializations: string[];
  contact_email?: string;
  contact_phone?: string;
  address?: string;
  hipaa_certified_at: string | null;
  certification_expires_at: string | null;
  is_active: boolean;
  is_verified: boolean;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProviderInput {
  provider_type: ProviderType;
  license_number?: string;
  npi_number?: string;
  organization_name?: string;
  specializations?: string[];
}

// ============================================
// PATIENT TYPES
// ============================================

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type Gender = 'male' | 'female' | 'other' | 'prefer_not_to_say';

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface InsuranceInfo {
  provider: string;
  policy_number: string;
  group_number: string;
}

export interface HealthcarePatient {
  id: string;
  user_id: string | null;
  provider_id: string;
  first_name: string;
  last_name: string;
  dob: string;
  ssn: string | null;
  mrn: string | null;
  blood_type: BloodType | null;
  allergies: string[];
  current_medications: string[];
  medical_conditions: string[];
  email: string | null;
  phone: string | null;
  address: string | null;
  emergency_contact: EmergencyContact | null;
  insurance_info: InsuranceInfo | null;
  gender: Gender | null;
  preferred_language: string;
  consent_signed_at: string | null;
  hipaa_authorization_signed_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PatientListItem {
  id: string;
  first_name: string;
  last_name: string;
  blood_type: BloodType | null;
  gender: Gender | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePatientInput {
  first_name: string;
  last_name: string;
  dob: string;
  ssn?: string;
  mrn?: string;
  blood_type?: BloodType;
  allergies?: string[];
  current_medications?: string[];
  medical_conditions?: string[];
  email?: string;
  phone?: string;
  address?: string;
  emergency_contact?: EmergencyContact;
  insurance_info?: InsuranceInfo;
  gender?: Gender;
  preferred_language?: string;
}

export interface UpdatePatientInput extends Partial<CreatePatientInput> {}

// ============================================
// MEDICAL RECORD TYPES
// ============================================

export type RecordType =
  | 'visit_note'
  | 'lab_result'
  | 'imaging'
  | 'prescription'
  | 'referral'
  | 'discharge_summary'
  | 'progress_note'
  | 'consultation'
  | 'procedure'
  | 'immunization'
  | 'vital_signs'
  | 'allergy_update'
  | 'diagnosis'
  | 'other';

export type RecordStatus = 'draft' | 'final' | 'amended' | 'deleted';
export type VisitType = 'in_person' | 'telehealth' | 'phone' | 'async';

export interface VitalSigns {
  blood_pressure_systolic?: number;
  blood_pressure_diastolic?: number;
  heart_rate?: number;
  respiratory_rate?: number;
  temperature?: number;
  temperature_unit?: 'F' | 'C';
  oxygen_saturation?: number;
  weight?: number;
  weight_unit?: 'lb' | 'kg';
  height?: number;
  height_unit?: 'in' | 'cm';
  bmi?: number;
}

export interface HealthcareRecord {
  id: string;
  patient_id: string;
  provider_id: string;
  record_type: RecordType;
  content: string;
  diagnosis: string | null;
  notes: string | null;
  treatment_plan: string | null;
  icd10_codes: string[];
  cpt_codes: string[];
  loinc_codes: string[];
  snomed_codes: string[];
  visit_date: string;
  visit_type: VisitType | null;
  duration_minutes: number | null;
  vital_signs: VitalSigns | null;
  attachment_ids: string[];
  status: RecordStatus;
  amended_from_id: string | null;
  signed_by: string | null;
  signed_at: string | null;
  co_signed_by: string | null;
  co_signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecordListItem {
  id: string;
  patient_id: string;
  provider_id: string;
  record_type: RecordType;
  visit_date: string;
  visit_type: VisitType | null;
  status: RecordStatus;
  icd10_codes: string[];
  created_at: string;
}

export interface CreateRecordInput {
  patient_id: string;
  record_type: RecordType;
  content: string;
  diagnosis?: string;
  notes?: string;
  treatment_plan?: string;
  icd10_codes?: string[];
  cpt_codes?: string[];
  loinc_codes?: string[];
  snomed_codes?: string[];
  visit_date: string;
  visit_type?: VisitType;
  duration_minutes?: number;
  vital_signs?: VitalSigns;
  attachment_ids?: string[];
}

export interface UpdateRecordInput extends Partial<Omit<CreateRecordInput, 'patient_id'>> {}

// ============================================
// APPOINTMENT TYPES
// ============================================

export type AppointmentType =
  | 'initial_consultation'
  | 'follow_up'
  | 'routine_checkup'
  | 'urgent'
  | 'procedure'
  | 'lab_work'
  | 'imaging'
  | 'telehealth'
  | 'phone'
  | 'other';

export type AppointmentStatus =
  | 'scheduled'
  | 'confirmed'
  | 'checked_in'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled';

export interface HealthcareAppointment {
  id: string;
  patient_id: string;
  provider_id: string;
  appointment_type: AppointmentType;
  reason_for_visit: string | null;
  notes: string | null;
  scheduled_at: string;
  duration_minutes: number;
  end_at: string;
  timezone: string;
  status: AppointmentStatus;
  cancelled_at: string | null;
  cancelled_by: string | null;
  cancellation_reason: string | null;
  is_telehealth: boolean;
  telehealth_url: string | null;
  telehealth_provider: string | null;
  reminder_sent_at: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
  checked_in_at: string | null;
  created_record_id: string | null;
  recurrence_rule: string | null;
  recurrence_parent_id: string | null;
  patient_name?: string;
  created_at: string;
  updated_at: string;
}

export interface AppointmentListItem {
  id: string;
  patient_id: string;
  appointment_type: AppointmentType;
  reason_for_visit: string | null;
  scheduled_at: string;
  duration_minutes: number;
  end_at: string;
  status: AppointmentStatus;
  is_telehealth: boolean;
  telehealth_url: string | null;
  checked_in_at: string | null;
  patient_name?: string;
}

export interface CreateAppointmentInput {
  patient_id: string;
  appointment_type: AppointmentType;
  reason_for_visit?: string;
  notes?: string;
  scheduled_at: string;
  duration_minutes?: number;
  timezone?: string;
  is_telehealth?: boolean;
  telehealth_provider?: string;
  recurrence_rule?: string;
}

export interface UpdateAppointmentInput extends Partial<Omit<CreateAppointmentInput, 'patient_id'>> {}

export interface AppointmentConflict {
  id: string;
  start: string;
  end: string;
}

// ============================================
// PRESCRIPTION TYPES
// ============================================

export type PrescriptionStatus = 'active' | 'completed' | 'discontinued' | 'on_hold' | 'cancelled';
export type DEASchedule = 'I' | 'II' | 'III' | 'IV' | 'V';

export interface Pharmacy {
  name: string;
  address: string;
  phone: string;
}

export interface HealthcarePrescription {
  id: string;
  patient_id: string;
  provider_id: string;
  record_id: string | null;
  medication_name: string;
  medication_code: string | null;
  dosage: string;
  dosage_form: string | null;
  frequency: string;
  route: string;
  start_date: string;
  end_date: string | null;
  duration_days: number | null;
  is_ongoing: boolean;
  quantity: number | null;
  quantity_unit: string | null;
  refills_authorized: number;
  refills_remaining: number;
  pharmacy: Pharmacy | null;
  instructions: string | null;
  provider_notes: string | null;
  is_controlled_substance: boolean;
  dea_schedule: DEASchedule | null;
  status: PrescriptionStatus;
  discontinued_at: string | null;
  discontinued_by: string | null;
  discontinue_reason: string | null;
  e_prescribed: boolean;
  e_prescribe_sent_at: string | null;
  e_prescribe_status: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrescriptionListItem {
  id: string;
  patient_id: string;
  record_id: string | null;
  medication_name: string;
  medication_code: string | null;
  dosage: string;
  frequency: string;
  route: string;
  start_date: string;
  end_date: string | null;
  status: PrescriptionStatus;
  refills_remaining: number;
  is_controlled_substance: boolean;
  dea_schedule: DEASchedule | null;
  created_at: string;
  updated_at: string;
}

export interface CreatePrescriptionInput {
  patient_id: string;
  record_id?: string;
  medication_name: string;
  medication_code?: string;
  dosage: string;
  dosage_form?: string;
  frequency: string;
  route?: string;
  start_date: string;
  end_date?: string;
  duration_days?: number;
  is_ongoing?: boolean;
  quantity?: number;
  quantity_unit?: string;
  refills_authorized?: number;
  pharmacy?: Pharmacy;
  instructions?: string;
  provider_notes?: string;
  is_controlled_substance?: boolean;
  dea_schedule?: DEASchedule;
}

export interface UpdatePrescriptionInput extends Partial<Omit<CreatePrescriptionInput, 'patient_id' | 'medication_name'>> {}

// ============================================
// AUDIT LOG TYPES
// ============================================

export type AuditAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'export'
  | 'print'
  | 'access_denied'
  | 'login'
  | 'logout'
  | 'share'
  | 'fax'
  | 'email'
  | 'consent_signed'
  | 'consent_revoked'
  | 'emergency_access';

export type AuditResourceType =
  | 'patient'
  | 'record'
  | 'prescription'
  | 'appointment'
  | 'provider'
  | 'document'
  | 'report'
  | 'audit_log'
  | 'system';

export type AuditStatus = 'success' | 'failure' | 'blocked';

export interface HealthcareAuditLog {
  id: string;
  user_id: string | null;
  provider_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  patient_id: string | null;
  action: AuditAction;
  resource_type: AuditResourceType;
  resource_id: string | null;
  resource_description: string | null;
  access_reason: string;
  is_emergency_access: boolean;
  emergency_override_reason: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
  session_id: string | null;
  geo_country: string | null;
  geo_region: string | null;
  details: Record<string, unknown>;
  status: AuditStatus;
  error_message: string | null;
  created_at: string;
}

export interface AuditSearchParams {
  patient_id?: string;
  action?: AuditAction;
  resource_type?: AuditResourceType;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface AuditSummary {
  total_accesses: number;
  by_action: Record<string, number>;
  by_resource_type: Record<string, number>;
  emergency_accesses: number;
  unique_patients_accessed?: number;
}

export interface PatientAccessSummary {
  total_accesses: number;
  unique_users: number;
  by_action: Record<string, number>;
  emergency_accesses: number;
  by_resource_type: Record<string, number>;
}

// ============================================
// API RESPONSE TYPES
// ============================================

export interface HealthcareApiResponse<T> {
  success?: boolean;
  error?: string;
  data?: T;
}

export interface PatientListResponse {
  patients: PatientListItem[];
}

export interface PatientResponse {
  patient: HealthcarePatient;
}

export interface RecordListResponse {
  records: RecordListItem[];
}

export interface RecordResponse {
  record: HealthcareRecord;
}

export interface AppointmentListResponse {
  appointments: AppointmentListItem[];
}

export interface AppointmentResponse {
  appointment: HealthcareAppointment;
}

export interface PrescriptionListResponse {
  prescriptions: PrescriptionListItem[];
}

export interface PrescriptionResponse {
  prescription: HealthcarePrescription;
}

export interface AuditLogListResponse {
  logs: HealthcareAuditLog[];
  total: number;
}

export interface CreateResponse {
  success: boolean;
  message: string;
  patient_id?: string;
  record_id?: string;
  appointment_id?: string;
  prescription_id?: string;
}

export interface ConflictResponse {
  error: string;
  conflicting_appointment: AppointmentConflict;
}
