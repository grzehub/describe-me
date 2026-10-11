// Like MSW's setupServer: it answers the tests' requests in Node, with stub
// data it reads from disk. The live preview cannot load it, so
// `live.setupFiles` lists server.browser.ts in its place.
import { readFileSync } from 'node:fs'

const body = readFileSync(`${import.meta.dirname}/greeting.json`, 'utf8')
const realFetch = globalThis.fetch

beforeAll(() => {
  globalThis.fetch = async (input, init) => {
    const url = input instanceof Request ? input.url : String(input)

    if (url.endsWith('/api/greeting')) {
      return new Response(body, { headers: { 'Content-Type': 'application/json' } })
    }

    return realFetch(input, init)
  }
})

afterAll(() => {
  globalThis.fetch = realFetch
})
