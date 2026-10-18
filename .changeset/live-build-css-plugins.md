---
'@describe-me/vitest': patch
---

`buildLive()`, and so `describe-me build --live`, runs the project's Vite plugins as the dev server does. A plugin whose `apply` is `'serve'` runs, one whose `apply` is `'build'` does not, and an `apply` function gets `command: 'serve'`. A plugin split in two by `apply`, such as `@tailwindcss/vite`, used to run neither half in the static live preview, so Tailwind classes had no CSS there. It generates the same CSS as under `describe-me dev` and in the tests. A plugin kept by its `apply` runs without `transformIndexHtml`, which Vite calls without a server in a build, so `@vitejs/plugin-react-swc` still builds. A plugin that needs the dev server itself has none there. See `limit-live-dev-server` on the limitations page.
