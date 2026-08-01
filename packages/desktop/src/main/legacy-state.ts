import { existsSync, readdirSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import electron from "electron"

type Channel = "dev" | "beta" | "prod"
const raw = import.meta.env.SLOPCODE_CHANNEL
const channel: Channel = raw === "dev" || raw === "beta" || raw === "prod" ? raw : "dev"

const appIds: Record<string, string> = {
  dev: "ai.slopcode.desktop.dev",
  beta: "ai.slopcode.desktop.beta",
  prod: "ai.slopcode.desktop",
}

const app = electron.app

type Entry = {
  name: string
  isFile: () => boolean
}

export function tauriAppId() {
  return app.isPackaged ? appIds[channel] : "ai.slopcode.desktop.dev"
}

export function tauriAppDataPath(id = tauriAppId()) {
  switch (process.platform) {
    case "darwin":
      return join(homedir(), "Library", "Application Support", id)
    case "win32":
      return join(process.env.APPDATA ?? join(homedir(), "AppData", "Roaming"), id)
    default:
      return join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), id)
  }
}

export function hasLegacyTauriEntries(entries: readonly Entry[]) {
  return entries.some((entry) => entry.isFile() && entry.name.endsWith(".dat"))
}

export function hasLegacyTauriState(path = tauriAppDataPath()) {
  if (!existsSync(path)) return false
  return hasLegacyTauriEntries(readdirSync(path, { withFileTypes: true }))
}
