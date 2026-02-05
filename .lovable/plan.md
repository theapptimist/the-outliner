
## Add Branded Header to Full-Screen Modals

Add a consistent navigation header bar to the Master Library dialog (and other full-screen modals) featuring the user avatar, "THE OUTLINER" branding, and a back button.

### Design
The header will match the reference image:
- **Left**: User avatar (clickable, opens user menu dropdown)
- **Center**: "THE OUTLINER" text in brand orange color (uppercase)
- **Right**: Back chevron (`<`) that closes the modal

### Implementation

**1. Create a Reusable FullScreenModalHeader Component**

A new component at `src/components/editor/FullScreenModalHeader.tsx`:
- Accepts an `onBack` callback prop for the chevron click
- Uses `UserMenu` for the avatar dropdown
- Displays "THE OUTLINER" in brand color, centered
- ChevronLeft icon on the right side for back navigation
- Light background with subtle bottom border for visual separation

**2. Update MasterLibraryDialog**

In `src/components/editor/MasterLibraryDialog.tsx`:
- Import and add `FullScreenModalHeader` above the existing `DialogHeader`
- Pass `onOpenChange(false)` as the `onBack` handler
- The existing dialog header with tabs remains below the branded header

### Technical Details

```text
┌──────────────────────────────────────────────────────────────┐
│  [Avatar]         THE OUTLINER              [<]              │  ← New branded header
├──────────────────────────────────────────────────────────────┤
│  📚 Master Library                 [My Library][Shared][Public]│  ← Existing dialog header
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    (Dialog content)                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Files to Create/Modify

| File | Change |
|------|--------|
| `src/components/editor/FullScreenModalHeader.tsx` | **Create** - Reusable header component |
| `src/components/editor/MasterLibraryDialog.tsx` | Add header at top of DialogContent |

This reusable component can then be added to any other full-screen modals in the application.
