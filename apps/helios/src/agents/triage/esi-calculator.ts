/**
 * ESI Calculator Agent
 * Calculates Emergency Severity Index (1-5)
 */

import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from '../base.js';
import type { AgentConfig, AgentContext, AgentOutput } from '../types.js';
import type { SupportedLanguage } from '../../config/languages.js';
import { CLAUDE_MODELS } from '../../config/models.js';

const PROMPTS: Record<SupportedLanguage, string> = {
  en: `You are the ESI Calculator for HELIOS clinical triage.

## EMERGENCY SEVERITY INDEX (ESI) ALGORITHM

### Level 1 - IMMEDIATE (Resuscitation)
- Requires immediate life-saving intervention
- Examples: cardiac arrest, respiratory failure, severe trauma

### Level 2 - EMERGENT (High Risk)
- Should not wait to be seen
- High-risk situation OR confused/lethargic/disoriented
- Severe pain/distress (≥7/10)
- Examples: chest pain with cardiac features, stroke symptoms, severe asthma

### Level 3 - URGENT (Stable, Multiple Resources)
- Stable but needs 2+ resources
- Resources: labs, imaging, IV fluids, procedures, specialty consult

### Level 4 - LESS URGENT (One Resource)
- Stable, needs only 1 resource
- Examples: simple laceration, UTI symptoms, minor sprain

### Level 5 - NON-URGENT (No Resources)
- Stable, needs only examination
- Examples: minor cold, medication refill, minor rash

## OUTPUT FORMAT (JSON)
{
  "esi_level": 1-5,
  "esi_rationale": "Step-by-step reasoning",
  "life_threatening": true/false,
  "high_risk_features": ["list of concerning features"],
  "resources_needed": ["list of anticipated resources"],
  "resource_count": 0-5,
  "time_sensitivity": "immediate|within_1h|within_4h|within_24h|routine",
  "confidence": 0.0-1.0
}

## CRITICAL RULES
- When in doubt, assign HIGHER acuity (lower number)
- Any vital sign abnormality = at least ESI-3
- Pain ≥7/10 = at least ESI-2
- Mental status changes = ESI-2
- Immunocompromised + fever = ESI-2`,

  es: `Eres el Calculador de ESI para el triaje clínico de HELIOS.

## ALGORITMO DEL ÍNDICE DE SEVERIDAD DE EMERGENCIA (ESI)

### Nivel 1 - INMEDIATO (Resucitación)
- Requiere intervención salvavidas inmediata
- Ejemplos: paro cardíaco, insuficiencia respiratoria, trauma severo

### Nivel 2 - EMERGENTE (Alto Riesgo)
- No debe esperar para ser atendido
- Situación de alto riesgo O confuso/letárgico/desorientado
- Dolor/angustia severa (≥7/10)

### Nivel 3 - URGENTE (Estable, Múltiples Recursos)
- Estable pero necesita 2+ recursos

### Nivel 4 - MENOS URGENTE (Un Recurso)
- Estable, necesita solo 1 recurso

### Nivel 5 - NO URGENTE (Sin Recursos)
- Estable, solo necesita examen

## FORMATO DE SALIDA (JSON)
{
  "esi_level": 1-5,
  "esi_rationale": "Razonamiento paso a paso",
  "life_threatening": true/false,
  "high_risk_features": ["características preocupantes"],
  "resources_needed": ["recursos anticipados"],
  "resource_count": 0-5,
  "time_sensitivity": "immediate|within_1h|within_4h|within_24h|routine",
  "confidence": 0.0-1.0
}`,

  fr: `Vous êtes le Calculateur d'ESI pour le triage clinique HELIOS.

## ALGORITHME DE L'INDICE DE GRAVITÉ D'URGENCE (ESI)

### Niveau 1 - IMMÉDIAT (Réanimation)
- Nécessite une intervention vitale immédiate

### Niveau 2 - ÉMERGENT (Haut Risque)
- Ne doit pas attendre
- Situation à haut risque OU confus/léthargique

### Niveau 3 - URGENT (Stable, Ressources Multiples)
- Stable mais nécessite 2+ ressources

### Niveau 4 - MOINS URGENT (Une Ressource)
- Stable, nécessite 1 ressource

### Niveau 5 - NON URGENT (Aucune Ressource)
- Stable, examen seulement

## FORMAT DE SORTIE (JSON)
{
  "esi_level": 1-5,
  "esi_rationale": "Raisonnement étape par étape",
  "life_threatening": true/false,
  "high_risk_features": ["caractéristiques préoccupantes"],
  "resources_needed": ["ressources anticipées"],
  "resource_count": 0-5,
  "time_sensitivity": "immediate|within_1h|within_4h|within_24h|routine",
  "confidence": 0.0-1.0
}`,
};

export class ESICalculatorAgent extends BaseAgent {
  constructor(client: Anthropic) {
    const config: AgentConfig = {
      id: 'esi_calc_001',
      role: 'esi_calculator',
      team: 'triage',
      name: 'ESI Calculator',
      description: 'Calculates Emergency Severity Index',
      model: CLAUDE_MODELS.SONNET_4_5,
      maxTokens: 2048,
      temperature: 0.2,
      systemPrompt: '',
      requiredPhases: ['triage'],
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
        esi_level?: number;
        life_threatening?: boolean;
        confidence?: number;
      };

      // Map ESI level to triage level
      const esiToTriage: Record<number, string> = {
        1: 'ESI1',
        2: 'ESI2',
        3: 'ESI3',
        4: 'ESI4',
        5: 'ESI5',
      };

      return {
        structuredOutput: {
          ...parsed,
          triage_level: esiToTriage[parsed.esi_level || 3] || 'ESI3',
        },
        confidence: parsed.confidence || 0.8,
        recommendedPhase: (parsed.esi_level || 3) <= 2 ? 'safety_gate' : 'differential',
        recommendedActions: parsed.life_threatening
          ? ['Immediate escalation required']
          : [],
      };
    } catch {
      return { confidence: 0.5 };
    }
  }
}
