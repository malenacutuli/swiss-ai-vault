import { supabase } from '@/integrations/supabase/client';

interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, error: Error) => void;
}

interface InvokeResult<T = any> {
  data: T | null;
  error: Error | null;
}

/**
 * Invoke a Supabase Edge Function with automatic retry on transient failures.
 * Handles FunctionsFetchError and network timeouts with exponential backoff.
 */
export async function invokeWithRetry<T = any>(
  functionName: string,
  body: Record<string, any>,
  options: RetryOptions = {}
): Promise<InvokeResult<T>> {
  const {
    maxRetries = 3,
    initialDelayMs = 1000,
    maxDelayMs = 8000,
    onRetry
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.functions.invoke(functionName, { body });

      // If successful or it's an API error (not a fetch error), return immediately
      if (!error || (error && error.name !== 'FunctionsFetchError')) {
        return { data, error };
      }

      // It's a FunctionsFetchError - retry if we have attempts left
      lastError = error;
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        console.log(`[EdgeFunction] Retry ${attempt}/${maxRetries} for ${functionName} after ${delay}ms...`);
        
        if (onRetry) {
          onRetry(attempt, error);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      
      if (attempt < maxRetries) {
        const delay = Math.min(initialDelayMs * Math.pow(2, attempt - 1), maxDelayMs);
        console.log(`[EdgeFunction] Retry ${attempt}/${maxRetries} after exception: ${lastError.message}`);
        
        if (onRetry) {
          onRetry(attempt, lastError);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted
  return {
    data: null,
    error: lastError || new Error(`Failed to invoke ${functionName} after ${maxRetries} attempts`)
  };
}

/**
 * Check if an error is a transient fetch error that can be retried
 */
export function isTransientError(error: Error | null): boolean {
  if (!error) return false;
  
  return (
    error.name === 'FunctionsFetchError' ||
    error.message.includes('Failed to fetch') ||
    error.message.includes('network') ||
    error.message.includes('timeout') ||
    error.message.includes('ECONNRESET')
  );
}

/**
 * Get a user-friendly error message for Edge Function failures
 */
export function getEdgeFunctionErrorMessage(error: Error | null, functionName: string): string {
  if (!error) return 'Unknown error';
  
  if (isTransientError(error)) {
    return `Service temporarily unavailable. Please try again in a few seconds.`;
  }
  
  if (error.message.includes('401') || error.message.includes('Unauthorized')) {
    return 'Authentication error. Please sign in again.';
  }
  
  if (error.message.includes('429') || error.message.includes('rate limit')) {
    return 'Too many requests. Please wait a moment and try again.';
  }
  
  return error.message || `Failed to process request`;
}
