/**
 * The images that `body` shows, by the `](./<file>)` of their Markdown image.
 * gh appends every attached file that the body does not reference, so only
 * these may be attached.
 */
export function shownImages(body, images) {
  return images.filter((image) => body.includes(`](./${image.file})`))
}
