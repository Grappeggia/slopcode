import type { AndroidCapabilities } from "./types"
import {
  parseRemoteJobAction,
  parseRemoteJobList,
  parseRemoteJobMessage,
  parseRemoteSessionDeepLink,
  type AndroidRemoteJobs,
  type RemoteJobAction,
  type RemoteJobActionPayload,
  type RemoteJobStartInput,
} from "./remote-jobs"
import {
  parseSshConnectResult,
  parseSshCredential,
  parseSshEventMessage,
  parseSshHome,
  parseSshListing,
  parseSshAuthStatus,
  parseSshPreflight,
  parseSshOrchestratorEventMessage,
  parseSshOrchestratorStart,
  parseSshStart,
  parseSshStatus,
  type SshAgent,
  type SshConnectionInput,
  type SshCredential,
  type SshEvent,
  type SshOrchestratorEvent,
  type SshTransport,
} from "./ssh"

export type NotificationPermission = "granted" | "denied" | "prompt"

export const ANDROID_TRUSTED_ORIGIN = "https://appassets.androidplatform.net"
export const ANDROID_DEEP_LINK_CHANNEL = "slopcode.android.deep-links"
export const ANDROID_REMOTE_JOB_CHANNEL = "slopcode.android.remote-jobs"
export const ANDROID_SSH_CHANNEL = "slopcode.android.ssh"

export function trustedAndroidMessage(message: MessageEvent) {
  return (
    (message.origin === ANDROID_TRUSTED_ORIGIN && message.source === window) ||
    (message.origin === "" && message.source === null)
  )
}

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
  remoteJobsReady(nonce: string): Promise<unknown>
  remoteJobList(): Promise<unknown>
  remoteJobStart(input: string): Promise<unknown>
  remoteJobAction(jobID: string, action: RemoteJobAction, payload?: string): Promise<unknown>
  sshEventsReady?(nonce: string): Promise<unknown>
  sshConnect?(input: string): Promise<unknown>
  sshTrustHostKey?(input: string): Promise<unknown>
  sshStatus?(): Promise<unknown>
  sshDisconnect?(): Promise<unknown>
  sshCleanup?(): Promise<unknown>
  sshHome?(): Promise<unknown>
  sshList?(path: string, showHidden?: boolean): Promise<unknown>
  sshExec?(input: string): Promise<unknown>
  sshAuthStatus?(input: string): Promise<unknown>
  sshStart?(input: string): Promise<unknown>
  sshOrchestratorStart?(input: string): Promise<unknown>
  sshOrchestratorInput?(value: string): Promise<unknown>
  sshOrchestratorStop?(): Promise<unknown>
  sshInput?(value: string): Promise<unknown>
  sshResize?(cols: number, rows: number, width: number, height: number): Promise<unknown>
  sshInterrupt?(): Promise<unknown>
  sshCredentialGet?(profile: string): Promise<unknown>
  sshCredentialSet?(profile: string, value: string): Promise<unknown>
  sshCredentialClear?(profile: string): Promise<unknown>
  sshPickPrivateKey?(): Promise<unknown>
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

export function getAndroidBridge(
  target: Pick<Window, "SlopcodeAndroid"> = typeof window === "object" ? window : { SlopcodeAndroid: undefined },
) {
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
    remoteJobsReady: (nonce) => call("remoteJobsReady", nonce),
    remoteJobList: () => call("remoteJobList"),
    remoteJobStart: (input) => call("remoteJobStart", input),
    remoteJobAction: (jobID, action, payload) => call("remoteJobAction", jobID, action, payload),
    sshEventsReady: (nonce) => call("sshEventsReady", nonce),
    sshConnect: (input) => call("sshConnect", input),
    sshTrustHostKey: (input) => call("sshTrustHostKey", input),
    sshStatus: () => call("sshStatus"),
    sshDisconnect: () => call("sshDisconnect"),
    sshCleanup: () => call("sshCleanup"),
    sshHome: () => call("sshHome"),
    sshList: (path, showHidden = false) => call("sshList", path, showHidden),
    sshExec: (input) => call("sshExec", input),
    sshAuthStatus: (input) => call("sshAuthStatus", input),
    sshStart: (input) => call("sshStart", input),
    sshOrchestratorStart: (input) => call("sshOrchestratorStart", input),
    sshOrchestratorInput: (value) => call("sshOrchestratorInput", value),
    sshOrchestratorStop: () => call("sshOrchestratorStop"),
    sshInput: (value) => call("sshInput", value),
    sshResize: (cols, rows, width, height) => call("sshResize", cols, rows, width, height),
    sshInterrupt: () => call("sshInterrupt"),
    sshCredentialGet: (profile) => call("sshCredentialGet", profile),
    sshCredentialSet: (profile, value) => call("sshCredentialSet", profile, value),
    sshCredentialClear: (profile) => call("sshCredentialClear", profile),
    sshPickPrivateKey: () => call("sshPickPrivateKey"),
  } satisfies AndroidNativeBridge

  ports.set(port, bridge)
  return bridge
}

export function sshTransportBridge(bridge: AndroidNativeBridge | undefined): SshTransport | undefined {
  if (
    !bridge?.sshConnect ||
    !bridge.sshTrustHostKey ||
    !bridge.sshStatus ||
    !bridge.sshDisconnect ||
    !bridge.sshCleanup ||
    !bridge.sshHome ||
    !bridge.sshList ||
    !bridge.sshExec ||
    !bridge.sshAuthStatus ||
    !bridge.sshStart ||
    !bridge.sshInput ||
    !bridge.sshResize ||
    !bridge.sshInterrupt ||
    !bridge.sshCredentialGet ||
    !bridge.sshCredentialSet ||
    !bridge.sshCredentialClear ||
    !bridge.sshEventsReady
  )
    return

  let nonce = ""
  let ready: Promise<boolean> | undefined
  const prepare = () => {
    if (!nonce) return Promise.resolve(false)
    ready ??= bridge.sshEventsReady!(nonce).then((value) => value === true)
    return ready
  }
  const result = async <T>(value: Promise<unknown>, parse: (raw: unknown) => T | undefined, message: string) => {
    const parsed = parse(await value)
    if (parsed === undefined) throw new Error(message)
    return parsed
  }
  return {
    connect: (input: SshConnectionInput) =>
      result(
        bridge.sshConnect!(JSON.stringify(input)),
        parseSshConnectResult,
        "Android returned an invalid SSH connection result.",
      ),
    trustHostKey: (profile, fingerprint) =>
      result(
        bridge.sshTrustHostKey!(JSON.stringify({ profile, fingerprint })),
        parseSshConnectResult,
        "Android returned an invalid host-key result.",
      ),
    status: () => result(bridge.sshStatus!(), parseSshStatus, "Android returned an invalid SSH status."),
    disconnect: () => bridge.sshDisconnect!(),
    cleanup: () => bridge.sshCleanup!(),
    home: () => result(bridge.sshHome!(), parseSshHome, "Android returned an invalid SFTP home."),
    list: (path, showHidden = false) =>
      result(bridge.sshList!(path, showHidden), parseSshListing, "Android returned an invalid SFTP listing."),
    execVersion: (agent: SshAgent, directory: string) =>
      result(
        bridge.sshExec!(JSON.stringify({ agent, directory })),
        parseSshPreflight,
        "Android returned an invalid SSH preflight result.",
      ),
    execAuthStatus: (agent: SshAgent, directory: string) =>
      result(
        bridge.sshAuthStatus!(JSON.stringify({ agent, directory })),
        parseSshAuthStatus,
        "Android returned an invalid SSH authentication result.",
      ),
    start: (input) =>
      result(bridge.sshStart!(JSON.stringify(input)), parseSshStart, "Android returned an invalid SSH session result."),
    orchestratorStart: async (directory) => {
      if (!bridge.sshOrchestratorStart) throw new Error("Native SSH orchestration is unavailable.")
      return result(
        bridge.sshOrchestratorStart(JSON.stringify({ directory })),
        parseSshOrchestratorStart,
        "Android returned an invalid SSH orchestrator result.",
      )
    },
    orchestratorInput: (value) => {
      if (!bridge.sshOrchestratorInput) return Promise.reject(new Error("Native SSH orchestration is unavailable."))
      return bridge.sshOrchestratorInput(value)
    },
    orchestratorStop: () => {
      if (!bridge.sshOrchestratorStop) return Promise.reject(new Error("Native SSH orchestration is unavailable."))
      return bridge.sshOrchestratorStop()
    },
    input: (value) => bridge.sshInput!(value),
    resize: (cols, rows, width = 0, height = 0) => bridge.sshResize!(cols, rows, width, height),
    interrupt: () => bridge.sshInterrupt!(),
    credentialGet: async (profile) => parseSshCredential(await bridge.sshCredentialGet!(profile)),
    credentialSet: (profile, credential: SshCredential) =>
      bridge.sshCredentialSet!(profile, JSON.stringify(credential)),
    credentialClear: (profile) => bridge.sshCredentialClear!(profile),
    subscribe(listener: (event: SshEvent) => void) {
      nonce = crypto.randomUUID().replaceAll("-", "")
      ready = undefined
      const handler = (event: Event) => {
        const message = event as MessageEvent
        if (!trustedAndroidMessage(message)) return
        const parsed = parseSshEventMessage(parseJson<unknown>(message.data, null), nonce)
        if (parsed) listener(parsed)
      }
      window.addEventListener("message", handler)
      void prepare()
      return () => window.removeEventListener("message", handler)
    },
    subscribeOrchestrator(listener: (event: SshOrchestratorEvent) => void) {
      if (!bridge.sshOrchestratorStart || !bridge.sshOrchestratorInput || !bridge.sshOrchestratorStop)
        return () => undefined
      nonce = crypto.randomUUID().replaceAll("-", "")
      ready = undefined
      const handler = (event: Event) => {
        const message = event as MessageEvent
        if (!trustedAndroidMessage(message)) return
        const parsed = parseSshOrchestratorEventMessage(parseJson<unknown>(message.data, null), nonce)
        if (parsed) listener(parsed)
      }
      window.addEventListener("message", handler)
      void prepare()
      return () => window.removeEventListener("message", handler)
    },
  }
}

export async function detectAndroidCapabilities(bridge = getAndroidBridge()): Promise<AndroidCapabilities> {
  const fallback: AndroidCapabilities = {
    secureStorage: false,
    qrPairing: false,
    notifications: false,
    deepLinks: false,
    remoteTransport: false,
    backgroundExecution: false,
    remoteJobs: false,
  }
  const raw = bridge ? await bridge.capabilities().catch(() => null) : null
  if (!isRecord(raw)) return fallback
  return {
    secureStorage: enabled(raw.secureStorage),
    qrPairing: enabled(raw.qrPairing),
    notifications: enabled(raw.notifications),
    deepLinks: enabled(raw.deepLinks),
    remoteTransport: enabled(raw.remoteTransport),
    backgroundExecution: enabled(raw.backgroundExecution),
    remoteJobs: enabled(raw.remoteJobs),
  }
}

export function parseRemoteJobNonce(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(value)) return
  return value
}

export function parseRemoteJobActionValue(value: unknown) {
  return parseRemoteJobAction(value)
}

export function encodeRemoteJobInput(input: RemoteJobStartInput) {
  return JSON.stringify(input)
}

export function encodeRemoteJobAction(payload: RemoteJobActionPayload | undefined) {
  return payload === undefined ? undefined : JSON.stringify(payload)
}

export function remoteJobsBridge(
  bridge: AndroidNativeBridge | undefined,
  enabled = true,
): AndroidRemoteJobs | undefined {
  if (!bridge || !enabled) return
  let nonce = ""
  let ready: Promise<boolean> | undefined
  const prepare = () => {
    if (!nonce) return Promise.resolve(false)
    ready ??= bridge.remoteJobsReady(nonce).then((value) => value === true)
    return ready
  }
  return {
    list: async () => parseRemoteJobList(await bridge.remoteJobList().catch(() => [])),
    start: async (input) => {
      const value = parseRemoteJobAction(await bridge.remoteJobStart(encodeRemoteJobInput(input)))
      if (!value) throw new Error("Android did not return a valid remote job.")
      return value
    },
    action: async (jobID, action, payload) =>
      parseRemoteJobAction(
        await bridge.remoteJobAction(jobID, action, encodeRemoteJobAction(payload)).catch(() => undefined),
      ),
    subscribe(listener) {
      nonce = crypto.randomUUID().replaceAll("-", "")
      ready = undefined
      const handler = (event: Event) => {
        const message = event as MessageEvent
        if (!trustedAndroidMessage(message)) return
        const parsed = parseRemoteJobMessage(message.data, nonce, ANDROID_REMOTE_JOB_CHANNEL)
        if (parsed) listener(parsed)
      }
      window.addEventListener("message", handler)
      void prepare()
      return () => window.removeEventListener("message", handler)
    },
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
    if (url.hostname === "remote-session") {
      return parseRemoteSessionDeepLink(value) !== undefined
    }
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
  )
    return []
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
