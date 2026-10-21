---
'@describe-me/vitest': minor
'describe-me': minor
---

`describe-me dev` serves the live preview through its own port, under `/__describe-me/`, so the viewer and Live share one address, and one forwarded port, in a container or a web IDE such as Codespaces or StackBlitz, reaches both. The live server still runs on a free port on localhost, now with `/__describe-me/` as its Vite `base`, so its modules and HMR socket sit under that path, and the CLI proxies every request and websocket under the path to it. `__live.json` says `ready` with the base `__describe-me/`, relative to the viewer, the way a static site says `__live/`. `createLiveServer()` in `@describe-me/vitest/live` returns `origin`, the server's `http://localhost:<port>`, next to `base`; a live server of an earlier version has none, and the viewer then opens its absolute base as before.
