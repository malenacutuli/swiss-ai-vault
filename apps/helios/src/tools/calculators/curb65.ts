/**
 * CURB-65 Score
 * Pneumonia severity assessment
 */

import { BaseTool } from '../base.js';
import type { ToolInputSchema, ToolResult } from '../types.js';

interface CURB65Input {
  confusion: boolean;
  bun: number;  // mg/dL (>19 = +1)
  respiratoryRate: number;  // >=30 = +1
  systolicBP: number;
  diastolicBP: number;
  age: number;  // >=65 = +1
}

export class CURB65Tool extends BaseTool {
  id = 'curb65';
  name = 'CURB-65 Score';
  category = 'risk_calculator' as const;

  description = {
    en: 'CURB-65 Score for community-acquired pneumonia severity',
    es: 'Puntuación CURB-65 para gravedad de neumonía adquirida en la comunidad',
    fr: 'Score CURB-65 pour la gravité de la pneumonie communautaire',
  };

  inputSchema: ToolInputSchema = {
    required: ['confusion', 'respiratoryRate', 'systolicBP', 'age'],
    properties: {
      confusion: { type: 'boolean', description: 'New confusion or altered mental status' },
      bun: { type: 'number', description: 'Blood urea nitrogen (mg/dL)', minimum: 0 },
      respiratoryRate: { type: 'number', description: 'Respiratory rate (breaths/min)', minimum: 0 },
      systolicBP: { type: 'number', description: 'Systolic blood pressure (mmHg)', minimum: 0 },
      diastolicBP: { type: 'number', description: 'Diastolic blood pressure (mmHg)', minimum: 0 },
      age: { type: 'number', description: 'Age in years', minimum: 0 },
    },
  };

  citations = [
    'Lim WS, et al. Defining community acquired pneumonia severity on presentation to hospital: an international derivation and validation study. Thorax. 2003;58(5):377-382.',
  ];

  async execute(input: unknown): Promise<ToolResult> {
    const data = input as CURB65Input;
    let score = 0;

    // C - Confusion
    if (data.confusion) score += 1;

    // U - Urea (BUN) > 19 mg/dL (or >7 mmol/L)
    if (data.bun && data.bun > 19) score += 1;

    // R - Respiratory rate >= 30
    if (data.respiratoryRate >= 30) score += 1;

    // B - Blood pressure (SBP < 90 or DBP <= 60)
    if (data.systolicBP < 90 || (data.diastolicBP && data.diastolicBP <= 60)) score += 1;

    // 65 - Age >= 65
    if (data.age >= 65) score += 1;

    let category: string;
    let mortality: number;
    let recommendation: Record<string, string>;

    if (score <= 1) {
      category = 'low';
      mortality = 0.015;
      recommendation = {
        en: 'Low severity. Consider outpatient treatment if no other concerning factors.',
        es: 'Baja gravedad. Considerar tratamiento ambulatorio si no hay otros factores preocupantes.',
        fr: 'Faible gravité. Envisager traitement ambulatoire si pas d\'autres facteurs préoccupants.',
      };
    } else if (score === 2) {
      category = 'moderate';
      mortality = 0.092;
      recommendation = {
        en: 'Moderate severity. Consider short inpatient hospitalization or close outpatient follow-up.',
        es: 'Gravedad moderada. Considerar hospitalización corta o seguimiento ambulatorio cercano.',
        fr: 'Gravité modérée. Envisager hospitalisation courte ou suivi ambulatoire rapproché.',
      };
    } else {
      category = 'severe';
      mortality = score === 3 ? 0.22 : score === 4 ? 0.33 : 0.575;
      recommendation = {
        en: 'Severe pneumonia. Hospital admission recommended. Consider ICU if score 4-5.',
        es: 'Neumonía severa. Se recomienda ingreso hospitalario. Considerar UCI si puntuación 4-5.',
        fr: 'Pneumonie sévère. Hospitalisation recommandée. Envisager USI si score 4-5.',
      };
    }

    return this.createResult({
      score,
      risk: mortality,
      category,
      interpretation: {
        en: `CURB-65: ${score}/5. 30-day mortality: ${(mortality * 100).toFixed(1)}%`,
        es: `CURB-65: ${score}/5. Mortalidad a 30 días: ${(mortality * 100).toFixed(1)}%`,
        fr: `CURB-65: ${score}/5. Mortalité à 30 jours: ${(mortality * 100).toFixed(1)}%`,
      },
      recommendation,
    });
  }
}

export const curb65Tool = new CURB65Tool();
