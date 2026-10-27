/// <reference types="vite/client" />
// MSW's setupWorker answers the same requests in the live preview. Its worker
// script sits under the preview's base, `/__describe-me/` on the dev server
// and the build's own directory on a static site, where msw/vite puts it.
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

export const server = setupWorker(...handlers)

beforeAll(async () => {
  await server.start({
    serviceWorker: { url: `${import.meta.env.BASE_URL}mockServiceWorker.js` },
    quiet: true,
  })
})
