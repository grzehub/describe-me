---
'@describe-me/core': patch
'@describe-me/vitest': patch
---

Recording no longer adds React act warnings in jsdom.

- **The recorder waits with React's act flag off** (`@describe-me/vitest`). After each interaction or step, and before a deferred render frame or the closing frame, the recorder waits one macrotask for the page to settle. `setup-dom` turns `IS_REACT_ACT_ENVIRONMENT` off for that wait and restores it afterwards, as Testing Library's async utilities do. An update that landed in the wait used to log an act warning that a run without describe-me never showed. Browser mode is unchanged.
- **`RecorderOptions.aroundWait`** (`@describe-me/core`). An optional function that runs each wait of the recorder, passed to `recorder.configure()`. A later `configure()` without it keeps the current one. Its type is exported as `AroundWait`.
- **Recorder protocol 2.** A copy of `@describe-me/core` from 0.5.1 or earlier next to these packages fails with "all describe-me packages must be on the same version" instead of silently losing the fix.
