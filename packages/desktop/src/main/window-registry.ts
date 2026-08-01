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
    return value.filter((id): id is string => typeof id === "string" && id.length > 0)
  }

  return {
    persisted,
    setQuitting(value = true) {
      quitting = value
    },
    register(id: string, win: W) {
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
