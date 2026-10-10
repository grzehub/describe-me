/**
 * The package an adapter entry point belongs to, e.g.
 * `@describe-me/react/testing-library` → `@describe-me/react`.
 */
export function packageNameOf(specifier: string): string {
  return specifier.split('/').slice(0, 2).join('/')
}
