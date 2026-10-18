import type { Plugin } from 'vite'

const SWATCH = '/live-fixtures/swatch.css'

function isSwatch(id: string): boolean {
  return id.split('?')[0].endsWith(SWATCH)
}

function appending(name: string, rule: string): Plugin {
  return {
    name,
    enforce: 'pre',
    transform(code, id) {
      if (!isSwatch(id)) {
        return null
      }

      return `${code}\n${rule}\n`
    },
  }
}

/**
 * A CSS generator split in two by `apply`, as `@tailwindcss/vite` is. Each
 * part adds its own rule to `swatch.css`, so the computed colours of
 * `.swatch` tell which parts ran.
 */
export function splitCssPlugin(): Plugin[] {
  return [
    {
      ...appending('split-css:serve', '.swatch { background-color: rgb(0, 128, 0) }'),
      apply: 'serve',
      // Reads the server as the serve half of @vitejs/plugin-react-swc does.
      transformIndexHtml(html, context) {
        if (context.server === undefined) {
          throw new Error('split-css: transformIndexHtml ran without a dev server')
        }

        return html
      },
    },
    {
      ...appending('split-css:build', '.swatch { background-color: rgb(255, 0, 0) }'),
      apply: 'build',
    },
    {
      ...appending('split-css:serve-function', '.swatch { color: rgb(0, 0, 255) }'),
      apply: (_, env) => env.command === 'serve',
    },
  ]
}
