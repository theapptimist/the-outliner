
# Feature: True Multi-Window AI Cascade

## The Vision

Your idea is excellent for avoiding context window deterioration. Currently, the "Auto-Write" runs invisibly from a single orchestrator - it calls the AI API sequentially but never opens the actual AI panels for each section. The user experience should be:

1. User clicks "Auto-Write Document"
2. All section panels **visually open** (expanded)
3. Each section's AI chat shows its queued prompt in the input field
4. Each section independently shows "loading" state while its AI call runs
5. Each section displays the AI response and generated items
6. Content is inserted into each section's outline

This makes the "independent AI windows" tangible and visible.

## Current vs. Proposed Architecture

```text
CURRENT (Hidden Orchestrator):
+----------------------------------+
|  Section 1 AI Panel (orchestrator)|
|   → Calls API for section 1      |
|   → Calls API for section 2      |
|   → Calls API for section 3      |
|   → ...all invisible to user     |
+----------------------------------+
   Sections 2-6 panels stay closed

PROPOSED (True Multi-Window):
+----------------------------------+
|  Section 1 AI Panel              | ← Opens, shows loading, receives response
+----------------------------------+
|  Section 2 AI Panel              | ← Opens, shows loading, receives response  
+----------------------------------+
|  Section 3 AI Panel              | ← Opens, shows loading, receives response
+----------------------------------+
   Each window is independent
```

## Technical Approach

### Phase 1: Open All Section Panels on Auto-Write

When auto-write is triggered, programmatically open all target section panels:

- Add a new callback `onOpenSectionPanels?: (sectionIds: string[]) => void`
- Wire this from `SimpleOutlineView` which manages `openSectionPanels` state
- Call it immediately when auto-write starts

### Phase 2: Add "Auto-Execute on Open" Mode to Each Section's AI Chat

Each `SectionAIChat` component already:
- Detects queued prompts on mount
- Populates the input field with the queued prompt

We add a new trigger mode:
- New prop `autoExecuteOnMount?: boolean` or a flag in the queued prompt data
- When the panel opens and has a queued prompt marked for auto-execute, it immediately sends the message
- The chat shows the loading state, receives the response, and can auto-insert

### Phase 3: Stagger the Auto-Execution

To avoid overwhelming the API and to create a visible cascade effect:
- Each section starts its AI call with a small delay (200-300ms stagger)
- This creates a visual "wave" of AI panels activating
- Each panel independently handles its own loading state and response

### Phase 4: Visual Coordination

- Optional: Show section titles in the progress indicator matching which panels are actively loading
- Each panel's loading indicator runs independently
- When all panels complete, show a summary toast

## Files to Modify

1. **`src/hooks/useSectionPromptQueue.ts`**
   - Add `autoExecute` flag to queued prompt data structure
   - New method: `queueMultiplePromptsWithAutoExecute()`

2. **`src/components/editor/SectionAIChat.tsx`**
   - Add `useEffect` to auto-execute when panel opens with queued auto-execute prompt
   - Remove the current inline orchestration loop (it moves to individual panels)
   - Keep progress coordination via a shared state or callback

3. **`src/components/editor/SectionControlPanel.tsx`**
   - Pass through auto-execute state

4. **`src/components/editor/SimpleOutlineView.tsx`**
   - Add `onOpenSectionPanels` callback that updates `openSectionPanels` state
   - Wire this to `SectionAIChat` for triggering the cascade

5. **`src/components/editor/DocumentPlanDialog.tsx`**
   - No changes needed (already supports `autoExecute` boolean)

## Implementation Details

### Queued Prompt with Auto-Execute Flag

```typescript
interface QueuedPrompt {
  prompt: string;
  queuedAt: string;
  autoExecute?: boolean;  // NEW: triggers immediate execution when panel opens
}
```

### Auto-Execute on Panel Open

```typescript
// In SectionAIChat.tsx
useEffect(() => {
  const queued = promptQueue.getQueuedPromptData(sectionId);
  if (queued?.autoExecute && queued.prompt) {
    // Clear the flag to prevent re-triggering
    promptQueue.clearAutoExecuteFlag(sectionId);
    // Auto-send the message
    sendMessage(queued.prompt, 'expand');
  }
}, [sectionId, promptQueue]);
```

### Opening All Panels

```typescript
// In SimpleOutlineView.tsx
const handleOpenSectionPanels = useCallback((sectionIds: string[]) => {
  setOpenSectionPanels(prev => {
    const next = new Set(prev);
    for (const id of sectionIds) {
      next.add(id);
    }
    return next;
  });
}, []);

// Passed to SectionAIChat via SectionControlPanel
onOpenSectionPanels={handleOpenSectionPanels}
```

### Cascade with Stagger

```typescript
// In SectionAIChat.tsx handleApprovePlan
if (autoExecute) {
  // Queue all prompts with autoExecute flag
  promptQueue.queueMultiplePromptsWithAutoExecute(allPrompts);
  
  // Open all section panels at once
  onOpenSectionPanels?.(allPrompts.map(p => p.sectionId));
  
  // Each panel will auto-execute independently when it detects the flag
}
```

## User Experience After Implementation

```text
1. User clicks "Auto-Write Document"
2. All 6 section panels expand open (visible wave effect)
3. Section 1 panel shows: [Loading...] prompt in chat
4. 200ms later, Section 2 panel shows: [Loading...] 
5. 200ms later, Section 3 panel shows: [Loading...] 
   ...
6. Section 1 receives response, shows generated items, auto-inserts
7. Section 2 receives response, shows generated items, auto-inserts
   ...
8. All sections now have content populated
9. Toast: "Generated content for 6 sections"
```

The user can literally **watch** each independent AI window process its prompt, making the architecture transparent and debugging easier.

## Benefits of This Approach

1. **True independence**: Each section's AI chat is genuinely independent
2. **No context window bleeding**: Each API call is isolated
3. **Visible progress**: User sees exactly what's happening
4. **Easier debugging**: If one section fails, it's visually apparent
5. **User control**: User could potentially interact with or cancel individual sections
6. **Scalable**: Adding more sections doesn't require changing the orchestration logic
