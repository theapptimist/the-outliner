
## Goal
Make the top-left Document AI “Redo Footnotes” actually update the visible References list by correctly mapping the AI tool output to the document’s citation markers (e.g., `[6]`).

Right now, the AI *is* calling the `update_citations` tool, but it returns keys like `"'[6]'收录于"` (contains `[6]` plus extra characters). The UI currently treats that whole string as the marker, so it writes a definition for a marker that doesn’t exist in your document. Result: the References list stays at “(Click to add reference)”.

## What I found (from your network log)
The AI response includes a tool call like:
- key: `"'[6]'收录于"`
- value: a bibliography entry

Your References UI looks up definitions using exact markers extracted from the outline text (`[1]`, `[2]`, …). Since `"'[6]'收录于"` ≠ `[6]`, nothing shows.

## Implementation plan (no behavior guesswork; make it provably work)

### 1) Make citation marker normalization robust in `DocumentAIPanel`
Update the `normalizeMarker()` logic so it can handle:
- keys containing a bracketed marker anywhere inside the string, e.g. `"'[6]'收录于"` → `[6]`
- quoted markers, e.g. `"'[6]'"` → `[6]`
- plain numbers, e.g. `6` or `_6` → `[6]`

New approach:
- Convert to string and trim
- First try to **extract the first bracketed marker** anywhere: `const m = raw.match(/\[(\d+)\]/)`; if found → return `[${m[1]}]`
- Else fall back to existing `_6` / `6` handling
- Else, if it already looks like `[...]`, keep it
- Else wrap it (last resort)

Why: Your extracted citations are numeric markers (`[1]`–`[6]`), and this guarantees the keys map.

### 2) Only apply citations that actually exist in the document (optional but recommended)
To avoid the AI writing definitions for junk keys, we can:
- compute a `Set` of markers currently present in the document (you already have `citations` shown in References; we can derive this set inside the panel by scanning `documentContext` with a simple regex like `/\[(\d+)\]/g` and collecting `[n]`)
- when applying tool output, **filter** to markers that are present
- show a toast like:
  - “Updated 6 citations: [1] [2] [3] [4] [5] [6]”
  - or if 0 were applied: “No matching citations found to update (expected markers like [1], [2]…)”

This makes it obvious when the tool output didn’t match the document.

### 3) Improve the backend function prompt to prevent malformed keys
In `supabase/functions/document-ai-chat/index.ts`, tighten the tool instruction so the model is much less likely to invent extra text in keys:
- Explicitly: “The `citations` object keys MUST be exactly one of: `[1]`, `[2]`, … (no quotes, no extra words, no other characters).”
- Add: “Do not use any language other than the marker for keys.”
- Add: “If you see markers in the document, only output those.”

This reduces reliance on normalization, but we’ll still keep normalization as a safety net.

### 4) Add lightweight UI feedback for trust
In `DocumentAIPanel.tsx`:
- After applying, append a small “Applied: [1]–[6]” line to the assistant message (or include it in the “Citations updated” header).
- If parsing succeeds but 0 citations match, show an error toast and display a message explaining what keys were received vs what markers exist (briefly).

This addresses the “it says it did it but nothing changed” experience.

### 5) Verify end-to-end (the important part)
After implementation:
1. Open the document
2. Ensure the outline contains `[1] … [6]` (your screenshot shows it does)
3. Click the top-left sparkle icon → “Redo Footnotes”
4. Confirm:
   - Toast says “Updated 6 citation(s)” (or similar)
   - References list shows actual bibliography text next to `[1] … [6]`
5. Refresh the page and confirm they still persist (since citationDefinitions are persisted in document state already)

## Edge cases handled
- Tool keys include extra characters (your current failure mode) → fixed by extracting bracketed marker
- Tool keys are `6` / `_6` → already supported, will remain supported
- Tool returns citations for markers not present in document → filtered out (if we implement step 2), and user gets a clear message
- Model responds with plain text and no tool call → UI should show “No citations updated” (we can detect tool call absence and prompt retry)

## Files to change
- `src/components/editor/DocumentAIPanel.tsx`
  - strengthen `normalizeMarker()`
  - (optional) filter to markers present in the doc
  - improve user feedback/toasts
- `supabase/functions/document-ai-chat/index.ts`
  - tighten system prompt instructions for tool output keys

## Next feature suggestions (optional)
- Add a “Preview changes” step: show the proposed references before applying them.
- Add a “Redo only missing references” action (fill only ones still showing “Click to add reference”).
- Add a “Citation style” selector (Chicago / MLA / APA) for AI-generated references.
- Add an “Audit citations” action: find unused references and missing markers.
