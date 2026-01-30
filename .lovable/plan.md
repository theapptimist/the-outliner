

# Fix: AI Panel Height Too Small

## The Problem

The Section AI Chat panel has restrictive height constraints that make it difficult to read queued prompts without scrolling:

- **Container max height**: `max-h-[300px]` caps the entire panel
- **Input textarea**: Only `h-8` (32px) - single line that truncates long prompts
- When a 2-3 sentence prompt is queued, users must scroll within a tiny textarea to read it

## The Solution

Increase the default heights to give users a better view of their prompts:

### Changes to `SectionAIChat.tsx`

1. **Increase container max-height** from `300px` to `400px`
   - Gives 33% more vertical space for the entire panel
   - Still fits within typical viewport without being overwhelming

2. **Increase textarea min-height** from `32px` to `60px`
   - Shows ~3 lines of text instead of 1
   - Users can see the full queued prompt without scrolling
   - Change `rows={1}` to `rows={2}` for better default

3. **Allow textarea to grow** with content
   - Use `max-h-[120px]` to allow expansion up to ~6 lines
   - Keeps the panel from growing unbounded

### Technical Details

**Before:**
```tsx
// Line 436 - Container
<div className="flex flex-col h-full min-h-[200px] max-h-[300px]">

// Line 584 - Input textarea
<Textarea
  className="... min-h-[32px] h-8 ..."
  rows={1}
/>
```

**After:**
```tsx
// Line 436 - Container with more height
<div className="flex flex-col h-full min-h-[250px] max-h-[400px]">

// Line 584 - Taller textarea
<Textarea
  className="... min-h-[60px] max-h-[120px] ..."
  rows={2}
/>
```

## Files to Modify

- **`src/components/editor/SectionAIChat.tsx`** - Adjust height constraints on container and textarea

## Visual Comparison

**Current:**
```
┌─ AI Panel ─────────────── (300px max)
│ [Expand] [Summarize] [Refine]
│ ─────────────────────────────
│ Message history area
│ (cramped)
│ ─────────────────────────────
│ [Single line input___] [Send]
└──────────────────────────────
```

**After:**
```
┌─ AI Panel ─────────────── (400px max)
│ [Expand] [Summarize] [Refine]
│ ─────────────────────────────
│ Message history area
│ (more spacious)
│
│ ─────────────────────────────
│ [Multi-line input area   ]
│ [with room to read the   ]
│ [full queued prompt______] [Send]
└──────────────────────────────
```

