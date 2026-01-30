
# Plan: Add "Prompts" Tab to Section AI Panel

## Overview
Add a tab-based interface to the section AI panel where "Prompts" is the leftmost tab, allowing users to view and manage their prompts (current + history). This replaces the current small "Queued prompt ready" indicator with a proper browsable interface.

## User Experience

### Tab Layout (Header Strip)
The panel header will have tabs on the left side:
- **Prompt** (leftmost) — Shows the current/queued prompt and prompt history
- **Chat** — The existing AI conversation view

### Prompt Tab Contents
1. **Current Prompt** section at top
   - Shows the queued prompt in a read-only display (if exists)
   - "Use" button to load it into the input
   - "Clear" button to discard

2. **History** section below
   - List of previously sent prompts from the chat session
   - Extracted from the existing `messages` array (user role messages)
   - Click any to re-use it
   - Sorted most recent first

3. **Input area** at bottom (shared across tabs)
   - The textarea remains visible in both tabs for quick prompt entry

## Technical Approach

### File: `src/components/editor/SectionAIChat.tsx`

1. **Add tab state**
   ```tsx
   const [activeTab, setActiveTab] = useState<'prompt' | 'chat'>('chat');
   ```

2. **Create tab header UI**
   - Two tabs styled like small pill buttons
   - Prompt tab shows badge if there's a queued prompt

3. **Prompt tab content**
   - Extract user messages from `messages` array for history
   - Show queued prompt prominently at top
   - Clickable history items that populate the input

4. **Conditional rendering**
   - When `activeTab === 'prompt'`: Show prompt management view
   - When `activeTab === 'chat'`: Show existing messages + quick actions

### File: `src/components/editor/SectionControlPanel.tsx`
- No changes needed — panel structure remains the same

## Visual Design

```text
┌─────────────────────────────────────────────────┐
│ [Prompt] [Chat]              [⛶] [✕]           │
├─────────────────────────────────────────────────┤
│ ┌─ CURRENT PROMPT ────────────────────────────┐ │
│ │ "Analyze the four primary long-term..."     │ │
│ │                              [Use] [Clear]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ HISTORY                                         │
│ ┌─────────────────────────────────────────────┐ │
│ │ • Expand this section with more detailed... │ │
│ │ • Refine and improve the language of...     │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Type a prompt...                            │ │
│ │                                        [→]  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

## Implementation Steps

1. Add `activeTab` state to `SectionAIChat`
2. Create tab header with "Prompt" and "Chat" buttons
3. Build the Prompt tab view:
   - Current queued prompt display
   - History list (derived from messages)
   - Click-to-reuse functionality
4. Move quick actions to only show in Chat tab
5. Keep input textarea visible in both tabs
6. Add badge indicator on Prompt tab when queue has prompt

## Benefits
- **Prompt visibility**: Full prompt text always accessible
- **Reusability**: Easy to re-run previous prompts
- **Clean separation**: Chat history vs prompt management
- **Discoverability**: Users see what prompts are available
