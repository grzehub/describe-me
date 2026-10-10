/** What `__live.json` next to the viewer says about the live preview. */
export interface LivePreviewInfo {
  status: 'starting' | 'ready' | 'off' | 'error'
  /** The URL `live.html` is under, such as `http://localhost:5173/__describe-me/`. Only with `ready`. */
  base?: string
  /** Why the live preview did not start. Only with `error`. */
  error?: string
}
