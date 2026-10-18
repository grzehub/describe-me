---
'@describe-me/core': minor
'@describe-me/vitest': minor
'describe-me': minor
---

Foundations marks the Material UI defaults of a theme module. The reporter imports `createTheme` from the project's own `@mui/material/styles`, builds a theme with the same light and dark schemes and `cssVariables` and nothing else, and marks each token with the same value as `default`. A typography variant counts only when every part matches. When only the light or only the dark value is a default, the token gets `modeOrigins`, a new optional field of `FoundationToken`, and the view shows the `default` badge for the mode on screen. When `@mui/material/styles` does not import or has no `createTheme`, the tokens stay `project` and `foundationsErrors` says so in one sentence. A project that uses Material UI without `foundations.theme` and without `cssVariables` keeps `foundations.json` and the manifest's `foundations` summary at 0 tokens. Its Foundations entry shows, and the page holds only the setup hint, which also says that only a theme module marks the defaults.
