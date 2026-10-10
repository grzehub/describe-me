import { createServer } from 'node:net'

/**
 * A port that is free on localhost right now. Older Vite majors keep `port: 0`
 * in their resolved config, which breaks the address HMR falls back to.
 */
export function freeLivePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer()

    probe.once('error', reject)

    probe.listen(0, 'localhost', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0

      probe.close(() => resolvePort(port))
    })
  })
}
