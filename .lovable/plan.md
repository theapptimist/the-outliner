
Goal: Fix “Open Recent” so it reliably shows multiple useful recent documents (not just a single “Untitled”), while preserving the “recently opened” behavior.

What I found (current behavior + root cause)
- The File menu’s “Open Recent” list is powered by `getRecentCloudDocuments()` in `src/lib/cloudDocumentStorage.ts`.
- `getRecentCloudDocuments()` uses a local list of IDs stored in the browser (`outliner:recent-cloud`). If that list has at least 1 ID, it ONLY returns those documents via `.in('id', recentIds)`.
- Your report (“there’s basically nothing there except usually one untitled doc”) matches this: the “recent-cloud” list often contains just the currently-opened doc, so “Open Recent” becomes a 1-item list.
- Even if you have many saved docs (and “Open…” can see them), “Open Recent” won’t fall back to “most recently updated” once it has any IDs at all.

High-level fix
- Make `getRecentCloudDocuments()` return a “best effort” list up to MAX_RECENT:
  1) Prefer “recently opened” docs in the order stored in local storage.
  2) If that yields fewer than MAX_RECENT (or some are missing/deleted), fill the remaining slots with the most recently updated documents (excluding any already included).
- Additionally, strengthen how we populate the recent list by recording “recent” not only on load/open, but also on explicit “Save” (so documents you actively work on surface in “Open Recent” even if you didn’t open them via the Open dialog recently).

Implementation plan (code changes)
1) Update `getRecentCloudDocuments()` (src/lib/cloudDocumentStorage.ts)
   - Keep reading `recentIds` from local storage as it does now.
   - Query the “recently opened” IDs:
     - `.in('id', recentIds)` as today.
     - Reconstruct order using the stored ID order (as today).
   - If fewer than `MAX_RECENT` docs were found:
     - Run a second query to fetch additional docs ordered by `updated_at desc`, limited to the remaining count.
     - Exclude IDs already present in the list (to avoid duplicates).
     - Append these to the result.
   - Return the combined list.
   - Edge cases handled:
     - If recentIds includes deleted docs, they won’t be returned by the first query; we’ll fill from the fallback query.
     - If the user has fewer than MAX_RECENT docs total, we return whatever exists.

2) Improve “recent” tracking by saving
   - In `saveCloudDocument()` (src/lib/cloudDocumentStorage.ts), after a successful save, call `addToRecentCloudDocuments(doc.meta.id)`.
   - Rationale: users often create/open a single document and then work across multiple docs via other UI flows; saving is a strong “this document is relevant” signal. This also helps in cases where “recent opens” isn’t being updated as expected due to navigation patterns.

3) Small UX verification adjustments in FileMenu (optional but recommended)
   - Ensure “Open Recent” shows up more predictably:
     - With the new combined list, `recentDocs.length` should usually be > 0, so the “Open Recent” entry will appear.
   - (Optional) Rename the small section title or tooltip in diagnostics (if any) to clarify that the list is “Recent (opened + updated)” to match the new behavior.

Testing plan (manual, end-to-end)
1) Baseline check
   - Open the editor.
   - Open File Menu → confirm “Open Recent” appears and shows more than just one item (assuming multiple documents exist in your account).
2) Confirm fallback works when “recent-cloud” has only 1 ID
   - Clear just the “recent-cloud” local storage key (or simulate it by opening only one document).
   - Re-open the app → File Menu → Open Recent should now show the current doc plus additional recently updated docs.
3) Confirm save updates recents
   - Open a document (any).
   - Make a small change and Save.
   - Open File Menu → Open Recent should include that document near the top (at least within the 5 items).
4) Regression checks
   - “Open…” dialog still lists all documents correctly.
   - Clicking a recent item opens the selected doc and updates the recent ordering.

Files that will be changed
- src/lib/cloudDocumentStorage.ts (main fix: combine “recently opened” + “recently updated”; also add recent tracking on save)
- (Possibly) src/components/editor/FileMenu.tsx (only if we decide to adjust labeling/UX; not required for the core bug)

Notes / trade-offs
- This approach keeps the “recently opened” intent, but prevents the UI from becoming empty/useless when the local recent list is short.
- It is purely a frontend behavior change; no backend schema changes required.

