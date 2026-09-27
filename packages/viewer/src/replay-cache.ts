import { createCache } from 'rrweb-snapshot'

/** rrweb caches its CSS adaptation per CSS text, so the stage and the gallery share one cache. */
export const replayCache = createCache()
