import fs from "fs"
import path from "path"

export type HostProbe = {
  enabled: boolean
  available: boolean
  strategy: "sidecar" | "fallback"
  reason: string
  sidecar?: string
}

type Input = {
  platform?: string
  root?: string
  host?: string
  tui?: string
  sidecar?: string
  fs?: Pick<typeof fs, "existsSync">
}

export function sidecar(input: Pick<Input, "root" | "sidecar"> = {}) {
  if (input.sidecar) return input.sidecar
  if (input.root) return path.join(input.root, "bin", "slopcode-android-host")
}

export function wanted(value = process.env.SLOPCODE_ANDROID_HOST) {
  const text = value?.toLowerCase()
  if (text === "0" || text === "false" || text === "off" || text === "portable") return
  return "sidecar"
}

export async function probe(input: Input = {}): Promise<HostProbe> {
  const platform = input.platform ?? process.platform
  const bin = sidecar({
    root: input.root ?? process.env.SLOPCODE_ANDROID_ROOT,
    sidecar: input.sidecar ?? process.env.SLOPCODE_ANDROID_HOST_PATH,
  })
  const exists = input.fs ?? fs
  if (platform !== "android") {
    return { enabled: false, available: false, strategy: "fallback", reason: "not-android", sidecar: bin }
  }

  const mode = wanted(input.host)
  if (!mode) {
    return { enabled: false, available: false, strategy: "fallback", reason: "android-host-disabled", sidecar: bin }
  }

  const legacy = input.tui === "1" || input.host?.toLowerCase() === "opentui" || input.host?.toLowerCase() === "shared"
  if (bin && exists.existsSync(bin)) {
    return {
      enabled: true,
      available: true,
      strategy: "sidecar",
      reason: legacy ? "android-rust-only" : "sidecar-ready",
      sidecar: bin,
    }
  }
  return {
    enabled: true,
    available: false,
    strategy: "fallback",
    reason: legacy ? "android-rust-only-sidecar-missing" : "sidecar-missing",
    sidecar: bin,
  }
}
