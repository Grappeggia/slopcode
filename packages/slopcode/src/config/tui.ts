import { existsSync } from "fs"
import path from "path"
import z from "zod"
import { mergeDeep, unique } from "remeda"
import { Config } from "./config"
import { ConfigPaths } from "./paths"
import { migrateTuiConfig } from "./migrate-tui-config"
import { TuiInfo } from "./tui-schema"
import { Instance } from "@/project/instance"
import { Flag } from "@/flag/flag"
import { Log } from "@/util/log"
import { Global } from "@/global"
import { ConfigPlugin } from "./plugin"
import { Filesystem } from "@/util/filesystem"

export namespace TuiConfig {
  const log = Log.create({ service: "tui.config" })

  export const Info = TuiInfo

  export type Info = z.output<typeof Info> & {
    plugin_origins?: ConfigPlugin.Origin[]
  }

  function mergeInfo(target: Info, source: Info): Info {
    return mergeDeep(target, source)
  }

  function customPath() {
    return Flag.SLOPCODE_TUI_CONFIG
  }

  function scope(file: string): ConfigPlugin.Scope {
    if (Filesystem.contains(Instance.directory, file)) return "local"
    if (Instance.worktree !== "/" && Filesystem.contains(Instance.worktree, file)) return "local"
    return "global"
  }

  async function mergeFile(result: Info, file: string) {
    const next = await loadFile(file)
    const merged = mergeInfo(result, next)
    if (!next.plugin?.length) return merged

    const plugins = ConfigPlugin.deduplicatePluginOrigins([
      ...(result.plugin_origins ?? []),
      ...next.plugin.map((spec) => ({ spec, scope: scope(file), source: file })),
    ])
    merged.plugin = plugins.map((item) => item.spec)
    merged.plugin_origins = plugins
    return merged
  }

  const state = Instance.state(async () => {
    let projectFiles = Flag.SLOPCODE_DISABLE_PROJECT_CONFIG
      ? []
      : await ConfigPaths.projectFiles("tui", Instance.directory, Instance.worktree)
    const directories = await ConfigPaths.directories(Instance.directory, Instance.worktree)
    const legacyGlobalDir = path.join(path.dirname(Global.Path.config), "opencode")
    const custom = customPath()
    const managed = Config.managedConfigDir()
    await migrateTuiConfig({ directories, custom, managed })
    projectFiles = Flag.SLOPCODE_DISABLE_PROJECT_CONFIG
      ? []
      : await ConfigPaths.projectFiles("tui", Instance.directory, Instance.worktree)

    let result: Info = {}

    for (const file of ConfigPaths.fileInDirectory(legacyGlobalDir, "tui")) {
      result = await mergeFile(result, file)
    }

    for (const file of ConfigPaths.fileInDirectory(Global.Path.config, "tui")) {
      result = await mergeFile(result, file)
    }

    if (custom) {
      result = await mergeFile(result, custom)
      log.debug("loaded custom tui config", { path: custom })
    }

    for (const file of projectFiles) {
      result = await mergeFile(result, file)
    }

    for (const dir of unique(directories)) {
      if (!ConfigPaths.isConfigDirectory(dir) && dir !== Flag.SLOPCODE_CONFIG_DIR) continue
      for (const file of ConfigPaths.fileInDirectory(dir, "tui")) {
        result = await mergeFile(result, file)
      }
    }

    if (existsSync(managed)) {
      for (const file of ConfigPaths.fileInDirectory(managed, "tui")) {
        result = await mergeFile(result, file)
      }
    }

    result.keybinds = Config.Keybinds.parse(result.keybinds ?? {})

    return {
      config: result,
    }
  })

  export async function get() {
    return state().then((x) => x.config)
  }

  export async function waitForDependencies() {
    await Config.waitForDependencies()
  }

  async function loadFile(filepath: string): Promise<Info> {
    const text = await ConfigPaths.readFile(filepath)
    if (!text) return {}
    return load(text, filepath).catch((error) => {
      log.warn("failed to load tui config", { path: filepath, error })
      return {}
    })
  }

  async function load(text: string, configFilepath: string): Promise<Info> {
    const data = await ConfigPaths.parseText(text, configFilepath, "empty")
    if (!data || typeof data !== "object" || Array.isArray(data)) return {}

    const normalized = (() => {
      const copy = { ...(data as Record<string, unknown>) }
      if (!("tui" in copy)) return copy
      if (!copy.tui || typeof copy.tui !== "object" || Array.isArray(copy.tui)) {
        delete copy.tui
        return copy
      }
      const tui = copy.tui as Record<string, unknown>
      delete copy.tui
      return {
        ...tui,
        ...copy,
      }
    })()

    const parsed = Info.safeParse(normalized)
    if (!parsed.success) {
      log.warn("invalid tui config", { path: configFilepath, issues: parsed.error.issues })
      return {}
    }

    const out: Info = parsed.data
    if (!out.plugin) return out
    for (let i = 0; i < out.plugin.length; i++) {
      out.plugin[i] = await ConfigPlugin.resolvePluginSpec(out.plugin[i], configFilepath)
    }
    return out
  }
}
