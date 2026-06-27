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

function detectLibc(platform, arch) {
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
  const base = `slopcode-bin-${platform}-${arch}`
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
      console.log("No platform binary package detected during postinstall; runtime resolver will handle it")
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
