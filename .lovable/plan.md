

# Fix Master Library Loading - Abort Stale Requests & Reset State on Reopen

## Problem Summary

When clicking "Back to Snippets", the Master Library opens immediately but its content stays on infinite spinners for 20-40+ seconds (sometimes never loads). The navigation fix is working, but the data fetching inside the Master Library is broken.

## Root Cause

The Master Library uses the `lazyDialog` HOC pattern which keeps the component mounted after first open. When the dialog reopens:

1. **Stale requests compete with new ones**: Previous fetch requests may still be in-flight, causing race conditions where old results overwrite new state
2. **No request versioning**: There's no way to tell which request "wins" when multiple are in flight
3. **Session token retrieval delays**: The `abortableFetch` utility retrieves the session token inside the timeout window, which can cause the entire request to stall if auth is slow
4. **Multiple concurrent fetch paths**: The dialog triggers 5+ different data fetches on open without coordination

## Solution: Request Versioning + AbortController Cleanup

Add an "open sequence" counter that increments each time the dialog opens. Only allow data from the *current* sequence to update state. Also cancel in-flight requests when the dialog closes.

---

## Implementation Steps

### Step 1: Add Open Sequence Tracking in MasterLibraryDialog

**File: `src/components/editor/MasterLibraryDialog.tsx`**

Add a ref to track the current "open sequence" and pass it to data-fetching effects:

```typescript
// Near the top of MasterLibraryDialog component
const openSeqRef = useRef(0);

// In the useEffect that triggers on open
useEffect(() => {
  if (open) {
    // Increment sequence - any in-flight requests from previous opens are now stale
    openSeqRef.current += 1;
    const currentSeq = openSeqRef.current;
    
    // Reset navigation state
    setIsNavigating(false);
    
    // Only update state if still on this sequence
    refreshMaster().then(() => {
      if (openSeqRef.current !== currentSeq) return; // stale
    });
    refreshDocs().then(() => {
      if (openSeqRef.current !== currentSeq) return; // stale
    });
  }
}, [open]);
```

### Step 2: Add AbortController to Document Fetching

**File: `src/components/editor/MasterLibraryDialog.tsx`**

The `allDocuments` fetch effect (around line 818) needs an AbortController:

```typescript
useEffect(() => {
  if (!open || !user?.id) return;
  
  const controller = new AbortController();
  const seq = openSeqRef.current;
  
  setLoadingAllDocs(true);
  
  supabase
    .from('documents')
    .select('id, title, folder_id, content, hierarchy_blocks')
    .eq('user_id', user.id)
    .order('title')
    .abortSignal(controller.signal) // Supabase supports this
    .then(({ data, error }) => {
      // Check if request is stale
      if (openSeqRef.current !== seq) return;
      if (controller.signal.aborted) return;
      
      // ... rest of logic unchanged
    });
  
  return () => {
    controller.abort();
  };
}, [open, user?.id, libraryDocuments]);
```

### Step 3: Update useMasterEntities Hook for Abort Support

**File: `src/hooks/useMasterEntities.ts`**

Add AbortController support to the fetch function:

```typescript
const fetchEntities = useCallback(async (signal?: AbortSignal) => {
  if (!user) {
    setEntities([]);
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    let query = supabase
      .from('entities')
      .select('*')
      .eq('owner_id', user.id);

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }
    
    // Add abort signal
    if (signal) {
      query = query.abortSignal(signal);
    }

    const { data, error: fetchError } = await query.order('created_at', { ascending: false });

    // Check if aborted
    if (signal?.aborted) return;
    
    if (fetchError) throw fetchError;
    // ... rest unchanged
  } catch (err) {
    if (signal?.aborted) return; // Don't set error state for aborted requests
    console.error('[useMasterEntities] Error fetching entities:', err);
    setError(err instanceof Error ? err : new Error('Failed to fetch entities'));
  } finally {
    if (!signal?.aborted) {
      setLoading(false);
    }
  }
}, [user, entityType]);
```

### Step 4: Update useMasterLibraryDocuments Hook

**File: `src/hooks/useMasterLibraryDocuments.ts`**

Similar abort support:

```typescript
const fetchDocuments = useCallback(async (signal?: AbortSignal) => {
  if (!user) {
    setDocuments([]);
    setLoading(false);
    return;
  }

  setLoading(true);

  try {
    // Add signal to both queries
    let entitiesQuery = supabase
      .from('entities')
      .select('source_document_id')
      .eq('owner_id', user.id)
      .not('source_document_id', 'is', null);
    
    if (signal) entitiesQuery = entitiesQuery.abortSignal(signal);
    
    const { data: entities, error: entitiesError } = await entitiesQuery;
    
    if (signal?.aborted) return;
    // ... rest with similar abort checks
  } catch (err) {
    if (signal?.aborted) return;
    // ... error handling
  } finally {
    if (!signal?.aborted) {
      setLoading(false);
    }
  }
}, [user]);
```

### Step 5: Wire Up Abort Controllers in Dialog

**File: `src/components/editor/MasterLibraryDialog.tsx`**

Create a centralized abort controller that's cancelled on close:

```typescript
const abortControllerRef = useRef<AbortController | null>(null);

useEffect(() => {
  if (open) {
    // Cancel any previous requests
    abortControllerRef.current?.abort();
    
    // Create new controller for this open session
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    const seq = ++openSeqRef.current;
    
    setIsNavigating(false);
    
    // Pass signal to refresh functions
    // (These would need to accept signal parameter)
  } else {
    // Dialog closed - abort all in-flight requests
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
  }
}, [open]);
```

---

## Technical Details

### Why This Fixes the Issue

1. **Request versioning**: Each dialog open increments a sequence counter. Stale requests check the counter before updating state and bail out if it doesn't match.

2. **Abort on close**: When the dialog closes, all in-flight requests are cancelled via AbortController, preventing them from interfering with the next open.

3. **Abort on reopen**: When the dialog opens again, the previous controller is aborted before creating a new one, ensuring only fresh requests can update state.

4. **Loading state protection**: The `finally` blocks check if the request was aborted before clearing loading states, preventing race conditions where loading gets stuck.

### Files to Modify

1. `src/components/editor/MasterLibraryDialog.tsx` - Add sequence tracking and abort controller management
2. `src/hooks/useMasterEntities.ts` - Add abort signal support
3. `src/hooks/useMasterLibraryDocuments.ts` - Add abort signal support

### Risk Assessment

**Low-Medium Risk**: 
- Changes are additive (adding abort support)
- No changes to existing data flow logic
- Supabase client natively supports AbortController via `.abortSignal()`
- Pattern is well-established in the codebase (already used in `useEntityDocuments`)

