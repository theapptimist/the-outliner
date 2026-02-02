
# Separate TOC and End Notes from Per-Section Generation

## Problem Summary

You correctly identified that the current implementation is fundamentally flawed: it tries to inject Table of Contents and End Notes **inside each section's generated content**. This creates nonsensical output where every section gets its own mini-TOC and its own references list.

**Your actual requirements:**
1. **Table of Contents** - A single document-level list of all section titles with clickable jump links, displayed above the outline
2. **End Notes** - A single consolidated references list at the bottom of the entire document, combining citations from all sections

---

## Solution Architecture

### 1. Remove TOC/End Notes from Per-Section AI Generation

The `section-ai-chat` edge function should NOT generate TOC or End Notes items. Instead:
- Keep `includeCitations` - AI includes inline citations like `[Author, Year]` or `[1]` in the content
- Remove `includeTableOfContents` from section-level generation entirely
- Remove `includeEndNotes` from section-level generation - instead, the AI just uses numbered markers `[1]`, `[2]` in the text

### 2. Create Document-Level TOC Component

A new React component that:
- Renders above the outline (inside `HierarchyBlockView`)
- Lists all depth-0 nodes (sections) as clickable links
- Uses the existing `scrollToNode` function to jump to clicked sections
- Only visible when the TOC option is enabled

### 3. Create Document-Level End Notes Component

A new React component that:
- Renders below the outline (inside `HierarchyBlockView`)
- Scans all nodes for citation markers like `[1]`, `[2]` or `[Author, Year]`
- Displays a consolidated references list
- For now, shows placeholder citations (future: allow users to define the actual references)

---

## Implementation Changes

### File: `supabase/functions/section-ai-chat/index.ts`

**Remove TOC and End Notes generation instructions**:
- Remove the `hasToc` and `hasEndNotes` logic that adds special items
- Keep only `includeCitations` (inline markers) and `historicalDetail`
- The AI should just generate outline content with inline citation markers when requested

### File: `src/components/editor/DocumentPlanDialog.tsx`

**Update UI to clarify the new behavior**:
- Change "Table of Contents" description to "Show clickable section list above outline"
- Change "End Notes" description to "Collect citations into a references section below outline"

### File: `src/components/editor/TableOfContents.tsx` (NEW)

Create a new component:
```tsx
interface TableOfContentsProps {
  sections: Array<{ id: string; label: string }>;
  onNavigate: (sectionId: string) => void;
}

export function TableOfContents({ sections, onNavigate }: TableOfContentsProps) {
  if (sections.length === 0) return null;
  
  return (
    <div className="border-b border-foreground/10 pb-2 mb-2">
      <div className="text-xs font-medium text-muted-foreground mb-1">Contents</div>
      <ul className="space-y-0.5">
        {sections.map((section, index) => (
          <li key={section.id}>
            <button
              onClick={() => onNavigate(section.id)}
              className="text-sm text-primary hover:underline text-left"
            >
              {index + 1}. {section.label || '(Untitled)'}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### File: `src/components/editor/EndNotesSection.tsx` (NEW)

Create a new component:
```tsx
interface EndNotesSectionProps {
  citations: Array<{ marker: string; text?: string }>;
}

export function EndNotesSection({ citations }: EndNotesSectionProps) {
  if (citations.length === 0) return null;
  
  return (
    <div className="border-t border-foreground/10 pt-2 mt-4">
      <div className="text-xs font-medium text-muted-foreground mb-1">References</div>
      <ul className="text-sm space-y-0.5 text-muted-foreground">
        {citations.map((c, i) => (
          <li key={i}>{c.marker} {c.text || '(Reference to be added)'}</li>
        ))}
      </ul>
    </div>
  );
}
```

### File: `src/components/editor/HierarchyBlockView.tsx`

**Integrate the new components**:
1. Extract depth-0 nodes as "sections" for the TOC
2. Scan all nodes for citation markers (e.g., `[1]`, `[2]`) for End Notes
3. Render `<TableOfContents>` above the outline when the option is enabled
4. Render `<EndNotesSection>` below the outline when the option is enabled
5. Pass `scrollToNode` function to TOC for navigation

### File: `src/hooks/useSectionPromptQueue.ts`

**Simplify GenerationOptions**:
- Remove `includeTableOfContents` from the interface (it's now a display option, not AI generation)
- Remove `includeEndNotes` from the interface (same reason)
- Keep `includeCitations` and `historicalDetail` as these affect what the AI writes in the content

### File: `src/components/editor/context/DocumentContext.tsx`

**Add document-level display options state**:
- Add `showTableOfContents: boolean` and `showEndNotes: boolean` to context
- These control whether the TOC and End Notes components render

---

## Summary of Changes

| File | Change |
|------|--------|
| `supabase/functions/section-ai-chat/index.ts` | Remove TOC/EndNotes generation logic; keep inline citation markers only |
| `src/components/editor/TableOfContents.tsx` | NEW: Clickable section list component |
| `src/components/editor/EndNotesSection.tsx` | NEW: Consolidated references component |
| `src/components/editor/HierarchyBlockView.tsx` | Integrate TOC above and End Notes below the outline |
| `src/components/editor/DocumentPlanDialog.tsx` | Update toggle descriptions to reflect new behavior |
| `src/hooks/useSectionPromptQueue.ts` | Simplify GenerationOptions interface |
| `src/components/editor/context/DocumentContext.tsx` | Add display option state for TOC and End Notes visibility |

---

## Testing

After implementation:
1. Enable TOC and End Notes in Generation Options
2. Create a document with multiple sections using "Auto-Write Document"
3. Verify:
   - TOC appears **above** the outline with clickable section links
   - Clicking a TOC item scrolls to that section
   - End Notes appears **below** the outline showing collected citation markers
   - Section content does NOT contain embedded TOC or References items
