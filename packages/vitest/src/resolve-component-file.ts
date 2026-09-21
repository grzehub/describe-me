import { readFileSync } from 'node:fs'
import { extname } from 'node:path'
import ts from 'typescript'

/** Where a component lives, and under which name its module exports it. */
export interface ResolvedComponent {
  /** Absolute path of the source file. */
  file: string
  /** Exported name, or `default` for a default export. */
  exportName: string
}

const SCRIPT_KINDS: Record<string, ts.ScriptKind> = {
  '.ts': ts.ScriptKind.TS,
  '.tsx': ts.ScriptKind.TSX,
  '.mts': ts.ScriptKind.TS,
  '.cts': ts.ScriptKind.TS,
  '.js': ts.ScriptKind.JS,
  '.jsx': ts.ScriptKind.JSX,
  '.mjs': ts.ScriptKind.JS,
  '.cjs': ts.ScriptKind.JS,
}

/**
 * Find the file a test imports a component from. The React adapter only
 * reports a name, so the test module itself is the index: whichever import
 * binds that name points at the component. Returns null when no import
 * matches or the match comes from a library.
 */
export function resolveComponentFile(
  testFile: string,
  componentName: string,
  options: ts.CompilerOptions,
): ResolvedComponent | null {
  const source = parseModule(testFile)

  if (!source) {
    return null
  }

  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) {
      continue
    }

    const exportName = exportNameFor(statement, componentName)

    if (exportName === null) {
      continue
    }

    const file = resolveSpecifier(statement, testFile, options)

    if (file) {
      return { file, exportName }
    }
  }

  return null
}

/** Parse the test module on its own; a full program would cost far more than reading its imports. */
function parseModule(testFile: string): ts.SourceFile | null {
  try {
    const text = readFileSync(testFile, 'utf8')
    const kind = SCRIPT_KINDS[extname(testFile)] ?? ts.ScriptKind.TSX

    return ts.createSourceFile(testFile, text, ts.ScriptTarget.Latest, true, kind)
  } catch {
    return null
  }
}

/** The exported name this import binds to `componentName`, or null when it binds something else. */
function exportNameFor(statement: ts.ImportDeclaration, componentName: string): string | null {
  const clause = statement.importClause

  if (!clause) {
    return null
  }

  if (clause.name?.text === componentName) {
    return 'default'
  }

  const bindings = clause.namedBindings

  if (!bindings || !ts.isNamedImports(bindings)) {
    return null
  }

  for (const element of bindings.elements) {
    const original = element.propertyName ?? element.name

    // The adapter reports the component's own name: that is the local name,
    // unless the test aliased the import, in which case it is the exported one.
    if (element.name.text === componentName || original.text === componentName) {
      return original.text
    }
  }

  return null
}

/** Resolve the import specifier to a file in the project, skipping anything from node_modules. */
function resolveSpecifier(
  statement: ts.ImportDeclaration,
  testFile: string,
  options: ts.CompilerOptions,
): string | null {
  const specifier = statement.moduleSpecifier

  if (!ts.isStringLiteral(specifier)) {
    return null
  }

  const { resolvedModule } = ts.resolveModuleName(specifier.text, testFile, options, ts.sys)

  if (!resolvedModule || resolvedModule.isExternalLibraryImport) {
    return null
  }

  return resolvedModule.resolvedFileName || null
}
