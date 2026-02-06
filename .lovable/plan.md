
Goal: When you “Jump to document” from the Master Library, the top back bar should say “Back to Snippets” (not “Back to ‘Untitled’”), and clicking it should reliably re-open the Master Library instead of trying to navigate back to an unsaved/ephemeral document.

What’s happening (why you still see “Back to ‘Untitled’”)
- The back bar label comes from the NavigationContext “stack” top entry (`currentOrigin.title`).
- We already push a special stack entry from MasterLibraryDialog:
  - `pushDocument('master-library', 'Snippets', { type: 'master-library' })`
- But you’re still ending up with “Back to ‘Untitled’” because another navigation path is also pushing the current document (“Untitled”) onto the stack after (or instead of) the “master-library” entry.
- The key culprit is the context navigation handler registered in `EditorContent` (Editor.tsx). It currently does this for link-style navigation:
  - Always `pushDocument(document.meta.id, document.meta.title)` before navigating.
- If MasterLibraryDialog ever falls back to the context-based `navigateToDocument` path (or any path that triggers that handler), the handler will push the current doc (often “Untitled”) onto the stack, causing the back bar to show “Back to ‘Untitled’” and leading to a broken “go back” attempt (because that document ID may not exist in the backend).

High-confidence fix (robust against all entry points)
We’ll prevent unsaved/ephemeral “Untitled” documents from ever being pushed onto the navigation stack. This makes the navigation stack safe, even if MasterLibraryDialog uses the context pipeline for navigation in some cases.

Implementation plan (code changes)

1) Guard stack pushes in the EditorContent navigation handler (Editor.tsx)
Where:
- `src/pages/Editor.tsx` inside `EditorContent`’s `useEffect` that registers the `setNavigateToDocument(handler)`.

Change:
- Before calling `pushDocument(document.meta.id, document.meta.title)`, compute “is this document safely navigable back to?”
- Use the same heuristic already used elsewhere in the project:
  - treat as “saved” if:
    - title is not “Untitled”, OR
    - createdAt !== updatedAt
- Only push if it’s “saved”.
- If it is not “saved”, skip the push (so we don’t create “Back to Untitled” entries that can’t be reopened).

Expected result:
- Even if MasterLibraryDialog falls back to `navigateToDocument`, the stack will not get polluted with “Untitled”.
- Therefore the top stack entry remains the “master-library / Snippets” entry, so the back bar renders “Back to Snippets”.

2) Add a safety clean-up for existing persisted bad stack entries (NavigationContext.tsx)
Why:
- The navigation stack is persisted in sessionStorage. If there’s already an “Untitled” entry at the top from earlier runs, it can continue to show until replaced/cleared.

Where:
- `src/contexts/NavigationContext.tsx` in the initialization of `stack` (the `useState(() => getStoredValue(...))` initializer).

Change:
- After loading the stored stack, filter out clearly-invalid entries that we never want to show:
  - entries with `title === 'Untitled'` and missing `type` (or `type === 'document'`) are the common problematic case.
- Keep `type === 'master-library'` entries and all normal document entries with real titles.

Expected result:
- Existing sessions won’t keep showing “Back to Untitled” just because it was saved in sessionStorage previously.

3) Strengthen MasterLibraryDialog’s “prefer direct navigation” behavior (optional but recommended)
Where:
- `src/components/editor/MasterLibraryDialog.tsx` `handleJumpToDocument`

Change:
- Keep current behavior (use `onJumpToDocument` first).
- Add a defensive console warning (temporary) or toast (optional) if `onJumpToDocument` is missing, because that’s when the dialog is forced to use the context pipeline, which has different side effects.
- (We can remove debug logging after validation.)

Expected result:
- Easier to spot if some part of the UI opens Master Library without wiring the direct navigation callback.

Test plan (what you’ll verify in the UI)
A. Main scenario (the one in your screenshot)
1. Start from a brand-new local “Untitled” document (not saved).
2. Open Master Library.
3. Click “Jump to document” on a snippet thumbnail.
4. Confirm the top bar reads “Back to Snippets”.
5. Click it.
6. Confirm the Master Library re-opens (instead of the editor going blank / document “disappearing”).

B. Regression checks
1. Navigate document-to-document using in-document link nodes.
2. Confirm the back bar still works for saved documents (e.g., “Back to ‘My Contract Draft’”).
3. Confirm “Back to Untitled” does not appear after any navigation path.
4. Refresh the page mid-session and confirm the back bar does not resurrect “Back to Untitled” from persistence.

Files that will be modified
- `src/pages/Editor.tsx` (guard `pushDocument` in the registered navigation handler)
- `src/contexts/NavigationContext.tsx` (sanitize persisted stack on initialization)
- (Optional) `src/components/editor/MasterLibraryDialog.tsx` (diagnostic hardening; remove later)

Why this approach is the right fix
- It addresses the root issue: pushing “unstable” origins onto a stack that assumes it can re-open items by ID.
- It makes the system resilient regardless of which component instance opened the Master Library (Sidebar dialog vs LibraryPane dialog vs any future entry point).
- It prevents the broken “doc disappeared but tiles stayed” state by ensuring “Back” never tries to open a non-existent backend document.

Potential trade-off (explicit)
- If a user navigates away from an unsaved “Untitled” document via a link, they won’t have a “Back” entry to return to that unsaved doc. This is intentional: returning to it by ID is not reliable because it was never saved. We can later add an explicit “Save before navigating” UX if you want to preserve local drafts across navigation.

If you want, we can follow up after this fix with “restore Master Library state” (remember which entity was expanded) using the `entityId/entityType` fields already added to NavigationEntry, so “Back to Snippets” returns you to the exact same expanded entity view.
