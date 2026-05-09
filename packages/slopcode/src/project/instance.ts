import { Log } from "@/util/log"
import { Context } from "../util/context"
import { Project } from "./project"
import { State } from "./state"
import { iife } from "@/util/iife"
import { GlobalBus } from "@/bus/global"
import { Filesystem } from "@/util/filesystem"

interface Context {
  directory: string
  viewID?: string
  worktree: string
  project: Project.Info
  shared: string
}
const context = Context.create<Context>("instance")
const cache = new Map<string, Promise<Context>>()
const counts = new Map<string, number>()

const disposal = {
  all: undefined as Promise<void> | undefined,
}

export const Instance = {
  key(directory: string, viewID?: string) {
    return `${directory}\n${viewID ?? "shared"}`
  },
  sharedKey(input: { directory: string; worktree: string; projectID: string }) {
    return `project:${input.projectID}\n${input.worktree === "/" ? input.directory : input.worktree}`
  },
  scope() {
    return Instance.key(Instance.directory, Instance.viewID)
  },
  sharedScope() {
    return context.use().shared
  },
  async provide<R>(input: { directory: string; viewID?: string; init?: () => Promise<any>; fn: () => R }): Promise<R> {
    const key = Instance.key(input.directory, input.viewID)
    let existing = cache.get(key)
    if (!existing) {
      Log.Default.info("creating instance", { directory: input.directory, viewID: input.viewID })
      existing = iife(async () => {
        const { project, sandbox } = await Project.fromDirectory(input.directory)
        const ctx = {
          directory: input.directory,
          viewID: input.viewID,
          worktree: sandbox,
          project,
          shared: Instance.sharedKey({ directory: input.directory, worktree: sandbox, projectID: project.id }),
        }
        await context.provide(ctx, async () => {
          await input.init?.()
        })
        counts.set(ctx.shared, (counts.get(ctx.shared) ?? 0) + 1)
        return ctx
      })
      cache.set(key, existing)
    }
    const ctx = await existing
    return context.provide(ctx, async () => {
      return input.fn()
    })
  },
  get directory() {
    return context.use().directory
  },
  get viewID() {
    return context.use().viewID
  },
  get worktree() {
    return context.use().worktree
  },
  get project() {
    return context.use().project
  },
  /**
   * Check if a path is within the project boundary.
   * Returns true if path is inside Instance.directory OR Instance.worktree.
   * Paths within the worktree but outside the working directory should not trigger external_directory permission.
   */
  containsPath(filepath: string) {
    if (Filesystem.contains(Instance.directory, filepath)) return true
    // Non-git projects set worktree to "/" which would match ANY absolute path.
    // Skip worktree check in this case to preserve external_directory permissions.
    if (Instance.worktree === "/") return false
    return Filesystem.contains(Instance.worktree, filepath)
  },
  state<S>(init: () => S, dispose?: (state: Awaited<S>) => Promise<void>): () => S {
    return State.create(() => Instance.scope(), init, dispose)
  },
  sharedState<S>(init: () => S, dispose?: (state: Awaited<S>) => Promise<void>): () => S {
    return State.create(() => Instance.sharedScope(), init, dispose)
  },
  async dispose() {
    const scope = Instance.scope()
    const shared = Instance.sharedScope()
    Log.Default.info("disposing instance", { directory: Instance.directory, viewID: Instance.viewID })
    await State.dispose(scope)
    cache.delete(scope)
    const count = counts.get(shared)
    if (count === 1) {
      counts.delete(shared)
      await State.dispose(shared)
    }
    if (count && count > 1) {
      counts.set(shared, count - 1)
    }
    GlobalBus.emit("event", {
      directory: Instance.directory,
      payload: {
        type: "server.instance.disposed",
        properties: {
          directory: Instance.directory,
          viewID: Instance.viewID,
        },
      },
    })
  },
  async disposeAll() {
    if (disposal.all) return disposal.all

    disposal.all = iife(async () => {
      Log.Default.info("disposing all instances")
      const entries = [...cache.entries()]
      for (const [key, value] of entries) {
        if (cache.get(key) !== value) continue

        const ctx = await value.catch((error) => {
          Log.Default.warn("instance dispose failed", { key, error })
          return undefined
        })

        if (!ctx) {
          if (cache.get(key) === value) cache.delete(key)
          continue
        }

        if (cache.get(key) !== value) continue

        await context.provide(ctx, async () => {
          await Instance.dispose()
        })
      }
    }).finally(() => {
      disposal.all = undefined
    })

    return disposal.all
  },
}
