#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs/promises"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import pkg from "../package.json"
import { Script } from "@slopcode-ai/script"

const dir = fileURLToPath(new URL("..", import.meta.url))
process.chdir(dir)

const androidOnly = process.argv.includes("--android-only") || process.env.SLOPCODE_VERIFY_ANDROID_ONLY === "1"
const registry = (process.env.npm_config_registry ?? "https://registry.npmjs.org").replace(/\/$/, "")
const readme = (await Bun.file("./README.npm.md").text()).trim()
const alias = {
  name: "sloppycode",
  bin: "sloppycode",
  description: "Alias for slopcode, the open source AI slopcoding agent.",
}
const metadata = {
  description: "The open source AI slopcoding agent.",
  homepage: "https://slopcode.dev",
  repository: {
    type: "git",
    url: "git+https://github.com/teamslop/slopcode.git",
  },
  bugs: {
    url: "https://github.com/teamslop/slopcode/issues",
  },
  keywords: ["ai", "agent", "coding", "cli", "terminal", "tui", "developer-tools", "llm"],
  funding: {
    url: "https://github.com/sponsors/teamslop",
  },
}

const rm = async (target: string) => fs.rm(target, { recursive: true, force: true })
const exists = async (target: string) =>
  fs.access(target).then(
    () => true,
    () => false,
  )
const nvim = (os: string) => (os === "win32" ? "nvim.exe" : "nvim")

const normalize = (name: string) => {
  if (name.startsWith(`${pkg.name}-bin-bin-`)) {
    return name.replace(`${pkg.name}-bin-bin-`, `${pkg.name}-bin-`)
  }
  if (name.startsWith(`${pkg.name}-`) && !name.startsWith(`${pkg.name}-bin-`)) {
    return name.replace(`${pkg.name}-`, `${pkg.name}-bin-`)
  }
  return name
}

const binaries = await Array.fromAsync(new Bun.Glob("*/package.json").scan({ cwd: "./dist" })).then((arr) =>
  Promise.all(
    arr.map(async (file) => {
      const name = file.replace(/\/package\.json$/, "")
      const json = await Bun.file(`./dist/${file}`).json()
      if (name === pkg.name || name === alias.name) return
      return {
        dir: name,
        name: normalize(json.name),
        version: json.version as string,
      }
    }),
  ).then((arr) => arr.flatMap((item) => (item ? [item] : []))),
)

if (binaries.length === 0) {
  throw new Error("verify: missing binary packages in ./dist")
}

const isAndroidRuntime = (item: { name: string }) => item.name.startsWith(`${pkg.name}-bin-android-`)
const npmBinaries = binaries.filter((item) => !isAndroidRuntime(item))
const androidBootstrapDeps = {
  "@oven/bun-linux-aarch64-android": "1.3.14",
  "@oven/bun-linux-x64-android": "1.3.14",
}
const deps = {
  ...Object.fromEntries(npmBinaries.map((item) => [item.name, item.version])),
  ...androidBootstrapDeps,
}
const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-verify-"))
const stage = path.join(tmp, "stage")
await fs.mkdir(stage, { recursive: true })

const current = () => {
  const os = process.platform === "win32" ? "windows" : process.platform
  const arch = process.arch === "arm64" ? "arm64" : "x64"
  const report = process.report?.getReport?.() as { header?: { glibcVersionRuntime?: string } } | undefined
  const libc =
    os === "linux"
      ? typeof report?.header?.glibcVersionRuntime === "string" && report.header.glibcVersionRuntime
        ? "glibc"
        : "musl"
      : undefined
  return { os, arch, libc }
}

const match = (name: string) => {
  const host = current()
  if (!name.startsWith(`${pkg.name}-bin-${host.os}-${host.arch}`)) return false
  if (host.os === "linux" && host.libc === "musl") return name.includes("-musl")
  if (host.os === "linux" && host.libc === "glibc") return !name.includes("-musl")
  return true
}

const tarball = (name: string) => `${name.replaceAll("/", "-")}.tgz`

const pack = async (cwd: string, file: string) => {
  await $`bash -lc "rm -f ./*.tgz"`.cwd(cwd)
  await $`bun pm pack --filename ${file}`.cwd(cwd).quiet()
  return path.join(cwd, file)
}

const stageBinary = async (item: { dir: string; name: string; version: string }) => {
  const from = path.join(dir, "dist", item.dir)
  const to = path.join(stage, item.dir)
  await rm(to)
  await fs.cp(from, to, { recursive: true, force: true })
  const file = path.join(to, "package.json")
  const json = await Bun.file(file).json()
  json.name = item.name
  await Bun.write(file, JSON.stringify(json, null, 2))
  return {
    ...item,
    tgz: await pack(to, tarball(item.name)),
  }
}

const stageRoot = async (input: { name: string; bin: string; description: string }) => {
  const bundle = path.join(dir, "dist", "android-bundle")
  const modules = path.join(dir, "dist", "android-modules")
  if (!(await exists(path.join(bundle, "index.js")))) {
    throw new Error("verify: missing Android bundle at ./dist/android-bundle/index.js")
  }
  if (
    !(await exists(path.join(modules, "@opentui", "core-android-arm64", "index.ts"))) ||
    !(await exists(path.join(modules, "@opentui", "core-android-x64", "index.ts")))
  ) {
    throw new Error("verify: missing Android bootstrap modules at ./dist/android-modules")
  }
  const to = path.join(stage, input.name)
  await rm(to)
  await fs.mkdir(to, { recursive: true })
  await fs.cp(path.join(dir, "bin"), path.join(to, "bin"), { recursive: true, force: true })
  await fs.cp(bundle, path.join(to, "bundle"), { recursive: true, force: true })
  await fs.cp(modules, path.join(to, "android-modules"), { recursive: true, force: true })
  for (const arch of ["arm64", "x64"] as const) {
    const source = path.join(dir, "dist", `${pkg.name}-android-${arch}`, "bin")
    if (!(await exists(path.join(source, pkg.name)))) {
      throw new Error(`verify: missing embedded Android ${arch} runtime`)
    }
    if (!(await exists(path.join(source, `${pkg.name}-android-host`)))) {
      throw new Error(`verify: missing embedded Android ${arch} host`)
    }
    await fs.mkdir(path.join(to, "android-runtime", arch), { recursive: true })
    await fs.cp(source, path.join(to, "android-runtime", arch, "bin"), { recursive: true, force: true })
  }
  await fs.copyFile(path.join(dir, "script", "postinstall.mjs"), path.join(to, "postinstall.mjs"))
  await Bun.write(path.join(to, "README.md"), `${readme}\n`)
  await fs.copyFile(path.join(dir, "..", "..", "LICENSE"), path.join(to, "LICENSE"))
  await Bun.write(
    path.join(to, "package.json"),
    JSON.stringify(
      {
        name: input.name,
        description: input.description,
        homepage: metadata.homepage,
        repository: metadata.repository,
        bugs: metadata.bugs,
        keywords: metadata.keywords,
        funding: metadata.funding,
        bin: {
          [input.bin]: `./bin/${pkg.name}`,
        },
        files: ["bin", "bundle", "android-modules", "android-runtime", "postinstall.mjs", "README.md", "LICENSE"],
        scripts: {
          postinstall: "bun ./postinstall.mjs || node ./postinstall.mjs",
        },
        version: Script.version,
        license: pkg.license,
        optionalDependencies: deps,
      },
      null,
      2,
    ),
  )
  return {
    name: input.name,
    tgz: await pack(to, tarball(input.name)),
  }
}

const packed = await Promise.all(binaries.map(stageBinary))
const root = await stageRoot({
  name: pkg.name,
  bin: pkg.name,
  description: metadata.description,
})
const aliasPkg = await stageRoot(alias)

const installSmoke = async () => {
  const targets = packed.filter((item) => match(item.name))
  if (targets.length === 0) {
    throw new Error("verify: missing linux x64 binary package for install smoke")
  }
  const work = path.join(tmp, "install-host")
  await fs.mkdir(work, { recursive: true })
  await $`npm install --no-package-lock --ignore-scripts=false ${targets.map((item) => item.tgz)} ${root.tgz}`.cwd(work)
  const bin = path.join(work, "node_modules", ".bin", pkg.name)
  await $`${bin} --version`.cwd(work)
  const cache = path.join(work, "node_modules", pkg.name, "bin", ".slopcode")
  const meta = path.join(work, "node_modules", pkg.name, "bin", ".slopcode.json")
  const sidecar = path.join(work, "node_modules", pkg.name, "bin", "neovim")
  if (!(await exists(cache)) || !(await exists(meta)) || !(await exists(sidecar))) {
    throw new Error("verify: packed install did not create slopcode cache metadata and sidecar")
  }
}

const alpineSmoke = async () => {
  const x64 = packed.find((item) => item.name === `${pkg.name}-bin-linux-x64-musl`)
  const base = packed.find((item) => item.name === `${pkg.name}-bin-linux-x64-baseline-musl`)
  if (!x64 || !base) {
    throw new Error("verify: missing linux musl binary packages for Alpine smoke")
  }
  const work = path.join(tmp, "install-alpine")
  await fs.mkdir(work, { recursive: true })
  await fs.copyFile(x64.tgz, path.join(work, path.basename(x64.tgz)))
  await fs.copyFile(base.tgz, path.join(work, path.basename(base.tgz)))
  await fs.copyFile(root.tgz, path.join(work, path.basename(root.tgz)))
  const rootName = path.basename(root.tgz)
  const x64Name = path.basename(x64.tgz)
  const baseName = path.basename(base.tgz)
  const sh = [
    "set -eu",
    "cd /work",
    `npm install --no-package-lock --ignore-scripts=false ./${baseName} ./${x64Name} ./${rootName} >/dev/null`,
    "./node_modules/.bin/slopcode --version >/tmp/slopcode-version.txt",
    "test -f ./node_modules/slopcode/bin/.slopcode.json",
    "test -x ./node_modules/slopcode/bin/neovim/bin/nvim",
    "env VIMRUNTIME=/work/node_modules/slopcode/bin/neovim/share/nvim/runtime LD_LIBRARY_PATH=/work/node_modules/slopcode/bin/neovim/lib:/work/node_modules/slopcode/bin/neovim/lib/lua/5.1 LUA_PATH='/work/node_modules/slopcode/bin/neovim/share/lua/5.1/?.lua;/work/node_modules/slopcode/bin/neovim/share/lua/5.1/?/init.lua;;' LUA_CPATH='/work/node_modules/slopcode/bin/neovim/lib/lua/5.1/?.so;;' ./node_modules/slopcode/bin/neovim/bin/nvim --version >/tmp/nvim-version.txt",
    "head -n 1 /tmp/nvim-version.txt",
  ].join(" && ")
  await $`docker run --rm --platform linux/amd64 -v ${work}:/work node:20-alpine sh -lc ${sh}`
}

const androidTargets = [
  {
    arch: "arm64",
    asset: "slopcode-android-arm64.tar.gz",
    pkg: "slopcode-bin-android-arm64",
    bun: "bun-linux-aarch64-android",
  },
  { arch: "x64", asset: "slopcode-android-x64.tar.gz", pkg: "slopcode-bin-android-x64", bun: "bun-linux-x64-android" },
] as const

const androidSmoke = async () => {
  for (const target of androidTargets) {
    const android = path.join(dir, "dist", target.asset)
    if (!(await exists(android))) {
      throw new Error(`verify: missing Android ${target.arch} release asset`)
    }
    const work = path.join(tmp, `install-android-${target.arch}`)
    await fs.mkdir(work, { recursive: true })
    const env = {
      ...process.env,
      SLOPCODE_TEST_PLATFORM: "android",
      SLOPCODE_TEST_ARCH: target.arch,
    }
    await $`npm install --force --no-package-lock --ignore-scripts=true --os=android --cpu=${target.arch} ${root.tgz}`
      .env(env)
      .cwd(work)
    await $`node ./node_modules/${pkg.name}/postinstall.mjs`.env(env).cwd(work)
    const bundle = path.join(work, "node_modules", pkg.name, "bundle", "index.js")
    const runtimeRoot = path.join(work, "node_modules", pkg.name, "android-runtime", target.arch)
    if (!(await exists(runtimeRoot))) {
      throw new Error(`verify: packed Android ${target.arch} install did not embed the Rust TUI runtime`)
    }
    const rootJson = await Bun.file(path.join(work, "node_modules", pkg.name, "package.json")).json()
    if (rootJson.optionalDependencies?.[target.pkg]) {
      throw new Error(`verify: packed Android ${target.arch} root package must not depend on unpublished runtime npm packages`)
    }
    const bin = path.join(runtimeRoot, "bin", "slopcode")
    const sidecar = path.join(runtimeRoot, "bin", "slopcode-android-host")
    if (!(await exists(bundle))) {
      throw new Error(`verify: packed Android ${target.arch} install did not include the Android launcher bundle`)
    }
    if (!(await exists(bin)) || !(await exists(sidecar))) {
      throw new Error(
        `verify: packed Android ${target.arch} install did not install the Rust TUI runtime and compatibility host alias`,
      )
    }
    const localBun = path.join(work, "node_modules", pkg.name, "node_modules", "@oven", target.bun, "bin", "bun")
    const hoistedBun = path.join(work, "node_modules", "@oven", target.bun, "bin", "bun")
    const bun = (await exists(localBun)) ? localBun : (await exists(hoistedBun)) ? hoistedBun : undefined
    if (!bun) {
      throw new Error(`verify: packed Android ${target.arch} install did not include the Bun bootstrap dependency`)
    }
    await Bun.write(bun, `#!/bin/sh\nexec "${process.execPath}" "$@"\n`)
    await fs.chmod(bun, 0o755)
    await Bun.write(
      bin,
      `#!/bin/sh
exec "${process.execPath}" -e 'console.log(JSON.stringify({ args: process.argv.slice(1), entry: process.env.SLOPCODE_ENTRYPOINT ?? null, runner: process.env.SLOPCODE_ANDROID_BOOTSTRAP_RUNNER ?? null, host: process.env.SLOPCODE_ANDROID_HOST_PATH ?? null, root: process.env.SLOPCODE_ANDROID_ROOT ?? null, nodePath: process.env.NODE_PATH ?? null, bionic: process.env.SLOPCODE_BIONIC ?? null }))' -- "$@"
`,
    )
    await fs.chmod(bin, 0o755)
    await Bun.write(
      bundle,
      'throw new Error("verify: Android launcher executed the daemon bundle as the interactive UI")\n',
    )
    const launcher = path.join(work, "node_modules", pkg.name, "bin", pkg.name)
    const launched = await $`node ${launcher} --print-logs`
      .env({
        ...env,
        TERMUX_VERSION: "1",
      })
      .cwd(work)
      .text()
    const expectedEntry = await fs.realpath(bundle)
    const expectedHost = await fs.realpath(sidecar)
    const expectedRoot = await fs.realpath(path.dirname(path.dirname(bin)))
    const expectedModules = await fs.realpath(path.join(work, "node_modules", pkg.name, "android-modules"))
    const parsed = JSON.parse(launched.trim()) as {
      args?: string[]
      entry?: string | null
      runner?: string | null
      host?: string | null
      root?: string | null
      nodePath?: string | null
      bionic?: string | null
    }
    const expectedRunner = await fs.realpath(bun)
    if (
      parsed.entry !== expectedEntry ||
      parsed.runner !== expectedRunner ||
      parsed.host !== expectedHost ||
      parsed.root !== expectedRoot ||
      parsed.bionic !== "1" ||
      parsed.args?.includes("--print-logs")
    ) {
      throw new Error(`verify: packed Android ${target.arch} launcher did not route through the Rust TUI bootstrap`)
    }
    if (!parsed.nodePath?.includes(expectedModules)) {
      throw new Error(`verify: packed Android ${target.arch} launcher did not expose Android bootstrap modules`)
    }
  }
}

const listTar = async (file: string) => (await $`tar -tf ${file}`.text()).split("\n").filter(Boolean)
const listDeb = async (file: string) => (await $`dpkg-deb -c ${file}`.text()).split("\n").filter(Boolean)
const listZip = async (file: string) =>
  (
    await $`python3 -c ${"import sys, zipfile; print('\\n'.join(zipfile.ZipFile(sys.argv[1]).namelist()))"} ${file}`.text()
  )
    .split("\n")
    .filter(Boolean)

const verifyArchives = async () => {
  const files = await fs.readdir(path.join(dir, "dist"))
  for (const file of files.filter((item) => item.endsWith(".tar.gz"))) {
    const list = await listTar(path.join(dir, "dist", file))
    if (file.includes("android")) {
      if (!list.some((item) => item.endsWith("bin/slopcode"))) {
        throw new Error(`verify: missing Android launcher in ${file}`)
      }
      if (list.some((item) => item.endsWith("bundle/index.js"))) {
        throw new Error(`verify: Android archive must not include Bun bundle in ${file}`)
      }
      if (list.some((item) => item.includes("node_modules/@opentui/core-android-"))) {
        throw new Error(`verify: Android archive must not include OpenTUI JS runtime in ${file}`)
      }
      if (list.some((item) => item.includes("node_modules/@oven/bun-linux-"))) {
        throw new Error(`verify: Android archive must not include Bun runtime in ${file}`)
      }
      if (list.some((item) => item.endsWith("bin/slopcode-termux"))) {
        throw new Error(`verify: Android archive must not include legacy Termux client in ${file}`)
      }
      if (!list.some((item) => item.endsWith("bin/slopcode-android-host"))) {
        throw new Error(`verify: missing Android compatibility host alias in ${file}`)
      }
      continue
    }
    if (!list.some((item) => item.endsWith(`neovim/bin/${nvim(file.includes("windows") ? "win32" : "linux")}`))) {
      throw new Error(`verify: missing bundled neovim in ${file}`)
    }
  }
  for (const file of files.filter((item) => item.endsWith(".zip") && item.includes("windows"))) {
    const list = await listZip(path.join(dir, "dist", file))
    if (!list.some((item) => item.endsWith("neovim/bin/nvim.exe"))) {
      throw new Error(`verify: missing bundled neovim in ${file}`)
    }
  }
  for (const file of files.filter((item) => item.endsWith(".deb"))) {
    const list = await listDeb(path.join(dir, "dist", file))
    if (!list.some((item) => item.includes("/usr/lib/slopcode/neovim/bin/nvim"))) {
      throw new Error(`verify: missing bundled neovim in ${file}`)
    }
  }
}

const verifyAlias = async () => {
  const work = path.join(tmp, "install-alias")
  const targets = packed.filter((item) => match(item.name))
  if (targets.length === 0) {
    throw new Error("verify: missing linux x64 binary package for alias smoke")
  }
  await fs.mkdir(work, { recursive: true })
  await $`npm install --no-package-lock --ignore-scripts=false ${targets.map((item) => item.tgz)} ${aliasPkg.tgz}`.cwd(
    work,
  )
  const aliasBin = path.join(work, "node_modules", ".bin", alias.bin)
  await $`${aliasBin} --version`.cwd(work)
}

await verifyArchives()
await androidSmoke()
if (!androidOnly) {
  await installSmoke()
  await verifyAlias()
  await alpineSmoke()
}

console.log("verify: ok", registry)
