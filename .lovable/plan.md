
# Add "Back to Snippets" Navigation from Master Library

## Problem
When using "Jump to document" from the Master Library, there's no way to return to the snippet view. Currently:
- The system tries to push the current document to the navigation stack
- If that document is unsaved ("Untitled"), clicking "Back" leads to a broken state
- Even if it works, it goes back to a document, not back to the Master Library

## Solution
Add a special navigation entry type that represents "came from Master Library" so the Back button can return the user to the snippet view.

## Implementation

### 1. Extend Navigation Entry Type
Modify `NavigationContext.tsx` to support a special "master-library" origin type:

```typescript
export interface NavigationEntry {
  id: string;
  title: string;
  type?: 'document' | 'master-library';  // New field
  entityId?: string;     // Which entity was expanded (for restoration)
  entityType?: EntityType;  // Type of entity
}
```

### 2. Track Master Library State
When jumping from Master Library, push a special entry:

```typescript
// In MasterLibraryDialog handleJumpToDocument:
pushDocument('master-library', 'Snippets', {
  type: 'master-library',
  entityId: currentEntityId,
  entityType: currentEntityType,
});
```

### 3. Update NavigationBackBar
Modify `NavigationBackBar.tsx` to:
- Detect when origin is `type: 'master-library'`
- Show "Back to Snippets" instead of "Back to [document title]"
- Call a different handler that re-opens the Master Library dialog

### 4. Re-open Master Library on Back
Add a callback prop to `NavigationBackBar` for opening the Master Library:

```typescript
interface NavigationBackBarProps {
  onNavigateBack: (documentId: string) => void;
  onOpenMasterLibrary?: () => void;  // New prop
}
```

When the origin type is `master-library`, call `onOpenMasterLibrary()` instead of `onNavigateBack()`.

## Files to Change

| File | Change |
|------|--------|
| `src/contexts/NavigationContext.tsx` | Add `type` and optional entity tracking fields to `NavigationEntry` |
| `src/components/editor/MasterLibraryDialog.tsx` | Push `master-library` type entry instead of document entry |
| `src/components/editor/NavigationBackBar.tsx` | Handle `master-library` origin type, show "Back to Snippets" |
| `src/pages/Editor.tsx` | Pass `onOpenMasterLibrary` callback to NavigationBackBar |

## User Experience

**Before:**
1. Click "Jump to document" from Master Library
2. See "Back to Untitled" bar (or broken navigation)
3. Click Back → document disappears, broken state

**After:**
1. Click "Jump to document" from Master Library
2. See "Back to Snippets" bar
3. Click Back → Master Library re-opens to the same entity view

## Technical Notes
- The entity ID and type are tracked so we can potentially restore the exact expanded state when returning (future enhancement)
- This approach cleanly separates "go back to a document" from "go back to a UI view"
- The existing document-to-document navigation continues to work unchanged
