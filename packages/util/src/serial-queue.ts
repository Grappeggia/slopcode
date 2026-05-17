type Item = {
  key: string
  ready: () => boolean
  done: () => boolean
  run: () => Promise<void>
  refresh?: () => Promise<void> | void
  reject?: (error: unknown) => void
}

type Entry<T extends Item> = {
  active?: T
  paused?: T
  queue: T[]
  running: boolean
}

type Snapshot<T extends Item> = {
  active?: T
  paused?: T
  queue: T[]
}

export function createSerialQueue<T extends Item>(input?: { poll_ms?: number; refresh_ms?: number }) {
  const poll = input?.poll_ms ?? 32
  const refresh = input?.refresh_ms ?? 2_000
  const state = new Map<string, Entry<T>>()
  const listeners = new Set<(key: string, snapshot: Snapshot<T>) => void>()
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))
  const update = async (item: T, time: number) => {
    if (!item.refresh) return time
    const now = Date.now()
    if (now - time < refresh) return time
    await Promise.resolve(item.refresh()).catch(() => {})
    return now
  }
  const read = (key: string) => {
    const match = state.get(key)
    return {
      active: match?.active,
      paused: match?.paused,
      queue: match ? [...match.queue] : [],
    }
  }

  const notify = (key: string) => {
    const next = read(key)
    listeners.forEach((listener) => listener(key, next))
  }

  const ensure = (key: string) => {
    const match = state.get(key)
    if (match) return match
    const next: Entry<T> = {
      queue: [],
      running: false,
    }
    state.set(key, next)
    return next
  }

  const trim = (key: string) => {
    const match = state.get(key)
    if (!match || match.running || match.active || match.paused || match.queue.length > 0) return
    state.delete(key)
  }

  const reject = (items: T[], error: unknown) => {
    items.forEach((item) => item.reject?.(error))
  }

  const drain = async (key: string) => {
    const entry = ensure(key)
    if (entry.running) return
    entry.running = true

    let pending: T | undefined
    let refreshed = Date.now()

    try {
      while (entry.active || entry.paused || entry.queue.length > 0) {
        if (entry.active) {
          const current = entry.active
          let last = Date.now()
          while (entry.active === current && !current.done()) {
            last = await update(current, last)
            await sleep(poll)
          }
          if (entry.active === current) {
            entry.active = undefined
            notify(key)
          }
          continue
        }

        if (entry.paused) {
          await sleep(poll)
          continue
        }

        const next = entry.queue[0]
        if (!next) continue
        if (!next.ready()) {
          if (pending !== next) {
            pending = next
            refreshed = Date.now()
          }
          refreshed = await update(next, refreshed)
          await sleep(poll)
          continue
        }

        entry.queue.shift()
        pending = undefined
        entry.active = next
        notify(key)
        await next.run().catch((error) => {
          if (entry.active === next) {
            entry.active = undefined
            notify(key)
          }
          next.reject?.(error)
        })
      }
    } finally {
      entry.running = false
      trim(key)
      if (entry.active || entry.queue.length > 0) void drain(key)
    }
  }

  return {
    push(item: T) {
      ensure(item.key).queue.push(item)
      notify(item.key)
      void drain(item.key)
    },
    unshift(item: T) {
      ensure(item.key).queue.unshift(item)
      notify(item.key)
      void drain(item.key)
    },
    pause(key: string) {
      const entry = state.get(key)
      if (!entry?.active) return
      entry.paused = entry.active
      entry.active = undefined
      notify(key)
      return entry.paused
    },
    setPaused(item: T) {
      const entry = ensure(item.key)
      entry.paused = item
      notify(item.key)
      void drain(item.key)
      return entry.paused
    },
    resume(key: string) {
      const entry = state.get(key)
      if (!entry?.paused || entry.active) return
      entry.active = entry.paused
      entry.paused = undefined
      notify(key)
      void drain(key)
      return entry.active
    },
    clearPaused(key: string) {
      const entry = state.get(key)
      if (!entry?.paused) return
      const item = entry.paused
      entry.paused = undefined
      notify(key)
      trim(key)
      void drain(key)
      return item
    },
    clear(key: string, input?: { active?: boolean; error?: unknown }) {
      const entry = state.get(key)
      if (!entry) return [] as T[]
      const error = input?.error ?? new DOMException("Aborted", "AbortError")
      const removed = entry.queue.splice(0)
      if (input?.active) entry.active = undefined
      reject(removed, error)
      notify(key)
      trim(key)
      return removed
    },
    remove(key: string, match: (item: T) => boolean, input?: { error?: unknown }) {
      const entry = state.get(key)
      if (!entry) return [] as T[]
      const error = input?.error ?? new DOMException("Aborted", "AbortError")
      const removed = entry.queue.filter(match)
      if (removed.length === 0) return [] as T[]
      entry.queue = entry.queue.filter((item) => !match(item))
      reject(removed, error)
      notify(key)
      trim(key)
      return removed
    },
    busy(key: string) {
      const entry = state.get(key)
      return !!entry && (!!entry.active || !!entry.paused || entry.queue.length > 0)
    },
    queued(key: string) {
      return state.get(key)?.queue.length ?? 0
    },
    snapshot(key: string) {
      return read(key)
    },
    subscribe(listener: (key: string, snapshot: Snapshot<T>) => void) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
