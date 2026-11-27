import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Manifest } from '@describe-me/core/types'
import { isOutside } from './is-outside.js'

/** A data directory that the reporter wrote, with its manifest. */
export interface DiffRun {
  /** The directory as the user typed it. */
  dir: string
  /** `<dir>/manifest.json`, for messages. */
  manifestPath: string
  manifest: Manifest
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isFrame(value: unknown): boolean {
  return isObject(value) && typeof value.snapshot === 'string'
}

function isTest(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    Array.isArray(value.path) &&
    typeof value.fullName === 'string' &&
    Array.isArray(value.frames) &&
    value.frames.every(isFrame)
  )
}

function isModule(value: unknown): boolean {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    Array.isArray(value.tests) &&
    value.tests.every(isTest)
  )
}

function isManifest(value: unknown): value is Manifest {
  return (
    isObject(value) &&
    value.version === 1 &&
    Array.isArray(value.modules) &&
    value.modules.every(isModule)
  )
}

function parseManifest(manifestPath: string): unknown {
  let text: string

  try {
    text = readFileSync(manifestPath, 'utf8')
  } catch {
    throw new Error(`cannot read ${manifestPath}`)
  }

  try {
    return JSON.parse(text)
  } catch {
    // V8's message quotes a piece of the file.
    throw new Error(`cannot read ${manifestPath}: not valid JSON`)
  }
}

/**
 * Read and check `<dir>/manifest.json` for `describe-me diff`. A problem
 * throws a message with the paths as the user typed them. A manifest without
 * `components` gets an empty one.
 */
export function readRun(dir: string): DiffRun {
  const manifestPath = join(dir, 'manifest.json')

  if (!existsSync(manifestPath)) {
    throw new Error(`no manifest at ${manifestPath}`)
  }

  const manifest = parseManifest(manifestPath)

  if (!isManifest(manifest)) {
    throw new Error(`${manifestPath} is not a describe-me manifest`)
  }

  for (const mod of manifest.modules) {
    for (const test of mod.tests) {
      for (const frame of test.frames) {
        if (isOutside(dir, frame.snapshot)) {
          throw new Error(`${manifestPath} names a snapshot outside ${dir}`)
        }
      }
    }
  }

  if (!isObject(manifest.components)) {
    manifest.components = {}
  }

  return { dir, manifestPath, manifest }
}
