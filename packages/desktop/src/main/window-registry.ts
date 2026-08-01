const windowIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/

export function isWindowId(value: unknown): value is string {
  return typeof value === "string" && windowIdPattern.test(value)
}

export function createWindowRegistry<W>(persistence: {
  read: () => unknown
  write: (ids: string[]) => void
  cleanup: (id: string) => void
}) {
  const windows = new Map<string, W>()
  let quitting = false
  let focused: string | undefined

  const persisted = () => {
    const value = persistence.read()
    if (!Array.isArray(value)) return []
    const ids = value.filter(isWindowId).filter((id, index, all) => all.indexOf(id) === index)
    if (value.length !== ids.length || value.some((id, index) => id !== ids[index])) persistence.write(ids)
    return ids
  }

  return {
    persisted,
    setQuitting(value = true) {
      quitting = value
    },
    register(id: string, win: W) {
      if (!isWindowId(id)) throw new Error("Invalid window id")
      windows.set(id, win)
      const ids = persisted()
      if (!ids.includes(id)) persistence.write([...ids, id])
    },
    focused(id: string) {
      focused = id
    },
    lastFocused() {
      if (!focused) return
      return windows.get(focused)
    },
    closed(id: string) {
      windows.delete(id)
      if (focused === id) focused = windows.keys().next().value
      if (quitting || windows.size === 0) return
      persistence.write(persisted().filter((item) => item !== id))
      persistence.cleanup(id)
    },
  }
}
