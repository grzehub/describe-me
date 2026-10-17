---
'describe-me': minor
---

A theme switch at the right end of the viewer's header: `system` (default), `light` or `dark`. The choice is the same for every project. The browser keeps it in `localStorage` under `describe-me:theme`, and it is not part of the link. Without storage it works until a reload.

The stored theme applies before the first paint, in `describe-me dev` and in a static site, so the viewer never shows the other scheme first. The theme changes only the viewer's own colors. A frame keeps the canvas and the color scheme that the background switch picks.
