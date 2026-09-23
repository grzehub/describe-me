import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-react'
import { StyledText } from './StyledText'

function injectStyleTag(css: string) {
  const tag = document.createElement('style')
  tag.textContent = css
  document.head.append(tag)
}

function injectViaCssom(rule: string) {
  const tag = document.createElement('style')
  document.head.append(tag)
  tag.sheet?.insertRule(rule)
}

function injectAdopted(css: string) {
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css)
  document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]
}

describe('StyledText', () => {
  it('is styled by a style tag, CSSOM and adopted stylesheets', async () => {
    // Vitest's browser-mode page resets `body { margin: 0 }`, and that reset is
    // captured with everything else. This component brings no page styles of
    // its own, so restore the browser default to match the jsdom example.
    injectStyleTag('body { margin: 8px; }')
    injectStyleTag('.styled-tag { color: rgb(0, 128, 0); }')
    injectViaCssom('.styled-cssom { color: rgb(0, 0, 255); }')
    injectAdopted('.styled-adopted { color: rgb(255, 165, 0); }')

    const screen = await render(<StyledText />)
    await expect.element(screen.getByText('adoptedStyleSheets', { exact: false })).toBeVisible()
  })
})
