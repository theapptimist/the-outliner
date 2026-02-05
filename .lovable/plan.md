
# Fix: Jump to Document Navigates to Empty Document

## Root Cause Identified

The `useEffect` that loads the initial document (lines 270-301 in `Editor.tsx`) has `userSettings.startWithOutline` as a dependency:

```javascript
useEffect(() => {
  async function loadInitialDocument() {
    // ... loads from localStorage or creates empty doc
  }
  if (user) {
    loadInitialDocument();
  }
}, [user, userSettings.startWithOutline]);  // <-- Problem!
```

When `userSettings` loads or changes (which happens asynchronously), this effect **re-runs** and either:
1. Loads an old document from localStorage (overwriting the navigated document)
2. Creates a new empty "Untitled" document

This creates a race condition:
1. User clicks "Jump to document" → `handleNavigateToDocument(targetId)` starts
2. Meanwhile, `userSettings` finishes loading from the cloud
3. The initial load effect re-fires and calls `setDocument(localDoc)` 
4. This overwrites the pending navigation result with an empty document

## Solution

Add a guard to prevent the initial document loading effect from running when a navigation is in progress, OR remove the `userSettings.startWithOutline` dependency from the effect since it should only affect NEW document creation, not document loading.

### Option A: Remove the problematic dependency (Recommended)

The `startWithOutline` setting only matters when creating a *new* document. The initial load effect should only run once per user login, not re-run when settings change.

**Change:** Extract `startWithOutline` value at effect execution time rather than as a dependency.

```javascript
// Before
}, [user, userSettings.startWithOutline]);

// After  
}, [user]); // Only re-run on user change
```

And capture the setting value inside the effect at the time it executes using a ref or checking `userSettings` directly when creating the local document.

### Option B: Add navigation-in-progress guard

Track whether navigation is in progress and skip initial load re-runs.

```javascript
const [isNavigating, setIsNavigating] = useState(false);

useEffect(() => {
  if (isNavigating) return; // Skip if navigation is happening
  // ... existing initial load logic
}, [user, userSettings.startWithOutline, isNavigating]);
```

## Files to Change

| File | Change |
|------|--------|
| `src/pages/Editor.tsx` | Remove `userSettings.startWithOutline` from the initial load effect dependencies, or add a navigation guard |

## Implementation Details

**Option A (preferred)** - The effect should only determine WHICH document to load (from localStorage or create new), not re-run when unrelated settings change:

```javascript
// Load document on mount (only runs once per user session)
useEffect(() => {
  async function loadInitialDocument() {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const currentId = localStorage.getItem(CURRENT_DOC_KEY);
      if (currentId) {
        const doc = await loadCloudDocument(currentId);
        if (doc) {
          setDocument(doc);
          setIsLoading(false);
          return;
        }
      }
      
      // Access settings at execution time, not as dependency
      const withOutline = userSettings?.startWithOutline ?? false;
      const localDoc = createLocalDocument('Untitled', withOutline);
      setDocument(localDoc);
    } catch (e) {
      console.error('Failed to load document:', e);
      const withOutline = userSettings?.startWithOutline ?? false;
      const localDoc = createLocalDocument('Untitled', withOutline);
      setDocument(localDoc);
    }
    setIsLoading(false);
  }
  
  loadInitialDocument();
}, [user]); // Only user dependency - runs once per login
```

## Why This Fixes It

- The initial document load effect will only run once when the user logs in
- When `userSettings` changes/loads, it won't re-run and create a race condition
- Navigation via `handleNavigateToDocument` will complete without being overwritten
- New document creation still respects `startWithOutline` by reading the current value

## Test Plan

1. Open Master Library
2. Expand an entity with documents
3. Click on a document thumbnail → "Jump to document"
4. Verify:
   - The correct document loads (with its title and content)
   - No empty "Untitled" document appears
   - Console shows successful load logs
5. Repeat 5+ times to confirm reliability
