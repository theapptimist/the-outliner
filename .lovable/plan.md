
# Fix: Show Queued Prompt Indicator on Section Toolbar

## Problem

When prompts are queued via the Document Plan feature, there's no visual feedback. The `SectionPanelToggle` component was created with the pulsing dot indicator, but it's not actually being used anywhere. Instead, `SectionToolbar` is the component that renders the sparkle button, and it lacks:

1. The `hasQueuedPrompt` prop
2. The visual indicator (pulsing dot)

Additionally, the prompt queue check needs to happen at the `SimpleOutlineView` level so it can be passed down to `SectionToolbar`.

## Flow After Fix

```
User clicks "Queue 4 Prompts"
         ↓
Prompts saved to sessionStorage
         ↓
useSectionPromptQueue notifies all listeners
         ↓
SimpleOutlineView re-renders with updated queue state
         ↓
Sections 2, 3, 4 show pulsing dot on sparkle icon
         ↓
User opens Section 2's AI panel
         ↓
Prompt auto-fills in the input field
```

## Technical Changes

### 1. Update `SectionToolbar` to Accept and Display the Indicator

Add `hasQueuedPrompt` prop and render the pulsing dot on the sparkle button:

```typescript
// In SectionToolbar.tsx
interface SectionToolbarProps {
  // ... existing props
  hasQueuedPrompt?: boolean;  // NEW
}

// In the sparkle button:
<Button>
  <Sparkles />
  {hasQueuedPrompt && !isAIPanelOpen && (
    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-pulse" />
  )}
</Button>
```

### 2. Update `SimpleOutlineView` to Check Queue and Pass Prop

Use the prompt queue hook at the SimpleOutlineView level and pass the state to SectionToolbar:

```typescript
// In SimpleOutlineView.tsx
const { document } = useDocumentContext();
const documentId = document?.meta?.id || 'unknown';
const promptQueue = useSectionPromptQueue(documentId);

// When rendering SectionToolbar:
<SectionToolbar
  // ... existing props
  hasQueuedPrompt={promptQueue.hasQueuedPrompt(node.id)}
/>
```

### 3. Optional: Remove Unused `SectionPanelToggle`

Since `SectionToolbar` now handles the indicator, the standalone `SectionPanelToggle` component can be removed from `SectionControlPanel.tsx` to reduce confusion (or kept for future use).

## Files to Modify

1. **`src/components/editor/SectionToolbar.tsx`**
   - Add `hasQueuedPrompt` prop
   - Add relative positioning to sparkle button
   - Add pulsing dot indicator when queued
   - Update tooltip text when prompt is queued

2. **`src/components/editor/SimpleOutlineView.tsx`**
   - Import `useSectionPromptQueue` and `useDocumentContext`
   - Call the hook to get queue state
   - Pass `hasQueuedPrompt` to `SectionToolbar`

## Expected Result

After queuing prompts from the Document Plan dialog:
- Each section with a queued prompt will show a pulsing blue dot on its sparkle icon
- Hovering shows tooltip: "Open AI panel (prompt queued)"
- Opening the panel auto-fills the queued prompt in the input field
- Sending or clearing the prompt removes the indicator
