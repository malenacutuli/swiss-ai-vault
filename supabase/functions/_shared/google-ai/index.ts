// Google AI Integration Module
// Supports Gemini API, Nano Banana (Image Generation), NotebookLM, and Discovery APIs

export interface GoogleAIConfig {
  apiKey?: string;
  projectId?: string;
  location?: string;
}

// Image generation request
export interface ImageGenerationRequest {
  prompt: string;
  model?: 'gemini-2.5-flash-image' | 'gemini-3-pro-image-preview';
  aspectRatio?: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '21:9';
  imageSize?: '1K' | '2K' | '4K';
  numberOfImages?: number;
  referenceImages?: string[]; // Base64 encoded images
}

export interface ImageGenerationResponse {
  success: boolean;
  images?: Array<{
    base64: string;
    mimeType: string;
  }>;
  error?: string;
}

// Gemini text generation
export interface GeminiTextRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemInstruction?: string;
}

export interface GeminiTextResponse {
  success: boolean;
  text?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
  error?: string;
}

// NotebookLM Podcast generation
export interface PodcastGenerationRequest {
  sources: Array<{
    type: 'text' | 'url' | 'document';
    content: string;
    title?: string;
  }>;
  voiceConfig?: {
    host1?: 'en-US-Standard-A' | 'en-US-Standard-B' | 'en-US-Standard-C';
    host2?: 'en-US-Standard-D' | 'en-US-Standard-E' | 'en-US-Standard-F';
  };
  style?: 'conversational' | 'educational' | 'news';
  duration?: 'short' | 'medium' | 'long';
}

export interface PodcastGenerationResponse {
  success: boolean;
  audioUrl?: string;
  transcript?: string;
  duration?: number;
  error?: string;
}

/**
 * Google AI Client for interacting with various Google AI services
 */
export class GoogleAIClient {
  private apiKey: string;
  private projectId?: string;
  private location: string;
  private baseUrl = 'https://generativelanguage.googleapis.com/v1beta';

  constructor(config: GoogleAIConfig = {}) {
    // Try multiple possible environment variable names for the API key
    this.apiKey = config.apiKey ||
      Deno.env.get('GOOGLE_API_KEY') ||
      Deno.env.get('Google API') ||  // Supabase secret name with space
      Deno.env.get('GEMINI_API_KEY') ||
      '';
    this.projectId = config.projectId || Deno.env.get('GOOGLE_PROJECT_ID');
    this.location = config.location || 'us-central1';

    if (!this.apiKey) {
      console.warn('[GoogleAI] No API key configured. Set GOOGLE_API_KEY environment variable.');
    } else {
      console.log('[GoogleAI] API key configured, length:', this.apiKey.length);
    }
  }

  /**
   * Generate images using Nano Banana (Gemini Image Generation)
   * Model options:
   * - gemini-2.5-flash-image: Fast, 1024px, best for high-volume tasks
   * - gemini-3-pro-image-preview: Professional quality, up to 4K, advanced reasoning
   */
  async generateImages(request: ImageGenerationRequest): Promise<ImageGenerationResponse> {
    if (!this.apiKey) {
      return { success: false, error: 'Google API key not configured' };
    }

    const model = request.model || 'gemini-2.5-flash-image';
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    try {
      // Build the request body
      const contents: any[] = [];

      // Add reference images if provided (for Gemini 3 Pro)
      if (request.referenceImages && request.referenceImages.length > 0) {
        for (const img of request.referenceImages) {
          contents.push({
            role: 'user',
            parts: [{
              inline_data: {
                mime_type: 'image/png',
                data: img,
              }
            }]
          });
        }
      }

      // Add the text prompt
      contents.push({
        role: 'user',
        parts: [{ text: request.prompt }]
      });

      const requestBody: Record<string, unknown> = {
        contents,
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          responseMimeType: 'image/png',
        }
      };

      // Add aspect ratio if specified
      if (request.aspectRatio) {
        (requestBody.generationConfig as any).aspectRatio = request.aspectRatio;
      }

      // Add image size for Gemini 3 Pro
      if (model === 'gemini-3-pro-image-preview' && request.imageSize) {
        (requestBody.generationConfig as any).imageSize = request.imageSize;
      }

      console.log('[GoogleAI] Generating image with model:', model);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleAI] Image generation error:', response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();

      // Extract images from response
      const images: Array<{ base64: string; mimeType: string }> = [];

      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inline_data) {
            images.push({
              base64: part.inline_data.data,
              mimeType: part.inline_data.mime_type || 'image/png',
            });
          }
        }
      }

      if (images.length === 0) {
        return { success: false, error: 'No images generated in response' };
      }

      return { success: true, images };

    } catch (error) {
      console.error('[GoogleAI] Image generation exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate text using Gemini models
   */
  async generateText(request: GeminiTextRequest): Promise<GeminiTextResponse> {
    if (!this.apiKey) {
      return { success: false, error: 'Google API key not configured' };
    }

    const model = request.model || 'gemini-2.0-flash';
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    try {
      const requestBody: Record<string, unknown> = {
        contents: [{
          role: 'user',
          parts: [{ text: request.prompt }]
        }],
        generationConfig: {
          maxOutputTokens: request.maxTokens || 4096,
          temperature: request.temperature ?? 1.0,
        }
      };

      if (request.systemInstruction) {
        requestBody.systemInstruction = {
          parts: [{ text: request.systemInstruction }]
        };
      }

      console.log('[GoogleAI] Generating text with model:', model);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleAI] Text generation error:', response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        return { success: false, error: 'No text generated' };
      }

      return {
        success: true,
        text,
        usage: data.usageMetadata ? {
          promptTokens: data.usageMetadata.promptTokenCount || 0,
          completionTokens: data.usageMetadata.candidatesTokenCount || 0,
        } : undefined,
      };

    } catch (error) {
      console.error('[GoogleAI] Text generation exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate podcast using NotebookLM Enterprise API
   * Note: Requires Google Cloud project with Discovery Engine API enabled
   */
  async generatePodcast(request: PodcastGenerationRequest): Promise<PodcastGenerationResponse> {
    // NotebookLM Podcast API requires OAuth2 service account auth
    const serviceAccountJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON');

    if (!serviceAccountJson) {
      return { success: false, error: 'GOOGLE_SERVICE_ACCOUNT_JSON not configured for NotebookLM' };
    }

    if (!this.projectId) {
      return { success: false, error: 'GOOGLE_PROJECT_ID required for NotebookLM' };
    }

    try {
      // Parse service account credentials
      const serviceAccount = JSON.parse(serviceAccountJson);

      // Get access token using service account
      const accessToken = await this.getServiceAccountToken(serviceAccount);

      if (!accessToken) {
        return { success: false, error: 'Failed to obtain access token' };
      }

      // Discovery Engine API endpoint for podcast generation
      const url = `https://discoveryengine.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/dataStores/-/siteSearchEngine:synthesizePodcast`;

      // Build sources
      const sources = request.sources.map((source, idx) => ({
        sourceId: `source-${idx}`,
        sourceType: source.type === 'url' ? 'URL' : 'DOCUMENT',
        content: source.content,
        title: source.title || `Source ${idx + 1}`,
      }));

      const requestBody = {
        sources,
        podcastConfig: {
          voiceConfig: request.voiceConfig || {
            host1: 'en-US-Standard-A',
            host2: 'en-US-Standard-D',
          },
          style: request.style || 'conversational',
          targetDuration: request.duration === 'short' ? 'PT5M' :
                          request.duration === 'long' ? 'PT15M' : 'PT10M',
        }
      };

      console.log('[GoogleAI] Generating podcast');

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GoogleAI] Podcast generation error:', response.status, errorText);
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();

      return {
        success: true,
        audioUrl: data.audioUri,
        transcript: data.transcript,
        duration: data.durationSeconds,
      };

    } catch (error) {
      console.error('[GoogleAI] Podcast generation exception:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get OAuth2 access token using service account credentials
   */
  private async getServiceAccountToken(serviceAccount: any): Promise<string | null> {
    try {
      // Create JWT for token exchange
      const now = Math.floor(Date.now() / 1000);
      const header = {
        alg: 'RS256',
        typ: 'JWT',
        kid: serviceAccount.private_key_id,
      };

      const claim = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600,
      };

      // Note: In production, use proper JWT signing library
      // This is a simplified implementation
      const encodedHeader = btoa(JSON.stringify(header));
      const encodedClaim = btoa(JSON.stringify(claim));

      // For proper implementation, you'd need to sign with the private key
      // Using Web Crypto API or a library like jose

      // Fallback: Use API key auth if available
      if (this.apiKey) {
        return this.apiKey;
      }

      console.warn('[GoogleAI] Service account JWT signing not fully implemented');
      return null;

    } catch (error) {
      console.error('[GoogleAI] Token generation error:', error);
      return null;
    }
  }

  /**
   * Multimodal understanding - analyze images
   */
  async analyzeImage(imageBase64: string, prompt: string): Promise<GeminiTextResponse> {
    if (!this.apiKey) {
      return { success: false, error: 'Google API key not configured' };
    }

    const model = 'gemini-2.0-flash';
    const url = `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`;

    try {
      const requestBody = {
        contents: [{
          role: 'user',
          parts: [
            {
              inline_data: {
                mime_type: 'image/png',
                data: imageBase64,
              }
            },
            { text: prompt }
          ]
        }]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

      return {
        success: true,
        text,
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
let _client: GoogleAIClient | null = null;

export function getGoogleAIClient(): GoogleAIClient {
  if (!_client) {
    _client = new GoogleAIClient();
  }
  return _client;
}
