/**
 * HELIOS API Server
 * Production entry point
 */

import { serve } from '@hono/node-server';
import { Hono, type Context } from 'hono';
import { cors } from 'hono/cors';
import { logger as honoLogger } from 'hono/logger';
import { compress } from 'hono/compress';
import { secureHeaders } from 'hono/secure-headers';
import { prettyJSON } from 'hono/pretty-json';

import { env } from './config/env.js';
import { createBridgedOrchestrator } from './orchestrator/index.js';
import { FastHeliosOrchestrator } from '../../../src/orchestrator/langchain/fast-graph.js';
import { initializeKnowledge } from './knowledge/index.js';
import { getHealthStatus, getReadinessStatus, getMetricsOutput, metrics } from './monitoring/index.js';
import { logger } from './utils/logger.js';

// Initialize
initializeKnowledge();

// Orchestrator mode: 'fast' (default) or 'full' (107-agent LangChain)
const ORCHESTRATOR_MODE = process.env.HELIOS_MODE || 'fast';

// Fast orchestrator: Single optimized LLM call (~3-5 seconds)
const fastOrchestrator = new FastHeliosOrchestrator(env.ANTHROPIC_API_KEY);

// Full orchestrator: 107-agent LangChain system (~4 minutes, more thorough)
const fullOrchestrator = createBridgedOrchestrator(true, env.ANTHROPIC_API_KEY);

// Select orchestrator based on mode
const orchestrator = ORCHESTRATOR_MODE === 'full' ? fullOrchestrator : fastOrchestrator;
logger.info(`Using ${ORCHESTRATOR_MODE === 'full' ? 'Full 107-agent LangChain' : 'Fast single-pass'} orchestrator`);

// Create app
const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', honoLogger());
app.use('*', compress());
app.use('*', secureHeaders());
app.use('*', prettyJSON());

// Health endpoints
app.get('/health', async (c: Context) => {
  const health = await getHealthStatus();
  const status = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503;
  return c.json(health, status);
});

app.get('/ready', async (c: Context) => {
  const ready = await getReadinessStatus();
  return c.json({ ready }, ready ? 200 : 503);
});

app.get('/metrics', (c: Context) => {
  return c.text(getMetricsOutput(), 200, {
    'Content-Type': 'text/plain; version=0.0.4',
  });
});

// Session endpoints
app.post('/api/v1/sessions', async (c: Context) => {
  const { language = 'en' } = await c.req.json();

  // Create session in database
  // (implement based on your Supabase client)
  const sessionId = crypto.randomUUID();

  metrics.sessionsCreated.inc({ language });

  return c.json({
    session_id: sessionId,
    language,
    phase: 'intake',
    message: getGreeting(language),
  });
});

app.post('/api/v1/sessions/:sessionId/messages', async (c: Context) => {
  const sessionId = c.req.param('sessionId');
  const { message, language = 'en' } = await c.req.json();

  const startTime = Date.now();

  try {
    // Load session state from database
    const sessionState = await loadSession(sessionId);

    // Process message
    const result = await orchestrator.process(sessionState, message);

    // Save updated state
    await saveSession(sessionId, {
      ...sessionState,
      current_phase: result.finalPhase,
      red_flags: result.redFlags,
    });

    // Record metrics
    metrics.messagesProcessed.inc({ language });
    metrics.messageLatency.observe({ agent_team: 'orchestrator' }, (Date.now() - startTime) / 1000);

    if (result.escalated) {
      metrics.sessionsEscalated.inc({
        reason: 'safety_rule',
        language,
      });
    }

    return c.json({
      session_id: sessionId,
      phase: result.finalPhase,
      message: result.finalResponse,
      red_flags: result.redFlags,
      escalated: result.escalated,
    });
  } catch (error) {
    logger.error('Message processing failed', { sessionId, error });
    metrics.errors.inc({ type: 'message_processing', component: 'api' });

    return c.json({
      error: 'Failed to process message',
    }, 500);
  }
});

app.get('/api/v1/sessions/:sessionId', async (c: Context) => {
  const sessionId = c.req.param('sessionId');

  const session = await loadSession(sessionId);

  if (!session) {
    return c.json({ error: 'Session not found' }, 404);
  }

  return c.json(session);
});

// Voice endpoint
app.post('/api/v1/sessions/:sessionId/voice', async (c: Context) => {
  const sessionId = c.req.param('sessionId');
  const body = await c.req.arrayBuffer();
  const language = c.req.header('X-Language') || 'en';

  const startTime = Date.now();

  try {
    // Process voice
    const { voiceProcessor } = await import('./voice/index.js');
    const result = await voiceProcessor.process(Buffer.from(body), {
      language: language as 'en' | 'es' | 'fr',
    });

    // Process transcribed message
    const sessionState = await loadSession(sessionId);
    const orchestrationResult = await orchestrator.process(
      sessionState,
      result.transcript
    );

    metrics.voiceProcessed.inc({ language });
    metrics.voiceLatency.observe({ stage: 'total' }, (Date.now() - startTime) / 1000);

    return c.json({
      session_id: sessionId,
      transcript: result.transcript,
      emotion: result.emotion,
      message: orchestrationResult.finalResponse,
      escalated: orchestrationResult.escalated,
    });
  } catch (error) {
    logger.error('Voice processing failed', { sessionId, error });
    return c.json({ error: 'Voice processing failed' }, 500);
  }
});

// Helper functions
function getGreeting(language: string): string {
  const greetings: Record<string, string> = {
    en: "Hello! I'm your health assistant. I'll help gather information about your symptoms to connect you with the right care. This is not a substitute for professional medical advice. What brings you in today?",
    es: "Hola! Soy tu asistente de salud. Te ayudare a recopilar informacion sobre tus sintomas para conectarte con la atencion adecuada. Esto no sustituye el consejo medico profesional. Que te trae hoy?",
    fr: "Bonjour! Je suis votre assistant de sante. Je vais vous aider a recueillir des informations sur vos symptomes pour vous orienter vers les soins appropries. Ceci ne remplace pas les conseils medicaux professionnels. Qu'est-ce qui vous amene aujourd'hui?",
  };
  return greetings[language] || greetings.en;
}

async function loadSession(sessionId: string): Promise<any> {
  // Implement database load
  // For now, return mock
  return {
    session_id: sessionId,
    language: 'en',
    current_phase: 'intake',
    phase_history: [],
    chief_complaint: null,
    messages: [],
    symptom_entities: [],
    hypothesis_list: [],
    red_flags: [],
    escalation_triggered: false,
    escalation_reason: null,
    triage_level: null,
    disposition: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

async function saveSession(_sessionId: string, _state: any): Promise<void> {
  // Implement database save
}

// Start server
const port = parseInt(process.env.PORT || '8080', 10);

serve({
  fetch: app.fetch,
  port,
}, (info: { port: number }) => {
  logger.info(`HELIOS API server running on port ${info.port}`);
});
