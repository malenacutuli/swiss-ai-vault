/**
 * HELIOS Clinical Tools Types
 * Defines tool interfaces for clinical calculations
 */

import type { SupportedLanguage } from '../config/languages.js';

// Tool categories
export type ToolCategory =
  | 'risk_calculator'
  | 'clinical_score'
  | 'dosing_calculator'
  | 'unit_converter'
  | 'guideline_lookup'
  | 'provider_search';

// Base tool interface
export interface ClinicalTool {
  id: string;
  name: string;
  category: ToolCategory;
  description: Record<SupportedLanguage, string>;
  inputSchema: ToolInputSchema;
  citations: string[];

  execute(input: unknown): Promise<ToolResult>;
  validate(input: unknown): ValidationResult;
}

export interface ToolInputSchema {
  required: string[];
  properties: Record<string, {
    type: 'number' | 'string' | 'boolean' | 'array';
    description: string;
    minimum?: number;
    maximum?: number;
    enum?: string[];
  }>;
}

export interface ToolResult {
  success: boolean;
  toolId: string;

  // Numeric results
  score?: number;
  risk?: number;
  category?: string;

  // Interpretation
  interpretation: Record<SupportedLanguage, string>;
  recommendation: Record<SupportedLanguage, string>;

  // Warnings
  warnings?: string[];
  limitations?: string[];

  // Citations
  citations: string[];

  // Raw data
  rawOutput?: Record<string, unknown>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// Common clinical inputs
export interface PatientVitals {
  heartRate?: number;
  systolicBP?: number;
  diastolicBP?: number;
  respiratoryRate?: number;
  temperature?: number;
  oxygenSaturation?: number;
  weight?: number;  // kg
  height?: number;  // cm
}

export interface PatientDemographics {
  age: number;
  sex: 'male' | 'female';
  pregnant?: boolean;
}
