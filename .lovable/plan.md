
Goal
- Fix two UI issues:
  1) “Review Document Plan” fullscreen icon sits a few pixels too low, and the dialog sometimes appears too low / runs off-screen.
  2) The AI “Stop” button still renders too large.

What I found (from current code)
- The Stop/Send buttons in `SectionAIChat.tsx` are using the shared `Button` component without specifying `size`. The default `Button` size is `h-10 px-4 py-2` (large). Even though you’re overriding some dimensions in `className`, the most reliable way to get a true icon-only button is to use `size="icon"` and then override the height/width down to the desired compact size.
- The “Review Document Plan” fullscreen button is absolutely positioned with `top-4`. The built-in dialog Close button is also `top-4`, but it visually sits slightly higher because it has different padding/box sizing than our custom fullscreen button.
- The dialog “runs off the bottom” likely means we need to be more defensive about vertical centering and height clamping on open. Even if Radix centers by default, we can enforce centering with `!top-1/2 !-translate-y-1/2` and clamp the initial `size.height` when opening the dialog.

Planned changes

A) Make Stop/Send truly small icon buttons (Section AI window)
File: `src/components/editor/SectionAIChat.tsx`
- Change both Stop and Send buttons to:
  - Use `size="icon"` so the component is in “icon-button” mode.
  - Force compact dimensions with important utilities: `className="!h-6 !w-6 shrink-0"` (and keep `p-0` only if needed).
  - Ensure SVG icon sizing is consistent via either:
    - `className="[&_svg]:!size-3"` on the Button, or explicit `className="!h-3 !w-3"` on the icons.
- Expected result: the Stop button becomes a compact 24x24 icon button (matching the small control style you want).

B) Raise the fullscreen icon by ~3px and align it with the Close button
File: `src/components/editor/DocumentPlanDialog.tsx`
- Adjust the fullscreen button position from `top-4` to an exact pixel offset:
  - Replace `top-4` with `top-[13px]` (3px higher than 16px).
- Make its visual box match the close button more closely:
  - Remove `p-1` and instead set an explicit clickable box like `h-8 w-8 flex items-center justify-center` (or mirror the close button’s class list for consistent alignment/hover behavior).
- Keep `right-12` (or tweak to `right-14` if you want more spacing from the close button), but we’ll prioritize vertical alignment first since that’s the main complaint.

C) Prevent the dialog from dropping too low / running off-screen
File: `src/components/editor/DocumentPlanDialog.tsx`
- Enforce centering at the DialogContent level (without changing the shared Dialog component):
  - Add: `!top-1/2 !-translate-y-1/2` (and if needed `!left-1/2 !-translate-x-1/2`) to `DialogContent`’s `className`.
  - This makes sure any other styles/animations can’t push it down.
- Clamp the dialog size when it opens:
  - In the `useEffect` that runs on `open`, also ensure:
    - `width <= window.innerWidth - 48`
    - `height <= window.innerHeight - 48`
  - This prevents previously-resized values (or default values on small screens) from causing off-screen overflow.

Validation checklist (what you’ll see in preview)
- Open a Section AI panel, trigger generation, and confirm:
  - The Stop button is a small square icon button (about the same footprint as the Send button).
- Open “Review Document Plan”:
  - The fullscreen icon is aligned with the X close button and sits ~3px higher than before.
  - The dialog remains vertically centered and no longer runs off the bottom on typical viewport sizes.

Notes / trade-offs
- I’m keeping changes local to these two components to avoid affecting other dialogs or buttons globally.
- If you want an app-wide “extra-small icon button” size later, we can add a new `size` variant (e.g., `xsIcon`) to `src/components/ui/button.tsx`, but the above will fix this immediately with minimal blast radius.
