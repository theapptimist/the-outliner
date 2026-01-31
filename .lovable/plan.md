
# Fix: Review Document Plan Dialog Positioned Too Low

## Problem Summary
The "Review Document Plan" modal appears **positioned too low** on the screen (not just too tall), causing it to run off the bottom of the viewport even on desktop.

## Root Cause
The dialog uses Radix UI's default vertical centering (`top-[50%] translate-y-[-50%]`), but when combined with a **stored or large explicit height** in the inline `style` attribute, the dialog can extend past the viewport bottom. The centering doesn't prevent overflow—it just centers the bounding box.

## User's Preferred Behavior
**Top-aligned + internal scroll** — anchor the dialog near the top of the screen with a margin, rather than centering it vertically.

---

## Implementation Plan

### File: `src/components/editor/DocumentPlanDialog.tsx`

### A. Switch to top-aligned positioning
Override the default vertical centering with top-aligned positioning:

**Add to `DialogContent` className:**
```tsx
className="relative flex flex-col overflow-hidden transition-all duration-200 !top-6 !translate-y-0"
```
- `!top-6` = 24px from the top of the viewport
- `!translate-y-0` = override the default `-translate-y-1/2` centering

### B. Ensure height never exceeds viewport
Update the inline `style` to cap height more strictly:

**For non-fullscreen mode:**
```tsx
style={{
  width: Math.min(size.width, window.innerWidth - 48),
  height: Math.min(size.height, window.innerHeight - 80), // Leave 24px top margin + 56px bottom margin
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 80px)',
}}
```

### C. Simplify fullscreen mode
Keep fullscreen using `inset-4` equivalent but with consistent margins:
```tsx
style={isFullscreen ? {
  width: 'calc(100vw - 48px)',
  height: 'calc(100vh - 80px)',
  maxWidth: 'calc(100vw - 48px)',
  maxHeight: 'calc(100vh - 80px)',
} : { ... }}
```

---

## Technical Summary

| Change | Purpose |
|--------|---------|
| `!top-6 !translate-y-0` | Anchor dialog 24px from top instead of centering |
| `height: Math.min(size.height, window.innerHeight - 80)` | Prevent overflow past viewport bottom |
| `maxHeight: calc(100vh - 80px)` | Enforce CSS-level height cap |

---

## Expected Results
1. The dialog always appears near the top of the screen (24px margin)
2. It never runs off the bottom of the viewport
3. Content scrolls internally via the existing `ScrollArea`
4. Resize handle still works within viewport bounds
5. Fullscreen mode still fills most of the screen with consistent margins
