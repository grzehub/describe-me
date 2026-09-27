import { cleanup as unmountAll, render as baseRender } from '@testing-library/react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { recorder } from '@describe-me/core'
import { describeElement } from './describe-element.js'
import { labelFor } from './label-for.js'

type RenderOptions = Parameters<typeof baseRender>[1]
type RenderResult = ReturnType<typeof baseRender>

// On import rather than in `render()`, so a file that only calls `renderHook`
// is unmounted after each test too.
recorder.onTeardown(unmountAll)

/**
 * Drop-in for `render` from @testing-library/react (jsdom and other DOM
 * environments). Records a frame after mount and after every `rerender`
 * while a test is being recorded.
 *
 * Synchronous like the original, so `const { asFragment } = render(...)`
 * keeps working. Testing Library wraps mounting in `act()`, which means the DOM
 * is committed when it returns, so frames are captured without settling: the
 * snapshot is taken right here, before the test's next line can change the DOM.
 *
 * Importing this module hands unmounting to the recorder's teardown rather
 * than to Testing Library's own auto-cleanup, which would run before the
 * closing frame is taken. The plugin switches auto-cleanup off with
 * `RTL_SKIP_AUTO_CLEANUP`.
 */
export function render(ui: ReactElement, options?: RenderOptions): RenderResult {
  const result = baseRender(ui, options)

  if (recorder.isActive && isValidElement(ui)) {
    const info = describeElement(ui)
    recorder.setComponent(info)
    void recorder.capture('render', labelFor(info), { props: info.props }, { settle: false })
  }

  const originalRerender = result.rerender

  result.rerender = (next: ReactNode) => {
    originalRerender(next)

    if (recorder.isActive && isValidElement(next)) {
      const info = describeElement(next)
      void recorder.capture(
        'render',
        `rerender ${labelFor(info)}`,
        { props: info.props },
        { settle: false },
      )
    }
  }

  return result
}
