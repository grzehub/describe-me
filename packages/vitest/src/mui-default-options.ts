type Options = Record<string, unknown>

/**
 * The adapter reads only these two, and `createTheme()` with `cssVariables`
 * throws on a third one passed as `true`.
 */
const SCHEMES = ['light', 'dark']

const CSS_VARIABLE_KEYS = ['cssVarPrefix', 'colorSchemeSelector', 'rootSelector']

function isObject(value: unknown): value is Options {
  return typeof value === 'object' && value !== null
}

function schemesOf(theme: Options): string[] {
  const colorSchemes = theme.colorSchemes

  if (!isObject(colorSchemes)) {
    return []
  }

  return SCHEMES.filter((scheme) => {
    const entry = colorSchemes[scheme]

    return isObject(entry) && isObject(entry.palette)
  })
}

/** The color schemes as `true` each, or the one palette mode of a theme built the Material UI 5 way. */
function colorOptions(theme: Options): Options {
  const schemes = schemesOf(theme)

  if (schemes.length > 0) {
    const options: Options = {
      colorSchemes: Object.fromEntries(schemes.map((scheme) => [scheme, true])),
    }

    if (theme.defaultColorScheme === 'light' || theme.defaultColorScheme === 'dark') {
      options.defaultColorScheme = theme.defaultColorScheme
    }

    return options
  }

  const mode = isObject(theme.palette) ? theme.palette.mode : undefined

  return typeof mode === 'string' ? { palette: { mode } } : {}
}

function cssVariableOptions(theme: Options): Options {
  if (!isObject(theme.vars)) {
    return {}
  }

  const cssVariables = Object.fromEntries(
    CSS_VARIABLE_KEYS.filter((key) => typeof theme[key] === 'string').map((key) => [
      key,
      theme[key],
    ]),
  )

  return { cssVariables }
}

/**
 * The `createTheme()` options that give Material UI's defaults with the same
 * color schemes and CSS variables as `theme`. Every other option stays at its
 * default, so the result is what the project would get without its own theme.
 */
export function muiDefaultOptions(theme: Options): Options {
  return { ...colorOptions(theme), ...cssVariableOptions(theme) }
}
