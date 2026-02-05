
## Fix Document Title Wrapping (~15 Characters Per Line)

### Problem
The current CSS (`break-words` / `whitespace-normal`) only causes text to wrap when it hits the container edge. You want each line to be approximately 15 characters wide, regardless of how much horizontal space is available.

### Solution
Force a **~15-character column width** by limiting the title container to `max-width: 15ch`. This CSS unit sizes the element based on the width of the "0" character in the current font, giving a roughly 15-character line width and forcing natural word-wrap at that boundary.

### Technical Change
In `src/components/editor/MasterLibraryDialog.tsx`, update the title `<span>` in `renderDocItem`:

```tsx
<span
  className="flex-1 leading-tight whitespace-normal break-words"
  style={{ maxWidth: '15ch' }}
>
  {doc.title}
</span>
```

This removes the conditional `truncate` logic entirely and applies:
- `whitespace-normal` – allows wrapping
- `break-words` – breaks long words if needed
- `maxWidth: 15ch` – forces ~15-character line width

### Expected Behavior
| Title Length | Current | After Fix |
|--------------|---------|-----------|
| ≤15 chars | One line | One line |
| >15 chars | One line (not wrapping) | Multi-line, ~15 chars each |
