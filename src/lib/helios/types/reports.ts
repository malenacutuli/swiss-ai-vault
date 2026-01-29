/**
 * HELIOS Report Types
 */

export interface SOAPNote {
  generatedAt: string;
  patientInfo: {
    age: number;
    sex: string;
    chiefComplaint: string;
  };
  subjective: {
    historyOfPresentIllness: string;
    associatedSymptoms: string[];
    negativeSymptoms: string[];
    pastMedicalHistory: string[];
    medications: Array<{
      name: string;
      dose?: string;
      frequency?: string;
      reason?: string;
    }>;
    allergies: string[];
    socialHistory?: string;
    familyHistory?: string;
  };
  objective: {
    selfReportedFindings: string[];
    vitalSigns?: {
      bloodPressure?: string;
      heartRate?: string;
      temperature?: string;
      respiratoryRate?: string;
      oxygenSaturation?: string;
    };
    generalAppearance?: string;
    physicalExamFindings?: string[];
  };
  assessment: {
    clinicalImpression: string;
    differentialDiagnosis: Array<{
      condition: string;
      likelihood: 'most_likely' | 'likely' | 'possible' | 'less_likely';
      reasoning: string;
      icdCode?: string;
    }>;
    redFlags: string[];
    riskStratification?: string;
  };
  plan: {
    laboratoryTests: Array<{
      test: string;
      rationale: string;
    }>;
    imagingStudies: Array<{
      study: string;
      rationale: string;
    }>;
    diagnosticProcedures: Array<{
      procedure: string;
      indication: string;
    }>;
    management: string[];
    patientEducation: string[];
    followUp: string;
    referrals?: string[];
    urgency: 'emergent' | 'urgent' | 'semi_urgent' | 'routine';
  };
  disclaimer: string;
}

export interface ConsultReport {
  id: string;
  sessionId: string;
  type: 'summary' | 'soap' | 'assessment' | 'differential';
  generatedAt: string;
  content: SOAPNote | string;
  shareToken?: string;
  shareExpiresAt?: string;
}
