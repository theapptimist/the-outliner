
## Goal
Stop “Snippet extraction took too long” from happening in the common case (even with 1 small document), and make failures actionable (clear reason + retry that actually retries) rather than a generic timeout.

## What I think is happening (most likely)
Right now the timeout is implemented as `Promise.race(...)` (`withTimeout`). That **does not cancel** the underlying network request(s). If a request to load `documents.hierarchy_blocks` (or `documents.content`) gets stuck (browser/network stall, server never completes, long TLS handshake, etc.), the UI times out after 15s and shows the “took too long” message, but the real fetch may still be hanging in the background.

Since you said:
- it’s usually **1 document**
- it’s **small**
- and “nothing ever loads”

…this points less to “too much data to scan” and more to “the request sometimes hangs / never resolves”, and our current timeout can’t actually interrupt it.

## Constraints in current code
- `fetchSnippetsForDocument()` fetches `hierarchy_blocks` via `.single()` and only falls back to `content` if no hierarchy snippet is found.
- Pre-cache only fetches `id, hierarchy_blocks` (batch), but for your case (1 doc) it doesn’t fundamentally change the behavior.
- `withTimeout()` can surface a timeout, but cannot prevent the underlying request from continuing to hang.

## Proposed fix (high confidence)
### A) Make snippet fetches **abortable** (real cancellation)
Implement an internal helper specifically for snippet-loading that:
1) Creates an `AbortController`
2) Starts the network request
3) Uses `setTimeout(() => controller.abort(), timeoutMs)`
4) Cleans up the timer in `finally`

Then use this helper for:
- the “fetch hierarchy_blocks” request
- the “fetch content” request (fallback)

This avoids “ghost requests” that keep the app in a bad state and dramatically reduces “it never loads” scenarios.

Implementation details:
- Use `fetch()` directly against the backend REST endpoint for these two calls only (so we can pass `signal`), instead of `supabase.from(...).select(...).single()`.
- Reuse the existing auth session token from `supabase.auth.getSession()` to set the `Authorization: Bearer ...` header.
- Keep the response format identical to what the rest of the code expects (`{ hierarchy_blocks }` / `{ content }`).
- Keep your current caches (`snippetCache`, `snippetLoading`) as-is.

Why direct fetch here:
- supabase-js query builder doesn’t give us a straightforward way to pass an AbortController per-request in this code path without changing the global client config (which we must not edit).

Acceptance criteria:
- When a request hangs, it’s forcibly aborted at the timeout, and retries don’t stack up stuck requests.
- The “Loading” spinner on the thumbnail always stops, and a retry actually starts a fresh request.

### B) Replace `.single()` behavior with “maybe” semantics (avoid hard errors)
Even though this likely isn’t the root cause, it’s a correctness improvement:
- Replace `.single()` semantics with an equivalent “0 or 1 row” behavior.
- If the document row is missing (or not accessible), return a clear sentinel: “Document not accessible” (distinct from timeout).

Acceptance criteria:
- If a doc is deleted or inaccessible, the UI shows a “not found / no access” message instead of timing out.

### C) Add targeted instrumentation so we stop guessing
Add timing + size logging (behind a lightweight guard) for snippet operations:
- time to fetch hierarchy
- response payload size estimate (via `Content-Length` header when available, or `JSON.stringify(data).length` fallback)
- time to scan hierarchy
- whether it returned early or fell back to content
- if aborted: log `AbortError`

This will let us differentiate:
- “network stall”
- “huge payload”
- “CPU scanning issue”
- “permission/no row”

Acceptance criteria:
- We can open the console and immediately see which stage is failing and why, for the exact doc.

## Secondary improvements (nice-to-have, but I’d do right after A/B/C)
### D) Chunk pre-cache even for bigger entities (prevents future regressions)
If an entity expands to many docs later:
- Fetch hierarchy_blocks in chunks (e.g., 5–10 docs per batch) with a per-batch abortable timeout.
- Populate snippetCache as each chunk completes (partial progress).

### E) UI: make the error message more specific
Instead of only “Snippet extraction took too long”:
- “Network request timed out”
- “Request was cancelled”
- “Document not found or not accessible”
- “No snippets found” (actual success case)

And keep the Retry button.

## Files that will be changed (no new dependencies)
- `src/hooks/useEntityDocuments.ts`
  - Add an abortable fetch helper
  - Use it for hierarchy/content retrieval
  - Improve error classification + sentinels
  - Add instrumentation logs
- (Optional small tweak) `src/components/editor/MasterLibraryDialog.tsx`
  - Display more specific message based on sentinel type

## Test plan (end-to-end)
1) Expand an entity with 1 linked document:
   - “Loading snippets…” indicator appears then stops.
2) Click the document thumbnail:
   - Thumbnail spinner stops within timeout window.
   - If successful: snippets show.
   - If not: you get a specific reason + Retry.
3) Click Retry repeatedly:
   - Should not get worse over time (no accumulating hung requests).
4) (If possible) Simulate bad network (throttle in browser devtools):
   - Confirm abort happens and UI recovers cleanly.

## If this still times out after abortable fetch
That would strongly suggest the backend is responding slowly even for small docs, in which case the next step would be:
- create a small backend-side “snippet index” (new table storing precomputed snippet strings per document/entity) populated when entities are extracted or when a doc is saved.
But I would only do this if A/B/C show that the request is consistently slow rather than hanging.

