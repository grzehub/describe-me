---
'@describe-me/vitest': minor
'describe-me': minor
---

Live on the static site. `describe-me build --live` builds the live preview into the site as `__live/` and writes `__live.json`, so the viewer of a static site shows the Live toggle and mounts a test the way `describe-me dev` does. Without `--live` the site has no Live, as before. With it, the site holds the compiled code of the components, the test files and the setup files, with their test data.

- `buildLive({ root, configFile?, outDir, testFiles })` in `@describe-me/vitest/live` builds the live page with the project's own Vite and config, in mode `test`, as a development build. It bundles `live.html`, the setup files and a lazy import of each test file, with a relative base, unminified so that names taken from functions stay as Vitest sees them. It resolves to `{ protocol }`, and rejects with the code `DESCRIBE_ME_LIVE_OFF` when the config sets `live: false`.
- An import that does not load in the browser, such as `node:fs`, does not stop the build. The build warns, and the page reports `import-failed` for a test file that imports it, or `setup-failed` for a setup file.
- `describe-me build` takes `--live` and `--root`. A live build that fails stops the command with exit code 1 and leaves no `__live/`.
- The viewer reads a relative `base` from `__live.json` and frames the live page on its own origin.
