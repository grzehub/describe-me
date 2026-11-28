---
'describe-me': minor
---

With `describe-me dev --base` and `build --base`, a frame that changed against the base gets a Before / After switch on the stage toolbar, also on `B` and as `before=1` in the link. Before replays the base run's snapshot from `__base/`, with its stylesheets, assets and preview head, in place of the current frame at the same size and zoom, so a small change shows as the frame flips. After is the default, and another frame, another test and Live show After. An added frame has only After. A removed frame is an entry of its own in the frame timeline, marked `gone`, with only Before and `removed=<index>` in the link. Under the Changed filter, a test whose first change is a removed frame opens on it. Live has no switch. The viewer fetches `__base/manifest.json` only when it has a report, so a viewer without `--base` works and loads as before.
