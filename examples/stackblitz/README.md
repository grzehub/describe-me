# describe-me starter

describe-me in jsdom, small enough to read in a minute: three components,
their tests, and the viewer with Live and Foundations. Nothing to clone.

[![Open in StackBlitz](https://developer.stackblitz.com/img/open_in_stackblitz.svg)](https://stackblitz.com/github/grzehub/describe-me/tree/main/examples/stackblitz)

StackBlitz installs the packages, runs the tests once and starts the viewer.
Edit a test or a component, then run `npm run test:watch` in a second
terminal: the viewer follows every rerun.

## On your machine

```sh
npm install
npm run dev        # the tests once, then the viewer at http://localhost:4173
npm run test:watch # in a second terminal, the viewer follows the reruns
npm run build      # a static site in describe-me-dist/
```

## What is inside

- `src/tokens.css` holds the design tokens as custom properties. Foundations
  in the viewer reads them: colors, spacing, radius and type.
- `src/Button.tsx` and its test: every `it` is a story, and the props read
  from TypeScript show in the component overview.
- `src/Disclosure.tsx` and its test: a frame after the render and after
  every click, with a `step()` that names one.
- `src/SignupForm.tsx` and its test: typing, a submit and a rejected empty
  email. Live mounts it as the test arranged it and shows the `vi.fn()`
  calls as they happen.
- `vitest.config.ts` adds the plugin, nothing else. It sees jsdom and sets
  itself up.

This directory stands on its own, outside the pnpm workspace of the
repository, with the published packages from npm. The docs are at
https://grzehub.github.io/describe-me/.
