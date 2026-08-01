import type { AndroidCapabilities } from "./types"

export type AndroidNativeBridge = {
  capabilities?(): string
  storageGet?(namespace: string, key: string): string | null
  storageSet?(namespace: string, key: string, value: string): void
  storageRemove?(namespace: string, key: string): void
  storageClear?(namespace: string): void
  storageKeys?(namespace: string): string
  storageLength?(namespace: string): number
  scanQrPairing?(): string | null
  notificationPermission?(): string
  requestNotificationPermission?(): string
  showNotification?(title: string, description?: string, href?: string): void
  consumeDeepLinks?(): string
  remoteSend?(payload: string): string
  openLink?(url: string): void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseJson<T>(value: string | null | undefined, fallback: T) {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const enabled = (value: unknown) => value === true

export function getAndroidBridge(target: Pick<Window, "SlopcodeAndroid"> = window) {
  return target.SlopcodeAndroid
}

export function detectAndroidCapabilities(bridge = getAndroidBridge()): AndroidCapabilities {
  const fallback: AndroidCapabilities = {
    secureStorage: !!bridge?.storageGet && !!bridge.storageSet && !!bridge.storageRemove,
    qrPairing: !!bridge?.scanQrPairing,
    notifications: !!bridge?.notificationPermission && !!bridge.showNotification,
    deepLinks: !!bridge?.consumeDeepLinks,
    remoteTransport: !!bridge?.remoteSend,
  }
  const raw = typeof bridge?.capabilities === "function" ? parseJson<unknown>(bridge.capabilities(), null) : null
  if (!isRecord(raw)) return fallback
  return {
    secureStorage: enabled(raw.secureStorage) || fallback.secureStorage,
    qrPairing: enabled(raw.qrPairing),
    notifications: enabled(raw.notifications) || fallback.notifications,
    deepLinks: enabled(raw.deepLinks) || fallback.deepLinks,
    remoteTransport: enabled(raw.remoteTransport),
  }
}

export function parseStringArray(value: string | null | undefined) {
  const parsed = parseJson<unknown>(value, [])
  if (!Array.isArray(parsed)) return []
  return parsed.filter((item): item is string => typeof item === "string")
}

export function parsePermission(value: string | null | undefined) {
  if (value === "granted" || value === "denied") return value
  return "prompt" as const
}
