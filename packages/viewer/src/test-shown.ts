import { foundationsShown } from './foundations-shown.js'
import { state } from './state.js'

/** Whether the center shows the selected test, so neither an overview nor Foundations is open. */
export function testShown(): boolean {
  return !state.suiteKey && !foundationsShown()
}
