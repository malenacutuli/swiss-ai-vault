/**
 * Pediatric Assessment Triangle (PAT)
 * Rapid visual assessment of pediatric patients
 */

import { BaseTool } from '../base.js';
import type { ToolInputSchema, ToolResult } from '../types.js';

interface PATInput {
  // Appearance (TICLS)
  tone: 'normal' | 'abnormal';
  interactiveness: 'normal' | 'abnormal';
  consolability: 'normal' | 'abnormal';
  lookGaze: 'normal' | 'abnormal';
  speechCry: 'normal' | 'abnormal';

  // Work of Breathing
  breathingEffort: 'normal' | 'increased' | 'decreased_absent';

  // Circulation
  skinColor: 'normal' | 'pale' | 'mottled' | 'cyanotic';
}

export class PATTool extends BaseTool {
  id = 'pat';
  name = 'Pediatric Assessment Triangle';
  category = 'clinical_score' as const;

  description = {
    en: 'Pediatric Assessment Triangle (PAT) for rapid visual assessment',
    es: 'Triángulo de Evaluación Pediátrica (TEP) para evaluación visual rápida',
    fr: 'Triangle d\'Évaluation Pédiatrique (TEP) pour évaluation visuelle rapide',
  };

  inputSchema: ToolInputSchema = {
    required: ['tone', 'breathingEffort', 'skinColor'],
    properties: {
      tone: { type: 'string', description: 'Muscle tone', enum: ['normal', 'abnormal'] },
      interactiveness: { type: 'string', description: 'Interactiveness', enum: ['normal', 'abnormal'] },
      consolability: { type: 'string', description: 'Consolability', enum: ['normal', 'abnormal'] },
      lookGaze: { type: 'string', description: 'Look/gaze', enum: ['normal', 'abnormal'] },
      speechCry: { type: 'string', description: 'Speech/cry', enum: ['normal', 'abnormal'] },
      breathingEffort: { type: 'string', description: 'Work of breathing', enum: ['normal', 'increased', 'decreased_absent'] },
      skinColor: { type: 'string', description: 'Skin circulation', enum: ['normal', 'pale', 'mottled', 'cyanotic'] },
    },
  };

  citations = [
    'Dieckmann RA, et al. Pediatric Assessment Triangle. Pediatr Emerg Care. 2010;26(4):312-315.',
  ];

  async execute(input: unknown): Promise<ToolResult> {
    const data = input as PATInput;

    // Calculate appearance abnormality
    const ticls = [data.tone, data.interactiveness, data.consolability, data.lookGaze, data.speechCry];
    const appearanceAbnormal = ticls.filter(t => t === 'abnormal').length >= 2;

    // Work of breathing
    const workBreathingAbnormal = data.breathingEffort !== 'normal';

    // Circulation
    const circulationAbnormal = data.skinColor !== 'normal';

    // Determine category based on PAT components
    let category: string;
    let urgency: string;

    if (!appearanceAbnormal && !workBreathingAbnormal && !circulationAbnormal) {
      category = 'stable';
      urgency = 'routine';
    } else if (!appearanceAbnormal && workBreathingAbnormal && !circulationAbnormal) {
      category = 'respiratory_distress';
      urgency = 'urgent';
    } else if (appearanceAbnormal && workBreathingAbnormal && !circulationAbnormal) {
      category = 'respiratory_failure';
      urgency = 'emergent';
    } else if (!appearanceAbnormal && !workBreathingAbnormal && circulationAbnormal) {
      category = 'compensated_shock';
      urgency = 'urgent';
    } else if (appearanceAbnormal && !workBreathingAbnormal && circulationAbnormal) {
      category = 'decompensated_shock';
      urgency = 'emergent';
    } else if (appearanceAbnormal && !workBreathingAbnormal && !circulationAbnormal) {
      category = 'cns_metabolic';
      urgency = 'urgent';
    } else {
      category = 'cardiopulmonary_failure';
      urgency = 'immediate';
    }

    const recommendations: Record<string, Record<string, string>> = {
      stable: {
        en: 'Child appears stable. Proceed with standard evaluation.',
        es: 'El niño parece estable. Proceder con evaluación estándar.',
        fr: 'L\'enfant semble stable. Procéder à l\'évaluation standard.',
      },
      respiratory_distress: {
        en: 'Respiratory distress present. Provide oxygen, consider nebulizer, prepare for escalation.',
        es: 'Dificultad respiratoria presente. Proporcionar oxígeno, considerar nebulizador, preparar para escalación.',
        fr: 'Détresse respiratoire présente. Fournir oxygène, envisager nébulisation, préparer escalade.',
      },
      respiratory_failure: {
        en: 'RESPIRATORY FAILURE. Immediate intervention needed. Prepare for airway management.',
        es: 'FALLO RESPIRATORIO. Intervención inmediata necesaria. Preparar manejo de vía aérea.',
        fr: 'INSUFFISANCE RESPIRATOIRE. Intervention immédiate nécessaire. Préparer gestion voies aériennes.',
      },
      compensated_shock: {
        en: 'Compensated shock. IV access, fluid bolus consideration, monitor closely.',
        es: 'Shock compensado. Acceso IV, considerar bolo de fluidos, monitorear de cerca.',
        fr: 'Choc compensé. Accès IV, envisager bolus liquidien, surveiller étroitement.',
      },
      decompensated_shock: {
        en: 'DECOMPENSATED SHOCK. Immediate IV/IO access, fluid resuscitation, vasopressors may be needed.',
        es: 'SHOCK DESCOMPENSADO. Acceso IV/IO inmediato, resucitación con fluidos, pueden necesitarse vasopresores.',
        fr: 'CHOC DÉCOMPENSÉ. Accès IV/IO immédiat, réanimation liquidienne, vasopresseurs peuvent être nécessaires.',
      },
      cns_metabolic: {
        en: 'CNS/Metabolic dysfunction suspected. Check glucose, consider toxicologic/neurologic causes.',
        es: 'Disfunción SNC/metabólica sospechada. Verificar glucosa, considerar causas toxicológicas/neurológicas.',
        fr: 'Dysfonction SNC/métabolique suspectée. Vérifier glycémie, envisager causes toxicologiques/neurologiques.',
      },
      cardiopulmonary_failure: {
        en: 'CARDIOPULMONARY FAILURE. Begin resuscitation. Call code team.',
        es: 'FALLO CARDIOPULMONAR. Iniciar resucitación. Llamar equipo de código.',
        fr: 'INSUFFISANCE CARDIOPULMONAIRE. Commencer réanimation. Appeler équipe de réanimation.',
      },
    };

    return this.createResult({
      category,
      interpretation: {
        en: `PAT Assessment: ${category.replace(/_/g, ' ').toUpperCase()}`,
        es: `Evaluación TEP: ${category.replace(/_/g, ' ').toUpperCase()}`,
        fr: `Évaluation TEP: ${category.replace(/_/g, ' ').toUpperCase()}`,
      },
      recommendation: recommendations[category] || recommendations.stable,
      rawOutput: {
        appearance: appearanceAbnormal ? 'abnormal' : 'normal',
        workOfBreathing: workBreathingAbnormal ? 'abnormal' : 'normal',
        circulation: circulationAbnormal ? 'abnormal' : 'normal',
        urgency,
      },
      warnings: urgency === 'immediate' || urgency === 'emergent'
        ? ['CRITICAL: Immediate intervention required']
        : undefined,
    });
  }
}

export const patTool = new PATTool();
