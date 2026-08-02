import { createHash, randomUUID } from "node:crypto"
import { mkdirSync, rmSync } from "node:fs"
import * as http from "node:http"
import { createServer } from "node:net"
import { homedir, tmpdir } from "node:os"
import { join } from "node:path"
import { getCACertificates, setDefaultCACertificates } from "node:tls"
import type { Event } from "electron"
import { app, BrowserWindow } from "electron"

import { Deferred, Effect, Fiber } from "effect"
import contextMenu from "electron-context-menu"

import type { ServerReadyData } from "../preload/types"
import { checkAppExists, resolveAppPath } from "./apps"
import { backgroundCliSource, createBackgroundCli, type BackgroundCli } from "./background-cli"
import { CHANNEL } from "./constants"
import { registerIpcHandlers, sendDeepLinks, sendMenuCommand } from "./ipc"
import { forwardInitializationFailure } from "./initialization"
import { exportDebugLogs, initCrashReporter, initLogging, startNetLog, write as writeLog } from "./logging"
import { parseMarkdown } from "./markdown"
import { createMenu } from "./menu"
import {
  getDefaultServerUrl,
  preferAppEnv,
  setDefaultServerUrl,
  spawnLocalServer,
  type SidecarListener,
} from "./server"
import { setupAutoUpdater, showUpdaterDialog } from "./updater"
import {
  createMainWindow,
  getLastFocusedWindow,
  registerRendererProtocol,
  restoreMainWindows,
  setAppQuitting,
  setRelaunchHandler,
  setBackgroundColor,
  setDockIcon,
} from "./windows"
import { createWslServersController } from "./wsl/servers"
import { registerWslIpcHandlers } from "./wsl/ipc"
import { spawnWslSidecar } from "./wsl/sidecar"
import { migrate } from "./migrate"
import { cleanupStoreFiles } from "./store-cleanup"
import {
  finishFirstLaunchOnboarding,
  initializeOldLayoutEligibility,
  isFirstLaunchOnboardingPending,
  isOldLayoutEligible,
} from "./onboarding"
import { safeWebContentsURL } from "./window-state"
import { createRemoteSupervisor, createSshRemoteHostService } from "./remote"
import { rendererCorsOrigins } from "../security"
import { stopServices } from "./shutdown"

const APP_NAMES: Record<string, string> = {
  dev: "SlopCode Dev",
  beta: "SlopCode Beta",
  prod: "SlopCode",
}
const APP_IDS: Record<string, string> = {
  dev: "ai.slopcode.desktop.dev",
  beta: "ai.slopcode.desktop.beta",
  prod: "ai.slopcode.desktop",
}
const TEST_ONBOARDING = process.env.SLOPCODE_TEST_ONBOARDING === "1"
const SIDECAR_VERSION =
  process.env.SLOPCODE_SIDECAR_V2 === "0"
    ? "v1"
    : app.isPackaged || process.env.SLOPCODE_SIDECAR_V2 === "1"
      ? "v2"
      : "v1"
const jsCallStackFeature = "DocumentPolicyIncludeJSCallStacksInCrashReports"

let logger: ReturnType<typeof initLogging>
let mainWindow: BrowserWindow | null = null
let server: SidecarListener | null = null
let background: BackgroundCli | undefined
let stopRemoteSupervisor: (() => void) | undefined
const remoteHost = createSshRemoteHostService()

const pendingDeepLinks: string[] = []

function useEnvProxy() {
  try {
    // Electron 41.2 runs Node 24.14.1; latest @types/node@24 is 24.12.2.
    ;(http as any).setGlobalProxyFromEnv()
  } catch (error) {
    logger.warn("failed to load proxy environment", error)
  }
}

function emitDeepLinks(urls: string[]) {
  if (urls.length === 0) return
  pendingDeepLinks.push(...urls)
  const win = getLastFocusedWindow() ?? mainWindow
  if (win) sendDeepLinks(win, urls)
}

async function killSidecar() {
  stopRemoteSupervisor?.()
  stopRemoteSupervisor = undefined
  const service = background
  background = undefined
  await service?.stop()
  if (!server) return
  const current = server
  server = null
  await current.stop()
}

function ensureLoopbackNoProxy() {
  const loopback = ["127.0.0.1", "localhost", "::1"]
  const upsert = (key: string) => {
    const items = (process.env[key] ?? "")
      .split(",")
      .map((value: string) => value.trim())
      .filter((value: string) => Boolean(value))

    for (const host of loopback) {
      if (items.some((value: string) => value.toLowerCase() === host)) continue
      items.push(host)
    }

    process.env[key] = items.join(",")
  }

  upsert("NO_PROXY")
  upsert("no_proxy")
}

async function waitForEmbeddedHealth(wait: Promise<void>) {
  const expired = Promise.withResolvers<never>()
  const timer = setTimeout(
    () => expired.reject(new Error("Embedded sidecar health check timed out after 30000ms")),
    30_000,
  )
  timer.unref()
  try {
    await Promise.race([wait, expired.promise])
  } finally {
    clearTimeout(timer)
  }
}

const main = Effect.gen(function* () {
  contextMenu({ showSaveImageAs: true, showLookUpSelection: false, showSearchWithGoogle: false })

  // on macOS apps run in `/` which can cause issues with ripgrep
  try {
    process.chdir(homedir())
  } catch {}

  process.env.SLOPCODE_DISABLE_EMBEDDED_WEB_UI = "true"

  const appId = app.isPackaged ? APP_IDS[CHANNEL] : "ai.slopcode.desktop.dev"
  const onboardingTestRoot = ((): string | undefined => {
    if (!TEST_ONBOARDING) return

    const root = join(tmpdir(), `slopcode-onboarding-${randomUUID()}`)
    rmSync(root, { recursive: true, force: true })
    ;["data", "config", "cache", "state", "desktop", "session"].forEach((dir) =>
      mkdirSync(join(root, dir), { recursive: true }),
    )
    process.env.SLOPCODE_DB = ":memory:"
    process.env.XDG_DATA_HOME = join(root, "data")
    process.env.XDG_CONFIG_HOME = join(root, "config")
    process.env.XDG_CACHE_HOME = join(root, "cache")
    process.env.XDG_STATE_HOME = join(root, "state")
    return root
  })()
  app.setName(app.isPackaged ? APP_NAMES[CHANNEL] : "SlopCode Dev")
  app.setAppUserModelId(appId)
  app.setPath(
    "userData",
    onboardingTestRoot ? join(onboardingTestRoot, "desktop") : join(app.getPath("appData"), appId),
  )
  if (onboardingTestRoot) app.setPath("sessionData", join(onboardingTestRoot, "session"))
  logger = initLogging()
  initCrashReporter()

  const wslServers = createWslServersController(
    app.getVersion(),
    async (distro) => {
      logger.log("spawning wsl sidecar", { distro })
      return spawnWslSidecar(distro, {
        onLine: (line) => logger.log("wsl sidecar", { distro, stream: line.stream, text: line.text }),
      })
    },
    {
      logger: {
        log: (message, meta) => logger.log(message, meta),
        error: (message, meta) => logger.error(message, meta),
      },
    },
  )
  let stopping: Promise<void> | undefined
  const stopSidecars = () => {
    if (stopping) return stopping
    stopping = stopServices([killSidecar(), remoteHost.stopAll()], () => wslServers.stopAll()).finally(() => {
      stopping = undefined
    })
    return stopping
  }
  const relaunch = () => {
    void stopSidecars()
      .catch((error) => logger.error("sidecar cleanup failed before relaunch", error))
      .finally(() => {
        app.relaunch()
        app.exit(0)
      })
  }

  try {
    setDefaultCACertificates([...new Set([...getCACertificates("default"), ...getCACertificates("system")])])
  } catch (error) {
    logger.warn("failed to load system certificates", error)
  }

  logger.log("app starting", {
    version: app.getVersion(),
    packaged: app.isPackaged,
    onboardingTest: Boolean(onboardingTestRoot),
  })

  ensureLoopbackNoProxy()
  useEnvProxy()
  app.commandLine.appendSwitch("proxy-bypass-list", "<-loopback>")
  const features = app.commandLine.getSwitchValue("enable-features")
  app.commandLine.appendSwitch("enable-features", features ? `${jsCallStackFeature},${features}` : jsCallStackFeature)
  if (!app.isPackaged) app.commandLine.appendSwitch("remote-debugging-port", "9222")

  if (!app.requestSingleInstanceLock()) {
    app.quit()
    return
  }

  preferAppEnv(app.getPath("userData"))

  app.on("second-instance", (_event: Event, argv: string[]) => {
    const urls = argv.filter((arg: string) => arg.startsWith("slopcode://"))
    if (urls.length) {
      logger.log("deep link received via second-instance", { urls })
      emitDeepLinks(urls)
    }
    if (mainWindow) {
      const win = getLastFocusedWindow() ?? mainWindow
      win?.show()
      win?.focus()
    }
  })

  app.on("open-url", (event: Event, url: string) => {
    event.preventDefault()
    logger.log("deep link received via open-url", { url })
    emitDeepLinks([url])
  })

  let quitting = false
  app.on("before-quit", (event) => {
    setAppQuitting()
    if (quitting) return
    event.preventDefault()
    quitting = true
    void stopSidecars()
      .catch((error) => logger.error("sidecar cleanup failed before quit", error))
      .finally(() => app.quit())
  })

  app.on("will-quit", () => {
    setAppQuitting()
  })

  app.on("child-process-gone", (_event, details) => {
    writeLog("utility", "child process gone", { details }, "error")
  })

  app.on("render-process-gone", (_event, webContents, details) => {
    writeLog("window", "app render process gone", { url: safeWebContentsURL(webContents), details }, "error")
  })

  setRelaunchHandler(() => {
    relaunch()
  })

  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.on(signal, () => {
      setAppQuitting()
      void stopSidecars()
        .catch((error) => logger.error("sidecar cleanup failed after signal", { signal, error }))
        .finally(() => app.exit(0))
    })
  }

  const serverReady = Deferred.makeUnsafe<ServerReadyData, unknown>()

  yield* Effect.promise(() => app.whenReady())

  initializeOldLayoutEligibility(app.getPath("userData"))
  if (!TEST_ONBOARDING) migrate()
  yield* Effect.promise(() => cleanupStoreFiles(app.getPath("userData"))).pipe(
    Effect.tap((result) =>
      Effect.sync(() => {
        if (result.deleted.length)
          logger.log("cleaned scoped store files", { scanned: result.scanned, count: result.deleted.length })
      }),
    ),
    Effect.catch((error) =>
      Effect.sync(() => {
        logger.warn("failed to clean scoped store files", error)
      }),
    ),
  )
  app.setAsDefaultProtocolClient("slopcode")
  registerRendererProtocol()
  setDockIcon()
  const updater = setupAutoUpdater(stopSidecars)
  registerIpcHandlers({
    killSidecar: () => killSidecar(),
    relaunch,
    awaitInitialization: Effect.fnUntraced(
      function* () {
        logger.log("awaiting server ready")
        const res = yield* Deferred.await(serverReady)
        logger.log("server ready", { url: res.url })
        return res
      },
      (e) => Effect.runPromise(e),
    ),
    consumeInitialDeepLinks: () => pendingDeepLinks.splice(0),
    getDefaultServerUrl: () => getDefaultServerUrl(),
    setDefaultServerUrl: (url) => setDefaultServerUrl(url),
    isFirstLaunchOnboardingPending,
    finishFirstLaunchOnboarding,
    isOldLayoutEligible,
    remote: remoteHost,
    getDisplayBackend: async () => null,
    setDisplayBackend: async () => undefined,
    parseMarkdown: async (markdown) => parseMarkdown(markdown),
    checkAppExists: (appName) => checkAppExists(appName),
    resolveAppPath: async (appName) => resolveAppPath(appName),
    updater,
    showUpdater: () => showUpdaterDialog(updater, true),
    setBackgroundColor: (color) => setBackgroundColor(color),
    exportDebugLogs: () => exportDebugLogs(),
    recordFatalRendererError: (error) => writeLog("renderer", "fatal renderer error", { ...error }, "error"),
  })
  registerWslIpcHandlers(wslServers)
  void updater.start()
  const updateTimer = setInterval(() => void updater.check(), 10 * 60 * 1000)
  updateTimer.unref()
  app.once("will-quit", () => clearInterval(updateTimer))
  yield* Effect.promise(() => startNetLog()).pipe(
    Effect.catch((error) =>
      Effect.sync(() => {
        logger.warn("failed to start net log", error)
      }),
    ),
  )

  const port = yield* Effect.gen(function* () {
    const fromEnv = process.env.SLOPCODE_PORT
    if (fromEnv) {
      const parsed = Number.parseInt(fromEnv, 10)
      if (!Number.isNaN(parsed)) return parsed
    }

    const res = yield* Deferred.make<number, unknown>()
    const server = createServer()
    server.on("error", (e) => Deferred.failSync(res, () => e))
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      if (typeof address !== "object" || !address) {
        server.close()
        Deferred.failSync(res, () => new Error("Failed to get port"))
        return
      }
      const port = address.port
      server.close(() => Effect.runSync(Deferred.succeed(res, port)))
    })

    return yield* Deferred.await(res)
  })
  const hostname = "127.0.0.1"
  const url = `http://${hostname}:${port}`
  const password = randomUUID()
  const remoteHostID = `hst_${createHash("sha256").update(app.getPath("userData")).digest("hex").slice(0, 32)}`
  const remoteSupervisorToken = randomUUID()

  const loadingTask = yield* Effect.gen(function* () {
    logger.log("sidecar connection started", { url, version: SIDECAR_VERSION })

    ensureLoopbackNoProxy()
    useEnvProxy()

    const data = yield* Effect.promise(async () => {
      if (SIDECAR_VERSION === "v2") {
        background = createBackgroundCli({
          source: backgroundCliSource(app.isPackaged, process.resourcesPath),
          userData: app.getPath("userData"),
          hostname,
          port,
          username: "slopcode",
          password,
          cors: rendererCorsOrigins(process.env.ELECTRON_RENDERER_URL),
          remote: { hostID: remoteHostID, token: remoteSupervisorToken },
          env: app.isPackaged ? undefined : { SLOPCODE_DISABLE_CHANNEL_DB: "1" },
          logger: {
            log: (message, meta) => logger.log(message, meta),
            warn: (message, meta) => logger.warn(message, meta),
            error: (message, meta) => logger.error(message, meta),
          },
        })
        return background.start()
      }

      logger.log("spawning embedded sidecar", { url })
      const result = await spawnLocalServer(hostname, port, password, {
        userDataPath: app.getPath("userData"),
        remoteHostID,
        remoteSupervisorToken,
        onStdout: (message) => writeLog("server", "stdout", { message }),
        onStderr: (message) => writeLog("server", "stderr", { message }, "warn"),
        onExit: (code) => writeLog("utility", "sidecar exited", { code }, "warn"),
      })
      server = result.listener
      await waitForEmbeddedHealth(result.health.wait).catch((error) =>
        logger.error("embedded sidecar health check failed", error),
      )
      return {
        url,
        username: "slopcode" as const,
        password,
        remoteHostID,
        remoteSupervisorToken,
      }
    })
    yield* Deferred.succeed(serverReady, data)
    const supervisor = createRemoteSupervisor({
      service: remoteHost,
      serverUrl: data.url,
      username: data.username,
      password: data.password,
      token: data.remoteSupervisorToken,
      hostID: data.remoteHostID,
    })
    stopRemoteSupervisor = supervisor.start()
    void supervisor.reconcile().catch((error) => logger.warn("remote supervisor reconciliation failed", error))

    if (process.platform === "win32") {
      void wslServers.initialize().catch((error) => logger.error("wsl server initialization failed", error))
    }

    logger.log("loading task finished")
  }).pipe(forwardInitializationFailure(serverReady), Effect.forkChild)

  yield* Fiber.await(loadingTask)

  const windows = restoreMainWindows()
  mainWindow = windows[0] ?? null
  if (windows.length) {
    createMenu({
      trigger: (id) => {
        const win = getLastFocusedWindow() ?? mainWindow
        if (win) sendMenuCommand(win, id)
      },
      checkForUpdates: () => {
        void showUpdaterDialog(updater, true)
      },
      relaunch: () => {
        relaunch()
      },
    })
  }
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length !== 0) return
    mainWindow = restoreMainWindows()[0] ?? null
  })
})

Effect.runFork(main)
