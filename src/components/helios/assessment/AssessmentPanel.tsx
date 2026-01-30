/**
 * Assessment Panel Component
 * Displays Grand Rounds consensus results with doctor recommendation,
 * differential diagnosis, and SOAP note sections.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronDown,
  ChevronUp,
  ThumbsDown,
  Meh,
  ThumbsUp,
  FileText,
  Download,
  Video,
  CheckCircle,
  AlertTriangle,
  Clock,
  Stethoscope,
  Users,
  RotateCcw,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { SupportedLanguage } from '@/lib/helios/types';

// ============================================
// TYPES
// ============================================

export interface ICD10Code {
  code: string;
  name: string;
  confidence?: number;
  validated?: boolean;
}

export interface DifferentialDiagnosis {
  rank: number;
  diagnosis: string;
  icd10: ICD10Code;
  confidence: number;
  reasoning: string;
  supportingEvidence?: string[];
  refutingEvidence?: string[];
  mustNotMiss?: boolean;
  urgency?: 'emergent' | 'urgent' | 'routine';
}

export interface PlanOfAction {
  labTests: string[];
  imaging: string[];
  referrals: string[];
  medications?: string[];
  patientEducation?: string[];
  followUp?: string;
  redFlagWarnings?: string[];
}

export interface ConsensusResult {
  kendallW: number;
  consensusReached: boolean;
  roundsRequired: number;
  participatingAgents: string[];
  primaryDiagnosis: DifferentialDiagnosis;
  differentialDiagnosis: DifferentialDiagnosis[];
  planOfAction: PlanOfAction;
  dissentingOpinions?: unknown[];
  finalEsiLevel?: 1 | 2 | 3 | 4 | 5;
  humanReviewRequired: boolean;
  humanReviewReason?: string;
  disposition?: string;
  createdAt: string;
}

export interface SOAPSubjective {
  demographics: {
    age?: number;
    gender?: 'male' | 'female' | 'other';
    preferredLanguage?: SupportedLanguage;
  };
  chiefComplaint: string;
  hpi: string;
  medications: string[];
  allergies: Array<{ allergen: string; reaction: string; severity?: string }>;
  socialHistory?: string;
  familyHistory?: string;
  pastMedicalHistory?: string[];
  pastSurgicalHistory?: string[];
}

export interface SOAPObjective {
  vitalSigns?: {
    temperature?: number;
    heartRate?: number;
    respiratoryRate?: number;
    bloodPressure?: string;
    spO2?: number;
  };
  selfReportedFindings: string[];
  generalAppearance?: string;
  physicalExamNotes?: string;
}

export interface SOAPAssessment {
  summaryStatement: string;
  problemList: string[];
  differentialDiagnosis: DifferentialDiagnosis[];
  clinicalReasoning: string;
  esiLevel?: 1 | 2 | 3 | 4 | 5;
  esiReasoning?: string;
}

export interface SOAPPlan {
  diagnostics: string[];
  treatments: string[];
  referrals: string[];
  patientEducation: string;
  followUp: string;
  redFlagWarnings?: string[];
  lifestyleModifications?: string[];
}

export interface SOAPNote {
  subjective: SOAPSubjective;
  objective: SOAPObjective;
  assessment: SOAPAssessment;
  plan: SOAPPlan;
  pdfUrl?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export type FeedbackRating = 'not_helpful' | 'so_so' | 'helpful';

// OrchestrationResponse from helios-orchestrator service
export interface OrchestrationResponse {
  session_id: string;
  consensus: {
    kendall_w: number;
    consensus_reached: boolean;
    rounds_required: number;
    participating_agents: string[];
    primary_diagnosis: {
      diagnosis: string;
      icd10_code: string;
      icd10_name: string;
      confidence: number;
      reasoning: string;
    };
    differential_diagnoses: Array<{
      rank: number;
      diagnosis: string;
      icd10_code: string;
      icd10_name: string;
      confidence: number;
      reasoning: string;
    }>;
    dissenting_opinions?: Array<{
      agent_id: string;
      diagnosis: string;
      reasoning: string;
    }>;
  };
  triage: {
    esi_level: 1 | 2 | 3 | 4 | 5;
    disposition: string;
    reasoning: string;
    human_review_required: boolean;
    human_review_reason?: string;
  };
  plan: {
    lab_tests: string[];
    imaging: string[];
    referrals: string[];
    medications: string[];
    patient_education: string[];
    follow_up: string;
    red_flag_warnings: string[];
  };
  safety: {
    critical_finding: boolean;
    immediate_action?: string;
    red_flags: Array<{
      category: string;
      description: string;
      severity: 'low' | 'moderate' | 'high' | 'critical';
    }>;
  };
  soap_note: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  };
  processing_time_ms: number;
}

export interface AssessmentPanelProps {
  // Support both legacy ConsensusResult and new OrchestrationResponse
  consensus?: ConsensusResult;
  orchestration?: OrchestrationResponse;
  soapNote?: SOAPNote;
  // Simple SOAP note string (from orchestrator)
  soapNoteText?: string;
  onFeedback: (rating: FeedbackRating) => void;
  onBookDoctor: () => void;
  onDownloadPDF?: () => void;
  language?: SupportedLanguage;
  className?: string;
}

// ============================================
// ESI LEVEL CONFIGURATION
// ============================================

const ESI_CONFIG: Record<
  1 | 2 | 3 | 4 | 5,
  {
    color: string;
    bgColor: string;
    borderColor: string;
    label: string;
    urgency: string;
  }
> = {
  1: {
    color: 'text-white',
    bgColor: 'bg-red-600',
    borderColor: 'border-red-600',
    label: 'Immediate',
    urgency: 'Life-threatening',
  },
  2: {
    color: 'text-white',
    bgColor: 'bg-orange-500',
    borderColor: 'border-orange-500',
    label: 'Emergent',
    urgency: 'High risk',
  },
  3: {
    color: 'text-white',
    bgColor: 'bg-yellow-500',
    borderColor: 'border-yellow-500',
    label: 'Urgent',
    urgency: 'Needs evaluation',
  },
  4: {
    color: 'text-gray-800',
    bgColor: 'bg-green-400',
    borderColor: 'border-green-400',
    label: 'Less Urgent',
    urgency: 'Stable',
  },
  5: {
    color: 'text-gray-800',
    bgColor: 'bg-blue-300',
    borderColor: 'border-blue-300',
    label: 'Non-Urgent',
    urgency: 'Routine care',
  },
};

// ============================================
// TRANSLATIONS
// ============================================

const translations: Record<
  SupportedLanguage,
  {
    header: {
      title: string;
      subtitle: string;
    };
    esi: {
      level: string;
    };
    doctorBanner: {
      title: string;
      videoVisits: string;
      insurance: string;
      prescription: string;
      seeDoctor: string;
      available: string;
    };
    feedback: {
      title: string;
      notHelpful: string;
      soSo: string;
      helpful: string;
      thanks: string;
    };
    consensus: {
      title: string;
      agreement: string;
      rounds: string;
      agents: string;
      reached: string;
      notReached: string;
    };
    assessment: {
      title: string;
      differential: string;
      confidence: string;
      icd10: string;
      reasoning: string;
      mustNotMiss: string;
      plan: string;
      labTests: string;
      imaging: string;
      referrals: string;
      medications: string;
      education: string;
      followUp: string;
      warnings: string;
    };
    dissent: {
      title: string;
      subtitle: string;
    };
    soap: {
      title: string;
      forPhysicians: string;
      subjective: string;
      objective: string;
      assessmentSection: string;
      planSection: string;
      demographics: string;
      chiefComplaint: string;
      hpi: string;
      medicationsList: string;
      allergies: string;
      pmh: string;
      vitals: string;
      findings: string;
      summary: string;
      problems: string;
      downloadPdf: string;
    };
    disclaimer: string;
  }
> = {
  en: {
    header: {
      title: 'AI Consult Summary',
      subtitle: 'Based on your symptoms and information provided',
    },
    esi: {
      level: 'ESI Level',
    },
    doctorBanner: {
      title: 'We Recommend You See a Doctor Now',
      videoVisits: 'Video visits starting at $39',
      insurance: 'Most insurance accepted',
      prescription: 'Get a prescription in as little as 30 minutes',
      seeDoctor: 'See a Doctor',
      available: 'Video appointments available immediately',
    },
    feedback: {
      title: 'Was this assessment helpful?',
      notHelpful: 'Not Helpful',
      soSo: 'So-So',
      helpful: 'Helpful',
      thanks: 'Thanks for your feedback!',
    },
    consensus: {
      title: 'Multi-Specialist Consensus',
      agreement: 'Agreement Score',
      rounds: 'Deliberation Rounds',
      agents: 'Specialists Consulted',
      reached: 'Consensus Reached',
      notReached: 'Consensus Not Reached',
    },
    assessment: {
      title: 'Assessment & Plan',
      differential: 'Differential Diagnosis',
      confidence: 'Confidence',
      icd10: 'ICD-10',
      reasoning: 'Reasoning',
      mustNotMiss: 'Must Not Miss',
      plan: 'Plan of Action',
      labTests: 'Laboratory Tests',
      imaging: 'Imaging Studies',
      referrals: 'Referrals',
      medications: 'Medications',
      education: 'Patient Education',
      followUp: 'Follow-up',
      warnings: 'Warning Signs to Watch For',
    },
    dissent: {
      title: 'Alternative Viewpoints',
      subtitle: 'Some specialists considered other possibilities',
    },
    soap: {
      title: 'SOAP Note',
      forPhysicians: 'For Physicians',
      subjective: 'Subjective',
      objective: 'Objective',
      assessmentSection: 'Assessment',
      planSection: 'Plan',
      demographics: 'Patient Demographics',
      chiefComplaint: 'Chief Complaint',
      hpi: 'History of Present Illness',
      medicationsList: 'Current Medications',
      allergies: 'Allergies',
      pmh: 'Past Medical History',
      vitals: 'Vital Signs',
      findings: 'Self-Reported Findings',
      summary: 'Clinical Summary',
      problems: 'Problem List',
      downloadPdf: 'Download PDF',
    },
    disclaimer:
      'This AI assessment is for informational purposes only and does not constitute medical advice. Always consult a qualified healthcare provider.',
  },
  es: {
    header: {
      title: 'Resumen de Consulta IA',
      subtitle: 'Basado en tus síntomas e información proporcionada',
    },
    esi: {
      level: 'Nivel ESI',
    },
    doctorBanner: {
      title: 'Te Recomendamos Ver a un Doctor Ahora',
      videoVisits: 'Visitas por video desde $39',
      insurance: 'La mayoría de seguros aceptados',
      prescription: 'Obtén una receta en tan solo 30 minutos',
      seeDoctor: 'Ver un Doctor',
      available: 'Citas por video disponibles inmediatamente',
    },
    feedback: {
      title: '¿Fue útil esta evaluación?',
      notHelpful: 'No útil',
      soSo: 'Regular',
      helpful: 'Útil',
      thanks: '¡Gracias por tu opinión!',
    },
    consensus: {
      title: 'Consenso Multi-Especialista',
      agreement: 'Puntuación de Acuerdo',
      rounds: 'Rondas de Deliberación',
      agents: 'Especialistas Consultados',
      reached: 'Consenso Alcanzado',
      notReached: 'Consenso No Alcanzado',
    },
    assessment: {
      title: 'Evaluación y Plan',
      differential: 'Diagnóstico Diferencial',
      confidence: 'Confianza',
      icd10: 'CIE-10',
      reasoning: 'Razonamiento',
      mustNotMiss: 'No Pasar por Alto',
      plan: 'Plan de Acción',
      labTests: 'Pruebas de Laboratorio',
      imaging: 'Estudios de Imagen',
      referrals: 'Referencias',
      medications: 'Medicamentos',
      education: 'Educación del Paciente',
      followUp: 'Seguimiento',
      warnings: 'Señales de Alerta a Vigilar',
    },
    dissent: {
      title: 'Puntos de Vista Alternativos',
      subtitle: 'Algunos especialistas consideraron otras posibilidades',
    },
    soap: {
      title: 'Nota SOAP',
      forPhysicians: 'Para Médicos',
      subjective: 'Subjetivo',
      objective: 'Objetivo',
      assessmentSection: 'Evaluación',
      planSection: 'Plan',
      demographics: 'Datos del Paciente',
      chiefComplaint: 'Motivo de Consulta',
      hpi: 'Historia de la Enfermedad Actual',
      medicationsList: 'Medicamentos Actuales',
      allergies: 'Alergias',
      pmh: 'Antecedentes Médicos',
      vitals: 'Signos Vitales',
      findings: 'Hallazgos Autoreportados',
      summary: 'Resumen Clínico',
      problems: 'Lista de Problemas',
      downloadPdf: 'Descargar PDF',
    },
    disclaimer:
      'Esta evaluación de IA es solo para fines informativos y no constituye consejo médico. Siempre consulta a un profesional de salud calificado.',
  },
  fr: {
    header: {
      title: 'Résumé de Consultation IA',
      subtitle: 'Basé sur vos symptômes et informations fournies',
    },
    esi: {
      level: 'Niveau ESI',
    },
    doctorBanner: {
      title: 'Nous Vous Recommandons de Voir un Médecin Maintenant',
      videoVisits: 'Consultations vidéo à partir de 39$',
      insurance: 'La plupart des assurances acceptées',
      prescription: 'Obtenez une ordonnance en 30 minutes',
      seeDoctor: 'Voir un Médecin',
      available: 'Rendez-vous vidéo disponibles immédiatement',
    },
    feedback: {
      title: 'Cette évaluation était-elle utile?',
      notHelpful: 'Pas utile',
      soSo: 'Moyen',
      helpful: 'Utile',
      thanks: 'Merci pour votre retour!',
    },
    consensus: {
      title: 'Consensus Multi-Spécialiste',
      agreement: "Score d'Accord",
      rounds: 'Tours de Délibération',
      agents: 'Spécialistes Consultés',
      reached: 'Consensus Atteint',
      notReached: 'Consensus Non Atteint',
    },
    assessment: {
      title: 'Évaluation et Plan',
      differential: 'Diagnostic Différentiel',
      confidence: 'Confiance',
      icd10: 'CIM-10',
      reasoning: 'Raisonnement',
      mustNotMiss: 'À Ne Pas Manquer',
      plan: "Plan d'Action",
      labTests: 'Tests de Laboratoire',
      imaging: "Études d'Imagerie",
      referrals: 'Références',
      medications: 'Médicaments',
      education: 'Éducation du Patient',
      followUp: 'Suivi',
      warnings: 'Signes à Surveiller',
    },
    dissent: {
      title: 'Points de Vue Alternatifs',
      subtitle: "Certains spécialistes ont envisagé d'autres possibilités",
    },
    soap: {
      title: 'Note SOAP',
      forPhysicians: 'Pour les Médecins',
      subjective: 'Subjectif',
      objective: 'Objectif',
      assessmentSection: 'Évaluation',
      planSection: 'Plan',
      demographics: 'Données du Patient',
      chiefComplaint: 'Motif de Consultation',
      hpi: 'Histoire de la Maladie Actuelle',
      medicationsList: 'Médicaments Actuels',
      allergies: 'Allergies',
      pmh: 'Antécédents Médicaux',
      vitals: 'Signes Vitaux',
      findings: 'Constatations Auto-déclarées',
      summary: 'Résumé Clinique',
      problems: 'Liste des Problèmes',
      downloadPdf: 'Télécharger PDF',
    },
    disclaimer:
      "Cette évaluation IA est à titre informatif uniquement et ne constitue pas un avis médical. Consultez toujours un professionnel de santé qualifié.",
  },
  de: {
    header: { title: 'KI-Konsultationszusammenfassung', subtitle: 'Basierend auf Ihren Symptomen und bereitgestellten Informationen' },
    esi: { level: 'ESI-Stufe' },
    doctorBanner: { title: 'Wir empfehlen Ihnen, jetzt einen Arzt aufzusuchen', videoVisits: 'Videokonsultationen ab 39€', insurance: 'Die meisten Versicherungen akzeptiert', prescription: 'Erhalten Sie ein Rezept in nur 30 Minuten', seeDoctor: 'Arzt aufsuchen', available: 'Videotermine sofort verfügbar' },
    feedback: { title: 'War diese Bewertung hilfreich?', notHelpful: 'Nicht hilfreich', soSo: 'Geht so', helpful: 'Hilfreich', thanks: 'Danke für Ihr Feedback!' },
    consensus: { title: 'Multi-Spezialisten-Konsens', agreement: 'Übereinstimmungswert', rounds: 'Beratungsrunden', agents: 'Konsultierte Spezialisten', reached: 'Konsens erreicht', notReached: 'Konsens nicht erreicht' },
    assessment: { title: 'Bewertung & Plan', differential: 'Differentialdiagnose', confidence: 'Vertrauen', icd10: 'ICD-10', reasoning: 'Begründung', mustNotMiss: 'Nicht verpassen', plan: 'Aktionsplan', labTests: 'Labortests', imaging: 'Bildgebung', referrals: 'Überweisungen', medications: 'Medikamente', education: 'Patientenaufklärung', followUp: 'Nachsorge', warnings: 'Warnzeichen zu beachten' },
    dissent: { title: 'Alternative Ansichten', subtitle: 'Einige Spezialisten erwogen andere Möglichkeiten' },
    soap: { title: 'SOAP-Notiz', forPhysicians: 'Für Ärzte', subjective: 'Subjektiv', objective: 'Objektiv', assessmentSection: 'Bewertung', planSection: 'Plan', demographics: 'Patientendaten', chiefComplaint: 'Hauptbeschwerde', hpi: 'Anamnese', medicationsList: 'Aktuelle Medikamente', allergies: 'Allergien', pmh: 'Vorerkrankungen', vitals: 'Vitalzeichen', findings: 'Selbstberichtete Befunde', summary: 'Klinische Zusammenfassung', problems: 'Problemliste', downloadPdf: 'PDF herunterladen' },
    disclaimer: 'Diese KI-Bewertung dient nur zu Informationszwecken und stellt keine medizinische Beratung dar. Konsultieren Sie immer einen qualifizierten Gesundheitsdienstleister.',
  },
  pt: {
    header: { title: 'Resumo da Consulta IA', subtitle: 'Baseado nos seus sintomas e informações fornecidas' },
    esi: { level: 'Nível ESI' },
    doctorBanner: { title: 'Recomendamos que consulte um médico agora', videoVisits: 'Consultas por vídeo a partir de 39€', insurance: 'A maioria dos seguros aceites', prescription: 'Obtenha uma receita em 30 minutos', seeDoctor: 'Ver um Médico', available: 'Consultas por vídeo disponíveis imediatamente' },
    feedback: { title: 'Esta avaliação foi útil?', notHelpful: 'Não útil', soSo: 'Assim assim', helpful: 'Útil', thanks: 'Obrigado pelo seu feedback!' },
    consensus: { title: 'Consenso Multi-Especialista', agreement: 'Pontuação de Acordo', rounds: 'Rondas de Deliberação', agents: 'Especialistas Consultados', reached: 'Consenso Alcançado', notReached: 'Consenso Não Alcançado' },
    assessment: { title: 'Avaliação & Plano', differential: 'Diagnóstico Diferencial', confidence: 'Confiança', icd10: 'CID-10', reasoning: 'Raciocínio', mustNotMiss: 'Não pode perder', plan: 'Plano de Ação', labTests: 'Testes Laboratoriais', imaging: 'Exames de Imagem', referrals: 'Encaminhamentos', medications: 'Medicamentos', education: 'Educação do Paciente', followUp: 'Acompanhamento', warnings: 'Sinais de Alerta' },
    dissent: { title: 'Pontos de Vista Alternativos', subtitle: 'Alguns especialistas consideraram outras possibilidades' },
    soap: { title: 'Nota SOAP', forPhysicians: 'Para Médicos', subjective: 'Subjetivo', objective: 'Objetivo', assessmentSection: 'Avaliação', planSection: 'Plano', demographics: 'Dados do Paciente', chiefComplaint: 'Queixa Principal', hpi: 'História da Doença Atual', medicationsList: 'Medicamentos Atuais', allergies: 'Alergias', pmh: 'Histórico Médico', vitals: 'Sinais Vitais', findings: 'Achados Auto-relatados', summary: 'Resumo Clínico', problems: 'Lista de Problemas', downloadPdf: 'Baixar PDF' },
    disclaimer: 'Esta avaliação de IA é apenas para fins informativos e não constitui aconselhamento médico. Consulte sempre um profissional de saúde qualificado.',
  },
  it: {
    header: { title: 'Riepilogo Consulto IA', subtitle: 'Basato sui tuoi sintomi e informazioni fornite' },
    esi: { level: 'Livello ESI' },
    doctorBanner: { title: 'Ti consigliamo di vedere un medico ora', videoVisits: 'Visite video da 39€', insurance: 'La maggior parte delle assicurazioni accettate', prescription: 'Ottieni una prescrizione in 30 minuti', seeDoctor: 'Vedere un Medico', available: 'Appuntamenti video disponibili immediatamente' },
    feedback: { title: 'Questa valutazione è stata utile?', notHelpful: 'Non utile', soSo: 'Così così', helpful: 'Utile', thanks: 'Grazie per il tuo feedback!' },
    consensus: { title: 'Consenso Multi-Specialista', agreement: 'Punteggio di Accordo', rounds: 'Turni di Deliberazione', agents: 'Specialisti Consultati', reached: 'Consenso Raggiunto', notReached: 'Consenso Non Raggiunto' },
    assessment: { title: 'Valutazione & Piano', differential: 'Diagnosi Differenziale', confidence: 'Confidenza', icd10: 'ICD-10', reasoning: 'Ragionamento', mustNotMiss: 'Da Non Perdere', plan: 'Piano di Azione', labTests: 'Test di Laboratorio', imaging: 'Studi di Imaging', referrals: 'Referti', medications: 'Farmaci', education: 'Educazione del Paziente', followUp: 'Follow-up', warnings: 'Segnali da Monitorare' },
    dissent: { title: 'Punti di Vista Alternativi', subtitle: 'Alcuni specialisti hanno considerato altre possibilità' },
    soap: { title: 'Nota SOAP', forPhysicians: 'Per i Medici', subjective: 'Soggettivo', objective: 'Obiettivo', assessmentSection: 'Valutazione', planSection: 'Piano', demographics: 'Dati del Paziente', chiefComplaint: 'Motivo della Visita', hpi: 'Storia della Malattia Attuale', medicationsList: 'Farmaci Attuali', allergies: 'Allergie', pmh: 'Storia Clinica', vitals: 'Segni Vitali', findings: 'Reperti Auto-riportati', summary: 'Riepilogo Clinico', problems: 'Lista dei Problemi', downloadPdf: 'Scarica PDF' },
    disclaimer: 'Questa valutazione IA è solo a scopo informativo e non costituisce consiglio medico. Consultare sempre un operatore sanitario qualificato.',
  },
  ca: {
    header: { title: 'Resum de Consulta IA', subtitle: 'Basat en els teus símptomes i informació proporcionada' },
    esi: { level: 'Nivell ESI' },
    doctorBanner: { title: 'Et recomanem veure un metge ara', videoVisits: 'Visites per vídeo des de 39€', insurance: 'La majoria d\'assegurances acceptades', prescription: 'Obtén una recepta en 30 minuts', seeDoctor: 'Veure un Metge', available: 'Cites per vídeo disponibles immediatament' },
    feedback: { title: 'Aquesta avaluació ha estat útil?', notHelpful: 'No útil', soSo: 'Regular', helpful: 'Útil', thanks: 'Gràcies pel teu feedback!' },
    consensus: { title: 'Consens Multi-Especialista', agreement: 'Puntuació d\'Acord', rounds: 'Rondes de Deliberació', agents: 'Especialistes Consultats', reached: 'Consens Assolit', notReached: 'Consens No Assolit' },
    assessment: { title: 'Avaluació & Pla', differential: 'Diagnòstic Diferencial', confidence: 'Confiança', icd10: 'CIM-10', reasoning: 'Raonament', mustNotMiss: 'No Perdre', plan: 'Pla d\'Acció', labTests: 'Proves de Laboratori', imaging: 'Estudis d\'Imatge', referrals: 'Derivacions', medications: 'Medicaments', education: 'Educació del Pacient', followUp: 'Seguiment', warnings: 'Senyals a Vigilar' },
    dissent: { title: 'Punts de Vista Alternatius', subtitle: 'Alguns especialistes van considerar altres possibilitats' },
    soap: { title: 'Nota SOAP', forPhysicians: 'Per a Metges', subjective: 'Subjectiu', objective: 'Objectiu', assessmentSection: 'Avaluació', planSection: 'Pla', demographics: 'Dades del Pacient', chiefComplaint: 'Motiu de Consulta', hpi: 'Història de la Malaltia Actual', medicationsList: 'Medicaments Actuals', allergies: 'Al·lèrgies', pmh: 'Historial Mèdic', vitals: 'Signes Vitals', findings: 'Troballes Auto-reportades', summary: 'Resum Clínic', problems: 'Llista de Problemes', downloadPdf: 'Descarregar PDF' },
    disclaimer: 'Aquesta avaluació IA és només per a fins informatius i no constitueix assessorament mèdic. Consulteu sempre un professional de salut qualificat.',
  },
};

// ============================================
// COMPONENT
// ============================================

export function AssessmentPanel({
  consensus,
  orchestration,
  soapNote,
  soapNoteText,
  onFeedback,
  onBookDoctor,
  onDownloadPDF,
  language = 'en',
  className,
}: AssessmentPanelProps) {
  const { t } = useTranslation();
  const [feedbackGiven, setFeedbackGiven] = useState<FeedbackRating | null>(null);
  const [assessmentOpen, setAssessmentOpen] = useState(true);
  const [soapOpen, setSoapOpen] = useState(false);
  const [dissentOpen, setDissentOpen] = useState(false);

  const text = translations[language] || translations.en;

  // Normalize data from either orchestration or legacy consensus
  const normalizedConsensus = orchestration
    ? {
        kendallW: orchestration.consensus.kendall_w,
        consensusReached: orchestration.consensus.consensus_reached,
        roundsRequired: orchestration.consensus.rounds_required,
        participatingAgents: orchestration.consensus.participating_agents,
        primaryDiagnosis: {
          diagnosis: orchestration.consensus.primary_diagnosis.diagnosis,
          icd10: {
            code: orchestration.consensus.primary_diagnosis.icd10_code,
            name: orchestration.consensus.primary_diagnosis.icd10_name,
          },
          confidence: orchestration.consensus.primary_diagnosis.confidence,
          reasoning: orchestration.consensus.primary_diagnosis.reasoning,
          rank: 1,
        } as DifferentialDiagnosis,
        differentialDiagnosis: orchestration.consensus.differential_diagnoses.map((d) => ({
          rank: d.rank,
          diagnosis: d.diagnosis,
          icd10: { code: d.icd10_code, name: d.icd10_name },
          confidence: d.confidence,
          reasoning: d.reasoning,
        })) as DifferentialDiagnosis[],
        planOfAction: {
          labTests: orchestration.plan.lab_tests,
          imaging: orchestration.plan.imaging,
          referrals: orchestration.plan.referrals,
          medications: orchestration.plan.medications,
          patientEducation: orchestration.plan.patient_education,
          followUp: orchestration.plan.follow_up,
          redFlagWarnings: orchestration.plan.red_flag_warnings,
        } as PlanOfAction,
        finalEsiLevel: orchestration.triage.esi_level,
        humanReviewRequired: orchestration.triage.human_review_required,
        disposition: orchestration.triage.disposition,
        createdAt: new Date().toISOString(),
        dissentingOpinions: orchestration.consensus.dissenting_opinions,
      }
    : consensus;

  if (!normalizedConsensus) {
    return null;
  }

  const esiLevel = normalizedConsensus.finalEsiLevel || 3;
  const esiConfig = ESI_CONFIG[esiLevel];
  const showDoctorBanner = esiLevel <= 3;

  // Get dissenting opinions if available
  const dissentingOpinions = orchestration?.consensus.dissenting_opinions || [];

  const handleFeedback = (rating: FeedbackRating) => {
    if (feedbackGiven) return;
    setFeedbackGiven(rating);
    onFeedback(rating);
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString(language, {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateString;
    }
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header Section */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-xl text-blue-600 flex items-center gap-2">
                <Stethoscope className="w-5 h-5" />
                {text.header.title}
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                {text.header.subtitle}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatDate(normalizedConsensus.createdAt)}
              </p>
            </div>

            {/* ESI Level Badge */}
            <div
              className={cn(
                'px-3 py-1.5 rounded-lg flex items-center gap-2',
                esiConfig.bgColor,
                esiConfig.color
              )}
              role="status"
              aria-label={`${text.esi.level} ${esiLevel} - ${esiConfig.label}`}
            >
              <span className="text-xs font-medium">{text.esi.level}</span>
              <span className="text-lg font-bold">{esiLevel}</span>
              <span className="text-xs hidden sm:inline">- {esiConfig.label}</span>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Consensus Metrics Section */}
      {(orchestration || normalizedConsensus.kendallW) && (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
          <CardContent className="pt-4 pb-4">
            <h4 className="text-sm font-semibold text-blue-800 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              {text.consensus.title}
            </h4>
            <div className="grid grid-cols-3 gap-4">
              {/* Agreement Score */}
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {Math.round((normalizedConsensus.kendallW || 0) * 100)}%
                </div>
                <div className="text-xs text-blue-600">{text.consensus.agreement}</div>
              </div>

              {/* Rounds Required */}
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700 flex items-center justify-center gap-1">
                  <RotateCcw className="w-4 h-4" />
                  {normalizedConsensus.roundsRequired || 1}
                </div>
                <div className="text-xs text-blue-600">{text.consensus.rounds}</div>
              </div>

              {/* Agents Consulted */}
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-700">
                  {normalizedConsensus.participatingAgents?.length || 0}
                </div>
                <div className="text-xs text-blue-600">{text.consensus.agents}</div>
              </div>
            </div>

            {/* Consensus Status */}
            <div className="mt-3 flex justify-center">
              <span
                className={cn(
                  'text-xs px-2 py-1 rounded-full',
                  normalizedConsensus.consensusReached
                    ? 'bg-green-100 text-green-700'
                    : 'bg-amber-100 text-amber-700'
                )}
              >
                {normalizedConsensus.consensusReached
                  ? text.consensus.reached
                  : text.consensus.notReached}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Doctor Recommendation Banner */}
      {showDoctorBanner && (
        <Card
          className={cn(
            'border-2',
            esiLevel === 1 || esiLevel === 2
              ? 'bg-red-50 border-red-200'
              : 'bg-amber-50 border-amber-200'
          )}
        >
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
              <div className="flex-1">
                <h3
                  className={cn(
                    'text-lg font-semibold mb-3 flex items-center gap-2',
                    esiLevel <= 2 ? 'text-red-700' : 'text-amber-700'
                  )}
                >
                  <AlertTriangle className="w-5 h-5" />
                  {text.doctorBanner.title}
                </h3>

                <ul className="space-y-2">
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {text.doctorBanner.videoVisits}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {text.doctorBanner.insurance}
                  </li>
                  <li className="flex items-center gap-2 text-sm text-gray-700">
                    <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                    {text.doctorBanner.prescription}
                  </li>
                </ul>
              </div>

              <div className="flex flex-col gap-2 w-full md:w-auto">
                <Button
                  onClick={onBookDoctor}
                  className={cn(
                    'gap-2',
                    esiLevel <= 2
                      ? 'bg-red-600 hover:bg-red-700'
                      : 'bg-amber-600 hover:bg-amber-700'
                  )}
                  size="lg"
                  aria-label={text.doctorBanner.seeDoctor}
                >
                  <Video className="w-5 h-5" />
                  {text.doctorBanner.seeDoctor}
                </Button>
                <p className="text-xs text-gray-500 text-center flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {text.doctorBanner.available}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Feedback Buttons */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground">{text.feedback.title}</span>

            {feedbackGiven ? (
              <span className="text-sm text-green-600 font-medium animate-fade-in">
                {text.feedback.thanks}
              </span>
            ) : (
              <div
                className="flex gap-2"
                role="group"
                aria-label={text.feedback.title}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedback('not_helpful')}
                  className={cn(
                    'gap-1.5',
                    feedbackGiven === 'not_helpful' &&
                      'bg-red-50 border-red-300 text-red-700'
                  )}
                  aria-pressed={feedbackGiven === 'not_helpful'}
                >
                  <ThumbsDown className="w-4 h-4" />
                  <span className="hidden sm:inline">{text.feedback.notHelpful}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedback('so_so')}
                  className={cn(
                    'gap-1.5',
                    feedbackGiven === 'so_so' &&
                      'bg-amber-50 border-amber-300 text-amber-700'
                  )}
                  aria-pressed={feedbackGiven === 'so_so'}
                >
                  <Meh className="w-4 h-4" />
                  <span className="hidden sm:inline">{text.feedback.soSo}</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleFeedback('helpful')}
                  className={cn(
                    'gap-1.5',
                    feedbackGiven === 'helpful' &&
                      'bg-green-50 border-green-300 text-green-700'
                  )}
                  aria-pressed={feedbackGiven === 'helpful'}
                >
                  <ThumbsUp className="w-4 h-4" />
                  <span className="hidden sm:inline">{text.feedback.helpful}</span>
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Assessment & Plan Section */}
      <Collapsible open={assessmentOpen} onOpenChange={setAssessmentOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  {text.assessment.title}
                </CardTitle>
                {assessmentOpen ? (
                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <CardContent className="pt-0 space-y-6">
              {/* Differential Diagnosis */}
              <div>
                <h4 className="font-semibold mb-3 text-gray-700">
                  {text.assessment.differential}
                </h4>
                <div className="space-y-3">
                  {normalizedConsensus.differentialDiagnosis.map((dx, index) => (
                    <div
                      key={`dx-${index}`}
                      className="border rounded-lg p-3 bg-muted/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-gray-500 text-sm">
                              {dx.rank}.
                            </span>
                            <span className="font-medium">{dx.diagnosis}</span>
                            {dx.mustNotMiss && (
                              <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                                {text.assessment.mustNotMiss}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground mb-2">
                            {text.assessment.icd10}: {dx.icd10.code} - {dx.icd10.name}
                          </div>
                          {dx.reasoning && (
                            <p className="text-sm text-gray-600">{dx.reasoning}</p>
                          )}
                        </div>

                        {/* Confidence Bar */}
                        <div className="flex flex-col items-end min-w-[80px]">
                          <span className="text-xs text-muted-foreground mb-1">
                            {text.assessment.confidence}
                          </span>
                          <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                dx.confidence >= 0.7
                                  ? 'bg-green-500'
                                  : dx.confidence >= 0.4
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              )}
                              style={{ width: `${dx.confidence * 100}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium mt-0.5">
                            {Math.round(dx.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Plan of Action */}
              <div>
                <h4 className="font-semibold mb-3 text-gray-700">
                  {text.assessment.plan}
                </h4>

                <div className="space-y-4">
                  {/* Lab Tests */}
                  {normalizedConsensus.planOfAction.labTests.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        • {text.assessment.labTests}
                      </h5>
                      <ul className="ml-4 space-y-1">
                        {normalizedConsensus.planOfAction.labTests.map((test, i) => (
                          <li key={i} className="text-sm text-gray-700">
                            – {test}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Imaging */}
                  {normalizedConsensus.planOfAction.imaging.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        • {text.assessment.imaging}
                      </h5>
                      <ul className="ml-4 space-y-1">
                        {normalizedConsensus.planOfAction.imaging.map((study, i) => (
                          <li key={i} className="text-sm text-gray-700">
                            – {study}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Referrals */}
                  {normalizedConsensus.planOfAction.referrals.length > 0 && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        • {text.assessment.referrals}
                      </h5>
                      <ul className="ml-4 space-y-1">
                        {normalizedConsensus.planOfAction.referrals.map((ref, i) => (
                          <li key={i} className="text-sm text-gray-700">
                            – {ref}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Follow-up */}
                  {normalizedConsensus.planOfAction.followUp && (
                    <div>
                      <h5 className="text-sm font-medium text-gray-600 mb-2">
                        • {text.assessment.followUp}
                      </h5>
                      <p className="ml-4 text-sm text-gray-700">
                        {normalizedConsensus.planOfAction.followUp}
                      </p>
                    </div>
                  )}

                  {/* Red Flag Warnings */}
                  {normalizedConsensus.planOfAction.redFlagWarnings &&
                    normalizedConsensus.planOfAction.redFlagWarnings.length > 0 && (
                      <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                        <h5 className="text-sm font-medium text-red-700 mb-2 flex items-center gap-1">
                          <AlertTriangle className="w-4 h-4" />
                          {text.assessment.warnings}
                        </h5>
                        <ul className="space-y-1">
                          {normalizedConsensus.planOfAction.redFlagWarnings.map((warning, i) => (
                            <li key={i} className="text-sm text-red-600">
                              • {warning}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Dissenting Opinions Section */}
      {dissentingOpinions.length > 0 && (
        <Collapsible open={dissentOpen} onOpenChange={setDissentOpen}>
          <Card className="border-amber-200 bg-amber-50/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-amber-100/50 transition-colors py-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                    <MessageSquare className="w-4 h-4" />
                    {text.dissent.title}
                    <span className="text-xs font-normal bg-amber-200 text-amber-800 px-2 py-0.5 rounded">
                      {dissentingOpinions.length}
                    </span>
                  </CardTitle>
                  {dissentOpen ? (
                    <ChevronUp className="w-4 h-4 text-amber-600" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-amber-600" />
                  )}
                </div>
                <p className="text-xs text-amber-700 mt-1">{text.dissent.subtitle}</p>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-3">
                {dissentingOpinions.map((opinion, index) => (
                  <div
                    key={`dissent-${index}`}
                    className="border border-amber-200 rounded-lg p-3 bg-white"
                  >
                    <div className="flex items-start gap-2">
                      <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
                        <Stethoscope className="w-4 h-4 text-amber-700" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-sm text-amber-800 mb-1">
                          {opinion.agent_id.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                        </div>
                        <div className="text-sm font-medium text-gray-700 mb-1">
                          {opinion.diagnosis}
                        </div>
                        <p className="text-xs text-gray-600">{opinion.reasoning}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* SOAP Note Section - From Orchestrator Response */}
      {orchestration?.soap_note && !soapNote && !soapNoteText && (
        <Collapsible open={soapOpen} onOpenChange={setSoapOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    {text.soap.title}
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {text.soap.forPhysicians}
                    </span>
                  </CardTitle>
                  {soapOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-4">
                {/* Subjective */}
                <div>
                  <h4 className="font-semibold mb-2 text-blue-600 border-b pb-1">
                    {text.soap.subjective}
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {orchestration.soap_note.subjective}
                  </p>
                </div>

                {/* Objective */}
                <div>
                  <h4 className="font-semibold mb-2 text-blue-600 border-b pb-1">
                    {text.soap.objective}
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {orchestration.soap_note.objective}
                  </p>
                </div>

                {/* Assessment */}
                <div>
                  <h4 className="font-semibold mb-2 text-blue-600 border-b pb-1">
                    {text.soap.assessmentSection}
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {orchestration.soap_note.assessment}
                  </p>
                </div>

                {/* Plan */}
                <div>
                  <h4 className="font-semibold mb-2 text-blue-600 border-b pb-1">
                    {text.soap.planSection}
                  </h4>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">
                    {orchestration.soap_note.plan}
                  </p>
                </div>

                {/* Download PDF Button */}
                {onDownloadPDF && (
                  <Button
                    onClick={onDownloadPDF}
                    variant="outline"
                    className="w-full mt-4 gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4" />
                    {text.soap.downloadPdf}
                  </Button>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* SOAP Note Section - Simple Text Format from Orchestrator */}
      {soapNoteText && !soapNote && (
        <Collapsible open={soapOpen} onOpenChange={setSoapOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    {text.soap.title}
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {text.soap.forPhysicians}
                    </span>
                  </CardTitle>
                  {soapOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap font-sans leading-relaxed">
                  {soapNoteText}
                </pre>

                {/* Download PDF Button */}
                {onDownloadPDF && (
                  <Button
                    onClick={onDownloadPDF}
                    variant="outline"
                    className="w-full mt-4 gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4" />
                    {text.soap.downloadPdf}
                  </Button>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* SOAP Note Section - Structured Format */}
      {soapNote && (
        <Collapsible open={soapOpen} onOpenChange={setSoapOpen}>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileText className="w-5 h-5 text-green-600" />
                    {text.soap.title}
                    <span className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {text.soap.forPhysicians}
                    </span>
                  </CardTitle>
                  {soapOpen ? (
                    <ChevronUp className="w-5 h-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-muted-foreground" />
                  )}
                </div>
              </CardHeader>
            </CollapsibleTrigger>

            <CollapsibleContent>
              <CardContent className="pt-0 space-y-6">
                {/* Subjective */}
                <div>
                  <h4 className="font-semibold mb-3 text-blue-600 border-b pb-1">
                    {text.soap.subjective}
                  </h4>
                  <div className="space-y-3 text-sm">
                    {/* Demographics */}
                    {soapNote.subjective.demographics && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {text.soap.demographics}:{' '}
                        </span>
                        <span className="text-gray-700">
                          {soapNote.subjective.demographics.age} y/o{' '}
                          {soapNote.subjective.demographics.gender}
                        </span>
                      </div>
                    )}

                    {/* Chief Complaint */}
                    <div>
                      <span className="font-medium text-gray-600">
                        {text.soap.chiefComplaint}:{' '}
                      </span>
                      <span className="text-gray-700">
                        {soapNote.subjective.chiefComplaint}
                      </span>
                    </div>

                    {/* HPI */}
                    <div>
                      <span className="font-medium text-gray-600">{text.soap.hpi}: </span>
                      <span className="text-gray-700">{soapNote.subjective.hpi}</span>
                    </div>

                    {/* Medications */}
                    {soapNote.subjective.medications.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {text.soap.medicationsList}:{' '}
                        </span>
                        <span className="text-gray-700">
                          {soapNote.subjective.medications.join(', ')}
                        </span>
                      </div>
                    )}

                    {/* Allergies */}
                    {soapNote.subjective.allergies.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {text.soap.allergies}:{' '}
                        </span>
                        <span className="text-gray-700">
                          {soapNote.subjective.allergies
                            .map((a) => `${a.allergen} (${a.reaction})`)
                            .join(', ')}
                        </span>
                      </div>
                    )}

                    {/* PMH */}
                    {soapNote.subjective.pastMedicalHistory &&
                      soapNote.subjective.pastMedicalHistory.length > 0 && (
                        <div>
                          <span className="font-medium text-gray-600">
                            {text.soap.pmh}:{' '}
                          </span>
                          <span className="text-gray-700">
                            {soapNote.subjective.pastMedicalHistory.join(', ')}
                          </span>
                        </div>
                      )}
                  </div>
                </div>

                {/* Objective */}
                <div>
                  <h4 className="font-semibold mb-3 text-blue-600 border-b pb-1">
                    {text.soap.objective}
                  </h4>
                  <div className="space-y-3 text-sm">
                    {/* Vitals */}
                    {soapNote.objective.vitalSigns && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {text.soap.vitals}:{' '}
                        </span>
                        <span className="text-gray-700">
                          {[
                            soapNote.objective.vitalSigns.bloodPressure &&
                              `BP ${soapNote.objective.vitalSigns.bloodPressure}`,
                            soapNote.objective.vitalSigns.heartRate &&
                              `HR ${soapNote.objective.vitalSigns.heartRate}`,
                            soapNote.objective.vitalSigns.temperature &&
                              `T ${soapNote.objective.vitalSigns.temperature}°`,
                            soapNote.objective.vitalSigns.respiratoryRate &&
                              `RR ${soapNote.objective.vitalSigns.respiratoryRate}`,
                            soapNote.objective.vitalSigns.spO2 &&
                              `SpO2 ${soapNote.objective.vitalSigns.spO2}%`,
                          ]
                            .filter(Boolean)
                            .join(', ') || 'Not recorded'}
                        </span>
                      </div>
                    )}

                    {/* Self-reported findings */}
                    {soapNote.objective.selfReportedFindings.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {text.soap.findings}:{' '}
                        </span>
                        <ul className="ml-4 mt-1">
                          {soapNote.objective.selfReportedFindings.map((finding, i) => (
                            <li key={i} className="text-gray-700">
                              • {finding}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Assessment */}
                <div>
                  <h4 className="font-semibold mb-3 text-blue-600 border-b pb-1">
                    {text.soap.assessmentSection}
                  </h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">
                        {text.soap.summary}:{' '}
                      </span>
                      <span className="text-gray-700">
                        {soapNote.assessment.summaryStatement}
                      </span>
                    </div>

                    {soapNote.assessment.problemList.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">
                          {text.soap.problems}:{' '}
                        </span>
                        <ol className="ml-4 mt-1 list-decimal">
                          {soapNote.assessment.problemList.map((problem, i) => (
                            <li key={i} className="text-gray-700">
                              {problem}
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                </div>

                {/* Plan */}
                <div>
                  <h4 className="font-semibold mb-3 text-blue-600 border-b pb-1">
                    {text.soap.planSection}
                  </h4>
                  <div className="space-y-2 text-sm">
                    {soapNote.plan.diagnostics.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Diagnostics: </span>
                        <span className="text-gray-700">
                          {soapNote.plan.diagnostics.join(', ')}
                        </span>
                      </div>
                    )}
                    {soapNote.plan.treatments.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Treatments: </span>
                        <span className="text-gray-700">
                          {soapNote.plan.treatments.join(', ')}
                        </span>
                      </div>
                    )}
                    {soapNote.plan.referrals.length > 0 && (
                      <div>
                        <span className="font-medium text-gray-600">Referrals: </span>
                        <span className="text-gray-700">
                          {soapNote.plan.referrals.join(', ')}
                        </span>
                      </div>
                    )}
                    {soapNote.plan.followUp && (
                      <div>
                        <span className="font-medium text-gray-600">Follow-up: </span>
                        <span className="text-gray-700">{soapNote.plan.followUp}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Download PDF Button */}
                {onDownloadPDF && (
                  <Button
                    onClick={onDownloadPDF}
                    variant="outline"
                    className="w-full mt-4 gap-2 bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100"
                  >
                    <Download className="w-4 h-4" />
                    {text.soap.downloadPdf}
                  </Button>
                )}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Disclaimer */}
      <div className="p-3 bg-muted rounded-lg text-xs text-muted-foreground">
        <p className="font-medium mb-1">⚠️ AI DISCLAIMER</p>
        <p>{text.disclaimer}</p>
      </div>
    </div>
  );
}

export default AssessmentPanel;
