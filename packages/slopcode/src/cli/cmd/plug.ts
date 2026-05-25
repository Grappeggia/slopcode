import { log, spinner } from "@clack/prompts"
import type { Argv } from "yargs"
import { Global } from "@/global"
import { Instance } from "@/project/instance"
import { UI } from "../ui"
import { cmd } from "./cmd"
import { installPlugin, patchPluginConfig, readPluginManifest } from "@/plugin/install"
import { isDeprecatedPlugin } from "@/plugin/shared"

type PlugInput = {
  mod: string
  global?: boolean
  force?: boolean
}

type PlugCtx = {
  vcs?: string
  worktree: string
  directory: string
}

function cause(err: unknown) {
  if (!err || typeof err !== "object") return
  if (!("cause" in err)) return
  return err.cause
}

function message(err: unknown) {
  if (err instanceof Error) return err.message
  return String(err)
}

export function createPlugTask(input: PlugInput) {
  const mod = input.mod
  const force = Boolean(input.force)
  const global = Boolean(input.global)

  return async (ctx: PlugCtx) => {
    const install = spinner()
    install.start("Installing plugin package...")
    const target = await installPlugin(mod)
    if (!target.ok) {
      install.stop("Install failed", 1)
      log.error(`Could not install "${mod}"`)
      log.error(message(cause(target.error) ?? target.error))
      return false
    }
    install.stop("Plugin package ready")

    const inspect = spinner()
    inspect.start("Reading plugin manifest...")
    const manifest = await readPluginManifest(target.target)
    if (!manifest.ok) {
      if (manifest.code === "manifest_read_failed") {
        inspect.stop("Manifest read failed", 1)
        log.error(`Installed "${mod}" but failed to read ${manifest.file}`)
        log.error(message(cause(manifest.error) ?? manifest.error))
        return false
      }
      inspect.stop("No plugin targets found", 1)
      log.error(`"${mod}" does not expose plugin entrypoints or themes in package.json`)
      log.info('Expected one of: exports["./server"], exports["./tui"], package.json main, sc-themes, or oc-themes.')
      return false
    }
    const kinds = manifest.targets.map((item) => item.kind).join(" + ")
    inspect.stop(`Detected ${kinds} target${manifest.targets.length === 1 ? "" : "s"}`)

    const patch = spinner()
    patch.start("Updating plugin config...")
    const out = await patchPluginConfig({
      spec: mod,
      targets: manifest.targets,
      force,
      global,
      vcs: ctx.vcs,
      worktree: ctx.worktree,
      directory: ctx.directory,
      config: Global.Path.config,
    })
    if (!out.ok) {
      if (out.code === "invalid_json") {
        patch.stop("Failed updating config", 1)
        log.error(`Invalid JSON in ${out.file} (${out.parse} at line ${out.line}, column ${out.col})`)
        log.info("Fix the config file and run the command again.")
        return false
      }
      patch.stop("Failed updating plugin config", 1)
      log.error(message(out.error))
      return false
    }
    patch.stop("Plugin config updated")

    for (const item of out.items) {
      if (item.mode === "noop") {
        log.info(`Already configured ${item.kind} plugin in ${item.file}`)
        continue
      }
      if (item.mode === "replace") {
        log.info(`Replaced ${item.kind} plugin in ${item.file}`)
        continue
      }
      log.info(`Added ${item.kind} plugin to ${item.file}`)
    }

    log.success(`Installed ${mod}`)
    log.info(global ? `Scope: global (${out.dir})` : `Scope: local (${out.dir})`)
    return true
  }
}

export const PluginCommand = cmd({
  command: "plugin <module>",
  aliases: ["plug"],
  describe: "install plugin and update config",
  builder: (yargs: Argv) =>
    yargs
      .positional("module", {
        type: "string",
        describe: "plugin package name",
      })
      .option("global", {
        alias: ["g"],
        type: "boolean",
        default: false,
        describe: "install in global config",
      })
      .option("force", {
        alias: ["f"],
        type: "boolean",
        default: false,
        describe: "replace existing plugin version",
      }),
  handler: async (args) => {
    const mod = String(args.module ?? "").trim()
    if (!mod) {
      log.error("Plugin package name is required")
      process.exit(1)
    }

    if (isDeprecatedPlugin(mod)) {
      UI.empty()
      log.info(`${mod} is built in and no longer needs to be installed as a plugin`)
      return
    }

    await Instance.provide({
      directory: process.cwd(),
      async fn() {
        UI.empty()
        const run = createPlugTask({
          mod,
          global: Boolean(args.global),
          force: Boolean(args.force),
        })
        const ok = await run({
          vcs: Instance.project.vcs,
          worktree: Instance.worktree,
          directory: Instance.directory,
        })
        if (ok) return
        process.exit(1)
      },
    })
  },
})
