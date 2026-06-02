#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const pkg = require("./package.json")
const supported = {
  android: ["arm64", "x64"],
  darwin: ["arm64", "x64"],
  linux: ["arm64", "x64"],
  windows: ["x64"],
}

function detectPlatformAndArch() {
  const rawPlatform = process.env.SLOPCODE_TEST_PLATFORM || os.platform()
  const rawArch = process.env.SLOPCODE_TEST_ARCH || os.arch()
  const platform =
    {
      darwin: "darwin",
      linux: "linux",
      win32: "windows",
    }[rawPlatform] ?? rawPlatform
  const arch =
    {
      x64: "x64",
      arm64: "arm64",
      arm: "arm",
    }[rawArch] ?? rawArch
  return { platform, arch }
}

function termuxEnv() {
  return Boolean(process.env.TERMUX_VERSION || (process.env.PREFIX || "").includes("/com.termux/"))
}

function detectLibc(platform, arch) {
  if (platform === "android" || termuxEnv()) return "bionic"
  if (platform !== "linux") return
  const report = process.report?.getReport?.()
  if (typeof report?.header?.glibcVersionRuntime === "string" && report.header.glibcVersionRuntime) {
    return "glibc"
  }
  if (fs.existsSync("/etc/alpine-release")) return "musl"
  const getconf = require("child_process").spawnSync("getconf", ["GNU_LIBC_VERSION"], {
    encoding: "utf8",
    timeout: 1500,
  })
  const fromGetconf = ((getconf.stdout || "") + (getconf.stderr || "")).toLowerCase()
  if (getconf.status === 0 && fromGetconf.includes("glibc")) return "glibc"
  const result = require("child_process").spawnSync("ldd", ["--version"], {
    encoding: "utf8",
    timeout: 1500,
  })
  const text = ((result.stdout || "") + (result.stderr || "")).toLowerCase()
  if (text.includes("musl")) return "musl"
  if (text.includes("glibc") || text.includes("gnu libc")) return "glibc"
  if (text.includes("bionic")) return "bionic"
  const loader = arch === "arm64" ? "/lib/ld-musl-aarch64.so.1" : arch === "x64" ? "/lib/ld-musl-x86_64.so.1" : ""
  if (loader && fs.existsSync(loader)) return "musl"
}

function supportsAvx2(platform, arch) {
  if (arch !== "x64") return false

  if (platform === "linux") {
    try {
      return /(^|\s)avx2(\s|$)/i.test(fs.readFileSync("/proc/cpuinfo", "utf8"))
    } catch {
      return false
    }
  }

  if (platform === "darwin") {
    try {
      const result = require("child_process").spawnSync("sysctl", ["-n", "hw.optional.avx2_0"], {
        encoding: "utf8",
        timeout: 1500,
      })
      if (result.status !== 0) return false
      return (result.stdout || "").trim() === "1"
    } catch {
      return false
    }
  }

  return false
}

function names(platform, arch) {
  const libc = detectLibc(platform, arch)
  const base = `slopcode-bin-${libc === "bionic" ? "android" : platform}-${arch}`
  if (libc === "bionic") return [`@slopcode-ai/slopcode-android-${arch}`, base, `slopcode-android-${arch}`]
  const avx2 = supportsAvx2(platform, arch)
  const baseline = arch === "x64" && !avx2

  if (platform === "linux") {
    if (libc === "musl") {
      if (arch === "x64") {
        if (baseline) return [`${base}-baseline-musl`, `${base}-musl`, `${base}-baseline`, base]
        return [`${base}-musl`, `${base}-baseline-musl`, base, `${base}-baseline`]
      }
      return [`${base}-musl`, base]
    }
    if (libc === "glibc") {
      if (arch === "x64") {
        if (baseline) return [`${base}-baseline`, base, `${base}-baseline-musl`, `${base}-musl`]
        return [base, `${base}-baseline`, `${base}-musl`, `${base}-baseline-musl`]
      }
      return [base, `${base}-musl`]
    }
    if (arch === "x64") {
      if (baseline) return [`${base}-baseline`, base, `${base}-baseline-musl`, `${base}-musl`]
      return [base, `${base}-baseline`, `${base}-musl`, `${base}-baseline-musl`]
    }
    return [base, `${base}-musl`]
  }

  if (arch === "x64") {
    if (baseline) return [`${base}-baseline`, base]
    return [base, `${base}-baseline`]
  }

  return [base]
}

function clearCache() {
  fs.rmSync(path.join(__dirname, "bin", ".slopcode"), { force: true })
  fs.rmSync(path.join(__dirname, "bin", ".slopcode.json"), { force: true })
  fs.rmSync(path.join(__dirname, "bin", "neovim"), { recursive: true, force: true })
}

function supportedMessage() {
  return Object.entries(supported)
    .map(([platform, archs]) => `${platform}:${archs.join(",")}`)
    .join(" ")
}

function termuxMessage() {
  return [
    "SlopCode native Termux support could not install the Android runtime/bootstrap.",
    "Install from Termux with:",
    "  pkg update",
    "  pkg install nodejs git ripgrep neovim tar",
    "  npm install -g slopcode@latest --include=optional",
    "If that still fails, install the matching GitHub release asset manually.",
  ].join("\n")
}

function androidPackage(arch) {
  return `@slopcode-ai/slopcode-android-${arch}`
}

function androidTarget(arch) {
  return path.join(__dirname, "node_modules", "@slopcode-ai", `slopcode-android-${arch}`)
}

function androidUrl(arch) {
  return `https://github.com/teamslop/slopcode/releases/download/v${pkg.version}/slopcode-android-${arch}.tar.gz`
}

const androidBunVersion = "1.3.14"

function androidBunPackage(arch) {
  return arch === "arm64" ? "bun-linux-aarch64-android" : "bun-linux-x64-android"
}

function androidBunTarget(arch) {
  return path.join(__dirname, "node_modules", "@oven", androidBunPackage(arch))
}

function androidBunUrl(arch) {
  const name = androidBunPackage(arch)
  return `https://registry.npmjs.org/@oven/${name}/-/${name}-${androidBunVersion}.tgz`
}

async function androidAsset(arch, tmp) {
  if (process.env.SLOPCODE_ANDROID_ASSET_PATH) return process.env.SLOPCODE_ANDROID_ASSET_PATH
  const out = path.join(tmp, `slopcode-android-${arch}.tar.gz`)
  const res = await fetch(process.env.SLOPCODE_ANDROID_ASSET_URL || androidUrl(arch))
  if (!res.ok) throw new Error(`Failed to download Android runtime: ${res.status} ${res.statusText}`)
  await fs.promises.writeFile(out, Buffer.from(await res.arrayBuffer()))
  return out
}

async function installAndroid(arch) {
  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "slopcode-android-"))
  const target = androidTarget(arch)
  try {
    const archive = await androidAsset(arch, tmp)
    const extract = path.join(tmp, "package")
    await fs.promises.mkdir(extract, { recursive: true })
    const result = require("child_process").spawnSync("tar", ["-xzf", path.basename(archive), "-C", extract], {
      cwd: path.dirname(archive),
      encoding: "utf8",
      timeout: 120000,
    })
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "tar failed").trim())
    }
    const binary = path.join(extract, "bin", "slopcode")
    if (!fs.existsSync(binary)) throw new Error("Downloaded Android runtime is missing bin/slopcode")
    await fs.promises.rm(target, { recursive: true, force: true })
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.rename(extract, target)
    fs.chmodSync(path.join(target, "bin", "slopcode"), 0o755)
    return {
      binaryPath: path.join(target, "bin", "slopcode"),
      binaryName: "slopcode",
      packageName: androidPackage(arch),
      platform: "android",
      arch,
      libc: "bionic",
    }
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true })
  }
}

async function androidBunAsset(arch, tmp) {
  if (process.env.SLOPCODE_ANDROID_BUN_ASSET_PATH) return process.env.SLOPCODE_ANDROID_BUN_ASSET_PATH
  const out = path.join(tmp, `${androidBunPackage(arch)}.tgz`)
  const res = await fetch(process.env.SLOPCODE_ANDROID_BUN_ASSET_URL || androidBunUrl(arch))
  if (!res.ok) throw new Error(`Failed to download Android Bun bootstrap: ${res.status} ${res.statusText}`)
  await fs.promises.writeFile(out, Buffer.from(await res.arrayBuffer()))
  return out
}

async function installAndroidBun(arch) {
  const target = androidBunTarget(arch)
  const existing = path.join(target, "bin", "bun")
  if (fs.existsSync(existing)) {
    fs.chmodSync(existing, 0o755)
    return "detected"
  }

  const tmp = await fs.promises.mkdtemp(path.join(os.tmpdir(), "slopcode-android-bun-"))
  try {
    const archive = await androidBunAsset(arch, tmp)
    const extract = path.join(tmp, "extract")
    await fs.promises.mkdir(extract, { recursive: true })
    const result = require("child_process").spawnSync("tar", ["-xzf", path.basename(archive), "-C", extract], {
      cwd: path.dirname(archive),
      encoding: "utf8",
      timeout: 120000,
    })
    if (result.status !== 0) {
      throw new Error((result.stderr || result.stdout || "tar failed").trim())
    }
    const source = fs.existsSync(path.join(extract, "package", "bin", "bun")) ? path.join(extract, "package") : extract
    const binary = path.join(source, "bin", "bun")
    if (!fs.existsSync(binary)) throw new Error("Downloaded Android Bun bootstrap is missing bin/bun")
    await fs.promises.rm(target, { recursive: true, force: true })
    await fs.promises.mkdir(path.dirname(target), { recursive: true })
    await fs.promises.rename(source, target)
    fs.chmodSync(path.join(target, "bin", "bun"), 0o755)
    return "installed"
  } finally {
    await fs.promises.rm(tmp, { recursive: true, force: true })
  }
}

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const binaryName = platform === "windows" ? "slopcode.exe" : "slopcode"

  for (const name of names(platform, arch)) {
    try {
      const packageJsonPath = require.resolve(`${name}/package.json`)
      const packageDir = path.dirname(packageJsonPath)
      const binaryPath = path.join(packageDir, "bin", binaryName)
      if (fs.existsSync(binaryPath)) {
        return { binaryPath, binaryName, packageName: name, platform, arch, libc: detectLibc(platform, arch) }
      }
    } catch {
      continue
    }
  }
}

function cacheSidecar(sourcePath) {
  const source = path.join(path.dirname(sourcePath), "neovim")
  if (!fs.existsSync(source)) return false
  const target = path.join(__dirname, "bin", "neovim")
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true, force: true })
  return true
}

function prepareBinDirectory(binaryName) {
  const binDir = path.join(__dirname, "bin")
  const targetPath = path.join(binDir, binaryName)

  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
  }

  return { targetPath }
}

function writeMeta(input) {
  fs.writeFileSync(
    path.join(__dirname, "bin", ".slopcode.json"),
    JSON.stringify(
      {
        version: pkg.version,
        platform: input.platform,
        arch: input.arch,
        libc: input.libc,
        package: input.packageName,
        binary: input.binaryName,
        sidecar: input.sidecar,
      },
      null,
      2,
    ),
  )
}

async function main() {
  try {
    const { platform, arch } = detectPlatformAndArch()

    if (!(supported[platform] ?? []).includes(arch)) {
      clearCache()
      console.log(
        `Unsupported slopcode platform during postinstall: ${platform}/${arch}. Supported targets: ${supportedMessage()}`,
      )
      return
    }

    if (platform === "windows") {
      console.log("Windows detected: binary setup not needed (using packaged .exe)")
      return
    }

    const found = findBinary()
    if (!found) {
      clearCache()
      if (detectLibc(platform, arch) === "bionic") {
        try {
          await installAndroid(arch)
          await installAndroidBun(arch)
          console.log("Android/Termux runtime and bootstrap installed from release assets")
        } catch (error) {
          console.log(termuxMessage())
          console.error(error.message)
        }
        return
      }
      console.log("No platform binary package detected during postinstall; runtime resolver will handle it")
      return
    }

    if (found.libc === "bionic") {
      clearCache()
      try {
        await installAndroidBun(arch)
        console.log("Android/Termux runtime package detected; runtime resolver will launch it")
      } catch (error) {
        console.log(termuxMessage())
        console.error(error.message)
      }
      return
    }
    clearCache()
    const target = path.join(__dirname, "bin", ".slopcode")
    const { targetPath } = prepareBinDirectory(".slopcode")
    try {
      fs.linkSync(found.binaryPath, targetPath)
    } catch {
      fs.copyFileSync(found.binaryPath, target)
    }
    fs.chmodSync(target, 0o755)
    const sidecar = cacheSidecar(found.binaryPath)
    writeMeta({
      ...found,
      sidecar,
    })
  } catch (error) {
    clearCache()
    console.error("Failed to setup slopcode binary cache:", error.message)
    process.exit(0)
  }
}

try {
  await main()
} catch (error) {
  clearCache()
  console.error("Postinstall script error:", error.message)
  process.exit(0)
}
