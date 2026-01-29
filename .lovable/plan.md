
# Fix: Auto-Write Cascade Stale State Issue

## Problem Analysis

Your architectural idea is sound - using independent AI calls for each section avoids context window deterioration. The current implementation has a **stale closure bug** that causes sections 2-6 to silently fail.

### Root Cause

The `onInsertSectionContent` callback captures the tree state at render time. When the auto-write loop runs:

1. Sections 2-6 are created via `onCreateSection` (synchronous)
2. These trigger `setTree()` calls in `HierarchyBlockView`
3. React batches these state updates
4. The async AI calls complete and invoke `onInsertSectionContent`
5. But `onInsertSectionContent` still has the OLD tree reference (before sections were created)
6. `findNode(tree, sectionId)` returns null for sections 2-6
7. The callback silently returns without inserting content

### Evidence

Looking at `HierarchyBlockView.tsx:1029`:
```typescript
const sectionNode = findNode(tree, sectionId);
if (!sectionNode) return;  // Silently fails!
```

## Solution: Deferred Execution with State Synchronization

The fix requires ensuring the tree state is synchronized before attempting to insert content.

### Approach 1: Wait for React State to Settle

Add a small delay after each section creation to allow React to commit the state updates before the AI call runs.

### Approach 2: Use Refs for Latest Tree Access

Pass a ref-based getter that always returns the current tree state instead of a stale closure.

### Approach 3: Batch Section Creation First, Then Execute AI Calls

Separate the two phases completely:
1. Create all sections first and wait for state to settle
2. Then execute all AI calls with fresh references

I recommend **Approach 3** as the most robust solution.

## Technical Changes

### 1. Update `SectionAIChat.tsx` - Two-Phase Execution

Separate section creation from AI execution with an explicit sync point:

```typescript
const handleApproveplan = useCallback(async (prompts: SectionPrompt[], autoExecute: boolean) => {
  // Phase 1: Create all sections FIRST
  const sectionMappings: Array<{ sectionId: string; sectionTitle: string; prompt: string }> = [];
  
  // ... section creation logic (unchanged) ...
  
  // Close the dialog to allow React to re-render with new sections
  setPlanDialogOpen(false);
  
  // CRITICAL: Wait for React to commit state updates
  // This ensures the tree has the new sections before we try to insert content
  await new Promise(resolve => setTimeout(resolve, 100));
  
  if (autoExecute && onInsertSectionContent) {
    // Phase 2: Now execute AI calls sequentially
    for (const mapping of sectionMappings) {
      // AI call and insert...
    }
  }
});
```

### 2. Update `HierarchyBlockView.tsx` - Better Error Handling

Add logging to help debug and use a ref-based approach for the latest tree:

```typescript
onInsertSectionContent={(sectionId, items) => {
  if (items.length === 0) return;
  
  // Use a callback form to get the LATEST tree state
  setTree(currentTree => {
    const sectionNode = findNode(currentTree, sectionId);
    if (!sectionNode) {
      console.warn(`Section ${sectionId} not found in tree for content insertion`);
      return currentTree;
    }
    
    // ... rest of insertion logic using currentTree ...
  });
}}
```

This uses React's functional update pattern to always access the latest tree state.

### 3. Optional: Add Visual Feedback During Cascade

Show which section is currently being written:

```typescript
// Already implemented with autoWriteProgress state
setAutoWriteProgress({ 
  current: i, 
  total: total, 
  currentSection: sectionTitle 
});
```

## Files to Modify

1. **`src/components/editor/SectionAIChat.tsx`**
   - Add delay after section creation before AI execution
   - Add debug logging for troubleshooting

2. **`src/components/editor/HierarchyBlockView.tsx`**
   - Change `onInsertSectionContent` to use functional update pattern
   - Add warning log when section not found

## Expected Outcome

After implementation:
- All 6 sections will be created first
- React state settles (100ms delay)
- AI calls execute sequentially for sections 1-6
- Each section's generated content is inserted correctly
- Progress indicator shows "Writing section X of 6..."
- Final toast: "Generated content for 6 sections"

## Alternative: Queue-Based Architecture (Future Enhancement)

For even more robust handling, a future enhancement could use a proper queue:

1. Store pending AI tasks in a Zustand/Redux store
2. A background processor picks up tasks
3. Each task runs independently with its own fresh state access
4. This completely decouples section creation from AI execution

This would be more complex but would eliminate all timing issues.
