import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { Configuration } from "electron-builder"
import { cliResource } from "./scripts/utils"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
// The Electron 42 packaging update briefly installed Linux launchers/icons under
// "slopcode-desktop". Keep that hidden desktop entry around so existing GNOME/KDE
// pins still resolve after the canonical app id changes back to ai.slopcode.desktop.
const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "slopcode-desktop.desktop")
const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/slopcode-desktop.desktop`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

const channel = (() => {
  const raw = process.env.SLOPCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const APP_IDS = {
  dev: "ai.slopcode.desktop.dev",
  beta: "ai.slopcode.desktop.beta",
  prod: "ai.slopcode.desktop",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "slopcode-desktop-${os}-${arch}.${ext}",
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "ai.slopcode.desktop" becomes
  // "ai.slopcode.desktop.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/slopcode-cli*"],
  extraResources: [
    cliResource(),
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: "SlopCode",
    schemes: ["slopcode"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "SlopCode Dev",
        rpm: { packageName: "slopcode-dev" },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "SlopCode Beta",
        protocols: { name: "SlopCode Beta", schemes: ["slopcode"] },
        publish: { provider: "github", owner: "anomalyco", repo: "slopcode-beta", channel: "latest" },
        rpm: { packageName: "slopcode-beta" },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "SlopCode",
        protocols: { name: "SlopCode", schemes: ["slopcode"] },
        publish: { provider: "github", owner: "anomalyco", repo: "slopcode", channel: "latest" },
        deb: { fpm: [legacyDesktopEntryFpm] },
        rpm: { packageName: "slopcode", fpm: [legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
