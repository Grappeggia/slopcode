export * as Formatter from "./formatter"

import path from "path"
import { Context, Deferred, Effect, Layer, Option } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "./process"
import { Config } from "./config"
import { FSUtil } from "./fs-util"
import { Flag } from "./flag/flag"
import { Location } from "./location"
import { Npm } from "./npm"
import { which } from "./util/which"

export const DISCOVERY_TIMEOUT = "10 seconds"
export const EXECUTION_TIMEOUT = "120 seconds"
export const OUTPUT_LIMIT = 64 * 1024

export type Entry = {
  readonly name: string
  readonly extensions: readonly string[]
  readonly command?: readonly string[]
  readonly environment?: Readonly<Record<string, string>>
  readonly builtin: boolean
}
export type Code = "formatted" | "unavailable" | "spawn-error" | "timeout" | "nonzero"
export type Outcome = {
  readonly name: string
  readonly code: Code
  readonly exitCode?: number
  readonly stdoutBytes?: number
  readonly stderrBytes?: number
  readonly stdoutTruncated?: boolean
  readonly stderrTruncated?: boolean
}
export type Result = { readonly matched: boolean; readonly outcomes: readonly Outcome[] }
export type Status = {
  readonly name: string
  readonly extensions: readonly string[]
  readonly configured: boolean
  readonly available: boolean
  readonly outcome: "available" | "unavailable"
}

const web = [
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".html", ".htm", ".css", ".scss",
  ".sass", ".less", ".vue", ".svelte", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".xml", ".md",
  ".mdx", ".graphql", ".gql",
] as const

const builtins: readonly Entry[] = [
  { name: "gofmt", extensions: [".go"], builtin: true },
  { name: "mix", extensions: [".ex", ".exs", ".eex", ".heex", ".leex", ".neex", ".sface"], builtin: true },
  { name: "prettier", extensions: web, environment: { BUN_BE_BUN: "1" }, builtin: true },
  { name: "oxfmt", extensions: [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"], environment: { BUN_BE_BUN: "1" }, builtin: true },
  { name: "biome", extensions: web, environment: { BUN_BE_BUN: "1" }, builtin: true },
  { name: "zig", extensions: [".zig", ".zon"], builtin: true },
  { name: "clang-format", extensions: [".c", ".cc", ".cpp", ".cxx", ".c++", ".h", ".hh", ".hpp", ".hxx", ".h++", ".ino", ".C", ".H"], builtin: true },
  { name: "ktlint", extensions: [".kt", ".kts"], builtin: true },
  { name: "ruff", extensions: [".py", ".pyi"], builtin: true },
  { name: "air", extensions: [".R"], builtin: true },
  { name: "uv", extensions: [".py", ".pyi"], builtin: true },
  { name: "rubocop", extensions: [".rb", ".rake", ".gemspec", ".ru"], builtin: true },
  { name: "standardrb", extensions: [".rb", ".rake", ".gemspec", ".ru"], builtin: true },
  { name: "htmlbeautifier", extensions: [".erb", ".html.erb"], builtin: true },
  { name: "dart", extensions: [".dart"], builtin: true },
  { name: "ocamlformat", extensions: [".ml", ".mli"], builtin: true },
  { name: "terraform", extensions: [".tf", ".tfvars"], builtin: true },
  { name: "latexindent", extensions: [".tex"], builtin: true },
  { name: "gleam", extensions: [".gleam"], builtin: true },
  { name: "shfmt", extensions: [".sh", ".bash"], builtin: true },
  { name: "nixfmt", extensions: [".nix"], builtin: true },
  { name: "rustfmt", extensions: [".rs"], builtin: true },
  { name: "pint", extensions: [".php"], builtin: true },
  { name: "ormolu", extensions: [".hs"], builtin: true },
  { name: "cljfmt", extensions: [".clj", ".cljs", ".cljc", ".edn"], builtin: true },
  { name: "dfmt", extensions: [".d"], builtin: true },
]

type Mutable = { disabled?: boolean; command?: readonly string[]; environment?: Readonly<Record<string, string>>; extensions?: readonly string[] }

export function resolve(entries: readonly Config.Entry[]): Entry[] {
  let enabled = false
  let values: Record<string, Mutable> = {}
  const order: string[] = []
  for (const entry of entries) {
    if (entry.type !== "document" || entry.info.formatter === undefined) continue
    const next = entry.info.formatter
    if (typeof next === "boolean") {
      enabled = next
      values = {}
      order.length = 0
      continue
    }
    if (!enabled) {
      enabled = true
      values = {}
      order.length = 0
    }
    for (const [name, value] of Object.entries(next)) {
      if (!builtins.some((item) => item.name === name) && !order.includes(name)) order.push(name)
      values[name] = {
        ...values[name],
        ...value,
        environment: values[name]?.environment && value.environment
          ? { ...values[name].environment, ...value.environment }
          : (value.environment ?? values[name]?.environment),
        command: value.command ?? values[name]?.command,
        extensions: value.extensions ?? values[name]?.extensions,
      }
    }
  }
  if (!enabled) return []
  const pythonDisabled = values.ruff?.disabled === true || values.uv?.disabled === true
  const safe = (value: Mutable | undefined) =>
    !value?.environment || Object.entries(value.environment).every(
      ([key, item]) => key.length > 0 && !key.includes("=") && !key.includes("\0") && !item.includes("\0"),
    )
  const command = (value: Mutable | undefined) =>
    value?.command === undefined || (value.command.length > 0 && value.command.every((item) => item.length > 0))
  const merged = builtins.flatMap((item) => {
    const value = values[item.name]
    if (!safe(value) || !command(value) || value?.disabled === true || (pythonDisabled && (item.name === "ruff" || item.name === "uv"))) return []
    return [{
      ...item,
      command: value?.command ?? item.command,
      environment: value?.environment ? { ...item.environment, ...value.environment } : item.environment,
      extensions: value?.extensions ?? item.extensions,
    }]
  })
  return [
    ...merged,
    ...order.flatMap((name) => {
      const value = values[name]
      if (!value || !safe(value) || value.disabled === true || !value.command?.length || value.command.some((item) => item.length === 0)) return []
      if (!value.extensions?.length || value.extensions.some((item) => item.length === 0)) return []
      return [{ name, command: value.command, environment: value.environment, extensions: value.extensions, builtin: false }]
    }),
  ]
}

export interface Interface {
  readonly format: (target: { readonly canonical: string }) => Effect.Effect<Result>
  readonly list: () => Effect.Effect<readonly Status[]>
  readonly status: () => Effect.Effect<readonly Status[]>
}
export class Service extends Context.Service<Service, Interface>()("@slopcode/v2/Formatter") {}

export const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const config = yield* Config.Service
    const fs = yield* FSUtil.Service
    const location = yield* Location.Service
    const app = yield* AppProcess.Service
    const npm = Option.getOrUndefined(yield* Effect.serviceOption(Npm.Service))
    const catalog = resolve(yield* config.entries())
    const cached = new Map<string, readonly string[]>()
    const pending = new Map<string, Deferred.Deferred<readonly string[] | undefined, unknown>>()
    let active = true
    yield* Effect.addFinalizer(() => Effect.sync(() => { active = false; cached.clear(); pending.clear() }))

    const find = (name: string) => which(name) ?? undefined
    const manifest = Effect.fnUntraced(function* (name: string, filename: "package.json" | "composer.json") {
      for (const file of yield* fs.findUp(filename, location.directory, location.project.directory)) {
        const data = yield* fs.readJson(file).pipe(Effect.option)
        if (Option.isNone(data) || typeof data.value !== "object" || data.value === null) continue
        const json = data.value as Record<string, unknown>
        const groups = filename === "package.json" ? [json.dependencies, json.devDependencies] : [json.require, json["require-dev"]]
        if (groups.some((group) => typeof group === "object" && group !== null && Object.hasOwn(group, name))) return true
      }
      return false
    })
    const npmWhich = (pkg: string) => npm ? npm.which(pkg).pipe(Effect.map(Option.getOrUndefined)) : Effect.succeed(undefined)
    const probe = (argv: readonly string[]) => app.run(
      ChildProcess.make(argv[0]!, argv.slice(1), { cwd: location.directory, stdin: "ignore" }),
      { timeout: DISCOVERY_TIMEOUT, maxOutputBytes: OUTPUT_LIMIT, maxErrorBytes: OUTPUT_LIMIT },
    ).pipe(Effect.option)

    const builtin = (item: Entry): Effect.Effect<readonly string[] | undefined, FSUtil.Error> => Effect.gen(function* () {
      const command = (name: string, ...args: string[]) => {
        const bin = find(name)
        return bin ? [bin, ...args] : undefined
      }
      switch (item.name) {
        case "gofmt": return command("gofmt", "-w", "$FILE")
        case "mix": return command("mix", "format", "$FILE")
        case "prettier": {
          if (!(yield* manifest("prettier", "package.json"))) return
          const bin = yield* npmWhich("prettier")
          return bin ? [bin, "--write", "$FILE"] : undefined
        }
        case "oxfmt": {
          if (!Flag.SLOPCODE_EXPERIMENTAL_OXFMT || !(yield* manifest("oxfmt", "package.json"))) return
          const bin = yield* npmWhich("oxfmt")
          return bin ? [bin, "$FILE"] : undefined
        }
        case "biome": {
          const found = (yield* fs.findUp("biome.json", location.directory, location.project.directory)).length > 0 || (yield* fs.findUp("biome.jsonc", location.directory, location.project.directory)).length > 0
          if (!found) return
          const bin = yield* npmWhich("@biomejs/biome")
          return bin ? [bin, "format", "--write", "$FILE"] : undefined
        }
        case "zig": return command("zig", "fmt", "$FILE")
        case "clang-format": return (yield* fs.findUp(".clang-format", location.directory, location.project.directory)).length ? command("clang-format", "-i", "$FILE") : undefined
        case "ktlint": return command("ktlint", "-F", "$FILE")
        case "ruff": {
          if (!find("ruff")) return
          for (const name of ["pyproject.toml", "ruff.toml", ".ruff.toml"]) {
            const found = yield* fs.findUp(name, location.directory, location.project.directory)
            if (!found.length) continue
            if (name !== "pyproject.toml" || (yield* fs.readFileStringSafe(found[0]!))?.includes("[tool.ruff]")) return ["ruff", "format", "$FILE"]
          }
          for (const name of ["requirements.txt", "pyproject.toml", "Pipfile"]) {
            const found = yield* fs.findUp(name, location.directory, location.project.directory)
            if (found.length && (yield* fs.readFileStringSafe(found[0]!))?.includes("ruff")) return ["ruff", "format", "$FILE"]
          }
          return
        }
        case "air": {
          const bin = find("air")
          if (!bin) return
          const result = Option.getOrUndefined(yield* probe([bin, "--help"]))
          const first = result?.stdout.toString("utf8").split("\n")[0] ?? ""
          return result?.exitCode === 0 && first.includes("R language") && first.includes("formatter") ? [bin, "format", "$FILE"] : undefined
        }
        case "uv": {
          const ruff = catalog.find((entry) => entry.name === "ruff")
          if (ruff && (yield* discover(ruff))) return
          const bin = find("uv")
          if (!bin) return
          const result = Option.getOrUndefined(yield* probe([bin, "format", "--help"]))
          return result?.exitCode === 0 ? [bin, "format", "--", "$FILE"] : undefined
        }
        case "rubocop": return command("rubocop", "--autocorrect", "$FILE")
        case "standardrb": return command("standardrb", "--fix", "$FILE")
        case "htmlbeautifier": return command("htmlbeautifier", "$FILE")
        case "dart": return command("dart", "format", "$FILE")
        case "ocamlformat": return find("ocamlformat") && (yield* fs.findUp(".ocamlformat", location.directory, location.project.directory)).length ? ["ocamlformat", "-i", "$FILE"] : undefined
        case "terraform": return command("terraform", "fmt", "$FILE")
        case "latexindent": return command("latexindent", "-w", "-s", "$FILE")
        case "gleam": return command("gleam", "format", "$FILE")
        case "shfmt": return command("shfmt", "-w", "$FILE")
        case "nixfmt": return command("nixfmt", "$FILE")
        case "rustfmt": return command("rustfmt", "$FILE")
        case "pint": return (yield* manifest("laravel/pint", "composer.json")) ? ["./vendor/bin/pint", "$FILE"] : undefined
        case "ormolu": return command("ormolu", "-i", "$FILE")
        case "cljfmt": return command("cljfmt", "fix", "--quiet", "$FILE")
        case "dfmt": return command("dfmt", "-i", "$FILE")
      }
    })
    function discover(item: Entry): Effect.Effect<readonly string[] | undefined> {
      return Effect.uninterruptibleMask((restore) =>
        Effect.gen(function* () {
          const hit = cached.get(item.name)
          if (hit) return hit
          const existing = pending.get(item.name)
          if (existing) return yield* restore(Deferred.await(existing).pipe(Effect.orDie))
          const deferred = Deferred.makeUnsafe<readonly string[] | undefined, unknown>()
          pending.set(item.name, deferred)
          const exit = yield* restore(
            (item.command ? Effect.succeed(item.command) : builtin(item)).pipe(
              Effect.catch(() => Effect.succeed(undefined)),
            ),
          ).pipe(Effect.exit)
          pending.delete(item.name)
          yield* Deferred.done(deferred, exit)
          const result = yield* Deferred.await(deferred).pipe(Effect.orDie)
          if (active && result) cached.set(item.name, result)
          return result
        }),
      )
    }
    const inspect = (item: Entry) => discover(item).pipe(Effect.map((argv): Status => ({
      name: item.name,
      extensions: item.extensions,
      configured: true,
      available: argv !== undefined,
      outcome: argv ? "available" : "unavailable",
    })))
    const list = Effect.fn("Formatter.list")(function* () { return yield* Effect.forEach(catalog, inspect) })
    const format = Effect.fn("Formatter.format")(function* (target: { readonly canonical: string }) {
      const matching = catalog.filter((item) => item.extensions.includes(path.extname(target.canonical)))
      const available = yield* Effect.forEach(
        matching,
        (item) => discover(item).pipe(Effect.map((argv) => ({ item, argv }))),
        { concurrency: "unbounded" },
      )
      const outcomes: Outcome[] = []
      for (const found of available) {
        if (!found.argv) { outcomes.push({ name: found.item.name, code: "unavailable" }); continue }
        const environment = found.item.environment
        if (environment && !Object.entries(environment).every(([key, value]) => key.length > 0 && !key.includes("=") && !key.includes("\0") && !value.includes("\0"))) {
          outcomes.push({ name: found.item.name, code: "spawn-error" })
          continue
        }
        const argv = found.argv.map((arg) => arg.replaceAll("$FILE", target.canonical))
        const result = yield* app.run(
          ChildProcess.make(argv[0]!, argv.slice(1), { cwd: location.directory, env: environment, extendEnv: true, stdin: "ignore" }),
          { timeout: EXECUTION_TIMEOUT, maxOutputBytes: OUTPUT_LIMIT, maxErrorBytes: OUTPUT_LIMIT },
        ).pipe(
          Effect.map((value) => ({ value } as const)),
          Effect.catchTag("AppProcessError", (error) =>
            Effect.succeed({ error, timeout: String(error.cause).includes("Timed out") } as const),
          ),
        )
        if ("error" in result) {
          outcomes.push({ name: found.item.name, code: result.timeout ? "timeout" : "spawn-error" })
          continue
        }
        outcomes.push({
          name: found.item.name,
          code: result.value.exitCode === 0 ? "formatted" : "nonzero",
          exitCode: result.value.exitCode,
          stdoutBytes: result.value.stdoutBytes ?? result.value.stdout.length,
          stderrBytes: result.value.stderrBytes ?? result.value.stderr.length,
          stdoutTruncated: result.value.stdoutTruncated,
          stderrTruncated: result.value.stderrTruncated,
        })
      }
      return { matched: matching.length > 0, outcomes }
    })
    return Service.of({ format, list, status: list })
  }),
)

export const locationLayer = layer
