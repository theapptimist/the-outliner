
# Fix: File Menu Width Mismatch with Sidebar

## Problem Identified

When the File menu opens, the panel is **narrower than the sidebar**, causing a visible strip of misaligned styling on the right edge. This is because:

- **Sidebar width**: `w-64` (256px) when expanded
- **File menu width**: `w-56` (224px)

This 32px difference creates a visual seam where the sidebar background shows through next to the File menu panel.

## Solution

Change the FileMenu `SheetContent` width from `w-56` to `w-64` so it matches the expanded sidebar width exactly.

## Technical Changes

### File: `src/components/editor/FileMenu.tsx`

**Line 301**: Update the `SheetContent` className:

```tsx
// Before
className="w-56 p-0 font-sans ..."

// After  
className="w-64 p-0 font-sans ..."
```

This single change ensures the File menu panel aligns perfectly with the sidebar, eliminating the width mismatch that causes the visual seam.

## Verification

After implementation:
1. Open the File menu with the sidebar expanded
2. The panel should now be the same width as the sidebar (256px)
3. No visible strip or color mismatch should appear on the right edge
