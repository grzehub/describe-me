// The first setup file of the live fixtures, which run only with LIVE_FIXTURES.
// `globals: true`, so its hooks need no import, as in many jsdom setups.
import { logStep } from './order-log'

vi.mock('./analytics', () => ({ track: () => undefined }))

beforeAll(() => {
  logStep('setup beforeAll')
})

beforeEach(() => {
  logStep('setup beforeEach')
})

afterEach(() => {
  logStep('setup afterEach')
})
