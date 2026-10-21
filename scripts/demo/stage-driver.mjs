/**
 * Drives the stage page while Playwright records it: the code pane, the
 * captions and a drawn cursor that glides to an element before the real
 * mouse clicks it. Every wait is real time, because the video is.
 */
export class StageDriver {
  /** @param {import('playwright').Page} page */
  constructor(page) {
    this.page = page
    this.viewer = page.frameLocator('#viewer')
  }

  pause(ms) {
    return this.page.waitForTimeout(ms)
  }

  async setCode(code) {
    await this.page.evaluate((shown) => window.stage.setCode(shown), code)
  }

  async hot(lines) {
    await this.page.evaluate((shown) => window.stage.hot(shown), lines)
  }

  /** Which half the light is on: `'code'`, `'viewer'` or `'both'`. */
  async focus(target) {
    await this.page.evaluate((shown) => window.stage.focus(shown), target)
  }

  async term(lines) {
    await this.page.evaluate((shown) => window.stage.term(shown), lines)
  }

  async caption(html, holdMs = 0) {
    await this.page.evaluate((shown) => window.stage.caption(shown), html)
    await this.pause(holdMs)
  }

  /** Glide the drawn cursor to the middle of `locator`, then put the real mouse there. */
  async moveTo(locator) {
    // The timeline scrolls sideways, so a later frame can sit outside its clip.
    await locator.scrollIntoViewIfNeeded()

    const box = await locator.boundingBox()

    if (box === null) {
      throw new Error('the element to move to has no box')
    }

    const point = [Math.round(box.x + box.width / 2), Math.round(box.y + box.height / 2)]

    await this.page.evaluate(([pointX, pointY]) => window.stage.cursor(pointX, pointY), point)
    await this.pause(560)
    await this.page.mouse.move(point[0], point[1])

    return point
  }

  async click(locator, { settleMs = 400 } = {}) {
    const point = await this.moveTo(locator)
    const press = ([pointX, pointY, down]) => window.stage.press(pointX, pointY, down)

    await this.page.evaluate(press, [...point, true])
    await this.page.mouse.down()
    await this.pause(110)
    await this.page.mouse.up()
    await this.page.evaluate(press, [...point, false])
    await this.pause(settleMs)
  }

  async type(text) {
    await this.page.keyboard.type(text, { delay: 55 })
  }

  async end(holdMs) {
    await this.page.evaluate(() => window.stage.end())
    await this.pause(holdMs)
  }
}
