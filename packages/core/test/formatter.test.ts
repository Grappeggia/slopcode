import fs from "fs/promises"
import path from "path"
import { describe, expect } from "bun:test"
import { Effect, Layer } from "effect"
import { AppProcess } from "@slopcode-ai/core/process"
import { Config } from "@slopcode-ai/core/config"
import { Formatter } from "@slopcode-ai/core/formatter"
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
  new Config.Document({ type: "document", info: new Config.Info({ formatter }) })

describe("Formatter", () => {
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
        ]).map((item) => ({ name: item.name, extensions: item.extensions, environment: item.environment })),
      ).toEqual([
        expect.objectContaining({ name: "prettier", extensions: [".second"], environment: { BASE: "one", NEXT: "two" } }),
        expect.objectContaining({ name: "custom", extensions: [".two"] }),
        expect.objectContaining({ name: "later", extensions: [".later"] }),
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

  it.effect("keeps Core formatter sources isolated from V1 and Slopcode runtime imports", () =>
    Effect.promise(async () => {
      const source = await fs.readFile(new URL("../src/formatter.ts", import.meta.url), "utf8")
      expect(source).not.toMatch(/from ["'][^"']*(?:\/v1\/|packages\/slopcode|@\/)/)
      expect(source).not.toContain("shell: true")
    }),
  )
})
