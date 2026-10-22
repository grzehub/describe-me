/** The panels on either side of the center that the reader can hide. */
export type SidePanel = 'sidebar' | 'inspector'

const instances = new Map<string, PanelChoice>()

/**
 * Whether the reader showed or hid the sidebar and the inspector, kept in
 * `localStorage` per project, like the sidebar width. Without storage it still
 * works for the page's lifetime.
 */
export class PanelChoice {
  private readonly storageKey: string
  private choices: Partial<Record<SidePanel, boolean>>

  private constructor(root: string) {
    this.storageKey = `describe-me:panels:${root}`
    this.choices = this.load()
  }

  /** The one instance for a project. */
  static for(root: string): PanelChoice {
    let choice = instances.get(root)
    if (!choice) {
      choice = new PanelChoice(root)
      instances.set(root, choice)
    }

    return choice
  }

  /** What the reader chose for the panel, or `undefined` before they chose. */
  get(panel: SidePanel): boolean | undefined {
    return this.choices[panel]
  }

  set(panel: SidePanel, shown: boolean): void {
    this.choices = { ...this.choices, [panel]: shown }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.choices))
    } catch {
      // Private mode, quota or a sandbox: the instance still remembers.
    }
  }

  private load(): Partial<Record<SidePanel, boolean>> {
    try {
      const stored: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? '{}')

      if (typeof stored !== 'object' || stored === null) {
        return {}
      }

      const { sidebar, inspector } = stored as Record<string, unknown>

      return {
        ...(typeof sidebar === 'boolean' ? { sidebar } : {}),
        ...(typeof inspector === 'boolean' ? { inspector } : {}),
      }
    } catch {
      return {}
    }
  }
}
