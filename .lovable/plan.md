
# Plan: Fix Section AI Insert to Preserve Hierarchy Structure

## Problem Summary

When the Section AI Chat generates hierarchical content (e.g., "Social Strata" at depth 0 with "Division between Patricians and Plebeians" at depth 1), clicking "Insert" flattens everything to the same level. Items that should be nested appear as siblings (1j, 1k, 1l...) instead of parent-child relationships.

## Root Cause

The `onInsertSectionContent` handler in `HierarchyBlockView.tsx` (lines 1049-1070) has this logic:

```typescript
onInsertSectionContent={(sectionId, items) => {
  items.forEach((item, idx) => {
    // BUG: Always uses sectionId as parent, ignoring item.depth
    const newNode = createNode(sectionId, 'default', item.label);
    setTree(prev => insertNode(prev, newNode, sectionId, ...));
  });
}}
```

Every item is inserted as a direct child of the section, regardless of its `depth` value.

## Solution

Adapt the proven hierarchy-building logic from `handlePasteHierarchy` (lines 546-616) for section content insertion. This function already correctly:
- Maintains a `parentStack` to track parents at each depth level
- Inserts items at depth 0 as direct children of the section
- Inserts deeper items as children of the appropriate parent node

## Technical Changes

### File: `src/components/editor/HierarchyBlockView.tsx`

Replace the `onInsertSectionContent` handler with a proper hierarchy builder:

**Lines 1049-1070** - Replace with:

```typescript
onInsertSectionContent={(sectionId, items) => {
  if (items.length === 0) return;
  
  const sectionNode = findNode(tree, sectionId);
  if (!sectionNode) return;
  
  // Filter out empty items
  const filteredItems = items.filter(item => item.label.trim().length > 0);
  if (filteredItems.length === 0) return;
  
  // Build hierarchy nodes respecting depth
  // parentStack[0] = sectionId (depth 0 items become children of section)
  const parentStack: (string)[] = [sectionId];
  let lastInsertedId: string | undefined;
  
  setTree(prev => {
    let next = prev;
    const baseIndex = sectionNode.children?.length || 0;
    let insertIndex = baseIndex;
    
    for (let i = 0; i < filteredItems.length; i++) {
      const item = filteredItems[i];
      
      // Adjust parent stack based on depth
      // Trim stack if we're going back up
      while (parentStack.length > item.depth + 1) {
        parentStack.pop();
      }
      // Extend stack if we're going deeper
      while (parentStack.length < item.depth + 1) {
        parentStack.push(lastInsertedId || parentStack[parentStack.length - 1]);
      }
      
      const parentId = parentStack[item.depth];
      const newNode = createNode(parentId, 'default', item.label);
      
      if (item.depth === 0) {
        // Top level: insert as child of section
        next = insertNode(next, newNode, sectionId, insertIndex++);
      } else {
        // Nested: add as child of the current parent at this depth
        const parent = findNode(next, parentId);
        next = insertNode(next, newNode, parentId, parent?.children.length ?? 0);
      }
      
      lastInsertedId = newNode.id;
      
      // Update parent stack for potential children
      parentStack[item.depth + 1] = newNode.id;
    }
    
    return next;
  });
  
  // Focus the first inserted item
  if (lastInsertedId) {
    setSelectedId(lastInsertedId);
    setAutoFocusId(lastInsertedId);
  }
}}
```

### Key Logic Explained

1. **`parentStack`**: Tracks the parent node ID at each depth level
   - `parentStack[0]` = section ID (for depth-0 items)
   - `parentStack[1]` = first depth-0 item (for depth-1 items)
   - etc.

2. **Stack adjustment**: Before inserting each item:
   - Pop from stack if current depth is less than stack length (going back up)
   - Push to stack if current depth is greater (going deeper)

3. **Insertion**: 
   - Depth-0 items go directly under the section
   - Deeper items go under their computed parent from the stack

### Example Transformation

AI generates:
```
{ label: "Social Strata", depth: 0 }
{ label: "Division between Patricians and Plebeians", depth: 1 }
{ label: "Curiate", depth: 0 }
```

Result in outline:
```
1. Article I (section)
  a. Social Strata           <- depth 0, child of section
    i. Division between...    <- depth 1, child of "Social Strata"
  b. Curiate                  <- depth 0, child of section
```

## Summary

| File | Change |
|------|--------|
| `HierarchyBlockView.tsx` | Replace flat insertion logic with parent-stack hierarchy builder |

This reuses the proven pattern from `handlePasteHierarchy` and ensures AI-generated content respects the depth structure.
