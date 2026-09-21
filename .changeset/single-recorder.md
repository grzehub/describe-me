---
'@describe-me/core': patch
---

Fix render frames going missing when the adapter and the setup file receive
two copies of `@describe-me/core` (Vite pre-bundles the adapter with its own
copy while a linked workspace serves the setup file from source). The recorder
is now a single instance per page, anchored on `globalThis`.
