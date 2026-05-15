import { Instance } from "@/project/instance"

export namespace BackgroundJob {
  export type Status = "running" | "completed" | "error" | "cancelled"

  export type Info = {
    id: string
    type: string
    title: string
    status: Status
    metadata: Record<string, unknown>
    started: number
    updated: number
    output?: string
    error?: string
  }

  const state = Instance.sharedState(() => new Map<string, Info>())
  const waiters = new Map<string, Set<() => void>>()

  function notify(id: string) {
    for (const waiter of waiters.get(id) ?? []) waiter()
  }

  function update(id: string, patch: Partial<Info>) {
    const current = state().get(id)
    if (!current) return
    state().set(id, {
      ...current,
      ...patch,
      updated: Date.now(),
    })
    notify(id)
  }

  export function get(id: string) {
    return state().get(id)
  }

  export async function start(input: {
    id: string
    type: string
    title: string
    metadata: Record<string, unknown>
    run: () => Promise<string>
  }) {
    const existing = state().get(input.id)
    if (existing?.status === "running") return existing

    const info: Info = {
      id: input.id,
      type: input.type,
      title: input.title,
      status: "running",
      metadata: input.metadata,
      started: Date.now(),
      updated: Date.now(),
    }
    state().set(input.id, info)

    input
      .run()
      .then((output) => update(input.id, { status: "completed", output }))
      .catch((error) =>
        update(input.id, {
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        }),
      )

    return info
  }

  export async function wait(input: { id: string; timeout?: number }) {
    const timeout = input.timeout ?? 60_000
    const started = Date.now()

    while (true) {
      const info = get(input.id)
      if (info && info.status !== "running") return { info, timedOut: false }
      if (Date.now() - started >= timeout) return { info, timedOut: true }

      await new Promise<void>((resolve) => {
        const set = waiters.get(input.id) ?? new Set<() => void>()
        waiters.set(input.id, set)
        const done = () => {
          clearTimeout(timer)
          set.delete(done)
          resolve()
        }
        const timer = setTimeout(done, Math.min(300, timeout))
        set.add(done)
      })
    }
  }
}
