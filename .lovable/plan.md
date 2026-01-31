

# Fix: Review Document Plan Dialog Not Rendering

## Problem Summary
When clicking "Plan Doc", the screen darkens (overlay renders) but the modal content never appears. Console shows:
```
Warning: Function components cannot be given refs... Check the render method of `DocumentPlanDialog`.
```

## Root Cause Analysis
After investigation, the issue has **two layers**:

### Layer 1: Tooltip Ref Warning
The `Tooltip` component inside `DocumentPlanDialog` is triggering a ref warning. While this warning alone shouldn't break rendering, it indicates instability in the component tree that could affect Radix's focus management.

### Layer 2: Missing TooltipProvider
Looking at the component structure, `DocumentPlanDialog` uses `Tooltip` directly without being wrapped in a `TooltipProvider`. While this often works, when combined with Radix Dialog's portal behavior and focus management, it can cause the Tooltip to fail to initialize properly, which in turn can break the entire content subtree.

The dialog content IS mounting (React renders it), but the animation/visibility system isn't completing properly, leaving the content in an invisible state.

## Solution

### 1. Wrap the dialog content internals in a TooltipProvider
**File:** `src/components/editor/DocumentPlanDialog.tsx`

Add `TooltipProvider` import and wrap the content that contains Tooltips:

```tsx
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';

// Inside the return:
<DialogContentTop ...>
  <TooltipProvider>
    {/* All content that uses Tooltip */}
  </TooltipProvider>
</DialogContentTop>
```

### 2. Use Button component instead of raw button for the fullscreen toggle
The `TooltipTrigger asChild` pattern works more reliably with `forwardRef`-capable components. Replace the raw `<button>` with the project's `Button` component:

```tsx
<TooltipTrigger asChild>
  <Button
    variant="ghost"
    size="icon"
    onClick={() => setIsFullscreen(!isFullscreen)}
    className="absolute right-12 top-4 h-6 w-6 opacity-70 hover:opacity-100"
    aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
  >
    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
  </Button>
</TooltipTrigger>
```

### 3. Add explicit visibility styles to DialogContentTop
As a defensive measure, ensure the dialog content can't get stuck in an invisible state:

**File:** `src/components/ui/dialog.tsx`

Add explicit opacity and visibility to the base styles to prevent animation state issues:

```tsx
className={cn(
  "fixed left-[50%] top-6 z-50 flex flex-col w-full max-w-lg -translate-x-1/2 gap-4 border bg-background p-6 shadow-lg duration-200",
  // Animation classes
  "data-[state=open]:animate-in data-[state=closed]:animate-out",
  "data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0",
  "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95",
  "sm:rounded-lg",
  className,
)}
```

Note: Changed `grid` to `flex flex-col` to match the consumer's flex layout needs.

---

## Files to Modify

| File | Change |
|------|--------|
| `src/components/editor/DocumentPlanDialog.tsx` | Add `TooltipProvider` wrapper; replace raw `<button>` with `Button` component |
| `src/components/ui/dialog.tsx` | Update `DialogContentTop` to use `flex flex-col` instead of `grid` |

---

## Expected Outcome
1. Dialog appears reliably when clicking "Plan Doc"
2. Modal is anchored 24px from top of viewport
3. Content scrolls internally
4. No ref warnings in console
5. Fullscreen toggle and all buttons work correctly

