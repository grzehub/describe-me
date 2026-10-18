/**
 * Fit a specimen frame to its content's bottom edge. `scrollHeight` cannot
 * measure it, because it never reports less than the frame's own height.
 */
export function fitFrame(iframe: HTMLIFrameElement): void {
  const root = iframe.contentDocument?.querySelector('.fd-root')

  if (!iframe.isConnected || !root) {
    return
  }

  iframe.style.height = `${Math.ceil(root.getBoundingClientRect().bottom)}px`
}
