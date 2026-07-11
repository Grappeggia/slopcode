export * as PluginServer from "./plugin"

import { Effect, Layer } from "effect"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"

type Entry = { readonly token: symbol; readonly adapter: unknown }
const workspaces = new Map<string, Map<string, Entry[]>>()

export function workspace(projectID: string, type: string) {
  return workspaces.get(projectID)?.get(type)?.at(-1)?.adapter
}

export function layer(input: { readonly baseUrl: URL | (() => URL); readonly fetch: PluginPackage.Fetch }) {
  return Layer.effect(
    PluginPackage.Host,
    Effect.gen(function* () {
      const owned = new Set<() => void>()
      yield* Effect.addFinalizer(() => Effect.sync(() => [...owned].toReversed().forEach((cleanup) => cleanup())))
      return PluginPackage.Host.of({
        baseUrl: input.baseUrl,
        fetch: input.fetch,
        register(projectID, type, adapter) {
          const token = Symbol(type)
          const project = workspaces.get(projectID) ?? new Map<string, Entry[]>()
          project.set(type, [...(project.get(type) ?? []), { token, adapter }])
          workspaces.set(projectID, project)
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
          }
          owned.add(cleanup)
          return cleanup
        },
      })
    }),
  )
}
