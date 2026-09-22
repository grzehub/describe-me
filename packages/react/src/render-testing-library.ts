import { cleanup, render as baseRender } from '@testing-library/react'
import { isValidElement, type ReactElement, type ReactNode } from 'react'
import { recorder } from '@describe-me/core'
import { describeElement } from './describe-element.js'
import { labelFor } from './label-for.js'

type RenderOptions = Parameters<typeof baseRender>[1]
type RenderResult = ReturnType<typeof baseRender>

/**
 * Drop-in for `render` from @testing-library/react (jsdom and other DOM
 * environments). Records a frame after mount and after every `rerender`.
 *
 * Synchronous like the original, so `const { asFragment } = render(...)`
 * keeps working. Testing Library wraps mounting in `act()`, which means the DOM
 * is committed when it returns, so frames are captured without settling: the
 * snapshot is taken right here, before the test's next line can change the DOM.
 *
 * Unmounting is handed to the recorder's teardown rather than to Testing
 * Library's own auto-cleanup, which would run before the closing frame is
 * taken. The plugin switches auto-cleanup off with `RTL_SKIP_AUTO_CLEANUP`.
 */
export function render(ui: ReactElement, options?: RenderOptions): RenderResult {
  recorder.onTeardown(cleanup)

  const result = baseRender(ui, options)

  if (isValidElement(ui)) {
    const info = describeElement(ui)
    recorder.setComponent(info)
    void recorder.capture('render', labelFor(info), { props: info.props }, { settle: false })
  }

  const originalRerender = result.rerender

  result.rerender = (next: ReactNode) => {
    originalRerender(next)

    if (isValidElement(next)) {
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
