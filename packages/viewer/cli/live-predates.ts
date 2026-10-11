/** The error for a project whose `@describe-me/vitest` is older than `feature`. */
export function livePredates(root: string, feature: string, consequence: string): Error {
  return new Error(`the @describe-me/vitest in ${root} predates ${feature}, ${consequence}.`)
}
