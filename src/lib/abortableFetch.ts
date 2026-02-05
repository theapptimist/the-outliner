/**
 * Abortable fetch helper for Supabase REST API requests.
 * Uses native fetch with AbortController so requests can be truly cancelled.
 * 
 * IMPORTANT: Session retrieval happens BEFORE the timeout timer starts,
 * so if getSession() hangs, we fail fast (2s) instead of waiting 15s.
 */
import { supabase } from '@/integrations/supabase/client';

// Error types for better UI messaging
export type FetchErrorType = 'timeout' | 'aborted' | 'network' | 'not_found' | 'unauthorized' | 'auth_timeout' | 'unknown';

export interface AbortableFetchResult<T> {
  data: T | null;
  error: FetchErrorType | null;
  errorMessage?: string;
}

// Auth timeout - if getSession takes longer than this, something is wrong
// 5 seconds allows for initial session hydration while still failing fast for true hangs
const AUTH_TIMEOUT_MS = 5000;

/**
 * Get session with a timeout wrapper.
 * getSession() can hang indefinitely in certain network conditions.
 */
async function getSessionWithTimeout(): Promise<{ accessToken: string | null; error: FetchErrorType | null }> {
  const t0 = performance.now();
  console.log('[abortableFetch] Getting session...');
  
  try {
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('AUTH_TIMEOUT')), AUTH_TIMEOUT_MS)
      )
    ]);
    
    const elapsed = Math.round(performance.now() - t0);
    const accessToken = result.data?.session?.access_token || null;
    console.log(`[abortableFetch] Session retrieved in ${elapsed}ms, hasToken=${!!accessToken}`);
    
    return { accessToken, error: null };
  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    if (err instanceof Error && err.message === 'AUTH_TIMEOUT') {
      console.error(`[abortableFetch] getSession timed out after ${elapsed}ms`);
      return { accessToken: null, error: 'auth_timeout' };
    }
    console.error(`[abortableFetch] getSession error after ${elapsed}ms:`, err);
    return { accessToken: null, error: 'unknown' };
  }
}

/**
 * Fetch a single row from a Supabase table with abort capability.
 * Returns { data, error, errorMessage } where error is a classified type.
 */
export async function abortableFetchRow<T>(
  table: string,
  select: string,
  filters: Record<string, string>,
  options: {
    timeoutMs: number;
    signal?: AbortSignal; // Optional external signal for batch abort
  }
): Promise<AbortableFetchResult<T>> {
  const { timeoutMs, signal: externalSignal } = options;
  
  // STEP 1: Get session BEFORE starting the fetch timeout
  // This prevents getSession() hangs from eating into our fetch timeout
  const { accessToken, error: authError } = await getSessionWithTimeout();
  
  if (authError) {
    return { 
      data: null, 
      error: authError, 
      errorMessage: authError === 'auth_timeout' 
        ? 'Authentication timed out. Please refresh and try again.' 
        : 'Authentication error'
    };
  }

  // STEP 2: Now start the actual fetch with timeout
  const controller = new AbortController();
  
  // Combine external signal with our timeout signal
  const combinedSignal = externalSignal
    ? combineAbortSignals(controller.signal, externalSignal)
    : controller.signal;

  const timer = setTimeout(() => {
    console.log(`[abortableFetch] Timeout reached (${timeoutMs}ms), aborting request to ${table}`);
    controller.abort();
  }, timeoutMs);

  const t0 = performance.now();

  try {
    // Build REST API URL
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    
    // Add filters (e.g., id=eq.xxx)
    for (const [key, value] of Object.entries(filters)) {
      url.searchParams.set(key, value);
    }

    console.log(`[abortableFetch] Starting request to ${table}, filters:`, filters);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken || supabaseKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Prefer': 'return=representation',
      },
      signal: combinedSignal,
    });

    const elapsed = Math.round(performance.now() - t0);
    const contentLength = response.headers.get('Content-Length');
    console.log(`[abortableFetch] Response from ${table}: status=${response.status}, elapsed=${elapsed}ms, size=${contentLength || 'unknown'}`);

    if (!response.ok) {
      if (response.status === 404) {
        return { data: null, error: 'not_found', errorMessage: 'Document not found' };
      }
      if (response.status === 401 || response.status === 403) {
        return { data: null, error: 'unauthorized', errorMessage: 'Access denied' };
      }
      return { data: null, error: 'unknown', errorMessage: `HTTP ${response.status}` };
    }

    const rows = await response.json() as T[];
    
    // "Maybe single" semantics: 0 or 1 row
    if (!rows || rows.length === 0) {
      console.log(`[abortableFetch] No rows returned from ${table}`);
      return { data: null, error: 'not_found', errorMessage: 'No document found' };
    }

    const data = rows[0];
    const payloadSize = JSON.stringify(data).length;
    console.log(`[abortableFetch] Success from ${table}: payload=${payloadSize} chars, elapsed=${elapsed}ms`);
    
    return { data, error: null };

  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        // Check if it was our timeout or external abort
        const wasTimeout = elapsed >= timeoutMs - 100; // Allow some margin
        console.log(`[abortableFetch] Request aborted after ${elapsed}ms, wasTimeout=${wasTimeout}`);
        return { 
          data: null, 
          error: wasTimeout ? 'timeout' : 'aborted',
          errorMessage: wasTimeout ? 'Request timed out' : 'Request was cancelled'
        };
      }
      
      // Network errors
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.error(`[abortableFetch] Network error after ${elapsed}ms:`, err.message);
        return { data: null, error: 'network', errorMessage: 'Network error' };
      }
      
      console.error(`[abortableFetch] Unknown error after ${elapsed}ms:`, err);
      return { data: null, error: 'unknown', errorMessage: err.message };
    }
    
    console.error(`[abortableFetch] Unknown error after ${elapsed}ms:`, err);
    return { data: null, error: 'unknown', errorMessage: 'Unknown error' };
    
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch multiple rows from a Supabase table with abort capability.
 * Used for batch pre-caching.
 */
export async function abortableFetchRows<T>(
  table: string,
  select: string,
  inFilter: { column: string; values: string[] },
  options: {
    timeoutMs: number;
    signal?: AbortSignal;
  }
): Promise<AbortableFetchResult<T[]>> {
  const { timeoutMs, signal: externalSignal } = options;
  
  // STEP 1: Get session BEFORE starting the fetch timeout
  const { accessToken, error: authError } = await getSessionWithTimeout();
  
  if (authError) {
    return { 
      data: null, 
      error: authError, 
      errorMessage: authError === 'auth_timeout' 
        ? 'Authentication timed out. Please refresh and try again.' 
        : 'Authentication error'
    };
  }

  // STEP 2: Now start the actual fetch with timeout
  const controller = new AbortController();
  
  const combinedSignal = externalSignal
    ? combineAbortSignals(controller.signal, externalSignal)
    : controller.signal;

  const timer = setTimeout(() => {
    console.log(`[abortableFetch] Batch timeout reached (${timeoutMs}ms), aborting`);
    controller.abort();
  }, timeoutMs);

  const t0 = performance.now();

  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    
    const url = new URL(`${supabaseUrl}/rest/v1/${table}`);
    url.searchParams.set('select', select);
    
    // Build IN filter: column=in.(val1,val2,val3)
    const inValues = inFilter.values.map(v => `"${v}"`).join(',');
    url.searchParams.set(inFilter.column, `in.(${inValues})`);

    console.log(`[abortableFetch] Starting batch request to ${table}, ${inFilter.values.length} IDs`);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${accessToken || supabaseKey}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      signal: combinedSignal,
    });

    const elapsed = Math.round(performance.now() - t0);
    console.log(`[abortableFetch] Batch response: status=${response.status}, elapsed=${elapsed}ms`);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        return { data: null, error: 'unauthorized', errorMessage: 'Access denied' };
      }
      return { data: null, error: 'unknown', errorMessage: `HTTP ${response.status}` };
    }

    const rows = await response.json() as T[];
    console.log(`[abortableFetch] Batch success: ${rows.length} rows, elapsed=${elapsed}ms`);
    
    return { data: rows, error: null };

  } catch (err) {
    const elapsed = Math.round(performance.now() - t0);
    
    if (err instanceof Error) {
      if (err.name === 'AbortError') {
        const wasTimeout = elapsed >= timeoutMs - 100;
        console.log(`[abortableFetch] Batch aborted after ${elapsed}ms, wasTimeout=${wasTimeout}`);
        return { 
          data: null, 
          error: wasTimeout ? 'timeout' : 'aborted',
          errorMessage: wasTimeout ? 'Request timed out' : 'Request was cancelled'
        };
      }
      
      if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
        console.error(`[abortableFetch] Batch network error after ${elapsed}ms:`, err.message);
        return { data: null, error: 'network', errorMessage: 'Network error' };
      }
      
      console.error(`[abortableFetch] Batch unknown error after ${elapsed}ms:`, err);
      return { data: null, error: 'unknown', errorMessage: err.message };
    }
    
    return { data: null, error: 'unknown', errorMessage: 'Unknown error' };
    
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Combines two AbortSignals into one that aborts when either fires.
 */
function combineAbortSignals(signal1: AbortSignal, signal2: AbortSignal): AbortSignal {
  const controller = new AbortController();
  
  const abort = () => controller.abort();
  
  signal1.addEventListener('abort', abort);
  signal2.addEventListener('abort', abort);
  
  // If either is already aborted, abort immediately
  if (signal1.aborted || signal2.aborted) {
    controller.abort();
  }
  
  return controller.signal;
}
