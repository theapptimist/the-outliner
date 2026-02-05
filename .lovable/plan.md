

## Make Entity Highlights Clickable (People, Places, Dates, Terms)

### Problem
Clicking on highlighted entities in the TipTap editor doesn't reveal them in the Library sidebar. The current `onClick` handler on the parent container is intercepted by ProseMirror's text selection behavior before it can fire.

### Root Cause
ProseMirror captures mouse events for caret placement and text selection. React's `onClick` on a parent element fires **after** ProseMirror has already processed the event and moved the selection. This means the click handler sees the event, but ProseMirror's default behavior has already executed.

### Solution
Create a dedicated **TipTap extension** that registers a ProseMirror plugin with `handleClick` in its `props`. This intercepts clicks **before** ProseMirror's default behavior and checks if the click target is an entity highlight.

---

### Implementation

**1. Create New Extension: `EntityClickExtension.ts`**

```text
src/components/editor/extensions/EntityClickExtension.ts
```

- Uses TipTap's `addStorage` to hold a mutable callback reference
- Adds a ProseMirror plugin with `handleClick` prop
- When a click lands on `.term-highlight`, `.person-highlight`, `.place-highlight`, or `.date-highlight`:
  - Extract the text content
  - Determine entity type from the class
  - Call the stored callback with `(entityType, matchedText)`
  - Return `true` to prevent ProseMirror's default selection behavior
- For clicks elsewhere, return `false` to allow normal editing

**2. Update `DocumentEditor.tsx`**

- Import and register `EntityClickExtension` in the editor's extensions array
- After editor initialization, set the click callback:
  ```typescript
  editor.storage.entityClick.onEntityClick = (type, text) => {
    revealEntityInLibrary(type, text);
  };
  ```
- Remove the existing `handleEntityHighlightClick` callback and `onClick` prop (it's now handled at the plugin level)

**3. CSS Enhancement (already in place)**

The existing `.entity-clickable` class already has `cursor: pointer`, which provides visual feedback.

---

### Technical Details

**EntityClickExtension.ts structure:**

```typescript
import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export type EntityType = 'term' | 'person' | 'place' | 'date';
export type EntityClickCallback = (type: EntityType, text: string) => void;

export interface EntityClickStorage {
  onEntityClick: EntityClickCallback | null;
}

export const EntityClickExtension = Extension.create<{}, EntityClickStorage>({
  name: 'entityClick',

  addStorage() {
    return {
      onEntityClick: null,
    };
  },

  addProseMirrorPlugins() {
    const storage = this.storage;

    return [
      new Plugin({
        key: new PluginKey('entityClick'),
        props: {
          handleClick(view, pos, event) {
            const target = event.target as HTMLElement;
            
            // Check for entity highlight classes
            const classToType: Record<string, EntityType> = {
              'term-highlight': 'term',
              'person-highlight': 'person',
              'place-highlight': 'place',
              'date-highlight': 'date',
            };
            
            for (const [className, entityType] of Object.entries(classToType)) {
              if (target.classList.contains(className)) {
                const text = target.textContent || '';
                if (text && storage.onEntityClick) {
                  storage.onEntityClick(entityType, text);
                  return true; // Prevent default selection behavior
                }
              }
            }
            
            return false; // Allow normal behavior
          },
        },
      }),
    ];
  },
});
```

**DocumentEditor.tsx changes:**

```typescript
// Add to imports
import { EntityClickExtension } from './extensions/EntityClickExtension';

// Add to extensions array in useEditor
EntityClickExtension,

// Add useEffect to set callback after editor init
useEffect(() => {
  if (!editor) return;
  editor.storage.entityClick.onEntityClick = (type, text) => {
    revealEntityInLibrary(type, text);
  };
}, [editor, revealEntityInLibrary]);

// Remove handleEntityHighlightClick callback and onClick prop
```

---

### Expected Behavior

| Action | Before | After |
|--------|--------|-------|
| Click highlighted person name | Caret moves to click position | Library opens to People tab, person card selected |
| Click highlighted place name | Caret moves to click position | Library opens to Places tab, place card selected |
| Click highlighted date | Caret moves to click position | Library opens to Dates tab, date card selected |
| Click highlighted term | Caret moves to click position | Library opens to Terms tab, term card selected |
| Click regular text | Caret moves to click position | Caret moves to click position (unchanged) |

---

### Files to Create/Modify

1. **Create**: `src/components/editor/extensions/EntityClickExtension.ts`
2. **Modify**: `src/components/editor/DocumentEditor.tsx`
   - Add extension import
   - Add extension to useEditor
   - Add useEffect to set callback
   - Remove onClick handler and handleEntityHighlightClick

