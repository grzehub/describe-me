---
'describe-me': minor
'@describe-me/react': minor
'@describe-me/vitest': minor
---

`describe-me` no longer ships its own Vite. `vite` moved from `dependencies` to `peerDependencies` (`^6.4.0 || ^7.0.0 || ^8.0.0`), so the viewer and CLI run on your project's Vite and a project on Vite 6 or 7 no longer installs a second, nested Vite 8. pnpm and npm install the peer automatically; with yarn, add `vite` to your `devDependencies` (Vitest requires it anyway). `describe-me` now declares `engines.node: ^20.16.0 || >=22.4.0`; the effective floor is whatever your Vite version requires.

Peer dependency ranges now have upper bounds instead of open-ended `>=` ranges:

- `@describe-me/react`: `react` `^18.0.0 || ^19.0.0`, `@testing-library/react` `^16.0.0` (optional), `vitest-browser-react` `^2.0.0` (optional).
- `@describe-me/vitest`: `vitest` `^4.0.0 || ^5.0.0`, `typescript` `^5.0.0 || ^6.0.0` (optional; TypeScript 7 has no JS compiler API), `@testing-library/user-event` `^14.0.0` (optional).
