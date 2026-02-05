
## What’s happening (confirmed from your logs)
- The click handler runs and calls `navigateToDocument(docId, '')` from `DocumentContext`:
  - Logs show:
    - `[MasterLibrary] handleJumpToDocument called ... hasNavigateToDocument: true hasOnJumpToDocument: true`
    - `[MasterLibrary] Using navigateToDocument from context`
- But there are **no subsequent network requests** for loading the target document, which strongly suggests the `navigateToDocument` context pipeline is the part intermittently failing.
- Important discovery from code: `MasterLibraryDialog` currently **prefers `navigateToDocument` even when `onJumpToDocument` is provided**, and both `EditorSidebar` and `LibraryPane` already pass `onJumpToDocument={onNavigateToDocument}`.

So we already have a simpler, more reliable navigation path available, but the dialog is not using it first.

## Goal
Make “Jump to document” reliable by:
1) Using the direct `onJumpToDocument` path (which calls the editor’s `handleNavigateToDocument(..., true)`), and  
2) Preserving “Back” behavior by pushing the current document onto the navigation stack when jumping.

## Implementation plan (code changes)

### 1) Change Jump priority in `MasterLibraryDialog.tsx`
**File:** `src/components/editor/MasterLibraryDialog.tsx`  
**Change:** In `handleJumpToDocument`, prefer the prop `onJumpToDocument` first, and only use `navigateToDocument` as a fallback.

Why:
- `onJumpToDocument` is already wired from `Editor.tsx → EditorSidebar/LibraryPane → MasterLibraryDialog`.
- It bypasses the more complex “link navigation pipeline” (and its edge cases), which is desirable for Master Library research jumps.

Proposed logic:
- If `onJumpToDocument` exists: call it.
- Else if `navigateToDocument` exists: call that.
- Else: show an error/toast + log.

### 2) Preserve Back navigation by pushing the current doc onto the navigation stack
**File:** `src/components/editor/MasterLibraryDialog.tsx`  
**Change:** Import and use `useNavigation()` and call `pushDocument(currentDoc.id, currentDoc.title)` right before the jump (only if the target doc is different).

Why:
- If we switch to `onJumpToDocument`, we otherwise lose the stack behavior because the stack is currently pushed inside the `navigateToDocument` handler registered in `Editor.tsx`.
- This keeps `NavigationBackBar` working after a library jump.

Edge cases handled:
- If `currentDoc` is missing, skip pushing.
- If user jumps to the same doc, do nothing besides closing.
- If `pushDocument` would duplicate entries, we can optionally dedupe later (not required for reliability).

### 3) Keep the dialog-close ordering that avoids race conditions
**File:** `src/components/editor/MasterLibraryDialog.tsx`  
**Change:** Continue to:
- trigger navigation first
- close dialog second
- avoid `requestAnimationFrame`

Additionally:
- Keep `isNavigating` true slightly longer (optional polish): set it false in a microtask or `setTimeout(0)` so the button can visually show “Opening…” even if the dialog closes quickly. This won’t affect correctness, just perceived responsiveness.

### 4) (Optional cleanup) Reduce noisy instrumentation after it’s fixed
**Files:**
- `src/pages/Editor.tsx`
- `src/lib/cloudDocumentStorage.ts`

Once the jump is stable, remove/trim the extra console logs to keep the console clean. (Not required to fix the bug.)

## Test plan (end-to-end)
1. Open Master Library.
2. Expand an entity, open a document thumbnail, click “Jump to document”.
3. Verify:
   - The editor loads the target document.
   - A document load request happens (you should see the document load logs / requests).
   - The Back bar returns you to the previous document (stack behavior preserved).
4. Repeat 5–10 times across different docs to confirm the “intermittent” failure is gone.

## Why this should fix it
- Right now, the code is choosing the more complex context pipeline even though a direct, editor-owned navigation callback is available.
- Switching to `onJumpToDocument` makes the jump use the same path as normal document opening in the editor (which is already known to work), while we manually preserve stack behavior for Back navigation.

## Files involved
- `src/components/editor/MasterLibraryDialog.tsx` (primary fix)
- (Optional later cleanup) `src/pages/Editor.tsx`, `src/lib/cloudDocumentStorage.ts`

