import type { rebuildIntoSandboxedIframe } from 'rrweb-snapshot'

/** rrweb's serialized document node; the package does not re-export the type. */
export type SerializedNode = Parameters<typeof rebuildIntoSandboxedIframe>[0]
