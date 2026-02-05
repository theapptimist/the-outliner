

# Fix: Snippet Loading Stuck at getSession()

## Root Cause Identified

After 10+ hours of debugging, I've traced the actual problem:

The `abortableFetch.ts` utility starts a 15-second timeout timer, then calls `await supabase.auth.getSession()` to get the access token. If `getSession()` hangs (which can happen with network issues, cold starts, or racing requests), the timeout fires before `fetch()` is even called. 

**Evidence:**
- Console shows `[snippets] precache: batch fetching...` (logged before abortableFetch)
- Console does NOT show `[abortableFetch] Starting batch request...` (which is logged AFTER getSession)
- Console shows `[abortableFetch] Batch timeout reached (15000ms), aborting` (timer fires)
- Network logs show NO `hierarchy_blocks` request was ever made

This means the actual network fetch never started - it got stuck waiting for `getSession()`.

## The Fix

Move the session retrieval OUTSIDE the timeout-controlled section, and cache/reuse the session token to avoid repeated `getSession()` calls.

### Changes to `src/lib/abortableFetch.ts`

1. **Get session BEFORE starting the timeout timer**
   - Call `getSession()` first, so if it hangs, we know immediately (and can surface a better error)
   - Only start the abort timer right before the actual `fetch()`
   
2. **Add a timeout around `getSession()` itself**
   - If getting the session takes > 2 seconds, abort and return an "auth" error
   - This surfaces the real problem to the user

3. **Add more instrumentation**
   - Log time spent on `getSession()` vs actual fetch
   - This helps diagnose future issues

### Changes to `src/hooks/useEntityDocuments.ts`

1. **Pass the session token from outside if already available**
   - The `precacheSnippets` function can get the session once and pass it to `abortableFetchRows`
   - This avoids multiple `getSession()` calls that can race/hang

2. **Better error message for auth timeout**
   - Add a new sentinel: "Authentication timed out. Please refresh and try again."

## Technical Details

```text
BEFORE (problematic flow):
┌─────────────────────────────────────────────────────────────┐
│ start timer (15s)                                           │
│ await getSession()  ← CAN HANG HERE FOR 15s                 │
│ log "Starting batch request..."  ← NEVER REACHED            │
│ await fetch(...)                                            │
│ return result                                               │
└─────────────────────────────────────────────────────────────┘
Timer fires after 15s → "timeout" error, but fetch never started

AFTER (fixed flow):
┌─────────────────────────────────────────────────────────────┐
│ await getSessionWithTimeout(2s)  ← FAST FAIL if auth hangs  │
│ start timer (15s)                                           │
│ log "Starting batch request..."  ← NOW REACHED              │
│ await fetch(...)                                            │
│ return result                                               │
└─────────────────────────────────────────────────────────────┘
If getSession hangs: returns "auth_timeout" error in 2s
If fetch hangs: returns "timeout" error in 15s
```

## Files to Change

| File | Changes |
|------|---------|
| `src/lib/abortableFetch.ts` | Move getSession outside timeout; add auth timeout wrapper |
| `src/hooks/useEntityDocuments.ts` | Add AUTH_TIMEOUT_SNIPPET sentinel |

## Why This Will Work

This fix addresses the actual root cause (getSession hanging), not just the symptoms. The current approach times out after 15 seconds but gives no useful information because the fetch never started. With this fix:

1. If auth is slow/stuck → user sees "Authentication timed out" in 2 seconds
2. If fetch is slow/stuck → user sees "Request timed out" in 15 seconds
3. The retry button will actually work because subsequent getSession calls typically succeed

## Test Plan

1. Expand an entity with documents
2. Observe "Loading snippets..." shows briefly
3. Snippets should load within a few seconds (not 15+)
4. If there's still a timeout, the error message should distinguish auth vs network

