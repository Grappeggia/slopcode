import {
  canOpenExternalUrl,
  detectAndroidCapabilities,
  getAndroidBridge,
  parsePermission,
  parseStringArray,
  type AndroidNativeBridge,
} from "./bridge"
import {
  readRemoteWorkspaceSecret,
  readRemoteWorkspaceState,
  writeRemoteWorkspaceSecret,
  writeRemoteWorkspaceState,
  type RemoteWorkspaceState,
  type RemoteWorkspaceSecret,
} from "./remote-workspace-state"
import type { AndroidSecureStorage } from "./types"
import { notificationDecision } from "./notification-permission"

type AsyncStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const APP_STORAGE = "slopcode.android.app.dat"
const deepLinkEvent = "slopcode:deep-link"
type Bridge = AndroidNativeBridge | null | undefined

function secureStorage(bridge: Bridge = getAndroidBridge()): AndroidSecureStorage | undefined {
  if (!bridge) return
  return {
    getItem: async (namespace, key) => {
      const value = await bridge.storageGet(namespace, key).catch(() => null)
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

export async function readInitialWorkspaceState(bridge: Bridge = getAndroidBridge()) {
  const secure = secureStorage(bridge)
  if (!secure) return { state: { version: 1 } as RemoteWorkspaceState }
  return {
    state: await readRemoteWorkspaceState(secure),
    secret: await readRemoteWorkspaceSecret(secure),
  }
}

export async function persistServerUrl(url?: string, bridge: Bridge = getAndroidBridge()) {
  const secure = secureStorage(bridge)
  if (!secure) return
  const state = await readRemoteWorkspaceState(secure)
  await writeRemoteWorkspaceState(secure, {
    ...state,
    serverUrl: url,
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
  await writeRemoteWorkspaceState(secure, state)
  await writeRemoteWorkspaceSecret(secure, secret)
}

export type AndroidWorkspaceBootstrap = Awaited<ReturnType<typeof readInitialWorkspaceState>>

export async function shellBridge(bridge: Bridge = getAndroidBridge()) {
  const native = bridge ?? undefined
  const capabilities = await detectAndroidCapabilities(native)

  return {
    capabilities,
    secureStorage: secureStorage(native),
    notificationPermission: async () => parsePermission(await bridge?.notificationPermission().catch(() => "prompt")),
    requestNotificationPermission: async () =>
      parsePermission(await bridge?.requestNotificationPermission().catch(() => "prompt")),
    deepLinks: async () => parseStringArray(await bridge?.consumeDeepLinks().catch(() => [])),
    subscribeDeepLinks(listener: (hrefs: string[]) => void) {
      const handler = (event: Event) => {
        const detail = (event as CustomEvent<{ urls?: string[] }>).detail
        const urls = detail?.urls?.filter((item): item is string => typeof item === "string") ?? []
        if (urls.length > 0) listener(urls)
      }
      window.addEventListener(deepLinkEvent, handler as EventListener)
      return () => window.removeEventListener(deepLinkEvent, handler as EventListener)
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
    remoteSend: capabilities.remoteTransport && native
      ? async (payload: string) => String(await native.remoteSend(payload))
      : undefined,
  }
}
