
# Fix: File Menu Sheet Visual Alignment

## Problems Identified

From the screenshot and code analysis:

1. **Background color mismatch**: The Sheet uses `bg-background` (from `sheetVariants` line 32), while the sidebar uses `bg-gradient-to-b from-muted/30 via-background to-muted/20`

2. **Border discontinuity**: The Sheet's `side="left"` variant includes `border-r` (line 38 in sheet.tsx), creating a visible right edge that clashes with the sidebar

3. **Missing gradient overlay**: The sidebar has an `absolute inset-0` gradient overlay (line 160), which the Sheet doesn't have

## Root Cause

The Sheet renders in a **portal** outside the sidebar DOM tree, so it:
- Uses the default `bg-background` from `sheetVariants`
- Has its own `border-r` from the left-side variant
- Doesn't inherit the sidebar's gradient styling

## Solution

Apply matching styles to the `SheetContent` className to override the defaults:

1. **Add the gradient background** - Match the sidebar's gradient
2. **Override the border** - Use `border-r-0` or a subtle border that matches
3. **Add the decorative accent line** - Match the sidebar's left edge accent

## Technical Changes

### File: `src/components/editor/FileMenu.tsx`

Update the `SheetContent` className (lines 297-302) to:

```tsx
<SheetContent
  data-allow-pointer
  side="left"
  overlayClassName="bg-transparent"
  className="w-56 p-0 font-sans duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none top-[120px] h-[calc(100%-120px)] bg-gradient-to-b from-muted/30 via-background to-muted/20 border-r-0"
  hideCloseButton
>
  {/* Add decorative accent line matching sidebar */}
  <div className="absolute left-0 top-0 bottom-0 w-[2px] bg-gradient-to-b from-primary via-accent to-primary/50 opacity-50" />
  ...
```

The key changes:
- `bg-gradient-to-b from-muted/30 via-background to-muted/20` - Matches sidebar gradient
- `border-r-0` - Removes the default right border from left-side variant
- Add the decorative accent line div inside the SheetContent

## Verification

After implementation:
1. Open File menu - background should match sidebar gradient
2. Check right edge - no visible border line between menu and content
3. Check left edge - decorative accent line should be visible
4. Test in both light and dark mode
