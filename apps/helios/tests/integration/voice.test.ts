/**
 * Voice Processing Integration Tests
 */

import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

// Skip if no API keys
const SKIP_VOICE = !process.env.DEEPGRAM_API_KEY || !process.env.HUME_API_KEY;

describe.skipIf(SKIP_VOICE)('Voice Processing Integration', () => {
  const testAudioPath = join(__dirname, '../fixtures/audio/test-sample.wav');

  it.skipIf(!existsSync(testAudioPath))('should process audio file', async () => {
    // Dynamic import to avoid issues when voice module isn't available
    const { voiceProcessor } = await import('../../src/voice/index.js');

    const audioBuffer = readFileSync(testAudioPath);

    const result = await voiceProcessor.process(audioBuffer, {
      language: 'en',
    });

    expect(result.transcript).toBeDefined();
    expect(result.transcript.length).toBeGreaterThan(0);
    expect(result.emotion).toBeDefined();
  }, 60000);

  it('should return default emotion when skipped', async () => {
    const { voiceProcessor } = await import('../../src/voice/index.js');

    // Create a minimal audio buffer for testing
    const audioBuffer = Buffer.alloc(1000);

    const result = await voiceProcessor.process(audioBuffer, {
      language: 'en',
      skipEmotionAnalysis: true,
    });

    expect(result.emotion.dominant_emotion).toBe('neutral');
    expect(result.triageImpact.shouldEscalate).toBe(false);
  }, 30000);
});
