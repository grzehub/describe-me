const instances = new Map<string, CollapsedSuites>()

/**
 * The sidebar's collapsed modules and suites, by `suiteKey()`, kept in
 * `localStorage` per project root because several projects share
 * `localhost:6006`. Without storage it still works for the page's lifetime.
 */
export class CollapsedSuites {
  private readonly storageKey: string
  private readonly keys: Set<string>

  private constructor(root: string) {
    this.storageKey = `describe-me:collapsed:${root}`
    this.keys = new Set(this.load())
  }

  /** The one instance for a project root. */
  static for(root: string): CollapsedSuites {
    let collapsed = instances.get(root)
    if (!collapsed) {
      collapsed = new CollapsedSuites(root)
      instances.set(root, collapsed)
    }

    return collapsed
  }

  has(key: string): boolean {
    return this.keys.has(key)
  }

  toggle(key: string): void {
    if (!this.keys.delete(key)) {
      this.keys.add(key)
    }

    this.save()
  }

  expand(keys: Iterable<string>): void {
    let changed = false
    for (const key of keys) {
      changed = this.keys.delete(key) || changed
    }

    if (changed) {
      this.save()
    }
  }

  private load(): string[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(this.storageKey) ?? '[]')

      return Array.isArray(parsed)
        ? parsed.filter((key): key is string => typeof key === 'string')
        : []
    } catch {
      return []
    }
  }

  private save(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.keys]))
    } catch {
      // Private mode, quota or a sandbox: the instance still remembers.
    }
  }
}
