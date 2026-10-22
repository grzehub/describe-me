---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

The viewer's header shows the project's name after the sygnet, and the tab's title reads `<project> · describe-me`, so two viewers tell apart. The reporter writes the name to the manifest's new `project` field: the `name` of the nearest package.json at or above the Vitest root, else the root directory's name. A manifest without it, from an earlier version, keeps the `describe(me)` wordmark.
