---
'@describe-me/vitest': patch
---

Record tests in inline `test.projects`. In Vitest 5 those share the root's Vite server and skip the plugin's `config` hook, so they got the render redirect and `RTL_SKIP_AUTO_CLEANUP` but not the setup file: their tests recorded nothing and left every component mounted for the next test. The plugin now adds its setup file to every project it serves in `configureVitest`. Until you upgrade, `test.sharedViteServer: false` in the root config avoids it.

A project without describe-me, with `extends: false` or a config file of its own, keeps Testing Library's auto-cleanup. The plugin sets `RTL_SKIP_AUTO_CLEANUP` in each project it serves, no longer in the root's `test.env`, which Vitest hands to every project. Until you upgrade, `test.env: { RTL_SKIP_AUTO_CLEANUP: '' }` in such a project avoids it.
