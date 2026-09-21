import type { ComponentDoc, ManifestTest, PropDoc } from '@describe-me/core/types'

/** One value of an enumerable prop, and whether the tests in scope produced it. */
export interface CoverageEntry {
  label: string
  covered: boolean
  isDefault: boolean
}

/** What the props table shows for one prop of one component. */
export interface PropCoverage {
  prop: PropDoc
  entries: CoverageEntry[]
  /** Tests that passed the prop at least once. Only meaningful without entries. */
  passedIn: number
  testsTotal: number
}

/** The manifest keeps literal types as source text, so `'primary'` arrives quoted. */
function unquote(text: string): string {
  for (const quote of ["'", '"']) {
    if (text.length > 1 && text.startsWith(quote) && text.endsWith(quote)) {
      return text.slice(1, -1)
    }
  }

  return text
}

/** The props of every `render` frame of one test; frames without props are ignored. */
function renderProps(test: ManifestTest): Record<string, unknown>[] {
  const passed: Record<string, unknown>[] = []
  for (const frame of test.frames) {
    const props = frame.kind === 'render' ? frame.meta?.props : undefined
    if (props && typeof props === 'object' && !Array.isArray(props)) {
      passed.push(props as Record<string, unknown>)
    }
  }

  return passed
}

function wasPassed(passed: Record<string, unknown>[], name: string, label: string): boolean {
  return passed.some((props) => name in props && String(props[name]) === label)
}

function entriesFor(prop: PropDoc, passed: Record<string, unknown>[]): CoverageEntry[] {
  if (prop.kind !== 'literals' && prop.kind !== 'boolean') {
    return []
  }

  // Omitting the prop exercises its default, so it covers the matching value.
  const omitted = passed.some((props) => !(prop.name in props))

  return (prop.values ?? []).map((value) => {
    const label = unquote(value)
    const isDefault = prop.defaultValue !== undefined && unquote(prop.defaultValue) === label
    const covered = wasPassed(passed, prop.name, label) || (isDefault && omitted)

    return { label, covered, isDefault }
  })
}

/** How well a set of tests exercises a component's props, prop by prop. */
export function computeCoverage(doc: ComponentDoc, tests: ManifestTest[]): PropCoverage[] {
  const perTest = tests.map((test) => renderProps(test))
  const passed = perTest.flat()

  return doc.props.map((prop) => ({
    prop,
    entries: entriesFor(prop, passed),
    passedIn: perTest.filter((frames) => frames.some((props) => prop.name in props)).length,
    testsTotal: tests.length,
  }))
}
