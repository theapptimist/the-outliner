
# Section-Specific Control Panels with AI Chat

## Overview
Create a system where each major section (depth 0 nodes) of the outline can have its own expandable control panel that includes an AI Chat interface. This allows for contextual AI assistance specific to each section.

## Core Concept

```text
┌─────────────────────────────────────────────────────┐
│ 1. CONFIDENTIALITY                        [⋯] [▼]  │  ← Control panel toggle
├─────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐ │
│ │ AI Chat for "Confidentiality"                   │ │  ← Contextual AI panel
│ │ ┌─────────────────────────────────────────────┐ │ │
│ │ │ "Expand this section with remedies..."      │ │ │
│ │ └─────────────────────────────────────────────┘ │ │
│ │ [Generate]                                      │ │
│ └─────────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────────┤
│   a. The Receiving Party agrees to hold...         │
│   b. "Confidential Information" means...           │
│      i. Trade secrets and proprietary data         │
│      ii. Business plans and strategies             │
└─────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Section Control Panel Component

**New File: `src/components/editor/SectionControlPanel.tsx`**

A collapsible panel that appears below depth-0 nodes:
- Collapsible container with header showing section name
- Tab system for different tools (AI Chat, Settings, Metadata)
- Scoped context for the section (passes section ID, label, and children)

**Key Props:**
- `sectionId: string` - ID of the depth-0 node
- `sectionLabel: string` - Label/title of the section
- `sectionTree: HierarchyNode[]` - Children of this section (for context)
- `onInsertContent: (items: Array<{label: string; depth: number}>) => void` - Insert generated content into section
- `isOpen: boolean` / `onToggle: () => void` - Controlled open state

### Phase 2: Section AI Chat Component

**New File: `src/components/editor/SectionAIChat.tsx`**

An AI chat interface scoped to a specific section:
- Chat-style interface with message history (session-scoped)
- Context-aware prompts that include the section's current content
- Actions: Generate sub-items, Expand section, Summarize, Refine language
- Streaming response display

**Key Features:**
- Automatically includes section context in prompts
- Quick action buttons for common operations
- Insert generated content directly into the section

### Phase 3: Backend - Section-Scoped AI Edge Function

**New File: `supabase/functions/section-ai-chat/index.ts`**

A new edge function that handles section-scoped AI requests:
- Accepts section context (label, existing children, full document context)
- Supports multiple operations: `expand`, `summarize`, `refine`, `chat`
- Returns structured outline items for insertion

### Phase 4: Integration with SimpleOutlineView

**Modify: `src/components/editor/SimpleOutlineView.tsx`**

Add detection and rendering of control panels for depth-0 nodes:
- Track which sections have open control panels
- Render `SectionControlPanel` after each depth-0 row
- Handle content insertion callbacks

### Phase 5: State Management

**Modify: `src/components/editor/context/DocumentContext.tsx`**

Add section panel state management:
- Track open/closed state per section ID
- Store chat history per section (session-scoped)
- Expose methods to insert content into specific sections

---

## Technical Details

### SectionControlPanel Structure

```tsx
interface SectionControlPanelProps {
  sectionId: string;
  sectionLabel: string;
  sectionChildren: HierarchyNode[];
  documentContext?: string;
  isOpen: boolean;
  onToggle: () => void;
  onInsertAfterSection: (items: Array<{label: string; depth: number}>) => void;
}
```

### SectionAIChat Message Format

```tsx
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  // For assistant messages with structured output
  generatedItems?: Array<{label: string; depth: number}>;
}
```

### Edge Function Request Schema

```typescript
interface SectionAIChatRequest {
  operation: 'expand' | 'summarize' | 'refine' | 'chat';
  sectionLabel: string;
  sectionContent: string; // Flattened children text
  documentContext?: string;
  userMessage?: string; // For 'chat' operation
}
```

### UI Toggle Mechanism

The control panel toggle button appears:
- In the row for depth-0 nodes only
- As a small icon button (⋯ or gear) next to the collapse toggle
- Positioned at the right edge of the row

### Session Storage for Chat History

```typescript
// Key: `section-chat-history:${documentId}:${sectionId}`
// Value: ChatMessage[]
```

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/components/editor/SectionControlPanel.tsx` | New | Collapsible control panel container |
| `src/components/editor/SectionAIChat.tsx` | New | AI chat interface for sections |
| `supabase/functions/section-ai-chat/index.ts` | New | Edge function for section-scoped AI |
| `src/components/editor/SimpleOutlineView.tsx` | Modify | Add control panel rendering for depth-0 nodes |
| `src/components/editor/context/DocumentContext.tsx` | Modify | Add section panel state management |
| `supabase/config.toml` | Modify | Add new edge function config |

---

## User Experience Flow

1. User sees a small toggle icon on depth-0 section rows
2. Clicking the toggle opens the control panel below that section
3. The AI Chat tab is the default view
4. User can type prompts or use quick actions ("Expand this section", "Add remedies")
5. AI generates content with section context
6. User clicks "Insert" to add generated items as children of that section
7. Panel can be collapsed to continue editing

---

## Styling Approach

The control panel uses:
- Collapsible animation matching the sidebar's sci-fi aesthetic
- Subtle border with gradient accent line at top
- Semi-transparent background for visual separation
- Compact design to minimize vertical space when expanded
