import { afterEach, describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"

const launcher = path.join(__dirname, "../bin/slopcode")
const postinstall = path.join(__dirname, "../script/postinstall.mjs")
const clean: string[] = []

afterEach(async () => {
  await Promise.all(clean.splice(0).map((item) => fs.rm(item, { recursive: true, force: true })))
})

async function temp() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-launcher-"))
  const bin = path.join(dir, "bin")
  await fs.mkdir(bin, { recursive: true })
  clean.push(dir)
  return { dir, bin }
}

async function script(file: string, content: string) {
  await Bun.write(file, content)
  await fs.chmod(file, 0o755)
}

async function run(env: Record<string, string>, args: string[] = [], file = launcher) {
  const proc = Bun.spawn([file, ...args], {
    env: {
      ...process.env,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })

  return {
    code: await proc.exited,
    stdout: proc.stdout ? await new Response(proc.stdout).text() : "",
    stderr: proc.stderr ? await new Response(proc.stderr).text() : "",
  }
}

async function runPostinstall(file: string, env: Record<string, string>) {
  const proc = Bun.spawn([process.execPath, file], {
    env: {
      ...process.env,
      ...env,
    },
    stdout: "pipe",
    stderr: "pipe",
  })

  return {
    code: await proc.exited,
    stdout: proc.stdout ? await new Response(proc.stdout).text() : "",
    stderr: proc.stderr ? await new Response(proc.stderr).text() : "",
  }
}

async function stagePostinstall() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-staged-postinstall-"))
  clean.push(dir)
  await fs.copyFile(postinstall, path.join(dir, "postinstall.mjs"))
  await Bun.write(path.join(dir, "package.json"), JSON.stringify({ version: "1.2.3" }))
  return path.join(dir, "postinstall.mjs")
}

async function stageLauncher() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-staged-launcher-"))
  clean.push(dir)
  const root = path.join(dir, "pkg")
  const bin = path.join(root, "bin")
  const nodeModules = path.join(root, "node_modules")
  await fs.mkdir(bin, { recursive: true })
  await fs.mkdir(nodeModules, { recursive: true })
  await fs.copyFile(launcher, path.join(bin, "slopcode"))
  await fs.chmod(path.join(bin, "slopcode"), 0o755)
  await Bun.write(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }))

  const platforms: Record<string, string> = {
    darwin: "darwin",
    linux: "linux",
    win32: "windows",
  }
  const archs: Record<string, string> = {
    x64: "x64",
    arm64: "arm64",
    arm: "arm",
  }
  const platform = platforms[process.platform] ?? process.platform
  const arch = archs[process.arch] ?? process.arch
  const baseNames = [
    `${platform}-${arch}`,
    arch === "x64" ? `${platform}-${arch}-baseline` : "",
    platform === "linux" ? `${platform}-${arch}-musl` : "",
    platform === "linux" && arch === "x64" ? `${platform}-${arch}-baseline-musl` : "",
  ].filter(Boolean)
  const binary = platform === "windows" ? "slopcode.exe" : "slopcode"

  for (const prefix of ["slopcode-bin", "slopcode"]) {
    for (const name of baseNames.map((item) => `${prefix}-${item}`)) {
      const pkg = path.join(nodeModules, name)
      await fs.mkdir(path.join(pkg, "bin"), { recursive: true })
      await Bun.write(path.join(pkg, "package.json"), JSON.stringify({ name, version: "1.2.3" }))
      await script(path.join(pkg, "bin", binary), `#!/bin/sh\necho resolved\n`)
    }
  }

  return {
    root,
    launcher: path.join(bin, "slopcode"),
    binary,
    platform,
    arch,
  }
}

describe("bin launcher", () => {
  test("prefers node when both runtimes exist", async () => {
    if (process.platform === "win32") return
    const dir = await temp()

    await script(path.join(dir.bin, "sh"), '#!/bin/sh\nexec /bin/sh "$@"\n')
    await script(path.join(dir.bin, "bun"), "#!/bin/sh\necho bun\n")
    await script(path.join(dir.bin, "node"), "#!/bin/sh\necho node\n")

    const out = await run({ PATH: dir.bin })
    expect(out.code).toBe(0)
    expect(out.stdout.trim()).toBe("node")
  })

  test("falls back to bun when node is missing", async () => {
    if (process.platform === "win32") return
    const dir = await temp()

    await script(path.join(dir.bin, "sh"), '#!/bin/sh\nexec /bin/sh "$@"\n')
    await script(path.join(dir.bin, "bun"), "#!/bin/sh\necho bun\n")

    const out = await run({ PATH: dir.bin })
    expect(out.code).toBe(0)
    expect(out.stdout.trim()).toBe("bun")
  })

  test("prints clear error when no runtime exists", async () => {
    if (process.platform === "win32") return
    const dir = await temp()

    await script(path.join(dir.bin, "sh"), '#!/bin/sh\nexec /bin/sh "$@"\n')

    const out = await run({ PATH: dir.bin })
    expect(out.code).toBe(127)
    expect(out.stderr).toContain("slopcode requires bun or node in PATH")
  })

  test("runs with bun-only PATH when node is unavailable", async () => {
    if (process.platform === "win32") return
    const dir = await temp()

    await script(path.join(dir.bin, "sh"), '#!/bin/sh\nexec /bin/sh "$@"\n')
    await script(path.join(dir.bin, "bun"), `#!/bin/sh\nexec "${process.execPath}" "$@"\n`)

    const out = await run(
      {
        PATH: dir.bin,
        SLOPCODE_BIN_PATH: "/bin/echo",
      },
      ["ok"],
    )

    expect(out.code).toBe(0)
    expect(out.stdout.trim()).toBe("ok")
  })

  test("ignores stale cached binaries when cache metadata no longer matches", async () => {
    if (process.platform === "win32") return
    const staged = await stageLauncher()
    await script(path.join(staged.root, "bin", ".slopcode"), "#!/bin/sh\necho cached\n")
    await Bun.write(
      path.join(staged.root, "bin", ".slopcode.json"),
      JSON.stringify({
        version: "0.0.1",
        platform: staged.platform,
        arch: staged.arch,
        libc: "glibc",
        package: `slopcode-bin-${staged.platform}-${staged.arch}`,
        binary: staged.binary,
        sidecar: false,
      }),
    )

    const out = await run({}, [], staged.launcher)
    expect(out.code).toBe(0)
    expect(out.stdout.trim()).toBe("resolved")
    expect(await Bun.file(path.join(staged.root, "bin", ".slopcode")).exists()).toBe(false)
    expect(await Bun.file(path.join(staged.root, "bin", ".slopcode.json")).exists()).toBe(false)
  })

  test("resolves Android runtime package instead of Linux binaries", async () => {
    if (process.platform === "win32") return
    const staged = await stageLauncher()
    const android = path.join(staged.root, "node_modules", "slopcode-bin-android-arm64")
    await fs.mkdir(path.join(android, "bin"), { recursive: true })
    await Bun.write(path.join(android, "package.json"), JSON.stringify({ name: "slopcode-bin-android-arm64" }))
    await script(path.join(android, "bin", "slopcode"), "#!/bin/sh\necho android\n")

    const linux = path.join(staged.root, "node_modules", "slopcode-bin-linux-arm64")
    await fs.mkdir(path.join(linux, "bin"), { recursive: true })
    await Bun.write(path.join(linux, "package.json"), JSON.stringify({ name: "slopcode-bin-linux-arm64" }))
    await script(path.join(linux, "bin", "slopcode"), "#!/bin/sh\necho linux\n")

    const out = await run(
      {
        SLOPCODE_TEST_PLATFORM: "android",
        SLOPCODE_TEST_ARCH: "arm64",
        TERMUX_VERSION: "1",
      },
      [],
      staged.launcher,
    )

    expect(out.code).toBe(0)
    expect(out.stdout.trim()).toBe("android")
    expect(out.stderr).not.toContain("proot")
  })

  test("prefers scoped Android runtime package", async () => {
    if (process.platform === "win32") return
    const staged = await stageLauncher()
    const scoped = path.join(staged.root, "node_modules", "@slopcode-ai", "slopcode-android-arm64")
    await fs.mkdir(path.join(scoped, "bin"), { recursive: true })
    await Bun.write(path.join(scoped, "package.json"), JSON.stringify({ name: "@slopcode-ai/slopcode-android-arm64" }))
    await script(path.join(scoped, "bin", "slopcode"), "#!/bin/sh\necho scoped\n")

    const legacy = path.join(staged.root, "node_modules", "slopcode-bin-android-arm64")
    await fs.mkdir(path.join(legacy, "bin"), { recursive: true })
    await Bun.write(path.join(legacy, "package.json"), JSON.stringify({ name: "slopcode-bin-android-arm64" }))
    await script(path.join(legacy, "bin", "slopcode"), "#!/bin/sh\necho legacy\n")

    const out = await run(
      {
        SLOPCODE_TEST_PLATFORM: "android",
        SLOPCODE_TEST_ARCH: "arm64",
        TERMUX_VERSION: "1",
      },
      [],
      staged.launcher,
    )

    expect(out.code).toBe(0)
    expect(out.stdout.trim()).toBe("scoped")
  })

  test("prints native Termux instructions when Android package is missing", async () => {
    if (process.platform === "win32") return
    const staged = await stageLauncher()
    const pkg = path.join(staged.root, "node_modules", "slopcode-bin-linux-arm64")
    await fs.mkdir(path.join(pkg, "bin"), { recursive: true })
    await Bun.write(path.join(pkg, "package.json"), JSON.stringify({ name: "slopcode-bin-linux-arm64" }))
    await script(path.join(pkg, "bin", "slopcode"), "#!/bin/sh\necho linux\n")

    const out = await run(
      {
        SLOPCODE_TEST_PLATFORM: "android",
        SLOPCODE_TEST_ARCH: "arm64",
        TERMUX_VERSION: "1",
      },
      [],
      staged.launcher,
    )

    expect(out.code).toBe(1)
    expect(out.stdout).not.toContain("linux")
    expect(out.stderr).toContain("Android runtime package")
    expect(out.stderr).toContain("npm install -g slopcode@latest")
  })
})

describe("postinstall", () => {
  test("prints native Termux instructions without failing install", async () => {
    const file = await stagePostinstall()
    const out = await runPostinstall(file, {
      SLOPCODE_TEST_PLATFORM: "android",
      SLOPCODE_TEST_ARCH: "arm64",
      TERMUX_VERSION: "1",
    })

    expect(out.code).toBe(0)
    expect(out.stdout).toContain("Android runtime package")
    expect(out.stdout).toContain("npm install -g slopcode@latest")
    expect(out.stderr).toBe("")
  })

  test("does not cache Android runtime package during postinstall", async () => {
    const file = await stagePostinstall()
    const root = path.dirname(file)
    const pkg = path.join(root, "node_modules", "slopcode-bin-android-arm64")
    await fs.mkdir(path.join(pkg, "bin"), { recursive: true })
    await Bun.write(path.join(pkg, "package.json"), JSON.stringify({ name: "slopcode-bin-android-arm64" }))
    await script(path.join(pkg, "bin", "slopcode"), "#!/bin/sh\necho android\n")

    const out = await runPostinstall(file, {
      SLOPCODE_TEST_PLATFORM: "android",
      SLOPCODE_TEST_ARCH: "arm64",
      TERMUX_VERSION: "1",
    })

    expect(out.code).toBe(0)
    expect(out.stdout).toContain("runtime package detected")
    expect(await Bun.file(path.join(root, "bin", ".slopcode")).exists()).toBe(false)
    expect(await Bun.file(path.join(root, "bin", ".slopcode.json")).exists()).toBe(false)
  })
})
