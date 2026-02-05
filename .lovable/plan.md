
## Fix: Document Thumbnail Click Not Working

### Problem
When clicking on a document thumbnail in the Master Library's expanded entity section, nothing happens. The `isSelected` state isn't toggling.

### Root Cause
The `handleClick` function in `DocumentThumbnail` awaits `fetchSnippetsForDocument` **before** calling `setIsSelected(!isSelected)`:

```typescript
const handleClick = async (e: React.MouseEvent) => {
  e.stopPropagation();
  
  if (!isSelected) {
    // This await blocks the UI toggle
    const fetchedSnippets = await entityDocuments.fetchSnippetsForDocument(doc.id, entityName);
    setSnippets(fetchedSnippets);
    setCurrentSnippetIndex(0);
  }
  setIsSelected(!isSelected);  // Only runs after fetch completes
};
```

If the fetch fails or takes time, the selection toggle is delayed or never happens.

### Solution
Toggle `isSelected` immediately on click, then fetch snippets asynchronously. This provides instant feedback to the user:

```typescript
const handleClick = async (e: React.MouseEvent) => {
  e.stopPropagation();
  
  const newIsSelected = !isSelected;
  setIsSelected(newIsSelected);  // Toggle immediately
  
  if (newIsSelected) {
    // Fetch snippets asynchronously (don't block the toggle)
    const fetchedSnippets = await entityDocuments.fetchSnippetsForDocument(doc.id, entityName);
    setSnippets(fetchedSnippets);
    setCurrentSnippetIndex(0);
  }
};
```

### Additional Fix
Also add `onMouseDown` handler with `e.stopPropagation()` to prevent any mousedown capture at parent levels from interfering:

```typescript
<div 
  className={cn(...)}
  onClick={handleClick}
  onMouseDown={(e) => e.stopPropagation()}
  data-allow-pointer
>
```

### Files to Modify

| File | Change |
|------|--------|
| `src/components/editor/MasterLibraryDialog.tsx` | Fix `handleClick` to toggle state immediately, add `onMouseDown` handler |
