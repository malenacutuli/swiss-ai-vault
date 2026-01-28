/**
 * Deepgram Medical Transcription Service
 * Uses nova-2-medical model for accurate medical terminology
 */

import { createClient, DeepgramClient } from '@deepgram/sdk';
import { env } from '../../config/env.js';
import { DEEPGRAM_CONFIG } from '../../config/voice.js';
import type { SupportedLanguage } from '../../config/languages.js';
import { logger } from '../../utils/logger.js';
import { withRetry } from '../../utils/index.js';

export interface TranscriptionResult {
  transcript: string;
  words: Array<{
    word: string;
    start: number;
    end: number;
    confidence: number;
    punctuated_word?: string;
  }>;
  confidence: number;
  language: string;
  duration: number;
  processingTimeMs: number;
}

export interface TranscriptionOptions {
  language: SupportedLanguage;
  keywords?: string[];
  diarize?: boolean;
}

class DeepgramService {
  private client: DeepgramClient;

  constructor() {
    this.client = createClient(env.DEEPGRAM_API_KEY);
  }

  /**
   * Transcribe audio buffer using medical model
   */
  async transcribe(
    audioBuffer: Buffer,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const deepgramLanguage = DEEPGRAM_CONFIG.languages[options.language];

    logger.info('Starting Deepgram transcription', {
      language: options.language,
      deepgramLanguage,
      audioSize: audioBuffer.length,
    });

    try {
      const result = await withRetry(
        async () => {
          const { result } = await this.client.listen.prerecorded.transcribeFile(
            audioBuffer,
            {
              model: DEEPGRAM_CONFIG.model,
              language: deepgramLanguage,
              ...DEEPGRAM_CONFIG.features,
              diarize: options.diarize ?? true,
              keywords: options.keywords,
            }
          );
          return result;
        },
        3,
        1000
      );

      if (!result) {
        throw new Error('No result returned from Deepgram');
      }

      const channel = result.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];

      if (!alternative) {
        throw new Error('No transcription result returned');
      }

      const transcriptionResult: TranscriptionResult = {
        transcript: alternative.transcript || '',
        words: alternative.words?.map(w => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
          punctuated_word: w.punctuated_word,
        })) || [],
        confidence: alternative.confidence || 0,
        language: channel?.detected_language || deepgramLanguage,
        duration: result.metadata?.duration || 0,
        processingTimeMs: Date.now() - startTime,
      };

      logger.info('Deepgram transcription complete', {
        transcriptLength: transcriptionResult.transcript.length,
        wordCount: transcriptionResult.words.length,
        confidence: transcriptionResult.confidence,
        processingTimeMs: transcriptionResult.processingTimeMs,
      });

      return transcriptionResult;
    } catch (error) {
      logger.error('Deepgram transcription failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Transcribe from URL (for stored audio)
   */
  async transcribeUrl(
    url: string,
    options: TranscriptionOptions
  ): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const deepgramLanguage = DEEPGRAM_CONFIG.languages[options.language];

    try {
      const { result } = await this.client.listen.prerecorded.transcribeUrl(
        { url },
        {
          model: DEEPGRAM_CONFIG.model,
          language: deepgramLanguage,
          ...DEEPGRAM_CONFIG.features,
        }
      );

      if (!result) {
        throw new Error('No result returned from Deepgram');
      }

      const channel = result.results?.channels?.[0];
      const alternative = channel?.alternatives?.[0];

      return {
        transcript: alternative?.transcript || '',
        words: alternative?.words?.map(w => ({
          word: w.word,
          start: w.start,
          end: w.end,
          confidence: w.confidence,
        })) || [],
        confidence: alternative?.confidence || 0,
        language: deepgramLanguage,
        duration: result.metadata?.duration ?? 0,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      logger.error('Deepgram URL transcription failed', { error, url });
      throw error;
    }
  }
}

export const deepgramService = new DeepgramService();
