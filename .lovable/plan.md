
# Plan: Context-Aware Loading Message + Verify Queue Opens Panels

## Overview
Change the loading indicator to show "Planning Doc..." when the Plan Doc feature is active, and verify that clicking "Queue" properly opens all section AI panels.

## Changes Required

### 1. Track Current Operation in SectionAIChat.tsx

Add state to track which operation is currently running:

```tsx
const [currentOperation, setCurrentOperation] = useState<string | null>(null);
```

### 2. Update handlePlanDocument

Set the operation type before making the API call:

```tsx
const handlePlanDocument = useCallback(async () => {
  // ... validation ...
  setIsLoading(true);
  setCurrentOperation('plan-document');  // ADD THIS
  
  try {
    // ... existing API call logic ...
  } finally {
    setIsLoading(false);
    setCurrentOperation(null);  // ADD THIS
  }
}, [...]);
```

### 3. Update Loading Indicator (lines 774-779)

Change the loading message to be context-aware:

**Current:**
```tsx
{isLoading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
    <Loader2 className="w-3 h-3 animate-spin" />
    Thinking...
  </div>
)}
```

**New:**
```tsx
{isLoading && (
  <div className="flex items-center gap-2 text-xs text-muted-foreground p-2">
    <Loader2 className="w-3 h-3 animate-spin" />
    {currentOperation === 'plan-document' ? 'Planning Doc...' : 'Thinking...'}
  </div>
)}
```

### 4. Verify Queue Flow Opens Panels

The current code at lines 453-456 already includes:
```tsx
const sectionIdsToOpen = allPromptsToQueue.map(p => p.sectionId);
if (onOpenSectionPanels && sectionIdsToOpen.length > 0) {
  onOpenSectionPanels(sectionIdsToOpen);
}
```

This should work, but we should verify the callback is properly wired up from the parent component.

## Implementation Summary

| File | Change |
|------|--------|
| `SectionAIChat.tsx` | Add `currentOperation` state |
| `SectionAIChat.tsx` | Set operation in `handlePlanDocument` |
| `SectionAIChat.tsx` | Update loading indicator text |

## Technical Details

- **New State**: `currentOperation: string | null` - tracks active operation type
- **Loading Text Logic**: Ternary check for `'plan-document'` operation
- **Queue Behavior**: Already implemented - verify parent provides `onOpenSectionPanels`
