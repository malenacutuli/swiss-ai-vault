/**
 * NIH Stroke Scale (NIHSS)
 * Quantifies stroke severity
 */

import { BaseTool } from '../base.js';
import type { ToolInputSchema, ToolResult } from '../types.js';

interface NIHSSInput {
  consciousness: 0 | 1 | 2 | 3;           // 0-3
  monthYear: 0 | 1 | 2;                    // 0-2
  commands: 0 | 1 | 2;                     // 0-2
  gaze: 0 | 1 | 2;                         // 0-2
  visualFields: 0 | 1 | 2 | 3;             // 0-3
  facialPalsy: 0 | 1 | 2 | 3;              // 0-3
  motorArmLeft: 0 | 1 | 2 | 3 | 4;         // 0-4
  motorArmRight: 0 | 1 | 2 | 3 | 4;        // 0-4
  motorLegLeft: 0 | 1 | 2 | 3 | 4;         // 0-4
  motorLegRight: 0 | 1 | 2 | 3 | 4;        // 0-4
  limbAtaxia: 0 | 1 | 2;                   // 0-2
  sensory: 0 | 1 | 2;                      // 0-2
  language: 0 | 1 | 2 | 3;                 // 0-3
  dysarthria: 0 | 1 | 2;                   // 0-2
  neglect: 0 | 1 | 2;                      // 0-2
}

export class NIHSSTool extends BaseTool {
  id = 'nihss';
  name = 'NIH Stroke Scale';
  category = 'clinical_score' as const;

  description = {
    en: 'NIH Stroke Scale (NIHSS) for quantifying stroke severity',
    es: 'Escala de Ictus del NIH (NIHSS) para cuantificar la gravedad del ictus',
    fr: 'Échelle d\'AVC du NIH (NIHSS) pour quantifier la gravité de l\'AVC',
  };

  inputSchema: ToolInputSchema = {
    required: ['consciousness', 'motorArmLeft', 'motorArmRight', 'motorLegLeft', 'motorLegRight'],
    properties: {
      consciousness: { type: 'number', description: 'Level of consciousness (0-3)', minimum: 0, maximum: 3 },
      monthYear: { type: 'number', description: 'LOC questions (0-2)', minimum: 0, maximum: 2 },
      commands: { type: 'number', description: 'LOC commands (0-2)', minimum: 0, maximum: 2 },
      gaze: { type: 'number', description: 'Best gaze (0-2)', minimum: 0, maximum: 2 },
      visualFields: { type: 'number', description: 'Visual fields (0-3)', minimum: 0, maximum: 3 },
      facialPalsy: { type: 'number', description: 'Facial palsy (0-3)', minimum: 0, maximum: 3 },
      motorArmLeft: { type: 'number', description: 'Motor arm - left (0-4)', minimum: 0, maximum: 4 },
      motorArmRight: { type: 'number', description: 'Motor arm - right (0-4)', minimum: 0, maximum: 4 },
      motorLegLeft: { type: 'number', description: 'Motor leg - left (0-4)', minimum: 0, maximum: 4 },
      motorLegRight: { type: 'number', description: 'Motor leg - right (0-4)', minimum: 0, maximum: 4 },
      limbAtaxia: { type: 'number', description: 'Limb ataxia (0-2)', minimum: 0, maximum: 2 },
      sensory: { type: 'number', description: 'Sensory (0-2)', minimum: 0, maximum: 2 },
      language: { type: 'number', description: 'Best language (0-3)', minimum: 0, maximum: 3 },
      dysarthria: { type: 'number', description: 'Dysarthria (0-2)', minimum: 0, maximum: 2 },
      neglect: { type: 'number', description: 'Extinction/neglect (0-2)', minimum: 0, maximum: 2 },
    },
  };

  citations = [
    'Brott T, et al. Measurements of acute cerebral infarction: a clinical examination scale. Stroke. 1989;20(7):864-870.',
    'Lyden P, et al. Improved reliability of the NIH Stroke Scale using video training. Stroke. 1994;25(11):2220-2226.',
  ];

  async execute(input: unknown): Promise<ToolResult> {
    const data = input as NIHSSInput;

    const score =
      (data.consciousness || 0) +
      (data.monthYear || 0) +
      (data.commands || 0) +
      (data.gaze || 0) +
      (data.visualFields || 0) +
      (data.facialPalsy || 0) +
      (data.motorArmLeft || 0) +
      (data.motorArmRight || 0) +
      (data.motorLegLeft || 0) +
      (data.motorLegRight || 0) +
      (data.limbAtaxia || 0) +
      (data.sensory || 0) +
      (data.language || 0) +
      (data.dysarthria || 0) +
      (data.neglect || 0);

    let category: string;
    let recommendation: Record<string, string>;

    if (score === 0) {
      category = 'no_stroke';
      recommendation = {
        en: 'No stroke symptoms detected. Consider TIA workup if symptoms resolved.',
        es: 'No se detectan síntomas de ictus. Considerar estudio de AIT si los síntomas se resolvieron.',
        fr: 'Pas de symptômes d\'AVC détectés. Envisager bilan AIT si symptômes résolus.',
      };
    } else if (score <= 4) {
      category = 'minor';
      recommendation = {
        en: 'Minor stroke. May be candidate for IV tPA if within window. Neurology consult.',
        es: 'Ictus menor. Puede ser candidato a tPA IV si está dentro de la ventana. Consulta neurología.',
        fr: 'AVC mineur. Peut être candidat au tPA IV si dans la fenêtre. Consultation neurologie.',
      };
    } else if (score <= 15) {
      category = 'moderate';
      recommendation = {
        en: 'Moderate stroke. Strong candidate for thrombolysis/thrombectomy if eligible.',
        es: 'Ictus moderado. Fuerte candidato a trombólisis/trombectomía si es elegible.',
        fr: 'AVC modéré. Fort candidat à thrombolyse/thrombectomie si éligible.',
      };
    } else if (score <= 20) {
      category = 'moderate_severe';
      recommendation = {
        en: 'Moderate to severe stroke. Consider thrombectomy for LVO. ICU admission likely.',
        es: 'Ictus moderado a severo. Considerar trombectomía para OVG. Probable ingreso en UCI.',
        fr: 'AVC modéré à sévère. Envisager thrombectomie pour OAG. Admission USI probable.',
      };
    } else {
      category = 'severe';
      recommendation = {
        en: 'Severe stroke. High mortality risk. Goals of care discussion may be appropriate.',
        es: 'Ictus severo. Alto riesgo de mortalidad. Puede ser apropiada discusión de objetivos de cuidado.',
        fr: 'AVC sévère. Risque de mortalité élevé. Discussion des objectifs de soins peut être appropriée.',
      };
    }

    return this.createResult({
      score,
      category,
      interpretation: {
        en: `NIHSS: ${score}/42 - ${category.replace('_', ' ')} stroke`,
        es: `NIHSS: ${score}/42 - ictus ${category === 'minor' ? 'menor' : category === 'moderate' ? 'moderado' : category === 'severe' ? 'severo' : category}`,
        fr: `NIHSS: ${score}/42 - AVC ${category === 'minor' ? 'mineur' : category === 'moderate' ? 'modéré' : category === 'severe' ? 'sévère' : category}`,
      },
      recommendation,
      warnings: score > 20 ? ['High NIHSS associated with increased mortality and poor functional outcome'] : undefined,
    });
  }
}

export const nihssTool = new NIHSSTool();
