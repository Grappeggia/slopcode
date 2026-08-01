import { canOpenExternalUrl, detectAndroidCapabilities, getAndroidBridge, parsePermission, parseStringArray } from "./bridge"
import {
  readRemoteWorkspaceSecret,
  readRemoteWorkspaceState,
  writeRemoteWorkspaceSecret,
  writeRemoteWorkspaceState,
  type RemoteWorkspaceState,
  type RemoteWorkspaceSecret,
} from "./remote-workspace-state"
import type { AndroidSecureStorage } from "./types"

type AsyncStorage = {
  getItem(key: string): Promise<string | null>
  setItem(key: string, value: string): Promise<void>
  removeItem(key: string): Promise<void>
}

const APP_STORAGE = "slopcode.android.app.dat"
const deepLinkEvent = "slopcode:deep-link"

function secureStorage(bridge = getAndroidBridge()): AndroidSecureStorage | undefined {
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

export function appStorage(bridge = getAndroidBridge()) {
  if (!bridge) return
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

export async function readInitialWorkspaceState() {
  const secure = secureStorage()
  if (!secure) return { state: { version: 1 } as RemoteWorkspaceState }
  return {
    state: await readRemoteWorkspaceState(secure),
    secret: await readRemoteWorkspaceSecret(secure),
  }
}

export async function persistServerUrl(url?: string) {
  const secure = secureStorage()
  if (!secure) return
  const state = await readRemoteWorkspaceState(secure)
  await writeRemoteWorkspaceState(secure, {
    ...state,
    serverUrl: url,
    savedAt: new Date().toISOString(),
  })
}

export async function persistServerSecret(secret?: RemoteWorkspaceSecret) {
  const secure = secureStorage()
  if (!secure) return
  await writeRemoteWorkspaceSecret(secure, secret)
}

export async function persistRemoteWorkspace(state: RemoteWorkspaceState, secret?: RemoteWorkspaceSecret) {
  const secure = secureStorage()
  if (!secure) throw new Error("Android secure storage is unavailable")
  await writeRemoteWorkspaceState(secure, state)
  await writeRemoteWorkspaceSecret(secure, secret)
}

export type AndroidWorkspaceBootstrap = Awaited<ReturnType<typeof readInitialWorkspaceState>>

export async function shellBridge() {
  const bridge = getAndroidBridge()
  const capabilities = await detectAndroidCapabilities(bridge)

  return {
    capabilities,
    secureStorage: secureStorage(bridge),
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
      if (parsePermission(await bridge?.notificationPermission().catch(() => "prompt")) !== "granted") return
      await bridge?.showNotification(title, description, href)
    },
    scanQrPairing: async () => {
      const value = await bridge?.scanQrPairing().catch(() => null)
      return typeof value === "string" && value ? value : null
    },
    remoteSend: bridge?.remoteSend ? async (payload: string) => String(await bridge.remoteSend(payload)) : undefined,
  }
}
