import { render as baseRender } from 'vitest-browser-react'
import { isValidElement, type ReactElement } from 'react'
import { recorder } from '@describe-me/core'
import { describeRendered } from './describe-rendered.js'
import { labelFor } from './label-for.js'

type BaseRender = typeof baseRender
type RenderOptions = Parameters<BaseRender>[1]
type Screen = Awaited<ReturnType<BaseRender>>

/**
 * Drop-in for `render` from vitest-browser-react. Records a frame after mount
 * and after every `rerender`. `render`, `rerender` and `unmount` first take a
 * render frame the plugin's `renderFrame` option deferred.
 */
export async function render(ui: ReactElement, options?: RenderOptions): Promise<Screen> {
  const generation = recorder.generation

  recorder.beforeInteraction()
  const screen = await baseRender(ui, options)
  // vitest-browser-react keeps the wrapper for `rerender`.
  const hasWrapper = Boolean(options?.wrapper)

  if (isRecording(generation) && isValidElement(ui)) {
    const info = describeRendered(ui, screen.container, hasWrapper)
    recorder.setComponent(info)
    await recorder.capture('render', labelFor(info), { props: info.props }, { generation })
  }

  const originalRerender = screen.rerender.bind(screen)

  screen.rerender = (async (next: ReactElement) => {
    const rerenderGeneration = recorder.generation

    recorder.beforeInteraction()
    const result = await originalRerender(next)

    if (isRecording(rerenderGeneration) && isValidElement(next)) {
      const info = describeRendered(next, screen.container, hasWrapper)
      recorder.setComponent(info)
      await recorder.capture(
        'render',
        `rerender ${labelFor(info)}`,
        { props: info.props },
        { generation: rerenderGeneration },
      )
    }

    return result
  }) as Screen['rerender']

  const originalUnmount = screen.unmount.bind(screen)

  // Without this, a lazy test that ends with `unmount()` documents an empty page.
  screen.unmount = () => {
    recorder.beforeInteraction()

    return originalUnmount()
  }

  return screen
}

/**
 * Whether the test that began at `generation` is still being recorded. A
 * render the test did not await can finish after it ended.
 */
function isRecording(generation: number): boolean {
  return recorder.isActive && recorder.generation === generation
}
