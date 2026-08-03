import { HashRouter } from "@solidjs/router"
import { createSignal, Show } from "solid-js"
import { render } from "solid-js/web"
import { AppBaseProviders, AppInterface, type Platform, PlatformProvider, ServerConnection } from "@slopcode-ai/app"
import "@slopcode-ai/app/index.css"
import pkg from "../package.json"
import {
  appStorage,
  persistRemoteWorkspace,
  persistServerSelection,
  readInitialSshWorkspace,
  readInitialWorkspaceState,
  shellBridge,
} from "./platform"
import { RemoteAgentSession } from "./codex-cli"
import type { RemoteCommandCatalog } from "./remote-workspace-state"
import { RemoteConnect } from "./remote-connect"
import { remoteCapabilityEnabled } from "./remote-workspace-state"
import { parseRemoteSessionDeepLink, type RemoteSessionDeepLink } from "./remote-jobs"
import { SshConnect } from "./ssh-connect"
import { SshAgenticSession } from "./ssh-agentic-session"
import type { SshWorkspaceState } from "./ssh-workspace-state"

function emitDeepLinks(urls: string[]) {
  if (urls.length === 0) return
  window.__SLOPCODE__ ??= {}
  const pending = window.__SLOPCODE__.deepLinks ?? []
  window.__SLOPCODE__.deepLinks = [...pending, ...urls]
  window.dispatchEvent(new CustomEvent("slopcode:deep-link", { detail: { urls } }))
}

export async function mountAndroidApp() {
  const root = document.getElementById("root")
  if (!(root instanceof HTMLElement)) throw new Error("Android root not found")

  const [remoteSession, setRemoteSession] = createSignal<RemoteSessionDeepLink>()
  const [shell, initial, sshWorkspace] = await Promise.all([
    shellBridge(),
    readInitialWorkspaceState(),
    readInitialSshWorkspace(),
  ])
  if (shell.capabilities.deepLinks)
    shell.subscribeDeepLinks((urls) => {
      const session = urls
        .map(parseRemoteSessionDeepLink)
        .find((item): item is RemoteSessionDeepLink => item !== undefined)
      if (session) setRemoteSession(session)
      emitDeepLinks(urls)
    })
  if (shell.ssh) {
    const status = await shell.ssh
      .status()
      .catch(() => ({ connected: false, remoteTransport: false, profile: undefined }))
    if (!sshWorkspace || !status.connected || status.profile !== sshWorkspace.profile) {
      render(() => {
        const [workspace, setWorkspace] = createSignal<SshWorkspaceState>()
        return (
          <Show
            when={workspace()}
            fallback={<SshConnect ssh={shell.ssh!} initial={sshWorkspace} onConnected={setWorkspace} />}
          >
            {(value) => (
              <SshAgenticSession ssh={shell.ssh!} workspace={value()} onDisconnected={() => window.location.reload()} />
            )}
          </Show>
        )
      }, root)
      return
    }
    render(
      () => (
        <SshAgenticSession ssh={shell.ssh!} workspace={sshWorkspace} onDisconnected={() => window.location.reload()} />
      ),
      root,
    )
    return
  }
  const workspace = initial.state.workspace?.workspace
  if (
    !initial.state.serverUrl ||
    workspace?.mode !== "ssh" ||
    !remoteCapabilityEnabled(initial.state.workspace, "sshWorkspace")
  ) {
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
  const selectedAgent = workspace?.agent
  if (selectedAgent === "codex-cli" || selectedAgent === "opencode-cli" || selectedAgent === "claude-code") {
    render(
      () => (
        <RemoteAgentSession
          agent={selectedAgent}
          serverUrl={selection.url}
          username={initial.secret?.username}
          password={initial.secret?.password ?? ""}
          workspaceID={selection.workspaceID ?? ""}
          directory={selection.directory ?? ""}
          jobID={remoteSession()?.jobID}
          sessionID={remoteSession()?.sessionID}
          background={shell.remoteJobs}
          catalog={initial.state.commandCatalog}
          onCatalog={(catalog: RemoteCommandCatalog) =>
            void persistRemoteWorkspace(
              { ...initial.state, commandCatalog: catalog, savedAt: new Date().toISOString() },
              initial.secret,
            ).catch(() => undefined)
          }
        />
      ),
      root,
    )
    return
  }
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
          <AppInterface defaultServer={serverKey} servers={[server]} router={HashRouter} />
        </AppBaseProviders>
      </PlatformProvider>
    ),
    root,
  )
}
