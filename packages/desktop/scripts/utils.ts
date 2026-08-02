import { $ } from "bun"
import { chmod, copyFile, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export type Channel = "dev" | "beta" | "prod"

export function resolveChannel(): Channel {
  const raw = Bun.env.SLOPCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
}

export const SIDECAR_BINARIES: Array<{
  rustTarget: string
  ocBinary: string
  assetExt: string
  package: string
  os: string
  cpu: string
}> = [
  {
    rustTarget: "aarch64-apple-darwin",
    ocBinary: "slopcode-darwin-arm64",
    assetExt: "zip",
    package: "slopcode-bin-darwin-arm64",
    os: "darwin",
    cpu: "arm64",
  },
  {
    rustTarget: "x86_64-apple-darwin",
    ocBinary: "slopcode-darwin-x64-baseline",
    assetExt: "zip",
    package: "slopcode-bin-darwin-x64-baseline",
    os: "darwin",
    cpu: "x64",
  },
  {
    rustTarget: "aarch64-pc-windows-msvc",
    ocBinary: "slopcode-windows-arm64",
    assetExt: "zip",
    package: "slopcode-bin-windows-arm64",
    os: "win32",
    cpu: "arm64",
  },
  {
    rustTarget: "x86_64-pc-windows-msvc",
    ocBinary: "slopcode-windows-x64-baseline",
    assetExt: "zip",
    package: "slopcode-bin-windows-x64-baseline",
    os: "win32",
    cpu: "x64",
  },
  {
    rustTarget: "x86_64-unknown-linux-gnu",
    ocBinary: "slopcode-linux-x64-baseline",
    assetExt: "tar.gz",
    package: "slopcode-bin-linux-x64-baseline",
    os: "linux",
    cpu: "x64",
  },
  {
    rustTarget: "aarch64-unknown-linux-gnu",
    ocBinary: "slopcode-linux-arm64",
    assetExt: "tar.gz",
    package: "slopcode-bin-linux-arm64",
    os: "linux",
    cpu: "arm64",
  },
]

export const RUST_TARGET = Bun.env.RUST_TARGET

function nativeTarget() {
  const { platform, arch } = process
  if (platform === "darwin") return arch === "arm64" ? "aarch64-apple-darwin" : "x86_64-apple-darwin"
  if (platform === "win32") return arch === "arm64" ? "aarch64-pc-windows-msvc" : "x86_64-pc-windows-msvc"
  if (platform === "linux") return arch === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu"
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}

export function getCurrentSidecar(target = Bun.env.RUST_TARGET ?? nativeTarget()) {
  const binaryConfig = SIDECAR_BINARIES.find((b) => b.rustTarget === target)
  if (!binaryConfig) throw new Error(`Sidecar configuration not available for Rust target '${target}'`)

  return binaryConfig
}

export function sidecarExecutable(target = Bun.env.RUST_TARGET ?? nativeTarget()) {
  return `slopcode-cli${getCurrentSidecar(target).os === "win32" ? ".exe" : ""}`
}

export function cliResource(target = Bun.env.RUST_TARGET ?? nativeTarget()) {
  const file = sidecarExecutable(target)
  return { from: `resources/${file}`, to: file }
}

export function canValidateSidecar(target: string, host: Pick<NodeJS.Process, "platform" | "arch"> = process) {
  const sidecar = getCurrentSidecar(target)
  return sidecar.os === host.platform && sidecar.cpu === host.arch
}

export async function copyBinaryToSidecarFolder(source: string) {
  const dir = `resources`
  await $`mkdir -p ${dir}`
  const dest = join(dir, sidecarExecutable())
  await $`cp ${source} ${dest}`
  if (process.platform === "win32" && process.env.GITHUB_ACTIONS === "true") {
    await $`pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File ../../script/sign-windows.ps1 ${dest}`
  }
  if (process.platform === "darwin") await $`codesign --force --sign - ${dest}`

  console.log(`Copied ${source} to ${dest}`)
}

export async function downloadCliToResources(input?: string) {
  const version = (input ?? Bun.env.SLOPCODE_VERSION ?? (await Bun.file("./package.json").json()).version).replace(
    /^v/,
    "",
  )
  if (!/^[0-9A-Za-z][0-9A-Za-z.-]*$/.test(version)) throw new Error(`Invalid SlopCode CLI version '${version}'`)
  const target = getCurrentSidecar()
  const destination = join("resources", sidecarExecutable(target.rustTarget))
  if (canValidateSidecar(target.rustTarget) && (await matches(destination, version))) {
    console.log(`Reused ${target.package}@${version} at ${destination}`)
    return destination
  }

  const directory = await mkdtemp(join(tmpdir(), "slopcode-desktop-cli-"))
  try {
    await $`bun install --no-save --cwd ${directory} ${`${target.package}@${version}`} ${`--os=${target.os}`} ${`--cpu=${target.cpu}`}`
    if (!(await packageMatches(directory, target.package, version)))
      throw new Error(`Downloaded ${target.package} did not report version ${version}`)
    const source = join(
      directory,
      "node_modules",
      target.package,
      "bin",
      target.os === "win32" ? "slopcode.exe" : "slopcode",
    )
    await copyFile(source, destination)
    if (target.os !== "win32") await chmod(destination, 0o755)
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
  if (process.platform === "win32" && process.env.GITHUB_ACTIONS === "true") {
    await $`pwsh -NoLogo -NoProfile -ExecutionPolicy Bypass -File ../../script/sign-windows.ps1 ${destination}`
  }
  if (process.platform === "darwin") await $`codesign --force --sign - ${destination}`
  if (canValidateSidecar(target.rustTarget) && !(await matches(destination, version)))
    throw new Error(`Staged SlopCode CLI did not report version ${version}`)
  console.log(`Staged ${target.package}@${version} at ${destination}`)
  return destination
}

async function packageMatches(directory: string, name: string, version: string) {
  const file = Bun.file(join(directory, "node_modules", name, "package.json"))
  if (!(await file.exists())) return false
  const value: unknown = await file.json()
  return typeof value === "object" && value !== null && (value as { version?: unknown }).version === version
}

async function matches(binary: string, version: string) {
  if (!(await Bun.file(binary).exists())) return false
  const result = Bun.spawnSync([binary, "--version"])
  return result.exitCode === 0 && result.stdout.toString().trim() === version
}

export function windowsify(path: string) {
  if (path.endsWith(".exe")) return path
  return `${path}${process.platform === "win32" ? ".exe" : ""}`
}
