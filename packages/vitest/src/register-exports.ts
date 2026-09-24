import { EXPORT_REGISTRY_KEY } from '@describe-me/core/types'

/**
 * The part of an ESTree node every node has. Rollup (Vite 6 and 7) and
 * Rolldown (Vite 8) both parse to ESTree, so structural types fit either
 * without depending on their AST packages.
 */
export interface EstreeNode {
  type: string
}

/** A parsed module, as `this.parse(code)` returns it in a Vite plugin. */
export interface EstreeProgram {
  body: readonly EstreeNode[]
}

interface Identifier extends EstreeNode {
  name: string
}

interface Literal extends EstreeNode {
  value: unknown
}

interface ExportNamedDeclaration extends EstreeNode {
  declaration?: EstreeNode | null
  specifiers?: readonly ExportSpecifier[]
  source?: EstreeNode | null
}

interface ExportSpecifier {
  local: EstreeNode
  exported: EstreeNode
}

interface ExportDefaultDeclaration extends EstreeNode {
  declaration: EstreeNode
}

interface VariableDeclaration extends EstreeNode {
  declarations: readonly { id: EstreeNode }[]
}

interface FunctionOrClassDeclaration extends EstreeNode {
  id?: EstreeNode | null
}

/** One export to register: the name it goes by, and the local binding that holds it. */
interface Registration {
  name: string
  local: string
}

/**
 * The code to append to a project module so that each value it exports is
 * registered under its export name, or null when it exports nothing to
 * register. A component is then named `Button` even when it is an anonymous
 * `forwardRef` or a styled component.
 *
 * The appended code imports nothing: a user's module cannot always resolve
 * `@describe-me/core`, and a bundled adapter may carry its own copy of it. It
 * writes to a `WeakMap` on `globalThis` instead, and the first registration of
 * a value wins, so the defining module beats a barrel that re-exports it.
 *
 * Only local bindings are referenced. Re-exports with `from` are skipped (the
 * defining module registers the value itself), and so are anonymous default
 * exports, which have no binding to point at.
 */
export function registerExports(program: EstreeProgram, file: string): string | null {
  const registrations = program.body.flatMap(registrationsOf)

  if (registrations.length === 0) {
    return null
  }

  return snippetFor(registrations, file)
}

function registrationsOf(node: EstreeNode): Registration[] {
  if (node.type === 'ExportNamedDeclaration') {
    return namedExports(node as ExportNamedDeclaration)
  }

  if (node.type === 'ExportDefaultDeclaration') {
    return defaultExport(node as ExportDefaultDeclaration)
  }

  return []
}

/** `export const A = …`, `export function A`, `export class A`, `export { a as A }`. */
function namedExports(node: ExportNamedDeclaration): Registration[] {
  if (node.source) {
    return []
  }

  if (node.declaration) {
    return declaredNames(node.declaration).map((name) => ({ name, local: name }))
  }

  return (node.specifiers ?? []).flatMap(specifierExport)
}

/** Identifiers only: a destructuring pattern would need its own walk for little gain. */
function declaredNames(declaration: EstreeNode): string[] {
  let ids: (EstreeNode | null | undefined)[] = []

  if (declaration.type === 'VariableDeclaration') {
    ids = (declaration as VariableDeclaration).declarations.map((declarator) => declarator.id)
  } else if (isFunctionOrClass(declaration)) {
    ids = [declaration.id]
  }

  return ids.map(identifierName).filter((name) => name !== null)
}

function specifierExport(specifier: ExportSpecifier): Registration[] {
  const local = identifierName(specifier.local)
  const exported = exportedName(specifier.exported)

  if (local === null || exported === null) {
    return []
  }

  // `export { Button as default }` is a default export: its local name says more.
  const name = exported === 'default' ? local : exported

  return [{ name, local }]
}

/**
 * `export default Button` and `export default function Button`, under the local
 * name. A function or class expression (`export default (function A() {})`)
 * binds nothing in the module scope, so it is left out like any anonymous one.
 */
function defaultExport(node: ExportDefaultDeclaration): Registration[] {
  const { declaration } = node
  const local = identifierName(isFunctionOrClass(declaration) ? declaration.id : declaration)

  if (local === null) {
    return []
  }

  return [{ name: local, local }]
}

function isFunctionOrClass(node: EstreeNode): node is FunctionOrClassDeclaration {
  return node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration'
}

function identifierName(node: EstreeNode | null | undefined): string | null {
  if (node?.type !== 'Identifier') {
    return null
  }

  return (node as Identifier).name
}

/** `export { a as A }` or, since ES2022, `export { a as 'A' }`. */
function exportedName(node: EstreeNode): string | null {
  if (node.type === 'Literal') {
    const { value } = node as Literal

    return typeof value === 'string' ? value : null
  }

  return identifierName(node)
}

/**
 * Appended after the module's last line, so no existing code moves and the
 * source maps from earlier transforms stay valid. Starts on a new line and
 * with a semicolon, in case the module ends in a comment or an unterminated
 * expression.
 */
function snippetFor(registrations: Registration[], file: string): string {
  const entries = registrations
    .map(({ name, local }) => `[${JSON.stringify(name)}, ${local}]`)
    .join(', ')

  return [
    '',
    '// describe-me: name components after their export (registerExports option)',
    ';((key, file, entries) => {',
    '  const registry = globalThis[key] || (globalThis[key] = new WeakMap())',
    '  for (const [name, value] of entries) {',
    "    const isObject = typeof value === 'function' || (typeof value === 'object' && value !== null)",
    '    if (isObject && !registry.has(value)) {',
    '      registry.set(value, { name, file })',
    '    }',
    '  }',
    `})(Symbol.for(${JSON.stringify(EXPORT_REGISTRY_KEY)}), ${JSON.stringify(file)}, [${entries}])`,
    '',
  ].join('\n')
}
