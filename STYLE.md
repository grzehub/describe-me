# Code style

Code here is written for people first. Machines read anything. Humans need
light, rhythm and visible structure. Most of this is enforced by Prettier and
ESLint (`pnpm lint:fix`), the rest is judgement.

## Enforced

- **Braces on every block.** `if (x) { return }` on three lines, never
  `if (x) return`. The braces draw the scope. (`curly: all`)
- **Blank lines where the eye needs a pause.** After the import block, after any
  multi-line block or multi-line statement, before every function, class and
  export. (`padding-line-between-statements`)
- **One blank line between class members**, one-line fields may sit together.
- **No nested ternaries.** Use `if`/`else` or a lookup table.
- **No single-letter names.** `pending` instead of `p`, `frame` instead of `f`,
  `(key, value)` instead of `(k, v)`. A name should still mean something twenty
  lines below its declaration. Loop counters `i`/`j` and the throwaway `_` are
  the only exceptions. (`id-length`)
- **`import type` for types.** The runtime dependency graph stays honest.
- Prettier: no semicolons, single quotes, 100 columns, trailing commas.

## By judgement

- **One exported function or class per file**, named after it in kebab-case.
  Private helpers may live next to the thing they help. Each package has a
  barrel `index.ts` that only re-exports.
- **A doc comment on every export** saying what it is for, not what it does
  line by line. Comments inside a body explain a decision or a gotcha
  (rrweb ids, Playwright actionability), not the obvious.
- **Short functions, flat bodies.** Prefer an early `return` over nesting.
  If a function needs a second screen, it wants to be two functions.
- **Names over comments.** `settle()` beats `// wait for React`.
- **No cleverness in the hot path.** The recorder runs inside every test, so
  it should read like a checklist.
- English everywhere in code, comments and docs.

## Prose

Comments, docs, changesets and PR descriptions follow the same idea: they are
written for people and are no longer than they need to be.

- **Comment the why, not the what.** A comment earns its place by explaining a
  decision, a constraint or a gotcha that the code cannot show. Never restate
  the code or narrate the change ("added", "now", "new"). If a reader would
  delete the comment, leave it out.
- **Short sentences, plain words.** A doc comment is one or two sentences
  unless the API really needs more.
- **Periods, not semicolons.** End the sentence and start a new one, or use a
  comma or a list.

## Public API

The exports of each entry point are the contract. Adding is fine. Renaming or
removing needs a note in the PR and a changelog line.
