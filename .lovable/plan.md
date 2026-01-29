
# Fix: Document Planner Should Create Sections AND Queue Prompts

## Problem Analysis

The current implementation has a fundamental mismatch with the user's expectation:

**What the user expects:**
1. User enters a topic like "Write an essay about the origins of WWI"
2. AI generates MULTIPLE new sections (e.g., "Alliance System", "Imperialism", "Militarism", "Nationalism", "The Assassination")
3. Each new section gets a queued AI prompt
4. User sees pulsing dots on sections 2, 3, 4, etc.

**What currently happens:**
1. User enters a topic
2. The code sends `sectionList` containing only the EXISTING depth-0 nodes
3. If there's only 1 section (the current one), AI only returns 1 prompt
4. No new sections are created

Looking at the network request from the session:
```
sectionList: [{"id":"node_..._72j9pobi7","title":""}]  // Only 1 section!
```

The AI correctly returned 1 prompt because it was only told about 1 section.

## Solution

The Document Planner needs a two-phase approach:

### Phase 1: AI Generates New Sections

When the user clicks "Plan Doc" with a topic, the AI should:
1. Generate a list of new section titles that would structure the document
2. Return both the section structure AND prompts for each

### Phase 2: Insert Sections AND Queue Prompts

After user approval:
1. Insert the new sections as sibling depth-0 nodes (after section 1)
2. Queue the prompts to each newly created section
3. Show pulsing dots on all new sections

## Technical Changes

### 1. Update Edge Function (`supabase/functions/section-ai-chat/index.ts`)

Modify the `plan-document` operation to generate new sections:

```typescript
// When sectionList has few/empty sections, tell AI to CREATE sections
systemPrompt = `You are a document planning assistant that creates document structure.

The user wants to write about: [topic]

Create 3-7 major sections that would structure this document well.

IMPORTANT: Return JSON in this format:
{
  "message": "Brief summary of the plan",
  "newSections": [
    { "title": "Section Title 1", "prompt": "AI prompt for this section" },
    { "title": "Section Title 2", "prompt": "AI prompt for this section" }
  ]
}`;
```

### 2. Update SectionAIChat.tsx

Handle the new response format that includes sections to create:

```typescript
// In handlePlanDocument:
if (data.newSections && Array.isArray(data.newSections)) {
  // New sections to create AND queue prompts for
  setGeneratedPlan(data.newSections.map(ns => ({
    sectionId: null, // Will be assigned after creation
    sectionTitle: ns.title,
    prompt: ns.prompt,
    enabled: true,
    isNew: true, // Flag indicating this needs to be created
  })));
}
```

### 3. Update DocumentPlanDialog.tsx

Show that new sections will be created:
- Add visual indicator for "new sections" vs "existing sections"
- Change button text to "Create X Sections & Queue Prompts"

### 4. Update Approval Handler

When user approves:
1. For each new section, create a depth-0 node as a sibling
2. Capture the new node's ID
3. Queue the prompt to that ID

```typescript
const handleApproveplan = useCallback(async (prompts: SectionPrompt[]) => {
  const newSections = prompts.filter(p => p.isNew && p.enabled);
  const existingSections = prompts.filter(p => !p.isNew && p.enabled);
  
  // Create new sections and get their IDs
  const createdSectionIds: string[] = [];
  for (const section of newSections) {
    const newId = onCreateSection?.(section.sectionTitle); // Returns new node ID
    if (newId) createdSectionIds.push({ id: newId, prompt: section.prompt });
  }
  
  // Queue prompts for both new and existing sections
  const allPrompts = [
    ...createdSectionIds.map(({ id, prompt }) => ({ sectionId: id, prompt })),
    ...existingSections.map(p => ({ sectionId: p.sectionId, prompt: p.prompt })),
  ];
  
  promptQueue.queueMultiplePrompts(allPrompts);
}, []);
```

## Files to Modify

1. **`supabase/functions/section-ai-chat/index.ts`**
   - Update prompt for `plan-document` to generate new sections
   - Return `newSections` array with titles and prompts

2. **`src/components/editor/SectionAIChat.tsx`**
   - Parse `newSections` from response
   - Pass section creation callback
   - Handle two-phase approval (create then queue)

3. **`src/components/editor/DocumentPlanDialog.tsx`**
   - Add visual distinction for new vs existing sections
   - Update approval button text

4. **`src/components/editor/SimpleOutlineView.tsx`**
   - Add `onCreateSection` callback that creates a new depth-0 node
   - Pass this callback to `SectionControlPanel`

5. **`src/components/editor/SectionControlPanel.tsx`**
   - Accept and pass through `onCreateSection` callback

## User Flow After Fix

```
1. User opens Section 1's AI panel
2. Types: "Write an essay about the origins of WWI"
3. Clicks "Plan Doc"
4. AI returns:
   - Section 1: "Introduction" → "Write intro about the powder keg..."
   - Section 2 (NEW): "Alliance System" → "Explain Triple Alliance..."
   - Section 3 (NEW): "Imperialism" → "Discuss colonial rivalries..."
   - Section 4 (NEW): "Militarism" → "Analyze arms race..."
   - Section 5 (NEW): "The Assassination" → "Describe Franz Ferdinand..."
5. User reviews in DocumentPlanDialog
6. Clicks "Create 4 Sections & Queue 5 Prompts"
7. New sections appear in outline
8. Pulsing dots appear on sections 2-5
9. User clicks Section 2's sparkle icon
10. Prompt auto-fills: "Explain Triple Alliance..."
```

## Expected Outcome

After implementation:
- "Plan Doc" will create new document sections based on the topic
- Each new section gets a queued AI prompt
- Pulsing dots indicate which sections have prompts ready
- Opening any section's AI panel auto-fills its queued prompt
