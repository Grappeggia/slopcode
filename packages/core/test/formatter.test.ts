import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer, Schema } from "effect"
import { AppProcess } from "@slopcode-ai/core/process"
import { Config } from "@slopcode-ai/core/config"
import { Formatter } from "@slopcode-ai/core/formatter"
import { Flag } from "@slopcode-ai/core/flag/flag"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Location } from "@slopcode-ai/core/location"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { it } from "./lib/effect"

const withFormatter = <A, E, R>(
  directory: string,
  entries: Config.Entry[],
  effect: Effect.Effect<A, E, R>,
) =>
  effect.pipe(
    Effect.provide(
      Formatter.layer.pipe(
        Layer.provide(AppProcess.defaultLayer),
        Layer.provide(FSUtil.defaultLayer),
        Layer.provide(Layer.succeed(Config.Service, Config.Service.of({ entries: () => Effect.succeed(entries) }))),
        Layer.provide(
          Layer.succeed(
            Location.Service,
            Location.Service.of(location({ directory: AbsolutePath.make(directory) })),
          ),
        ),
      ),
    ),
  )

const document = (formatter?: Config.Info["formatter"]) =>
  new Config.Document({ type: "document", info: Schema.decodeUnknownSync(Config.Info)({ formatter }) })

describe("Formatter", () => {
  it.effect("implements omitted, boolean, reset, re-enable, and malformed config semantics", () =>
    Effect.sync(() => {
      expect(Formatter.resolve([document()])).toEqual([])
      expect(Formatter.resolve([document(false)])).toEqual([])
      expect(Formatter.resolve([document(true)])).toHaveLength(26)
      expect(Formatter.resolve([document({})])).toHaveLength(26)
      expect(Formatter.resolve([document(true), document(false), document()])).toEqual([])
      expect(Formatter.resolve([document(false), document({ gofmt: { disabled: false } })])).toHaveLength(26)
      expect(Formatter.resolve([document({ custom: { command: ["run"], extensions: [".x"] } }), document({ custom: { disabled: true } }), document({ custom: { disabled: false } })]).at(-1)?.name).toBe("custom")
      expect(Formatter.resolve([document({ custom: { command: [], extensions: [".x"] } })]).some((item) => item.name === "custom")).toBe(false)
      expect(Formatter.resolve([document({ custom: { command: ["run"], extensions: [] } })]).some((item) => item.name === "custom")).toBe(false)
      expect(Formatter.resolve([document({ gofmt: { command: [] } })]).some((item) => item.name === "gofmt")).toBe(false)
      expect(Formatter.resolve([document({ custom: { command: ["run"], extensions: [".x"], environment: { "BAD=KEY": "value" } } })]).some((item) => item.name === "custom")).toBe(false)
    }),
  )

  it.effect("preserves the complete built-in catalog and compatibility extensions", () =>
    Effect.sync(() => {
      expect(Formatter.resolve([document(true)]).map((item) => [item.name, item.extensions])).toEqual([
        ["gofmt", [".go"]],
        ["mix", [".ex", ".exs", ".eex", ".heex", ".leex", ".neex", ".sface"]],
        ["prettier", [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".xml", ".md", ".mdx", ".graphql", ".gql"]],
        ["oxfmt", [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts"]],
        ["biome", [".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".mts", ".cts", ".html", ".htm", ".css", ".scss", ".sass", ".less", ".vue", ".svelte", ".json", ".jsonc", ".yaml", ".yml", ".toml", ".xml", ".md", ".mdx", ".graphql", ".gql"]],
        ["zig", [".zig", ".zon"]],
        ["clang-format", [".c", ".cc", ".cpp", ".cxx", ".c++", ".h", ".hh", ".hpp", ".hxx", ".h++", ".ino", ".C", ".H"]],
        ["ktlint", [".kt", ".kts"]], ["ruff", [".py", ".pyi"]], ["air", [".R"]], ["uv", [".py", ".pyi"]],
        ["rubocop", [".rb", ".rake", ".gemspec", ".ru"]], ["standardrb", [".rb", ".rake", ".gemspec", ".ru"]],
        ["htmlbeautifier", [".erb", ".html.erb"]], ["dart", [".dart"]], ["ocamlformat", [".ml", ".mli"]],
        ["terraform", [".tf", ".tfvars"]], ["latexindent", [".tex"]], ["gleam", [".gleam"]], ["shfmt", [".sh", ".bash"]],
        ["nixfmt", [".nix"]], ["rustfmt", [".rs"]], ["pint", [".php"]], ["ormolu", [".hs"]],
        ["cljfmt", [".clj", ".cljs", ".cljc", ".edn"]], ["dfmt", [".d"]],
      ])
    }),
  )

  it.effect("reads the oxfmt flag at runtime with experimental inheritance", () =>
    Effect.acquireUseRelease(
      Effect.sync(() => ({ experimental: process.env.SLOPCODE_EXPERIMENTAL, oxfmt: process.env.SLOPCODE_EXPERIMENTAL_OXFMT })),
      () => Effect.sync(() => {
        process.env.SLOPCODE_EXPERIMENTAL = "true"
        delete process.env.SLOPCODE_EXPERIMENTAL_OXFMT
        expect(Flag.SLOPCODE_EXPERIMENTAL_OXFMT).toBe(true)
        process.env.SLOPCODE_EXPERIMENTAL_OXFMT = "false"
        expect(Flag.SLOPCODE_EXPERIMENTAL_OXFMT).toBe(false)
      }),
      (previous) => Effect.sync(() => {
        if (previous.experimental === undefined) delete process.env.SLOPCODE_EXPERIMENTAL
        else process.env.SLOPCODE_EXPERIMENTAL = previous.experimental
        if (previous.oxfmt === undefined) delete process.env.SLOPCODE_EXPERIMENTAL_OXFMT
        else process.env.SLOPCODE_EXPERIMENTAL_OXFMT = previous.oxfmt
      }),
    ),
  )

  it.effect("folds formatter documents with replacement arrays and stable custom order", () =>
    Effect.sync(() => {
      expect(
        Formatter.resolve([
          document(true),
          document({
            prettier: { environment: { BASE: "one" }, extensions: [".first"] },
            custom: { command: ["first", "$FILE"], extensions: [".one"] },
          }),
          document({
            prettier: { environment: { NEXT: "two" }, extensions: [".second"] },
            custom: { command: ["second", "$FILE"], extensions: [".two"] },
            later: { command: ["later", "$FILE"], extensions: [".later"] },
          }),
        ])
          .filter((item) => ["prettier", "custom", "later"].includes(item.name))
          .map((item) => ({ name: item.name, extensions: item.extensions, environment: item.environment })),
      ).toEqual([
        { name: "prettier", extensions: [".second"], environment: { BUN_BE_BUN: "1", BASE: "one", NEXT: "two" } },
        { name: "custom", extensions: [".two"], environment: undefined },
        { name: "later", extensions: [".later"], environment: undefined },
      ])
    }),
  )

  it.effect("uses public aliases and couples ruff and uv disablement", () =>
    Effect.sync(() => {
      const catalog = Formatter.resolve([
        document({
          "clang-format": { extensions: [".clang"] },
          air: { extensions: [".air"] },
          uv: { disabled: true },
        }),
      ])
      expect(catalog.find((item) => item.name === "clang-format")?.extensions).toEqual([".clang"])
      expect(catalog.find((item) => item.name === "air")?.extensions).toEqual([".air"])
      expect(catalog.some((item) => item.name === "ruff" || item.name === "uv")).toBe(false)
    }),
  )

  it.live("runs matching custom formatters sequentially with inert canonical argv", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        const target = path.join(tmp.path, "space ; $(inert).fmt")
        const script =
          "const fs=require('fs');const p=process.argv[1];fs.appendFileSync(p,process.argv[2]);process.stdout.write('x'.repeat(70000));process.stderr.write('y'.repeat(70000))"
        return Effect.promise(() => fs.writeFile(target, "start")).pipe(
          Effect.andThen(
            withFormatter(
              tmp.path,
              [
                document({
                  first: { command: [process.execPath, "-e", script, "$FILE", "A"], extensions: [".fmt"] },
                  second: { command: [process.execPath, "-e", script, "$FILE", "B"], extensions: [".fmt"] },
                }),
              ],
              Effect.gen(function* () {
                const result = yield* (yield* Formatter.Service).format({ canonical: target })
                expect(result.matched).toBe(true)
                expect(result.outcomes).toEqual([
                  expect.objectContaining({ name: "first", code: "formatted", stdoutBytes: 70_000, stderrBytes: 70_000, stdoutTruncated: true, stderrTruncated: true }),
                  expect.objectContaining({ name: "second", code: "formatted" }),
                ])
                expect(yield* Effect.promise(() => fs.readFile(target, "utf8"))).toBe("startAB")
              }),
            ),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("replaces every placeholder, does not append one, and keeps failures nonfatal", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        const target = path.join(tmp.path, "literal ; $() name.edge")
        const marker = path.join(tmp.path, "marker")
        const write = `require('fs').appendFileSync(${JSON.stringify(marker)},process.argv.slice(1).join('|')+'\\n')`
        return Effect.promise(() => fs.writeFile(target, "source")).pipe(
          Effect.andThen(withFormatter(
            tmp.path,
            [document({
              none: { command: [process.execPath, "-e", write], extensions: [".edge"] },
              every: { command: [process.execPath, "-e", write, "$FILE", "before:$FILE:after", "$FILE"], extensions: [".edge"] },
              nonzero: { command: [process.execPath, "-e", "process.exit(7)"], extensions: [".edge"] },
              missing: { command: [path.join(tmp.path, "does-not-exist"), "$FILE"], extensions: [".edge"] },
            })],
            Effect.gen(function* () {
              const formatter = yield* Formatter.Service
              const result = yield* formatter.format({ canonical: target })
              expect(result.outcomes.map((item) => [item.name, item.code, item.exitCode])).toEqual([
                ["none", "formatted", 0],
                ["every", "formatted", 0],
                ["nonzero", "nonzero", 7],
                ["missing", "spawn-error", undefined],
              ])
              expect((yield* Effect.promise(() => fs.readFile(marker, "utf8"))).split("\n")).toEqual([
                "",
                `${target}|before:${target}:after|${target}`,
                "",
              ])
              expect(yield* formatter.format({ canonical: `${target}.UPPER` })).toEqual({ matched: false, outcomes: [] })
              expect(yield* formatter.status()).toEqual(expect.arrayContaining([
                expect.objectContaining({ name: "none", configured: true, available: true, outcome: "available" }),
              ]))
            }),
          )),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.effect("keeps Core formatter sources isolated from V1 and Slopcode runtime imports", () =>
    Effect.promise(async () => {
      const source = await fs.readFile(new URL("../src/formatter.ts", import.meta.url), "utf8")
      expect(source).not.toMatch(/from ["'][^"']*(?:\/v1\/|packages\/slopcode|@\/)/)
      expect(source).not.toContain("shell: true")
    }),
  )
})
