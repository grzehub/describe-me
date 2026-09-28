import type { VendorReport } from './vendor-fonts.js'

const MAX_FAILURE_LINES = 5

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

function size(bytes: number): string {
  if (bytes < 1_000_000) {
    return `${Math.round(bytes / 1000)} kB`
  }

  return `${(bytes / 1_000_000).toFixed(1)} MB`
}

function summary(report: VendorReport): string {
  const parts = report.stylesheets.map(({ host, count }) => {
    return `${plural(count, 'stylesheet')} from ${host}`
  })

  parts.push(`${plural(report.fontFiles, 'font file')} (${size(report.fontBytes)})`)
  const last = parts.pop()
  const listed = parts.length === 0 ? last : `${parts.join(', ')} and ${last}`

  return `describe-me: vendored ${listed} into __data/assets`
}

/** Tell the user what `describe-me build` vendored and what keeps loading from the network. */
export function printVendorReport(report: VendorReport): void {
  if (report.stylesheets.length > 0 || report.fontFiles > 0) {
    console.log(summary(report))
  }

  for (const { host, reason } of report.leftRemote) {
    console.log(`describe-me: left remote: ${host} (${reason})`)
  }

  for (const { url, reason } of report.failures.slice(0, MAX_FAILURE_LINES)) {
    console.warn(
      `describe-me: ${url} did not download (${reason}). It keeps loading from the network.`,
    )
  }

  const more = report.failures.length - MAX_FAILURE_LINES
  if (more > 0) {
    console.warn(`describe-me: and ${more} more that did not download.`)
  }
}
