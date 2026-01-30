

# Fix: Prompt Disappearing on Panel Close/Reopen

## Investigation Summary

The prompt queue system uses **sessionStorage** which persists within the browser tab. The current flow is:

1. Plan Document → AI generates prompts → Stored in sessionStorage
2. Open panel → Loads prompt from sessionStorage → Shows in textarea
3. Close panel → Component unmounts, loses local state
4. Reopen panel → Should reload from sessionStorage

## The Issue

There's a subtle bug: The `useEffect` that loads the queued prompt only runs when `sectionId` or `promptQueue` changes - but **not** when the panel is reopened because React may be reusing the same component instance in some cases.

Additionally, the textarea `input` state is **not synchronized** with sessionStorage - only loaded once.

## Root Cause

```typescript
// Only loads on mount or sectionId change - NOT on every panel open
useEffect(() => {
  const queuedData = promptQueue.getQueuedPromptData(sectionId);
  if (queuedData?.prompt) {
    setQueuedPrompt(queuedData.prompt);
    setInput(queuedData.prompt);
  }
}, [sectionId, promptQueue]);
```

The problem: `promptQueue` is a memoized object that may not change between close/reopen cycles, so the effect doesn't re-run.

## Solution

**Option A: Force reload on every mount** - Add a mount counter or empty dependency array trigger

**Option B: Sync input state with sessionStorage** - Use the `_version` from promptQueue to trigger reloads

### Recommended Fix (Option B)

```typescript
// Listen to queue version changes to sync input with sessionStorage
useEffect(() => {
  const queuedData = promptQueue.getQueuedPromptData(sectionId);
  if (queuedData?.prompt) {
    setQueuedPrompt(queuedData.prompt);
    // Only update input if it's empty (don't overwrite user edits)
    if (!input.trim()) {
      setInput(queuedData.prompt);
    }
  } else {
    setQueuedPrompt(null);
  }
}, [sectionId, promptQueue._version]); // Use _version to detect queue changes
```

But this alone won't fix the close/reopen issue. The real fix needs to ensure the effect runs on every mount:

```typescript
// Force re-load queued prompt on every mount
useEffect(() => {
  const queuedData = promptQueue.getQueuedPromptData(sectionId);
  if (queuedData?.prompt) {
    setQueuedPrompt(queuedData.prompt);
    setInput(queuedData.prompt);
  }
  // Empty dependency array = run on every mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// Also keep the sectionId change handler
useEffect(() => {
  const queuedData = promptQueue.getQueuedPromptData(sectionId);
  if (queuedData?.prompt) {
    setQueuedPrompt(queuedData.prompt);
    setInput(queuedData.prompt);
  }
}, [sectionId, promptQueue]);
```

## Technical Changes

### File: `src/components/editor/SectionAIChat.tsx`

1. **Split the effect** into mount-time and change-time handlers
2. **Preserve input if user has edited** - only auto-populate if input is empty

```typescript
// Load queued prompt on component mount (handles panel reopen)
useEffect(() => {
  const queuedData = promptQueue.getQueuedPromptData(sectionId);
  if (queuedData?.prompt) {
    setQueuedPrompt(queuedData.prompt);
    setInput(queuedData.prompt);
  }
}, []); // Run on mount only

// Also reload when sectionId changes (handles switching sections)
useEffect(() => {
  const queuedData = promptQueue.getQueuedPromptData(sectionId);
  if (queuedData?.prompt) {
    setQueuedPrompt(queuedData.prompt);
    setInput(queuedData.prompt);
  } else {
    setQueuedPrompt(null);
  }
}, [sectionId]);
```

## Verification Steps

After implementing:
1. Plan Document → Queue prompts (don't auto-execute)
2. Open section 6 AI panel → Confirm prompt appears
3. Close panel (don't send)
4. Reopen panel → Prompt should still be there
5. Send the prompt → Prompt clears (expected)
6. Close and reopen → Prompt should be gone (expected)

