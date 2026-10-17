---
'describe-me': minor
'@describe-me/vitest': minor
---

Frames stand on the stage without a card. The slot and its iframe have no background, rounded corners, ring or shadow, so a frame shows only what the page's own CSS paints. A live frame loses its accent ring too, and only the Live toggle in the toolbar shows that Live is on.

A background switch next to the viewport presets picks the canvas: `auto` (default), `light`, `dark` or `transparent` (a checkerboard). It also sets the frame's `color-scheme`, so `prefers-color-scheme` inside the frame follows the switch, not the system. `auto` is light unless the recorded page declares a dark scheme on its root or paints its `html` or `body` dark. The overview's thumbnails follow the switch. The link keeps it as `bg=light|dark|transparent`.

- Behaviour change: on a system in dark mode, frames used to show the component's `prefers-color-scheme: dark` rules on a white card. `auto` now shows them light, unless the page declares a dark scheme. Pick `dark` to see them.
- Every replayed frame and the live page start their `<head>` with `:where(:root) { color-scheme: light dark }`, so the frame follows the switch. A page that sets its own `color-scheme` keeps it.
