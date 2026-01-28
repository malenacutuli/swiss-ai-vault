/**
 * qSOFA Score
 * Quick Sepsis-related Organ Failure Assessment
 */

import { BaseTool } from '../base.js';
import type { ToolInputSchema, ToolResult } from '../types.js';

interface qSOFAInput {
  alteredMentalStatus: boolean;  // GCS < 15
  respiratoryRate: number;       // >= 22
  systolicBP: number;            // <= 100
}

export class qSOFATool extends BaseTool {
  id = 'qsofa';
  name = 'qSOFA Score';
  category = 'risk_calculator' as const;

  description = {
    en: 'Quick SOFA (qSOFA) for sepsis screening outside ICU',
    es: 'SOFA rápido (qSOFA) para cribado de sepsis fuera de UCI',
    fr: 'SOFA rapide (qSOFA) pour dépistage de sepsis hors réanimation',
  };

  inputSchema: ToolInputSchema = {
    required: ['alteredMentalStatus', 'respiratoryRate', 'systolicBP'],
    properties: {
      alteredMentalStatus: { type: 'boolean', description: 'Altered mental status (GCS < 15)' },
      respiratoryRate: { type: 'number', description: 'Respiratory rate', minimum: 0 },
      systolicBP: { type: 'number', description: 'Systolic blood pressure', minimum: 0 },
    },
  };

  citations = [
    'Seymour CW, et al. Assessment of Clinical Criteria for Sepsis: For the Third International Consensus Definitions for Sepsis and Septic Shock (Sepsis-3). JAMA. 2016;315(8):762-774.',
  ];

  async execute(input: unknown): Promise<ToolResult> {
    const data = input as qSOFAInput;
    let score = 0;

    if (data.alteredMentalStatus) score += 1;
    if (data.respiratoryRate >= 22) score += 1;
    if (data.systolicBP <= 100) score += 1;

    const positive = score >= 2;

    return this.createResult({
      score,
      category: positive ? 'positive' : 'negative',
      interpretation: {
        en: `qSOFA: ${score}/3. ${positive ? 'POSITIVE - High risk for poor outcome' : 'Negative - Lower risk'}`,
        es: `qSOFA: ${score}/3. ${positive ? 'POSITIVO - Alto riesgo de mal pronóstico' : 'Negativo - Menor riesgo'}`,
        fr: `qSOFA: ${score}/3. ${positive ? 'POSITIF - Risque élevé de mauvais pronostic' : 'Négatif - Risque moindre'}`,
      },
      recommendation: {
        en: positive
          ? 'qSOFA ≥2 suggests high risk for poor outcome. Assess for organ dysfunction, consider ICU, and initiate sepsis bundle if infection suspected.'
          : 'qSOFA <2 does not rule out sepsis. Continue clinical assessment. Full SOFA score if concern persists.',
        es: positive
          ? 'qSOFA ≥2 sugiere alto riesgo de mal pronóstico. Evaluar disfunción orgánica, considerar UCI, iniciar bundle de sepsis si se sospecha infección.'
          : 'qSOFA <2 no descarta sepsis. Continuar evaluación clínica. SOFA completo si persiste preocupación.',
        fr: positive
          ? 'qSOFA ≥2 suggère risque élevé de mauvais pronostic. Évaluer dysfonction organique, envisager USI, initier bundle sepsis si infection suspectée.'
          : 'qSOFA <2 n\'exclut pas sepsis. Poursuivre évaluation clinique. Score SOFA complet si inquiétude persiste.',
      },
      warnings: positive ? ['qSOFA ≥2 associated with 3-14x higher mortality'] : undefined,
    });
  }
}

export const qsofaTool = new qSOFATool();
