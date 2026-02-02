
# Separate TOC and End Notes from Per-Section Generation

## ✅ IMPLEMENTED

The TOC and End Notes are now **document-level UI components**, NOT part of per-section AI generation.

### Changes Made

1. **Edge Function (`section-ai-chat`)**: Removed TOC and EndNotes generation logic. AI now only includes inline citation markers `[1]`, `[2]` when citations are enabled.

2. **New Components**:
   - `TableOfContents.tsx` - Clickable section list rendered above outline
   - `EndNotesSection.tsx` - Consolidated references list below outline, with `extractCitations()` utility

3. **DocumentContext**: Added `displayOptions` state with `showTableOfContents` and `showEndNotes` booleans

4. **DocumentPlanDialog**: Split options into:
   - `GenerationOptions` - Passed to AI (citations, historical detail, output format)
   - `DisplayOptions` - UI rendering only (TOC visibility, End Notes visibility)

5. **HierarchyBlockView**: Integrated TOC and EndNotes components, computing sections from depth-0 nodes and extracting citations from all node labels

### How It Works

- **TOC**: Lists all depth-0 (section) nodes with clickable links that scroll/focus to that section
- **End Notes**: Scans all nodes for citation markers like `[1]`, `[Author, Year]` and displays them in a consolidated list
- Both are controlled by display toggles in the Generation Options panel
