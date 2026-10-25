---
'@describe-me/vitest': patch
---

A run with TypeScript 7 installed no longer fails at its end. TypeScript 7, `latest` on npm since July, imports fine but has no compiler API that the props reader can use, and the reader threw: every test passed, yet Vitest reported an unhandled `TypeError` and exited with 1, and the reporter wrote no manifest. The reporter now warns once, `typescript 7.0.2 has no compiler API that describe-me can use, component props will not be documented`, and writes the manifest without props tables, as it does without TypeScript. Props tables still need TypeScript 5 or 6. Any other error while reading props warns with its message and leaves only the props out.
