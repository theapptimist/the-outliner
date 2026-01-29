
# Feature: Open/Close All AI Windows Control

## Overview

Add a toggle button that allows users to open or close all section AI windows simultaneously. This complements the True Multi-Window AI Cascade by giving users manual control over the visibility of all AI panels at once.

## Design Decision

**Location**: Add the control to the **first section's toolbar** (alongside existing block-level actions like Collapse/Delete). This follows the established pattern where block-level actions appear only on the first depth-0 section.

**Button Behavior**:
- When **some or no panels are open**: clicking opens ALL panels
- When **all panels are open**: clicking closes ALL panels
- Icon changes to reflect current state (similar to Collapse/Expand pattern)

## User Experience

```
Before clicking (some panels closed):
┌─ Section 1 ─ [AI] [Speed] [Link] [Import] [OpenAll] [Collapse] [Delete]
│   AI panel visible
├─ Section 2 ─ [AI] [Speed] [Link] [Import]
│   (panel closed)
├─ Section 3 ─ [AI] [Speed] [Link] [Import]
│   (panel closed)

After clicking "Open All":
┌─ Section 1 ─ [AI] [Speed] [Link] [Import] [CloseAll] [Collapse] [Delete]
│   AI panel visible
├─ Section 2 ─ [AI] [Speed] [Link] [Import]
│   AI panel visible
├─ Section 3 ─ [AI] [Speed] [Link] [Import]
│   AI panel visible
```

## Technical Changes

### 1. Update `SectionToolbar.tsx`

Add new props and button for the toggle-all functionality:

```typescript
export interface SectionToolbarProps {
  // ... existing props ...
  
  /** All section IDs (for open/close all) - only used on first section */
  allSectionIds?: string[];
  /** Number of currently open section panels */
  openPanelCount?: number;
  /** Callback to open all section panels */
  onOpenAllPanels?: () => void;
  /** Callback to close all section panels */
  onCloseAllPanels?: () => void;
}
```

Add the toggle button in the first-section block:
- Icon: `PanelTopOpen` when not all open, `PanelTopClose` when all open
- Or use `Sparkles` with `Plus`/`Minus` to indicate expanding/collapsing AI windows
- Simpler approach: use `ChevronsUp`/`ChevronsDown` icons (expand/collapse all)

### 2. Update `SimpleOutlineView.tsx`

Add handlers to open/close all section panels:

```typescript
// Handler to open ALL section panels
const handleOpenAllSectionPanels = useCallback(() => {
  const allDepth0Ids = nodes
    .filter(n => n.depth === 0 && n.type !== 'body')
    .map(n => n.id);
  setOpenSectionPanels(new Set(allDepth0Ids));
}, [nodes]);

// Handler to close ALL section panels
const handleCloseAllSectionPanels = useCallback(() => {
  setOpenSectionPanels(new Set());
}, []);

// Compute open panel count
const openPanelCount = openSectionPanels.size;
const allSectionIds = allSections.map(s => s.id);
```

Pass these to `SectionToolbar`:

```typescript
<SectionToolbar
  // ... existing props ...
  allSectionIds={allSectionIds}
  openPanelCount={openSectionPanels.size}
  onOpenAllPanels={handleOpenAllSectionPanels}
  onCloseAllPanels={handleCloseAllSectionPanels}
/>
```

### 3. Icon Selection

Use `Layers` or combine `Sparkles` with arrows:
- **Option A**: `ChevronsUp` (close all) / `ChevronsDown` (open all) - matches expand/collapse metaphor
- **Option B**: Custom icon pair like `PanelTopOpen` / `PanelTop` 
- **Option C**: Single `Sparkles` icon with overlay (`Plus` when closed, `Minus` when all open)

Recommend **Option A** (`ChevronsDown`/`ChevronsUp`) for clarity - it clearly indicates "expand all" vs "collapse all" similar to code folding conventions.

## Files to Modify

1. **`src/components/editor/SectionToolbar.tsx`**
   - Add new props: `allSectionIds`, `openPanelCount`, `onOpenAllPanels`, `onCloseAllPanels`
   - Add toggle button in the `isFirstSection` block
   - Import `ChevronsDown`, `ChevronsUp` from lucide-react

2. **`src/components/editor/SimpleOutlineView.tsx`**
   - Add `handleOpenAllSectionPanels` callback
   - Add `handleCloseAllSectionPanels` callback
   - Pass new props to `SectionToolbar` for first section only

## Visual Design

The button will follow the existing toolbar styling:
- `h-6 w-6 p-0` size
- `bg-background/80 backdrop-blur-sm` background
- Tooltip: "Open all AI panels" / "Close all AI panels"
- Position: between the Import button and Collapse button (logical grouping with AI functionality)
