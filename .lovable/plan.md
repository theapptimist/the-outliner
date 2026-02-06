
# Fix "Back to Snippets" Opening Blank Dialog

## Problem
When clicking "Back to Snippets", the Master Library dialog opens but appears blank. This happens because:

1. The `lazyDialog` HOC keeps the component mounted after first open (to maintain stable hook counts)
2. When the dialog re-opens via "Back to Snippets", the component is already mounted with stale state
3. The data-fetching hooks (`useMasterEntities`, `useMasterLibraryDocuments`, etc.) run their initial `useEffect` on mount, not when `open` changes
4. Since the component doesn't unmount/remount, the data isn't refreshed

## Solution
Add explicit data refresh when the dialog's `open` prop transitions to `true`. This ensures fresh data loads every time the dialog opens, regardless of whether it's the first open or a subsequent one.

## Implementation

### File: `src/components/editor/MasterLibraryDialog.tsx`

Add a `useEffect` that triggers data refresh when `open` becomes `true`:

```typescript
// Refresh data every time dialog opens (not just on mount)
useEffect(() => {
  if (open) {
    // Refresh master entities
    refreshMaster();
    // Refresh documents
    refreshDocs();
    // Shared count is already fetched in existing effect
  }
}, [open, refreshMaster, refreshDocs]);
```

This needs to be placed after the hooks that provide `refreshMaster` and `refreshDocs` are declared.

Looking at the current code:
- Line 796: `const { entities: masterEntities, refresh: refreshMaster } = useMasterEntities();`
- Line 702: `const { documents: libraryDocuments, loading: loadingDocs, refresh: refreshDocs } = useMasterLibraryDocuments();`

I'll add a dedicated effect after these hooks to trigger refresh on every dialog open.

### Why This Works
- First open: Component mounts, initial useEffects run, data loads
- Subsequent opens: Component already mounted, but new effect detects `open=true` and explicitly calls refresh
- The existing `open`-gated effects (lines 806-838, 841-852, 854-858) will also run since they depend on `open`

### Technical Notes
- The `refreshMaster` and `refreshDocs` functions from hooks are stable (created with `useCallback`)
- This approach is safe and won't cause infinite loops since we only call refresh when `open` is `true`
- The existing loading states (`loading`, `loadingDocs`) will properly show spinners during refresh

## Files to Change

| File | Change |
|------|--------|
| `src/components/editor/MasterLibraryDialog.tsx` | Add `useEffect` to refresh data when `open` becomes `true` |

## Expected Outcome
1. User opens Master Library, views entities, clicks "Jump to document"
2. User clicks "Back to Snippets"
3. Master Library dialog opens with fresh data loading (shows loading spinner briefly)
4. Data populates correctly - no blank screen
