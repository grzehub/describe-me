---
'@describe-me/core': minor
'@describe-me/react': minor
---

Component naming: a test whose root element is a provider, a fragment, `Suspense`, a host element or a component defined in the test file is documented under the first project component it renders.

- **How the name is found** (`@describe-me/react`, both entry points). A root the plugin registered keeps its name. Otherwise `render` and `rerender` look for the first registered component among the root's `children` and other element props (never `fallback`), then in the tree React mounted under the root element, skipping `Suspense` fallbacks. With a `wrapper`, the wrapper's own components are never picked. When nothing is found, or React internals are missing, the root keeps its own name. The lookup is synchronous and bounded, and registered roots skip it.
- **Props come from that component.** `ComponentInfo.props` and the render frame's `meta.props` hold the props the named component received, not the root element's. Props coverage and the render frame label follow, for example `<Badge tone="danger" />` instead of `<ThemeProvider />`. Tests that showed `ThemeProvider`, another provider or `Anonymous` move to the component they render.
- **`rerender` names the component too.** A test that starts with `render(<></>)` and rerenders a component is documented under that component.
- **`recorder.setComponent()` can replace a weak name** (`@describe-me/core`, also exported by `@describe-me/vitest`). It replaces `Anonymous` with a named component, and a component without `file` with one that has a `file`. Otherwise the first call in a test still wins. For a `wrapper` that ignores `children`, call `recorder.setComponent({ name, props })` after `render`.

No exports added or removed.
