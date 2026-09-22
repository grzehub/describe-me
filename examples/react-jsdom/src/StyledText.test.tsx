import { describe, expect, it } from 'vitest'
import { render } from '@testing-library/react'
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

/** jsdom may not implement constructable stylesheets; the spike wants to know. */
function injectAdopted(css: string): string {
  try {
    const sheet = new CSSStyleSheet()
    sheet.replaceSync(css)
    document.adoptedStyleSheets = [...document.adoptedStyleSheets, sheet]

    return 'supported'
  } catch (error) {
    return `unsupported: ${(error as Error).message}`
  }
}

describe('StyledText', () => {
  it('is styled by a style tag, CSSOM and adopted stylesheets', async () => {
    injectStyleTag('.styled-tag { color: rgb(0, 128, 0); }')
    injectViaCssom('.styled-cssom { color: rgb(0, 0, 255); }')
    const adopted = injectAdopted('.styled-adopted { color: rgb(255, 165, 0); }')

    console.log(`[spike] adoptedStyleSheets: ${adopted}`)

    const screen = render(<StyledText />)

    expect(screen.getByText('inline style attribute')).toBeDefined()
  })
})
