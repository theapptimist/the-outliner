
## What’s happening (in plain English)

You’re seeing an unstable “sometimes it loads, sometimes it doesn’t” behavior because one core utility is currently triggering a React state update **during rendering**.

That specific pattern can cause:
- rapid repeated re-renders (you’re seeing this as the repeated `[NavigationBackBar] Render check` spam),
- UI pieces that intermittently don’t finish rendering (blank library/doc area),
- racey behavior where the “Return to Snippets” button appears/disappears unpredictably depending on which render “wins”.

So even though we previously fixed the “fewer hooks than expected” crash by keeping lazy dialogs mounted after the first open, the current `lazyDialog` implementation still has a serious React anti-pattern.

## Evidence from your logs

- Your console snapshot shows the same `[NavigationBackBar] Render check` message printed many times in a row with the same values.
- That strongly suggests a render loop / thrash rather than a normal navigation flow.

## Root cause (technical)

File: `src/lib/lazyComponent.tsx`

Current code (problematic):

```ts
if (props.open && !hasBeenOpened) {
  setHasBeenOpened(true);
}
```

This runs **inside render**. React warns against this, and it can create repeated renders and unpredictable UI.

We must move that update into a `useEffect`.

## Fix approach

### 1) Fix `lazyDialog` to never call setState during render
Update `lazyDialog` so it:
- always calls hooks in the same order,
- uses `useEffect` to “arm” `hasBeenOpened` when `open` becomes true,
- returns `null` until the first open (so the heavy bundle is still deferred),
- once opened, it stays mounted and receives open/close via props (preserving hook stability inside the lazy-loaded dialog).

Implementation outline:

- Add `useEffect(() => { if (props.open) setHasBeenOpened(true) }, [props.open])`
- Remove the inline `if (props.open && !hasBeenOpened) setHasBeenOpened(true)` from render

This should eliminate render thrash and stop the “blank doc + blank library” intermittent state.

### 2) (If needed) Add minimal guardrails to reduce re-render spam
After step (1), the spam should stop. If it doesn’t, we’ll:
- add targeted logs in `EditorSidebar` and `Editor.tsx` to detect which state is toggling repeatedly (likely `masterLibraryOpen` or `activeSidebarTab`),
- inspect whether any `useEffect` is repeatedly calling `setActiveSidebarTab('library')` (there is one in `EditorSidebar` that can run whenever `isInMasterMode/activeEntityTab` changes).

But we should not preemptively change that logic until we confirm it still loops after fixing `lazyDialog`.

### 3) Verification checklist (what you should see after the fix)
After implementing step (1):

1. Open the Snippets (Master Library) dialog.
2. Click “Jump to document”.
3. The editor document should load.
4. The “Back to Snippets” bar should appear once (no render spam in console).
5. Clicking “Back to Snippets” should re-open Snippets with content (and no blank dialog).

Expected console behavior:
- The `[NavigationBackBar] Render check` log should appear a normal number of times (a couple on route changes), not dozens/hundreds.

## Files that will change
- `src/lib/lazyComponent.tsx`
  - Change `lazyDialog` to set `hasBeenOpened` via `useEffect` instead of during render.

## Why this is the right next step
Right now your symptoms alternate between:
- “button but blank content”
- “content but missing button”

That’s exactly what you get when React is forced into repeated rerenders while asynchronous navigation + dialog open/close are happening. Fixing the render-loop source restores determinism, and then any remaining navigation-state issues become straightforward to diagnose.

