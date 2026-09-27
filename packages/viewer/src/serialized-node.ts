import type { rebuildIntoSandboxedIframe } from 'rrweb-snapshot'

/** rrweb's serialized document node, which the package does not re-export. */
export type SerializedNode = Parameters<typeof rebuildIntoSandboxedIframe>[0]
