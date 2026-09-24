import {
  ANONYMOUS_COMPONENT,
  EXPORT_REGISTRY_KEY,
  type ComponentInfo,
  type RegisteredExport,
} from './types.js'

/** How a component type is shown and where it was defined, when that is known. */
type ComponentIdentity = Pick<ComponentInfo, 'name' | 'file'>

/** Where the plugin's appended code writes, keyed by `Symbol.for(EXPORT_REGISTRY_KEY)`. */
type RegistryHost = Record<symbol, WeakMap<object, RegisteredExport> | undefined>

/** `memo(forwardRef(memo(…)))` is as deep as real code goes; the bound only guards against cycles. */
const MAX_UNWRAP_DEPTH = 5

/**
 * Display names styled-components gives when none was set: `styled.p`,
 * `Styled(Button)`. They say which element is styled, not which component it is.
 */
const STYLED_DEFAULT_NAMES = [/^styled\./, /^Styled\(/]

/**
 * Name a component type (an element's `type`) the way its author would.
 *
 * The export it was registered under wins, because an anonymous `forwardRef`
 * or a styled component has no name of its own. Then an explicit
 * `displayName`, then the function's name, then the same again for the
 * component a `memo` or `forwardRef` wraps. Shapes are detected structurally,
 * so no framework is imported. `Anonymous` when nothing names it.
 */
export function describeComponentType(type: unknown): ComponentIdentity {
  if (typeof type === 'string') {
    return { name: type }
  }

  return identify(type, 0) ?? { name: ANONYMOUS_COMPONENT }
}

function identify(type: unknown, depth: number): ComponentIdentity | null {
  if (!isComponentLike(type)) {
    return null
  }

  const registered = registeredExport(type)

  if (registered) {
    return { name: registered.name, file: registered.file }
  }

  const { displayName, name } = type as { displayName?: unknown; name?: unknown }

  if (isNonEmptyString(displayName) && !isStyledDefault(displayName)) {
    return { name: displayName }
  }

  if (typeof type === 'function' && isNonEmptyString(name)) {
    return { name }
  }

  // An unregistered styled component: its render function is named after the
  // library's internals (`forwardRefRender`), so `styled.p` is the best name left.
  if (isNonEmptyString(displayName)) {
    return { name: displayName }
  }

  if (depth >= MAX_UNWRAP_DEPTH) {
    return null
  }

  return identify(wrappedType(type), depth + 1)
}

/** The component inside `memo(…)` (`.type`) or `forwardRef(…)` (`.render`). */
function wrappedType(type: object): unknown {
  const { type: memoized, render } = type as { type?: unknown; render?: unknown }

  return memoized ?? render
}

/** What the plugin's appended code registered for this value, if anything. */
function registeredExport(type: object): RegisteredExport | undefined {
  const registry = (globalThis as RegistryHost)[Symbol.for(EXPORT_REGISTRY_KEY)]

  // Duck-typed rather than `instanceof`: the map may come from another realm.
  if (typeof registry?.get !== 'function') {
    return undefined
  }

  return registry.get(type)
}

/** Functions and non-null objects: everything a registry can hold and a component can be. */
function isComponentLike(value: unknown): value is object {
  return typeof value === 'function' || (typeof value === 'object' && value !== null)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value !== ''
}

function isStyledDefault(displayName: string): boolean {
  return STYLED_DEFAULT_NAMES.some((pattern) => pattern.test(displayName))
}
