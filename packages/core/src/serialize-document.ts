import { cleanupSnapshot, createMirror, snapshot } from 'rrweb-snapshot'
import type { Mirror } from 'rrweb-snapshot'
import { materializeAdoptedStyles } from './materialize-adopted-styles.js'
import { PSEUDO_STATES_ATTRIBUTE } from './types.js'
import type { PseudoState } from './types.js'

/** rrweb's `NodeType.Element`. */
const ELEMENT_NODE = 2

type States = ReadonlyMap<Element, readonly PseudoState[]>

/**
 * `getMeta()` returns the very node object that sits in the serialized tree.
 * rrweb also keeps the nodes it ignores in the mirror, outside the tree, so
 * writing to those changes nothing.
 */
function writeStates(mirror: Mirror, states: States): void {
  for (const [element, names] of states) {
    const meta = mirror.getMeta(element)

    if (meta?.type === ELEMENT_NODE && 'attributes' in meta) {
      meta.attributes[PSEUDO_STATES_ATTRIBUTE] = names.join(' ')
    }
  }
}

/**
 * Serialize the current document with rrweb, as JSON text, or `null` when
 * rrweb has nothing to serialize. Each element of `states` gets its states as
 * `PSEUDO_STATES_ATTRIBUTE` in the serialized tree only, so the page under
 * test, and any MutationObserver on it, sees no change.
 *
 * rrweb numbers nodes from a module-level counter that only
 * `cleanupSnapshot()` resets. Resetting it before every capture makes ids
 * start at 1, drops `rootId` (added whenever the document's id is not 1), and
 * makes identical DOM serialize to identical text, so the snapshot store
 * writes it once. Gotcha: any other rrweb user in the same realm shares that
 * counter. None is expected inside tests.
 */
export function serializeDocument(states?: States): string | null {
  return materializeAdoptedStyles(() => {
    cleanupSnapshot()
    const mirror = createMirror()
    const node = snapshot(document, { mirror, inlineStylesheet: true })

    if (node === null) {
      return null
    }

    if (states !== undefined) {
      writeStates(mirror, states)
    }

    return JSON.stringify(node)
  })
}
