// Everything @testing-library/react offers, with `render`, `fireEvent` and
// `cleanup` swapped for recording ones.
export * from '@testing-library/react'
export { step } from '@describe-me/core'
export { cleanup } from './cleanup.js'
export { fireEvent } from './fire-event.js'
export { render } from './render-testing-library.js'
