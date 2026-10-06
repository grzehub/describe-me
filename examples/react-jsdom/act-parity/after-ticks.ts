/**
 * Run `callback` after `count` chained zero-delay timers, the way a debounce, a
 * fetch and a cache hand a result along. After a user-event call, its trailing
 * wait and Testing Library's drain take two ticks, so a third lands after the
 * call has returned, in whatever the test awaits next.
 */
export function afterTicks(count: number, callback: () => void): void {
  setTimeout(() => {
    if (count > 1) {
      afterTicks(count - 1, callback)

      return
    }

    callback()
  }, 0)
}
