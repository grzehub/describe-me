import type { TestRecord } from '@describe-me/core/types'
import { PAGE_URL_PREFIX } from '@describe-me/core/types'

/** An opaque origin serializes as "null", which is not a URL prefix at all. */
const HTTP_ORIGIN = /^https?:\/\//

/**
 * A serialized snapshot whose URLs no longer name the server of the test page.
 * Its port, and in browser mode the session and the test file's path in the
 * page's URL, differ from run to run, so the same DOM would be stored under
 * another name each time. A link into the page itself keeps only its fragment,
 * as `describe-me-page:#top`, and any other URL on the origin keeps what
 * follows the origin, as `describe-me-page:/pricing`. It runs after the asset
 * store, so the URLs of project files are asset URLs by now.
 */
export function rewritePageUrls(json: string, record: Pick<TestRecord, 'origin' | 'page'>): string {
  const { origin, page } = record

  if (origin === undefined || !HTTP_ORIGIN.test(origin)) {
    return json
  }

  // First, because the page's URL starts with the origin too.
  const withoutPage = page === undefined ? json : json.replaceAll(`${page}#`, `${PAGE_URL_PREFIX}#`)

  return withoutPage.replaceAll(`${origin}/`, `${PAGE_URL_PREFIX}/`)
}
