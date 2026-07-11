export * as PluginServer from "./plugin"

import { Layer } from "effect"
import { PluginPackage } from "@slopcode-ai/core/plugin/package"

const workspaces = new Map<string, Map<string, unknown>>()

export function workspace(projectID: string, type: string) {
  return workspaces.get(projectID)?.get(type)
}

export function layer(input: { readonly baseUrl: URL | (() => URL); readonly fetch: PluginPackage.Fetch }) {
  return Layer.succeed(
    PluginPackage.Host,
    PluginPackage.Host.of({
      baseUrl: input.baseUrl,
      fetch: input.fetch,
      register(projectID, type, adapter) {
        const project = workspaces.get(projectID) ?? new Map<string, unknown>()
        project.set(type, adapter)
        workspaces.set(projectID, project)
      },
    }),
  )
}
