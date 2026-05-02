import type {
  TuiDispose,
  TuiPlugin,
  TuiPluginApi,
  TuiPluginInstallResult,
  TuiPluginMeta,
  TuiPluginModule,
  TuiPluginStatus,
  TuiSlotPlugin,
} from "@slopcode-ai/plugin/tui"
import path from "path"
import { fileURLToPath } from "url"
import { TuiConfig } from "@/config/tui"
import { Log } from "@/util/log"
import { readPackageThemes, readPluginId, readV1Plugin, resolvePluginId, type PluginSource } from "@/plugin/shared"
import { PluginLoader } from "@/plugin/loader"
import { installPlugin as installModulePlugin, patchPluginConfig, readPluginManifest } from "@/plugin/install"
import { Global } from "@/global"
import { Filesystem } from "@/util/filesystem"
import { Flag } from "@/flag/flag"
import { INTERNAL_TUI_PLUGINS, type InternalTuiPlugin } from "./internal"
import { resetSlots, setupSlots, Slot as View, type HostPluginApi, type HostSlots } from "./slots"
import { ConfigPlugin } from "@/config/plugin"

type PluginLoad = {
  options: ConfigPlugin.Options | undefined
  spec: string
  target: string
  retry: boolean
  source: PluginSource | "internal"
  id: string
  module: TuiPluginModule
  origin: ConfigPlugin.Origin
  theme_root: string
  theme_files: string[]
}

type PluginScope = {
  lifecycle: TuiPluginApi["lifecycle"]
  track: (fn: (() => void) | undefined) => () => void
  dispose: () => Promise<void>
}

type PluginEntry = {
  id: string
  load: PluginLoad
  meta: TuiPluginMeta
  plugin: TuiPlugin
  enabled: boolean
  scope?: PluginScope
}

type RuntimeState = {
  directory: string
  api: HostPluginApi
  slots: HostSlots
  plugins: PluginEntry[]
  plugins_by_id: Map<string, PluginEntry>
  pending: Map<string, ConfigPlugin.Origin>
}

const log = Log.create({ service: "tui.plugin" })
const KV_KEY = "plugin_enabled"
const EMPTY_TUI: TuiPluginModule = {
  tui: async () => {},
}

function message(error: unknown) {
  if (error instanceof Error) return error.message
  return String(error)
}

function fail(text: string, data: Record<string, unknown>) {
  log.error(text, data)
  console.error(`[tui.plugin] ${text}`, data)
}

function warn(text: string, data: Record<string, unknown>) {
  log.warn(text, data)
  console.warn(`[tui.plugin] ${text}`, data)
}

function resolveRoot(root: string) {
  if (root.startsWith("file://")) {
    const file = fileURLToPath(root)
    if (root.endsWith("/")) return file
    return path.dirname(file)
  }
  if (path.isAbsolute(root)) return root
  return path.resolve(process.cwd(), root)
}

function createThemeInstaller(meta: ConfigPlugin.Origin, root: string, spec: string) {
  return async (file: string) => {
    const raw = file.startsWith("file://") ? fileURLToPath(file) : file
    const src = path.isAbsolute(raw) ? raw : path.resolve(root, raw)
    const name = path.basename(src, path.extname(src))
    const source = path.dirname(meta.source || path.join(process.cwd(), ".slopcode", "tui.json"))
    const local = path.basename(source) === ".slopcode" ? path.join(source, "themes") : path.join(source, ".slopcode", "themes")
    const dest = path.join(meta.scope === "local" ? local : path.join(Global.Path.config, "themes"), `${name}.json`)
    const text = await Filesystem.readText(src).catch((error) => {
      warn("failed to read tui plugin theme", { path: spec, theme: src, error })
      return undefined
    })
    if (text === undefined) return
    await Filesystem.write(dest, text).catch((error) => {
      warn("failed to persist tui plugin theme", { path: spec, theme: src, dest, error })
    })
  }
}

function createMeta(source: PluginLoad["source"], spec: string, target: string, id?: string): TuiPluginMeta {
  const now = Date.now()
  return {
    state: "same",
    id: id ?? spec,
    source,
    spec,
    target,
    first_time: now,
    last_time: now,
    time_changed: now,
    load_count: 1,
    fingerprint: target,
  }
}

function loadInternalPlugin(item: InternalTuiPlugin): PluginLoad {
  return {
    options: undefined,
    spec: item.id,
    target: item.id,
    retry: false,
    source: "internal",
    id: item.id,
    module: item,
    origin: {
      spec: item.id,
      scope: "global",
      source: item.id,
    },
    theme_root: process.cwd(),
    theme_files: [],
  }
}

async function readThemeFiles(spec: string, pkg?: { pkg: string; json: Record<string, unknown>; dir: string }) {
  if (!pkg) return [] as string[]
  return Promise.resolve()
    .then(() => readPackageThemes(spec, pkg))
    .catch((error) => {
      warn("invalid tui plugin themes", { path: spec, pkg: pkg.pkg, error })
      return [] as string[]
    })
}

async function syncPluginThemes(plugin: PluginEntry) {
  if (!plugin.load.theme_files.length) return
  const install = createThemeInstaller(plugin.load.origin, plugin.load.theme_root, plugin.load.spec)
  for (const file of plugin.load.theme_files) {
    await install(file).catch((error) => warn("failed to sync tui plugin themes", { path: plugin.load.spec, id: plugin.id, theme: file, error }))
  }
}

function createPluginScope(load: PluginLoad, id: string) {
  const ctrl = new AbortController()
  let list: { key: symbol; fn: TuiDispose }[] = []
  let done = false

  const onDispose = (fn: TuiDispose) => {
    if (done) return () => {}
    const key = Symbol()
    list.push({ key, fn })
    return () => {
      list = list.filter((item) => item.key !== key)
    }
  }

  const track = (fn: (() => void) | undefined) => {
    if (!fn) return () => {}
    const off = onDispose(fn)
    let drop = false
    return () => {
      if (drop) return
      drop = true
      off()
      fn()
    }
  }

  const dispose = async () => {
    if (done) return
    done = true
    ctrl.abort()
    const queue = [...list].reverse()
    list = []
    for (const item of queue) {
      await Promise.resolve()
        .then(item.fn)
        .catch((error) => fail("failed to clean up tui plugin", { path: load.spec, id, error }))
    }
  }

  return {
    lifecycle: {
      signal: ctrl.signal,
      onDispose,
    },
    track,
    dispose,
  }
}

function readPluginEnabledMap(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter((item): item is [string, boolean] => typeof item[1] === "boolean"))
}

function pluginEnabledState(state: RuntimeState, config: TuiConfig.Info) {
  return {
    ...readPluginEnabledMap(config.plugin_enabled),
    ...readPluginEnabledMap(state.api.kv.get(KV_KEY, {})),
  }
}

function writePluginEnabledState(api: HostPluginApi, id: string, enabled: boolean) {
  api.kv.set(KV_KEY, {
    ...readPluginEnabledMap(api.kv.get(KV_KEY, {})),
    [id]: enabled,
  })
}

function listPluginStatus(state: RuntimeState): TuiPluginStatus[] {
  return state.plugins.map((plugin) => ({
    id: plugin.id,
    source: plugin.meta.source,
    spec: plugin.meta.spec,
    target: plugin.meta.target,
    enabled: plugin.enabled,
    active: plugin.scope !== undefined,
  }))
}

async function deactivatePluginEntry(state: RuntimeState, plugin: PluginEntry, persist: boolean) {
  plugin.enabled = false
  if (persist) writePluginEnabledState(state.api, plugin.id, false)
  if (!plugin.scope) return true
  const scope = plugin.scope
  plugin.scope = undefined
  await scope.dispose()
  return true
}

async function activatePluginEntry(state: RuntimeState, plugin: PluginEntry, persist: boolean) {
  plugin.enabled = true
  if (persist) writePluginEnabledState(state.api, plugin.id, true)
  if (plugin.scope) return true

  const scope = createPluginScope(plugin.load, plugin.id)
  const api = pluginApi(state, plugin, scope, plugin.id)
  const ok = await Promise.resolve()
    .then(async () => {
      await syncPluginThemes(plugin)
      await plugin.plugin(api, plugin.load.options, plugin.meta)
      return true
    })
    .catch((error) => {
      fail("failed to initialize tui plugin", { path: plugin.load.spec, id: plugin.id, error })
      return false
    })

  if (!ok) {
    await scope.dispose()
    return false
  }
  if (!plugin.enabled) {
    await scope.dispose()
    return true
  }
  plugin.scope = scope
  return true
}

async function activatePluginById(state: RuntimeState | undefined, id: string, persist: boolean) {
  if (!state) return false
  const plugin = state.plugins_by_id.get(id)
  if (!plugin) return false
  return activatePluginEntry(state, plugin, persist)
}

async function deactivatePluginById(state: RuntimeState | undefined, id: string, persist: boolean) {
  if (!state) return false
  const plugin = state.plugins_by_id.get(id)
  if (!plugin) return false
  return deactivatePluginEntry(state, plugin, persist)
}

function pluginApi(runtime: RuntimeState, plugin: PluginEntry, scope: PluginScope, base: string): TuiPluginApi {
  const api = runtime.api
  const command: TuiPluginApi["command"] = {
    register(cb) {
      return scope.track(api.command.register(cb))
    },
    trigger(value) {
      api.command.trigger(value)
    },
    show() {
      api.command.show()
    },
  }

  const route: TuiPluginApi["route"] = {
    register(list) {
      return scope.track(api.route.register(list))
    },
    navigate(name, params) {
      api.route.navigate(name, params)
    },
    get current() {
      return api.route.current
    },
  }

  const event: TuiPluginApi["event"] = {
    on(type, handler) {
      return scope.track(api.event.on(type, handler as never))
    },
  }

  let count = 0
  const slots: TuiPluginApi["slots"] = {
    register(plugin: TuiSlotPlugin) {
      const id = count ? `${base}:${count}` : base
      count += 1
      scope.track(runtime.slots.register({ ...plugin, id }))
      return id
    },
  }

  return {
    ...api,
    command,
    route,
    event,
    slots,
    plugins: {
      list() {
        return listPluginStatus(runtime)
      },
      activate(id) {
        return activatePluginById(runtime, id, true)
      },
      deactivate(id) {
        return deactivatePluginById(runtime, id, true)
      },
      add(spec) {
        return addPluginBySpec(runtime, spec)
      },
      install(spec, options) {
        return installPluginBySpec(runtime, spec, options?.global)
      },
    },
    lifecycle: scope.lifecycle,
    theme: Object.assign(Object.create(api.theme), {
      install: createThemeInstaller(plugin.load.origin, plugin.load.theme_root, plugin.load.spec),
    }),
  }
}

function addPluginEntry(state: RuntimeState, plugin: PluginEntry) {
  if (state.plugins_by_id.has(plugin.id)) {
    fail("duplicate tui plugin id", { id: plugin.id, path: plugin.load.spec })
    return false
  }
  state.plugins_by_id.set(plugin.id, plugin)
  state.plugins.push(plugin)
  return true
}

function applyInitialPluginEnabledState(state: RuntimeState, config: TuiConfig.Info) {
  const map = pluginEnabledState(state, config)
  for (const plugin of state.plugins) {
    const enabled = map[plugin.id]
    if (enabled === undefined) continue
    plugin.enabled = enabled
  }
}

async function resolveExternalPlugins(list: ConfigPlugin.Origin[], wait: () => Promise<void>) {
  return PluginLoader.loadExternal({
    items: list,
    kind: "tui",
    wait,
    finish: async (loaded, origin, retry) => {
      const mod = await Promise.resolve()
        .then(() => readV1Plugin(loaded.mod, loaded.spec, "tui") as TuiPluginModule)
        .catch((error) => {
          fail("failed to load tui plugin", { path: loaded.spec, target: loaded.entry, retry, error })
          return undefined
        })
      if (!mod) return

      const id = await resolvePluginId(loaded.source, loaded.spec, loaded.target, readPluginId(mod.id, loaded.spec), loaded.pkg).catch(
        (error) => {
          fail("failed to load tui plugin", { path: loaded.spec, target: loaded.target, retry, error })
          return undefined
        },
      )
      if (!id) return

      return {
        options: loaded.options,
        spec: loaded.spec,
        target: loaded.target,
        retry,
        source: loaded.source,
        id,
        module: mod,
        origin,
        theme_root: loaded.pkg?.dir ?? resolveRoot(loaded.target),
        theme_files: await readThemeFiles(loaded.spec, loaded.pkg),
      }
    },
    missing: async (loaded, origin, retry) => {
      const theme_files = await readThemeFiles(loaded.spec, loaded.pkg)
      if (!theme_files.length) return
      const name = typeof loaded.pkg?.json.name === "string" && loaded.pkg.json.name.trim() ? loaded.pkg.json.name.trim() : undefined
      const id = await resolvePluginId(loaded.source, loaded.spec, loaded.target, name, loaded.pkg).catch((error) => {
        fail("failed to load tui plugin", { path: loaded.spec, target: loaded.target, retry, error })
        return undefined
      })
      if (!id) return
      return {
        options: loaded.options,
        spec: loaded.spec,
        target: loaded.target,
        retry,
        source: loaded.source,
        id,
        module: EMPTY_TUI,
        origin,
        theme_root: loaded.pkg?.dir ?? resolveRoot(loaded.target),
        theme_files,
      }
    },
    report: {
      start(candidate, retry) {
        log.info("loading tui plugin", { path: candidate.plan.spec, retry })
      },
      missing(candidate, retry, text) {
        warn("tui plugin has no entrypoint", { path: candidate.plan.spec, retry, message: text })
      },
      error(candidate, retry, stage, error, resolved) {
        fail(stage === "install" ? "failed to resolve tui plugin" : "failed to load tui plugin", {
          path: candidate.plan.spec,
          target: resolved?.entry,
          retry,
          error,
        })
      },
    },
  })
}

async function addExternalPluginEntries(state: RuntimeState, ready: PluginLoad[]) {
  const plugins: PluginEntry[] = []
  let ok = true
  for (const entry of ready) {
    const plugin: PluginEntry = {
      id: entry.id,
      load: entry,
      meta: createMeta(entry.source, entry.spec, entry.target, entry.id),
      plugin: entry.module.tui,
      enabled: true,
    }
    if (!addPluginEntry(state, plugin)) {
      ok = false
      continue
    }
    plugins.push(plugin)
  }
  return { plugins, ok }
}

function defaultPluginOrigin(state: RuntimeState, spec: string): ConfigPlugin.Origin {
  return {
    spec,
    scope: "local",
    source: state.api.state.path.config || path.join(state.directory, ".slopcode", "tui.json"),
  }
}

async function addPluginBySpec(state: RuntimeState | undefined, raw: string) {
  if (!state) return false
  const spec = raw.trim()
  if (!spec) return false
  const cfg = state.pending.get(spec) ?? defaultPluginOrigin(state, spec)
  const next = ConfigPlugin.pluginSpecifier(cfg.spec)
  if (state.plugins.some((plugin) => plugin.load.spec === next)) {
    state.pending.delete(spec)
    return true
  }
  const ready = await resolveExternalPlugins([cfg], () => TuiConfig.waitForDependencies()).catch((error) => {
    fail("failed to add tui plugin", { path: next, error })
    return [] as PluginLoad[]
  })
  const first = ready[0]
  if (!first) return false
  if (state.plugins_by_id.has(first.id)) {
    state.pending.delete(spec)
    return true
  }

  const out = await addExternalPluginEntries(state, [first])
  let ok = out.ok && out.plugins.length > 0
  for (const plugin of out.plugins) {
    const active = await activatePluginEntry(state, plugin, false)
    if (!active) ok = false
  }
  if (ok) state.pending.delete(spec)
  return ok
}

async function installPluginBySpec(
  state: RuntimeState | undefined,
  raw: string,
  global = false,
): Promise<TuiPluginInstallResult> {
  if (!state) return { ok: false, message: "Plugin runtime is not ready." }
  const spec = raw.trim()
  if (!spec) return { ok: false, message: "Plugin package name is required" }

  const dir = state.api.state.path
  if (!dir.directory) return { ok: false, message: "Paths are still syncing. Try again in a moment." }

  const install = await installModulePlugin(spec)
  if (!install.ok) return { ok: false, message: message(install.error) }

  const manifest = await readPluginManifest(install.target)
  if (!manifest.ok) {
    if (manifest.code === "manifest_no_targets") {
      return { ok: false, message: `"${spec}" does not expose plugin entrypoints or themes in package.json` }
    }
    return { ok: false, message: `Installed "${spec}" but failed to read ${manifest.file}` }
  }

  const patch = await patchPluginConfig({
    spec,
    targets: manifest.targets,
    global,
    vcs: dir.worktree && dir.worktree !== "/" ? "git" : undefined,
    worktree: dir.worktree,
    directory: dir.directory,
  })
  if (!patch.ok) {
    if (patch.code === "invalid_json") {
      return { ok: false, message: `Invalid JSON in ${patch.file} (${patch.parse} at line ${patch.line}, column ${patch.col})` }
    }
    return { ok: false, message: message(patch.error) }
  }

  const tui = manifest.targets.find((item) => item.kind === "tui")
  if (tui) {
    const file = patch.items.find((item) => item.kind === "tui")?.file
    const next = tui.opts ? ([spec, tui.opts] as ConfigPlugin.Spec) : spec
    state.pending.set(spec, {
      spec: next,
      scope: global ? "global" : "local",
      source: (file ?? dir.config) || path.join(patch.dir, "tui.json"),
    })
  }

  return { ok: true, dir: patch.dir, tui: Boolean(tui) }
}

let dir = ""
let loaded: Promise<void> | undefined
let runtime: RuntimeState | undefined
export const Slot = View

export async function init(input: { api: HostPluginApi; config: TuiConfig.Info }) {
  const cwd = process.cwd()
  if (loaded) {
    if (dir !== cwd) throw new Error(`TuiPluginRuntime.init() called with a different working directory. expected=${dir} got=${cwd}`)
    return loaded
  }
  dir = cwd
  loaded = load(input)
  return loaded
}

export function list() {
  if (!runtime) return []
  return listPluginStatus(runtime)
}

export async function activatePlugin(id: string) {
  return activatePluginById(runtime, id, true)
}

export async function deactivatePlugin(id: string) {
  return deactivatePluginById(runtime, id, true)
}

export async function addPlugin(spec: string) {
  return addPluginBySpec(runtime, spec)
}

export async function installPlugin(spec: string, options?: { global?: boolean }) {
  return installPluginBySpec(runtime, spec, options?.global)
}

export async function dispose() {
  const task = loaded
  loaded = undefined
  dir = ""
  if (task) await task
  const state = runtime
  runtime = undefined
  resetSlots()
  if (!state) return
  for (const plugin of [...state.plugins].reverse()) {
    await deactivatePluginEntry(state, plugin, false)
  }
}

async function load(input: { api: HostPluginApi; config: TuiConfig.Info }) {
  const cwd = process.cwd()
  const slots = setupSlots(input.api)
  const next: RuntimeState = {
    directory: cwd,
    api: input.api,
    slots,
    plugins: [],
    plugins_by_id: new Map(),
    pending: new Map(),
  }
  runtime = next

  const records = Flag.SLOPCODE_PURE ? [] : (input.config.plugin_origins ?? [])
  if (Flag.SLOPCODE_PURE && input.config.plugin_origins?.length) {
    log.info("skipping external tui plugins in pure mode", { count: input.config.plugin_origins.length })
  }

  for (const item of INTERNAL_TUI_PLUGINS) {
    log.info("loading internal tui plugin", { id: item.id })
    const entry = loadInternalPlugin(item)
    addPluginEntry(next, {
      id: entry.id,
      load: entry,
      meta: createMeta(entry.source, entry.spec, entry.target, entry.id),
      plugin: entry.module.tui,
      enabled: true,
    })
  }

  const ready = await resolveExternalPlugins(records, () => TuiConfig.waitForDependencies())
  await addExternalPluginEntries(next, ready)
  applyInitialPluginEnabledState(next, input.config)
  for (const plugin of next.plugins) {
    if (!plugin.enabled) continue
    await activatePluginEntry(next, plugin, false)
  }
}

export * as TuiPluginRuntime from "./runtime"
