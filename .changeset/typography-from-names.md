---
'describe-me': minor
---

Foundations reads a typography part from a custom property's name wherever it sits: `font-family`, `font-weight`, `font-size`, `line-height` and `letter-spacing`, also in camelCase, in the plural or as one word. Each such row paints its sample, so `--font-size-lg`, `--chakra-font-sizes-md`, `--line-height-tight` and `--letter-spacing-wide` show a line at that size, leading or tracking. The part wins over the Tailwind prefixes, so `--font-size-lg` is a size and no longer a font family.

Custom properties that end in a part and share the name before it, as Style Dictionary and Tokens Studio write them, form one type style: `--type-title-font-size`, `--type-title-line-height` and `--type-title-font-weight` show as `--type-title-*`, one sample line in the whole style with its parts under it. A style needs a font size and one other part. The token filter finds a style by the name of any of its custom properties.
