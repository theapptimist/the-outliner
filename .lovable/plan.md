
# Fix: Navigation Stack Timing Race Condition

## Root Cause Analysis

After tracing through the code, I found a fundamental timing bug in how the navigation history is being recorded.

### The Problem

In `MasterLibraryDialog.tsx`, the `handleJumpToDocument` function has this sequence:

```
1. onOpenChange(false)  ← Triggers React re-render
2. requestAnimationFrame(() => {
     pushDocument(...)  ← Updates navigation stack
     navigate(...)
   })
```

This causes:
1. Dialog closes → React re-renders the entire component tree
2. `NavigationBackBar` checks `canGoBack` (which is `false` because stack is empty)
3. `NavigationBackBar` returns `null` (hidden)
4. Only THEN does `requestAnimationFrame` fire and update the stack
5. The back bar has already rendered as hidden and doesn't re-render

### The Solution

**Push the navigation entry BEFORE closing the dialog.** The order must be:

```
1. pushDocument(...)    ← Stack updated first
2. onOpenChange(false)  ← Dialog closes, React re-renders with correct stack
3. navigate(...)        ← Load the document
```

This ensures when React re-renders after the dialog closes, the `NavigationBackBar` sees `canGoBack = true` and `currentOrigin.type = 'master-library'`.

---

## Implementation

### File: `src/components/editor/MasterLibraryDialog.tsx`

**Change the `handleJumpToDocument` function** (around lines 762-787):

**Current (buggy) code:**
```typescript
const handleJumpToDocument = useCallback((docId: string) => {
  if (currentDoc?.meta?.id === docId) {
    onOpenChange(false);
    return;
  }
  
  setIsNavigating(true);
  onOpenChange(false);  // ← Step 1: Close triggers re-render
  
  requestAnimationFrame(() => {
    pushDocument('master-library', 'Snippets', { type: 'master-library' }); // ← Step 2: Too late!
    if (onJumpToDocument) onJumpToDocument(docId);
    else if (navigateToDocument) navigateToDocument(docId, '');
    setIsNavigating(false);
  });
}, [...]);
```

**New (fixed) code:**
```typescript
const handleJumpToDocument = useCallback((docId: string) => {
  // Don't navigate if already on this document
  if (currentDoc?.meta?.id === docId) {
    onOpenChange(false);
    return;
  }
  
  setIsNavigating(true);
  
  // CRITICAL: Push navigation entry BEFORE closing dialog
  // This ensures NavigationBackBar sees the entry when it re-renders
  pushDocument('master-library', 'Snippets', { type: 'master-library' });
  
  // Close dialog - React will re-render with the stack already updated
  onOpenChange(false);
  
  // Navigate after a microtask to let the dialog close animation start
  // Using queueMicrotask instead of requestAnimationFrame for more reliable timing
  queueMicrotask(() => {
    if (onJumpToDocument) {
      onJumpToDocument(docId);
    } else if (navigateToDocument) {
      navigateToDocument(docId, '');
    }
    setIsNavigating(false);
  });
}, [onOpenChange, onJumpToDocument, navigateToDocument, currentDoc?.meta?.id, pushDocument]);
```

**Key changes:**
1. `pushDocument()` moved BEFORE `onOpenChange(false)`
2. Changed `requestAnimationFrame` to `queueMicrotask` for more predictable timing
3. Only the navigation call is deferred, not the stack push

---

## Why This Fixes Both Issues

### "Back to Snippets" appearing:
- The stack entry exists BEFORE the dialog close triggers re-render
- `NavigationBackBar` sees `canGoBack = true` and renders correctly

### No "double spinner" hang:
- `queueMicrotask` still defers navigation to allow dialog close animation
- Navigation happens in the next microtask, not blocking the current frame

---

## Verification Steps

1. Open Snippets → expand any entity → click "Jump to document"
2. **Verify**: "Back to Snippets" bar appears immediately
3. Click "Back to Snippets"
4. **Verify**: Snippets modal opens without stuck loading state
5. Repeat the cycle 5-10 times rapidly to confirm stability

---

## Files Changed

- `src/components/editor/MasterLibraryDialog.tsx` (single function reorder)

## Risk Assessment

**Low risk** - This is a single function reorder that fixes a race condition. The logic remains the same; only the execution order changes.
