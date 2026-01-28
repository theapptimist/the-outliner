
# Plan: Fix AI Icon Vertical Alignment in Outline Hover Toolbar

## Problem Analysis

The AI sparkle icon and the other toolbar icons (Play, Link, Upload, Expand, Delete) appear misaligned because they use two completely different positioning systems:

**Current Architecture:**
- **AI Icon (SectionPanelToggle)**: Rendered INSIDE the row grid in `SimpleOutlineView.tsx`, positioned in the third column with `items-center` and `mr-32` right margin
- **Other Toolbar Icons**: Rendered OUTSIDE the rows in `HierarchyBlockView.tsx` as a floating `absolute top-3 right-2 -translate-y-1/2` container

These are fundamentally different coordinate systems, making it very difficult to align them vertically.

## Solution

The cleanest fix is to **move the AI icon INTO the same floating toolbar container** as the other icons in `HierarchyBlockView.tsx`. This ensures all icons share the same positioning logic.

However, this requires passing information about which row is currently hovered (to know if we're on a depth-0 node) up from `SimpleOutlineView` to `HierarchyBlockView`. Since section panels are complex and tied to specific nodes, a simpler approach is:

**Recommended Approach:** Adjust the SectionPanelToggle container to use absolute positioning that matches the floating toolbar:

1. Change the AI icon wrapper from grid-based positioning to absolute positioning
2. Position it to align with the floating toolbar (which uses `top-3 -translate-y-1/2`)
3. Use `right-[calc(2rem+X)]` to position it just to the left of the existing toolbar

## Technical Changes

### File: `src/components/editor/SimpleOutlineView.tsx`

**Change the grid template for depth-0 rows back to 2 columns:**
```tsx
// Line ~1268: Remove the third column for depth-0 rows
gridTemplateColumns: '3.5rem 1fr'  // Same for all rows
```

**Move the AI toggle to absolute positioning within the row:**
```tsx
// Line ~1700-1721: Update the wrapper div
{isDepth0 && (
  <div className={cn(
    "absolute top-3 right-[calc(0.5rem+8rem)] -translate-y-1/2 flex items-center transition-opacity z-10",
    isSectionPanelOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
  )}>
    <SectionPanelToggle ... />
  </div>
)}
```

The key changes:
- `absolute` positioning instead of grid column
- `top-3 -translate-y-1/2` matches the floating toolbar exactly
- `right-[calc(0.5rem+8rem)]` positions it ~8.5rem from the right (leaving room for the 5-icon toolbar at `right-2`)
- Remove `mr-32` since we're using absolute positioning

**Ensure the row container has `relative` positioning:**
The row container already has `group` class but needs `relative` for absolute children:
```tsx
// Line ~1261: Add relative to the row div
className={cn(
  'grid items-start py-0.5 px-2 cursor-text group transition-all duration-300 relative',
  ...
)}
```

### File: `src/components/editor/SectionControlPanel.tsx`

**Match button sizing to the toolbar buttons:**
```tsx
// Line ~133-145: Update button styling to match toolbar buttons
<button
  onClick={(e) => { ... }}
  onPointerDown={(e) => e.stopPropagation()}
  className={cn(
    "h-6 w-6 p-0 flex items-center justify-center rounded hover:bg-foreground/10 text-muted-foreground hover:text-foreground transition-colors bg-background/80 backdrop-blur-sm",
    isOpen && "text-primary bg-primary/10"
  )}
>
  <Sparkles className="h-3 w-3" />
</button>
```

Changes:
- Add `h-6 w-6 p-0` to match toolbar button sizing
- Add `flex items-center justify-center` for icon centering
- Add `bg-background/80 backdrop-blur-sm` to match toolbar button styling
- Change icon from `w-3.5 h-3.5` to `h-3 w-3` to match other icons

## Summary of Changes

| File | Change |
|------|--------|
| `SimpleOutlineView.tsx` | Add `relative` to row container class |
| `SimpleOutlineView.tsx` | Change AI toggle wrapper to absolute positioning with `top-3 right-[calc(0.5rem+8rem)] -translate-y-1/2` |
| `SimpleOutlineView.tsx` | Remove third grid column from depth-0 rows |
| `SectionControlPanel.tsx` | Update button to `h-6 w-6 p-0` with centered flex layout |
| `SectionControlPanel.tsx` | Change Sparkles icon to `h-3 w-3` to match toolbar |
| `SectionControlPanel.tsx` | Add `bg-background/80 backdrop-blur-sm` for consistent styling |

This ensures the AI icon uses the exact same coordinate system and sizing as the other toolbar icons, guaranteeing vertical alignment.
