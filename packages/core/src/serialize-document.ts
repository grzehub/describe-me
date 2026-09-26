import { cleanupSnapshot, createMirror, snapshot } from 'rrweb-snapshot'
import { materializeAdoptedStyles } from './materialize-adopted-styles.js'

/**
 * Serialize the current document with rrweb, as JSON text, or `null` when
 * rrweb has nothing to serialize.
 *
 * rrweb numbers nodes from a module-level counter that only
 * `cleanupSnapshot()` resets. Resetting it before every capture makes ids
 * start at 1, drops `rootId` (added whenever the document's id is not 1), and
 * makes identical DOM serialize to identical text, so the snapshot store
 * writes it once. Gotcha: any other rrweb user in the same realm shares that
 * counter; none is expected inside tests.
 */
export function serializeDocument(): string | null {
  return materializeAdoptedStyles(() => {
    cleanupSnapshot()
    const node = snapshot(document, { mirror: createMirror(), inlineStylesheet: true })

    return node ? JSON.stringify(node) : null
  })
}
