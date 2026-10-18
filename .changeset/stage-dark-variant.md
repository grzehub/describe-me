---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

`bg=dark` on the stage shows the project's dark variant. Replayed frames, the overview's thumbnails and the test in Live get the `.dark` class or the `[data-*="dark"]` attribute that Foundations detects on their root, so a shadcn/ui component shows its dark colors. `light`, `auto` and `transparent` leave the root as the test recorded it, and a frame recorded in its dark variant stays dark. The variant comes from `foundations.json`, so without tokens `bg=dark` sets only the color scheme, as before. In Live the viewer posts the variant to the live page. The page applies it without a reload once the test has rendered, and takes back only what it applied. `@describe-me/core/types` exports `VIEWER_MESSAGE_SOURCE`, `DarkVariantRoot`, `ViewerRequest` and `ViewerMessage`, and `@describe-me/core/live` exports `listenToViewer()`. The live page accepts the message only from the window that frames it, from the origin its URL names. A live page of an earlier version ignores it, so `LIVE_PROTOCOL` stays 1.
