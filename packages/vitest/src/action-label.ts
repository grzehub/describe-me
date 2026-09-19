import { describeArg } from './describe-arg.js'
import { prettySelector } from './pretty-selector.js'

/** Build the frame label for an interaction, e.g. `click(button "increment")` or `keyboard("{Escape}")`. */
export function actionLabel(method: string, selector: string | undefined, args: unknown[]): string {
  const parts: string[] = []

  if (selector) {
    parts.push(prettySelector(selector))
  }

  for (const arg of args) {
    const shown = describeArg(arg)

    if (shown) {
      parts.push(shown)
    }
  }

  return `${method}(${parts.join(', ')})`
}
