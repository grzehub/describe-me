/**
 * Browser-side helpers for tests. Wraps Vitest's userEvent so every
 * interaction produces a frame.
 */
import { userEvent as baseUserEvent } from 'vitest/browser'
import { recorder } from '@describe-me/core'
import { describeArg } from './describe-arg.js'

type UserEvent = typeof baseUserEvent

function wrap(target: UserEvent): UserEvent {
  return new Proxy(target, {
    get(proxied, key, receiver) {
      const value = Reflect.get(proxied, key, receiver)
      if (typeof value !== 'function') {
        return value
      }

      return async (...args: unknown[]) => {
        const result = await (value as (...params: unknown[]) => unknown).apply(proxied, args)
        const shown = args.map(describeArg).filter(Boolean).join(', ')
        await recorder.capture('action', `${String(key)}(${shown})`)
        return result
      }
    },
  })
}

/** Same API as `userEvent` from 'vitest/browser', but every call is a frame. */
export const userEvent: UserEvent = wrap(baseUserEvent)
