# @describe-me/core

The framework-agnostic heart of [describe-me](https://github.com/grzehub/describe-me):
the recorder that captures the DOM, the `step()` helper, and the JSON manifest
types the viewer reads. Snapshots are serialized DOM via `rrweb-snapshot`, so
nothing here knows about React.

Most people never install this package directly — `@describe-me/react` and
`@describe-me/vitest` depend on it, and both re-export `step()`.

## Install

```sh
pnpm add -D @describe-me/core
```

All describe-me packages must be on the same version
([One version for all packages](https://grzehub.github.io/describe-me/installation.html#lockstep)).

## Usage

`step()` names a phase of a test. The DOM is captured after the body resolves,
and the label becomes the frame's caption in the viewer.

```ts
import { step } from '@describe-me/core'

await step('open the menu', () => screen.getByRole('button', { name: 'Menu' }).click())
```

`elementLabel()` names a DOM element the way frame labels do, e.g.
`button "Save"`, for adapters that record their own interactions.

Such adapters call `recorder.beforeInteraction()` before they change the page,
so a deferred render frame is taken first. As the capture's `generation`, they
pass `recorder.generation`, read when the interaction began, so a capture that
outlives its test is dropped. `recorder.flush()` waits for the captures in
flight and takes a deferred render frame.

The manifest types live in `@describe-me/core/types`, for tools that want to
read `.describe-me/manifest.json` themselves. Stored snapshots point into
`assets/` and `styles/` through `ASSET_URL_PREFIX` and `STYLE_URL_PREFIX`
([The output directory](https://grzehub.github.io/describe-me/how-it-works.html#storage) in
the docs). `@describe-me/core/css-references` lists the `url()` and
`@import` references in CSS text.

See the [docs](https://grzehub.github.io/describe-me/) for the full picture.
