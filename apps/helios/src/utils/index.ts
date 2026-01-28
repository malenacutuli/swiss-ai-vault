import { v4 as uuidv4 } from 'uuid';
import { nanoid } from 'nanoid';

export const generateUUID = (): string => uuidv4();
export const generateShortId = (length = 12): string => nanoid(length);
export const now = (): string => new Date().toISOString();

export function safeJsonParse<T>(json: string, fallback: T): T {
  try { return JSON.parse(json) as T; }
  catch { return fallback; }
}

export const sleep = (ms: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  backoffMs = 1000
): Promise<T> {
  let lastError: Error;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try { return await fn(); }
    catch (error) {
      lastError = error as Error;
      if (attempt < maxAttempts) await sleep(backoffMs * attempt);
    }
  }
  throw lastError!;
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
