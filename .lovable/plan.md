
## Goal
Fix the library tile regression so that tiles appear reliably even when documents are selected in the explorer.

## What's happening
When you navigate "Back to Snippets", any previously selected documents persist. The filtering logic queries `document_entity_refs` to find entities that belong to those documents. Since many entities lack entries in that table (legacy data, or sync not running), the query returns zero IDs, causing all tiles to be filtered out.

Clicking **Clear** removes the selection, which bypasses the filter entirely — confirming this is a data gap rather than a code bug in the UI itself.

## Root cause
The recent refactor replaced the old `source_document_id` filter with a `document_entity_refs` lookup. However:
1. Not all entities have `document_entity_refs` rows (legacy data, migrations not run, or sync hasn't happened).
2. When the query returns zero entity IDs, the filter removes every tile.

## The fix
Use a **fallback union** approach: when documents are selected, show entities that either:
- Have a matching row in `document_entity_refs`, OR
- Have a `source_document_id` matching one of the selected documents

This ensures tiles appear for both:
- New entities (properly linked via the junction table)
- Legacy entities (linked only via `source_document_id`)

## Technical changes

### File: `src/components/editor/MasterLibraryDialog.tsx`

**Change 1: Update the filtering memo (around lines 608-619)**

Current logic:
```typescript
if (scope === 'my-library' && allowedEntityIds !== null) {
  entities = entities.filter(e => allowedEntityIds.has(e.id));
}
```

New logic:
```typescript
if (scope === 'my-library' && selectedDocumentIds.size > 0) {
  // Union: entities with matching junction-table refs OR matching source_document_id
  entities = entities.filter(e => 
    (allowedEntityIds !== null && allowedEntityIds.has(e.id)) ||
    (e.source_document_id && selectedDocumentIds.has(e.source_document_id))
  );
}
```

This way:
- If `allowedEntityIds` is still loading (`null`), we fall back entirely to `source_document_id`
- If `allowedEntityIds` loaded but is empty (no refs), we still show entities by `source_document_id`
- If both exist, we show the union

**Change 2: Adjust dependency array**

Add `selectedDocumentIds` to the `useMemo` dependency array (it may already be there implicitly via closure, but making it explicit is safer).

## Why this is the right approach
1. **Backward compatible**: Existing entities with only `source_document_id` continue to work
2. **Forward compatible**: New entities with proper `document_entity_refs` entries will also work
3. **No data migration required**: No need to backfill the junction table immediately
4. **Minimal code change**: Only touches the filtering logic, not the fetch logic

## Verification steps
1. Open Snippets
2. Select one or more documents in the Documents explorer
3. Confirm tiles appear (should show entities from those documents)
4. Clear selection → confirm all tiles appear
5. Jump to document → Back to Snippets → confirm tiles appear
6. Repeat flow 5 times to verify consistency

## Files to modify
- `src/components/editor/MasterLibraryDialog.tsx` (filtering logic only)
