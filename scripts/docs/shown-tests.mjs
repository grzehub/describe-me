/**
 * The tests a viewer shows, each with its `moduleId`: those with a frame
 * besides the closing one. The same rule as packages/viewer/src/without-empty-tests.ts.
 */
export function shownTests(manifest) {
  return manifest.modules.flatMap((mod) =>
    mod.tests
      .filter((test) => test.frames.some((frame) => frame.kind !== 'end'))
      .map((test) => ({ ...test, moduleId: mod.id })),
  )
}
