const instances = new Map<string, SidebarWidth>()

/**
 * The sidebar width the reader chose, kept in `localStorage` per project
 * because several projects share `localhost:6006`. Without storage it still
 * works for the page's lifetime.
 */
export class SidebarWidth {
  static readonly DEFAULT = 296
  /** Five steps below the default, so the keyboard gets back to it exactly. */
  static readonly MIN = 216
  static readonly STEP = 16

  private readonly storageKey: string
  private width: number

  private constructor(root: string) {
    this.storageKey = `describe-me:sidebar:${root}`
    this.width = this.load()
  }

  /** The one instance for a project. */
  static for(root: string): SidebarWidth {
    let width = instances.get(root)
    if (!width) {
      width = new SidebarWidth(root)
      instances.set(root, width)
    }

    return width
  }

  /** Half the window, but never below the default, so a narrow window keeps the layout it has. */
  static max(): number {
    return Math.max(SidebarWidth.DEFAULT, Math.floor(window.innerWidth / 2))
  }

  /** A whole number of pixels the current window allows. */
  static clamp(width: number): number {
    return Math.min(SidebarWidth.max(), Math.max(SidebarWidth.MIN, Math.round(width)))
  }

  /** The chosen width, unclamped, so a window that grows again brings it back. */
  get(): number {
    return this.width
  }

  set(width: number): void {
    this.width = width
  }

  save(): void {
    try {
      localStorage.setItem(this.storageKey, String(this.width))
    } catch {
      // Private mode, quota or a sandbox: the instance still remembers.
    }
  }

  reset(): void {
    this.width = SidebarWidth.DEFAULT

    try {
      localStorage.removeItem(this.storageKey)
    } catch {
      // As in save().
    }
  }

  private load(): number {
    try {
      const stored = Number(localStorage.getItem(this.storageKey))

      return Number.isFinite(stored) && stored > 0 ? stored : SidebarWidth.DEFAULT
    } catch {
      return SidebarWidth.DEFAULT
    }
  }
}
