import type { AndroidCapabilities } from "./types"

export type NotificationPermission = "granted" | "denied" | "prompt"

export const ANDROID_TRUSTED_ORIGIN = "https://appassets.androidplatform.net"
export const ANDROID_DEEP_LINK_CHANNEL = "slopcode.android.deep-links"

type AndroidBridgePort = {
  postMessage(message: string): void
  onmessage: ((event: { data?: string }) => void) | null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

type BridgeRequest = {
  id: string
  method: string
  args?: unknown[]
}

type BridgeResponse =
  | {
      id: string
      ok: true
      result?: unknown
    }
  | {
      id: string
      ok: false
      code?: string
      message?: string
    }

export type AndroidNativeBridge = {
  capabilities(): Promise<unknown>
  storageGet(namespace: string, key: string): Promise<unknown>
  storageSet(namespace: string, key: string, value: string): Promise<unknown>
  storageRemove(namespace: string, key: string): Promise<unknown>
  storageClear(namespace: string): Promise<unknown>
  storageKeys(namespace: string): Promise<unknown>
  storageLength(namespace: string): Promise<unknown>
  scanQrPairing(): Promise<unknown>
  notificationPermission(): Promise<unknown>
  requestNotificationPermission(): Promise<unknown>
  showNotification(title: string, description?: string, href?: string): Promise<unknown>
  deepLinksReady(nonce: string): Promise<unknown>
  consumeDeepLinks(nonce: string): Promise<unknown>
  openLink(url: string): Promise<unknown>
}

const ports = new WeakMap<AndroidBridgePort, AndroidNativeBridge>()

function parseJson<T>(value: unknown, fallback: T) {
  if (typeof value !== "string" || !value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const enabled = (value: unknown) => value === true

export function getAndroidBridge(target: Pick<Window, "SlopcodeAndroid"> = typeof window === "object" ? window : { SlopcodeAndroid: undefined }) {
  const port = target.SlopcodeAndroid
  if (!port) return
  const existing = ports.get(port)
  if (existing) return existing

  let seq = 0
  const pending = new Map<
    string,
    {
      resolve: (value: unknown) => void
      reject: (error: Error) => void
    }
  >()
  const prev = port.onmessage

  port.onmessage = (event) => {
    prev?.(event)
    const response = parseJson<BridgeResponse | null>(event.data, null)
    if (!response || !response.id) return
    const item = pending.get(response.id)
    if (!item) return
    pending.delete(response.id)
    if (response.ok) {
      item.resolve(response.result)
      return
    }
    item.reject(new Error(response.message ?? response.code ?? "Android bridge request failed"))
  }

  const call = (method: string, ...args: unknown[]) => {
    const id = `android-${++seq}`
    const request: BridgeRequest = { id, method, args }
    return new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject })
      port.postMessage(JSON.stringify(request))
    })
  }

  const bridge = {
    capabilities: () => call("capabilities"),
    storageGet: (namespace, key) => call("storageGet", namespace, key),
    storageSet: (namespace, key, value) => call("storageSet", namespace, key, value),
    storageRemove: (namespace, key) => call("storageRemove", namespace, key),
    storageClear: (namespace) => call("storageClear", namespace),
    storageKeys: (namespace) => call("storageKeys", namespace),
    storageLength: (namespace) => call("storageLength", namespace),
    scanQrPairing: () => call("scanQrPairing"),
    notificationPermission: () => call("notificationPermission"),
    requestNotificationPermission: () => call("requestNotificationPermission"),
    showNotification: (title, description, href) => call("showNotification", title, description, href),
    deepLinksReady: (nonce) => call("deepLinksReady", nonce),
    consumeDeepLinks: (nonce) => call("consumeDeepLinks", nonce),
    openLink: (url) => call("openLink", url),
  } satisfies AndroidNativeBridge

  ports.set(port, bridge)
  return bridge
}

export async function detectAndroidCapabilities(bridge = getAndroidBridge()): Promise<AndroidCapabilities> {
  const fallback: AndroidCapabilities = {
    secureStorage: false,
    qrPairing: false,
    notifications: false,
    deepLinks: false,
    remoteTransport: false,
  }
  const raw = bridge ? await bridge.capabilities().catch(() => null) : null
  if (!isRecord(raw)) return fallback
  return {
    secureStorage: enabled(raw.secureStorage),
    qrPairing: enabled(raw.qrPairing),
    notifications: enabled(raw.notifications),
    deepLinks: enabled(raw.deepLinks),
    remoteTransport: false,
  }
}

const MAX_STRING_ARRAY_ITEMS = 64
const MAX_STRING_ARRAY_ITEM_LENGTH = 16 * 1024

export function parseStringArray(value: unknown) {
  const parsed = typeof value === "string" ? parseJson<unknown>(value, []) : value
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((item): item is string => typeof item === "string" && item.length <= MAX_STRING_ARRAY_ITEM_LENGTH)
    .slice(0, MAX_STRING_ARRAY_ITEMS)
}

function supportedDeepLink(value: unknown) {
  if (typeof value !== "string" || value.length === 0 || value.length > 8 * 1024) return false
  try {
    const url = new URL(value)
    if (url.protocol !== "slopcode:" || url.username || url.password || url.hash) return false
    if (url.hostname !== "open-project" && url.hostname !== "new-session") return false
    if (url.port || (url.pathname !== "" && url.pathname !== "/")) return false
    const directory = url.searchParams.getAll("directory")
    if (directory.length !== 1 || !directory[0] || directory[0].length > 4 * 1024) return false
    if (!directory[0].startsWith("/") || /[\u0000\r\n]/.test(directory[0])) return false
    const allowed = url.hostname === "new-session" ? new Set(["directory", "prompt"]) : new Set(["directory"])
    for (const key of url.searchParams.keys()) if (!allowed.has(key)) return false
    if (url.hostname === "new-session") {
      const prompt = url.searchParams.getAll("prompt")
      if (prompt.length > 1 || (prompt[0] && prompt[0].length > 16 * 1024)) return false
    }
    return true
  } catch {
    return false
  }
}

export function parseSupportedDeepLinks(value: unknown) {
  return parseStringArray(value).filter(supportedDeepLink)
}

export function parseDeepLinkMessage(value: unknown, nonce: string) {
  const parsed = typeof value === "string" ? parseJson<unknown>(value, null) : value
  if (
    !isRecord(parsed) ||
    parsed.type !== "slopcode.deep-links" ||
    parsed.channel !== ANDROID_DEEP_LINK_CHANNEL ||
    parsed.nonce !== nonce ||
    parsed.ready !== true
  ) return []
  return parseSupportedDeepLinks(parsed.urls)
}

export function parsePermission(value: unknown) {
  if (value === "granted" || value === "denied") return value
  return "prompt" as const
}

export function canOpenExternalUrl(value: unknown) {
  if (typeof value !== "string") return false
  let url: URL
  try {
    url = new URL(value)
  } catch {
    return false
  }
  if (url.protocol === "https:" || url.protocol === "mailto:" || url.protocol === "tel:") return true
  return false
}
