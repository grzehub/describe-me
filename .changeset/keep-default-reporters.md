---
'@describe-me/vitest': patch
---

The plugin keeps Vitest's default reporters. When the config named no reporters, the plugin set `['default', <its reporter>]`, which replaced the list Vitest picks on its own. AI agent sessions lost `minimal` (`agent` on Vitest 4.1), which hides what passing tests print, and GitHub Actions lost the `github-actions` annotations. The plugin adds its reporter to that list instead. Reporters named in the config still win, and the plugin adds only its own next to them.

`@describe-me/vitest` depends on `std-env`, which Vitest itself uses to detect agents. No exports change.
