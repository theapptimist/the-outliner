

# Fix Confusing TOC and End Notes Structure

## Problem Analysis

The current implementation causes confusing output because:

1. **Duplicate Labels**: The TOC lists topic names (e.g., "Key Figures"), then those exact same names appear again as section headers below
2. **Per-Section TOC**: Each section gets its own mini-TOC, which is redundant for a single section's content
3. **Structural Confusion**: The flat depth structure with duplicated names creates an outline that reads poorly

**Example of current problematic output:**
```text
Table of Contents
├── The Causes
├── Key Figures  
├── Aftermath
The Causes         ← Same text appears again
├── Content...
Key Figures        ← Same text appears again
├── Content...
References
├── [1] Citation...
```

---

## Solution: Change TOC Semantics

Instead of duplicating topic names, the **Table of Contents should use descriptive phrases that preview the content** rather than just listing the same headings. This creates meaningful differentiation.

**Proposed new output structure:**
```text
Table of Contents
├── Overview of the causes leading to conflict
├── Analysis of key historical figures involved
├── Long-term consequences and aftermath
The Causes of the Conflict
├── Economic tensions between nations [1]
├── Political instability in the region [2]
Key Figures Involved
├── Leaders from several nations shaped events
The Aftermath
├── Consequences that shaped the modern world
References
├── [1] Smith, J. (1998)...
```

---

## Implementation Changes

### File: `supabase/functions/section-ai-chat/index.ts`

**1. Update TOC instruction** (line ~261):
```typescript
// Before
optionsInstructions += `\n- TABLE OF CONTENTS: At the VERY BEGINNING... 
include a "Table of Contents" header at depth 0, followed by items at depth 1 
that list each major topic that will appear in the outline below it.`;

// After
optionsInstructions += `\n- TABLE OF CONTENTS: At the VERY BEGINNING of the 
items array, include a "Table of Contents" header at depth 0. Follow it with 
descriptive preview phrases at depth 1 that summarize what each major section 
will cover. Do NOT simply repeat the exact section headings—instead, write 
brief descriptions like "Overview of economic factors" or "Analysis of key 
political figures involved."`;
```

**2. Update example JSON** (lines ~277-305) to demonstrate the correct pattern:

```typescript
if (hasToc && hasEndNotes) {
  exampleItems = `[
    { "label": "Table of Contents", "depth": 0 },
    { "label": "Overview of the causes leading to conflict", "depth": 1 },
    { "label": "Analysis of key historical figures", "depth": 1 },
    { "label": "The lasting aftermath and consequences", "depth": 1 },
    { "label": "The Causes of the Event", "depth": 0 },
    { "label": "Economic tensions between nations [1]", "depth": 1 },
    { "label": "Political instability in the region [2]", "depth": 1 },
    { "label": "Key Figures Involved", "depth": 0 },
    { "label": "The main actors included leaders from several nations", "depth": 1 },
    { "label": "The Aftermath", "depth": 0 },
    { "label": "Long-term consequences shaped the modern world", "depth": 1 },
    { "label": "References", "depth": 0 },
    { "label": "[1] Smith, J. (1998). The History of Conflict. Oxford Press.", "depth": 1 },
    { "label": "[2] Jones, M. (2005). War and Peace. Cambridge University.", "depth": 1 }
  ]`;
}
```

**3. Similarly update the TOC-only example** (lines ~293-305).

---

## Alternative Approach (If User Prefers)

If the user would rather have the TOC just be a simple list that doesn't duplicate at all, we could:

- **Remove TOC from per-section generation entirely** — only generate it once at the document level
- **Or**: Have the TOC be a numbered list like "1. Section One, 2. Section Two" rather than topic names

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/section-ai-chat/index.ts` | Update TOC instruction to use descriptive phrases instead of duplicating headings |
| `supabase/functions/section-ai-chat/index.ts` | Update all example JSON snippets to demonstrate correct non-duplicate pattern |

---

## Testing

After implementation:
1. Create a new document with "Write about WWI"
2. Enable TOC and End Notes in Generation Options
3. Click "Auto-Write Document"
4. Verify each section has:
   - A TOC with **descriptive previews** (not duplicated headings)
   - Main content with clear section headers
   - References at the end with numbered citations

