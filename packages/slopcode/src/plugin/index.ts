import type { Hooks, PluginInput, Plugin as PluginInstance, PluginModule } from "@slopcode-ai/plugin"
import { Config } from "../config/config"
import { Bus } from "../bus"
import { Log } from "../util/log"
import { createSlopcodeClient } from "@slopcode-ai/sdk"
import { Server } from "../server/server"
import { Instance } from "../project/instance"
import { Flag } from "../flag/flag"
import { CodexAuthPlugin } from "./codex"
import { Session } from "../session"
import { NamedError } from "@slopcode-ai/util/error"
import { CopilotAuthPlugin } from "./copilot"
import { GitlabAuthPlugin } from "./gitlab"
import { registerAdaptor } from "../control-plane/adaptors"
import { PluginLoader } from "./loader"
import { parsePluginSpecifier, readPluginId, readV1Plugin, resolvePluginId } from "./shared"

export namespace Plugin {
  const log = Log.create({ service: "plugin" })

  const BUILTIN = ["slopcode-anthropic-auth@0.0.13"]

  const INTERNAL_PLUGINS: PluginInstance[] = [
    CodexAuthPlugin,
    CopilotAuthPlugin,
    GitlabAuthPlugin as unknown as PluginInstance,
  ]

  function message(error: unknown) {
    if (error instanceof Error) return error.message
    return String(error)
  }

  function publishPluginError(text: string) {
    Bus.publish(Session.Event.Error, {
      error: new NamedError.Unknown({ message: text }).toObject(),
    })
  }

  function isServerPlugin(value: unknown): value is PluginInstance {
    return typeof value === "function"
  }

  function getServerPlugin(value: unknown) {
    if (isServerPlugin(value)) return value
    if (!value || typeof value !== "object" || !("server" in value)) return
    if (!isServerPlugin(value.server)) return
    return value.server
  }

  function getLegacyPlugins(mod: Record<string, unknown>) {
    const seen = new Set<unknown>()
    const result: PluginInstance[] = []
    for (const entry of Object.values(mod)) {
      if (seen.has(entry)) continue
      seen.add(entry)
      const plugin = getServerPlugin(entry)
      if (!plugin) throw new TypeError("Plugin export is not a function")
      result.push(plugin)
    }
    return result
  }

  async function applyPlugin(load: PluginLoader.Loaded, input: PluginInput, hooks: Hooks[]) {
    const plugin = readV1Plugin(load.mod, load.spec, "server", "detect")
    if (plugin) {
      await resolvePluginId(load.source, load.spec, load.target, readPluginId(plugin.id, load.spec), load.pkg)
      if (typeof plugin.server !== "function") throw new TypeError(`Plugin ${load.spec} must export server()`)
      hooks.push(await plugin.server(input, load.options))
      return
    }


    for (const server of getLegacyPlugins(load.mod)) {
      hooks.push(await server(input, load.options))
    }
  }

  const state = Instance.state(async () => {
    const client = createSlopcodeClient({
      baseUrl: "http://localhost:4096",
      directory: Instance.directory,
      // @ts-ignore - fetch type incompatibility
      fetch: async (...args) => Server.App().fetch(...args),
    })
    const config = await Config.get()
    const hooks: Hooks[] = []
    const input: PluginInput = {
      client,
      project: Instance.project,
      worktree: Instance.worktree,
      directory: Instance.directory,
      experimental_workspace: {
        register(type, adaptor) {
          registerAdaptor(Instance.project.id, type, adaptor as never)
        },
      },
      serverUrl: Server.url(),
      $: Bun.$,
    }

    for (const plugin of INTERNAL_PLUGINS) {
      log.info("loading internal plugin", { name: plugin.name })
      const init = await plugin(input).catch((err) => {
        log.error("failed to load internal plugin", { name: plugin.name, error: err })
      })
      if (init) hooks.push(init)
    }

    const external = Flag.SLOPCODE_PURE ? [] : (config.plugin_origins ?? [])
    if (Flag.SLOPCODE_PURE && (config.plugin?.length || !Flag.SLOPCODE_DISABLE_DEFAULT_PLUGINS)) {
      log.info("skipping external plugins in pure mode", {
        count: (config.plugin?.length ?? 0) + (Flag.SLOPCODE_DISABLE_DEFAULT_PLUGINS ? 0 : BUILTIN.length),
      })
    }

    const items = Flag.SLOPCODE_DISABLE_DEFAULT_PLUGINS || Flag.SLOPCODE_PURE
      ? external
      : [
          ...BUILTIN.map((spec) => ({ spec, source: "", scope: "global" as const })),
          ...external,
        ]

    if (items.length) await Config.waitForDependencies()

    const loaded = await PluginLoader.loadExternal({
      items,
      kind: "server",
      report: {
        start(candidate) {
          log.info("loading plugin", { path: candidate.plan.spec })
        },
        missing(candidate, _retry, text) {
          log.warn("plugin has no server entrypoint", { path: candidate.plan.spec, message: text })
        },
        error(candidate, _retry, stage, error, resolved) {
          const spec = candidate.plan.spec
          const cause = error instanceof Error ? (error.cause ?? error) : error
          const detail = message(cause)
          if (stage === "install") {
            const parsed = parsePluginSpecifier(spec)
            log.error("failed to install plugin", { pkg: parsed.pkg, version: parsed.version, error: detail })
            publishPluginError(`Failed to install plugin ${parsed.pkg}@${parsed.version}: ${detail}`)
            return
          }
          if (stage === "entry") {
            log.error("failed to resolve plugin server entry", { path: spec, error: detail })
            publishPluginError(`Failed to load plugin ${spec}: ${detail}`)
            return
          }
          log.error("failed to load plugin", { path: spec, target: resolved?.entry, error: detail })
          publishPluginError(`Failed to load plugin ${spec}: ${detail}`)
        },
      },
    })

    for (const load of loaded) {
      await applyPlugin(load, input, hooks).catch((err) => {
        const detail = message(err)
        log.error("failed to load plugin", { path: load.spec, error: detail })
        publishPluginError(`Failed to load plugin ${load.spec}: ${detail}`)
      })
    }

    return {
      hooks,
      input,
    }
  })

  type HookName = Exclude<keyof Required<Hooks>, "auth" | "event" | "tool" | "provider" | "config">
  export async function trigger<
    Name extends HookName,
    Input = Parameters<Extract<Required<Hooks>[Name], (...args: any[]) => unknown>>[0],
    Output = Parameters<Extract<Required<Hooks>[Name], (...args: any[]) => unknown>>[1],
  >(name: Name, input: Input, output: Output): Promise<Output> {
    if (!name) return output
    for (const hook of await state().then((x) => x.hooks)) {
      const fn = hook[name] as ((input: Input, output: Output) => Promise<void>) | undefined
      if (!fn) continue
      await fn(input, output)
    }
    return output
  }

  export async function list() {
    return state().then((x) => x.hooks)
  }

  export async function init() {
    const hooks = await state().then((x) => x.hooks)
    const config = await Config.get()
    for (const hook of hooks) {
      await hook.config?.(config as never)
    }
    Bus.subscribeAll(async (input) => {
      const hooks = await state().then((x) => x.hooks)
      for (const hook of hooks) {
        hook.event?.({ event: input })
      }
    })
  }
}
