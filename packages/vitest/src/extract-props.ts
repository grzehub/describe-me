import ts from 'typescript'
import type { PropDoc, PropKind } from '@describe-me/core/types'

/** Type names that mean "renderable children" once TypeScript has printed them. */
const NODE_TYPE_NAMES = ['ReactNode', 'ReactElement', 'Element']

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

/** The exported symbol behind `exportName`, with `export { X } from` aliases followed. */
function exportedSymbol(
  checker: ts.TypeChecker,
  sourceFile: ts.SourceFile,
  exportName: string,
): ts.Symbol | undefined {
  const moduleSymbol = checker.getSymbolAtLocation(sourceFile)

  if (!moduleSymbol) {
    return undefined
  }

  const exported = checker.getExportsOfModule(moduleSymbol).find((sym) => sym.name === exportName)

  if (exported && exported.flags & ts.SymbolFlags.Alias) {
    return checker.getAliasedSymbol(exported)
  }

  return exported
}

/** The first call signature of the export, or null when it is not callable (not a component). */
function componentSignature(
  checker: ts.TypeChecker,
  component: ts.Symbol,
  declaration: ts.Declaration,
): ts.Signature | null {
  const type = checker.getTypeOfSymbolAtLocation(component, declaration)
  const [signature] = type.getCallSignatures()

  return signature ?? null
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
  // An optional prop carries `| undefined`, which says nothing the `required`
  // flag does not already say and makes every printed type noisier.
  const type = checker.getNonNullableType(checker.getTypeOfSymbolAtLocation(prop, location))
  const description = ts.displayPartsToString(prop.getDocumentationComment(checker))
  const shape = classify(checker, type)

  return {
    name: prop.name,
    type:
      declaredTypeText(prop) ??
      checker.typeToString(type, undefined, ts.TypeFormatFlags.NoTruncation),
    required: !(prop.flags & ts.SymbolFlags.Optional),
    defaultValue: defaults.get(prop.name),
    kind: shape.kind,
    values: shape.values,
    description: description || undefined,
  }
}

/**
 * The type as the author wrote it (`ReactNode`), when the prop has an
 * annotation. The checker would otherwise print the expanded alias, which for
 * ReactNode is a union longer than the table column.
 */
function declaredTypeText(prop: ts.Symbol): string | undefined {
  for (const declaration of prop.declarations ?? []) {
    if (ts.isPropertySignature(declaration) && declaration.type) {
      return declaration.type.getText()
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

function asFunction(expression: ts.Expression): ts.SignatureDeclaration | undefined {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) {
    return expression
  }

  return undefined
}
