import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  ANTHROPIC_API_KEY: z.string().min(1),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  UPSTASH_REDIS_URL: z.string().min(1),
  UPSTASH_REDIS_TOKEN: z.string().min(1),
  HUME_API_KEY: z.string().min(1),
  HUME_SECRET_KEY: z.string().min(1),
  DEEPGRAM_API_KEY: z.string().min(1),
  LANGCHAIN_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DEFAULT_LANGUAGE: z.enum(['en', 'es', 'fr']).default('en'),
});

function validateEnv() {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error('❌ Environment validation failed:', error.errors);
      process.exit(1);
    }
    throw error;
  }
}

export const env = validateEnv();
