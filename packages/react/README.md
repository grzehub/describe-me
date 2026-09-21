# @describe-me/react

The React adapter for [describe-me](https://github.com/grzehub/describe-me): a
drop-in `render` for `vitest-browser-react` that records a frame after mount and
after every `rerender`, and reads the component's name and props for the docs.
This is the only React-specific code in the project.

## Install

```sh
pnpm add -D @describe-me/react
```

## Usage

The package re-exports everything `vitest-browser-react` offers, with `render`
swapped for the recording one, so switching an existing test is one import.

```tsx
import { render, step } from '@describe-me/react'

const screen = await render(<Counter initial={1} />)
await step('increment', () => screen.getByRole('button', { name: 'add' }).click())
```

With `@describe-me/vitest`'s `describeMe()` plugin you do not even need that:
the plugin redirects `vitest-browser-react` imports to this adapter, so tests
record frames unchanged.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
