
# Fix: File Menu Sheet Visual Alignment

## Problems Identified

Looking at the screenshot, there are three distinct visual issues:

1. **Background color mismatch**: The File menu sheet has a plain `bg-background` color while the sidebar uses a gradient (`bg-gradient-to-b from-muted/30 via-background to-muted/20`)
2. **Border discontinuity**: The sheet has a `border-r` from the default sheetVariants, creating a visible right edge that doesn't match the sidebar's border styling
3. **Top position misalignment**: The sheet overlaps with the navigation icons because the `top-[120px]` offset doesn't match the actual header height

## Root Cause

The Sheet component renders in a **portal** (outside the sidebar DOM), so it:
- Doesn't inherit the sidebar's gradient background
- Uses its own `bg-background` and `border-r` from the base variant
- Needs an exact pixel offset that may not match the dynamic header

## Solution

### 1. Match the background gradient

Add the same gradient background to the SheetContent that the sidebar uses:

```tsx
className="... bg-gradient-to-b from-muted/30 via-background to-muted/20"
```

### 2. Override the border

Add `border-r-0` or `border-r-border/30` to match the sidebar's subtle border styling.

### 3. Adjust the top offset

Looking at the EditorSidebar header structure:
- Title row: `py-2.5 pt-3` = ~36px
- Nav icons row: `pb-2` + buttons (h-7 = 28px) = ~40px
- Accent lines: `h-[3px]` x2 = 6px
- **Total: ~82-90px**

But the sidebar header also has margin from the "THE OUTLINER" section. Let me calculate the exact offset by looking at the layout:
- Title section padding + collapse button
- Divider line (`mb-1`)
- Nav icons section (`pb-2`)
- Bottom accent lines (`h-[3px]`)

The current `top-[120px]` is too far down, causing the gap. We need to match the exact pixel position where the sidebar content area starts.

**Alternative approach**: Instead of using a fixed pixel offset, we can make the sheet start from `top-0` but add internal padding/structure that visually aligns with the header. However, this is more complex.

**Simpler fix**: Adjust the offset to match the actual header height and apply matching styles.

---

## Technical Changes

### File: `src/components/editor/FileMenu.tsx`

Lines 297-302: Update SheetContent className to:
1. Add matching gradient background
2. Match border styling
3. Adjust top offset to align with sidebar content area

```tsx
<SheetContent
  data-allow-pointer
  side="left"
  overlayClassName="bg-transparent"
  className="w-56 p-0 font-sans duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none top-[120px] h-[calc(100%-120px)] bg-gradient-to-b from-muted/30 via-background to-muted/20 border-r-border/30"
  hideCloseButton
>
```

### Alternative: Override base styles in sheet.tsx

If the className override doesn't work due to specificity, we may need to modify the sheet's base variant to allow background overrides.

---

## Verification

After implementation:
1. Open File menu - should have matching gradient background
2. Check border alignment - right edge should match sidebar's border
3. Verify no overlap with navigation icons
4. Test in both light and dark mode
