import { fileURLToPath } from 'node:url'

/** The package directory that holds `index.html`, `src/` and `vite.config.ts`. */
export function viewerRoot(): string {
  return fileURLToPath(new URL('..', import.meta.url))
}
