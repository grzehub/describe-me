import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/** The repository root, so the docs scripts work from any working directory. */
export const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
