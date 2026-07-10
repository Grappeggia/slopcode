import fs from "fs/promises"
import { realpathSync } from "node:fs"
import path from "path"
import { describe, expect, test } from "bun:test"
import { Effect, Layer } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { Config } from "@slopcode-ai/core/config"
import { Location } from "@slopcode-ai/core/location"
import { LocationMutation } from "@slopcode-ai/core/location-mutation"
import { PermissionV2 } from "@slopcode-ai/core/permission"
import { AppProcess } from "@slopcode-ai/core/process"
import { AbsolutePath } from "@slopcode-ai/core/schema"
import { SessionV2 } from "@slopcode-ai/core/session"
import { ShellParser } from "@slopcode-ai/core/shell-parser"
import { BashTool } from "@slopcode-ai/core/tool/bash"
import { ToolRegistry } from "@slopcode-ai/core/tool/registry"
import { location } from "./fixture/location"
import { tmpdir } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"
import { toolIdentity, executeTool, settleTool, toolDefinitions } from "./lib/tool"

const sessionID = SessionV2.ID.make("ses_bash_tool_test")
const assertions: PermissionV2.AssertInput[] = []
const runs: Array<{
  readonly command: string
  readonly cwd?: string
  readonly shell?: string | boolean
  readonly options?: AppProcess.RunOptions
}> = []
let denyAction: string | undefined
let rules: PermissionV2.Ruleset | undefined
let configuredShell: string | undefined
let result: AppProcess.RunResult = {
  command: "mock",
  exitCode: 0,
  stdout: Buffer.from("hello\n"),
  stderr: Buffer.alloc(0),
  stdoutTruncated: false,
  stderrTruncated: false,
}
let runFailure: AppProcess.AppProcessError | undefined
let afterPermission = (_input: PermissionV2.AssertInput): Effect.Effect<void> => Effect.void

const permission = Layer.succeed(
  PermissionV2.Service,
  PermissionV2.Service.of({
    assert: (input) =>
      Effect.sync(() => assertions.push(input)).pipe(
        Effect.andThen(Effect.suspend(() => afterPermission(input))),
        Effect.andThen(
          Effect.suspend(() => {
            if (input.action === denyAction) return Effect.fail(new PermissionV2.DeniedError({ rules: [] }))
            const configured = rules
            if (!configured) return Effect.void
            const effects = input.resources.map(
              (resource) => PermissionV2.evaluate(input.action, resource, configured).effect,
            )
            if (effects.includes("deny")) return Effect.fail(new PermissionV2.DeniedError({ rules: configured }))
            if (effects.includes("ask")) return Effect.fail(new PermissionV2.RejectedError())
            return Effect.void
          }),
        ),
      ),
    ask: () => Effect.die("unused"),
    reply: () => Effect.die("unused"),
    get: () => Effect.die("unused"),
    forSession: () => Effect.die("unused"),
    list: () => Effect.die("unused"),
  }),
)
const appProcess = Layer.succeed(
  AppProcess.Service,
  AppProcess.Service.of({
    run: (command: ChildProcess.Command, options?: AppProcess.RunOptions) =>
      Effect.suspend(() => {
        if (command._tag !== "StandardCommand") throw new Error("expected standard command")
        runs.push({ command: command.command, cwd: command.options.cwd, shell: command.options.shell, options })
        return runFailure ? Effect.fail(runFailure) : Effect.succeed(result)
      }),
  } as unknown as AppProcess.Interface),
)
const config = Layer.succeed(
  Config.Service,
  Config.Service.of({
    entries: () =>
      Effect.succeed(
        configuredShell
          ? [new Config.Document({ type: "document", info: new Config.Info({ shell: configuredShell }) })]
          : [],
      ),
  }),
)

const reset = () => {
  assertions.length = 0
  runs.length = 0
  denyAction = undefined
  rules = undefined
  configuredShell = undefined
  runFailure = undefined
  afterPermission = () => Effect.void
  result = {
    command: "mock",
    exitCode: 0,
    stdout: Buffer.from("hello\n"),
    stderr: Buffer.alloc(0),
    stdoutTruncated: false,
    stderrTruncated: false,
  }
}

const withTool = <A, E, R>(
  directory: string,
  body: (registry: ToolRegistry.Interface) => Effect.Effect<A, E, R>,
  processLayer: Layer.Layer<AppProcess.Service> = appProcess,
) => {
  const filesystem = FSUtil.defaultLayer
  const activeLocation = Layer.succeed(
    Location.Service,
    Location.Service.of(location({ directory: AbsolutePath.make(directory) })),
  )
  const mutation = LocationMutation.layer.pipe(Layer.provide(filesystem), Layer.provide(activeLocation))
  const registry = ToolRegistry.defaultLayer.pipe(Layer.provide(permission))
  const bash = BashTool.layer.pipe(
    Layer.provide(registry),
    Layer.provide(permission),
    Layer.provide(mutation),
    Layer.provide(filesystem),
    Layer.provide(processLayer),
    Layer.provide(config),
  )
  return Effect.gen(function* () {
    return yield* body(yield* ToolRegistry.Service)
  }).pipe(Effect.provide(Layer.mergeAll(registry, bash)))
}

const call = (input: typeof BashTool.Input.Type, id = "call-bash") => ({
  sessionID,
  ...toolIdentity,
  call: { type: "tool-call" as const, id, name: "bash", input },
})

const it = testEffect(Layer.empty)

describe("BashTool", () => {
  it.live("registers and returns structured successful output from the active Location", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        return withTool(tmp.path, (registry) =>
          Effect.gen(function* () {
            const definitions = yield* toolDefinitions(registry)
            expect(definitions.map((tool) => tool.name)).toEqual(["bash"])
            expect(definitions[0]?.inputSchema).not.toHaveProperty("properties.background")
            expect(yield* toolDefinitions(registry, [{ action: "bash", resource: "*", effect: "deny" }])).toEqual([])
            expect(
              yield* settleTool(registry, call({ command: "pwd", description: "Print working directory" })),
            ).toEqual({
              result: { type: "text", value: "hello\n\n\nCommand exited with code 0." },
              output: {
                structured: {
                  command: "pwd",
                  cwd: realpathSync(tmp.path),
                  exitCode: 0,
                  output: "hello\n",
                  truncated: false,
                },
                content: [{ type: "text", text: "hello\n\n\nCommand exited with code 0." }],
              },
            })
            expect(runs).toMatchObject([{ command: "pwd", cwd: realpathSync(tmp.path) }])
            expect(runs[0]?.options).toMatchObject({
              maxOutputBytes: BashTool.MAX_CAPTURE_BYTES,
              maxErrorBytes: BashTool.MAX_CAPTURE_BYTES,
            })
            expect(assertions).toMatchObject([{ sessionID, action: "bash", resources: ["pwd"], save: ["pwd"] }])
          }),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("resolves a relative workdir from the active Location", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        return Effect.promise(() => fs.mkdir(path.join(tmp.path, "src"))).pipe(
          Effect.andThen(
            withTool(tmp.path, (registry) => executeTool(registry, call({ command: "pwd", workdir: "src" }))),
          ),
          Effect.andThen(
            Effect.sync(() => expect(runs).toMatchObject([{ cwd: realpathSync(path.join(tmp.path, "src")) }])),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("rejects a workdir that stops being a directory during approval", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        const workdir = path.join(tmp.path, "src")
        afterPermission = (input) =>
          input.action === "bash"
            ? Effect.promise(async () => {
                await fs.rm(workdir, { recursive: true })
                await fs.writeFile(workdir, "not a directory")
              }).pipe(Effect.orDie)
            : Effect.void
        return Effect.promise(() => fs.mkdir(workdir)).pipe(
          Effect.andThen(
            withTool(tmp.path, (registry) => executeTool(registry, call({ command: "pwd", workdir: "src" }))),
          ),
          Effect.andThen(
            Effect.sync(() => {
              expect(runs).toEqual([])
              expect(assertions.map((input) => input.action)).toEqual(["bash"])
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  if (process.platform !== "win32") {
    it.live("executes a real shell command through AppProcess", () =>
      Effect.acquireUseRelease(
        Effect.promise(() => tmpdir()),
        (tmp) => {
          reset()
          return withTool(
            tmp.path,
            (registry) => settleTool(registry, call({ command: "printf core-bash" })),
            AppProcess.defaultLayer,
          ).pipe(
            Effect.andThen((settled) =>
              Effect.sync(() => {
                expect(settled.result).toEqual({ type: "text", value: "core-bash\n\nCommand exited with code 0." })
                expect(settled.output?.structured).toMatchObject({
                  command: "printf core-bash",
                  cwd: realpathSync(tmp.path),
                  exitCode: 0,
                  output: "core-bash",
                })
              }),
            ),
          )
        },
        (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
      ),
    )

    for (const shell of [Bun.which("dash"), Bun.which("sh")].filter((item): item is string => Boolean(item))) {
      it.live(
        `does not execute a dash-style appended command with git-only authorization [${path.basename(shell)}]`,
        () =>
          Effect.acquireUseRelease(
            Effect.promise(() => tmpdir()),
            (tmp) => {
              reset()
              configuredShell = shell
              rules = [
                { action: "bash", resource: "*", effect: "ask" },
                { action: "bash", resource: "git *", effect: "allow" },
              ]
              const marker = path.join(tmp.path, "appended-command-ran")
              const command = `git status &> /dev/null touch "${marker}"`
              return withTool(
                tmp.path,
                (registry) => settleTool(registry, call({ command })),
                AppProcess.defaultLayer,
              ).pipe(
                Effect.andThen((settled) =>
                  Effect.promise(async () => {
                    expect(settled.result).toMatchObject({ type: "error" })
                    expect(assertions[0]?.resources).toEqual([ShellParser.opaque(shell, command)])
                    expect(assertions[0]?.metadata).toEqual({ command, shell })
                    expect(await Bun.file(marker).exists()).toBeFalse()
                  }),
                ),
              )
            },
            (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
          ),
      )
    }
  }

  if (process.platform === "win32") {
    const shell = process.env.COMSPEC ?? Bun.which("cmd.exe")
    if (shell) {
      it.live("does not execute a cmd command after a quoted caret with git-only authorization", () =>
        Effect.acquireUseRelease(
          Effect.promise(() => tmpdir()),
          (tmp) => {
            reset()
            configuredShell = shell
            rules = [
              { action: "bash", resource: "*", effect: "ask" },
              { action: "bash", resource: "git *", effect: "allow" },
            ]
            const marker = path.join(tmp.path, "cmd-appended-command-ran")
            const command = `git status "foo^" & type nul > "${marker}"`
            return withTool(
              tmp.path,
              (registry) => settleTool(registry, call({ command })),
              AppProcess.defaultLayer,
            ).pipe(
              Effect.andThen((settled) =>
                Effect.promise(async () => {
                  expect(settled.result).toMatchObject({ type: "error" })
                  expect(assertions[0]?.resources).toEqual([ShellParser.opaque(shell, command)])
                  expect(await Bun.file(marker).exists()).toBeFalse()
                }),
              ),
            )
          },
          (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
        ),
      )
    }
  }

  it.live("approves an explicit external workdir before bash execution", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        reset()
        return withTool(active.path, (registry) =>
          executeTool(registry, call({ command: "pwd", workdir: outside.path })),
        ).pipe(
          Effect.andThen(
            Effect.sync(() => {
              expect(assertions.map((item) => item.action)).toEqual(["external_directory", "bash"])
              expect(assertions[0]).toMatchObject({
                resources: [path.join(realpathSync(outside.path), "*").replaceAll("\\", "/")],
              })
              expect(runs).toHaveLength(1)
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  it.live("does not execute after external-directory or bash denial", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) =>
        Effect.gen(function* () {
          reset()
          denyAction = "external_directory"
          yield* withTool(active.path, (registry) =>
            executeTool(registry, call({ command: "pwd", workdir: outside.path })),
          )
          expect(assertions.map((item) => item.action)).toEqual(["external_directory"])
          expect(runs).toEqual([])

          reset()
          denyAction = "bash"
          yield* withTool(active.path, (registry) => executeTool(registry, call({ command: "pwd" })))
          expect(assertions.map((item) => item.action)).toEqual(["bash"])
          expect(runs).toEqual([])
        }),
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  it.live("authorizes every atomic command before creating a process", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        configuredShell = "/bin/bash"
        rules = [
          { action: "bash", resource: "*", effect: "ask" },
          { action: "bash", resource: "git *", effect: "allow" },
          { action: "bash", resource: "rm *", effect: "deny" },
        ]
        return withTool(tmp.path, (registry) =>
          settleTool(registry, call({ command: "git status; rm -rf target" })),
        ).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.result).toMatchObject({ type: "error" })
              expect(assertions).toHaveLength(1)
              expect(assertions[0]).toMatchObject({
                action: "bash",
                resources: ["git status", "rm -rf target"],
                save: ["git status", "rm -rf target"],
              })
              expect(runs).toEqual([])
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("does not execute a compound command until every resource is authorized", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        configuredShell = "/bin/bash"
        rules = [
          { action: "bash", resource: "*", effect: "ask" },
          { action: "bash", resource: "git *", effect: "allow" },
        ]
        return withTool(tmp.path, (registry) =>
          settleTool(registry, call({ command: "git status; rm -rf target" })),
        ).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.result).toMatchObject({ type: "error" })
              expect(assertions[0]?.resources).toEqual(["git status", "rm -rf target"])
              expect(runs).toEqual([])
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("requires authorization for a PowerShell expression redirect before a trailing git command", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        configuredShell = "pwsh.exe"
        rules = [
          { action: "bash", resource: "*", effect: "ask" },
          { action: "bash", resource: "git *", effect: "allow" },
        ]
        const command = '"payload" > target | git status'
        return withTool(tmp.path, (registry) => settleTool(registry, call({ command }))).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.result).toMatchObject({ type: "error" })
              expect(assertions[0]?.resources).toEqual(['"payload" > target', "git status"])
              expect(runs).toEqual([])
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("requires authorization for redirected PowerShell script-block wrappers", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        configuredShell = "pwsh.exe"
        rules = [
          { action: "bash", resource: "*", effect: "ask" },
          { action: "bash", resource: "git *", effect: "allow" },
        ]
        const command = "& { git status } > target"
        return withTool(tmp.path, (registry) => settleTool(registry, call({ command }))).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.result).toMatchObject({ type: "error" })
              expect(assertions[0]?.resources).toEqual([command, "git status"])
              expect(assertions[0]?.metadata).toEqual({ command, shell: "pwsh.exe" })
              expect(runs).toEqual([])
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("parses with the configured shell and fails closed before permission", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          reset()
          configuredShell = "/bin/bash"
          yield* withTool(tmp.path, (registry) => executeTool(registry, call({ command: "printf configured" })))
          expect(runs[0]?.shell).toBe("/bin/bash")

          reset()
          configuredShell = "/usr/bin/fish"
          const unsupported = yield* withTool(tmp.path, (registry) =>
            settleTool(registry, call({ command: "printf unsupported" })),
          )
          expect(unsupported.result).toMatchObject({
            type: "error",
            value: expect.stringContaining("Unable to safely authorize command"),
          })
          expect(assertions).toEqual([])
          expect(runs).toEqual([])

          reset()
          const malformed = yield* withTool(tmp.path, (registry) =>
            settleTool(registry, call({ command: 'git status; "' })),
          )
          expect(malformed.result).toMatchObject({
            type: "error",
            value: expect.stringContaining("Unable to safely authorize command"),
          })
          expect(assertions).toEqual([])
          expect(runs).toEqual([])
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("never default-allows zero-resource shell statements", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) =>
        Effect.gen(function* () {
          for (const item of [
            { shell: "/bin/bash", command: "" },
            { shell: "/bin/bash", command: "# comment" },
            { shell: "pwsh.exe", command: "exit" },
          ]) {
            reset()
            configuredShell = item.shell
            rules = [{ action: "bash", resource: "*", effect: "deny" }]
            const denied = yield* withTool(tmp.path, (registry) =>
              settleTool(registry, call({ command: item.command })),
            )
            expect(denied.result).toMatchObject({ type: "error" })
            expect(assertions[0]?.resources).toEqual([ShellParser.opaque(item.shell, item.command)])
            expect(runs).toEqual([])
          }

          reset()
          configuredShell = "/bin/bash"
          rules = [{ action: "bash", resource: "*", effect: "allow" }]
          const empty = yield* withTool(tmp.path, (registry) => settleTool(registry, call({ command: "" })))
          expect(empty.result).toMatchObject({ type: "text" })
          expect(assertions[0]?.resources).toEqual([ShellParser.opaque("/bin/bash", "")])
          expect(runs).toHaveLength(1)

          reset()
          configuredShell = "/bin/sh"
          rules = [{ action: "bash", resource: "*", effect: "allow" }]
          const command = "git status; printf intentionally-allowed"
          const allowed = yield* withTool(tmp.path, (registry) => settleTool(registry, call({ command })))
          expect(allowed.result).toMatchObject({ type: "text" })
          expect(assertions[0]?.resources).toEqual([ShellParser.opaque("/bin/sh", command)])
          expect(runs).toHaveLength(1)
        }),
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("reports external command arguments as advisory warnings without enforcing approval", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => Promise.all([tmpdir(), tmpdir()])),
      ([active, outside]) => {
        reset()
        denyAction = "external_directory"
        const target = path.join(outside.path, "secret.txt")
        return withTool(active.path, (registry) => settleTool(registry, call({ command: `cat ${target}` }))).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(assertions.map((item) => item.action)).toEqual(["bash"])
              expect(runs).toHaveLength(1)
              expect(settled.output?.structured).toMatchObject({
                warnings: [
                  `Command argument references external directory ${path.join(realpathSync(outside.path), "*").replaceAll("\\", "/")}. Bash runs with host-user filesystem, process, and network authority; this scan is advisory only.`,
                ],
              })
              expect(settled.result).toMatchObject({ type: "text", value: expect.stringContaining("Warnings:") })
            }),
          ),
        )
      },
      ([active, outside]) =>
        Effect.promise(() =>
          Promise.all([active[Symbol.asyncDispose](), outside[Symbol.asyncDispose]()]).then(() => undefined),
        ),
    ),
  )

  it.live("keeps non-zero exits useful", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        result = { ...result, exitCode: 7, stdout: Buffer.from("HEAD full output TAIL") }
        return withTool(tmp.path, (registry) => settleTool(registry, call({ command: "false" }, "call-overflow"))).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.result).toMatchObject({
                type: "text",
                value: expect.stringContaining("Command exited with code 7"),
              })
              expect(settled.output?.structured).toMatchObject({
                command: "false",
                cwd: realpathSync(tmp.path),
                exitCode: 7,
                output: "HEAD full output TAIL",
                truncated: false,
              })
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("surfaces bounded process-capture truncation", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        result = { ...result, stdoutTruncated: true }
        return withTool(tmp.path, (registry) => settleTool(registry, call({ command: "verbose" }))).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.output?.structured).toMatchObject({ truncated: true, stdoutTruncated: true })
              expect(settled.result).toMatchObject({
                type: "text",
                value: expect.stringContaining("stdout capture truncated"),
              })
              expect(settled.output?.structured).not.toHaveProperty("resource")
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )

  it.live("returns a useful timeout settlement", () =>
    Effect.acquireUseRelease(
      Effect.promise(() => tmpdir()),
      (tmp) => {
        reset()
        runFailure = new AppProcess.AppProcessError({ command: "sleep", cause: new Error("Timed out") })
        return withTool(tmp.path, (registry) => settleTool(registry, call({ command: "sleep 60", timeout: 10 }))).pipe(
          Effect.andThen((settled) =>
            Effect.sync(() => {
              expect(settled.result).toMatchObject({
                type: "text",
                value: expect.stringContaining("Command timed out"),
              })
              expect(settled.output?.structured).toMatchObject({
                command: "sleep 60",
                timedOut: true,
                truncated: false,
              })
            }),
          ),
        )
      },
      (tmp) => Effect.promise(() => tmp[Symbol.asyncDispose]()),
    ),
  )
})

test("keeps locked deferred parity TODOs visible", async () => {
  const source = await fs.readFile(new URL("../src/tool/bash.ts", import.meta.url), "utf8")
  for (const todo of [
    "Port BashArity reusable command-prefix approvals.",
    "Replace token-based command-argument external-directory advisories with parser-based detection.",
    "Restore PowerShell and cmd-specific invocation/path handling on Windows.",
    "Add plugin shell.env environment augmentation once V2 plugin hooks exist.",
    "Add durable/live progress metadata streaming for long-running commands once V2 tool invocation progress context is wired.",
    "Persist background job status and define restart recovery before exposing remote observation.",
    "Revisit process-group cleanup and platform coverage with shell-specific tests if current AppProcess semantics do not fully cover it.",
    "Revisit binary output handling if stdout/stderr decoding is text-only.",
    "Stream full shell output into managed storage while retaining only a bounded in-memory preview.",
  ]) {
    expect(source).toContain(`TODO: ${todo}`)
  }
})
