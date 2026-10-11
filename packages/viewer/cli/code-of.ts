/** The `code` of an error, such as `ERR_PACKAGE_PATH_NOT_EXPORTED`, or undefined. */
export function codeOf(error: unknown): unknown {
  return typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
}
