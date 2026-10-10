// Stands in for @testing-library/react on the live preview page, with `render`,
// `renderHook` and `cleanup` swapped. Not for import in tests.
export * from '@testing-library/react'
export { liveCleanup as cleanup } from './live-cleanup.js'
export { liveRenderTestingLibrary as render } from './live-render-testing-library.js'
export { liveRenderHookTestingLibrary as renderHook } from './live-render-hook-testing-library.js'
