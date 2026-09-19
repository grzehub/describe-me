import { render as baseRender } from 'vitest-browser-react'
import { isValidElement, type ReactElement } from 'react'
import { recorder } from '@describe-me/core'
import { describeElement } from './describe-element.js'
import { labelFor } from './label-for.js'

type BaseRender = typeof baseRender
type RenderOptions = Parameters<BaseRender>[1]
type Screen = Awaited<ReturnType<BaseRender>>

/**
 * Drop-in for `render` from vitest-browser-react. Records a frame after mount
 * and after every `rerender`.
 */
export async function render(ui: ReactElement, options?: RenderOptions): Promise<Screen> {
  const screen = await baseRender(ui, options)
  if (isValidElement(ui)) {
    const info = describeElement(ui)
    recorder.setComponent(info)
    await recorder.capture('render', labelFor(info), { props: info.props })
  }
  const originalRerender = screen.rerender.bind(screen)
  screen.rerender = (async (next: ReactElement) => {
    const result = await originalRerender(next)
    if (isValidElement(next)) {
      const info = describeElement(next)
      await recorder.capture('render', `rerender ${labelFor(info)}`, { props: info.props })
    }
    return result
  }) as Screen['rerender']
  return screen
}
