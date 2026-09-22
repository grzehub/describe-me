# describe-me

## 0.2.0

### Minor Changes

- [#14](https://github.com/grzehub/describe-me/pull/14) [`4b92a59`](https://github.com/grzehub/describe-me/commit/4b92a5918968dd8875f848c66d96dc337e0e547c) Thanks [@grzehub](https://github.com/grzehub)! - Reworked the viewer's look: the system UI sans as the default face and the mono
  face only for what is quoted from the codebase, a softer light and dark palette
  built on shared tokens, a quieter sidebar whose selection is a tinted row with an
  accent edge instead of a solid block, a module header that merges the test file
  and the single describe it holds into one row, a segmented viewport control, and
  a replay stage that sizes itself to what the snapshot actually paints instead of
  filling the panel.

### Patch Changes

- Updated dependencies []:
  - @describe-me/core@0.2.0

## 0.1.1

### Patch Changes

- Updated dependencies [[`b5fbd45`](https://github.com/grzehub/describe-me/commit/b5fbd45aae1076b0db68adb57c3f256596a4a1e6)]:
  - @describe-me/core@0.1.1

## 0.1.0

### Minor Changes

- [#10](https://github.com/grzehub/describe-me/pull/10) [`92fb3ba`](https://github.com/grzehub/describe-me/commit/92fb3ba1a3fe58bd6cfa31a3ba8c879b1fa861be) Thanks [@grzehub](https://github.com/grzehub)! - First public release. Living component documentation generated from Vitest
  browser-mode tests: a recorder that captures a DOM frame after every render,
  interaction and `step()`, a Vitest plugin that wires it up in one line, a
  reporter that reads component props from TypeScript, and the `describe-me` CLI
  with a viewer (`dev`) and a static site build (`build`). React only for now.

### Patch Changes

- Updated dependencies [[`92fb3ba`](https://github.com/grzehub/describe-me/commit/92fb3ba1a3fe58bd6cfa31a3ba8c879b1fa861be)]:
  - @describe-me/core@0.1.0
