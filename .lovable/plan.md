
## What I can see right now (from your console snapshot)
- `NavigationBackBar` is repeatedly logging:
  - `canGoBack: false`
  - `currentOrigin: null`
  - `activeSidebarTab: "library"`
- That means the “Back to Snippets” bar is missing because the navigation stack is empty at the moment it renders (so there is nothing to go “back” to).

## What the code is supposed to do (and why it’s still failing)
### Intended flow
1. In `MasterLibraryDialog`, clicking **Jump to document** calls `handleJumpToDocument(docId)`.
2. That closes the dialog (`onOpenChange(false)`), then in `requestAnimationFrame` it calls:
   - `onJumpToDocument(docId)` if provided (preferred)
   - otherwise falls back to `navigateToDocument(docId, '')` (context pipeline)
3. In `Editor.tsx` (inside `NavigationAwareContent`), `handleJumpFromMasterLibrary(docId)` should run and do:
   - `pushDocument('master-library', 'Snippets', { type: 'master-library' })`
   - `handleNavigateToDocument(docId, true)`

If (and only if) `onJumpToDocument` is not actually present at runtime, the dialog will use the fallback `navigateToDocument` and you will still successfully navigate to the doc, but the stack never gets the “master-library” entry — so `canGoBack` stays `false` and the bar never appears.

### Most likely root cause now
Even though the code *looks* wired correctly, at runtime `onJumpToDocument` is very likely **undefined** inside `MasterLibraryDialog` during the Jump click, causing the fallback path to be used:
- Navigation works (document opens)
- Stack stays empty (no “Back to Snippets” bar)

This fits your exact symptom: “After Jump to document, doc opens, but no back-to-snippets button.”

## Plan: Prove which path is executing, then fix it deterministically

### Phase 1 — Add targeted diagnostics (temporary, minimal, high-signal)
Add a few logs that answer these questions in one reproduction:
1. Does `MasterLibraryDialog.handleJumpToDocument` see `onJumpToDocument` as a function or undefined?
2. Does `handleJumpFromMasterLibrary` in `Editor.tsx` actually run?
3. Does `pushDocument` run and what does the stack become immediately after?

Concrete logging locations:
- `src/components/editor/MasterLibraryDialog.tsx`
  - Inside `handleJumpToDocument`:
    - log whether `typeof onJumpToDocument === 'function'`
    - log which branch is taken (`prop callback` vs `navigateToDocument fallback`)
- `src/pages/Editor.tsx`
  - Inside `handleJumpFromMasterLibrary`:
    - log that it fired and the `docId`
- `src/contexts/NavigationContext.tsx`
  - You already have `pushDocument` logs; keep them for this test (or add a single “stack length before/after” log if needed)

Repro steps you’ll run once after the logging:
1. Open Snippets (Master Library)
2. Click Jump to document
3. Immediately check console: we should see which branch executed and whether `pushDocument` fired

### Phase 2 — Fix based on what we learn (two robust options)
#### Option A (most likely fix): Guarantee `onJumpToDocument` is always passed
If diagnostics confirm `onJumpToDocument` is undefined:
- Trace the prop thread:
  - `NavigationAwareContent` → `EditorSidebar onNavigateToDocument` → `LazyMasterLibraryDialog onJumpToDocument` → `MasterLibraryDialog props`
- Fix whatever is breaking that chain (common causes):
  - prop name mismatch
  - a different `MasterLibraryDialog` instance being opened than the one you think (duplicate instance / ghost instance)
  - `EditorSidebar` opening the dialog in an uncontrolled mode in some paths, not receiving the parent callback
- After fix: ensure `MasterLibraryDialog` never needs the fallback `navigateToDocument` for this feature.

#### Option B (defensive fix): Push stack inside `MasterLibraryDialog` again, but safely
If for any reason ensuring the prop chain is fragile, we can make the feature resilient:
- Add a dedicated prop like `onBeforeJumpToDocument?: (docId) => void` that **only pushes the stack** (no navigation).
- Call `onBeforeJumpToDocument(docId)` synchronously (before closing).
- Then close dialog, then navigate (prop or fallback).
This preserves the “close first, navigate after” UX while making stack setup independent from the navigation callback.

This option eliminates the “button missing” failure mode even if the navigation callback wiring breaks again later.

### Phase 3 — Verification (must be repeatable)
After implementing the chosen fix:
- Test the flow 5 times:
  1. Open Snippets
  2. Jump to document
  3. Confirm “Back to Snippets” bar appears
  4. Click it; confirm Snippets reopens

### Phase 4 — Clean up logs
- Remove the added diagnostics and also remove the noisy render-loop logs currently in `NavigationBackBar` once stable.

## Why I’m proposing diagnostics first
Right now the UI symptom (“doc opens, but stack is empty”) can happen from a small handful of causes that require different fixes. The fastest way to stop the loop of regressions is to log the *actual branch* being executed at runtime during the jump.

## Files involved
- `src/components/editor/MasterLibraryDialog.tsx` (diagnose branch; possibly adjust jump flow)
- `src/pages/Editor.tsx` (confirm callback runs; potentially adjust callback wiring)
- `src/components/editor/EditorSidebar.tsx` (likely where callback chain breaks, if it’s breaking)
- `src/contexts/NavigationContext.tsx` (existing push logs; possibly minor improvements)

## Expected outcome
After this, one Jump action will always create a stack entry of type `master-library`, so `NavigationBackBar` will render consistently and show “Back to Snippets”.
