
## Summary of what’s going wrong (in plain English)
When you return to **Snippets** from a document, the Snippets dialog *does* open, but it often shows “no tiles” because the dialog is applying a hidden filter: **it’s filtering entities by the selected documents**, and that filter is currently implemented in a way that excludes most (or all) entities.

Specifically, the Master Library’s entity list is filtered using `entity.source_document_id`, but many entities won’t have `source_document_id` set (for example: imported entities, migrated entities that weren’t backfilled, entities created in other flows, etc.). So once a document selection exists, the UI can “filter everything away,” resulting in a blank tile area.

This matches your observation:
- Jump from Snippets → doc works.
- Back to Snippets opens Snippets UI, but “library appears without tiles” every time.
- The behavior is no longer “fully intermittent” once you’re in that “return” state, because the filter condition becomes consistently true (selected docs set) while the filter logic remains consistently too strict.

## Evidence in your code
In `src/components/editor/MasterLibraryDialog.tsx`, inside `LibraryTabContent`:

- Filtering only runs when `selectedDocumentIds.size > 0`
- Filtering currently does this:

```ts
entities = entities.filter(e => 
  e.source_document_id && selectedDocumentIds.has(e.source_document_id)
);
```

That means: if `source_document_id` is null on most entities, you get **zero tiles**.

## The fix (what we’ll change)
### Goal
When the user selects one or more documents in the Snippets explorer (or when selection persists across reopen), the entity tiles should show entities that are actually **present in those documents**, not just entities that were originally “sourced from” those documents.

### Implementation approach
1. **Replace the current selected-document filtering rule**:
   - Instead of filtering by `entities.source_document_id`,
   - We will filter by the junction table `document_entity_refs` (already used elsewhere in the app via `useEntityDocuments`).
   - This gives: “show me entities referenced by the selected documents.”

2. **Add a small piece of state inside `LibraryTabContent`**:
   - `allowedEntityIds: Set<string> | null`
   - When `scope === 'my-library'` and `selectedDocumentIds.size > 0`, we query:
     - `document_entity_refs` where `document_id IN (selectedDocumentIds)`
     - collect `entity_id`s into a `Set`
   - When no documents are selected, set `allowedEntityIds` back to `null`.

3. **Update `filteredEntities` memo logic**:
   - If `allowedEntityIds` is non-null:
     - Filter entities by `allowedEntityIds.has(entity.id)`
     - (Optionally) union-in entities where `source_document_id` is selected as a fallback, but in practice `document_entity_refs` should cover the correct “entities used in document” definition.
   - Keep the existing searchQuery filter after that.

4. **UX guardrail (recommended)**
   - When the dialog opens (`open === true`), optionally clear “stale selection” if the selection is the culprit for confusion.
   - However, because you intentionally support folder-based multi-selection and bulk actions, we should be careful here:
     - I suggest we **do not auto-clear selection** on open by default.
     - Instead, we fix the filter so selection is safe and predictable.
     - If you still want auto-clear only when returning via “Back to Snippets,” we can add a narrow mechanism later (e.g., a `reason` flag) but that requires plumbing additional state through NavigationContext.

## Files we will modify
1. `src/components/editor/MasterLibraryDialog.tsx`
   - Update `LibraryTabContent` to compute selected-doc entity IDs via `document_entity_refs`
   - Use those IDs for filtering tiles when documents are selected

(We likely do not need to change NavigationContext or NavigationBackBar further for this specific “no tiles” symptom.)

## Edge cases we will handle
- **Large multi-selection**: The query can return many refs; we’ll de-duplicate in a `Set`.
- **No refs found**: The UI should show an empty-state message (expected) rather than blank/buggy rendering.
- **Entities that appear in a doc but aren’t owned**:
  - For “My Library” scope, you’re currently showing owned entities only. That’s fine, but note: document refs could include shared/public entities too. If you want “selected doc shows everything in doc,” we can expand scope logic later.
- **Performance**: We’ll only run the ref query when selection changes and only for the “my-library” tab.

## How you’ll verify it’s fixed (end-to-end)
Run this exact flow 5 times (because your system has had intermittent behavior too):

1. Open **Snippets**.
2. Click an entity → click **Jump to document**.
3. Confirm: doc + sidebar library load normally.
4. Click **Back to Snippets**.
5. In Snippets:
   - Confirm entity tiles appear (not blank).
   - If any document selection is active (you might see a “Clear” button in the Documents strip), tiles should still appear and correspond to that selection.

## If it still fails after this fix
The next most likely cause would be state that persists across the lazy-mounted dialog:
- `activeTab` could be stuck on “shared/public”
- `entityFilter` could be set to a type with no entities
- `searchQuery` could be non-empty (filtering everything out)

If that happens, we’ll add a very small “state debug header” (temporary) inside the dialog showing:
- activeTab, entityFilter, searchQuery length, selectedDocumentIds.size, and counts (ownedEntities/publicEntities/sharedEntities).
That will pinpoint which filter is eliminating tiles.

## Why this is the right next step
Right now, the “Back to Snippets shows no tiles” symptom is best explained by **a deterministic filtering bug**, not navigation stack timing. Fixing the filter makes the Snippets dialog robust regardless of how it was opened (normal open vs. Back navigation vs. reopen after jump), and it aligns the UI with the user’s mental model: “show entities used in these documents.”
