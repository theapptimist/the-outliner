# IMPLEMENTED: Document Planner Creates Sections AND Queues Prompts

## Status: ✅ Complete

## What Was Implemented

### 1. Edge Function (`supabase/functions/section-ai-chat/index.ts`)
- **Two-phase detection**: If document has ≤1 section OR all sections untitled, AI now CREATES new sections
- **New response format**: Returns `newSections` array with `{ title, prompt, isNew: true }`
- **Existing sections**: Still returns `sectionPrompts` for documents with multiple titled sections

### 2. SectionAIChat.tsx
- Added `onCreateSection` prop for creating new depth-0 nodes
- `handlePlanDocument` now handles both `newSections` and `sectionPrompts` responses
- `handleApprovePlan` creates new sections FIRST, then queues prompts to their IDs

### 3. DocumentPlanDialog.tsx
- Visual distinction: New sections have green border + "New" badge
- Editable titles for new sections
- Dynamic button text: "Create X Sections & Queue Y Prompts" or just "Queue X Prompts"

### 4. SectionControlPanel.tsx
- Accepts and passes through `onCreateSection` callback

### 5. SimpleOutlineView.tsx
- Added `handleCreateSection` callback that:
  - Finds the last depth-0 node
  - Creates a new sibling after it
  - Sets the title/label
  - Returns the new node ID

## User Flow

```
1. User opens Section 1's AI panel
2. Types: "Write an essay about the origins of WWI"
3. Clicks "Plan Doc"
4. AI returns 4-7 new sections with prompts:
   - Introduction → "Write an engaging intro..."
   - Alliance System (NEW) → "Explain Triple Alliance..."
   - Imperialism (NEW) → "Discuss colonial rivalries..."
   - The Assassination (NEW) → "Describe Franz Ferdinand..."
5. User reviews in DocumentPlanDialog (green badges for NEW sections)
6. Clicks "Create 4 Sections & Queue 5 Prompts"
7. New sections appear in outline
8. Pulsing dots appear on all sections with queued prompts
9. User clicks any section's sparkle icon
10. Prompt auto-fills from queue
```
