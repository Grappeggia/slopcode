import { describe, expect, test } from "bun:test"
import { connectRemoteWorkspace, RemoteSupervisorPendingError, type RemoteConnectInput } from "./remote-connect"

const workspace = {
  id: "wrk_remote_mac",
  name: "Mac project",
  mode: "ssh" as const,
  directory: "/Users/marcos/Projects/slopcode",
  remoteDirectory: "/Users/marcos/Projects/slopcode",
  ssh: { host: "mac.example.test", port: 22, user: "marcos" },
}

const pairing = {
  version: "v1",
  id: "pair_server_123",
  code: "ABC123",
  device: { id: "dev_server_123", name: "Slopcode Android", platform: "android", arch: "arm64", version: "1" },
  host: { id: "hst_server_123", name: "Mac", platform: "macos", arch: "arm64", version: "15", mode: "ssh" },
  workspace,
  capability: { fs: true, command: true, pty: true, events: true, localWorkspace: false, sshWorkspace: true },
}

const input: RemoteConnectInput = {
  serverUrl: "https://desktop.example.test/",
  username: "slopcode",
  password: "secret",
  name: "Mac project",
  workspaceID: workspace.id,
  host: workspace.ssh.host,
  port: workspace.ssh.port,
  user: workspace.ssh.user,
  directory: workspace.remoteDirectory,
  deviceID: "dev_android_test",
}

function fetcher(calls: Array<{ url: string; body?: unknown; authorization: string | null }>, pending = false) {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.get("authorization"),
    })
    if (url.endsWith("/global/health")) return new Response(null, { status: 200 })
    if (url.endsWith("/remote/pairing")) return Response.json(pairing)
    if (url.endsWith("/remote/ssh/validate")) {
      if (pending) return Response.json({ message: "Waiting for desktop supervisor target registration" }, { status: 409 })
      return Response.json(workspace)
    }
    if (url.endsWith("/remote/select")) {
      const selected = { ...pairing }
      delete (selected as Partial<typeof pairing>).code
      return Response.json(selected)
    }
    return new Response(null, { status: 404 })
  }
}

describe("Android remote pairing", () => {
  test("requires the authenticated pairing, supervisor validation, and redacted selection in order", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    let saved: Awaited<ReturnType<typeof connectRemoteWorkspace>> | undefined
    const result = await connectRemoteWorkspace(input, fetcher(calls), async (state, secret) => {
      saved = { state, secret, pairing: state.workspace! }
    })

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/global/health",
      "/experimental/workspace/remote/pairing",
      "/experimental/workspace/remote/ssh/validate",
      "/experimental/workspace/remote/select",
    ])
    expect(calls.every((call) => call.authorization === "Basic c2xvcGNvZGU6c2VjcmV0")).toBeTrue()
    expect((calls[1]?.body as { workspace: typeof workspace }).workspace).toEqual(workspace)
    expect(result.pairing.pairingId).toBe("pair_server_123")
    expect(result.pairing).not.toHaveProperty("code")
    expect(result.state.serverUrl).toBe("https://desktop.example.test")
    expect(result.state.serverSelection).toEqual({
      url: "https://desktop.example.test",
      workspaceID: workspace.id,
      directory: workspace.remoteDirectory,
    })
    expect(saved?.secret.password).toBe("secret")
  })

  test("fails closed with a pending-supervisor error and does not save before validation", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    let saves = 0

    await expect(
      connectRemoteWorkspace(input, fetcher(calls, true), async () => {
        saves += 1
      }),
    ).rejects.toBeInstanceOf(RemoteSupervisorPendingError)

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/global/health",
      "/experimental/workspace/remote/pairing",
      "/experimental/workspace/remote/ssh/validate",
    ])
    expect(saves).toBe(0)
  })
})
