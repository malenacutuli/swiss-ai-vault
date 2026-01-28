/**
 * Wells Score for DVT
 * Pre-test probability for deep vein thrombosis
 */

import { BaseTool } from '../base.js';
import type { ToolInputSchema, ToolResult } from '../types.js';

interface WellsDVTInput {
  activeCancer: boolean;
  paralysisParesis: boolean;
  bedridden3Days: boolean;
  localizedTenderness: boolean;
  entireLegSwollen: boolean;
  calfSwelling3cm: boolean;
  pittingEdema: boolean;
  collateralVeins: boolean;
  previousDVT: boolean;
  alternativeDiagnosisLikely: boolean;
}

export class WellsDVTTool extends BaseTool {
  id = 'wells_dvt';
  name = 'Wells Score for DVT';
  category = 'risk_calculator' as const;

  description = {
    en: 'Wells Score for Deep Vein Thrombosis (DVT) pre-test probability',
    es: 'Puntuación de Wells para probabilidad pre-test de trombosis venosa profunda',
    fr: 'Score de Wells pour la probabilité pré-test de thrombose veineuse profonde',
  };

  inputSchema: ToolInputSchema = {
    required: [],
    properties: {
      activeCancer: { type: 'boolean', description: 'Active cancer (treatment within 6 months or palliative)' },
      paralysisParesis: { type: 'boolean', description: 'Paralysis, paresis, or recent plaster immobilization' },
      bedridden3Days: { type: 'boolean', description: 'Bedridden >3 days or major surgery within 12 weeks' },
      localizedTenderness: { type: 'boolean', description: 'Localized tenderness along deep venous system' },
      entireLegSwollen: { type: 'boolean', description: 'Entire leg swollen' },
      calfSwelling3cm: { type: 'boolean', description: 'Calf swelling >3cm compared to other leg' },
      pittingEdema: { type: 'boolean', description: 'Pitting edema confined to symptomatic leg' },
      collateralVeins: { type: 'boolean', description: 'Collateral superficial veins (non-varicose)' },
      previousDVT: { type: 'boolean', description: 'Previously documented DVT' },
      alternativeDiagnosisLikely: { type: 'boolean', description: 'Alternative diagnosis as likely or more likely (-2 points)' },
    },
  };

  citations = [
    'Wells PS, et al. Value of assessment of pretest probability of deep-vein thrombosis in clinical management. Lancet. 1997;350(9094):1795-1798.',
    'Wells PS, et al. Evaluation of D-dimer in the diagnosis of suspected deep-vein thrombosis. N Engl J Med. 2003;349(13):1227-1235.',
  ];

  async execute(input: unknown): Promise<ToolResult> {
    const data = input as WellsDVTInput;
    let score = 0;

    // Each criterion is +1 except alternative diagnosis which is -2
    if (data.activeCancer) score += 1;
    if (data.paralysisParesis) score += 1;
    if (data.bedridden3Days) score += 1;
    if (data.localizedTenderness) score += 1;
    if (data.entireLegSwollen) score += 1;
    if (data.calfSwelling3cm) score += 1;
    if (data.pittingEdema) score += 1;
    if (data.collateralVeins) score += 1;
    if (data.previousDVT) score += 1;
    if (data.alternativeDiagnosisLikely) score -= 2;

    // Risk stratification
    let category: string;
    let risk: number;
    let recommendation: Record<string, string>;

    if (score <= 0) {
      category = 'low';
      risk = 0.05;
      recommendation = {
        en: 'Low probability. D-dimer testing recommended. If negative, DVT unlikely.',
        es: 'Baja probabilidad. Se recomienda dímero D. Si negativo, TVP improbable.',
        fr: 'Faible probabilité. Dosage D-dimères recommandé. Si négatif, TVP improbable.',
      };
    } else if (score <= 2) {
      category = 'moderate';
      risk = 0.17;
      recommendation = {
        en: 'Moderate probability. D-dimer testing recommended. If elevated, ultrasound indicated.',
        es: 'Probabilidad moderada. Se recomienda dímero D. Si elevado, ecografía indicada.',
        fr: 'Probabilité modérée. Dosage D-dimères recommandé. Si élevé, échographie indiquée.',
      };
    } else {
      category = 'high';
      risk = 0.53;
      recommendation = {
        en: 'High probability. Compression ultrasound recommended regardless of D-dimer.',
        es: 'Alta probabilidad. Ecografía de compresión recomendada independientemente del dímero D.',
        fr: 'Forte probabilité. Échographie de compression recommandée indépendamment des D-dimères.',
      };
    }

    return this.createResult({
      score,
      risk,
      category,
      interpretation: {
        en: `Wells DVT Score: ${score} (${category} probability). Pre-test probability: ${(risk * 100).toFixed(0)}%`,
        es: `Puntuación Wells TVP: ${score} (probabilidad ${category === 'low' ? 'baja' : category === 'moderate' ? 'moderada' : 'alta'}). Probabilidad pre-test: ${(risk * 100).toFixed(0)}%`,
        fr: `Score Wells TVP: ${score} (probabilité ${category === 'low' ? 'faible' : category === 'moderate' ? 'modérée' : 'élevée'}). Probabilité pré-test: ${(risk * 100).toFixed(0)}%`,
      },
      recommendation,
    });
  }
}

export const wellsDVTTool = new WellsDVTTool();
