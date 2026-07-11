export * as PluginServer from "./plugin"

import { Effect, Layer } from "effect"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"

type Entry = { readonly token: symbol; readonly adapter: unknown }

export function runtime(input: {
  readonly baseUrl: URL | (() => URL)
  readonly fetch: PluginPackage.Fetch
  readonly register?: (projectID: string, type: string, adapter: unknown) => () => void
}) {
  const workspaces = new Map<string, Map<string, Entry[]>>()
  const owned = new Set<() => void>()
  let closed = false
  const register = (projectID: string, type: string, adapter: unknown) => {
    if (closed) return () => {}
    const token = Symbol(type)
    const project = workspaces.get(projectID) ?? new Map<string, Entry[]>()
    project.set(type, [...(project.get(type) ?? []), { token, adapter }])
    workspaces.set(projectID, project)
    const release = input.register?.(projectID, type, adapter)
    const cleanup = () => {
      if (!owned.delete(cleanup)) return
      const entries =
        workspaces
          .get(projectID)
          ?.get(type)
          ?.filter((entry) => entry.token !== token) ?? []
      if (entries.length) workspaces.get(projectID)?.set(type, entries)
      if (!entries.length) workspaces.get(projectID)?.delete(type)
      if (workspaces.get(projectID)?.size === 0) workspaces.delete(projectID)
      release?.()
    }
    owned.add(cleanup)
    return cleanup
  }
  const layer = Layer.effect(
    PluginPackage.Host,
    Effect.gen(function* () {
      yield* Effect.addFinalizer(() =>
        Effect.sync(() => {
          closed = true
          Array.from(owned)
            .toReversed()
            .forEach((cleanup) => cleanup())
        }),
      )
      return PluginPackage.Host.of({
        baseUrl: input.baseUrl,
        fetch: input.fetch,
        register,
      })
    }),
  )
  return {
    layer,
    register,
    workspace: (projectID: string, type: string) => workspaces.get(projectID)?.get(type)?.at(-1)?.adapter,
  }
}

export function layer(input: {
  readonly baseUrl: URL | (() => URL)
  readonly fetch: PluginPackage.Fetch
  readonly register?: (projectID: string, type: string, adapter: unknown) => () => void
}) {
  return runtime(input).layer
}
