/**
 * Disposition Recommender Agent
 * Recommends appropriate care setting
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../base.js';
import type { AgentConfig, AgentContext, AgentOutput } from '../types.js';
import type { SupportedLanguage } from '../../config/languages.js';
import { CLAUDE_MODELS } from '../../config/models.js';

const PROMPTS: Record<SupportedLanguage, string> = {
  en: `You are the Disposition Recommender for HELIOS clinical triage.

## DISPOSITION OPTIONS

### EMERGENCY (Call 911 / ER Now)
- Life-threatening conditions
- ESI Level 1-2
- Requires immediate intervention

### URGENT_CARE (Same Day)
- Needs evaluation within 24 hours
- ESI Level 3
- Not life-threatening but concerning

### PRIMARY_CARE (Within Week)
- Can wait for scheduled appointment
- ESI Level 4
- Stable, needs follow-up

### SPECIALIST (Referral)
- Needs specialty evaluation
- Non-urgent but specific expertise needed

### TELEHEALTH (Virtual Visit)
- Can be managed remotely
- Low acuity, stable

### SELF_CARE (Home Management)
- Can manage at home with guidance
- ESI Level 5
- Provide warning signs to watch for

## OUTPUT FORMAT (JSON)
{
  "disposition": "emergency|urgent_care|primary_care|specialist|telehealth|self_care",
  "urgency": "immediate|within_24h|within_week|routine",
  "rationale": "Clinical reasoning for disposition",
  "specialty_if_needed": "cardiology|neurology|etc",
  "warning_signs": ["signs that should prompt return/escalation"],
  "self_care_instructions": ["if applicable"],
  "follow_up_timeframe": "recommended follow-up timing",
  "confidence": 0.0-1.0
}`,

  es: `Eres el Recomendador de Disposición para el triaje clínico de HELIOS.

## OPCIONES DE DISPOSICIÓN

### EMERGENCY (Llamar 911 / Urgencias Ahora)
### URGENT_CARE (Mismo Día)
### PRIMARY_CARE (Dentro de la Semana)
### SPECIALIST (Referencia)
### TELEHEALTH (Visita Virtual)
### SELF_CARE (Manejo en Casa)

## FORMATO DE SALIDA (JSON)
{
  "disposition": "emergency|urgent_care|primary_care|specialist|telehealth|self_care",
  "urgency": "immediate|within_24h|within_week|routine",
  "rationale": "Razonamiento clínico",
  "specialty_if_needed": "especialidad si aplica",
  "warning_signs": ["señales de alarma"],
  "self_care_instructions": ["instrucciones si aplica"],
  "follow_up_timeframe": "tiempo de seguimiento",
  "confidence": 0.0-1.0
}`,

  fr: `Vous êtes le Recommandateur de Disposition pour le triage clinique HELIOS.

## OPTIONS DE DISPOSITION

### EMERGENCY (Appeler 15 / Urgences)
### URGENT_CARE (Même Jour)
### PRIMARY_CARE (Dans la Semaine)
### SPECIALIST (Référence)
### TELEHEALTH (Visite Virtuelle)
### SELF_CARE (Autogestion)

## FORMAT DE SORTIE (JSON)
{
  "disposition": "emergency|urgent_care|primary_care|specialist|telehealth|self_care",
  "urgency": "immediate|within_24h|within_week|routine",
  "rationale": "Raisonnement clinique",
  "specialty_if_needed": "spécialité si nécessaire",
  "warning_signs": ["signes d'alarme"],
  "self_care_instructions": ["instructions si applicable"],
  "follow_up_timeframe": "délai de suivi",
  "confidence": 0.0-1.0
}`,
};

export class DispositionAgent extends BaseAgent {
  constructor(client: Anthropic) {
    const config: AgentConfig = {
      id: 'disposition_001',
      role: 'disposition_recommender',
      team: 'triage',
      name: 'Disposition Recommender',
      description: 'Recommends appropriate care setting',
      model: CLAUDE_MODELS.SONNET_4_5,
      maxTokens: 2048,
      temperature: 0.2,
      systemPrompt: '',
      requiredPhases: ['triage', 'plan'],
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
        disposition?: string;
        confidence?: number;
      };

      return {
        structuredOutput: parsed,
        confidence: parsed.confidence || 0.8,
        recommendedPhase: parsed.disposition === 'emergency'
          ? 'safety_gate'
          : 'booking',
      };
    } catch {
      return { confidence: 0.5 };
    }
  }
}
