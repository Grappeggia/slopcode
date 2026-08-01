import { RemotePairingRecord, RemoteTargetCapabilityHeader, RemoteWorkspaceSsh } from "@slopcode-ai/protocol"
import { Option, Schema } from "effect"
import { homedir } from "node:os"
import { join } from "node:path"
import type { DesktopRemoteHostService, DesktopRemoteReady, DesktopRemoteState, DesktopSshTarget } from "./contract"

type Fetcher = (input: string | URL, init?: RequestInit) => Promise<Response>

export type RemoteSupervisorOptions = {
  service: DesktopRemoteHostService
  serverUrl: string
  username: string
  password: string
  token: string
  hostID: string
  intervalMs?: number
  fetcher?: Fetcher
}

const decodePairing = Schema.decodeUnknownOption(RemotePairingRecord)

function pairings(value: unknown) {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const pairing = decodePairing(item)
    return Option.isSome(pairing) ? [pairing.value] : []
  })
}

function sameTarget(pairing: ReturnType<typeof pairings>[number], ready: DesktopRemoteReady) {
  if (pairing.workspace.mode !== "ssh") return false
  return (
    pairing.workspace.remoteDirectory === ready.workspace.remoteDirectory &&
    pairing.workspace.ssh.host === ready.workspace.ssh.host &&
    pairing.workspace.ssh.port === ready.workspace.ssh.port &&
    pairing.workspace.ssh.user === ready.workspace.ssh.user &&
    (pairing.workspace.agent ?? "local-slopcode") === ready.workspace.agent
  )
}

function authorization(username: string, password: string) {
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

function ready(value: DesktopRemoteState): value is DesktopRemoteReady {
  return value.kind === "ready"
}

function target(pairing: ReturnType<typeof pairings>[number]): DesktopSshTarget | undefined {
  const host = pairing.host
  if (host.mode !== "ssh" || pairing.workspace.mode !== "ssh") return
  const directory = homedir()
  const workspace = Schema.decodeUnknownSync(RemoteWorkspaceSsh)({ ...pairing.workspace, directory })
  return {
    host: { ...host, mode: "ssh" as const },
    workspace,
    security: {
      hostKey: {
        kind: "known_hosts" as const,
        path: join(directory, ".ssh", "known_hosts"),
      },
    },
  }
}

export function createRemoteSupervisor(options: RemoteSupervisorOptions) {
  const fetcher = options.fetcher ?? fetch
  const active = new Map<string, DesktopRemoteReady>()
  const registered = new Set<string>()
  let timer: ReturnType<typeof setInterval> | undefined
  let running = false
  let reconciling: Promise<void> | undefined

  const reconcile = async () => {
    if (reconciling) return reconciling
    reconciling = (async () => {
      const response = await fetcher(`${options.serverUrl.replace(/\/$/, "")}/experimental/remote/supervisor/pairings`, {
        headers: {
          authorization: authorization(options.username, options.password),
          ["x-slopcode-remote-supervisor-token"]: options.token,
        },
        credentials: "omit",
        redirect: "error",
        signal: AbortSignal.timeout(5_000),
      })
      if (!response.ok) return
      const found = pairings(await response.json())
      await Promise.all(
        found.flatMap((pairing) => {
          if (pairing.host.id !== options.hostID) return []
          const next = target(pairing)
          if (!next) return []
          return [
            options.service.ensureWorkspace(next).then(
              (state) => active.set(state.id, state),
              () => undefined,
            ),
          ]
        }),
      )
      await Promise.all(
        found.flatMap((pairing) =>
          [...active.entries()].flatMap(([stateID, state]) => {
            if (pairing.host.id !== options.hostID) return []
            if (!sameTarget(pairing, state)) return []
            const key = `${pairing.id}\u0000${stateID}\u0000${state.url}`
            if (registered.has(key)) return []
            registered.add(key)
            return [
              fetcher(`${options.serverUrl.replace(/\/$/, "")}/experimental/remote/supervisor/target`, {
                method: "POST",
                headers: {
                  authorization: authorization(options.username, options.password),
                  ["content-type"]: "application/json",
                  ["x-slopcode-remote-supervisor-token"]: options.token,
                },
                body: JSON.stringify({
                  pairingID: pairing.id,
                  workspace: pairing.workspace,
                  target: {
                    type: "remote",
                    url: state.url,
                    headers: { [RemoteTargetCapabilityHeader]: state.password },
                  },
                }),
                credentials: "omit",
                redirect: "error",
                signal: AbortSignal.timeout(5_000),
              })
                .then((result) => {
                  if (result.ok) return
                  registered.delete(key)
                })
                .catch(() => registered.delete(key)),
            ]
          }),
        ),
      )
    })().finally(() => {
      reconciling = undefined
    })
    return reconciling
  }

  const onState = (event: { type: "state"; state: DesktopRemoteState }) => {
    if (ready(event.state)) active.set(event.state.id, event.state)
    else active.delete(event.state.id)
    void reconcile().catch(() => undefined)
  }

  return {
    start() {
      if (running) return
      running = true
      const unsubscribe = options.service.subscribe(onState)
      timer = setInterval(() => void reconcile().catch(() => undefined), options.intervalMs ?? 5_000)
      timer.unref?.()
      return () => {
        if (!running) return
        running = false
        if (timer) clearInterval(timer)
        timer = undefined
        unsubscribe()
        active.clear()
        registered.clear()
      }
    },
    reconcile,
  }
}
