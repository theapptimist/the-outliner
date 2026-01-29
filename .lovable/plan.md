
# Plan: Update "Link to Document" Text to "Link document"

## Summary

Update the chain icon tooltip and dialog title to use "Link document" instead of "Link to Document" for consistency.

## Changes

### 1. `src/components/editor/HierarchyBlockView.tsx`
- **Line 901**: Change tooltip text from `"Link to Document"` to `"Link document"`

### 2. `src/components/editor/LinkDocumentDialog.tsx`
- **Line 50**: Change `DialogTitle` from `"Link to Document"` to `"Link document"`

## Summary Table

| File | Line | Current | New |
|------|------|---------|-----|
| `HierarchyBlockView.tsx` | 901 | `"Link to Document"` | `"Link document"` |
| `LinkDocumentDialog.tsx` | 50 | `"Link to Document"` | `"Link document"` |
