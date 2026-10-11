// Like MSW's setupWorker: the same answers as server.node.ts, without Node.
import greeting from './greeting.json'

const realFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)

    if (url.endsWith('/api/greeting')) {
      return new Response(JSON.stringify(greeting), {
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return realFetch(input, init)
  }
})

afterAll(() => {
  globalThis.fetch = realFetch
})
