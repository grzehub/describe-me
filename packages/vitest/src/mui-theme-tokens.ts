import type { FoundationGroup, FoundationToken, FoundationTokenType } from '@describe-me/core/types'
import { isCssColor } from './is-css-color.js'
import { typeStyleParts } from './type-style-parts.js'

type Values = Record<string, unknown>

const INTENTS = ['primary', 'secondary', 'error', 'warning', 'info', 'success']

const INTENT_KEYS = ['main', 'light', 'dark', 'contrastText']

/** Palette groups whose keys differ by theme, read as both schemes have them. */
const OPEN_GROUPS = ['grey', 'text', 'background']

const VARIANTS = [
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'subtitle1',
  'subtitle2',
  'body1',
  'body2',
  'button',
  'caption',
  'overline',
]

const FONT_WEIGHTS = ['fontWeightLight', 'fontWeightRegular', 'fontWeightMedium', 'fontWeightBold']

const SPACING_STEPS = 12

function isObject(value: unknown): value is Values {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function objectAt(value: unknown, key: string): Values {
  return isObject(value) && isObject(value[key]) ? value[key] : {}
}

function isCssText(value: unknown): value is string | number {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

function token(
  name: string,
  group: FoundationGroup,
  type: FoundationTokenType,
  value: string,
  modes?: FoundationToken['modes'],
): FoundationToken {
  return {
    name,
    group,
    type,
    value,
    ...(modes === undefined ? {} : { modes }),
    origin: 'project',
    source: 'theme',
  }
}

/** The keys of a palette group in either scheme, the light scheme's order first. */
function keysOf(palettes: Values[], group: string): string[] {
  return [...new Set(palettes.flatMap((palette) => Object.keys(objectAt(palette, group))))]
}

function paletteColor(palette: Values, path: string[]): string | undefined {
  const [group, key] = path
  const value = key === undefined ? palette[group] : objectAt(palette, group)[key]

  return typeof value === 'string' && isCssColor(value) ? value : undefined
}

function palettePaths(palettes: Values[]): string[][] {
  const paths = INTENTS.flatMap((intent) => INTENT_KEYS.map((key) => [intent, key]))

  for (const group of OPEN_GROUPS) {
    paths.push(...keysOf(palettes, group).map((key) => [group, key]))
  }

  paths.push(['divider'], ['common', 'black'], ['common', 'white'])
  paths.push(...keysOf(palettes, 'action').map((key) => ['action', key]))

  return paths
}

/**
 * The palette in both color schemes when the theme has them, else its one
 * palette. Only CSS colors count, which skips the `…Channel` keys of
 * `cssVariables` and the opacity numbers of `palette.action`.
 */
function paletteTokens(theme: Values): FoundationToken[] {
  const light = objectAt(objectAt(theme, 'colorSchemes'), 'light').palette
  const dark = objectAt(objectAt(theme, 'colorSchemes'), 'dark').palette
  const palettes = isObject(light) && isObject(dark) ? [light, dark] : [objectAt(theme, 'palette')]
  const tokens: FoundationToken[] = []

  for (const path of palettePaths(palettes)) {
    const [lightValue, darkValue] = palettes.map((palette) => paletteColor(palette, path))
    const value = lightValue ?? darkValue

    if (value === undefined) {
      continue
    }

    const name = `palette.${path.join('.')}`

    if (lightValue !== undefined && darkValue !== undefined) {
      tokens.push(token(name, 'colors', 'color', value, { light: lightValue, dark: darkValue }))
    } else {
      tokens.push(token(name, 'colors', 'color', value))
    }
  }

  return tokens
}

function variantToken(variant: string, style: Values): FoundationToken | undefined {
  const parts = typeStyleParts(style)

  if (parts.fontSize === undefined) {
    return undefined
  }

  return { ...token(`typography.${variant}`, 'typography', 'typography', parts.fontSize), parts }
}

function typographyTokens(theme: Values): FoundationToken[] {
  const typography = objectAt(theme, 'typography')
  const tokens: FoundationToken[] = []

  for (const variant of VARIANTS) {
    const variantStyle = variantToken(variant, objectAt(typography, variant))

    if (variantStyle !== undefined) {
      tokens.push(variantStyle)
    }
  }

  if (typeof typography.fontFamily === 'string') {
    tokens.push(token('typography.fontFamily', 'typography', 'fontFamily', typography.fontFamily))
  }

  for (const weight of FONT_WEIGHTS) {
    const value = typography[weight]

    if (isCssText(value)) {
      tokens.push(token(`typography.${weight}`, 'typography', 'fontWeight', String(value)))
    }
  }

  return tokens
}

function spacingTokens(theme: Values): FoundationToken[] {
  const spacing = theme.spacing

  if (typeof spacing !== 'function') {
    return []
  }

  const tokens: FoundationToken[] = []

  // With `cssVariables` the steps are `var(--mui-spacing, 8px)` and `calc(…)`, which the viewer resolves.
  for (let step = 0; step <= SPACING_STEPS; step++) {
    tokens.push(token(`spacing(${step})`, 'spacing', 'dimension', String(spacing(step))))
  }

  return tokens
}

/** Where a scale of the theme goes, and the unit its numbers get. */
interface Scale {
  group: FoundationGroup
  type: FoundationTokenType
  unit: string
}

/** Every entry of an object whose value is CSS text, with the unit added to numbers. */
function scaleTokens(prefix: string, values: Values, scale: Scale): FoundationToken[] {
  return Object.entries(values)
    .filter((entry): entry is [string, string | number] => isCssText(entry[1]))
    .map(([key, value]) => {
      const text = typeof value === 'number' ? `${value}${scale.unit}` : value

      return token(`${prefix}.${key}`, scale.group, scale.type, text)
    })
}

function shapeTokens(theme: Values): FoundationToken[] {
  const borderRadius = objectAt(theme, 'shape').borderRadius

  if (!isCssText(borderRadius)) {
    return []
  }

  const value = typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius

  return [token('shape.borderRadius', 'radius', 'dimension', value)]
}

function breakpointTokens(theme: Values): FoundationToken[] {
  const breakpoints = objectAt(theme, 'breakpoints')
  const unit = typeof breakpoints.unit === 'string' ? breakpoints.unit : 'px'

  return scaleTokens('breakpoints', objectAt(breakpoints, 'values'), {
    group: 'breakpoints',
    type: 'dimension',
    unit,
  })
}

function shadowTokens(theme: Values): FoundationToken[] {
  const shadows: unknown[] = Array.isArray(theme.shadows) ? theme.shadows : []

  return shadows.flatMap((shadow, index) => {
    return typeof shadow === 'string'
      ? [token(`shadows.${index}`, 'shadows', 'shadow', shadow)]
      : []
  })
}

function motionTokens(theme: Values): FoundationToken[] {
  const transitions = objectAt(theme, 'transitions')

  return [
    ...scaleTokens('transitions.duration', objectAt(transitions, 'duration'), {
      group: 'motion',
      type: 'duration',
      unit: 'ms',
    }),
    ...scaleTokens('transitions.easing', objectAt(transitions, 'easing'), {
      group: 'motion',
      type: 'cubicBezier',
      unit: '',
    }),
  ]
}

/**
 * The tokens of a Material UI theme: the palette in its color schemes,
 * typography, spacing steps, the border radius, breakpoints, shadows,
 * z-indexes and transitions, each with its unit.
 */
export function muiThemeTokens(theme: Values): FoundationToken[] {
  return [
    ...paletteTokens(theme),
    ...typographyTokens(theme),
    ...spacingTokens(theme),
    ...shapeTokens(theme),
    ...breakpointTokens(theme),
    ...shadowTokens(theme),
    ...scaleTokens('zIndex', objectAt(theme, 'zIndex'), {
      group: 'other',
      type: 'number',
      unit: '',
    }),
    ...motionTokens(theme),
  ]
}
