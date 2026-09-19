import stylistic from '@stylistic/eslint-plugin'
import prettier from 'eslint-config-prettier'
import tseslint from 'typescript-eslint'

/**
 * Readability rules that Prettier does not cover. See STYLE.md for the why.
 * Formatting itself (quotes, semicolons, line width) is Prettier's job.
 */
export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.describe-me/**', '**/.vitest/**'] },
  ...tseslint.configs.recommended,
  // Prettier's config turns off every formatting rule, including `curly`,
  // so it must come before our block: later entries win.
  prettier,
  {
    files: ['**/*.{ts,tsx,js,mjs}'],
    plugins: { '@stylistic': stylistic },
    rules: {
      // Every block gets braces, even a one-line `if`. The braces show the scope.
      curly: ['error', 'all'],
      // A nested ternary is a puzzle, not an expression. Use if/else or a lookup.
      'no-nested-ternary': 'error',
      // Blank lines where the eye needs a pause: after imports, after any
      // multi-line block, before functions, classes and exports.
      '@stylistic/padding-line-between-statements': [
        'error',
        { blankLine: 'always', prev: 'import', next: '*' },
        { blankLine: 'any', prev: 'import', next: 'import' },
        { blankLine: 'always', prev: 'multiline-block-like', next: '*' },
        {
          blankLine: 'always',
          prev: ['multiline-const', 'multiline-let', 'multiline-expression'],
          next: '*',
        },
        { blankLine: 'always', prev: '*', next: ['function', 'class', 'export'] },
        { blankLine: 'any', prev: 'export', next: 'export' },
      ],
      // Methods in a class are separated by a blank line; one-line fields may sit together.
      '@stylistic/lines-between-class-members': [
        'error',
        'always',
        { exceptAfterSingleLine: true },
      ],
      // Names carry meaning; a single letter forces the reader to scroll back.
      // Loop counters `i`/`j` and the throwaway `_` are the only exceptions.
      'id-length': ['error', { min: 2, exceptions: ['i', 'j', '_'], properties: 'never' }],
      // `import type` for types, so the runtime dependency graph stays honest.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },
)
