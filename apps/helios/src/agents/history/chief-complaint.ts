/**
 * Chief Complaint Extractor Agent
 * Extracts and structures the primary reason for visit
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../base.js';
import type { AgentConfig, AgentContext, AgentOutput } from '../types.js';
import type { SupportedLanguage } from '../../config/languages.js';
import { CLAUDE_MODELS } from '../../config/models.js';
import type { SymptomEntity } from '../../types/index.js';
import { now } from '../../utils/index.js';

const PROMPTS: Record<SupportedLanguage, string> = {
  en: `You are the Chief Complaint Extractor for HELIOS clinical triage.

## YOUR TASK
Extract and structure the patient's chief complaint from their statement.

## OUTPUT FORMAT (JSON)
{
  "chief_complaint": "Brief statement of main concern",
  "onset": "When it started",
  "severity": 0-10,
  "duration": "How long",
  "primary_symptom": {
    "symptom": "Main symptom name",
    "location": "Body location if applicable",
    "character": "Description of sensation"
  },
  "associated_symptoms": ["list of related symptoms mentioned"],
  "patient_concern": "What the patient is most worried about",
  "confidence": 0.0-1.0
}

## RULES
- Extract ONLY what the patient explicitly states
- Do NOT infer or assume symptoms not mentioned
- Use patient's own words when possible
- Flag uncertainty if information is vague`,

  es: `Eres el Extractor de Motivo de Consulta para el triaje clínico de HELIOS.

## TU TAREA
Extraer y estructurar el motivo de consulta del paciente de su declaración.

## FORMATO DE SALIDA (JSON)
{
  "chief_complaint": "Declaración breve de la preocupación principal",
  "onset": "Cuándo comenzó",
  "severity": 0-10,
  "duration": "Duración",
  "primary_symptom": {
    "symptom": "Nombre del síntoma principal",
    "location": "Ubicación corporal si aplica",
    "character": "Descripción de la sensación"
  },
  "associated_symptoms": ["lista de síntomas relacionados mencionados"],
  "patient_concern": "Lo que más preocupa al paciente",
  "confidence": 0.0-1.0
}`,

  fr: `Vous êtes l'Extracteur de Motif de Consultation pour le triage clinique HELIOS.

## VOTRE TÂCHE
Extraire et structurer le motif de consultation du patient à partir de sa déclaration.

## FORMAT DE SORTIE (JSON)
{
  "chief_complaint": "Déclaration brève de la préoccupation principale",
  "onset": "Quand cela a commencé",
  "severity": 0-10,
  "duration": "Durée",
  "primary_symptom": {
    "symptom": "Nom du symptôme principal",
    "location": "Localisation corporelle si applicable",
    "character": "Description de la sensation"
  },
  "associated_symptoms": ["liste des symptômes associés mentionnés"],
  "patient_concern": "Ce qui préoccupe le plus le patient",
  "confidence": 0.0-1.0
}`,
};

export class ChiefComplaintAgent extends BaseAgent {
  constructor(client: Anthropic) {
    const config: AgentConfig = {
      id: 'cc_extractor_001',
      role: 'chief_complaint_extractor',
      team: 'history',
      name: 'Chief Complaint Extractor',
      description: 'Extracts and structures the primary reason for visit',
      model: CLAUDE_MODELS.HAIKU_4_5,  // Fast extraction
      maxTokens: 1024,
      temperature: 0.1,  // Low temperature for accuracy
      systemPrompt: '',  // Set per language
      requiredPhases: ['intake', 'chief_complaint'],
      priority: 1,
    };
    super(config, client);
  }

  getSystemPrompt(language: SupportedLanguage): string {
    return PROMPTS[language];
  }

  parseOutput(response: string, context: AgentContext): Partial<AgentOutput> {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return { confidence: 0.5 };
      }

      const parsed = JSON.parse(jsonMatch[0]) as {
        primary_symptom?: { symptom?: string; location?: string; character?: string };
        onset?: string;
        severity?: number;
        associated_symptoms?: string[];
        confidence?: number;
      };

      // Convert to structured symptoms
      const extractedSymptoms: SymptomEntity[] = [];

      if (parsed.primary_symptom?.symptom) {
        extractedSymptoms.push({
          symptom: parsed.primary_symptom.symptom,
          onset: parsed.onset,
          location: parsed.primary_symptom.location,
          character: parsed.primary_symptom.character,
          severity: parsed.severity,
          confidence: parsed.confidence || 0.8,
          extracted_at: now(),
        });
      }

      // Add associated symptoms
      for (const symptom of parsed.associated_symptoms || []) {
        extractedSymptoms.push({
          symptom,
          confidence: 0.7,
          extracted_at: now(),
        });
      }

      return {
        structuredOutput: parsed,
        extractedSymptoms,
        confidence: parsed.confidence || 0.8,
        recommendedPhase: 'history_taking',
        questionsToAsk: this.generateFollowUpQuestions(parsed, context.language),
      };
    } catch {
      return { confidence: 0.5 };
    }
  }

  private generateFollowUpQuestions(
    parsed: { onset?: string; severity?: number },
    language: SupportedLanguage
  ): string[] {
    const questions: Record<SupportedLanguage, string[]> = {
      en: [],
      es: [],
      fr: [],
    };

    if (!parsed.onset) {
      questions.en.push('When did this start?');
      questions.es.push('¿Cuándo comenzó esto?');
      questions.fr.push('Quand cela a-t-il commencé?');
    }

    if (!parsed.severity || parsed.severity === 0) {
      questions.en.push('On a scale of 0-10, how severe is this?');
      questions.es.push('En una escala de 0-10, ¿qué tan severo es?');
      questions.fr.push('Sur une échelle de 0 à 10, quelle est la gravité?');
    }

    return questions[language];
  }
}
