# @describe-me/react

The React adapter for [describe-me](https://github.com/grzehub/describe-me):
drop-in `render` functions that record a frame after mount and after every
`rerender`, and read the component's name and props for the docs. This is the
only React-specific code in the project.

| entry point                          | wraps                    | for                      |
| ------------------------------------ | ------------------------ | ------------------------ |
| `@describe-me/react`                 | `vitest-browser-react`   | Vitest browser mode      |
| `@describe-me/react/testing-library` | `@testing-library/react` | jsdom and other DOM envs |

Both test libraries are optional peers: install the one your tests use.

## Install

```sh
pnpm add -D @describe-me/react
```

## Usage

Each entry point re-exports everything its test library offers, with the
recording functions swapped in, so switching an existing test is one import.
`@describe-me/react` swaps `render`. The Testing Library entry swaps `render`,
`fireEvent` and `cleanup`: every `fireEvent` call records a frame, and
`cleanup` takes the closing frame before it unmounts.

```tsx
import { render, step } from '@describe-me/react'

const screen = await render(<Counter initial={1} />)
await step('increment', () => screen.getByRole('button', { name: 'add' }).click())
```

```tsx
import { render } from '@describe-me/react/testing-library'

// Synchronous, exactly like the original.
const { getByRole } = render(<Counter initial={1} />)
```

With `@describe-me/vitest`'s `describeMe()` plugin you do not even need that:
the plugin redirects `vitest-browser-react` or `@testing-library/react` imports
to the matching entry point, including imports made from your own
`test-utils` wrapper, so tests record frames unchanged.

See the [root README](https://github.com/grzehub/describe-me#readme) for the
full picture.
