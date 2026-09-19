import { recorder } from './recorder.js'

/** Name a phase of the test. The DOM is captured after `fn` resolves. */
export async function step<T>(label: string, fn: () => T | Promise<T>): Promise<T> {
  const result = await fn()
  await recorder.capture('step', label)
  return result
}
