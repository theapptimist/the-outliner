# Plan: Fix "Back to Snippets" showing empty tiles

## Status: ✅ IMPLEMENTED

## What was fixed
Replaced the `source_document_id` filtering logic with a lookup against the `document_entity_refs` junction table. This ensures that when documents are selected in the explorer, the entity tiles show entities that are actually **referenced in those documents**, not just entities whose `source_document_id` happens to match.

## Changes made
**File: `src/components/editor/MasterLibraryDialog.tsx`**

1. Added `allowedEntityIds` state (`Set<string> | null`) to track which entities should be shown
2. Added `useEffect` that queries `document_entity_refs` when documents are selected
3. Updated `filteredEntities` memo to filter by `allowedEntityIds.has(e.id)` instead of `e.source_document_id`
4. Added loading state for the ref query so UI shows spinner during lookup

## Verification steps
Run this exact flow 5 times:

1. Open **Snippets**
2. Click an entity → click **Jump to document**
3. Confirm: doc + sidebar library load normally
4. Click **Back to Snippets**
5. In Snippets:
   - Confirm entity tiles appear (not blank)
   - If any document selection is active, tiles should correspond to that selection
