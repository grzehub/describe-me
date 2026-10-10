/** `step()` on the live page: it runs the body and records nothing. */
export async function liveStep<T>(_label: string, body: () => T | Promise<T>): Promise<T> {
  return await body()
}
