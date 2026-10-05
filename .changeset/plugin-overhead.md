---
'@describe-me/vitest': patch
---

A run that records no component no longer loads TypeScript. The reporter reads props with TypeScript only when a recorded test rendered a component, so runs with `exclude: '**'` or `include: []` skip it. In the jsdom example this takes 324 ms off a run with `exclude: '**'`. A JavaScript-only project sees the "typescript is not installed" warning only when there are props to document. No exports change.
