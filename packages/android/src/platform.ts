import type { AndroidSecureStorage } from "./types"
import { detectAndroidCapabilities, getAndroidBridge, parsePermission, parseStringArray } from "./bridge"
import { readRemoteWorkspaceState, writeRemoteWorkspaceState } from "./remote-workspace-state"

function secureStorage(bridge = getAndroidBridge()): AndroidSecureStorage | undefined {
  if (!bridge?.storageGet || !bridge.storageSet || !bridge.storageRemove || !bridge.storageClear || !bridge.storageKeys)
    return

  return {
    getItem: async (namespace, key) => bridge.storageGet?.(namespace, key) ?? null,
    setItem: async (namespace, key, value) => {
      bridge.storageSet?.(namespace, key, value)
    },
    removeItem: async (namespace, key) => {
      bridge.storageRemove?.(namespace, key)
    },
    clear: async (namespace) => {
      bridge.storageClear?.(namespace)
    },
    keys: async (namespace) => parseStringArray(bridge.storageKeys?.(namespace)),
    length: async (namespace) => bridge.storageLength?.(namespace) ?? 0,
  }
}

export async function readInitialWorkspaceState() {
  const secure = secureStorage()
  if (!secure) return { version: 1 } as { version: 1; serverUrl?: string; pairing?: { version: "v1" } & Record<string, unknown>; savedAt?: string }
  return readRemoteWorkspaceState(secure)
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

export function shellBridge() {
  const bridge = getAndroidBridge()
  const capabilities = detectAndroidCapabilities(bridge)

  return {
    capabilities,
    secureStorage: secureStorage(bridge),
    notificationPermission: () => parsePermission(bridge?.notificationPermission?.()),
    deepLinks: () => parseStringArray(bridge?.consumeDeepLinks?.()),
    openLink(url: string) {
      if (bridge?.openLink) {
        bridge.openLink(url)
        return
      }
      window.open(url, "_blank")
    },
    notify: async (title: string, description?: string, href?: string) => {
      const permission = parsePermission(bridge?.notificationPermission?.())
      if (permission !== "granted") return
      bridge?.showNotification?.(title, description, href)
    },
    remoteSend: bridge?.remoteSend ? async (payload: string) => bridge.remoteSend?.(payload) ?? payload : undefined,
  }
}
