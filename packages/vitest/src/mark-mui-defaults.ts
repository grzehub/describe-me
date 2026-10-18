import { isDeepStrictEqual } from 'node:util'
import type { FoundationToken } from '@describe-me/core/types'
import { firstLineOf } from './first-line-of.js'
import type { ImportModule } from './import-theme.js'
import { muiDefaultOptions } from './mui-default-options.js'
import { muiThemeTokens } from './mui-theme-tokens.js'

type Values = Record<string, unknown>

type CreateTheme = (options: Values) => Values

/** The tokens with their origins, or all of them `project` and the one sentence that says why. */
interface MarkedTokens {
  tokens: FoundationToken[]
  errors: string[]
}

function isObject(value: unknown): value is Values {
  return typeof value === 'object' && value !== null
}

/** A typography variant compares by every part. */
function sameValue(token: FoundationToken, fallback: FoundationToken): boolean {
  return isDeepStrictEqual(
    [token.value, token.modes, token.parts],
    [fallback.value, fallback.modes, fallback.parts],
  )
}

function modeOriginsOf(
  token: FoundationToken,
  fallback: FoundationToken,
): FoundationToken['modeOrigins'] {
  if (!token.modes || !fallback.modes || !isDeepStrictEqual(token.parts, fallback.parts)) {
    return undefined
  }

  const light = token.modes.light === fallback.modes.light
  const dark = token.modes.dark === fallback.modes.dark

  if (light === dark) {
    return undefined
  }

  return { light: light ? 'default' : 'project', dark: dark ? 'default' : 'project' }
}

function marked(token: FoundationToken, fallback: FoundationToken | undefined): FoundationToken {
  if (fallback === undefined) {
    return token
  }

  if (sameValue(token, fallback)) {
    return { ...token, origin: 'default' }
  }

  const modeOrigins = modeOriginsOf(token, fallback)

  return modeOrigins === undefined ? token : { ...token, modeOrigins }
}

/** Material UI's defaults by token name, or the sentence that says why there are none. */
async function defaultTokens(
  theme: Values,
  importModule: ImportModule,
): Promise<Map<string, FoundationToken> | string> {
  let styles: unknown

  try {
    styles = await importModule('@mui/material/styles')
  } catch (error) {
    return `foundations.theme: importing @mui/material/styles for Material UI's defaults failed: ${firstLineOf(error)}`
  }

  const createTheme = isObject(styles) ? styles.createTheme : undefined

  if (typeof createTheme !== 'function') {
    return 'foundations.theme: @mui/material/styles has no createTheme, so no Material UI token is marked default'
  }

  try {
    const defaults = (createTheme as CreateTheme)(muiDefaultOptions(theme))

    return new Map(muiThemeTokens(defaults).map((token) => [token.name, token]))
  } catch (error) {
    return `foundations.theme: createTheme() of @mui/material/styles failed for Material UI's defaults: ${firstLineOf(error)}`
  }
}

/**
 * Mark each token of a Material UI theme that equals Material UI's own
 * default as `default`, comparing with a theme that the project's own
 * `createTheme()` builds with the same color schemes and CSS variables.
 * Never throws. On a failure every token stays `project`.
 */
export async function markMuiDefaults(
  theme: Values,
  tokens: FoundationToken[],
  importModule: ImportModule,
): Promise<MarkedTokens> {
  const defaults = await defaultTokens(theme, importModule)

  if (typeof defaults === 'string') {
    return { tokens, errors: [defaults] }
  }

  return { tokens: tokens.map((token) => marked(token, defaults.get(token.name))), errors: [] }
}
