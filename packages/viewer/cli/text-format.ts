/** How the text of a report shows what comes from a manifest. */
export interface TextFormat {
  /** A module path, test name, prop name, type, value or package name. */
  code(text: string): string
  /** A component name or a version, which may stay plain when it is a plain word. */
  word(text: string): string
}
