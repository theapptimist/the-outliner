
# Document Plan Dialog Enhancement

## Overview

This plan enhances the Document Plan dialog with two improvements:
1. **Taller default height** for better visibility without scrolling
2. **AI Generation Options** - collapsible controls that let users configure how the AI generates content

---

## Current State Analysis

The `DocumentPlanDialog.tsx` currently:
- Uses a default height of 600px (line 42)
- Has a resize handle but no quick way to maximize
- Contains only section prompts with enable/disable checkboxes
- No options to control AI behavior

---

## Proposed Changes

### 1. Increase Default Height

**Simple change**: Increase the default height from 600px to 720px (or 80vh, whichever is smaller) to show more sections without scrolling.

**Location**: `DocumentPlanDialog.tsx`, line 42
```typescript
// Before
const [size, setSize] = useState({ width: 672, height: 600 });

// After  
const [size, setSize] = useState({ 
  width: 672, 
  height: Math.min(720, window.innerHeight * 0.8) 
});
```

---

### 2. Add AI Options Panel

Add a collapsible "Generation Options" section between the header and the section list. This keeps the dialog clean by default but allows power users to configure AI behavior.

**New Options (with Switch toggles):**

| Option | Default | Description |
|--------|---------|-------------|
| Include Citations | Off | AI will reference sources and suggest footnotes |
| Historical Detail | Off | Name specific actors, dates, and primary sources |
| Output Format | Outline (default) | Choose between "Outline" or "Prose" |

**UI Design:**
```text
┌─────────────────────────────────────────────────────┐
│ ✨ Review Document Plan                        [×]  │
│ 3 new sections will be created...                   │
├─────────────────────────────────────────────────────┤
│ ▶ Generation Options                    [collapsed] │
├─────────────────────────────────────────────────────┤
│  When expanded:                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │ Include Citations         ○────────────       │  │
│  │ Historical Detail         ───────────○       │  │
│  │ Output: ○ Outline  ○ Prose                   │  │
│  └───────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────┤
│ [ScrollArea with section cards...]                  │
└─────────────────────────────────────────────────────┘
```

---

### 3. Pass Options to AI

When the user approves the plan, pass these options to the edge function, which will include them in the AI prompt.

**Data Flow:**
1. Dialog stores options in local state
2. `onApprove` callback receives options alongside prompts
3. Options are passed to `section-ai-chat` edge function
4. Edge function modifies the system prompt based on options

---

## Implementation Details

### Files to Modify

| File | Changes |
|------|---------|
| `src/components/editor/DocumentPlanDialog.tsx` | Add options state, collapsible UI, pass to onApprove |
| `src/components/editor/SectionAIChat.tsx` | Update `handleApprovePlan` to include options |
| `supabase/functions/section-ai-chat/index.ts` | Accept options, modify prompts accordingly |

---

### New Interface Definition

```typescript
export interface GenerationOptions {
  includeCitations: boolean;
  historicalDetail: boolean;
  outputFormat: 'outline' | 'prose';
}
```

---

### Edge Function Prompt Modifications

When options are enabled, the system prompt will include:

**For `includeCitations: true`:**
```text
When writing content, include inline citations and suggest sources where appropriate. 
Format citations as [Author, Year] or [Source Name].
```

**For `historicalDetail: true`:**
```text
Be specific about historical actors, dates, and primary sources. 
Name specific people, institutions, and document references rather than speaking generally.
```

**For `outputFormat: 'prose'`:**
```text
Write in flowing prose paragraphs rather than bullet points or outline format.
```

---

## Risk Assessment

| Risk | Mitigation |
|------|------------|
| Dialog positioning issues (previous failure) | We are NOT changing positioning or fullscreen logic |
| Resize logic conflicts | We are only changing the initial height value |
| State complexity | Options are simple boolean/enum values with no side effects |

**What we are NOT doing:**
- No fullscreen toggle (that caused the previous rollback)
- No changes to resize drag behavior
- No changes to dialog positioning CSS

---

## Testing Checklist

1. Open Document Plan dialog → verify taller height
2. Click "Generation Options" → verify it expands/collapses
3. Toggle options → verify visual feedback
4. Approve plan with options enabled → verify AI prompts reflect options
5. Verify resize handle still works correctly
6. Test on different viewport heights
