/** What `__live.json` next to the viewer says about the live preview. */
export interface LivePreviewInfo {
  status: 'starting' | 'ready' | 'off' | 'error'
  /**
   * The URL `live.html` is under, relative to `__live.json` or absolute:
   * `__live/` on a static site, `__describe-me/` under `describe-me dev`,
   * which serves the preview through its own port, or the preview's own
   * `http://localhost:5173/__describe-me/` when its server is of an earlier
   * version. Only with `ready`.
   */
  base?: string
  /** Why the live preview did not start. Only with `error`. */
  error?: string
}
