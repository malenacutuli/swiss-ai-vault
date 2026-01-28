/**
 * HELIOS Knowledge System Types
 * Defines interfaces for all medical knowledge sources
 */

import type { SupportedLanguage } from '../config/languages.js';

// ============================================
// CODING SYSTEMS
// ============================================

export type CodingSystem =
  | 'ICD-10-CM'   // US diagnoses
  | 'ICD-10'      // International diagnoses
  | 'SNOMED-CT'   // Clinical terminology
  | 'RxNorm'      // US medications
  | 'LOINC'       // Lab/clinical observations
  | 'CPT'         // Procedures
  | 'NDC'         // Drug products
  | 'ATC';        // Drug classification

export type CodingMap = Partial<Record<CodingSystem, string>>;

// ============================================
// KNOWLEDGE SOURCE TYPES
// ============================================

export type KnowledgeSourceType =
  | 'terminology'        // RxNorm, SNOMED, ICD-10
  | 'drug_database'      // Interactions, dosing
  | 'clinical_guidelines'// Practice guidelines
  | 'literature'         // PubMed, research
  | 'symptom_logic'      // Symptom checker logic
  | 'embeddings'         // Fine-tuned vectors
  | 'llm_baseline';      // Claude's training

// ============================================
// KNOWLEDGE SOURCE INTERFACE
// ============================================

export interface KnowledgeSource {
  // Identity
  id: string;
  name: string;
  type: KnowledgeSourceType;
  version: string;
  lastUpdated: Date;

  // Query methods
  query(params: KnowledgeQuery): Promise<KnowledgeResult[]>;
  getByCode(system: CodingSystem, code: string): Promise<MedicalConcept | null>;
  search(text: string, options?: SearchOptions): Promise<SearchResult[]>;

  // Validation
  validate(concept: MedicalConcept): Promise<ValidationResult>;

  // Metadata
  getCoverage(): KnowledgeCoverage;
  getConfidence(): number;
  isAvailable(): Promise<boolean>;
}

// ============================================
// QUERY TYPES
// ============================================

export interface KnowledgeQuery {
  type: 'diagnosis' | 'medication' | 'symptom' | 'procedure' | 'guideline' | 'interaction';
  terms: string[];
  context?: ClinicalContext;
  language: SupportedLanguage;
  maxResults?: number;
  minConfidence?: number;
}

export interface ClinicalContext {
  age?: number;
  sex?: 'male' | 'female' | 'other';
  pregnant?: boolean;
  conditions?: string[];
  medications?: string[];
  allergies?: string[];
}

export interface SearchOptions {
  fuzzy?: boolean;
  maxResults?: number;
  minScore?: number;
}

// ============================================
// RESULT TYPES
// ============================================

export interface KnowledgeResult {
  concept: MedicalConcept;
  relevanceScore: number;
  matchType: 'exact' | 'synonym' | 'related' | 'fuzzy';
}

export interface MedicalConcept {
  id: string;
  preferredTerm: string;
  synonyms: string[];
  codes: CodingMap;
  category: string;
  confidence: number;
  source: string;
  citations?: Citation[];
  metadata?: Record<string, unknown>;
}

export interface Citation {
  source: string;
  title?: string;
  url?: string;
  pubmedId?: string;
  doi?: string;
  year?: number;
}

export interface SearchResult {
  id: string;
  name: string;
  score: number;
  source: string;
  codes?: CodingMap;
}

export interface ValidationResult {
  valid: boolean;
  reason: string;
  confidence?: number;
  corrections?: string[];
}

export interface KnowledgeCoverage {
  medications: number;  // 0-1 coverage score
  diagnoses: number;
  procedures: number;
  symptoms: number;
  guidelines: number;
}

// ============================================
// CONSENSUS TYPES
// ============================================

export interface ConsensusOptions {
  minSources?: number;
  consensusThreshold?: number;
  requireCitation?: boolean;
  timeout?: number;
}

export interface ConsensusResult {
  achieved: boolean;
  confidence: number;
  results: MedicalConcept[];
  sources?: string[];
  message: string;
  conflictingInfo?: ConflictInfo[];
}

export interface ConflictInfo {
  topic: string;
  sources: Array<{
    source: string;
    value: string;
    confidence: number;
  }>;
}

// ============================================
// VERIFICATION TYPES
// ============================================

export interface VerificationResult {
  claim: string;
  verified: boolean;
  confidence: number;
  details: ConceptVerification[];
  warning?: string;
}

export interface ConceptVerification {
  concept: string;
  verified: boolean;
  confidence: number;
  source?: string;
}

// ============================================
// DRUG-SPECIFIC TYPES
// ============================================

export interface DrugInteraction {
  drug1: MedicalConcept;
  drug2: MedicalConcept;
  severity: 'major' | 'moderate' | 'minor';
  description: string;
  mechanism?: string;
  management?: string;
  citations: Citation[];
}

export interface DrugInfo extends MedicalConcept {
  drugClass?: string;
  genericName?: string;
  brandNames?: string[];
  doseForms?: string[];
  routes?: string[];
  warnings?: string[];
  contraindications?: string[];
  interactions?: DrugInteraction[];
}
