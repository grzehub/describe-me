import { frameSides } from './frame-sides.js'
import { rerender } from './rerender.js'
import { state, writeHash } from './state.js'

/**
 * Show the Before or the After side of the frame on screen. Does nothing
 * unless the frame has both, so an added or a removed frame and Live stay as
 * they are. Leaves Live, as ← → do, so a preview that becomes ready does not
 * take the stage.
 */
export function showSide(side: 'before' | 'after'): void {
  const sides = frameSides()

  if (!sides?.before || !sides.after) {
    return
  }

  state.before = side === 'before'
  state.live = false
  writeHash('replace')
  rerender('frame')
}
