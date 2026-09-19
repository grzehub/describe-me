/** Cheap, non-cryptographic hash used to tell two captures apart. */
export function quickHash(s: string): string {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return `${s.length}:${h}`
}
