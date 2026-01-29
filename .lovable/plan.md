
# Feature: Auto-Execute Queued Prompts (Cascade Mode)

## Problem

The Document Planner currently:
1. Creates sections with titles
2. Queues prompts to those sections
3. Shows pulsing indicators

But the user has to manually:
1. Open each section's AI panel
2. Click Send to execute the queued prompt
3. Click Insert to add the generated content

The user expects the prompts to **automatically execute** and **populate the outline** without manual intervention - a "cascade" of AI generations that writes the entire document.

## Solution: Add "Auto-Execute" Mode

When the user approves the document plan, offer two options:
1. **Queue Only** (current behavior) - Queue prompts for manual execution later
2. **Auto-Write** (new) - Automatically execute all prompts and insert results

### Auto-Write Flow

```
User clicks "Auto-Write Document"
         ↓
Show progress indicator (0 of 6 sections)
         ↓
For each section with queued prompt:
  1. Call section-ai-chat with 'expand' operation
  2. Get generated outline items
  3. Insert items as children of that section
  4. Update progress (1 of 6, 2 of 6, etc.)
         ↓
All sections populated with AI content
         ↓
Show success toast: "Generated content for 6 sections"
```

## Technical Changes

### 1. Update `DocumentPlanDialog.tsx`

Add two approval buttons:
- "Queue X Prompts" - Current behavior
- "Auto-Write Document" - New cascade behavior

```typescript
// Add new prop for auto-execute mode
interface Props {
  onApprove: (prompts: SectionPrompt[], autoExecute: boolean) => void;
}

// In the dialog:
<Button onClick={() => onApprove(enabledPrompts, false)}>
  Queue {count} Prompts
</Button>
<Button onClick={() => onApprove(enabledPrompts, true)}>
  Auto-Write Document
</Button>
```

### 2. Update `SectionAIChat.tsx` - Handle Auto-Execute

Add logic to execute prompts sequentially after section creation:

```typescript
const handleApprovePlan = useCallback(async (prompts, autoExecute) => {
  // ... existing section creation logic ...
  
  if (autoExecute) {
    // Execute prompts sequentially with progress
    setAutoWriteProgress({ current: 0, total: allPromptsToQueue.length });
    
    for (const { sectionId, prompt } of allPromptsToQueue) {
      // Call the AI to generate content
      const response = await supabase.functions.invoke('section-ai-chat', {
        body: {
          operation: 'expand',
          sectionLabel: getSectionLabel(sectionId),
          sectionContent: '',
          userMessage: prompt,
        },
      });
      
      // Insert the generated items into the section
      if (response.data?.items?.length > 0) {
        onInsertSectionContent?.(sectionId, response.data.items);
      }
      
      // Update progress
      setAutoWriteProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    
    toast.success(`Generated content for ${allPromptsToQueue.length} sections`);
  } else {
    // Queue prompts for manual execution (current behavior)
    promptQueue.queueMultiplePrompts(allPromptsToQueue);
  }
}, [...]);
```

### 3. Add Progress UI

Show a progress indicator during auto-write:

```typescript
{autoWriteProgress && (
  <div className="fixed bottom-4 right-4 bg-background border rounded-lg p-4 shadow-lg">
    <div className="flex items-center gap-3">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
      <div>
        <div className="font-medium">Writing document...</div>
        <div className="text-sm text-muted-foreground">
          Section {autoWriteProgress.current} of {autoWriteProgress.total}
        </div>
      </div>
    </div>
    <Progress value={(autoWriteProgress.current / autoWriteProgress.total) * 100} />
  </div>
)}
```

### 4. Pass Insert Callback Through Component Chain

Ensure `onInsertSectionContent` is available in `SectionAIChat`:

```typescript
// SectionAIChat.tsx - add prop
interface SectionAIChatProps {
  onInsertSectionContent?: (sectionId: string, items: Array<...>) => void;
}

// SectionControlPanel.tsx - pass through
<SectionAIChat
  onInsertSectionContent={onInsertSectionContent}
/>
```

## Files to Modify

1. **`src/components/editor/DocumentPlanDialog.tsx`**
   - Add "Auto-Write Document" button
   - Pass `autoExecute` boolean to onApprove callback

2. **`src/components/editor/SectionAIChat.tsx`**
   - Handle `autoExecute` mode in handleApprovePlan
   - Add progress state and UI
   - Sequential AI calls with content insertion
   - Add `onInsertSectionContent` prop

3. **`src/components/editor/SectionControlPanel.tsx`**
   - Accept and pass `onInsertSectionContent` callback

4. **`src/components/editor/SimpleOutlineView.tsx`**
   - Already has `onInsertSectionContent` - ensure it's passed through

## User Flow After Implementation

```
1. User types "Write about WWI origins"
2. Clicks "Plan Doc"
3. AI generates 6 sections with prompts
4. User reviews in dialog
5. Clicks "Auto-Write Document"
6. Progress indicator: "Writing section 1 of 6..."
7. Each section fills with AI-generated outline content
8. Toast: "Generated content for 6 sections"
9. User sees fully populated document outline
```

## Alternative: Queue + "Execute All" Button

If the cascade is too aggressive, an alternative is to queue the prompts (current behavior) and add a global "Execute All Queued Prompts" button that triggers the cascade on demand. This gives users more control over when the AI writes.
