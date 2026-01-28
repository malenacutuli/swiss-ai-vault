/**
 * HEART Score Calculator
 * Risk stratification for chest pain patients
 */

import { BaseTool } from '../base.js';
import type { ToolInputSchema, ToolResult } from '../types.js';

interface HEARTInput {
  // History (0-2)
  historyTypicality: 'highly_suspicious' | 'moderately_suspicious' | 'slightly_suspicious';

  // ECG (0-2)
  ecgFindings: 'significant_st_deviation' | 'nonspecific_changes' | 'normal';

  // Age (0-2)
  age: number;

  // Risk Factors (0-2) - count of: HTN, DM, smoking, obesity, family hx, hyperlipidemia
  riskFactorCount: number;

  // Troponin (0-2)
  troponin: 'elevated_3x' | 'elevated_1_3x' | 'normal';
}

export class HEARTScoreTool extends BaseTool {
  id = 'heart_score';
  name = 'HEART Score';
  category = 'risk_calculator' as const;

  description = {
    en: 'HEART Score for Major Adverse Cardiac Events (MACE) risk in chest pain patients',
    es: 'Puntuación HEART para riesgo de eventos cardíacos adversos mayores en pacientes con dolor torácico',
    fr: 'Score HEART pour le risque d\'événements cardiaques majeurs chez les patients avec douleur thoracique',
  };

  inputSchema: ToolInputSchema = {
    required: ['historyTypicality', 'ecgFindings', 'age', 'riskFactorCount', 'troponin'],
    properties: {
      historyTypicality: {
        type: 'string',
        description: 'How typical is the chest pain for ACS?',
        enum: ['highly_suspicious', 'moderately_suspicious', 'slightly_suspicious'],
      },
      ecgFindings: {
        type: 'string',
        description: 'ECG findings',
        enum: ['significant_st_deviation', 'nonspecific_changes', 'normal'],
      },
      age: {
        type: 'number',
        description: 'Patient age in years',
        minimum: 18,
        maximum: 120,
      },
      riskFactorCount: {
        type: 'number',
        description: 'Number of risk factors (HTN, DM, smoking, obesity, family hx, hyperlipidemia)',
        minimum: 0,
        maximum: 6,
      },
      troponin: {
        type: 'string',
        description: 'Troponin level',
        enum: ['elevated_3x', 'elevated_1_3x', 'normal'],
      },
    },
  };

  citations = [
    'Six AJ, et al. Chest pain in the emergency room: value of the HEART score. Neth Heart J. 2008;16(6):191-196.',
    'Backus BE, et al. A prospective validation of the HEART score for chest pain patients at the emergency department. Int J Cardiol. 2013;168(3):2153-2158.',
  ];

  async execute(input: unknown): Promise<ToolResult> {
    const validation = this.validate(input);
    if (!validation.valid) {
      return this.createResult({
        success: false,
        interpretation: {
          en: `Validation failed: ${validation.errors.join(', ')}`,
          es: `Validación fallida: ${validation.errors.join(', ')}`,
          fr: `Validation échouée: ${validation.errors.join(', ')}`,
        },
      });
    }

    const data = input as HEARTInput;
    let score = 0;

    // History (0-2)
    score += data.historyTypicality === 'highly_suspicious' ? 2 :
             data.historyTypicality === 'moderately_suspicious' ? 1 : 0;

    // ECG (0-2)
    score += data.ecgFindings === 'significant_st_deviation' ? 2 :
             data.ecgFindings === 'nonspecific_changes' ? 1 : 0;

    // Age (0-2)
    score += data.age >= 65 ? 2 : data.age >= 45 ? 1 : 0;

    // Risk Factors (0-2)
    score += data.riskFactorCount >= 3 ? 2 : data.riskFactorCount >= 1 ? 1 : 0;

    // Troponin (0-2)
    score += data.troponin === 'elevated_3x' ? 2 :
             data.troponin === 'elevated_1_3x' ? 1 : 0;

    // Risk category
    let category: string;
    let risk: number;
    let recommendation: Record<string, string>;

    if (score <= 3) {
      category = 'low';
      risk = 0.016;  // 1.6% MACE risk
      recommendation = {
        en: 'Low risk. Consider discharge with outpatient follow-up if clinically appropriate.',
        es: 'Bajo riesgo. Considerar alta con seguimiento ambulatorio si clínicamente apropiado.',
        fr: 'Risque faible. Envisager la sortie avec suivi ambulatoire si cliniquement approprié.',
      };
    } else if (score <= 6) {
      category = 'moderate';
      risk = 0.121;  // 12.1% MACE risk
      recommendation = {
        en: 'Moderate risk. Consider observation, serial troponins, and cardiology consultation.',
        es: 'Riesgo moderado. Considerar observación, troponinas seriadas y consulta de cardiología.',
        fr: 'Risque modéré. Envisager observation, troponines sériées et consultation cardiologique.',
      };
    } else {
      category = 'high';
      risk = 0.505;  // 50.5% MACE risk
      recommendation = {
        en: 'High risk. Recommend admission, urgent cardiology consultation, and ACS workup.',
        es: 'Alto riesgo. Recomendar admisión, consulta urgente de cardiología y estudio de SCA.',
        fr: 'Risque élevé. Recommander admission, consultation cardiologique urgente et bilan SCA.',
      };
    }

    return this.createResult({
      score,
      risk,
      category,
      interpretation: {
        en: `HEART Score: ${score}/10 (${category} risk). 6-week MACE risk: ${(risk * 100).toFixed(1)}%`,
        es: `Puntuación HEART: ${score}/10 (riesgo ${category === 'low' ? 'bajo' : category === 'moderate' ? 'moderado' : 'alto'}). Riesgo MACE 6 semanas: ${(risk * 100).toFixed(1)}%`,
        fr: `Score HEART: ${score}/10 (risque ${category === 'low' ? 'faible' : category === 'moderate' ? 'modéré' : 'élevé'}). Risque MACE 6 semaines: ${(risk * 100).toFixed(1)}%`,
      },
      recommendation,
      rawOutput: {
        score,
        category,
        maceRisk6Week: risk,
        components: {
          history: data.historyTypicality,
          ecg: data.ecgFindings,
          age: data.age,
          riskFactors: data.riskFactorCount,
          troponin: data.troponin,
        },
      },
    });
  }
}

export const heartScoreTool = new HEARTScoreTool();
