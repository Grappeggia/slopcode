import { afterEach, expect } from "bun:test"
import { AppProcess } from "@slopcode-ai/core/process"
import { FSUtil } from "@slopcode-ai/core/fs-util"
import { CrossSpawnSpawner } from "@slopcode-ai/core/cross-spawn-spawner"
import { ChildProcess } from "effect/unstable/process"
import { Config } from "@/config/config"
import { Snapshot } from "@/snapshot"
import { Context, Deferred, Effect, Exit, Layer, Scope } from "effect"
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
type Command = { args: readonly string[]; gitdir?: string }

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

function commandIndex(args: readonly string[]) {
  for (let i = 0; i < args.length; ) {
    if (args[i] === "-c" || args[i] === "--git-dir" || args[i] === "--work-tree") {
      i += 2
      continue
    }
    return i
  }
  return -1
}

const command = (args: readonly string[]) => args[commandIndex(args)]

function privateCommands(commands: Command[], gitdir: string) {
  return commands.filter((item) => item.gitdir === gitdir || item.args[item.args.indexOf("--git-dir") + 1] === gitdir)
}

function expectTuning(item: Command) {
  const index = commandIndex(item.args)
  expect(index).toBeGreaterThan(0)
  const options = item.args.slice(0, index)
  for (const setting of settings) {
    const at = options.indexOf(setting)
    expect(at).toBeGreaterThan(0)
    expect(options[at - 1]).toBe("-c")
  }
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
    const commands: Command[] = []
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
    expect(command(commands.at(-1)!.args)).toBe("init")
    yield* Deferred.succeed(release, undefined)

    // cleanup acquires the same semaphore, so its return proves setup completed.
    yield* snapshot.cleanup().pipe(provideInstance(dir))
    const setup = commands.slice()
    expect(setup.map((item) => command(item.args))).not.toContain("add")
    expect(setup.map((item) => command(item.args))).not.toContain("diff-files")
    expect(setup.map((item) => command(item.args))).not.toContain("ls-files")
    expect(setup.map((item) => command(item.args))).not.toContain("write-tree")

    yield* fs.writeFileString(path.join(dir, "after-setup.txt"), "fresh")
    const hash = yield* snapshot.track().pipe(provideInstance(dir))

    expect(hash).toBeTruthy()
    const gitdir = commands.find((item) => item.gitdir)?.gitdir
    expect(gitdir).toBeTruthy()
    expect(yield* tree(gitdir!, hash!)).toContain("after-setup.txt")
    expect(commands.some((item) => item.args.includes("config"))).toBe(false)

    const privateGit = privateCommands(commands, gitdir!)
    for (const item of privateGit) expectTuning(item)
    const categories = new Set(privateGit.map((item) => command(item.args)))
    for (const category of ["init", "gc", "diff-files", "ls-files", "add", "write-tree"]) {
      expect(categories).toContain(category)
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

it.live("retries setup after partial initialization before authoritative track", () =>
  Effect.gen(function* () {
    const dir = yield* tmpdirScoped({ git: true })
    const real = yield* AppProcess.Service
    const realFs = yield* FSUtil.Service
    const failed = yield* Deferred.make<void>()
    const attempts = { value: 0 }
    const target = { value: undefined as string | undefined }
    const fs = FSUtil.Service.of({
      ...realFs,
      writeFileString: (file, content, options) => {
        if (file.endsWith(path.join("objects", "info", "alternates")) && !file.startsWith(path.join(dir, ".git"))) {
          target.value = file
          attempts.value += 1
          if (attempts.value === 1) {
            return Deferred.succeed(failed, undefined).pipe(
              Effect.andThen(Effect.die("partial snapshot setup failure")),
            )
          }
        }
        return realFs.writeFileString(file, content, options)
      },
    })
    const snapshot = yield* build(real, fs)

    yield* snapshot.init().pipe(provideInstance(dir))
    yield* Deferred.await(failed)
    expect(target.value).toBeTruthy()
    const gitdir = path.resolve(target.value!, "../../..")
    expect(yield* realFs.exists(path.join(gitdir, "HEAD"))).toBe(true)
    expect(yield* snapshot.track().pipe(provideInstance(dir))).toBeTruthy()
    expect(attempts.value).toBe(2)
    expect(yield* realFs.exists(path.join(gitdir, "info", "exclude"))).toBe(true)
  }),
)
