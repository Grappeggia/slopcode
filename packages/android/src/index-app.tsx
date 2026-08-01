import { HashRouter } from "@solidjs/router"
import { render } from "solid-js/web"
import {
  AppBaseProviders,
  AppInterface,
  type Platform,
  PlatformProvider,
  ServerConnection,
} from "@slopcode-ai/app"
import "@slopcode-ai/app/index.css"
import pkg from "../package.json"
import { appStorage, persistServerSelection, readInitialWorkspaceState, shellBridge } from "./platform"
import { RemoteConnect } from "./remote-connect"

export async function mountAndroidApp() {
  const root = document.getElementById("root")
  if (!(root instanceof HTMLElement)) throw new Error("Android root not found")

  const [shell, initial] = await Promise.all([shellBridge(), readInitialWorkspaceState()])
  if (!initial.state.serverUrl) {
    render(() => <RemoteConnect onConnected={() => window.location.reload()} />, root)
    return
  }
  const selection =
    initial.state.serverSelection ??
    ({
      url: initial.state.serverUrl,
      workspaceID: initial.state.workspace?.workspace?.id,
      directory: initial.state.workspace?.workspace?.remoteDirectory ?? initial.state.workspace?.workspace?.directory,
    } as const)
  const server = {
    type: "http",
    authToken: !!initial.secret?.password,
    http: {
      url: selection.url,
      username: initial.secret?.username,
      password: initial.secret?.password,
      workspaceID: selection.workspaceID,
      directory: selection.directory,
    },
    displayName: initial.state.workspace?.workspace?.name ?? initial.state.workspace?.host?.name,
    label: initial.state.workspace?.workspace?.mode,
  } satisfies ServerConnection.Http
  const serverKey = ServerConnection.key(server)
  const platform: Platform = {
    platform: "android",
    version: pkg.version,
    openLink: shell.openLink,
    back: () => window.history.back(),
    forward: () => window.history.forward(),
    restart: async () => window.location.reload(),
    notify: shell.notify,
    storage: appStorage(),
    getDefaultServer: async () => serverKey,
    setDefaultServer: async (key: ServerConnection.Key | null) => {
      if (key === null) {
        await persistServerSelection()
        return
      }
      if (key === serverKey) await persistServerSelection(selection)
    },
    android: {
      capabilities: shell.capabilities,
      secureStorage: shell.secureStorage,
      qrPairing: shell.capabilities.qrPairing ? { scan: shell.scanQrPairing } : undefined,
      notifications: shell.capabilities.notifications
        ? {
            permission: shell.notificationPermission,
            requestPermission: shell.requestNotificationPermission,
          }
        : undefined,
      deepLinks: shell.capabilities.deepLinks
        ? {
            consume: shell.deepLinks,
            subscribe: shell.subscribeDeepLinks,
          }
        : undefined,
    },
  }

  render(
    () => (
      <PlatformProvider value={platform}>
        <AppBaseProviders>
          <AppInterface
            defaultServer={serverKey}
            servers={[server]}
            router={HashRouter}
          />
        </AppBaseProviders>
      </PlatformProvider>
    ),
    root,
  )
}
