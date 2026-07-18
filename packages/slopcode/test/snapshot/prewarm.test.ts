import { afterEach, expect } from "bun:test"
import { AppProcess } from "@slopcode-ai/core/process"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { ChildProcess } from "effect/unstable/process"
import { Config } from "@/config/config"
import { Snapshot } from "@/snapshot"
import { Context, Deferred, Effect, Exit, Fiber, Layer, Scope } from "effect"
import path from "path"
import { disposeAllInstances, provideInstance, testInstanceStoreLayer, tmpdirScoped } from "../fixture/fixture"
import { testEffect } from "../lib/effect"

const it = testEffect(
  Layer.mergeAll(AppProcess.defaultLayer, FSUtil.defaultLayer, CrossSpawnSpawner.defaultLayer, testInstanceStoreLayer),
)
const settings = [
  "core.autocrlf=false",
  "core.longpaths=true",
  "core.symlinks=true",
  "core.fsmonitor=false",
  "feature.manyFiles=true",
  "index.version=4",
  "index.threads=true",
  "core.untrackedCache=true",
]

afterEach(async () => {
  await disposeAllInstances()
})

function build(appProcess: AppProcess.Interface, fs: FSUtil.Interface) {
  return Effect.gen(function* () {
    const scope = yield* Scope.make()
    yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void))
    const layer = Snapshot.layer.pipe(
      Layer.provide(
        Layer.mergeAll(
          Layer.succeed(AppProcess.Service, appProcess),
          Layer.succeed(FSUtil.Service, fs),
          Config.defaultLayer,
        ),
      ),
    )
    return Context.get(yield* Layer.buildWithScope(Layer.fresh(layer), scope), Snapshot.Service)
  })
}

const tree = (gitdir: string, hash: string) =>
  Effect.promise(async () => {
    const proc = Bun.spawn(["git", "--git-dir", gitdir, "ls-tree", "-r", "--name-only", hash], {
      stdout: "pipe",
      stderr: "pipe",
    })
    const [code, stdout, stderr] = await Promise.all([
      proc.exited,
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
    ])
    if (code !== 0) throw new Error(stderr)
    return stdout.trim().split("\n").filter(Boolean)
  })

it.live("prewarms setup in the background and tracks fresh state after it finishes", () =>
  Effect.gen(function* () {
    const dir = yield* tmpdirScoped({ git: true })
    const real = yield* AppProcess.Service
    const fs = yield* FSUtil.Service
    const started = yield* Deferred.make<void>()
    const release = yield* Deferred.make<void>()
    const commands: Array<{ args: readonly string[]; gitdir?: string }> = []
    const appProcess = AppProcess.Service.of({
      ...real,
      run: (command, options) => {
        const std = ChildProcess.isStandardCommand(command) ? command : undefined
        if (!std || std.command !== "git") return real.run(command, options)
        const gitdir = std.options.env?.GIT_DIR
        commands.push({ args: std.args, gitdir })
        if (!gitdir || !std.args.includes("init")) return real.run(command, options)
        return Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Deferred.await(release)),
          Effect.andThen(real.run(command, options)),
        )
      },
    })
    const snapshot = yield* build(appProcess, fs)

    yield* snapshot.init().pipe(provideInstance(dir))
    yield* Deferred.await(started)
    expect(commands.some((item) => item.args.includes("add") || item.args.includes("write-tree"))).toBe(false)

    const tracking = yield* snapshot.track().pipe(provideInstance(dir), Effect.forkChild)
    yield* Effect.yieldNow
    expect(tracking.pollUnsafe()).toBeUndefined()
    yield* fs.writeFileString(path.join(dir, "after-setup.txt"), "fresh")
    yield* Deferred.succeed(release, undefined)

    const hash = yield* Fiber.join(tracking)
    expect(hash).toBeTruthy()
    const gitdir = commands.find((item) => item.gitdir)?.gitdir
    expect(gitdir).toBeTruthy()
    expect(yield* tree(gitdir!, hash!)).toContain("after-setup.txt")
    expect(commands.some((item) => item.args.includes("config"))).toBe(false)

    for (const item of commands.filter(
      (item) => item.gitdir === gitdir || item.args[item.args.indexOf("--git-dir") + 1] === gitdir,
    )) {
      for (const setting of settings) expect(item.args).toContain(setting)
    }
  }),
)

it.live("keeps source excludes live and skips identical private exclude writes", () =>
  Effect.gen(function* () {
    const dir = yield* tmpdirScoped({ git: true })
    const real = yield* AppProcess.Service
    const realFs = yield* FSUtil.Service
    const commands: Array<readonly string[]> = []
    const writes: string[] = []
    const appProcess = AppProcess.Service.of({
      ...real,
      run: (command, options) => {
        const std = ChildProcess.isStandardCommand(command) ? command : undefined
        if (std?.command === "git") commands.push(std.args)
        return real.run(command, options)
      },
    })
    const fs = FSUtil.Service.of({
      ...realFs,
      writeFileString: (file, content, options) => {
        if (file.endsWith(path.join("info", "exclude")) && file !== path.join(dir, ".git", "info", "exclude")) {
          writes.push(file)
        }
        return realFs.writeFileString(file, content, options)
      },
    })
    const snapshot = yield* build(appProcess, fs)

    yield* snapshot.init().pipe(provideInstance(dir))
    const before = yield* snapshot.track().pipe(provideInstance(dir))
    expect(before).toBeTruthy()
    const count = writes.length
    const source = path.join(dir, ".git", "info", "exclude")
    yield* realFs.writeFileString(source, `${(yield* realFs.readFileString(source)).trimEnd()}\nruntime.tmp\n`)
    yield* realFs.writeFileString(path.join(dir, "runtime.tmp"), "ignored")
    yield* realFs.writeFileString(path.join(dir, "visible.txt"), "visible")

    const after = yield* snapshot.track().pipe(provideInstance(dir))
    expect(after).toBeTruthy()
    expect(writes.length).toBe(count + 1)
    expect(commands.filter((args) => args.includes("info/exclude")).length).toBe(1)
    const gitdir = commands
      .filter((args) => args.includes("--git-dir"))
      .map((args) => args[args.indexOf("--git-dir") + 1])
      .find(Boolean)
    expect(gitdir).toBeTruthy()
    expect(yield* tree(gitdir!, after!)).toContain("visible.txt")
    expect(yield* tree(gitdir!, after!)).not.toContain("runtime.tmp")

    yield* snapshot.track().pipe(provideInstance(dir))
    expect(writes.length).toBe(count + 1)
    expect(commands.filter((args) => args.includes("info/exclude")).length).toBe(1)
  }),
)

it.live("isolates background setup errors so track can retry authoritatively", () =>
  Effect.gen(function* () {
    const dir = yield* tmpdirScoped({ git: true })
    const real = yield* AppProcess.Service
    const fs = yield* FSUtil.Service
    const failed = yield* Deferred.make<void>()
    const attempts = { value: 0 }
    const appProcess = AppProcess.Service.of({
      ...real,
      run: (command, options) => {
        const std = ChildProcess.isStandardCommand(command) ? command : undefined
        if (std?.command !== "git" || !std.options.env?.GIT_DIR || !std.args.includes("init")) {
          return real.run(command, options)
        }
        attempts.value += 1
        if (attempts.value > 1) return real.run(command, options)
        return Deferred.succeed(failed, undefined).pipe(
          Effect.as({
            command: "git init",
            exitCode: 1,
            stdout: Buffer.from(""),
            stderr: Buffer.from("setup failed"),
            stdoutTruncated: false,
            stderrTruncated: false,
          } satisfies AppProcess.RunResult),
        )
      },
    })
    const snapshot = yield* build(appProcess, fs)

    yield* snapshot.init().pipe(provideInstance(dir))
    yield* Deferred.await(failed)
    expect(yield* snapshot.track().pipe(provideInstance(dir))).toBeTruthy()
    expect(attempts.value).toBe(2)
  }),
)
