export * as PluginPackage from "./package"

import { createSlopcodeClient } from "@slopcode-ai/sdk"
import { Context, Effect, Option, Schema } from "effect"
import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import semver from "semver"
import { Config } from "../config"
import { EventV2 } from "../event"
import { InstallationVersion } from "../installation/version"
import { Location } from "../location"
import { Npm } from "../npm"
import { PluginV2 } from "../plugin"

const deprecated = new Set(["slopcode-openai-codex-auth", "slopcode-copilot-auth"])
const indexes = ["index.ts", "index.tsx", "index.js", "index.mjs", "index.cjs"]
const supported = new Set(["tool", "tool.execute.before", "tool.execute.after", "dispose"])

export class ClientUnavailableError extends Schema.TaggedErrorClass<ClientUnavailableError>()(
  "PluginClientUnavailableError",
  { message: Schema.String },
) {}

export type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export interface HostInfo {
  readonly baseUrl: URL
  readonly fetch: Fetch
  readonly register: (type: string, adapter: unknown) => void
}

export class Host extends Context.Service<Host, HostInfo>()("@slopcode/v2/PluginPackage/Host") {}

export const unavailable: Fetch = async () => {
  throw new ClientUnavailableError({ message: "No local plugin SDK transport is installed" })
}

type Stage = "install" | "entrypoint" | "compatibility" | "import" | "factory" | "hook-shape"
type Candidate = {
  readonly spec: string
  readonly options?: Readonly<Record<string, unknown>>
  readonly source: string
  readonly directory: string
}
type Package = { readonly root: string; readonly json: Record<string, unknown> }
type Resolved = Candidate & { readonly local: boolean; readonly root: string; readonly entry: string }
type Factory = {
  readonly name: string
  readonly id?: string
  readonly value: (input: Record<string, unknown>, options?: Readonly<Record<string, unknown>>) => Promise<unknown>
}
type Export =
  | { readonly ok: true; readonly factory: Factory }
  | { readonly ok: false; readonly name: string; readonly error: Error }

export class ResolveError extends Error {
  constructor(
    readonly stage: "install" | "entrypoint" | "compatibility",
    override readonly cause: unknown,
  ) {
    super(message(cause), { cause })
  }
}

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause))
const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value)
const isPath = (spec: string) => spec.startsWith("file://") || spec.startsWith(".") || path.isAbsolute(spec)
const contains = (root: string, target: string) => {
  const relative = path.relative(root, target)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

function value(input: unknown): string | undefined {
  if (typeof input === "string") return input
  if (!isRecord(input)) return
  if (typeof input.import === "string") return input.import
  if (typeof input.default === "string") return input.default
}

async function exists(file: string) {
  return fs.stat(file).catch(() => undefined)
}

async function pkg(root: string) {
  const file = path.join(root, "package.json")
  const stat = await exists(file)
  if (!stat?.isFile()) return
  return { root, json: JSON.parse(await fs.readFile(file, "utf8")) as Record<string, unknown> } satisfies Package
}

async function safe(root: string, raw: string, spec: string) {
  if (raw.startsWith("file://") || path.isAbsolute(raw))
    throw new Error(`Plugin ${spec} entrypoint must be relative to its package root`)
  const target = path.resolve(root, raw)
  if (!contains(path.resolve(root), target)) throw new Error(`Plugin ${spec} entrypoint escapes its package root`)
  const realRoot = await fs.realpath(root)
  const realTarget = await fs.realpath(target)
  if (!contains(realRoot, realTarget)) throw new Error(`Plugin ${spec} entrypoint escapes its package root`)
  return realTarget
}

async function index(root: string) {
  for (const name of indexes) {
    const file = path.join(root, name)
    if ((await exists(file))?.isFile()) return fs.realpath(file)
  }
}

async function entry(spec: string, root: string, info?: Package, fallback?: string) {
  if (info) {
    const exports = info.json.exports
    const server = isRecord(exports) ? value(exports["./server"]) : undefined
    if (server) return safe(root, server, spec)
    if (typeof info.json.main === "string" && info.json.main.trim()) return safe(root, info.json.main, spec)
  }
  const direct = await index(root)
  if (direct) return direct
  if (fallback) {
    const file = fallback.startsWith("file://") ? fileURLToPath(fallback) : fallback
    const target = await fs.realpath(file)
    const base = await fs.realpath(root)
    if (!contains(base, target)) throw new Error(`Plugin ${spec} entrypoint escapes its package root`)
    return target
  }
  throw new Error(`Plugin ${spec} does not expose a server entrypoint`)
}

export async function resolve(
  input: Candidate & { readonly npm: Npm.Interface; readonly version?: string },
): Promise<Resolved> {
  if (isPath(input.spec)) {
    const raw = input.spec.startsWith("file://") ? fileURLToPath(input.spec) : input.spec
    const target = path.isAbsolute(raw) ? raw : path.resolve(input.directory, raw)
    const stat = await exists(target)
    if (!stat) throw new ResolveError("entrypoint", new Error(`Plugin ${input.spec} does not exist`))
    if (stat.isFile()) return { ...input, local: true, root: path.dirname(target), entry: await fs.realpath(target) }
    if (!stat.isDirectory())
      throw new ResolveError("entrypoint", new Error(`Plugin ${input.spec} is not a file or directory`))
    const root = await fs.realpath(target)
    return {
      ...input,
      local: true,
      root,
      entry: await entry(input.spec, root, await pkg(root)).catch((cause) => {
        throw new ResolveError("entrypoint", cause)
      }),
    }
  }

  const added = await Effect.runPromise(input.npm.add(input.spec)).catch((cause) => {
    throw new ResolveError("install", cause)
  })
  const root = await fs.realpath(added.directory)
  const info = await pkg(root)
  if (!info) throw new ResolveError("entrypoint", new Error(`Plugin ${input.spec} package.json is missing`))
  const version = input.version ?? InstallationVersion
  if (semver.valid(version) && semver.prerelease(version) === null) {
    const engines = info.json.engines
    const range = isRecord(engines) && typeof engines.slopcode === "string" ? engines.slopcode : undefined
    if (range && !semver.satisfies(version, range))
      throw new ResolveError("compatibility", new Error(`Plugin requires slopcode ${range} but running ${version}`))
  }
  return {
    ...input,
    local: false,
    root,
    entry: await entry(input.spec, root, info, Option.getOrUndefined(added.entrypoint)).catch((cause) => {
      throw new ResolveError("entrypoint", cause)
    }),
  }
}

function factories(mod: Record<string, unknown>, spec: string) {
  const seen = new Set<unknown>()
  const result: Export[] = []
  for (const [name, item] of Object.entries(mod)) {
    const modern = isRecord(item) && "server" in item
    const factory = modern ? item.server : item
    if (typeof factory !== "function") {
      result.push({ ok: false, name, error: new TypeError(`Plugin ${spec} export ${name} is not a server plugin`) })
      continue
    }
    if (seen.has(factory)) continue
    seen.add(factory)
    const id = modern && "id" in item ? item.id : undefined
    if (id !== undefined && (typeof id !== "string" || !id.trim())) {
      result.push({ ok: false, name, error: new TypeError(`Plugin ${spec} export ${name} has an invalid id`) })
      continue
    }
    result.push({
      ok: true,
      factory: { name, id: typeof id === "string" ? id.trim() : undefined, value: factory as Factory["value"] },
    })
  }
  if (!result.length)
    result.push({ ok: false, name: "default", error: new TypeError(`Plugin ${spec} has no server plugin exports`) })
  return result
}

function registration(hooks: unknown, spec: string) {
  if (!isRecord(hooks)) throw new TypeError(`Plugin ${spec} factory must return a hook object`)
  if (hooks.tool !== undefined && !isRecord(hooks.tool))
    throw new TypeError(`Plugin ${spec} tool hook must be an object`)
  for (const name of ["tool.execute.before", "tool.execute.after", "dispose"] as const) {
    if (hooks[name] !== undefined && typeof hooks[name] !== "function")
      throw new TypeError(`Plugin ${spec} hook ${name} must be a function`)
  }
  const before = hooks["tool.execute.before"] as
    | ((input: unknown, output: { args: unknown }) => Promise<void>)
    | undefined
  const after = hooks["tool.execute.after"] as
    | ((input: unknown, output: Record<string, unknown>) => Promise<void>)
    | undefined
  return {
    ...(hooks.tool === undefined ? {} : { tool: hooks.tool as PluginV2.Registration["tool"] }),
    ...(before === undefined
      ? {}
      : {
          "tool.execute.before": (event: PluginV2.Hooks["tool.execute.before"]) =>
            Effect.promise(async () => {
              const output = { args: event.args }
              await before({ tool: event.tool, sessionID: event.sessionID, callID: event.callID }, output)
              event.args = output.args
            }),
        }),
    ...(after === undefined
      ? {}
      : {
          "tool.execute.after": (event: PluginV2.Hooks["tool.execute.after"]) =>
            Effect.promise(async () => {
              const output: Record<string, unknown> = {
                title: event.title,
                output: event.output,
                metadata: event.metadata,
                attachments: event.attachments,
              }
              await after(
                {
                  tool: event.tool,
                  sessionID: event.sessionID,
                  callID: event.callID,
                  args: event.args,
                },
                output,
              )
              if (typeof output.title === "string") event.title = output.title
              if (typeof output.output === "string") event.output = output.output
              if (isRecord(output.metadata)) event.metadata = output.metadata
              if (Array.isArray(output.attachments)) event.attachments = output.attachments as never
            }),
        }),
    ...(hooks.dispose === undefined ? {} : { dispose: hooks.dispose as () => void | Promise<void> }),
  } satisfies PluginV2.Registration
}

export const load = Effect.gen(function* () {
  const config = yield* Config.Service
  const location = yield* Location.Service
  const npm = yield* Npm.Service
  const plugin = yield* PluginV2.Service
  const events = yield* EventV2.Service
  const host = Option.getOrUndefined(yield* Effect.serviceOption(Host))
  const documents = (yield* config.entries()).filter((item): item is Config.Document => item.type === "document")
  const document = documents.findLast((item) => item.info.plugins !== undefined)
  if (!document?.info.plugins?.length) return
  const source = document.path ?? location.directory
  const directory = document.path ? path.dirname(document.path) : location.directory
  const candidates = document.info.plugins.map((item) => ({
    spec: typeof item === "string" ? item : item.package,
    options: typeof item === "string" ? undefined : item.options,
    source,
    directory,
  }))
  const fail = (item: Candidate, stage: Stage, cause: unknown, id?: PluginV2.ID) =>
    events
      .publish(PluginV2.Event.Failed, { id, package: item.spec, source: item.source, stage, message: message(cause) })
      .pipe(
        Effect.tap(() =>
          Effect.logError("failed to load configured plugin", { package: item.spec, source, stage, cause }),
        ),
      )
  const warn = (item: Candidate, text: string, id?: PluginV2.ID) =>
    events
      .publish(PluginV2.Event.Warning, { id, package: item.spec, source: item.source, message: text })
      .pipe(Effect.tap(() => Effect.logWarning(text, { package: item.spec, source })))
  const attempt = <A>(effect: Effect.Effect<A, unknown>) =>
    effect.pipe(
      Effect.match({
        onFailure: (error) => ({ ok: false as const, error }),
        onSuccess: (value) => ({ ok: true as const, value }),
      }),
    )

  yield* npm.install(directory).pipe(Effect.catch((cause) => fail(candidates[0], "install", cause).pipe(Effect.asVoid)))
  const input = {
    client: createSlopcodeClient({
      baseUrl: (host?.baseUrl ?? new URL("http://unavailable.invalid")).href,
      directory: location.directory,
      fetch: host?.fetch ?? unavailable,
    }),
    project: {
      id: location.project.id,
      worktree: location.project.directory,
      ...(location.vcs?.type === "git" ? { vcs: "git" as const, vcsDir: location.project.directory } : {}),
      time: { created: 0 },
    },
    directory: location.directory,
    worktree: location.project.directory,
    experimental_workspace: { register: host?.register ?? (() => {}) },
    serverUrl: host?.baseUrl ?? new URL("http://unavailable.invalid"),
    $: typeof Bun === "undefined" ? undefined : Bun.$,
  }

  for (const item of candidates) {
    if ([...deprecated].some((name) => item.spec.includes(name))) {
      yield* warn(item, `Skipping deprecated built-in plugin package ${item.spec}`)
      continue
    }
    const resolved = yield* attempt(
      Effect.tryPromise({ try: () => resolve({ ...item, npm }), catch: (cause) => cause }),
    )
    if (!resolved.ok) {
      const error = resolved.error instanceof ResolveError ? resolved.error : undefined
      yield* fail(item, error?.stage ?? (isPath(item.spec) ? "entrypoint" : "install"), error?.cause ?? resolved.error)
      continue
    }
    const row = resolved.value
    const first = yield* attempt(
      Effect.tryPromise({ try: () => import(pathToFileURL(row.entry).href), catch: (cause) => cause }),
    )
    const imported = first.ok
      ? first
      : row.local && /Cannot find (package|module)|ModuleNotFound/i.test(message(first.error))
        ? yield* Effect.gen(function* () {
            yield* npm
              .install(directory)
              .pipe(Effect.catch((cause) => fail(item, "install", cause).pipe(Effect.asVoid)))
            return yield* attempt(
              Effect.tryPromise({
                try: () => import(`${pathToFileURL(row.entry).href}?slopcode-retry=1`),
                catch: (cause) => cause,
              }),
            )
          })
        : first
    if (!imported.ok) {
      yield* fail(item, "import", imported.error)
      continue
    }
    const found = yield* attempt(
      Effect.try({
        try: () => factories(imported.value as Record<string, unknown>, item.spec),
        catch: (cause) => cause,
      }),
    )
    if (!found.ok) {
      yield* fail(item, "hook-shape", found.error)
      continue
    }
    for (const exported of found.value) {
      if (!exported.ok) {
        yield* fail(item, "hook-shape", exported.error, PluginV2.ID.make(`${item.spec}#${exported.name}`))
        continue
      }
      const factory = exported.factory
      const id = PluginV2.ID.make(factory.id ?? `${item.spec}#${factory.name}`)
      const hooks = yield* attempt(
        Effect.tryPromise({
          try: () => factory.value(input, item.options),
          catch: (cause) => cause,
        }),
      )
      if (!hooks.ok) {
        yield* fail(item, "factory", hooks.error, id)
        continue
      }
      const adapted = yield* attempt(
        Effect.try({ try: () => registration(hooks.value, item.spec), catch: (cause) => cause }),
      )
      if (!adapted.ok) {
        yield* fail(item, "hook-shape", adapted.error, id)
        continue
      }
      for (const name of Object.keys(hooks.value as Record<string, unknown>)) {
        if (!supported.has(name)) yield* warn(item, `Plugin ${item.spec} returned unsupported hook ${name}`, id)
      }
      yield* plugin
        .add({ id, effect: Effect.succeed(adapted.value) })
        .pipe(Effect.catch((cause) => fail(item, "hook-shape", cause, id).pipe(Effect.asVoid)))
    }
  }
})
