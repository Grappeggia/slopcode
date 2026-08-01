import { describe, expect, test } from "bun:test"
import { homedir } from "node:os"
import { join } from "node:path"
import type { DesktopRemoteEvent, DesktopRemoteHostService, DesktopRemoteReady } from "./contract"
import { createRemoteSupervisor } from "./supervisor"

const ready = {
  kind: "ready",
  id: "ssh:marcos@example.test:22\u0000opencode-cli\u0000/srv/project",
  host: {
    id: "hst_desktop",
    name: "Desktop",
    platform: "macos",
    arch: "arm64",
    version: "15",
    mode: "ssh",
  },
  workspace: {
    id: "wrk_desktop",
    name: "Remote project",
    mode: "ssh",
    agent: "opencode-cli",
    directory: "/Users/marcos/Projects/slopcode",
    remoteDirectory: "/srv/project",
    ssh: { host: "example.test", port: 22, user: "marcos" },
  },
  url: "http://127.0.0.1:4321",
  username: "slopcode",
  password: "remote-secret",
  attached: false,
} satisfies DesktopRemoteReady

const pairing = {
  version: "v1",
  id: "pair_android",
  device: { id: "dev_android", name: "Android", platform: "android", arch: "arm64", version: "1" },
  host: ready.host,
  workspace: {
    id: "wrk_android",
    name: "Remote project",
    mode: "ssh",
    agent: "opencode-cli",
    directory: "/srv/project",
    remoteDirectory: "/srv/project",
    ssh: ready.workspace.ssh,
  },
  capability: { fs: true, command: true, pty: true, events: true, localWorkspace: false, sshWorkspace: true },
}

describe("createRemoteSupervisor", () => {
  test("registers a ready desktop SSH target for an exact matching pairing", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    let listener: ((event: DesktopRemoteEvent) => void) | undefined
    const remote = {
      getState: () => undefined,
      subscribe: (next: (event: DesktopRemoteEvent) => void) => {
        listener = next
        return () => {
          listener = undefined
        }
      },
      validateWorkspace: async () => ({ directory: ready.workspace.remoteDirectory }),
      ensureWorkspace: async () => ready,
      stopWorkspace: async () => undefined,
      stopAll: async () => undefined,
    } satisfies DesktopRemoteHostService
    const supervisor = createRemoteSupervisor({
      service: remote,
      serverUrl: "http://127.0.0.1:9000/",
      username: "slopcode",
      password: "desktop-secret",
      token: "supervisor-secret",
      hostID: ready.host.id,
      intervalMs: 60_000,
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init })
        if (String(url).endsWith("/pairings")) return Response.json([pairing])
        return new Response(null, { status: 204 })
      },
    })
    const stop = supervisor.start()
    listener?.({ type: "state", state: ready })
    await supervisor.reconcile()

    expect(calls).toHaveLength(2)
    expect(calls[0]?.url).toBe("http://127.0.0.1:9000/experimental/remote/supervisor/pairings")
    expect(calls[1]?.url).toBe("http://127.0.0.1:9000/experimental/remote/supervisor/target")
    expect(calls[1]?.init?.headers).toBeDefined()
    const headers = new Headers(calls[1]?.init?.headers)
    expect(headers.get("x-slopcode-remote-supervisor-token")).toBe("supervisor-secret")
    expect(headers.get("authorization")).toMatch(/^Basic /)
    expect(JSON.parse(String(calls[1]?.init?.body))).toEqual({
      pairingID: pairing.id,
      workspace: pairing.workspace,
      target: {
        type: "remote",
        url: ready.url,
        headers: { "x-slopcode-remote-capability": ready.password },
      },
    })
    stop()
  })

  test("starts and registers only pairings assigned to this desktop host", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const starts: unknown[] = []
    const remote = {
      getState: () => undefined,
      subscribe: () => () => undefined,
      validateWorkspace: async () => ({ directory: ready.workspace.remoteDirectory }),
      ensureWorkspace: async (target: unknown) => {
        starts.push(target)
        return ready
      },
      stopWorkspace: async () => undefined,
      stopAll: async () => undefined,
    } satisfies DesktopRemoteHostService
    const supervisor = createRemoteSupervisor({
      service: remote,
      serverUrl: "http://127.0.0.1:9000",
      username: "slopcode",
      password: "desktop-secret",
      token: "supervisor-secret",
      hostID: ready.host.id,
      fetcher: async (url, init) => {
        calls.push({ url: String(url), init })
        if (String(url).endsWith("/pairings")) {
          return Response.json([pairing, { ...pairing, id: "pair_other", host: { ...pairing.host, id: "hst_other" } }])
        }
        return new Response(null, { status: 204 })
      },
    })

    await supervisor.reconcile()

    expect(starts).toEqual([
      {
        host: pairing.host,
        workspace: { ...pairing.workspace, directory: homedir() },
        security: { hostKey: { kind: "known_hosts", path: join(homedir(), ".ssh", "known_hosts") } },
      },
    ])
    expect(calls.filter((call) => call.url.endsWith("/target"))).toHaveLength(1)
  })

  test("retries a failed start on the next reconciliation", async () => {
    let attempts = 0
    const remote = {
      getState: () => undefined,
      subscribe: () => () => undefined,
      validateWorkspace: async () => ({ directory: ready.workspace.remoteDirectory }),
      ensureWorkspace: async () => {
        attempts += 1
        if (attempts === 1) throw new Error("SSH unavailable")
        return ready
      },
      stopWorkspace: async () => undefined,
      stopAll: async () => undefined,
    } satisfies DesktopRemoteHostService
    const supervisor = createRemoteSupervisor({
      service: remote,
      serverUrl: "http://127.0.0.1:9000",
      username: "slopcode",
      password: "desktop-secret",
      token: "supervisor-secret",
      hostID: ready.host.id,
      fetcher: async (url) =>
        String(url).endsWith("/pairings") ? Response.json([pairing]) : new Response(null, { status: 204 }),
    })

    await supervisor.reconcile()
    await supervisor.reconcile()

    expect(attempts).toBe(2)
  })
})
