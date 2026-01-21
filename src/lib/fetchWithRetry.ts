/**
 * Utility for retrying async operations with exponential backoff.
 * Handles transient network failures gracefully.
 */

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  shouldRetry?: (error: unknown) => boolean;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  shouldRetry: (error: unknown) => {
    // Retry on network errors or 5xx server errors
    if (error instanceof TypeError && error.message.includes('Load failed')) {
      return true;
    }
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: string }).code;
      // Retry on connection errors
      if (code === 'PGRST301' || code === 'NETWORK_ERROR') {
        return true;
      }
    }
    return false;
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Execute an async function with retry logic and exponential backoff.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: unknown;
  let delay = opts.initialDelayMs;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt >= opts.maxRetries || !opts.shouldRetry(error)) {
        throw error;
      }

      console.warn(
        `[Retry] Attempt ${attempt + 1}/${opts.maxRetries + 1} failed, retrying in ${delay}ms...`,
        error
      );

      await sleep(delay);
      delay = Math.min(delay * 2, opts.maxDelayMs);
    }
  }

  throw lastError;
}
