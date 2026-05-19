import fs from "fs"
import path from "path"

export type HostProbe = {
  enabled: boolean
  available: boolean
  strategy: "opentui" | "sidecar" | "fallback"
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
  importer?: (name: string) => Promise<unknown>
}

export function sidecar(input: Pick<Input, "root" | "sidecar"> = {}) {
  if (input.sidecar) return input.sidecar
  if (input.root) return path.join(input.root, "bin", "slopcode-android-host")
}

export function wanted(value = process.env.SLOPCODE_ANDROID_HOST) {
  if (!value || value === "0" || value === "false") return
  if (value === "sidecar") return "sidecar"
  return "opentui"
}

export async function probe(input: Input = {}): Promise<HostProbe> {
  const platform = input.platform ?? process.platform
  const mode = wanted(input.host)
  const bin = sidecar({
    root: input.root ?? process.env.SLOPCODE_ANDROID_ROOT,
    sidecar: input.sidecar ?? process.env.SLOPCODE_ANDROID_HOST_PATH,
  })
  const exists = input.fs ?? fs
  if (platform !== "android") {
    return { enabled: false, available: false, strategy: "fallback", reason: "not-android", sidecar: bin }
  }
  if (input.tui === "1") {
    return { enabled: true, available: true, strategy: "opentui", reason: "legacy-native-override", sidecar: bin }
  }
  if (!mode) {
    return { enabled: false, available: false, strategy: "fallback", reason: "android-host-disabled", sidecar: bin }
  }
  if (mode === "sidecar") {
    if (bin && exists.existsSync(bin)) {
      return { enabled: true, available: true, strategy: "sidecar", reason: "sidecar-ready", sidecar: bin }
    }
    return { enabled: true, available: false, strategy: "fallback", reason: "sidecar-missing", sidecar: bin }
  }

  const imported: true | string = await (input.importer ?? ((name) => import(name)))("@opentui/solid").then(
    () => true,
    (error) => (error instanceof Error ? error.message : String(error)),
  )
  if (imported === true)
    return { enabled: true, available: true, strategy: "opentui", reason: "opentui-ready", sidecar: bin }
  return { enabled: true, available: false, strategy: "fallback", reason: imported, sidecar: bin }
}
