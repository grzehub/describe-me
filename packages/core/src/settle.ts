/**
 * Let the framework flush pending updates before we look at the DOM.
 * One macrotask is enough for React to commit batched updates. We deliberately
 * do not wait for requestAnimationFrame: the snapshot is DOM + stylesheets, not
 * layout, and a rAF costs a whole vsync (~16ms) per capture in headless Chromium.
 */
export async function settle(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
