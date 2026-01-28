/**
 * HELIOS Hybrid Voice Processor
 * Combines Deepgram medical transcription with Hume emotion analysis
 */

import { deepgramService } from './transcription/deepgram.js';
import { humeService } from './emotion/hume.js';
import type { SupportedLanguage } from '../config/languages.js';
import type { EmotionAnalysis } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { now } from '../utils/index.js';

export interface VoiceProcessingResult {
  // Transcription (from Deepgram)
  transcript: string;
  transcriptConfidence: number;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
  }>;

  // Emotion (from Hume)
  emotion: EmotionAnalysis;

  // Triage impact
  triageImpact: {
    shouldEscalate: boolean;
    urgencyBoost: number;
    reasons: string[];
  };

  // Metadata
  language: SupportedLanguage;
  audioDurationMs: number;
  processingTimeMs: number;
  timestamp: string;
}

export interface VoiceProcessingOptions {
  language: SupportedLanguage;
  medicalKeywords?: string[];
  skipEmotionAnalysis?: boolean;
}

class VoiceProcessor {
  /**
   * Process audio with both Deepgram and Hume in parallel
   */
  async process(
    audioBuffer: Buffer,
    options: VoiceProcessingOptions
  ): Promise<VoiceProcessingResult> {
    const startTime = Date.now();

    logger.info('Starting hybrid voice processing', {
      language: options.language,
      audioSize: audioBuffer.length,
      skipEmotion: options.skipEmotionAnalysis,
    });

    try {
      // Run Deepgram and Hume in parallel for speed
      const [transcriptionResult, emotionResult] = await Promise.all([
        // Deepgram: Medical transcription
        deepgramService.transcribe(audioBuffer, {
          language: options.language,
          keywords: options.medicalKeywords,
        }),

        // Hume: Emotion analysis (if not skipped)
        options.skipEmotionAnalysis
          ? Promise.resolve(null)
          : humeService.analyzeEmotion(audioBuffer, options.language),
      ]);

      // Build combined result
      const result: VoiceProcessingResult = {
        // Transcription
        transcript: transcriptionResult.transcript,
        transcriptConfidence: transcriptionResult.confidence,
        words: transcriptionResult.words,

        // Emotion (use defaults if skipped)
        emotion: emotionResult?.analysis || this.getDefaultEmotionAnalysis(),

        // Triage impact
        triageImpact: emotionResult?.triageImpact || {
          shouldEscalate: false,
          urgencyBoost: 0,
          reasons: [],
        },

        // Metadata
        language: options.language,
        audioDurationMs: transcriptionResult.duration * 1000,
        processingTimeMs: Date.now() - startTime,
        timestamp: now(),
      };

      logger.info('Hybrid voice processing complete', {
        transcriptLength: result.transcript.length,
        dominantEmotion: result.emotion.dominant_emotion,
        shouldEscalate: result.triageImpact.shouldEscalate,
        processingTimeMs: result.processingTimeMs,
      });

      return result;
    } catch (error) {
      logger.error('Voice processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process audio from URL
   */
  async processFromUrl(
    url: string,
    options: VoiceProcessingOptions
  ): Promise<VoiceProcessingResult> {
    // Fetch audio first, then process
    const response = await fetch(url);
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return this.process(audioBuffer, options);
  }

  /**
   * Stream processing for real-time (placeholder for future)
   */
  async processStream(
    _audioStream: ReadableStream,
    _options: VoiceProcessingOptions
  ): Promise<AsyncGenerator<Partial<VoiceProcessingResult>>> {
    // TODO: Implement streaming with Deepgram live transcription
    // and Hume streaming emotion analysis
    throw new Error('Streaming not yet implemented');
  }

  /**
   * Default emotion analysis when Hume is skipped
   */
  private getDefaultEmotionAnalysis(): EmotionAnalysis {
    return {
      timestamp: now(),
      emotions: {},
      dominant_emotion: 'neutral',
      dominant_score: 0,
      distress_level: 0,
      pain_indicators: 0,
      urgency_boost: 0,
      requires_escalation: false,
    };
  }
}

export const voiceProcessor = new VoiceProcessor();

// Export individual services for direct access if needed
export { deepgramService } from './transcription/deepgram.js';
export { humeService } from './emotion/hume.js';
