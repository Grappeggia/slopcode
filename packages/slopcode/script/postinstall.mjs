#!/usr/bin/env node

import fs from "fs"
import path from "path"
import os from "os"
import { fileURLToPath } from "url"
import { createRequire } from "module"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)

function detectPlatformAndArch() {
  // Map platform names
  let platform
  switch (os.platform()) {
    case "darwin":
      platform = "darwin"
      break
    case "linux":
      platform = "linux"
      break
    case "win32":
      platform = "windows"
      break
    default:
      platform = os.platform()
      break
  }

  // Map architecture names
  let arch
  switch (os.arch()) {
    case "x64":
      arch = "x64"
      break
    case "arm64":
      arch = "arm64"
      break
    case "arm":
      arch = "arm"
      break
    default:
      arch = os.arch()
      break
  }

  return { platform, arch }
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
  const base = `slopcode-bin-${platform}-${arch}`
  const avx2 = supportsAvx2(platform, arch)
  const baseline = arch === "x64" && !avx2

  if (platform === "linux") {
    const musl = (() => {
      try {
        if (fs.existsSync("/etc/alpine-release")) return true
      } catch {}

      try {
        const result = require("child_process").spawnSync("ldd", ["--version"], { encoding: "utf8" })
        const text = ((result.stdout || "") + (result.stderr || "")).toLowerCase()
        if (text.includes("musl")) return true
      } catch {}

      return false
    })()

    if (musl) {
      if (arch === "x64") {
        if (baseline) return [`${base}-baseline-musl`, `${base}-musl`, `${base}-baseline`, base]
        return [`${base}-musl`, `${base}-baseline-musl`, base, `${base}-baseline`]
      }
      return [`${base}-musl`, base]
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

function findBinary() {
  const { platform, arch } = detectPlatformAndArch()
  const binaryName = platform === "windows" ? "slopcode.exe" : "slopcode"

  for (const name of names(platform, arch)) {
    try {
      const packageJsonPath = require.resolve(`${name}/package.json`)
      const packageDir = path.dirname(packageJsonPath)
      const binaryPath = path.join(packageDir, "bin", binaryName)
      if (fs.existsSync(binaryPath)) {
        return { binaryPath, binaryName }
      }
    } catch {
      continue
    }
  }

  return
}

function cacheSidecar(sourcePath) {
  const source = path.join(path.dirname(sourcePath), "neovim")
  if (!fs.existsSync(source)) return
  const target = path.join(__dirname, "bin", "neovim")
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true, force: true })
}

function prepareBinDirectory(binaryName) {
  const binDir = path.join(__dirname, "bin")
  const targetPath = path.join(binDir, binaryName)

  // Ensure bin directory exists
  if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true })
  }

  // Remove existing binary/symlink if it exists
  if (fs.existsSync(targetPath)) {
    fs.unlinkSync(targetPath)
  }

  return { binDir, targetPath }
}

function symlinkBinary(sourcePath, binaryName) {
  const { targetPath } = prepareBinDirectory(binaryName)

  fs.symlinkSync(sourcePath, targetPath)
  console.log(`slopcode binary symlinked: ${targetPath} -> ${sourcePath}`)

  // Verify the file exists after operation
  if (!fs.existsSync(targetPath)) {
    throw new Error(`Failed to symlink binary to ${targetPath}`)
  }
}

async function main() {
  try {
    if (os.platform() === "win32") {
      // On Windows, the .exe is already included in the package and bin field points to it
      // No postinstall setup needed
      console.log("Windows detected: binary setup not needed (using packaged .exe)")
      return
    }

    // On non-Windows platforms, just verify the binary package exists
    // Don't replace the wrapper script - it handles binary execution
    const found = findBinary()
    if (!found) {
      console.log("No platform binary package detected during postinstall; runtime resolver will handle it")
      return
    }
    const binaryPath = found.binaryPath
    const target = path.join(__dirname, "bin", ".slopcode")
    if (fs.existsSync(target)) fs.unlinkSync(target)
    try {
      fs.linkSync(binaryPath, target)
    } catch {
      fs.copyFileSync(binaryPath, target)
    }
    fs.chmodSync(target, 0o755)
    cacheSidecar(binaryPath)
  } catch (error) {
    console.error("Failed to setup slopcode binary cache:", error.message)
    process.exit(0)
  }
}

try {
  main()
} catch (error) {
  console.error("Postinstall script error:", error.message)
  process.exit(0)
}
