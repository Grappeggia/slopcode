import { createSignal, Show } from "solid-js"
import { persistRemoteWorkspace } from "./platform"

type Props = {
  onConnected: () => void
}

function clean(value: string) {
  return value.trim()
}

function validUrl(value: string) {
  try {
    const url = new URL(clean(value))
    if (url.protocol !== "https:") return
    url.hash = ""
    return url.toString().replace(/\/+$/, "")
  } catch {
    return
  }
}

function validPort(value: string) {
  const port = Number.parseInt(value, 10)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) return
  return port
}

function validWorkspaceID(value: string) {
  const next = clean(value)
  if (!next) return `wrk_android_${crypto.randomUUID().replaceAll("-", "")}`
  if (!/^wrk[a-zA-Z0-9._:-]+$/.test(next)) return
  return next
}

function basic(username: string, password: string) {
  if (!password) return
  return `Basic ${btoa(`${username || "slopcode"}:${password}`)}`
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
    const serverUrl = validUrl(url())
    const remoteDirectory = clean(directory())
    const sshHost = clean(host())
    const sshUser = clean(user())
    const sshPort = validPort(port())
    const workspaceID = validWorkspaceID(workspace())
    if (!serverUrl) return setError("Enter an HTTPS desktop or relay URL.")
    if (!remoteDirectory.startsWith("/") || remoteDirectory.includes("\n") || remoteDirectory.includes("\0")) {
      return setError("Remote folder must be an absolute POSIX path.")
    }
    if (!sshHost || !sshUser || !sshPort) return setError("Enter the SSH host, user, and port.")
    if (!workspaceID) return setError("Workspace IDs must start with wrk.")

    setBusy(true)
    setError("")
    try {
      const headers = new Headers()
      const authorization = basic(clean(username()), password())
      if (authorization) headers.set("authorization", authorization)
      const response = await fetch(`${serverUrl}/global/health`, {
        headers,
        credentials: "omit",
      })
      if (!response.ok) throw new Error(`Desktop health check failed (${response.status}).`)
      const deviceID = `dev_android_${crypto.randomUUID().replaceAll("-", "")}`
      const hostID = `hst_${crypto.randomUUID().replaceAll("-", "")}`
      await persistRemoteWorkspace(
        {
          version: 1,
          serverUrl,
          workspace: {
            version: "v1",
            pairingId: `pair_${crypto.randomUUID().replaceAll("-", "")}`,
            device: {
              id: deviceID,
              name: "Slopcode Android",
              platform: "android",
              arch: "arm64",
              version: "1",
            },
            host: {
              id: hostID,
              name: sshHost,
              platform: "remote",
              arch: "unknown",
              version: "unknown",
              mode: "ssh",
            },
            workspace: {
              id: workspaceID,
              name: clean(name()) || remoteDirectory,
              mode: "ssh",
              directory: remoteDirectory,
              remoteDirectory,
              ssh: {
                host: sshHost,
                port: sshPort,
                user: sshUser,
              },
            },
          },
          savedAt: new Date().toISOString(),
        },
        password() ? { username: clean(username()) || "slopcode", password: password() } : undefined,
      )
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
          Workspace ID (optional)
          <input
            type="text"
            placeholder="wrk_project"
            value={workspace()}
            onInput={(event) => setWorkspace(event.currentTarget.value)}
            class="rounded-md border border-border-weak-base bg-surface-base px-3 py-2"
          />
        </label>

        <div class="grid grid-cols-[minmax(0,1fr)_6rem] gap-3">
          <label class="flex flex-col gap-1 text-14-medium">
            SSH host
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
          Remote folder
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
