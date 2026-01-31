
## Goal
Make the **Review Document Plan** modal:
1) reliably appear every time (no “nothing comes up”), and  
2) be **top-aligned with internal scroll**, never running off the bottom.

## What’s happening now (likely root cause)
- `DialogContent` (in `src/components/ui/dialog.tsx`) bakes in **vertical centering + transform-based animations**:
  - `top-[50%] translate-y-[-50%]`
  - plus `data-[state=open]` “slide/zoom” animations that also manipulate `transform`.
- In `DocumentPlanDialog.tsx`, we’re currently setting `style.transform = 'translateX(-50%)'`.
  - This **overrides the entire transform stack**, which can unintentionally fight Radix/Tailwind animation transforms.
  - The result can be the dialog content ending up in a bad state (appearing “closed” / not visible), even though `open={true}` is set.
- So: we need to **stop overriding `transform` inline** and instead provide a **top-aligned DialogContent variant** that doesn’t rely on the centering transform logic.

## Implementation approach (robust + reusable)
Create a dedicated top-aligned dialog content component so we don’t have to “fight” the centered transform and animation system.

### 1) Add a “top aligned” DialogContent variant
**File:** `src/components/ui/dialog.tsx`

- Keep existing `DialogContent` unchanged (so we don’t regress other dialogs).
- Add a new export, e.g. `DialogContentTop` (name flexible), that:
  - Uses `fixed left-[50%] top-6 translate-x-[-50%]` and **no translate-y centering**
  - Uses safer animations that don’t depend on slide transforms that assume center positioning.
    - For example: fade + zoom only (or fade only).
  - Still includes the close button in the same place.

Conceptually:

- Base positioning:
  - `fixed left-[50%] top-6 z-50`
  - `translate-x-[-50%]` (horizontal centering)
  - no `translate-y-[-50%]`

- Animation classes (example direction):
  - keep `fade-in/out` + `zoom-in/out`
  - remove `slide-in-from-top-[48%]` / slide-out variants (they’re designed for centered positioning)

This isolates the “top aligned modal” behavior and avoids transform overrides in consumer components.

### 2) Update DocumentPlanDialog to use the top-aligned variant
**File:** `src/components/editor/DocumentPlanDialog.tsx`

- Replace `DialogContent` import usage with the new `DialogContentTop` (or whatever name we add).
- Remove the inline `top` and `transform` overrides completely.
- Keep only sizing in `style` (width/height/maxHeight), which is safe.

Non-fullscreen style should remain:
- `width: Math.min(size.width, window.innerWidth - 48)`
- `height: Math.min(size.height, window.innerHeight - 80)`
- `maxWidth: 'calc(100vw - 48px)'`
- `maxHeight: 'calc(100vh - 80px)'`

Fullscreen style:
- same width/height caps, just larger.

### 3) Make internal scrolling guaranteed
**File:** `src/components/editor/DocumentPlanDialog.tsx`

Ensure the ScrollArea can actually shrink within a constrained flex parent:
- Keep `DialogContentTop` as `flex flex-col overflow-hidden`
- Keep `ScrollArea` as `flex-1`
- If needed, add `min-h-0` to the flex container that wraps the scroll area (common fix when `flex-1` children refuse to shrink and overflow).
  - Example: apply `min-h-0` to the immediate parent container that contains `ScrollArea`, or to `DialogContentTop` itself.

### 4) Validate open/close behavior is not instantly dismissing
**File:** `src/components/editor/SectionAIChat.tsx`

No major logic changes expected, but we will verify:
- `setPlanDialogOpen(true)` is reached (it is today)
- the dialog isn’t being immediately closed by an `onOpenChange(false)` triggered by:
  - a focus/blur issue
  - pointer down outside
  - escape key handler

If we still see it closing immediately after the above changes, we’ll add a targeted fix (only if needed):
- Use Radix props such as `onPointerDownOutside={(e) => e.preventDefault()}` *temporarily* to confirm dismissal is the issue, then refine to the correct root cause.

## Why this plan should fix “nothing comes up”
- We stop overriding `transform` inline, which is currently the biggest risk factor for Radix/Tailwind transform-based animations and positioning.
- We avoid trying to “override” a centered dialog into being top-aligned; instead we render a dialog designed to be top-aligned from the start.

## Acceptance criteria (what you should see)
1. Clicking “Plan Document” shows the modal reliably every time.
2. The modal is anchored near the top (24px margin).
3. The bottom never goes off-screen; content scrolls internally.
4. Fullscreen toggle still works.
5. No regressions to other dialogs (since we don’t change the default DialogContent).

## Files to change
- `src/components/ui/dialog.tsx` (add `DialogContentTop` export)
- `src/components/editor/DocumentPlanDialog.tsx` (use top-aligned content variant; remove inline transform/top; ensure internal scroll works)
- (Optional validation only) `src/components/editor/SectionAIChat.tsx`

## Quick test checklist
- Desktop: open plan dialog, scroll within it, confirm footer buttons always reachable.
- Resize the dialog with the resize handle: confirm it clamps and still scrolls.
- Toggle fullscreen on/off: confirm it stays within viewport and does not disappear.
