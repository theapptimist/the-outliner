
Goal: Fix the Master Library “snippets” loader that spins forever after clicking a document thumbnail (e.g., under an entity like “Egypt”). This is currently a UI dead-end and makes the feature feel broken.

What we know from inspection
- The spinner is controlled by `useEntityDocuments().isSnippetLoading(doc.id, { entityType, text: entityName })`.
- Clicking a thumbnail runs `DocumentThumbnail.handleClick`, which `await`s `fetchSnippetsForDocument(...)`.
- `fetchSnippetsForDocument` sets `snippetLoading.add(cacheKey)` and is supposed to remove it in a `finally` block.
- If the spinner “never stops”, then in practice one of these is happening:
  1) the promise inside `fetchSnippetsForDocument` never resolves (network stall), OR
  2) the function is taking “effectively forever” on the main thread (CPU-bound extraction/matching on large documents), so the UI never reaches the `finally` update, OR
  3) an exception occurs before the `finally` state update is processed (less likely since `finally` exists, but still possible if something prevents React state updates from flushing).

Most likely root cause (based on the code)
- The snippet extraction is potentially very expensive for large documents:
  - `findSnippetsInContent()` calls `extractPlainText(content)` which recursively builds a full plain-text string of the entire TipTap JSON document.
  - On large docs, building that string and then running regex/substring matching can take a long time and block the UI thread, making it look like an “infinite spinner”.
- Even if the backend request is fast, the CPU work after it returns can keep the spinner up for a long time.

Implementation plan (incremental, with quick win first)

Phase 1 — Add safe “fails fast” behavior (so spinner can’t hang forever)
1) Add a timeout wrapper inside `fetchSnippetsForDocument`:
   - Race the content fetch + snippet computation against a timeout (e.g., 8–12 seconds).
   - If it times out:
     - Clear the loading state (so spinner stops).
     - Cache a sentinel result such as one snippet: “Snippets taking too long to compute. Click to retry.” or show an error UI.
   - This ensures the UI never gets stuck in a perpetual loading state.

2) Add robust try/catch around the snippet computation:
   - If snippet computation throws (e.g., malformed JSON content), catch and return `[]` while still clearing loading and caching the result (so subsequent clicks don’t re-trigger the same expensive crash loop).

Phase 2 — Optimize snippet extraction to avoid full-document string building
3) Replace `extractPlainText(content)` usage for snippet searching with an early-exit traversal:
   - Traverse TipTap JSON tree and only collect text in a bounded sliding window.
   - Stop traversal as soon as we’ve found `MAX_SNIPPETS_PER_DOCUMENT`.
   - Avoid concatenating the entire doc into one huge string.
   - Keep behavior consistent with your existing entity-type-aware matcher (terms = word boundary regex; dates = substring; people/places = normalized fallback).

4) Add a hard cap on processed characters for content scanning:
   - Example: scan at most the first N characters (e.g., 200k) or the first M text nodes.
   - If cap is hit, return whatever snippets found so far.
   - This prevents worst-case performance on extremely large docs.

5) (Optional) Yield back to the browser during long loops:
   - In long traversals, occasionally `await new Promise(requestAnimationFrame)` every X nodes.
   - This keeps the UI responsive and allows the loading spinner to animate smoothly while work continues.

Phase 3 — Verify backend query and reduce payload if needed
6) Confirm the document fetch used for snippets only selects the minimal fields needed:
   - Currently it selects `content, hierarchy_blocks`.
   - If `hierarchy_blocks` is huge and not always required, consider:
     - First compute snippets from hierarchy blocks only (or content only), or
     - Fetch one field first, then fetch the other only if needed and time allows.
   - This can cut payload size and speed up the request.

Phase 4 — UX improvements in the snippet card
7) Improve the expanded snippet UI states:
   - Loading (spinner)
   - Timeout / error (“Couldn’t generate snippets quickly. Retry” button)
   - Empty result (“No text snippets found”)
   - Success (snippet navigation)

Files we will touch (no backend schema changes expected)
- `src/hooks/useEntityDocuments.ts` (core fix: timeout, early-exit traversal, CPU caps, better error handling)
- `src/components/editor/MasterLibraryDialog.tsx` (optional: surface a nicer “timeout/error” state in the snippet panel; currently it only distinguishes loading vs empty vs snippets)

Testing checklist (end-to-end)
- In Master Library:
  1) Expand an entity with known occurrences.
  2) Click a thumbnail: spinner appears, then resolves to snippets OR a timeout message within the configured time limit.
  3) Retry after timeout: should either succeed or timeout again but never get stuck.
  4) Test a very large document: UI remains responsive; snippets either appear quickly or stop with a timeout message.
- Regression:
  - Document navigation (“Jump to document”) still works.
  - Snippet caching works (second open is fast).
  - Matching rules remain entity-type-aware (terms word boundary; dates substring; people/places normalized).

Fallback / Recovery option if you want immediate unblocking
- Temporarily disable content-based snippet extraction and only scan `hierarchy_blocks` (often smaller and structurally bounded), while we refine the TipTap traversal. This would give fast, reliable snippets in many cases, and avoids scanning huge rich-text JSON.

Why this will resolve the “infinite spinner”
- Timeout guarantees the loading state is always cleared.
- Early-exit traversal + caps prevent pathological CPU time on large documents.
- Improved error handling prevents “silent” hangs due to unexpected content shapes.

If you approve, I’ll implement Phase 1 + Phase 2 first (they directly address the spinner never stopping), then refine payload/UX if needed.
