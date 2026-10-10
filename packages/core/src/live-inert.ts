let inert: unknown

function createInert(): unknown {
  // A plain function, so the value can be called and constructed.
  const value: unknown = new Proxy(function inertTarget() {}, {
    get(_target, key) {
      if (key === 'then') {
        return undefined
      }

      if (key === Symbol.toPrimitive) {
        return () => ''
      }

      if (key === Symbol.iterator) {
        return () => [][Symbol.iterator]()
      }

      return value
    },
    apply() {
      return value
    },
    construct() {
      return value as object
    },
  })

  return value
}

/**
 * A value that takes any property access, call or `new` and gives back an
 * inert value again. Test code after the first render never runs, but it must
 * import, and hooks may call it. `await` ends on it, because it has no `then`.
 */
export function liveInert(): unknown {
  inert ??= createInert()

  return inert
}
