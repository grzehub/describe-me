import { dirname } from 'node:path'
import ts from 'typescript'

/**
 * Used when the project has no tsconfig.json. Modern React defaults, so a
 * component still types correctly instead of failing to parse its JSX.
 */
const FALLBACK_OPTIONS: ts.CompilerOptions = {
  jsx: ts.JsxEmit.ReactJSX,
  module: ts.ModuleKind.ESNext,
  moduleResolution: ts.ModuleResolutionKind.Bundler,
  strict: true,
  target: ts.ScriptTarget.ES2022,
  allowJs: true,
}

/**
 * The project's own compiler options, so components are read the way the
 * project reads them (paths, jsx runtime, module resolution).
 */
export function loadCompilerOptions(root: string): ts.CompilerOptions {
  const configPath = ts.findConfigFile(root, ts.sys.fileExists)

  if (!configPath) {
    return FALLBACK_OPTIONS
  }

  const { config, error } = ts.readConfigFile(configPath, ts.sys.readFile)

  if (error || !config) {
    return FALLBACK_OPTIONS
  }

  const parsed = ts.parseJsonConfigFileContent(config, ts.sys, dirname(configPath))

  return parsed.options
}
