
## Goal
Make “Back to Snippets” reliably reopen the Snippets (Master Library) every time, without regressing doc/library loading.

## What’s actually broken now
Right now the “Back to Snippets” button renders, but clicking it often does nothing because `popDocument()` is no longer returning the popped navigation entry reliably.

### Root cause
In `src/contexts/NavigationContext.tsx`, `popDocument()` was changed to:

- compute `popped` inside the `setStack(prev => ...)` updater
- immediately return `popped`

In React, the state updater function is not guaranteed to run before the function returns (especially under batching/concurrent behavior). So `popped` frequently remains `null`, causing:

- `NavigationBackBar.handleBack()` to do `if (!origin) return;`
- result: button click appears to do nothing

This matches your symptom: “now I only got the Back to Snippets” (it shows, but it can’t successfully act on the origin entry).

## Fix (deterministic pop that returns the correct entry)
### A) Make `popDocument()` synchronous in terms of its returned value
Update `NavigationContext` to keep a `stackRef` that always contains the latest stack. Then `popDocument()` can:

1. read the current stack from the ref synchronously
2. compute the popped entry synchronously
3. trigger `setStack(prev => prev.slice(0, -1))`
4. return the popped entry immediately and reliably

**File:** `src/contexts/NavigationContext.tsx`
**Changes:**
- import `useRef`
- add `const stackRef = useRef<NavigationEntry[]>([])`
- `useEffect(() => { stackRef.current = stack; }, [stack])`
- rewrite `popDocument` to read from `stackRef.current`

### B) (Optional but recommended) Make `NavigationBackBar` not depend on `popDocument()` return value
Even with the ref fix, the back-bar already has `currentOrigin` available. The most robust pattern is:

- store `const origin = currentOrigin` (synchronous)
- then call `popDocument()` only to mutate the stack
- proceed using `origin`

**File:** `src/components/editor/NavigationBackBar.tsx`
**Change:**
- use `currentOrigin` as the origin for decisions, call `popDocument()` as a side-effect

This removes future fragility if `popDocument` changes again.

## Logging cleanup (after verification)
Once confirmed fixed, remove or downgrade the noisy console logs:
- `[NavigationBackBar] Render check`
- `[NavigationContext] pushDocument called`
These were useful for diagnosis but make debugging harder long-term.

## Step-by-step implementation order
1. Edit `src/contexts/NavigationContext.tsx`
   - add `stackRef`
   - refactor `popDocument()` to return deterministically
2. Edit `src/components/editor/NavigationBackBar.tsx`
   - stop early-returning due to null origin; use `currentOrigin` snapshot
3. Manual test pass (see below)
4. Remove debug logs (optional follow-up if you want)

## Verification checklist (end-to-end)
Please test this exact flow 5 times in a row (the bug is intermittent):
1. Open Snippets (Master Library dialog).
2. Use “Jump to document”.
3. Confirm:
   - the document loads
   - the Library sidebar still loads normally
   - the top bar shows “Back to Snippets”
4. Click “Back to Snippets”.
5. Confirm:
   - Snippets dialog opens
   - it is populated (not blank)

If it still fails after this fix, the next likely culprit is that the button click is firing but `masterLibraryOpen` is being immediately set back to `false` (a competing state update). At that point we’ll add one very targeted log in the click handler plus a log where `setMasterLibraryOpen(false)` is called to find the competing close event.

## Files involved
- `src/contexts/NavigationContext.tsx` (primary fix)
- `src/components/editor/NavigationBackBar.tsx` (robustness improvement)
