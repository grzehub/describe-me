import ts from 'typescript'
import type { PropDoc, PropKind } from '@describe-me/core/types'

/** Type names that mean "renderable children" once TypeScript has printed them. */
const NODE_TYPE_NAMES = ['ReactNode', 'ReactElement', 'Element']

/** Calls that wrap a component function without changing its props. */
const COMPONENT_WRAPPERS = ['forwardRef', 'memo']

/**
 * Read a component's props from its TypeScript type: one PropDoc per own prop,
 * with the literal choices and the default from the destructuring pattern.
 * Returns null when the export is not a callable taking a props object.
 */
export function extractProps(
  program: ts.Program,
  file: string,
  exportName: string,
): PropDoc[] | null {
  const checker = program.getTypeChecker()
  const sourceFile = program.getSourceFile(file)

  if (!sourceFile) {
    return null
  }

  const component = exportedSymbol(checker, sourceFile, exportName)
  const declaration = component?.declarations?.[0]

  if (!component || !declaration) {
    return null
  }

  const signature = componentSignature(checker, component, declaration)

  if (!signature) {
    return null
  }

  // A component that takes no props is still a component, with nothing to list.
  const [parameter] = signature.parameters

  if (!parameter) {
    return []
  }

  const propsType = checker.getTypeOfSymbolAtLocation(parameter, declaration)
  const defaults = defaultValues(declaration)

  return propsType
    .getProperties()
    .filter(isDeclaredInProject)
    .map((prop) => toPropDoc(checker, prop, declaration, defaults))
}

/**
 * The exported symbol behind `exportName`, with `export { X } from` aliases
 * followed. A default export also answers to its local name, which is the name
 * the plugin registers it under: `export default function Button` is `Button`.
 */
function exportedSymbol(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  exportName: string,
): ts.Symbol | undefined {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)

  if (!moduleSymbol) {
    return undefined
  }

  const exports = checker.getExportsOfModule(moduleSymbol)

  const exported =
    exports.find((sym) => sym.name === exportName) ??
    exports.find((sym) => {
      return sym.name === 'default' && localNameOf(followAlias(checker, sym)) === exportName
    })

  return exported && followAlias(checker, exported)
}

function followAlias(checker: ts.TypeChecker, symbol: ts.Symbol): ts.Symbol {
  if (symbol.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(symbol)
  }

  return symbol
}

/** The name a symbol is declared under, which differs from its export name for `default`. */
function localNameOf(symbol: ts.Symbol): string | undefined {
  const declaration = symbol.declarations?.[0]
  const name = declaration && ts.getNameOfDeclaration(declaration)

  return name && ts.isIdentifier(name) ? name.text : undefined
}

/**
 * The call signature props are read from, or null when the export is not
 * callable (not a component). A plain signature beats a generic one:
 * styled-components 6 puts a generic `as`-aware signature first, whose props
 * TypeScript cannot list until `as` is known, and inherits a plain one.
 */
function componentSignature(
  checker: ts.TypeChecker,
  component: ts.Symbol,
  declaration: ts.Declaration,
): ts.Signature | null {
  const type = checker.getTypeOfSymbolAtLocation(component, declaration)
  const signatures = type.getCallSignatures()
  const plain = signatures.find((signature) => !signature.typeParameters?.length)

  return plain ?? signatures[0] ?? null
}

/**
 * Drop props inherited from a library type. `Omit<ButtonHTMLAttributes<…>, …>`
 * would otherwise contribute hundreds of DOM attributes nobody documents.
 */
function isDeclaredInProject(prop: ts.Symbol): boolean {
  return (prop.declarations ?? []).some((declaration) => {
    return !declaration.getSourceFile().fileName.includes('/node_modules/')
  })
}

function toPropDoc(
  checker: ts.TypeChecker,
  prop: ts.Symbol,
  location: ts.Declaration,
  defaults: Map<string, string>,
): PropDoc {
  const type = propType(checker, prop, location)
  const description = ts.displayPartsToString(prop.getDocumentationComment(checker))
  const shape = classify(checker, type)

  return {
    name: prop.name,
    type:
      declaredTypeNode(prop)?.getText() ??
      checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
    required: !(prop.flags & ts.SymbolFlags.Optional),
    defaultValue: defaults.get(prop.name),
    kind: shape.kind,
    values: shape.values,
    description: description || undefined,
  }
}

/**
 * The type a prop is classified by. An optional prop carries `| undefined`,
 * which says nothing the `required` flag does not already say and makes every
 * printed type noisier, so it is dropped.
 *
 * A generic component (`<T extends ElementType>(props: Props<T>)`) leaves prop
 * types that still depend on `T`, such as `Props<T>['variant']`, which cannot
 * be classified. The type the prop was declared with (`'primary' | …`) usually
 * does not depend on `T`, and is used instead. One that does, such as
 * `component?: T`, stays generic and is classified as `other`.
 */
function propType(checker: ts.TypeChecker, prop: ts.Symbol, location: ts.Declaration): ts.Type {
  const atLocation = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, location))
  const node = declaredTypeNode(prop)

  if (!isGeneric(atLocation) || !node) {
    return atLocation
  }

  const declared = checker.getTypeFromTypeNode(node)

  return isGeneric(declared) ? atLocation : checker.getNonNullableType(declared)
}

/** Whether a type still depends on a type parameter: `T`, `Props<T>['size']`, `T & {}`. */
function isGeneric(type: ts.Type): boolean {
  if (type.flags & ts.TypeFlags.Instantiable) {
    return true
  }

  return type.isUnionOrIntersection() && type.types.some(isGeneric)
}

/**
 * The type as the author wrote it (`ReactNode`), when the prop has an
 * annotation. The checker would otherwise print the expanded alias, which for
 * ReactNode is a union longer than the table column.
 */
function declaredTypeNode(prop: ts.Symbol): ts.TypeNode | undefined {
  for (const declaration of prop.declarations ?? []) {
    if (ts.isPropertySignature(declaration) && declaration.type) {
      return declaration.type
    }
  }

  return undefined
}

interface PropShape {
  kind: PropKind
  values?: string[]
}

/** What the viewer can do with a prop: pick from a list, toggle, type a value. */
function classify(checker: ts.TypeChecker, type: ts.Type): PropShape {
  const members = type.isUnion() ? type.types : [type]

  if (type.flags & ts.TypeFlags.Boolean || members.every(isBooleanLiteral)) {
    return { kind: 'boolean', values: ['true', 'false'] }
  }

  if (members.every(isTextualLiteral)) {
    return { kind: 'literals', values: members.map(literalText) }
  }

  if (type.flags & ts.TypeFlags.NumberLike) {
    return { kind: 'number' }
  }

  if (type.flags & ts.TypeFlags.StringLike) {
    return { kind: 'string' }
  }

  if (type.getCallSignatures().length > 0) {
    return { kind: 'function' }
  }

  const printed = checker.typeToString(type)

  if (NODE_TYPE_NAMES.some((name) => printed.includes(name))) {
    return { kind: 'node' }
  }

  return { kind: 'other' }
}

function isBooleanLiteral(type: ts.Type): boolean {
  return (type.flags & ts.TypeFlags.BooleanLiteral) !== 0
}

function isTextualLiteral(type: ts.Type): boolean {
  return type.isStringLiteral() || type.isNumberLiteral()
}

/** A literal as it would be written in source: `'sm'` for strings, `3` for numbers. */
function literalText(type: ts.Type): string {
  if (type.isStringLiteral()) {
    return `'${type.value}'`
  }

  if (type.isNumberLiteral()) {
    return String(type.value)
  }

  return ''
}

/**
 * Defaults live in the destructuring pattern, not in the type, so they are read
 * from the source text: `{ size = 'md' }` gives `size` → `'md'`.
 */
function defaultValues(declaration: ts.Declaration): Map<string, string> {
  const defaults = new Map<string, string>()
  const parameter = functionOf(declaration)?.parameters[0]

  if (!parameter || !ts.isObjectBindingPattern(parameter.name)) {
    return defaults
  }

  for (const element of parameter.name.elements) {
    if (element.initializer) {
      defaults.set((element.propertyName ?? element.name).getText(), element.initializer.getText())
    }
  }

  return defaults
}

/** The function behind a component declaration, however it was written. */
function functionOf(declaration: ts.Declaration): ts.SignatureDeclaration | undefined {
  if (ts.isFunctionDeclaration(declaration) || ts.isFunctionExpression(declaration)) {
    return declaration
  }

  if (ts.isVariableDeclaration(declaration) && declaration.initializer) {
    return asFunction(declaration.initializer)
  }

  if (ts.isExportAssignment(declaration)) {
    return asFunction(declaration.expression)
  }

  return undefined
}

/**
 * The function an expression evaluates to, seen through the wrappers a
 * component is commonly written with: `forwardRef(fn)`, `React.memo(fn)`,
 * `memo(forwardRef<A, B>(fn))`, and `as` / `satisfies` / parentheses.
 */
function asFunction(expression: ts.Expression): ts.SignatureDeclaration | undefined {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    return expression
  }

  if (
    ts.isParenthesizedExpression(expression) ||
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isTypeAssertionExpression(expression) ||
    ts.isNonNullExpression(expression)
  ) {
    return asFunction(expression.expression)
  }

  const [wrapped] = isComponentWrapperCall(expression) ? expression.arguments : []

  return wrapped ? asFunction(wrapped) : undefined
}

/** `forwardRef(…)` or `memo(…)`, called bare or on a namespace such as `React`. */
function isComponentWrapperCall(expression: ts.Expression): expression is ts.CallExpression {
  if (!ts.isCallExpression(expression)) {
    return false
  }

  const callee = expression.expression
  const name = ts.isPropertyAccessExpression(callee) ? callee.name : callee

  return ts.isIdentifier(name) && COMPONENT_WRAPPERS.includes(name.text)
}
