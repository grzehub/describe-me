import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { normalizePath, type Plugin } from 'vite'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { playwright } from '@vitest/browser-playwright'
import { describeMe } from '@describe-me/vitest/plugin'

// SHADCN_CHANGED=1 records the same tests as a later version of the project would, for
// `describe-me diff`: Button's default size is lg, and Badge has one more class with a rule of
// its own in src/index.css. The files on disk stay as they are. It writes to an output directory
// of its own, so `.describe-me/` keeps the default run. Tailwind reads this file for class names
// as well, so a word here that names one of its utilities would change the default run.
const changed = Boolean(process.env.SHADCN_CHANGED)

if (changed && process.env.SHADCN_CHANGED !== '1') {
  throw new Error(`SHADCN_CHANGED: unknown value "${process.env.SHADCN_CHANGED}", expected 1`)
}

function source(path: string): string {
  return normalizePath(fileURLToPath(new URL(path, import.meta.url)))
}

// A source that no longer has the text must fail the run, or it would record the default one.
function replaced(code: string, before: string, after: string): string {
  if (!code.includes(before)) {
    throw new Error(`SHADCN_CHANGED: a source no longer has ${before}`)
  }

  return code.replace(before, after)
}

const edits = new Map<string, (code: string) => string>([
  [
    source('./src/components/ui/button.tsx'),
    (code) => replaced(code, "size = 'default'", "size = 'lg'"),
  ],
  [
    source('./src/components/ui/badge.tsx'),
    (code) =>
      replaced(
        code,
        'cn(badgeVariants({ variant }), className)',
        "cn(badgeVariants({ variant }), 'badge-spaced', className)",
      ),
  ],
  [source('./src/index.css'), (code) => `${code}\n.badge-spaced {\n  letter-spacing: 0.08em;\n}\n`],
])

// It loads the edited files before any other plugin reads them, so Tailwind compiles the edited
// stylesheet. A load hook, because the name of the hook that usually edits code is a Tailwind
// utility. It is there in every run, because Vite bundles the dependencies again when the plugin
// names change, which can reload a browser run midway.
function changedSources(): Plugin {
  return {
    name: 'shadcn-changed-sources',
    enforce: 'pre',
    load(id) {
      const path = id.split('?')[0]
      const edit = edits.get(path)

      return changed && edit !== undefined ? edit(readFileSync(path, 'utf8')) : undefined
    },
  }
}

// A shadcn/ui project on Tailwind 4, as `npx shadcn init` sets it up for Vite. The setup
// file imports src/index.css for every test file, as the app's entry would. The sidebar
// mirrors src/components: the shadcn primitives under ui, the app's own component next to them.
export default defineConfig({
  plugins: [
    changedSources(),
    react(),
    tailwindcss(),
    describeMe({
      sidebar: {
        groups: {
          'Components/ui': 'src/components/ui/*.test.tsx',
          Components: 'src/components/*.test.tsx',
        },
      },
      ...(changed ? { outDir: 'node_modules/.describe-me-changed' } : {}),
    }),
  ],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['src/**/*.test.tsx'],
    setupFiles: ['./src/test-setup.ts'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
    },
  },
})
