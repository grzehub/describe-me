import { cssReferences } from '@describe-me/core/css-references'

/**
 * Replace each `url()` and `@import` target in CSS text for which `resolve`
 * returns a string. Quotes and everything else stay as written.
 */
export function rewriteCssReferences(css: string, resolve: (url: string) => string | null): string {
  let rewritten = ''
  let copied = 0

  for (const reference of cssReferences(css)) {
    const replacement = resolve(reference.url)
    if (replacement === null) {
      continue
    }

    rewritten += css.slice(copied, reference.start) + replacement
    copied = reference.end
  }

  return rewritten + css.slice(copied)
}
