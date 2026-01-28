/**
 * Hypothesis Generator Agent
 * Generates differential diagnosis hypotheses
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../base.js';
import type { AgentConfig, AgentContext, AgentOutput } from '../types.js';
import type { SupportedLanguage } from '../../config/languages.js';
import type { Hypothesis } from '../../types/index.js';
import { CLAUDE_MODELS } from '../../config/models.js';
import { generateUUID, now } from '../../utils/index.js';

const PROMPTS: Record<SupportedLanguage, string> = {
  en: `You are the Hypothesis Generator for HELIOS clinical triage.

## YOUR TASK
Generate differential diagnosis CONSIDERATIONS (not diagnoses) based on symptoms and history.

## IMPORTANT DISCLAIMER
You are generating CONSIDERATIONS for clinical review, NOT making diagnoses.
All outputs require verification by a licensed healthcare provider.

## HYPOTHESIS CATEGORIES

### MUST_NOT_MISS (Life-threatening)
- Conditions that could cause serious harm if missed
- Examples: MI, PE, aortic dissection, meningitis
- Always include relevant must-not-miss conditions

### COMMON (High Probability)
- Statistically most likely diagnoses
- Based on prevalence and presentation

### UNCOMMON (Lower Probability)
- Less likely but clinically plausible
- Should be considered if common diagnoses ruled out

## OUTPUT FORMAT (JSON)
{
  "hypotheses": [
    {
      "diagnosis": "Condition name",
      "icd10_code": "If known",
      "category": "must_not_miss|common|uncommon",
      "likelihood": 0.0-1.0,
      "supporting_evidence": ["list of supporting findings"],
      "contradicting_evidence": ["list of findings against"],
      "key_differentiating_features": ["what would confirm/exclude"],
      "recommended_workup": ["tests to consider"]
    }
  ],
  "primary_consideration": "Most likely diagnosis name",
  "must_not_miss_addressed": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Overall clinical reasoning"
}

## RULES
- ALWAYS include at least one must-not-miss consideration for serious symptoms
- Support each hypothesis with evidence from the case
- Note contradicting evidence honestly
- Do NOT make definitive diagnoses
- Use "considerations" and "possibilities" language`,

  es: `Eres el Generador de Hipótesis para el triaje clínico de HELIOS.

## TU TAREA
Generar CONSIDERACIONES de diagnóstico diferencial (no diagnósticos) basadas en síntomas e historia.

## CATEGORÍAS DE HIPÓTESIS
### MUST_NOT_MISS (Potencialmente mortal)
### COMMON (Alta Probabilidad)
### UNCOMMON (Menor Probabilidad)

## FORMATO DE SALIDA (JSON)
{
  "hypotheses": [
    {
      "diagnosis": "Nombre de la condición",
      "icd10_code": "Si se conoce",
      "category": "must_not_miss|common|uncommon",
      "likelihood": 0.0-1.0,
      "supporting_evidence": ["evidencia de apoyo"],
      "contradicting_evidence": ["evidencia en contra"],
      "key_differentiating_features": ["características diferenciadoras"],
      "recommended_workup": ["estudios a considerar"]
    }
  ],
  "primary_consideration": "Diagnóstico más probable",
  "must_not_miss_addressed": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Razonamiento clínico"
}`,

  fr: `Vous êtes le Générateur d'Hypothèses pour le triage clinique HELIOS.

## VOTRE TÂCHE
Générer des CONSIDÉRATIONS de diagnostic différentiel (pas des diagnostics).

## CATÉGORIES D'HYPOTHÈSES
### MUST_NOT_MISS (Potentiellement mortel)
### COMMON (Haute Probabilité)
### UNCOMMON (Probabilité Moindre)

## FORMAT DE SORTIE (JSON)
{
  "hypotheses": [
    {
      "diagnosis": "Nom de la condition",
      "icd10_code": "Si connu",
      "category": "must_not_miss|common|uncommon",
      "likelihood": 0.0-1.0,
      "supporting_evidence": ["preuves à l'appui"],
      "contradicting_evidence": ["preuves contre"],
      "key_differentiating_features": ["caractéristiques différenciantes"],
      "recommended_workup": ["examens à considérer"]
    }
  ],
  "primary_consideration": "Diagnostic le plus probable",
  "must_not_miss_addressed": true/false,
  "confidence": 0.0-1.0,
  "reasoning": "Raisonnement clinique"
}`,
};

interface ParsedHypothesis {
  diagnosis: string;
  icd10_code?: string;
  category: string;
  likelihood: number;
  supporting_evidence?: string[];
  contradicting_evidence?: string[];
}

export class HypothesisGeneratorAgent extends BaseAgent {
  constructor(client: Anthropic) {
    const config: AgentConfig = {
      id: 'hypothesis_gen_001',
      role: 'hypothesis_generator',
      team: 'differential',
      name: 'Hypothesis Generator',
      description: 'Generates differential diagnosis considerations',
      model: CLAUDE_MODELS.OPUS_4_5,  // Use Opus for clinical reasoning
      maxTokens: 4096,
      temperature: 0.3,
      systemPrompt: '',
      requiredPhases: ['differential'],
      priority: 1,
    };
    super(config, client);
  }

  getSystemPrompt(language: SupportedLanguage): string {
    return PROMPTS[language];
  }

  parseOutput(response: string, _context: AgentContext): Partial<AgentOutput> {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return { confidence: 0.5 };

      const parsed = JSON.parse(jsonMatch[0]) as {
        hypotheses?: ParsedHypothesis[];
        confidence?: number;
        reasoning?: string;
      };

      // Convert to Hypothesis type
      const extractedHypotheses: Hypothesis[] = (parsed.hypotheses || []).map((h: ParsedHypothesis) => ({
        hypothesis_id: generateUUID(),
        diagnosis: h.diagnosis,
        icd10_code: h.icd10_code,
        likelihood: h.likelihood,
        category: h.category as 'must_not_miss' | 'common' | 'uncommon',
        supporting_evidence: h.supporting_evidence || [],
        contradicting_evidence: h.contradicting_evidence || [],
        proposed_by: this.config.id,
        status: 'active' as const,
        created_at: now(),
      }));

      return {
        structuredOutput: parsed,
        extractedHypotheses,
        confidence: parsed.confidence || 0.8,
        reasoning: parsed.reasoning,
        recommendedPhase: 'plan',
      };
    } catch {
      return { confidence: 0.5 };
    }
  }
}
