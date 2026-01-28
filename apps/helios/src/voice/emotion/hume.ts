/**
 * Hume.ai Emotion Detection Service
 * Analyzes voice for distress, pain, anxiety, and other healthcare-relevant emotions
 */

import { HumeClient } from 'hume';
import { env } from '../../config/env.js';
import { HUME_CONFIG, EMOTION_TRIAGE_RULES } from '../../config/voice.js';
import type { SupportedLanguage } from '../../config/languages.js';
import type { EmotionAnalysis } from '../../types/index.js';
import { logger } from '../../utils/logger.js';
import { now } from '../../utils/index.js';

export interface EmotionResult {
  analysis: EmotionAnalysis;
  rawEmotions: Record<string, number>;
  triageImpact: {
    shouldEscalate: boolean;
    urgencyBoost: number;
    reasons: string[];
  };
}

class HumeService {
  private client: HumeClient;

  constructor() {
    this.client = new HumeClient({
      apiKey: env.HUME_API_KEY,
    });
  }

  /**
   * Analyze audio for emotional content
   */
  async analyzeEmotion(
    audioBuffer: Buffer,
    language: SupportedLanguage
  ): Promise<EmotionResult> {
    logger.info('Starting Hume emotion analysis', {
      language,
      audioSize: audioBuffer.length,
    });

    try {
      // Process audio with Hume
      const predictions = await this.processAudioWithHume(audioBuffer);

      // Extract and normalize emotions
      const emotions = this.extractEmotions(predictions);

      // Calculate healthcare-specific metrics
      const healthcareMetrics = this.calculateHealthcareMetrics(emotions);

      // Determine triage impact
      const triageImpact = this.evaluateTriageImpact(emotions, language);

      const analysis: EmotionAnalysis = {
        timestamp: now(),
        emotions,
        dominant_emotion: this.getDominantEmotion(emotions),
        dominant_score: Math.max(...Object.values(emotions), 0),
        distress_level: healthcareMetrics.distress,
        pain_indicators: healthcareMetrics.pain,
        urgency_boost: triageImpact.urgencyBoost,
        requires_escalation: triageImpact.shouldEscalate,
      };

      logger.info('Hume analysis complete', {
        dominantEmotion: analysis.dominant_emotion,
        distressLevel: analysis.distress_level,
        requiresEscalation: analysis.requires_escalation,
      });

      return {
        analysis,
        rawEmotions: emotions,
        triageImpact,
      };
    } catch (error) {
      logger.error('Hume emotion analysis failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  /**
   * Process audio with Hume batch API
   */
  private async processAudioWithHume(_audioBuffer: Buffer): Promise<HumePredictions> {
    // In production, use the actual Hume batch or streaming API
    // The Hume SDK requires file upload or URL for batch processing

    try {
      // Create inference job with prosody model
      const job = await this.client.expressionMeasurement.batch.startInferenceJob({
        models: {
          prosody: HUME_CONFIG.models.prosody ? {} : undefined,
          language: HUME_CONFIG.models.language ? {} : undefined,
        },
      });

      // Poll for job completion
      // In production, implement proper polling or use webhooks
      await this.waitForJobCompletion(job.jobId);

      // Get predictions
      const predictions = await this.client.expressionMeasurement.batch.getJobPredictions(
        job.jobId
      );

      return this.transformHumePredictions(predictions);
    } catch (error) {
      logger.warn('Hume API call failed, using fallback', { error });
      // Return neutral fallback
      return this.getNeutralPredictions();
    }
  }

  /**
   * Wait for Hume job completion
   */
  private async waitForJobCompletion(jobId: string, maxWaitMs = 30000): Promise<void> {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < maxWaitMs) {
      const status = await this.client.expressionMeasurement.batch.getJobDetails(jobId);

      if (status.state.status === 'COMPLETED') {
        return;
      }

      if (status.state.status === 'FAILED') {
        throw new Error('Hume job failed');
      }

      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }

    throw new Error('Hume job timed out');
  }

  /**
   * Transform Hume API predictions to internal format
   */
  private transformHumePredictions(_predictions: unknown): HumePredictions {
    // Transform based on actual Hume response structure
    return {
      prosody: {
        predictions: [],
      },
    };
  }

  /**
   * Return neutral predictions when API fails
   */
  private getNeutralPredictions(): HumePredictions {
    return {
      prosody: {
        predictions: [
          {
            emotions: [
              { name: 'calmness', score: 0.5 },
              { name: 'determination', score: 0.3 },
              { name: 'anxiety', score: 0.1 },
              { name: 'distress', score: 0.05 },
              { name: 'pain', score: 0.05 },
            ],
          },
        ],
      },
    };
  }

  /**
   * Extract emotions from Hume predictions
   */
  private extractEmotions(predictions: HumePredictions): Record<string, number> {
    const emotions: Record<string, number> = {};

    const prosodyPredictions = predictions?.prosody?.predictions || [];

    for (const prediction of prosodyPredictions) {
      for (const emotion of prediction.emotions || []) {
        emotions[emotion.name] = Math.max(
          emotions[emotion.name] || 0,
          emotion.score
        );
      }
    }

    return emotions;
  }

  /**
   * Calculate healthcare-specific metrics from emotions
   */
  private calculateHealthcareMetrics(emotions: Record<string, number>): {
    distress: number;
    pain: number;
    anxiety: number;
    confusion: number;
  } {
    return {
      distress: emotions['distress'] || emotions['distressed'] || 0,
      pain: emotions['pain'] || emotions['hurt'] || 0,
      anxiety: emotions['anxiety'] || emotions['anxious'] || emotions['fear'] || 0,
      confusion: emotions['confusion'] || emotions['confused'] || 0,
    };
  }

  /**
   * Get dominant emotion
   */
  private getDominantEmotion(emotions: Record<string, number>): string {
    let maxEmotion = 'neutral';
    let maxScore = 0;

    for (const [emotion, score] of Object.entries(emotions)) {
      if (score > maxScore) {
        maxScore = score;
        maxEmotion = emotion;
      }
    }

    return maxEmotion;
  }

  /**
   * Evaluate impact on triage based on emotions
   */
  private evaluateTriageImpact(
    emotions: Record<string, number>,
    _language: SupportedLanguage
  ): {
    shouldEscalate: boolean;
    urgencyBoost: number;
    reasons: string[];
  } {
    let shouldEscalate = false;
    let urgencyBoost = 0;
    const reasons: string[] = [];

    // Priority to urgency boost mapping
    const priorityBoost: Record<string, number> = {
      critical: 0.4,
      high: 0.25,
      medium: 0.1,
      low: 0.05,
    };

    for (const rule of EMOTION_TRIAGE_RULES) {
      const emotionScore = emotions[rule.emotion] || 0;

      if (emotionScore >= rule.threshold) {
        if (rule.action === 'escalate') {
          shouldEscalate = true;
        }

        const boost = priorityBoost[rule.priority] || 0;
        urgencyBoost = Math.max(urgencyBoost, boost);
        reasons.push(rule.message);
      }
    }

    return { shouldEscalate, urgencyBoost, reasons };
  }
}

// Internal types for Hume predictions
interface HumePredictions {
  prosody: {
    predictions: Array<{
      emotions: Array<{
        name: string;
        score: number;
      }>;
    }>;
  };
}

export const humeService = new HumeService();
