
# Document Planner: Section 1 as Master Prompt Generator

## Overview

Transform the Section 1 AI panel into a "Document Planner" mode that generates tailored prompts for all other sections. When you describe your document's theme or topic in Section 1's AI chat, it will generate a set of section-specific prompts that you can review, edit, and then apply to each section.

## User Experience Flow

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  1. Open Section 1's AI Panel                                           │
│     ┌─────────────────────────────────────────────────────────────────┐ │
│     │ Quick Actions:  [Expand] [Summarize] [Refine] [📋 Plan Doc]    │ │
│     │                                                         ↑ NEW   │ │
│     └─────────────────────────────────────────────────────────────────┘ │
│                                                                         │
│  2. Click "Plan Doc" → Enter your topic                                 │
│     "This document covers the making of a film called 'Don't Worry'.    │
│      Section 1 is Pre-Production, Section 2 is Principal Photography,  │
│      Section 3 is Post-Production..."                                   │
│                                                                         │
│  3. AI generates a list of prompts (one per section)                    │
│     ┌───────────────────────────────────────────────────────────────┐   │
│     │ ✨ Generated Document Plan                                     │   │
│     │                                                               │   │
│     │ Section 1 (Pre-Production):                                   │   │
│     │ "Draft casting decisions, location scouting, and budget..."   │   │
│     │                                                               │   │
│     │ Section 2 (Principal Photography):                            │   │
│     │ "Cover daily shooting schedules, key scenes, challenges..."   │   │
│     │                                                               │   │
│     │ Section 3 (Post-Production):                                  │   │
│     │ "Detail editing timeline, color grading, sound design..."     │   │
│     │                                        [✏️ Review & Edit]      │   │
│     └───────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  4. Opens review dialog where you can:                                  │
│     - Edit each prompt text                                             │
│     - Skip/remove prompts for specific sections                         │
│     - Re-order or add new prompts                                       │
│     - Approve to queue prompts                                          │
│                                                                         │
│  5. After approval, each section's AI panel shows a "queued prompt"     │
│     indicator. Opening the panel auto-fills the prompt ready for you    │
│     to execute.                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Features

### "Plan Document" Quick Action (Section 1 Only)
- New button appears in the quick actions bar only for the first major section
- Triggers a different operation type (`plan-document`) to the edge function
- AI receives all section titles as context to generate targeted prompts

### Document Plan Review Dialog
- Modal dialog showing all generated prompts mapped to sections
- Editable text fields for each prompt
- Checkboxes to enable/disable specific sections
- "Approve" button queues prompts; "Cancel" discards

### Queued Prompt System
- Session storage tracks pending prompts per section: `section-queue:{docId}:{sectionId}`
- When opening a section's AI panel with a queued prompt, the prompt text auto-populates the input
- Visual indicator (badge/icon) on section toolbar when a prompt is queued
- After sending the prompt, the queue is cleared for that section

## Technical Implementation

### Files to Create

1. **`src/components/editor/DocumentPlanDialog.tsx`**
   - Review/edit dialog for generated section prompts
   - Props: `prompts`, `sections`, `onApprove`, `onCancel`
   - Renders editable list of section → prompt mappings

2. **`src/hooks/useSectionPromptQueue.ts`**
   - Hook for managing queued prompts in session storage
   - Methods: `getQueuedPrompt(sectionId)`, `setQueuedPrompt(sectionId, prompt)`, `clearQueuedPrompt(sectionId)`

### Files to Modify

1. **`supabase/functions/section-ai-chat/index.ts`**
   - Add new operation type: `plan-document`
   - New system prompt that generates prompts for each section based on their titles
   - Returns JSON: `{ message, sectionPrompts: [{ sectionId, sectionTitle, prompt }] }`

2. **`src/components/editor/SectionAIChat.tsx`**
   - Add `isFirstSection` prop
   - Show "Plan Doc" quick action only when `isFirstSection === true`
   - Handle `plan-document` response to open DocumentPlanDialog
   - Check for queued prompt on mount → auto-populate input field
   - Add visual indicator when prompt is queued

3. **`src/components/editor/SectionControlPanel.tsx`**
   - Pass `isFirstSection` flag through to SectionAIChat
   - Track all section titles/IDs for context when planning

4. **`src/components/editor/SimpleOutlineView.tsx`**
   - Track first section index to pass `isFirstSection` prop
   - Add badge/indicator to section toolbar when prompt is queued

5. **`src/components/editor/HierarchyBlockView.tsx`**
   - Collect all depth-0 section titles/IDs for document planning context
   - Pass section list to SectionControlPanel

### Edge Function Changes

New operation handler in `section-ai-chat`:

```typescript
case 'plan-document':
  // sectionList passed from client: [{id, title}]
  systemPrompt = `You are a document planning assistant...
  
  The document has these sections:
  ${sectionList.map((s, i) => `${i+1}. ${s.title}`).join('\n')}
  
  Generate a specific, actionable prompt for each section...`;
  
  // Response format:
  // { message, sectionPrompts: [{sectionId, sectionTitle, prompt}] }
```

### Session Storage Schema

```typescript
// Queue storage key pattern
`section-prompt-queue:${documentId}:${sectionId}`

// Value
{ 
  prompt: string,
  queuedAt: string // ISO timestamp
}
```

## Edge Cases Handled

- **Single section documents**: "Plan Doc" still appears but generates only one prompt
- **Section titles change**: Prompts are keyed by section ID, not title
- **User navigates away**: Queued prompts persist in session storage
- **Re-planning**: New plan overwrites any existing queued prompts (with confirmation)

## Non-Goals (For Later)

- Auto-execution of queued prompts (user must manually trigger each)
- Persisting plans to database (session-only for now)
- Multi-turn planning conversation (single prompt → plan output)
