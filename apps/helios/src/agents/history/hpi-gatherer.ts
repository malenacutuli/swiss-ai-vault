/**
 * HPI Gatherer Agent
 * Gathers History of Present Illness using OLDCARTS
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../base.js';
import type { AgentConfig, AgentContext, AgentOutput } from '../types.js';
import type { SupportedLanguage } from '../../config/languages.js';
import { CLAUDE_MODELS } from '../../config/models.js';

const PROMPTS: Record<SupportedLanguage, string> = {
  en: `You are the HPI Gatherer for HELIOS clinical triage.

## YOUR TASK
Gather complete History of Present Illness using OLDCARTS framework:
- Onset: When did it start?
- Location: Where is it?
- Duration: How long does it last?
- Character: What does it feel like?
- Aggravating factors: What makes it worse?
- Relieving factors: What makes it better?
- Timing: When does it occur? Pattern?
- Severity: 0-10 scale

## OUTPUT FORMAT (JSON)
{
  "oldcarts": {
    "onset": "description",
    "location": "body part(s)",
    "duration": "time description",
    "character": "quality description",
    "aggravating": ["list of factors"],
    "relieving": ["list of factors"],
    "timing": "pattern description",
    "severity": 0-10
  },
  "completeness": 0.0-1.0,
  "missing_elements": ["list of OLDCARTS elements still needed"],
  "next_question": "Suggested question to ask",
  "confidence": 0.0-1.0
}

## RULES
- Ask ONE question at a time
- Use open-ended questions first
- Be empathetic in suggested questions
- Do not assume - only document what patient states`,

  es: `Eres el Recopilador de HPI para el triaje clínico de HELIOS.

## TU TAREA
Recopilar Historia de la Enfermedad Actual completa usando el marco ALICIA:
- Aparición: ¿Cuándo comenzó?
- Localización: ¿Dónde está?
- Intensidad: ¿Qué tan fuerte es? (0-10)
- Carácter: ¿Cómo se siente?
- Irradiación: ¿Se mueve a otra parte?
- Atenuantes: ¿Qué lo mejora?
- Agravantes: ¿Qué lo empeora?

## FORMATO DE SALIDA (JSON)
{
  "oldcarts": {
    "onset": "descripción",
    "location": "parte(s) del cuerpo",
    "duration": "descripción temporal",
    "character": "descripción de calidad",
    "aggravating": ["lista de factores"],
    "relieving": ["lista de factores"],
    "timing": "descripción del patrón",
    "severity": 0-10
  },
  "completeness": 0.0-1.0,
  "missing_elements": ["elementos OLDCARTS faltantes"],
  "next_question": "Pregunta sugerida",
  "confidence": 0.0-1.0
}`,

  fr: `Vous êtes le Collecteur d'HMA pour le triage clinique HELIOS.

## VOTRE TÂCHE
Recueillir l'Histoire de la Maladie Actuelle complète en utilisant PQRST:
- Provoqué/Pallié: Qu'est-ce qui provoque/soulage?
- Qualité: Comment décrivez-vous la sensation?
- Région/Irradiation: Où? Irradiation?
- Sévérité: Intensité (0-10)
- Temps: Quand? Durée? Évolution?

## FORMAT DE SORTIE (JSON)
{
  "oldcarts": {
    "onset": "description",
    "location": "partie(s) du corps",
    "duration": "description temporelle",
    "character": "description de la qualité",
    "aggravating": ["liste des facteurs"],
    "relieving": ["liste des facteurs"],
    "timing": "description du pattern",
    "severity": 0-10
  },
  "completeness": 0.0-1.0,
  "missing_elements": ["éléments manquants"],
  "next_question": "Question suggérée",
  "confidence": 0.0-1.0
}`,
};

export class HPIGathererAgent extends BaseAgent {
  constructor(client: Anthropic) {
    const config: AgentConfig = {
      id: 'hpi_gatherer_001',
      role: 'hpi_gatherer',
      team: 'history',
      name: 'HPI Gatherer',
      description: 'Gathers History of Present Illness using OLDCARTS',
      model: CLAUDE_MODELS.SONNET_4_5,
      maxTokens: 2048,
      temperature: 0.3,
      systemPrompt: '',
      requiredPhases: ['history_taking'],
      priority: 2,
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
        completeness?: number;
        confidence?: number;
        next_question?: string;
      };

      return {
        structuredOutput: parsed,
        confidence: parsed.confidence || 0.8,
        questionsToAsk: parsed.next_question ? [parsed.next_question] : [],
        recommendedPhase: (parsed.completeness || 0) >= 0.8 ? 'triage' : 'history_taking',
      };
    } catch {
      return { confidence: 0.5 };
    }
  }
}
