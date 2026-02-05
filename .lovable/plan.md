
## Fix: Snippets Not Showing & Document Jump Not Loading

### Problem 1: Snippets Not Showing
The `findSnippetsInHierarchy` function has several issues:

1. **Regex state issue**: Using `regex.test()` followed by `regex.match()` on a global regex (`/gi`) causes the `lastIndex` to advance after `test()`, making the subsequent `match()` unreliable.

2. **escapeRegex defined inside loop scope**: The `escapeRegex` function is defined inside `findSnippetsInHierarchy` but after the regex is created on line 35, meaning it's undefined when first called.

3. **Debug logging missing**: No way to see what's happening during snippet search.

### Problem 2: Jump to Document Not Loading
The navigation flow closes the dialog first, but the `handleJumpToDocument` callback might be getting garbage-collected or the timing is off. Additionally, `onJumpToDocument` is optional (`onJumpToDocument?.(docId)`) so if the prop isn't correctly wired, nothing happens.

### Solution

#### Fix 1: Reorder `escapeRegex` and fix regex usage
Move `escapeRegex` function definition before it's used, and reset regex lastIndex or use a simpler matching approach:

```typescript
function findSnippetsInHierarchy(
  hierarchyBlocks: Record<string, any>,
  searchTerm: string
): DocumentSnippet[] {
  const snippets: DocumentSnippet[] = [];
  const termLower = searchTerm.toLowerCase();
  
  // Move escapeRegex BEFORE it's used
  function escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  
  // Create regex after escapeRegex is defined
  const escapedTerm = escapeRegex(searchTerm);
  
  function scanNode(node: any, blockId: string) {
    // Check label - use simple includes() check first, then extract snippet
    if (node.label) {
      const labelLower = node.label.toLowerCase();
      const idx = labelLower.indexOf(termLower);
      if (idx !== -1) {
        const start = Math.max(0, idx - 40);
        const end = Math.min(node.label.length, idx + searchTerm.length + 40);
        let snippet = node.label.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < node.label.length) snippet = snippet + '...';
        
        snippets.push({
          text: snippet,
          nodeLabel: node.label.substring(0, 50),
          blockId,
          nodeId: node.id,
        });
      }
    }
    // ... similar fix for content
  }
  // ...
}
```

#### Fix 2: Ensure navigation happens after dialog closes
Use `setTimeout` to defer navigation until after dialog close animation:

```typescript
const handleJumpToDocument = useCallback((docId: string) => {
  onOpenChange(false); // Close the dialog
  // Defer navigation to ensure dialog fully closes
  setTimeout(() => {
    onJumpToDocument?.(docId);
  }, 100);
}, [onOpenChange, onJumpToDocument]);
```

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useEntityDocuments.ts` | Fix `escapeRegex` ordering, simplify matching logic to use `indexOf` instead of global regex |
| `src/components/editor/MasterLibraryDialog.tsx` | Add `setTimeout` delay in `handleJumpToDocument` to ensure dialog closes before navigation |
