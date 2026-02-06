
## What’s actually happening (why it still “does nothing”)
From the code you shared + the current Master Library implementation, the spinner problem is now very likely **not** “stale requests winning” (though that can happen). It’s primarily:

1) **The Master Library explorer is fetching huge document payloads**  
In `MasterLibraryDialog.tsx`, the “all documents” fetch does:
- `select('id, title, folder_id, content, hierarchy_blocks')`

That means every open of the Master Library is transferring potentially very large JSON blobs (`content` + `hierarchy_blocks`) for *every document* just to:
- build a title list
- filter out “empty” docs

This can easily take **20–40 seconds** depending on document count + outline size, and it will look exactly like “library opens immediately but no content / spinners spin”.

2) **The loading flags can get stuck true on abort/stale returns**  
In the all-documents `.then(...)`, if the request is aborted or considered stale you `return` early and **never clear `loadingAllDocs`**. That alone can cause “infinite spinner” even if later requests finish.

So we need two changes:
- Make document listing lightweight (fast, deterministic)
- Make loading state deterministic (never stuck)

## Goal
When you click “Back to Snippets”:
- Master Library opens immediately
- Document explorer and entity lists populate within ~1–2 seconds
- No infinite spinners
- If deeper “empty doc” detection is needed, it happens *after* the UI renders (progressive enhancement)

---

## Implementation plan (approved work I will implement next)

### Phase 1 — Stop the stuck spinners (deterministic loading lifecycle)
**A. Fix `loadingAllDocs` to always clear**
In `src/components/editor/MasterLibraryDialog.tsx`, update the “fetch all user documents” effect to:
- use `try/catch/finally` (or a `.finally`)
- ensure `setLoadingAllDocs(false)` runs when:
  - request succeeds
  - request errors
  - request is aborted
  - request is “stale” due to open sequence changing

Concretely:
- If `openSeqRef.current !== seq` OR `controller.signal.aborted`, still clear loading (or clear it in finally).

**B. Ensure hook loading flags also clear on abort**
Right now `useMasterEntities` / `useMasterLibraryDocuments` intentionally do not setLoading(false) when aborted. That’s fine when closed, but in a keep-mounted dialog it can leave UI in “loading forever” unless a later request always completes.
I’ll adjust the dialog’s orchestration so that on every open we trigger a non-aborted request, and also ensure that any aborted refresh is followed by a new refresh (or we explicitly clear the visible loading state when closing).

### Phase 2 — Make Master Library open fast (remove heavyweight document payloads)
**A. Change the “all documents” query to be lightweight**
In `MasterLibraryDialog.tsx`:
- Replace:
  - `select('id, title, folder_id, content, hierarchy_blocks')`
- With:
  - `select('id, title, folder_id, created_at, updated_at')` (or just `id,title,folder_id,updated_at`)

This reduces payload size drastically.

**B. Replace “empty document” detection with a fast heuristic**
Because we won’t have `content`/`hierarchy_blocks` in that list query anymore, we cannot run `isDocumentEmpty(...)` there.

We’ll use a heuristic that avoids listing obviously “blank” documents without pulling large JSON:
- hide docs that are very likely auto-created blanks, for example:
  - `title === 'Untitled'` AND `created_at === updated_at`
- optionally keep “Untitled but edited” docs (if updated_at differs)

This gets you 95% of the original intention (don’t clutter explorer with blank docs) without 40-second loads.

**C. Keep the strict “empty doc” filtering only where it’s cheap**
In `useMasterLibraryDocuments.ts`, you currently fetch `content,hierarchy_blocks` to filter empties for the “docs that have entities”.
That set is typically much smaller than “all docs”, but it can still be big.

I’ll change `useMasterLibraryDocuments` to:
- first fetch `entities.source_document_id` counts (as it does)
- then fetch documents with **light fields** (`id,title,folder_id,updated_at`)
- remove strict `isDocumentEmpty` filtering there as well (or apply the same heuristic)

If we still need strict filtering, we can add a *second stage background check* later (Phase 3), but first we need the UI to be fast and reliable.

### Phase 3 (optional but recommended) — Progressive enhancement for “hide empty docs” without blocking UI
If you truly need “perfect empty detection” (TipTap + hierarchy), we can do it without blocking:
- Show the list quickly using lightweight fields
- Add a toggle “Hide empty documents (deep scan)” that:
  - runs a background scan in batches (e.g., 25 docs at a time) fetching `content/hierarchy_blocks` only for that batch
  - updates the explorer incrementally
This prevents “open library = huge download”.

### Phase 4 — Add precise instrumentation (single flow id)
To prevent another wasted day, I’ll add a single flowId when:
- Back to Snippets clicked
- Master Library open begins
- allDocuments fetch start/end (duration)
- masterEntities fetch start/end
- libraryDocuments fetch start/end
And log durations so we can see exactly what is taking 40 seconds (and confirm the fix).

---

## Files that will be changed
1) `src/components/editor/MasterLibraryDialog.tsx`
- Fix loadingAllDocs stuck spinner (always clear)
- Make “all docs” query lightweight
- Replace deep emptiness check with heuristic
- Add timing logs / flowId

2) `src/hooks/useMasterLibraryDocuments.ts`
- Make document-title fetch lightweight (no content/hierarchy_blocks)
- Replace deep emptiness filter with heuristic or remove it
- Keep abort logic intact

3) (Possibly) `src/hooks/useMasterEntities.ts`
- Likely no functional change needed beyond ensuring the dialog does not leave it stuck loading; if required, we’ll add a safe “if aborted, clear loading on close/open transitions” pattern.

---

## Acceptance criteria (what you should see after this)
1) Click “Back to Snippets” → Master Library opens and populates content quickly (seconds, not tens of seconds).
2) No infinite spinners after open/close cycles.
3) Rapid open/close/open does not wedge the dialog into loading forever.
4) Console logs show fetch durations so we can verify the slowdown is gone.

---

## If this still isn’t enough (backup path)
If even the lightweight queries are slow, the bottleneck is likely database performance or an RLS/function slowdown. In that case, we’ll:
- identify the slow endpoint via network timing (which request takes 40s)
- change the query shape (add limits/pagination for docs explorer)
- add “load more” in explorer so it never fetches everything at once.
