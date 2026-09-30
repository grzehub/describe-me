import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { vendoredName } from './vendored-name.js'

/**
 * Write a file into `dir` under its content hash and return the name. Downloads
 * go into `assets/`, rewritten style chunks and CSS assets into their own directory.
 */
export function storeVendoredFile(dir: string, bytes: Uint8Array, extension: string): string {
  const name = vendoredName(bytes, extension)
  const target = join(dir, name)

  if (!existsSync(target)) {
    mkdirSync(dir, { recursive: true })
    writeFileSync(target, bytes)
  }

  return name
}
