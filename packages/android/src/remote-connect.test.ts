import { describe, expect, test } from "bun:test"
import {
  connectRemoteWorkspace,
  RemoteSelectionBindingRequiredError,
  RemoteSupervisorPendingError,
  type RemoteConnectInput,
} from "./remote-connect"

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
  device: { id: "dev_android_test", name: "Slopcode Android", platform: "android", arch: "arm64", version: "1" },
  host: { id: "hst_server_123", name: "Mac", platform: "macos", arch: "arm64", version: "15", mode: "ssh" },
  workspace,
  capability: { fs: true, command: true, pty: true, events: true, localWorkspace: false, sshWorkspace: true },
}

const boundPairing = {
  ...pairing,
  selection: { nonce: "0123456789abcdef", deviceID: "dev_android_test", code: "ABC123" },
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

function fetcher(
  calls: Array<{ url: string; body?: unknown; authorization: string | null }>,
  pending = false,
  bound = false,
) {
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.get("authorization"),
    })
    if (url.endsWith("/global/health")) return new Response(null, { status: 200 })
    if (url.endsWith("/remote/pairing")) return Response.json(bound ? boundPairing : pairing)
    if (url.endsWith("/remote/ssh/validate")) {
      if (pending) return Response.json({ message: "Waiting for desktop supervisor target registration" }, { status: 409 })
      return Response.json(workspace)
    }
    if (url.endsWith("/remote/select")) {
      const selected = { ...boundPairing }
      delete (selected as Partial<typeof boundPairing>).code
      delete (selected as Partial<typeof boundPairing>).selection
      return Response.json(selected)
    }
    return new Response(null, { status: 404 })
  }
}

describe("Android remote pairing", () => {
  test("uses the future device-bound selection contract and persists authoritative capabilities", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    let saved: Awaited<ReturnType<typeof connectRemoteWorkspace>> | undefined
    const result = await connectRemoteWorkspace(input, fetcher(calls, false, true), async (state, secret) => {
      saved = { state, secret, pairing: state.workspace! }
    })

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/global/health",
      "/experimental/workspace/remote/pairing",
      "/experimental/workspace/remote/ssh/validate",
      "/experimental/workspace/remote/select",
    ])
    expect(calls[3]?.body).toEqual({
      pairingID: "pair_server_123",
      deviceID: "dev_android_test",
      selectionNonce: "0123456789abcdef",
      selectionCode: "ABC123",
    })
    expect(result.state.workspace?.capability).toEqual(pairing.capability)
    expect(saved?.secret.password).toBe("secret")
  })

  test("fails closed before the legacy pairID-only selection endpoint", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    let saves = 0

    await expect(
      connectRemoteWorkspace(input, fetcher(calls), async () => {
        saves += 1
      }),
    ).rejects.toBeInstanceOf(RemoteSelectionBindingRequiredError)

    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/global/health",
      "/experimental/workspace/remote/pairing",
      "/experimental/workspace/remote/ssh/validate",
    ])
    expect(calls.every((call) => call.authorization === "Basic c2xvcGNvZGU6c2VjcmV0")).toBeTrue()
    expect((calls[1]?.body as { workspace: typeof workspace }).workspace).toEqual(workspace)
    expect(saves).toBe(0)
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

  test("rejects a validated workspace that differs from the original request", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    const base = fetcher(calls, false, true)
    let saves = 0
    const altered = async (url: string | URL, init?: RequestInit) => {
      const response = await base(url, init)
      if (String(url).endsWith("/remote/ssh/validate")) {
        return Response.json({ ...workspace, remoteDirectory: "/other/project" })
      }
      return response
    }

    await expect(connectRemoteWorkspace(input, altered, async () => void saves++)).rejects.toThrow("exact requested workspace")
    expect(calls.map((call) => new URL(call.url).pathname)).not.toContain("/experimental/workspace/remote/select")
    expect(saves).toBe(0)
  })

  test("caps a streamed response before buffering it", async () => {
    const calls: string[] = []
    const huge = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(200 * 1024))
        controller.enqueue(new Uint8Array(100 * 1024))
        controller.close()
      },
    })
    const fetcher = async (url: string | URL) => {
      calls.push(String(url))
      return new Response(huge, { status: 200 })
    }

    await expect(connectRemoteWorkspace(input, fetcher)).rejects.toThrow("exceeded the Android limit")
    expect(calls).toEqual(["https://desktop.example.test/global/health"])
  })
})
