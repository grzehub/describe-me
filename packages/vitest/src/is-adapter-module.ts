/**
 * Whether a module is one of the adapter's own files, whose imports of the
 * original module must stay unredirected. `/node_modules/<package>/` is the
 * fallback for when the project root could not resolve the package.
 */
export function isAdapterModule(
  id: string,
  adapterRoot: string | null,
  adapterPackage: string,
): boolean {
  if (adapterRoot !== null && id.startsWith(adapterRoot)) {
    return true
  }

  return id.includes(`/node_modules/${adapterPackage}/`)
}
