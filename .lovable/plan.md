
# Fix: "Back to Snippets" Button Not Appearing After Jump

## Problem Summary
When you click "Jump to document" from the Master Library (Snippets), the document loads correctly but the "Back to Snippets" button doesn't appear. This happens because the navigation stack update (`pushDocument`) is racing with the dialog close and document load sequence.

## Root Cause
The `handleJumpToDocument` function in `MasterLibraryDialog.tsx` does:
1. Push `'master-library'` to navigation stack
2. Close the dialog
3. Navigate (in `requestAnimationFrame`)

The problem: `pushDocument` is called inside a lazy-loaded component (`lazyDialog` wrapper). When the dialog closes immediately after, React's batching may not guarantee the stack update is committed before `NavigationBackBar` checks `canGoBack`.

## Solution
Move the `pushDocument` call **outside** the lazy-loaded dialog - into the parent's navigation callback. This ensures the stack push happens in a stable component (`Editor.tsx`) that doesn't unmount during navigation.

## Implementation

### File: `src/pages/Editor.tsx`

Create a new wrapper function that:
1. Pushes `'master-library'` to the navigation stack
2. Then navigates to the document

```typescript
// New function around line 452 (after handleNavigateToDocument)
const handleJumpFromMasterLibrary = useCallback((docId: string) => {
  // Push master-library origin to stack BEFORE navigating
  // This happens in a stable component, not the lazy dialog
  const { pushDocument } = /* get from context or pass down */;
  pushDocument('master-library', 'Snippets', { type: 'master-library' });
  
  // Now navigate
  handleNavigateToDocument(docId, true);
}, [handleNavigateToDocument]);
```

**However**, since `Editor.tsx` is outside `NavigationProvider`, we need to:
1. Either move the push logic into `EditorContent` (which is inside the provider), OR
2. Pass a specialized callback from `EditorContent` to `EditorSidebar`

The cleanest approach is option 2:

### Detailed Changes

**1. `src/pages/Editor.tsx` - EditorContent component (lines 68-205)**

Add a new callback that wraps navigation with the stack push:

```typescript
// Inside EditorContent, after the existing useNavigation destructure (line 85)
const handleJumpFromMasterLibrary = useCallback((docId: string) => {
  // Push master-library to stack before navigating
  pushDocument('master-library', 'Snippets', { type: 'master-library' });
  onNavigateToDocument(docId);
}, [pushDocument, onNavigateToDocument]);
```

Then expose this via a new prop to the parent, OR pass it down through EditorSidebar.

**2. `src/components/editor/MasterLibraryDialog.tsx` - handleJumpToDocument (lines 758-785)**

Remove the `pushDocument` call from inside the dialog - the parent will handle it.

Change from:
```typescript
pushDocument('master-library', 'Snippets', { type: 'master-library' });
onOpenChange(false);
requestAnimationFrame(() => {
  if (onJumpToDocument) {
    onJumpToDocument(docId);
  }
  ...
});
```

To:
```typescript
onOpenChange(false);
requestAnimationFrame(() => {
  if (onJumpToDocument) {
    onJumpToDocument(docId);
  }
  ...
});
```

**3. Threading the callback**

- `Editor.tsx` creates a callback in `EditorContent` that does: push + navigate
- Pass it to `EditorSidebar` as `onJumpFromMasterLibrary`
- `EditorSidebar` passes it to `LazyMasterLibraryDialog` as `onJumpToDocument`

## Technical Details

### Why this works
- `pushDocument` is now called in `EditorContent`, which is a stable component that doesn't unmount
- The stack update commits before navigation starts
- `NavigationBackBar` (also in `EditorContent`) will see `canGoBack = true` after the document loads

### Files to modify
1. `src/pages/Editor.tsx` - Add `handleJumpFromMasterLibrary` in `EditorContent`, pass through props
2. `src/components/editor/EditorSidebar.tsx` - Accept and pass through the new callback
3. `src/components/editor/MasterLibraryDialog.tsx` - Remove the `pushDocument` call

## Verification Checklist
After implementation:
1. Open Snippets (Master Library)
2. Expand any entity, click "Jump to document"
3. Document should load
4. "Back to Snippets" bar should appear at the top
5. Clicking "Back to Snippets" should reopen the Master Library
6. Repeat 5 times to confirm reliability
