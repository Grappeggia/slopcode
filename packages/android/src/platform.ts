import {
  canOpenExternalUrl,
  detectAndroidCapabilities,
  getAndroidBridge,
  parseDeepLinkMessage,
  parsePermission,
  parseSupportedDeepLinks,
  parseStringArray,
  remoteJobsBridge,
  sshTransportBridge,
  trustedAndroidMessage,
  type AndroidNativeBridge,
} from "./bridge"
import {
  clearRemoteWorkspace,
  readRemoteWorkspaceSecret,
  readRemoteWorkspaceState,
  readRemoteWorkspace,
  writeRemoteWorkspaceRecord,
  writeRemoteWorkspaceSecret,
  writeRemoteWorkspaceState,
  type RemoteServerSelection,
  type RemoteWorkspaceState,
  type RemoteWorkspaceSecret,
} from "./remote-workspace-state"
import type { AndroidSecureStorage } from "./types"
import { notificationDecision } from "./notification-permission"
import { readSshWorkspace, writeSshWorkspace, type SshWorkspaceState } from "./ssh-workspace-state"

type AsyncStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const APP_STORAGE = "slopcode.android.app.dat"
type Bridge = AndroidNativeBridge | null | undefined

function secureStorage(bridge: Bridge = getAndroidBridge()): AndroidSecureStorage | undefined {
  if (!bridge) return
  return {
    getItem: async (namespace, key) => {
      const value = await bridge.storageGet(namespace, key)
      return typeof value === "string" ? value : null
    },
    setItem: async (namespace, key, value) => {
      await bridge.storageSet(namespace, key, value)
    },
    removeItem: async (namespace, key) => {
      await bridge.storageRemove(namespace, key)
    },
    clear: async (namespace) => {
      await bridge.storageClear(namespace)
    },
    keys: async (namespace) => parseStringArray(await bridge.storageKeys(namespace).catch(() => [])),
    length: async (namespace) => {
      const value = await bridge.storageLength(namespace).catch(() => 0)
      return typeof value === "number" ? value : 0
    },
  }
}

function volatileStorage() {
  const values = new Map<string, string>()
  const key = (namespace: string, name: string) => `${namespace}:${name}`
  return (name?: string): AsyncStorage => {
    const namespace = name ?? APP_STORAGE
    return {
      getItem: async (item) => values.get(key(namespace, item)) ?? null,
      setItem: async (item, value) => {
        values.set(key(namespace, item), value)
      },
      removeItem: async (item) => {
        values.delete(key(namespace, item))
      },
    }
  }
}

export function appStorage(bridge: Bridge = getAndroidBridge()) {
  if (!bridge) return volatileStorage()
  return (name?: string): AsyncStorage => ({
    getItem: async (key: string) => {
      const value = await bridge.storageGet(name ?? APP_STORAGE, key).catch(() => null)
      return typeof value === "string" ? value : null
    },
    setItem: async (key: string, value: string) => {
      await bridge.storageSet(name ?? APP_STORAGE, key, value)
    },
    removeItem: async (key: string) => {
      await bridge.storageRemove(name ?? APP_STORAGE, key)
    },
  })
}

export async function readInitialWorkspaceState(
  bridge: Bridge = getAndroidBridge(),
): Promise<{ state: RemoteWorkspaceState; secret?: RemoteWorkspaceSecret }> {
  const secure = secureStorage(bridge)
  if (!secure) return { state: { version: 1 }, secret: undefined }
  return readRemoteWorkspace(secure)
}

export async function persistServerSelection(selection?: RemoteServerSelection, bridge: Bridge = getAndroidBridge()) {
  const secure = secureStorage(bridge)
  if (!secure) return
  if (!selection) {
    await clearRemoteWorkspace(secure)
    return
  }
  const state = await readRemoteWorkspaceState(secure)
  await writeRemoteWorkspaceState(secure, {
    ...state,
    serverUrl: selection.url,
    serverSelection: selection,
    savedAt: new Date().toISOString(),
  })
}

export async function persistServerSecret(secret?: RemoteWorkspaceSecret, bridge: Bridge = getAndroidBridge()) {
  const secure = secureStorage(bridge)
  if (!secure) return
  await writeRemoteWorkspaceSecret(secure, secret)
}

export async function persistRemoteWorkspace(
  state: RemoteWorkspaceState,
  secret?: RemoteWorkspaceSecret,
  bridge: Bridge = getAndroidBridge(),
) {
  const secure = secureStorage(bridge)
  if (!secure) throw new Error("Android secure storage is unavailable")
  await writeRemoteWorkspaceRecord(secure, state, secret)
}

export type AndroidWorkspaceBootstrap = Awaited<ReturnType<typeof readInitialWorkspaceState>>

export async function readInitialSshWorkspace(bridge: Bridge = getAndroidBridge()) {
  const secure = secureStorage(bridge)
  if (!secure) return
  return readSshWorkspace(secure)
}

export async function persistSshWorkspace(state: SshWorkspaceState, bridge: Bridge = getAndroidBridge()) {
  const secure = secureStorage(bridge)
  if (!secure) throw new Error("Android secure storage is unavailable")
  await writeSshWorkspace(secure, state)
}

export async function shellBridge(bridge: Bridge = getAndroidBridge()) {
  const native = bridge ?? undefined
  const capabilities = await detectAndroidCapabilities(native)
  const remoteJobs = remoteJobsBridge(native, capabilities.backgroundExecution && capabilities.remoteJobs)
  const ssh = sshTransportBridge(native)
  const nonce = native && capabilities.deepLinks ? crypto.randomUUID().replaceAll("-", "") : undefined
  let ready: Promise<boolean> | undefined
  const prepareDeepLinks = () => {
    if (!bridge || !nonce) return Promise.resolve(false)
    ready ??= bridge.deepLinksReady(nonce).then((value) => value === true)
    return ready
  }

  return {
    capabilities,
    secureStorage: secureStorage(native),
    notificationPermission: async () => parsePermission(await bridge?.notificationPermission().catch(() => "prompt")),
    requestNotificationPermission: async () =>
      parsePermission(await bridge?.requestNotificationPermission().catch(() => "prompt")),
    deepLinks: async () => {
      if (!bridge || !nonce || !(await prepareDeepLinks().catch(() => false))) return []
      return parseSupportedDeepLinks(await bridge.consumeDeepLinks(nonce).catch(() => []))
    },
    subscribeDeepLinks(listener: (hrefs: string[]) => void) {
      if (!bridge || !nonce) return () => undefined
      const handler = (event: Event) => {
        const message = event as MessageEvent
        if (!trustedAndroidMessage(message)) return
        const urls = parseDeepLinkMessage(message.data, nonce)
        if (urls.length === 0) return
        listener(urls)
        void bridge.consumeDeepLinks(nonce).catch(() => undefined)
      }
      window.addEventListener("message", handler)
      void prepareDeepLinks()
        .then(async (ok) => {
          if (!ok) return
          const urls = parseSupportedDeepLinks(await bridge.consumeDeepLinks(nonce).catch(() => []))
          if (urls.length > 0) listener(urls)
        })
        .catch(() => undefined)
      return () => window.removeEventListener("message", handler)
    },
    openLink(url: string) {
      if (!canOpenExternalUrl(url)) return
      void bridge?.openLink(url)
    },
    notify: async (title: string, description?: string, href?: string) => {
      if (!native || !capabilities.notifications) return
      const current = parsePermission(await native.notificationPermission().catch(() => "prompt"))
      const initial = notificationDecision(current)
      if (initial.request) {
        const result = parsePermission(await native.requestNotificationPermission().catch(() => "prompt"))
        if (!notificationDecision(current, result).show) return
      }
      if (!initial.show && !initial.request) return
      await native.showNotification(title, description, href)
    },
    scanQrPairing: async () => {
      const value = await bridge?.scanQrPairing().catch(() => null)
      return typeof value === "string" && value ? value : null
    },
    remoteJobs,
    ssh,
  }
}
