import { Installation } from "@/installation"
import { cmd } from "./cmd"
import { probe, sidecar, wanted } from "./tui/android-host/probe"
import fs from "fs"
import os from "os"
import path from "path"
import { createRequire } from "module"

const require = createRequire(import.meta.url)

function termux() {
  return Boolean(process.env.TERMUX_VERSION || process.env.PREFIX?.includes("/com.termux/"))
}

function exists(file: string | undefined) {
  return Boolean(file && fs.existsSync(file))
}

function androidRoot() {
  const root = process.env.SLOPCODE_ANDROID_ROOT
  if (root) return root
  const found = [
    "slopcode-bin-android-arm64",
    "slopcode-bin-android-x64",
    "slopcode-android-arm64",
    "slopcode-android-x64",
    "@slopcode-ai/slopcode-android-arm64",
    "@slopcode-ai/slopcode-android-x64",
  ]
    .map((name) => {
      try {
        return path.dirname(require.resolve(`${name}/package.json`))
      } catch {
        return undefined
      }
    })
    .find(Boolean)
  return found
}

export const DoctorCommand = cmd({
  command: "doctor",
  describe: "diagnose runtime and installation issues",
  builder: (yargs) => yargs.command(AndroidCommand).demandCommand(),
  async handler() {},
})

const AndroidCommand = cmd({
  command: "android",
  describe: "diagnose Android/Termux runtime mode",
  builder: (yargs) =>
    yargs.option("json", {
      type: "boolean",
      describe: "print machine-readable diagnostics",
    }),
  async handler(args) {
    const root = androidRoot()
    const bin = sidecar({ root, sidecar: process.env.SLOPCODE_ANDROID_HOST_PATH })
    const status = await probe({
      platform: String(process.platform),
      root,
      host: process.env.SLOPCODE_ANDROID_HOST,
      tui: process.env.SLOPCODE_ANDROID_TUI,
      sidecar: process.env.SLOPCODE_ANDROID_HOST_PATH,
    })
    const legacyOpenTuiRequested = status.reason.startsWith("android-rust-only")
    const info = {
      version: Installation.VERSION,
      platform: String(process.platform),
      arch: os.arch(),
      termux: termux(),
      mode: wanted(process.env.SLOPCODE_ANDROID_HOST) ? "sidecar" : "disabled",
      strategy: status.strategy,
      renderer: status.strategy === "sidecar" ? "ratatui/crossterm" : "portable",
      targetRenderer: status.strategy === "sidecar" ? "ratatui/crossterm" : undefined,
      tuiCoreVersion: status.strategy === "sidecar" ? "rust-ratatui-1" : undefined,
      available: status.available,
      reason: status.reason,
      root,
      sidecar: bin,
      sidecarExists: exists(bin),
      legacyFallbackAvailable: exists(bin),
      bun: process.execPath,
      ffiBlocked: String(process.platform) === "android" && legacyOpenTuiRequested && !status.available,
      termuxApi: {
        clipboard: exists(path.join(process.env.PREFIX ?? "", "bin", "termux-clipboard-get")) &&
          exists(path.join(process.env.PREFIX ?? "", "bin", "termux-clipboard-set")),
        open: exists(path.join(process.env.PREFIX ?? "", "bin", "termux-open")),
      },
    }
    if (args.json) {
      console.log(JSON.stringify(info, null, 2))
      return
    }
    console.log(`SlopCode ${info.version}`)
    console.log(`platform ${info.platform}/${info.arch}${info.termux ? " termux" : ""}`)
    console.log(`android mode ${info.mode}`)
    console.log(`strategy ${info.strategy} ${info.available ? "available" : "unavailable"}`)
    console.log(`renderer ${info.renderer}`)
    if (info.tuiCoreVersion) console.log(`tui core ${info.tuiCoreVersion}`)
    if (info.targetRenderer) console.log(`target renderer ${info.targetRenderer}`)
    console.log(`reason ${info.reason}`)
    console.log(`root ${info.root ?? "missing"}`)
    console.log(`sidecar ${info.sidecar ?? "missing"}`)
    console.log(`sidecar file ${info.sidecarExists ? "ok" : "missing"}`)
    if (info.ffiBlocked) console.log("OpenTUI mode is unavailable on Android; use the bundled Rust TUI")
    if (!info.available) process.exitCode = 1
  },
})
