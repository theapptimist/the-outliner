
# Fix: Jump to Document Not Working in Master Library

## Root Cause Analysis

After tracing the code flow, I've identified the issue:

1. When clicking "Jump to document", `handleJumpToDocument` is called
2. It logs: `[MasterLibrary] handleJumpToDocument called` ✓
3. The dialog closes via `onOpenChange(false)`
4. Navigation is deferred via `requestAnimationFrame`
5. It logs: `[MasterLibrary] Executing navigation` ✓
6. The context handler logs: `[nav] navigating to` ✓
7. `onNavigateToDocument(documentId)` is called
8. **But no network request is made for the target document**

The problem is that when the dialog closes, React may be unmounting or re-rendering components. The `requestAnimationFrame` callback runs, but by then the function references may have been affected by React's reconciliation cycle. Additionally, `loadCloudDocument` internally uses `withRetry`, which doesn't have logging, so we can't see if it's entering or failing silently.

**Key finding**: There's no logging in `handleNavigateToDocument` or `loadCloudDocument` to confirm they're being entered. The navigation chain appears to complete, but we have no visibility into whether the actual async document loading is happening.

## The Fix

### 1. Add instrumentation to confirm the navigation function is being called
Add console logging at the entry point of `handleNavigateToDocument` in Editor.tsx to confirm it receives the call.

### 2. Navigate BEFORE closing the dialog (not after)
The current flow:
1. Close dialog → `onOpenChange(false)`
2. Wait for `requestAnimationFrame`
3. Call `navigateToDocument`

This creates a race condition where the dialog unmounting can interfere with the navigation. Instead:
1. Call `navigateToDocument` directly
2. Let the navigation complete (or at least start)
3. Close dialog as part of navigation success

### 3. Remove `requestAnimationFrame` deferral
The `requestAnimationFrame` was added for UI smoothness, but it's causing the navigation to fail. The navigation should happen immediately while the context is still valid.

## Files to Change

| File | Changes |
|------|---------|
| `src/components/editor/MasterLibraryDialog.tsx` | Reorder: navigate first, close dialog in callback or after |
| `src/pages/Editor.tsx` | Add entry logging to `handleNavigateToDocument` |
| `src/lib/cloudDocumentStorage.ts` | Add entry logging to `loadCloudDocument` |

## Technical Details

### Current problematic flow in MasterLibraryDialog.tsx (lines 756-792):
```javascript
const handleJumpToDocument = useCallback((docId: string) => {
  setIsNavigating(true);
  
  // Close the dialog first ← PROBLEM: This triggers unmount/re-render
  onOpenChange(false);
  
  // Defer navigation ← PROBLEM: By now context may be stale
  requestAnimationFrame(() => {
    if (navigateToDocument) {
      navigateToDocument(docId, '');
    }
    setIsNavigating(false);
  });
}, [onOpenChange, onJumpToDocument, navigateToDocument, currentDoc?.meta?.id]);
```

### Fixed flow:
```javascript
const handleJumpToDocument = useCallback((docId: string) => {
  if (currentDoc?.meta?.id === docId) {
    onOpenChange(false);
    return;
  }
  
  setIsNavigating(true);
  
  // Navigate IMMEDIATELY while context is valid
  if (navigateToDocument) {
    navigateToDocument(docId, '');
  } else if (onJumpToDocument) {
    onJumpToDocument(docId);
  }
  
  // Close dialog AFTER navigation is triggered
  onOpenChange(false);
  setIsNavigating(false);
}, [onOpenChange, onJumpToDocument, navigateToDocument, currentDoc?.meta?.id]);
```

## Test Plan

1. Open Master Library
2. Expand an entity with documents
3. Click on a document thumbnail
4. Click "Jump to document"
5. Verify:
   - Console shows `[nav] handleNavigateToDocument called`
   - Console shows `[CloudStorage] Loading document: ...`
   - Document loads in the editor
   - Dialog closes after navigation completes

