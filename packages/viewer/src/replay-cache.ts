import { createCache } from 'rrweb-snapshot'

/**
 * rrweb caches the CSS it adapts for replay per CSS text, so the stage and the
 * gallery share one cache: a sheet used by many frames and thumbnails is
 * processed once.
 */
export const replayCache = createCache()
