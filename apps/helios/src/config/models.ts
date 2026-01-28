export const CLAUDE_MODELS = {
  OPUS_4_5: 'claude-opus-4-5-20251101',
  SONNET_4_5: 'claude-sonnet-4-5-20250929',
  HAIKU_4_5: 'claude-haiku-4-5-20251001',
} as const;

export const MODEL_ROUTING = {
  clinical_reasoning: CLAUDE_MODELS.OPUS_4_5,
  differential_diagnosis: CLAUDE_MODELS.OPUS_4_5,
  safety_gate: CLAUDE_MODELS.OPUS_4_5,
  orchestration: CLAUDE_MODELS.SONNET_4_5,
  history_taking: CLAUDE_MODELS.SONNET_4_5,
  documentation: CLAUDE_MODELS.SONNET_4_5,
  triage: CLAUDE_MODELS.SONNET_4_5,
  transcription_refinement: CLAUDE_MODELS.HAIKU_4_5,
  entity_extraction: CLAUDE_MODELS.HAIKU_4_5,
} as const;

export const MODEL_PRICING = {
  [CLAUDE_MODELS.OPUS_4_5]: { input: 5.00, output: 25.00 },
  [CLAUDE_MODELS.SONNET_4_5]: { input: 3.00, output: 15.00 },
  [CLAUDE_MODELS.HAIKU_4_5]: { input: 1.00, output: 5.00 },
} as const;

export function getModelForTask(task: keyof typeof MODEL_ROUTING): string {
  return MODEL_ROUTING[task];
}
