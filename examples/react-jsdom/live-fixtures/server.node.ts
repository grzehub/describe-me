// MSW's setupServer answers the tests' requests in Node. The live preview
// cannot load msw/node, so `live.setupFiles` lists server.browser.ts in its
// place, and an alias gives the tests that import this file that one.
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)

beforeAll(() => {
  server.listen()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})
