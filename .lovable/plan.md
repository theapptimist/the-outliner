
## Goal
Stop the “see‑saw” where fixing **Back to Snippets** breaks editor visibility. Make “Jump to document” from Snippets do two things reliably:
1) Close Snippets modal
2) Navigate to the document and show the Back bar (“Back to Snippets”)

## What’s happening now (based on code + your symptom)
You’re currently passing the **special Snippets jump callback** (`handleJumpFromMasterLibrary`) into `EditorSidebar` as `onNavigateToDocument`.

That means **every** navigation initiated from the sidebar (Library pane, Timeline pane, Master outline pane, etc.) is now treated as “jumped from Snippets”, which:
- pushes a `master-library` entry to the navigation stack when it shouldn’t
- can cause the UI to re-open / remain in “Snippets” mode (modal stays open or effectively dominates the UI)
- creates exactly the “Snippets shows but editor/library don’t” kind of broken state

In short: the callback wiring is too broad. The Snippets-only behavior must be scoped to Snippets-only actions.

## Fix strategy (deterministic and minimal)
### Key change
Introduce a dedicated prop path for Snippets jump:
- Keep `onNavigateToDocument` for normal navigation (Library pane / Timeline / Master outline)
- Add `onJumpFromMasterLibrary` strictly for the Snippets modal
- Ensure closing the modal happens in a stable place even if the dialog’s internal close is delayed

This prevents the Snippets stack push / close logic from hijacking other navigation paths.

## Implementation steps (what I will change)

### 1) `src/components/editor/EditorSidebar.tsx`
**Add a new optional prop**:
- `onJumpFromMasterLibrary?: (docId: string) => void`

Then wire the modal like this:
- `<LazyMasterLibraryDialog onJumpToDocument={onJumpFromMasterLibrary ?? onNavigateToDocument} />`

So:
- Snippets modal uses the special callback if provided
- Otherwise falls back to normal navigation (safe default)

Also: keep `LibraryPane`, `TimelinePane`, `MasterOutlinePane` using the existing `onNavigateToDocument` prop (normal navigation).

### 2) `src/pages/Editor.tsx` (inside `NavigationAwareContent`)
Right now you pass:
- `onNavigateToDocument={handleJumpFromMasterLibrary}` (too broad)

Change to:
- `onNavigateToDocument={(id) => handleNavigateToDocument(id, true)}` (normal navigation)
- `onJumpFromMasterLibrary={handleJumpFromMasterLibrary}` (new prop, Snippets-only)

Additionally, make `handleJumpFromMasterLibrary` explicitly close the modal as a defensive guarantee:
- `setMasterLibraryOpen(false)` first
- then `pushDocument('master-library', 'Snippets', { type: 'master-library' })`
- then `handleNavigateToDocument(docId, true)`

This way, even if Radix Dialog’s close timing is weird, the controlling state is forced shut before navigation starts.

### 3) `src/components/editor/MasterLibraryDialog.tsx`
Keep the current behavior (close first, then rAF navigate). The diagnostics can stay temporarily until we confirm stability, but once fixed we should remove them.

No further behavioral logic needed here once the callback wiring is corrected.

## Why this should end the “see-saw”
- Snippets-specific side effects (push master-library stack entry, force-close modal) only run when navigation originates from the Snippets modal.
- Normal navigation from Library/Timeline/Master outline won’t mistakenly push a `master-library` origin or interfere with modal visibility.
- The editor view will no longer get “covered” by a modal that remains open due to a missed close state update.

## Validation checklist (end-to-end)
1. Open Snippets → pick an entity → “Jump to document”
   - Snippets modal closes
   - Document editor is visible
   - Back bar shows “Back to Snippets”
2. Click “Back to Snippets”
   - Snippets modal opens
   - It lands where expected (at least opens reliably; preserving exact expansion state is separate)
3. From regular Library pane (not Snippets modal), click any “Jump to document”
   - It navigates without creating a “Back to Snippets” entry
4. Repeat steps (1)-(2) five times in a row to ensure the race is gone.

## Files involved
- `src/pages/Editor.tsx`
- `src/components/editor/EditorSidebar.tsx`
- (optional cleanup after verification) `src/components/editor/MasterLibraryDialog.tsx` to remove diagnostic logs

## Rollback safety
These are isolated prop-threading changes; if something unexpected happens, we can revert to the previous callback wiring without touching database/backend logic.
