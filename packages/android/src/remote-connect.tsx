import { createSignal, Show } from "solid-js"
import { persistRemoteWorkspace } from "./platform"
import {
  normalizeHttpsUrl,
  normalizeRemoteWorkspaceState,
  type RemoteWorkspaceRecord,
  type RemoteWorkspaceState,
} from "./remote-workspace-state"

type Props = {
  onConnected: () => void
}

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

function clean(value: string) {
  return value.trim()
}

function validUrl(value: string) {
  return normalizeHttpsUrl(clean(value))
}

function validPort(value: string) {
  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return
  return port
}

function validWorkspaceID(value: string) {
  const next = clean(value)
  if (!next) return
  if (!/^wrk[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function basic(username: string, password: string) {
  if (!password) throw new Error("Enter the desktop password or token to authenticate pairing.")
  const user = username || "slopcode"
  if ([user, password].some((value) => value.length > 512 || /[\u0000\r\n]/.test(value))) {
    throw new Error("Desktop credentials are invalid.")
  }
  try {
    return `Basic ${btoa(`${user}:${password}`)}`
  } catch {
    throw new Error("Desktop credentials must use a supported encoding.")
  }
}

function validDirectory(value: string) {
  const next = clean(value)
  if (!next.startsWith("/") || next.includes("\\") || next.includes("\u0000") || next.includes("//")) return
  if (next.split("/").some((part) => part === "." || part === "..")) return
  return next
}

function record(value: unknown, code: boolean) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const raw = value as Record<string, unknown>
  if (raw.version !== "v1" || typeof raw.id !== "string" || !/^pair_[a-zA-Z0-9._:-]+$/.test(raw.id)) return
  if (code && (typeof raw.code !== "string" || !/^[A-Z0-9]{6}$/.test(raw.code))) return
  if (!code && Object.prototype.hasOwnProperty.call(raw, "code")) return
  const capability = raw.capability
  if (!capability || typeof capability !== "object" || Array.isArray(capability)) return
  const capabilities = capability as Record<string, unknown>
  if (!["fs", "command", "pty", "events", "localWorkspace", "sshWorkspace"].every((key) => typeof capabilities[key] === "boolean")) return
  const device = raw.device
  const host = raw.host
  if (!device || typeof device !== "object" || Array.isArray(device)) return
  if (!host || typeof host !== "object" || Array.isArray(host)) return
  if (typeof (device as Record<string, unknown>).id !== "string" || !/^dev_[a-zA-Z0-9._:-]+$/.test((device as Record<string, unknown>).id as string)) return
  if (typeof (host as Record<string, unknown>).id !== "string" || !/^hst_[a-zA-Z0-9._:-]+$/.test((host as Record<string, unknown>).id as string)) return
  const normalized = normalizeRemoteWorkspaceState({ workspace: raw }).workspace
  const workspace = normalized?.workspace
  if (
    !workspace?.id ||
    !workspace.name ||
    workspace.mode !== "ssh" ||
    !workspace.directory ||
    !workspace.remoteDirectory ||
    !workspace.ssh?.host ||
    !workspace.ssh.user ||
    !workspace.ssh.port
  ) return
  return {
    id: raw.id,
    workspace,
    record: {
      version: "v1",
      device: normalized?.device,
      host: normalized?.host,
      workspace,
      pairingId: raw.id,
    } satisfies RemoteWorkspaceRecord,
  }
}

function workspace(value: unknown) {
  const normalized = normalizeRemoteWorkspaceState({ workspace: { workspace: value } }).workspace?.workspace
  if (
    !normalized?.id ||
    !normalized.name ||
    normalized.mode !== "ssh" ||
    !normalized.directory ||
    !normalized.remoteDirectory ||
    !normalized.ssh?.host ||
    !normalized.ssh.user ||
    !normalized.ssh.port
  ) return
  return normalized
}

function sameWorkspace(left: NonNullable<RemoteWorkspaceRecord["workspace"]>, right: NonNullable<RemoteWorkspaceRecord["workspace"]>) {
  return (
    left.id === right.id &&
    left.name === right.name &&
    left.mode === right.mode &&
    left.directory === right.directory &&
    left.remoteDirectory === right.remoteDirectory &&
    left.ssh?.host === right.ssh?.host &&
    left.ssh?.port === right.ssh?.port &&
    left.ssh?.user === right.ssh?.user
  )
}

function message(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return
  const raw = value as Record<string, unknown>
  if (typeof raw.message === "string" && raw.message.length <= 512) return raw.message
  if (raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)) {
    const nested = (raw.data as Record<string, unknown>).message
    if (typeof nested === "string" && nested.length <= 512) return nested
  }
}

async function body(response: Response) {
  const raw = await response.text()
  if (new TextEncoder().encode(raw).byteLength > 256 * 1024) throw new Error("Desktop response exceeded the Android limit.")
  if (!raw) return
  try {
    return JSON.parse(raw) as unknown
  } catch {
    return
  }
}

async function request(fetcher: Fetcher, url: string, headers: Headers, payload: unknown) {
  const response = await fetcher(url, {
    method: "POST",
    headers: new Headers({ ...Object.fromEntries(headers.entries()), "content-type": "application/json" }),
    body: JSON.stringify(payload),
    credentials: "omit",
    redirect: "error",
  })
  const data = await body(response)
  if (response.ok) return data
  const detail = message(data)
  if (response.status === 409) {
    throw new RemoteSupervisorPendingError(detail ?? "The desktop supervisor has not registered this SSH folder yet.")
  }
  if (response.status === 401 || response.status === 403) throw new Error("Desktop authentication failed for remote pairing.")
  throw new Error(detail ?? `Desktop remote request failed (${response.status}).`)
}

export class RemoteSupervisorPendingError extends Error {
  readonly code = "remote_supervisor_pending"

  constructor(detail: string) {
    super(detail)
    this.name = "RemoteSupervisorPendingError"
  }
}

export type RemoteConnectInput = {
  serverUrl: string
  username: string
  password: string
  name: string
  workspaceID: string
  host: string
  port: number
  user: string
  directory: string
  deviceID?: string
}

export type RemoteConnectResult = {
  state: RemoteWorkspaceState
  secret: { username: string; password: string }
  pairing: RemoteWorkspaceRecord
}

export async function connectRemoteWorkspace(
  input: RemoteConnectInput,
  fetcher: Fetcher = fetch,
  save: (state: RemoteWorkspaceState, secret: { username: string; password: string }) => Promise<void> = persistRemoteWorkspace,
): Promise<RemoteConnectResult> {
  const serverUrl = validUrl(input.serverUrl)
  const remoteDirectory = validDirectory(input.directory)
  const sshHost = clean(input.host)
  const sshUser = clean(input.user)
  const workspaceID = validWorkspaceID(input.workspaceID)
  if (!serverUrl) throw new Error("Enter an HTTPS desktop or relay URL.")
  if (!remoteDirectory) throw new Error("Remote folder must be an absolute POSIX path without traversal.")
  if (!sshHost || !sshUser || !Number.isInteger(input.port) || input.port < 1 || input.port > 65_535) {
    throw new Error("Enter the SSH host, user, and port.")
  }
  if (!workspaceID) throw new Error("Enter a workspace ID provisioned by the desktop host.")

  const headers = new Headers({ authorization: basic(clean(input.username), input.password) })
  const health = await fetcher(`${serverUrl}/global/health`, { headers, credentials: "omit", redirect: "error" })
  await body(health)
  if (!health.ok) {
    if (health.status === 401 || health.status === 403) throw new Error("Desktop authentication failed for remote pairing.")
    throw new Error(`Desktop health check failed (${health.status}).`)
  }

  const requestedWorkspace = {
    id: workspaceID,
    name: clean(input.name) || remoteDirectory,
    mode: "ssh" as const,
    directory: remoteDirectory,
    remoteDirectory,
    ssh: { host: sshHost, port: input.port, user: sshUser },
  }
  const created = record(
    await request(fetcher, `${serverUrl}/experimental/workspace/remote/pairing`, headers, {
      device: {
        id: input.deviceID ?? `dev_android_${crypto.randomUUID().replaceAll("-", "")}`,
        name: "Slopcode Android",
        platform: "android",
        arch: "arm64",
        version: "1",
      },
      workspace: requestedWorkspace,
    }),
    true,
  )
  if (!created) throw new Error("Desktop returned an invalid pairing; no connection was saved.")

  const validated = workspace(
    await request(fetcher, `${serverUrl}/experimental/workspace/remote/ssh/validate`, headers, created.workspace),
  )
  if (!validated || !sameWorkspace(validated, created.workspace)) {
    throw new RemoteSupervisorPendingError("The desktop supervisor has not registered the exact SSH host and folder yet.")
  }

  const selected = record(
    await request(fetcher, `${serverUrl}/experimental/workspace/remote/select`, headers, { pairingID: created.id }),
    false,
  )
  if (!selected || selected.id !== created.id || !sameWorkspace(selected.workspace, validated)) {
    throw new Error("Desktop did not return an authoritative selected pairing; no connection was saved.")
  }

  const secret = { username: clean(input.username) || "slopcode", password: input.password }
  const state: RemoteWorkspaceState = {
    version: 1,
    serverUrl,
    serverSelection: {
      url: serverUrl,
      workspaceID: selected.workspace.id,
      directory: selected.workspace.remoteDirectory ?? selected.workspace.directory,
    },
    workspace: selected.record,
    savedAt: new Date().toISOString(),
  }
  await save(state, secret)
  return { state, secret, pairing: selected.record }
}

export function RemoteConnect(props: Props) {
  const [url, setUrl] = createSignal("")
  const [username, setUsername] = createSignal("slopcode")
  const [password, setPassword] = createSignal("")
  const [name, setName] = createSignal("Remote workspace")
  const [workspace, setWorkspace] = createSignal("")
  const [host, setHost] = createSignal("")
  const [port, setPort] = createSignal("22")
  const [user, setUser] = createSignal("")
  const [directory, setDirectory] = createSignal("")
  const [error, setError] = createSignal("")
  const [busy, setBusy] = createSignal(false)

  const connect = async () => {
    if (busy()) return
    setBusy(true)
    setError("")
    try {
      await connectRemoteWorkspace({
        serverUrl: url(),
        username: username(),
        password: password(),
        name: name(),
        workspaceID: workspace(),
        host: host(),
        port: validPort(port()) ?? 0,
        user: user(),
        directory: directory(),
      })
      props.onConnected()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not connect to the desktop host.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main class="min-h-screen bg-surface-base text-text-strong flex items-center justify-center p-6">
      <form
        class="w-full max-w-xl rounded-xl border border-border-weak-base bg-surface-raised-base p-6 flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          void connect()
        }}
      >
        <div class="flex flex-col gap-1">
          <h1 class="text-20-medium">Connect to a remote workspace</h1>
          <p class="text-14-regular text-text-weak">
            The desktop host keeps SSH credentials local. Android receives only the selected workspace connection.
          </p>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          Desktop HTTPS or relay URL
          <input
            required
            type="url"
            inputMode="url"
            placeholder="https://desktop.example.com"
            value={url()}
            onInput={(event) => setUrl(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <div class="grid grid-cols-2 gap-3">
          <label class="flex flex-col gap-1 text-14-medium">
            Username
            <input
              type="text"
              autocomplete="username"
              value={username()}
              onInput={(event) => setUsername(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
          <label class="flex flex-col gap-1 text-14-medium">
            Desktop password or token
            <input
              type="password"
              autocomplete="current-password"
              value={password()}
              onInput={(event) => setPassword(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          Workspace name
          <input
            type="text"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <label class="flex flex-col gap-1 text-14-medium">
            Workspace ID (provisioned by the desktop host)
            <input
              required
              type="text"
              placeholder="wrk_project"
            value={workspace()}
            onInput={(event) => setWorkspace(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <label class="flex flex-col gap-1 text-14-medium">
            SSH host (metadata checked by the desktop supervisor)
            <input
              required
              type="text"
              autocomplete="off"
              placeholder="mac.example.com"
              value={host()}
              onInput={(event) => setHost(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
          <label class="flex flex-col gap-1 text-14-medium">
            Port
            <input
              required
              type="number"
              min="1"
              max="65535"
              value={port()}
              onInput={(event) => setPort(event.currentTarget.value)}
              class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
            />
          </label>
        </div>

        <label class="flex flex-col gap-1 text-14-medium">
          SSH user
          <input
            required
            type="text"
            autocomplete="username"
            placeholder="mac-user"
            value={user()}
            onInput={(event) => setUser(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <label class="flex flex-col gap-1 text-14-medium">
          Remote folder (must match the desktop supervisor target)
          <input
            required
            type="text"
            placeholder="/Users/mac-user/Projects/app"
            value={directory()}
            onInput={(event) => setDirectory(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <Show when={error()}>
          <p role="alert" class="text-14-regular text-text-on-critical-base">
            {error()}
          </p>
        </Show>

        <button
          type="submit"
          disabled={busy()}
          class="rounded-md bg-surface-brand-base text-text-on-brand-base px-4 py-2 disabled:opacity-50"
        >
          {busy() ? "Checking desktop…" : "Connect workspace"}
        </button>
      </form>
    </main>
  )
}
