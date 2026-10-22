---
'@describe-me/vitest': minor
---

A plain theme module's type styles are one token each. An object with a `fontSize` and at least one more of `fontFamily`, `fontWeight`, `lineHeight`, `letterSpacing` and `textTransform`, such as `typography.title`, becomes a typography token with its parts, as Material UI's variants are, so Foundations shows it as one sample line in the whole style. A number is in px for a size and a letter spacing, as React writes it, in Material UI's variants too. A weight or a line height written as a string, such as `'600'` or `'1.5'`, now counts as one when its path names it, where it used to land in Other.
