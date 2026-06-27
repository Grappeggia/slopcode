#!/usr/bin/env bun

import { $ } from "bun"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { gunzipSync } from "zlib"
import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin"
import { Archive } from "../src/util/archive"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dir = path.resolve(__dirname, "..")

process.chdir(dir)

import { Script } from "@slopcode-ai/script"
import pkg from "../package.json"

const generated = await import("./generate.ts")

// Load migrations from migration directories
const migrationDirs = (
  await fs.promises.readdir(path.join(dir, "migration"), {
    withFileTypes: true,
  })
)
  .filter((entry) => entry.isDirectory() && /^\d{4}\d{2}\d{2}\d{2}\d{2}\d{2}/.test(entry.name))
  .map((entry) => entry.name)
  .sort()

const migrations = await Promise.all(
  migrationDirs.map(async (name) => {
    const file = path.join(dir, "migration", name, "migration.sql")
    const sql = await Bun.file(file).text()
    const match = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(name)
    const timestamp = match
      ? Date.UTC(
          Number(match[1]),
          Number(match[2]) - 1,
          Number(match[3]),
          Number(match[4]),
          Number(match[5]),
          Number(match[6]),
        )
      : 0
    return { sql, timestamp }
  }),
)
console.log(`Loaded ${migrations.length} migrations`)

const singleFlag = process.argv.includes("--single")
const baselineFlag = process.argv.includes("--baseline")
const skipInstall = process.argv.includes("--skip-install")
const targetFlag = process.argv.find((item) => item.startsWith("--target="))?.slice("--target=".length)
const releaseFlag = Script.release
const skipEmbedWebUi = process.argv.includes("--skip-embed-web-ui")

const createEmbeddedWebUIBundle = async () => {
  console.log("Building Web UI to embed in the binary")
  const app = path.join(import.meta.dirname, "../../app")
  const dist = path.join(app, "dist")
  await $`SLOPCODE_CHANNEL=${Script.channel} bun run --cwd ${app} build`
  const files = (await Array.fromAsync(new Bun.Glob("**/*").scan({ cwd: dist })))
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => !file.endsWith(".map"))
    .sort()
  const imports = files.map((file, i) => {
    const spec = path.relative(dir, path.join(dist, file)).replaceAll("\\", "/")
    return `import file_${i} from ${JSON.stringify(spec.startsWith(".") ? spec : `./${spec}`)} with { type: "file" };`
  })
  const entries = files.map((file, i) => `  ${JSON.stringify(file)}: file_${i},`)
  return [
    '// Import all files as file_$i with type: "file"',
    ...imports,
    "// Export with original mappings",
    "export default {",
    ...entries,
    "}",
  ].join("\n")
}

const embeddedFileMap = skipEmbedWebUi ? null : await createEmbeddedWebUIBundle()

const nvimVersion = "v0.12.1"
const cliBinary = (os: string) => (os === "win32" ? "slopcode.exe" : "slopcode")
const nvimBinary = (os: string) => (os === "win32" ? "nvim.exe" : "nvim")
const alpineVersion = "3.22"
const alpineRoot = `https://dl-cdn.alpinelinux.org/alpine/v${alpineVersion}`
const alpineArch = (arch: "arm64" | "x64") => (arch === "arm64" ? "aarch64" : "x86_64")
const nvimAssets = {
  "linux-x64": {
    name: "nvim-linux-x86_64.tar.gz",
    url: `https://github.com/neovim/neovim/releases/download/${nvimVersion}/nvim-linux-x86_64.tar.gz`,
    sha256: "ab757a1fd9ad307d53d2df4045698906a7ca3993d92260dd8fe49108712d57d0",
    format: "tar",
  },
  "linux-arm64": {
    name: "nvim-linux-arm64.tar.gz",
    url: `https://github.com/neovim/neovim/releases/download/${nvimVersion}/nvim-linux-arm64.tar.gz`,
    sha256: "a3f8aa5590fd2ac930bcc5c9070b9ac1ec33461d262b6428874c5fc640f3f13c",
    format: "tar",
  },
  "darwin-x64": {
    name: "nvim-macos-x86_64.tar.gz",
    url: `https://github.com/neovim/neovim/releases/download/${nvimVersion}/nvim-macos-x86_64.tar.gz`,
    sha256: "e59a5eafcdf824e2bf6a738e75f8f62ba4ff1b7f1c7daaec2d134aa46737907c",
    format: "tar",
  },
  "darwin-arm64": {
    name: "nvim-macos-arm64.tar.gz",
    url: `https://github.com/neovim/neovim/releases/download/${nvimVersion}/nvim-macos-arm64.tar.gz`,
    sha256: "b77e01c5421ac1bac593eed5c2ea1b950439306dd4c32371ac2473792da9a9d5",
    format: "tar",
  },
  "win32-x64": {
    name: "nvim-win64.zip",
    url: `https://github.com/neovim/neovim/releases/download/${nvimVersion}/nvim-win64.zip`,
    sha256: "75fedc530b3772ca9f177edc7db92560bb9d2d6700ac6d5b2c53eaf5a9317ae3",
    format: "zip",
  },
} as const

const nvimCache = path.join(dir, "dist", ".neovim-cache")
const nvimDownloads = new Map<string, Promise<string>>()
const alpineIndexes = new Map<
  string,
  Promise<{ packages: Map<string, AlpinePackage>; providers: Map<string, string> }>
>()
const alpineDownloads = new Map<string, Promise<string>>()
const alpineRoots = new Map<string, Promise<string>>()

type AlpinePackage = {
  name: string
  version: string
  repo: string
  deps: string[]
  provides: string[]
}

const tarEntry = (data: Uint8Array, file: string) => {
  let offset = 0
  while (offset + 512 <= data.length) {
    const header = Uint8Array.from(data.subarray(offset, offset + 512))
    const name = Buffer.from(header.subarray(0, 100)).toString("utf8").replace(/\0.*$/, "")
    if (!name) return
    const raw = Buffer.from(header.subarray(124, 136)).toString("utf8").replace(/\0.*$/, "").trim()
    const size = Number.parseInt(raw || "0", 8)
    const start = offset + 512
    const end = start + size
    if (name === file) {
      return Uint8Array.from(data.subarray(start, end))
    }
    offset = start + Math.ceil(size / 512) * 512
  }
}

const alpineName = (value: string) => {
  if (!value || value.startsWith("!")) return ""
  return value.split(/[<>=~]/)[0] ?? ""
}

const alpineIndex = (arch: "aarch64" | "x86_64") => {
  const hit = alpineIndexes.get(arch)
  if (hit) return hit
  const task = (async () => {
    const items = await Promise.all(
      ["main", "community"].map(async (repo) => {
        const url = `${alpineRoot}/${repo}/${arch}/APKINDEX.tar.gz`
        const res = await fetch(url)
        if (!res.ok) {
          throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
        }
        const plain = tarEntry(gunzipSync(new Uint8Array(await res.arrayBuffer())), "APKINDEX")
        if (!plain) {
          throw new Error(`Missing APKINDEX entry in ${url}`)
        }
        return {
          repo: `${alpineRoot}/${repo}`,
          text: Buffer.from(plain).toString("utf8"),
        }
      }),
    )
    const packages = new Map<string, AlpinePackage>()
    const providers = new Map<string, string>()
    for (const item of items) {
      for (const block of item.text.split("\n\n")) {
        if (!block.trim()) continue
        const map = new Map(
          block
            .split("\n")
            .filter(Boolean)
            .map((line) => [line.slice(0, 2), line.slice(2)]),
        )
        const name = map.get("P:")
        const version = map.get("V:")
        if (!name || !version) continue
        const info = {
          name,
          version,
          repo: item.repo,
          deps: (map.get("D:") ?? "").split(" ").map(alpineName).filter(Boolean),
          provides: (map.get("p:") ?? "").split(" ").map(alpineName).filter(Boolean),
        } satisfies AlpinePackage
        packages.set(name, info)
        providers.set(name, name)
        info.provides.forEach((provide) => {
          if (!providers.has(provide)) {
            providers.set(provide, name)
          }
        })
      }
    }
    return { packages, providers }
  })()
  alpineIndexes.set(arch, task)
  return task
}

const alpineResolve = async (arch: "aarch64" | "x86_64") => {
  const index = await alpineIndex(arch)
  const seen = new Set<string>()
  const queue = ["neovim"]
  while (queue.length > 0) {
    const name = queue.shift()
    if (!name || seen.has(name) || name.startsWith("so:libc.musl-")) continue
    const next = index.providers.get(name) ?? name
    if (seen.has(next) || next.startsWith("so:libc.musl-")) continue
    const info = index.packages.get(next)
    if (!info) {
      throw new Error(`Missing Alpine package for ${name} (${arch})`)
    }
    seen.add(next)
    info.deps.forEach((dep) => {
      if (!dep.startsWith("so:libc.musl-")) {
        queue.push(dep)
      }
    })
  }
  return Array.from(seen)
    .map((name) => index.packages.get(name))
    .filter((item): item is AlpinePackage => !!item)
}

const alpineDownload = (arch: "aarch64" | "x86_64", item: AlpinePackage) => {
  const key = `${arch}:${item.name}:${item.version}`
  const hit = alpineDownloads.get(key)
  if (hit) return hit
  const task = (async () => {
    const out = path.join(nvimCache, "alpine", alpineVersion, arch, `${item.name}-${item.version}.apk`)
    await fs.promises.mkdir(path.dirname(out), { recursive: true })
    if (!(await Bun.file(out).exists())) {
      const url = `${item.repo}/${arch}/${item.name}-${item.version}.apk`
      const res = await fetch(url)
      if (!res.ok) {
        throw new Error(`Failed to download ${url}: ${res.status} ${res.statusText}`)
      }
      await Bun.write(out, await res.arrayBuffer())
    }
    return out
  })()
  alpineDownloads.set(key, task)
  return task
}

const alpineBundle = (arch: "aarch64" | "x86_64") => {
  const hit = alpineRoots.get(arch)
  if (hit) return hit
  const task = (async () => {
    const root = path.join(nvimCache, "alpine", alpineVersion, `${arch}-root`)
    await fs.promises.rm(root, { recursive: true, force: true })
    await fs.promises.mkdir(root, { recursive: true })
    const items = await alpineResolve(arch)
    for (const item of items) {
      const file = await alpineDownload(arch, item)
      await $`tar -xzf ${file} -C ${root} ${"--exclude=.PKGINFO"} ${"--exclude=.SIGN.*"}`
    }
    return root
  })()
  alpineRoots.set(arch, task)
  return task
}

const nvimKey = (item: { os: string; arch: "arm64" | "x64"; abi?: "musl" }) => {
  if (item.abi === "musl") return
  const key = `${item.os}-${item.arch}` as keyof typeof nvimAssets
  if (key in nvimAssets) return key
}

const nvimDownload = (key: keyof typeof nvimAssets) => {
  const existing = nvimDownloads.get(key)
  if (existing) return existing
  const task = (async () => {
    const asset = nvimAssets[key]
    const out = path.join(nvimCache, asset.name)
    await fs.promises.mkdir(nvimCache, { recursive: true })
    if (!(await Bun.file(out).exists())) {
      const res = await fetch(asset.url)
      if (!res.ok) {
        throw new Error(`Failed to download ${asset.url}: ${res.status} ${res.statusText}`)
      }
      await Bun.write(out, await res.arrayBuffer())
    }
    const digest = new Bun.CryptoHasher("sha256").update(await Bun.file(out).arrayBuffer()).digest("hex")
    if (digest !== asset.sha256) {
      throw new Error(`Neovim digest mismatch for ${asset.name}`)
    }
    return out
  })()
  nvimDownloads.set(key, task)
  return task
}

const nvimBundle = async (item: { os: string; arch: "arm64" | "x64"; abi?: "musl" }, name: string) => {
  const dest = path.join(dir, "dist", name, "bin", "neovim")
  await fs.promises.rm(dest, { recursive: true, force: true })
  await fs.promises.mkdir(dest, { recursive: true })
  if (item.abi === "musl") {
    const root = await alpineBundle(alpineArch(item.arch))
    await $`cp -RL ${path.join(root, "usr", "bin")} ${path.join(dest, "bin")}`
    await $`cp -RL ${path.join(root, "usr", "lib")} ${path.join(dest, "lib")}`
    await $`cp -RL ${path.join(root, "usr", "share")} ${path.join(dest, "share")}`
    await $`docker run --rm -v ${dest}:/work alpine:${alpineVersion} sh -lc ${"apk add --no-cache patchelf >/dev/null && patchelf --replace-needed /usr/lib/lua/5.1/lpeg.so lpeg.so /work/bin/nvim"}`
    return
  }
  const key = nvimKey(item)
  if (!key) return
  const asset = nvimAssets[key]
  const file = await nvimDownload(key)
  if (asset.format === "tar") {
    await $`tar -xzf ${file} -C ${dest} --strip-components=1`
    return
  }
  const tmp = path.join(nvimCache, `${asset.name}.tmp`)
  await fs.promises.rm(tmp, { recursive: true, force: true })
  await fs.promises.mkdir(tmp, { recursive: true })
  await Archive.extractZip(file, tmp)
  const entries = await fs.promises.readdir(tmp, { withFileTypes: true })
  const source = entries.length === 1 && entries[0]?.isDirectory() ? path.join(tmp, entries[0].name) : tmp
  await fs.promises.cp(source, dest, { recursive: true, force: true })
  await fs.promises.rm(tmp, { recursive: true, force: true })
}

const allTargets: {
  os: string
  arch: "arm64" | "x64"
  abi?: "musl"
  avx2?: false
}[] = [
  {
    os: "linux",
    arch: "arm64",
  },
  {
    os: "linux",
    arch: "x64",
  },
  {
    os: "linux",
    arch: "x64",
    avx2: false,
  },
  {
    os: "linux",
    arch: "arm64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
  },
  {
    os: "linux",
    arch: "x64",
    abi: "musl",
    avx2: false,
  },
  {
    os: "darwin",
    arch: "arm64",
  },
  {
    os: "darwin",
    arch: "x64",
  },
  {
    os: "darwin",
    arch: "x64",
    avx2: false,
  },
  {
    os: "win32",
    arch: "x64",
  },
  {
    os: "win32",
    arch: "x64",
    avx2: false,
  },
]

const targetKey = (item: (typeof allTargets)[number]) =>
  [item.os === "win32" ? "windows" : item.os, item.arch, item.avx2 === false ? "baseline" : undefined, item.abi]
    .filter(Boolean)
    .join("-")

const targetName = (item: (typeof allTargets)[number]) => `${pkg.name}-${targetKey(item)}`

const targets = targetFlag
  ? allTargets.filter((item) => targetKey(item) === targetFlag || targetName(item) === targetFlag)
  : singleFlag
    ? allTargets.filter((item) => {
        if (item.os !== process.platform || item.arch !== process.arch) {
          return false
        }

        // When building for the current platform, prefer a single native binary by default.
        // Baseline binaries require additional Bun artifacts and can be flaky to download.
        if (item.avx2 === false) {
          return baselineFlag
        }

        // also skip abi-specific builds for the same reason
        if (item.abi !== undefined) {
          return false
        }

        return true
      })
    : releaseFlag
      ? allTargets
      : allTargets

if (targetFlag && targets.length === 0) {
  throw new Error(`Unknown build target: ${targetFlag}`)
}

const fallbackBundle = async (item: { os: string; arch: "arm64" | "x64"; abi?: "musl" }, name: string) => {
  const out = path.join(dir, "dist", name, "fallback")
  await fs.promises.rm(out, { recursive: true, force: true })
  await fs.promises.mkdir(out, { recursive: true })

  const platformName = item.os === "win32" ? "windows" : item.os
  const libcSuffix = item.abi === "musl" ? "-musl" : ""
  const nativePkg = `@opentui/core-${platformName}-${item.arch}${libcSuffix}`

  const result = await Bun.build({
    conditions: ["browser"],
    tsconfig: "./tsconfig.json",
    plugins: [solidPlugin],
    sourcemap: "none",
    target: "bun",
    outdir: out,
    entrypoints: ["./src/index.ts", parserWorker, workerPath],
    naming: "[name].[ext]",
    define: {
      SLOPCODE_VERSION: `'${Script.version}'`,
      SLOPCODE_NVIM_VERSION: `'${nvimVersion}'`,
      SLOPCODE_MIGRATIONS: JSON.stringify(migrations),
      SLOPCODE_MODELS_DEV: generated.modelsData,
      SLOPCODE_WORKER_PATH: 'new URL("./worker.js", import.meta.url).href',
      SLOPCODE_CHANNEL: `'${Script.channel}'`,
      SLOPCODE_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
      FFF_LIBC: JSON.stringify(item.abi === "musl" ? "musl" : "gnu"),
      ...(item.os === "linux" ? { "process.env.OPENTUI_LIBC": JSON.stringify(item.abi ?? "glibc") } : {}),
    },
  })
  if (!result.success) throw new Error(`Fallback bundle failed for ${name}`)
  if (!(await Bun.file(path.join(out, "index.js")).exists())) throw new Error(`Missing fallback bundle for ${name}`)

  const modulesDir = path.join(out, "modules", "@opentui", `core-${platformName}-${item.arch}${libcSuffix}`)
  await fs.promises.mkdir(modulesDir, { recursive: true })
  const version = (await Bun.file(path.join(dir, "node_modules", "@opentui", "core", "package.json")).json()).version
  const bunCache = `@opentui+core-${platformName}-${item.arch}${libcSuffix}@${version}`
  let so = [
    path.join(
      dir,
      "node_modules",
      "@opentui",
      `core-${platformName}-${item.arch}${libcSuffix}`,
      `libopentui.${item.os === "win32" ? "dll" : item.os === "darwin" ? "dylib" : "so"}`,
    ),
    path.join(
      dir,
      "node_modules",
      ".bun",
      bunCache,
      "node_modules",
      "@opentui",
      `core-${platformName}-${item.arch}${libcSuffix}`,
      `libopentui.${item.os === "win32" ? "dll" : item.os === "darwin" ? "dylib" : "so"}`,
    ),
    path.join(
      dir,
      "..",
      "..",
      "node_modules",
      "@opentui",
      `core-${platformName}-${item.arch}${libcSuffix}`,
      `libopentui.${item.os === "win32" ? "dll" : item.os === "darwin" ? "dylib" : "so"}`,
    ),
    path.join(
      dir,
      "..",
      "..",
      "node_modules",
      ".bun",
      bunCache,
      "node_modules",
      "@opentui",
      `core-${platformName}-${item.arch}${libcSuffix}`,
      `libopentui.${item.os === "win32" ? "dll" : item.os === "darwin" ? "dylib" : "so"}`,
    ),
  ].find((f) => fs.existsSync(f))
  if (!so) {
    console.log(`fallback bundle: skipping ${name} (native lib not available on this host)`)
    return
  }
  const ext = item.os === "win32" ? "dll" : item.os === "darwin" ? "dylib" : "so"
  await fs.promises.copyFile(so, path.join(modulesDir, `libopentui.${ext}`))
  await Bun.write(
    path.join(modulesDir, "index.js"),
    `import { fileURLToPath } from "node:url"\nexport default fileURLToPath(new URL("./libopentui.${ext}", import.meta.url))\n`,
  )
  await Bun.write(
    path.join(modulesDir, "index.bun.js"),
    `const module = await import("./libopentui.${ext}", { with: { type: "file" } })\nexport default module.default\n`,
  )
  await Bun.write(
    path.join(modulesDir, "package.json"),
    JSON.stringify(
      {
        name: nativePkg,
        version,
        type: "module",
        main: "index.js",
        module: "index.js",
        exports: { ".": { bun: "./index.bun.js", import: "./index.js" } },
        os: [platformName],
        cpu: [item.arch],
      },
      null,
      2,
    ),
  )
  console.log(`fallback bundle: ${name}`)
}

await $`rm -rf dist`

const binaries: Record<string, string> = {}
const needsOpenTui = targets.length > 0
if (!skipInstall && needsOpenTui) {
  await $`bun install --os="*" --cpu="*" @opentui/core@${pkg.dependencies["@opentui/core"]}`
  await $`bun install --os="*" --cpu="*" @parcel/watcher@${pkg.dependencies["@parcel/watcher"]}`
}
const parserWorker = fs.realpathSync(path.resolve(dir, "./node_modules/@opentui/core/parser.worker.js"))
const workerPath = "./src/cli/tui/worker.ts"
for (const item of targets) {
  const name = targetName(item)
  console.log(`building ${name}`)
  await $`mkdir -p dist/${name}/bin`

  // Use platform-specific bunfs root path based on target OS
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/"
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/")

  const result = await Bun.build({
    conditions: ["node"],
    tsconfig: "./tsconfig.json",
    plugins: [solidPlugin],
    sourcemap: "external",
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      autoloadTsconfig: true,
      autoloadPackageJson: true,
      target: name.replace(pkg.name, "bun") as any,
      outfile: `dist/${name}/bin/slopcode`,
      execArgv: [`--user-agent=slopcode/${Script.version}`, "--use-system-ca", "--"],
      windows: {},
    },
    files: embeddedFileMap ? { "slopcode-web-ui.gen.ts": embeddedFileMap } : {},
    entrypoints: ["./src/index.ts", parserWorker, workerPath, ...(embeddedFileMap ? ["slopcode-web-ui.gen.ts"] : [])],
    define: {
      SLOPCODE_VERSION: `'${Script.version}'`,
      SLOPCODE_NVIM_VERSION: `'${nvimVersion}'`,
      SLOPCODE_MIGRATIONS: JSON.stringify(migrations),
      SLOPCODE_MODELS_DEV: generated.modelsData,
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
      SLOPCODE_WORKER_PATH: workerPath,
      SLOPCODE_CHANNEL: `'${Script.channel}'`,
      SLOPCODE_LIBC: item.os === "linux" ? `'${item.abi ?? "glibc"}'` : "",
      FFF_LIBC: JSON.stringify(item.abi === "musl" ? "musl" : "gnu"),
      ...(item.os === "linux" ? { "process.env.OPENTUI_LIBC": JSON.stringify(item.abi ?? "glibc") } : {}),
    },
  })

  if (!result.success) {
    throw new Error(`Build failed for ${name}`)
  }
  const binary = `dist/${name}/bin/${cliBinary(item.os)}`
  if (!(await Bun.file(binary).exists())) {
    throw new Error(`Missing built binary at ${binary}`)
  }

  if (item.os === process.platform && item.arch === process.arch && item.abi !== "musl") {
    const version = Bun.spawnSync([binary, "--version"])
    if (version.exitCode !== 0) {
      throw new Error(`Smoke test failed for ${name}: --version exited with ${version.exitCode}`)
    }
    const out = (version.stdout?.toString() ?? "").trim()
    if (!out) {
      throw new Error(`Smoke test failed for ${name}: --version produced no output`)
    }
    console.log(`smoke test: ${name} --version OK (${out})`)
  }

  await fallbackBundle(item, name)

  await $`rm -rf ./dist/${name}/bin/tui`
  await nvimBundle(item, name)
  const file = `dist/${name}/bin/neovim/bin/${nvimBinary(item.os)}`
  if (!(await Bun.file(file).exists())) {
    throw new Error(`Missing bundled Neovim at ${file}`)
  }
  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify(
      {
        name,
        version: Script.version,
        repository: {
          type: "git",
          url: "https://github.com/teamslop/slopcode",
        },
        os: [item.os],
        cpu: [item.arch],
      },
      null,
      2,
    ),
  )
  binaries[name] = Script.version
}

const debVersion = (() => {
  const version = Script.version.replace(/^v/, "")
  if (!version) {
    return "0.0.0-1"
  }
  if (version.includes(":")) {
    return version
  }
  if (/-\d+$/.test(version)) {
    return version
  }
  return `${version.replace(/-/g, "~")}-1`
})()

const debBuild = async (src: string, arch: "amd64" | "arm64") => {
  const binary = path.join(dir, "dist", src, "bin", "slopcode")
  const nvim = path.join(dir, "dist", src, "bin", "neovim")
  if (!fs.existsSync(binary)) {
    throw new Error(`Missing Debian source binary at ${binary}`)
  }

  const root = path.join(dir, "dist", `deb-${arch}`)
  const binDir = path.join(root, "usr", "bin")
  const libDir = path.join(root, "usr", "lib", "slopcode")
  const controlDir = path.join(root, "DEBIAN")
  const deb = path.join(dir, "dist", `slopcode-linux-${arch}.deb`)

  await fs.promises.rm(root, { recursive: true, force: true })
  await fs.promises.mkdir(binDir, { recursive: true })
  await fs.promises.mkdir(libDir, { recursive: true })
  await fs.promises.mkdir(controlDir, { recursive: true })

  await $`cp ${binary} ${path.join(binDir, "slopcode")}`
  await $`chmod 755 ${path.join(binDir, "slopcode")}`
  if (fs.existsSync(nvim)) {
    await fs.promises.cp(nvim, path.join(libDir, "neovim"), { recursive: true, force: true })
  }

  await Bun.write(
    path.join(controlDir, "control"),
    [
      "Package: slopcode",
      `Version: ${debVersion}`,
      "Section: utils",
      "Priority: optional",
      `Architecture: ${arch}`,
      "Maintainer: SlopCode Team <support@slopcode.dev>",
      "Depends: libc6, libstdc++6",
      "Description: The open source AI slopcoding agent",
      " SlopCode is an open source AI slopcoding agent focused on terminal workflows.",
      "",
    ].join("\n"),
  )

  await $`dpkg-deb --build --root-owner-group ${root} ${deb}`
  await fs.promises.rm(root, { recursive: true, force: true })
}

if (Script.release) {
  const winget = `${pkg.name}-windows-x64-baseline`
  const exe = path.join(dir, "dist", winget, "bin", "slopcode.exe")
  if (!fs.existsSync(exe)) {
    throw new Error(`Missing Winget executable at ${exe}`)
  }

  for (const key of Object.keys(binaries)) {
    if (key.includes("linux")) {
      await $`tar -czf ../../${key}.tar.gz *`.cwd(`dist/${key}/bin`)
      continue
    }

    await $`zip -r ../../${key}.zip *`.cwd(`dist/${key}/bin`)
  }

  await $`tar -czf slopcode-cli-dist.tar.gz ${Object.keys(binaries)}`.cwd("dist")

  if (process.platform === "linux") {
    const dpkgDeb = (await $`bash -lc "command -v dpkg-deb"`.quiet().nothrow().text()).trim()
    if (!dpkgDeb) {
      throw new Error("dpkg-deb is required to build Debian packages")
    }
    await debBuild(`${pkg.name}-linux-x64-baseline`, "amd64")
    await debBuild(`${pkg.name}-linux-arm64`, "arm64")
    await $`gh release upload v${Script.version} ./dist/*.zip ./dist/*.tar.gz ./dist/*.deb --clobber --repo ${process.env.GH_REPO}`
  } else {
    await $`gh release upload v${Script.version} ./dist/*.zip ./dist/*.tar.gz --clobber --repo ${process.env.GH_REPO}`
  }
}

export { binaries }
