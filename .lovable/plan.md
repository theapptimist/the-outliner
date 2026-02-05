
Goal
- Make “Jump to document” reliably load the correct document in the editor.
- Make snippets actually appear (match logic currently too naive vs how highlights are detected).
- Add lazy-loading for the heavy Master Library modal so it doesn’t bloat initial load and reduces the chance of interactive glitches.

What I found
1) “Jump to document” currently calls the Editor page’s “open document by id” callback (via props). That bypasses the editor’s built-in “navigateToDocument” handler that is already registered in DocumentContext and is used for wiki-style link navigation (and master-mode state).
- So even when the modal closes, we’re not using the most reliable, already-integrated navigation pipeline.

2) Snippets are searched with a simple `indexOf(entityName)` in:
- TipTap JSON content (flattened to text)
- hierarchy_blocks tree nodes (label/content flattened)
But your highlight system for People/Places uses normalized, word-boundary matching across a linearized text map, and Terms use word-boundary regex.
- Because snippet search doesn’t mirror those rules, it’s easy to get “No text snippets found” even when the entity is clearly highlighted in the editor.

3) There’s a console warning:
- “Function components cannot be given refs… Check the render method of MasterEntityCard. DocumentThumbnail…”
This suggests some Radix “asChild”/SlotClone path is trying to attach a ref to a function component somewhere in the Master Library tree. It might not be the root cause, but it’s worth removing to avoid subtle click/interaction weirdness.

Implementation plan

A) Fix “Jump to document” by using the editor’s navigation handler (DocumentContext) first
Files:
- src/components/editor/MasterLibraryDialog.tsx
- src/components/editor/context/DocumentContext.tsx (read-only reference; likely no changes needed)

Steps:
1) In MasterLibraryDialog.tsx, import/use `useDocumentContext()` and grab `navigateToDocument`.
2) Update jump behavior:
   - Close the dialog.
   - Prefer calling `navigateToDocument(docId, docTitle)` (from DocumentContext) if it exists.
   - Fallback to the existing `onJumpToDocument?.(docId)` prop if `navigateToDocument` is null.
3) Remove/reduce the current `setTimeout(…, 100)` approach:
   - Replace with a microtask or `requestAnimationFrame` approach only if needed (e.g., `requestAnimationFrame(() => navigateToDocument(...))`), but keep it minimal.
4) Add explicit “navigation in progress” UI:
   - Disable the Jump button while navigating.
   - Show a small spinner + “Opening…” in the expanded thumbnail panel.
   - If navigation fails (document not found / permission denied), show an inline error right under the Jump button (so it’s not missed as a toast).

Why this should work
- `navigateToDocument` is already the canonical navigation pipe used by link nodes; it’s registered in Editor.tsx and is designed to coordinate navigation and master-mode state. Using it for “Jump” makes behavior consistent and less brittle.

B) Fix snippet matching to mirror the highlight logic (people/places normalization + word boundaries)
Files:
- src/hooks/useEntityDocuments.ts
- src/components/editor/MasterLibraryDialog.tsx (to pass entity type + proper search text)

Steps:
1) Change the snippet fetch API to accept richer search input:
   - From: `fetchSnippetsForDocument(documentId, entityName)`
   - To something like: `fetchSnippetsForDocument(documentId, { entityType, text })`
     - entityType: 'people' | 'places' | 'dates' | 'terms'
     - text: display text (name/rawText/term)
2) Update MasterLibraryDialog.tsx to pass the correct text by type:
   - people/places: `data.name`
   - dates: `data.rawText` (fallback to formatted date if needed)
   - terms: `data.term`
3) Rewrite snippet search to be “two-tier” and consistent:
   - For terms: case-insensitive word boundary regex like TermHighlightPlugin (`\\bterm\\b`).
   - For dates: case-insensitive substring match (no word boundary).
   - For people/places: use normalized matching like People/Places highlight plugins.
4) For people/places normalized matching, implement a safe “normalize with index mapping” helper so we can:
   - Search on normalized text (robust to punctuation/spacing).
   - Convert match positions back into original text indices to extract a real snippet from the original text.
   This avoids showing snippets from normalized text (which would look wrong).
5) Cap snippets to keep UI usable:
   - Return at most N snippets per document (e.g., 10) and at most 1–2 per hierarchy node to prevent huge expansions.

Why this should work
- It aligns snippet detection with the same “what counts as a match” rules that are producing the highlights you see in the editor.

C) Eliminate the “ref passed to function component” warning in the Master Library tree
Files:
- src/components/editor/MasterLibraryDialog.tsx

Steps:
1) Identify which component is receiving an unexpected ref:
   - Likely a Radix `asChild` wrapper somewhere around MasterEntityCard or a child inside Tab content.
2) Fix by ensuring the immediate child of any Radix `asChild` is a DOM element or a `forwardRef` component.
   - If it’s DocumentThumbnail or MasterEntityCard being used as a direct `asChild` child (or via a SlotClone path), convert that component to `forwardRef<HTMLDivElement, Props>` and pass the ref down to the root `<div>`.
3) Re-check console logs after change; warning should disappear.

D) Add lazy-loading for the Master Library modal (requested)
Files:
- src/components/editor/EditorSidebar.tsx
- src/components/editor/LibraryPane.tsx
- src/components/editor/MasterLibraryDialog.tsx (no logic change required, but might be adjusted to support lazy loading smoothly)
- src/lib/lazyComponent.tsx (already exists)

Steps:
1) Replace static imports of MasterLibraryDialog in EditorSidebar and LibraryPane with `lazyDialog` or `lazyWithFallback`.
   - Because MasterLibraryDialog is a named export, load via:
     - `lazyDialog(() => import('./MasterLibraryDialog').then(m => ({ default: m.MasterLibraryDialog })))`
2) Render the lazy dialog only when `masterLibraryOpen` is true.
   - This prevents loading the entire Master Library module until it’s actually opened.
3) Ensure props are identical and behavior unchanged.

Testing checklist (end-to-end)
1) Open Master Library → My library → expand an entity → click a document thumbnail:
   - Expanded panel opens immediately.
   - Snippet area shows spinner, then real snippets (when the entity exists in that doc).
2) Click Jump to document:
   - Modal closes.
   - The editor loads the target document (title/content/outline visibly changes).
3) Confirm no “Function components cannot be given refs” warning in console.
4) Reload the app:
   - Initial load is faster.
   - Opening Master Library still works (lazy-loaded).
5) Edge cases:
   - Entity exists in a doc only in hierarchy blocks (snippets still appear).
   - Entity exists only in TipTap body content (snippets still appear).
   - Entity text includes punctuation or multiple spaces (people/places) (snippets still appear).

Scope note
- This plan focuses on reliability and correctness without changing backend schema.
- If we later want perfect snippet targeting (exact location), we could extend document_entity_refs to store positions/usages, but that’s a bigger step and not required for this fix.

Files expected to change
- src/components/editor/MasterLibraryDialog.tsx
- src/hooks/useEntityDocuments.ts
- src/components/editor/EditorSidebar.tsx
- src/components/editor/LibraryPane.tsx
- (Optional) any component that needs forwardRef to fix the ref warning

Risks / tradeoffs
- The normalize-with-index-mapping logic needs careful implementation to avoid off-by-one bugs. We’ll keep it unit-test-like with simple helper functions and conservative bounds checks.
- Lazy-loading can surface any “named export” import mistakes; we’ll follow the existing documented pattern already used for LazyAIToolbar.
