
# Feature: Dedicated AI Toolbar

## The Problem

AI controls are currently scattered across multiple locations:
- **SectionToolbar**: Per-section Sparkles button, Open/Close All panels toggle
- **EditorSidebar**: AI Generate tab with simple prompt interface
- **SectionAIChat**: Document planning, auto-write cascade, per-section chat

As the AI capabilities grow (multi-window cascade, document planning, prose generation modes), having a central command center for AI operations becomes essential.

## The Solution

Create a dedicated **AI Toolbar** component that provides centralized control over all AI-related features. This toolbar will be positioned prominently and offer quick access to global AI operations.

## Design Options

### Option A: Horizontal Toolbar Above Document

A horizontal bar above the outline area with AI controls:

```
┌─────────────────────────────────────────────────────────────┐
│ ✨ AI  │ [Plan Doc] [Open All ↓] [Close All ↑] │ Status... │
└─────────────────────────────────────────────────────────────┘
│                                                             │
│                    Document Content                         │
│                                                             │
```

### Option B: Floating AI Command Bar

A floating command bar (similar to Notion's slash command) that appears when needed:

```
                    ┌─────────────────────────────┐
                    │ ✨ Plan Doc  ↓ Open All     │
                    │    Auto-Write  ↑ Close All  │
                    └─────────────────────────────┘
```

### Option C: Sidebar AI Pane Enhancement (Recommended)

Enhance the existing "AI" tab in the sidebar to become a true AI command center:

```
┌──────────────────────────────┐
│ ✨ AI Command Center         │
├──────────────────────────────┤
│ [Plan Document]              │
│ [Auto-Write All Sections]    │
├──────────────────────────────┤
│ Panel Controls               │
│ [↓ Open All] [↑ Close All]   │
│ Active: 3/6 panels           │
├──────────────────────────────┤
│ Quick Generate               │
│ [Generate outline from...]   │
│                              │
│ [____________________]       │
│ [Generate]                   │
└──────────────────────────────┘
```

## Recommended Implementation: Option C

This approach:
1. **Consolidates** all AI controls in one logical location
2. **Reuses** existing sidebar infrastructure
3. **Provides visibility** into the cascade status (X/Y panels active)
4. **Separates concerns**: Document-level AI actions vs. per-section AI chats

## Component Structure

```
src/components/editor/
├── AIToolbar.tsx              (NEW - the main AI command center)
├── AIGeneratePane.tsx         (existing - will be integrated)
└── EditorSidebar.tsx          (updated to use AIToolbar)
```

## Technical Changes

### 1. Create `AIToolbar.tsx`

A new component that combines:
- **Document Planning**: "Plan Document" button (opens DocumentPlanDialog)
- **Cascade Controls**: Open All / Close All panels with status indicator
- **Auto-Write**: Trigger the multi-window cascade
- **Quick Generate**: The existing prompt-based generation

```typescript
interface AIToolbarProps {
  collapsed: boolean;
  // Document planning
  onPlanDocument: () => void;
  isPlanningLoading: boolean;
  // Panel cascade controls
  openPanelCount: number;
  totalSectionCount: number;
  onOpenAllPanels: () => void;
  onCloseAllPanels: () => void;
  // Quick generate
  onInsertHierarchy: (items: Array<{ label: string; depth: number }>) => void;
}
```

### 2. State Management

The AIToolbar needs access to:
- **Panel state** from `SimpleOutlineView` (openSectionPanels, allSections)
- **Document planning** functions from `SectionAIChat` (moved up or shared)

This requires lifting some state or using a shared context. Two approaches:

**Approach A: Pass through EditorSidebar**
- `SimpleOutlineView` passes panel state up via callbacks
- `Editor.tsx` forwards to `EditorSidebar`
- More props but simpler

**Approach B: Create AIContext**
- New context to share AI-related state globally
- Cleaner prop drilling but more infrastructure

Recommend **Approach A** for initial implementation.

### 3. Visual Design

The AI Toolbar will follow the existing sidebar styling:
- Color-coded sections (primary for AI, success for active states)
- Compact button layout when collapsed
- Status indicators showing active panels

```
┌──────────────────────────────┐
│ ✨ AI                        │
├──────────────────────────────┤
│ Document                     │
│ [Plan Doc]                   │
│ [Auto-Write] (requires plan) │
├──────────────────────────────┤
│ Section Panels    [3/6]      │
│ [↓ Open All] [↑ Close All]   │
├──────────────────────────────┤
│ Quick Generate               │
│ [textarea...]                │
│ [Generate]                   │
└──────────────────────────────┘
```

### 4. Wire Through the Component Tree

```
Editor.tsx
  └─ EditorSidebar
       └─ AIToolbar (NEW - replaces AIGeneratePane when activeTab === 'ai')
            ├─ Document Planning section
            ├─ Panel Controls section
            └─ Quick Generate section (existing AIGeneratePane logic)
  └─ SimpleOutlineView
       ├─ provides: openPanelCount, totalSectionCount
       ├─ provides: onOpenAllPanels, onCloseAllPanels
       └─ SectionToolbar (remove redundant Open/Close All from first section)
```

### 5. Remove Redundancy

Once AIToolbar exists, remove the Open/Close All button from `SectionToolbar` since it will be accessible from the dedicated AI toolbar in the sidebar.

## Files to Create/Modify

1. **`src/components/editor/AIToolbar.tsx`** (NEW)
   - Main AI command center component
   - Integrates AIGeneratePane logic
   - Document planning controls
   - Panel cascade controls with status

2. **`src/components/editor/EditorSidebar.tsx`**
   - Replace `AIGeneratePane` with `AIToolbar` for 'ai' tab
   - Add new props for panel state and callbacks

3. **`src/components/editor/SimpleOutlineView.tsx`**
   - Expose panel state via new callbacks to parent
   - Keep existing functionality

4. **`src/pages/Editor.tsx`**
   - Wire panel state from content area to sidebar

5. **`src/components/editor/SectionToolbar.tsx`** (Optional cleanup)
   - Consider removing Open/Close All from first section toolbar
   - OR keep it as a convenience shortcut

## User Experience After Implementation

1. User clicks "AI" tab in sidebar
2. Sees dedicated AI Command Center with:
   - "Plan Document" button
   - Panel status indicator (e.g., "3/6 panels open")
   - Open All / Close All buttons
   - Quick generate textarea
3. Can manage all AI windows from one place
4. Per-section toolbars still have individual AI toggle for quick access

## Future Enhancements

- **AI Mode Selector**: Choose between "Outline" and "Prose" generation modes
- **Cascade Progress**: Show which sections are currently generating
- **Cancel Button**: Abort an in-progress cascade
- **Generation History**: Quick access to recent AI operations
