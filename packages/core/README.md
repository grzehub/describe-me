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

## Usage

`step()` names a phase of a test. The DOM is captured after the body resolves,
and the label becomes the frame's caption in the viewer.

```ts
import { step } from '@describe-me/core'

await step('open the menu', () => screen.getByRole('button', { name: 'Menu' }).click())
```

The manifest types live in `@describe-me/core/types`, for tools that want to
read `.describe-me/manifest.json` themselves.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
