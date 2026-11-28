/** A report changed when it lists a test or a component, whether or not one looks different. */
export function hasChanges(report) {
  return report.tests.length > 0 || report.components.length > 0
}
