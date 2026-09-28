import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { vendoredName } from './vendored-name.js'

/** Write a downloaded file into `assets/` under its content hash and return the name. */
export function storeVendoredFile(assetsDir: string, bytes: Uint8Array, extension: string): string {
  const name = vendoredName(bytes, extension)
  const target = join(assetsDir, name)

  if (!existsSync(target)) {
    mkdirSync(assetsDir, { recursive: true })
    writeFileSync(target, bytes)
  }

  return name
}
