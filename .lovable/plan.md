
## What I believe is actually happening (rephrased, in plain terms)
You have 3 moving pieces that have to line up every time:

1) **Close Snippets modal**
2) **Navigate to the chosen document**
3) **Record “where you came from”** so the header can show **Back to Snippets**

Right now, the “record where you came from” step is *sometimes not happening*, even though navigation does happen. That produces the exact symptom: document loads, library loads, but **Back to Snippets** is missing.

The evidence in the code strongly suggests the “Back to Snippets” stack entry is currently too dependent on a callback chain (Editor → Sidebar → Lazy dialog → dialog internals). Any time that chain is missing/undefined at the moment of click, the dialog falls back to a different navigation path that does not push the `master-library` entry.

So the real fix is: **make the Snippets modal itself always push the stack entry**, so “Back to Snippets” can’t disappear due to callback wiring/timing.

## Goals
- Make **Jump to document** always:
  - close Snippets
  - open the target document
  - reliably show **Back to Snippets**
- Make **Back to Snippets** always:
  - reopen Snippets
  - not leave the modal in a “double spinner / stuck loading” state
- Remove the “see-saw” behavior (fixing one breaks the other).

## Implementation approach (deterministic: put the responsibility in one place)
### Key idea
Move the “push `master-library` navigation entry” logic **into `MasterLibraryDialog`** (the one component that definitively knows “this navigation originated from Snippets”).

That means even if `onJumpToDocument` is missing or delayed for any reason, the dialog still records the origin and the header can still render **Back to Snippets**.

### Why this is better than what we have
- The dialog is the source of truth for “this is a snippet jump”.
- It avoids depending on whether props are wired correctly through `lazyDialog` and other wrappers at the exact moment of the click.
- It avoids polluting normal navigation (Library pane, Timeline, Master outline) with Snippets-only behavior.

## Concrete code changes (files and what will change)
### 1) `src/components/editor/MasterLibraryDialog.tsx`
**Change `handleJumpToDocument` to:**
1. Set `isNavigating=true`
2. Close the dialog (`onOpenChange(false)`)
3. In `requestAnimationFrame`:
   - Push navigation stack entry: `pushDocument('master-library', 'Snippets', { type: 'master-library' })`
   - Then navigate using:
     - `onJumpToDocument(docId)` if provided
     - else fallback to `navigateToDocument(docId, '')`
4. Set `isNavigating=false`

**Also:**
- Import `useNavigation` and read `pushDocument` from it.
- Remove the now-misleading comment in the dialog that says “pushDocument is now called by the parent”.
- Remove or significantly reduce the diagnostic `console.log`s we added while chasing this (they’re adding noise and you’ve been stuck too long).

**Expected result:**
Even if the prop callback chain fails, the stack entry is still created, so **Back to Snippets** can’t vanish after a successful jump.

### 2) `src/components/editor/NavigationBackBar.tsx`
Add a small safety tweak so the bar is not accidentally hidden in any edge case when the origin is Snippets:
- Current hide rule: hide if `activeSidebarTab === 'master'`.
- Update to: hide for master tab **only if the origin is not** `master-library`.

This is a defensive guardrail. Even though you answered “Not Master tab” when it disappears, this prevents one known class of “it’s there but hidden” failures.

### 3) `src/pages/Editor.tsx` and `src/components/editor/EditorSidebar.tsx`
After step (1), the parent-level Snippets-only push is no longer required for correctness.

We’ll simplify:
- Keep `onJumpFromMasterLibrary` as “close + navigate” (optional), but remove any requirement that it must push the stack.
- Ensure `EditorSidebar` continues to pass the callback down, but the dialog no longer depends on it for history correctness.

This reduces complexity and makes the system more resilient.

## Validation checklist (what we’ll test after implementation)
1) Open Snippets → expand entity → click **Jump to document**
   - Snippets closes
   - Document editor is visible
   - **Back to Snippets** appears every time

2) Click **Back to Snippets**
   - Snippets opens
   - Sidebar/editor behind it remain healthy (no “dead” UI state)
   - No persistent “Opening…” state

3) Repeat the loop 10 times quickly:
   - Snippets → Jump → Back → Jump → Back
   - Goal: no missing back button, no double spinner stuck state

4) Test from a brand-new unsaved document (“Untitled”):
   - The stack push should still happen (because it’s Snippets-originated, not based on “saved doc” rules)

## Risks / edge cases and how the plan handles them
- **Unsaved/Untitled current document:** normal navigation avoids pushing it (by design), but Snippets-originated navigation will still push `master-library` so back button exists.
- **lazyDialog keeps component mounted:** we keep the existing “reset isNavigating on open” behavior and ensure navigation state resets regardless of previous runs.
- **Prop callback missing:** dialog still pushes stack entry and uses fallback navigation.

## Scope control (so we don’t keep looping)
This plan focuses strictly on:
- making **Back to Snippets** deterministic
- removing reliance on a fragile callback chain
- preventing “UI stuck” navigation state

It does not attempt to preserve deep Snippets expansion state (entity open/scroll position) unless that’s already implemented elsewhere.

## Files involved
- `src/components/editor/MasterLibraryDialog.tsx` (core fix)
- `src/components/editor/NavigationBackBar.tsx` (defensive visibility rule)
- `src/pages/Editor.tsx` (simplify Snippets jump responsibility)
- `src/components/editor/EditorSidebar.tsx` (minor cleanup if needed)

## Success criteria
- You can no longer reproduce “doc loads but Back to Snippets is missing”.
- You can no longer reproduce “Back to Snippets returns but nothing loads / double spinner forever”.
