// Gemini TTS Voice Configuration
// 30 voices across 8 categories

export const GEMINI_VOICES: Record<string, string[]> = {
  professional: ['Puck', 'Charon', 'Fenrir', 'Orus'],
  friendly: ['Kore', 'Aoede', 'Leda', 'Zephyr'],
  neutral: ['Schedar', 'Gacrux', 'Pulcherrima', 'Vindemiatrix'],
  expressive: ['Achernar', 'Rasalhague', 'Sadachbia', 'Sadaltager'],
  warm: ['Sulafat', 'Algieba', 'Vega', 'Sheliak'],
  authoritative: ['Achird', 'Zubenelgenubi', 'Zubeneschamali', 'Algenib'],
  youthful: ['Alsephina', 'Despina', 'Erinome', 'Alula'],
  broadcast: ['Umbriel', 'Enceladus'],
};

export const VOICE_CATEGORIES = [
  { key: 'professional', label: 'Professional', description: 'Firm, informative' },
  { key: 'friendly', label: 'Friendly', description: 'Warm, approachable' },
  { key: 'neutral', label: 'Neutral', description: 'Clear, balanced' },
  { key: 'expressive', label: 'Expressive', description: 'Dynamic, engaging' },
  { key: 'warm', label: 'Warm', description: 'Comforting, gentle' },
  { key: 'authoritative', label: 'Authoritative', description: 'Confident, commanding' },
  { key: 'youthful', label: 'Youthful', description: 'Energetic, fresh' },
  { key: 'broadcast', label: 'Broadcast', description: 'News anchor style' },
] as const;

export const DEFAULT_VOICE = 'Kore';

// Get all voices as flat array
export function getAllVoices(): string[] {
  return Object.values(GEMINI_VOICES).flat();
}

// Get voice category
export function getVoiceCategory(voice: string): string | null {
  for (const [category, voices] of Object.entries(GEMINI_VOICES)) {
    if (voices.includes(voice)) {
      return category;
    }
  }
  return null;
}
