import { describe, expect, test } from "bun:test"
import {
  browseRemoteFolders,
  connectRemoteWorkspace,
  normalizeSshString,
  parseSshAuthority,
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

const input: RemoteConnectInput = {
  serverUrl: "https://desktop.example.test/",
  username: "slopcode",
  password: "secret",
  name: "Mac project",
  workspaceID: workspace.id,
  sshAuthority: `${workspace.ssh.user}@${workspace.ssh.host}`,
  port: workspace.ssh.port,
  directory: workspace.remoteDirectory,
  deviceID: "dev_android_test",
}

function fetcher(
  calls: Array<{ url: string; body?: unknown; authorization: string | null }>,
  pending = false,
  bound = false,
  responseWorkspace: typeof workspace & { agent?: string } = workspace,
) {
  const responsePairing = { ...pairing, workspace: responseWorkspace }
  const responseBoundPairing = {
    ...responsePairing,
    selection: { nonce: "0123456789abcdef", deviceID: "dev_android_test", code: "ABC123" },
  }
  return async (input: string | URL, init?: RequestInit) => {
    const url = String(input)
    const headers = new Headers(init?.headers)
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
      authorization: headers.get("authorization"),
    })
    if (url.endsWith("/global/health")) return new Response(null, { status: 200 })
    if (url.endsWith("/remote/pairing")) return Response.json(bound ? responseBoundPairing : responsePairing)
    if (url.endsWith("/remote/ssh/validate")) {
      if (pending)
        return Response.json({ message: "Waiting for desktop supervisor target registration" }, { status: 409 })
      return Response.json(responseWorkspace)
    }
    if (url.endsWith("/remote/select")) {
      const selected = { ...responseBoundPairing }
      delete (selected as Partial<typeof responseBoundPairing>).code
      delete (selected as Partial<typeof responseBoundPairing>).selection
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
    expect((calls[1]?.body as { workspace: typeof workspace & { agent: string } }).workspace).toEqual({
      ...workspace,
      agent: "local-slopcode",
    })
    expect(saves).toBe(0)
  })

  test("fails closed with a pending-supervisor error and does not save before validation", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    let saves = 0

    await expect(
      connectRemoteWorkspace({ ...input, supervisorWaitMs: 0 }, fetcher(calls, true), async () => {
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

  test("waits for the desktop supervisor to register the SSH target", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    const base = fetcher(calls, false, true)
    let pending = true
    const retrying = async (url: string | URL, init?: RequestInit) => {
      if (String(url).endsWith("/remote/ssh/validate") && pending) {
        pending = false
        return Response.json({ message: "Waiting for desktop supervisor target registration" }, { status: 409 })
      }
      return base(url, init)
    }
    const result = await connectRemoteWorkspace({ ...input, supervisorWaitMs: 2_000 }, retrying, async () => undefined)

    expect(result.pairing.workspace?.agent).toBe("local-slopcode")
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      "/global/health",
      "/experimental/workspace/remote/pairing",
      "/experimental/workspace/remote/ssh/validate",
      "/experimental/workspace/remote/select",
    ])
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

    await expect(connectRemoteWorkspace(input, altered, async () => void saves++)).rejects.toThrow(
      "exact requested workspace",
    )
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

describe("Android SSH authority and folder browsing", () => {
  test("parses only an unambiguous, shell-safe user@host authority", () => {
    expect(parseSshAuthority("marcos@mac.example.test")).toEqual({ user: "marcos", host: "mac.example.test" })
    expect(parseSshAuthority("marcos@mac.example.test:2222")).toEqual({
      user: "marcos",
      host: "mac.example.test",
      port: 2222,
    })
    expect(parseSshAuthority("marcos@[2001:DB8::1]:2222")).toEqual({
      user: "marcos",
      host: "2001:db8::1",
      port: 2222,
    })
    ;[
      "marcos@2001:db8::1",
      "marcos@mac.example.test:22x",
      "marcos@mac.example.test:0",
      "marcos@mac.example.test:",
      "marcos;rm -rf@mac.example.test",
      "marcos@mac.example.test && whoami",
      "mac.example.test",
    ].forEach((value) => expect(parseSshAuthority(value)).toBeUndefined())
  })

  test("normalizes the one-field SSH setup string for saved history", () => {
    expect(normalizeSshString("  Marcos@[2001:DB8::1]:2222  ")).toBe("Marcos@[2001:db8::1]:2222")
    expect(normalizeSshString("marcos@Mac.Example.Test")).toBe("marcos@mac.example.test")
    expect(normalizeSshString("marcos@mac.example.test:0")).toBeUndefined()
  })

  test("browses bounded direct child folders with local recent pins", async () => {
    const calls: Array<{ url: string; method: string | undefined; body?: unknown; authorization: string | null }> = []
    const result = await browseRemoteFolders(
      {
        serverUrl: input.serverUrl,
        username: input.username,
        password: input.password,
        workspaceID: input.workspaceID,
        sshAuthority: input.sshAuthority,
        port: input.port,
        path: "/Users",
        recentFolders: ["/one", "/two", "/one", "/three", "/four"],
      },
      async (url, init) => {
        const headers = new Headers(init?.headers)
        calls.push({
          url: String(url),
          method: init?.method,
          body: init?.body ? JSON.parse(String(init.body)) : undefined,
          authorization: headers.get("authorization"),
        })
        return Response.json({
          root: "/",
          current: "/Users",
          parent: "/",
          entries: [
            { name: "marcos", path: "/Users/marcos", type: "directory" },
            { name: "shared", path: "/Users/shared", type: "directory" },
            { name: "notes.txt", path: "/Users/notes.txt", type: "file" },
          ],
        })
      },
    )

    expect(result).toEqual({
      root: "/",
      path: "/Users",
      parent: "/",
      entries: [
        { name: "marcos", path: "/Users/marcos", type: "directory" },
        { name: "shared", path: "/Users/shared", type: "directory" },
      ],
      recentFolders: ["/one", "/two", "/three"],
    })
    expect(calls).toHaveLength(1)
    const endpoint = new URL(calls[0]!.url)
    expect(endpoint.pathname).toBe("/remote/ssh/browse")
    expect(endpoint.searchParams.get("workspace")).toBe("wrk_remote_mac")
    expect(endpoint.searchParams.get("path")).toBe("/Users")
    expect(calls[0]?.method).toBe("GET")
    expect(calls[0]?.body).toBeUndefined()
    expect(calls[0]?.authorization).toBe("Basic c2xvcGNvZGU6c2VjcmV0")
  })

  test("rejects traversal, mismatched children, duplicates, and oversized listings", async () => {
    const base = {
      serverUrl: input.serverUrl,
      username: input.username,
      password: input.password,
      workspaceID: input.workspaceID,
      sshAuthority: input.sshAuthority,
      path: "/Users",
    }
    const invalid = [
      { root: "/", current: "/Users", parent: "/", entries: [{ name: "..", path: "/..", type: "directory" }] },
      { root: "/", current: "/Users", parent: "/", entries: [{ name: "tmp", path: "/tmp", type: "directory" }] },
      {
        root: "/",
        current: "/Users",
        parent: "/",
        entries: [
          { name: "tmp", path: "/Users/tmp", type: "directory" },
          { name: "tmp", path: "/Users/tmp", type: "directory" },
        ],
      },
      {
        root: "/",
        current: "/Users",
        parent: "/",
        entries: Array.from({ length: 257 }, (_, index) => ({
          name: `folder-${index}`,
          path: `/Users/folder-${index}`,
          type: "directory",
        })),
      },
      { root: "/", current: "/Users", parent: "/", entries: [], recentFolders: ["/server-folder"] },
      {
        root: "/",
        current: "/Users",
        parent: "/",
        entries: [{ name: "tmp", path: "/Users/tmp", type: "directory", extra: true }],
      },
    ]
    for (const payload of invalid) {
      await expect(browseRemoteFolders(base, async () => Response.json(payload))).rejects.toThrow(/invalid/)
    }
  })

  test("maps the server current path and does not trust the requested alias", async () => {
    const result = await browseRemoteFolders({ ...baseBrowseInput(), path: "/Users/alias" }, async (url) => {
      expect(new URL(String(url)).searchParams.get("path")).toBe("/Users/alias")
      return Response.json({ root: "/", current: "/Users", parent: "/", entries: [] })
    })
    expect(result.path).toBe("/Users")
  })

  test("starts the first browse at the authenticated remote root when path is omitted", async () => {
    const result = await browseRemoteFolders({ ...baseBrowseInput(), path: undefined }, async (url) => {
      const endpoint = new URL(String(url))
      expect(endpoint.pathname).toBe("/remote/ssh/browse")
      expect(endpoint.searchParams.get("workspace")).toBe(input.workspaceID!)
      expect(endpoint.searchParams.get("path")).toBeNull()
      return Response.json({ root: "/instance", current: "/instance", entries: [] })
    })
    expect(result).toEqual({ root: "/instance", path: "/instance", entries: [], recentFolders: [] })
  })

  test("omits the workspace query when the server can derive the SSH workspace", async () => {
    const result = await browseRemoteFolders({ ...baseBrowseInput(), workspaceID: undefined }, async (url) => {
      const endpoint = new URL(String(url))
      expect(endpoint.searchParams.get("workspace")).toBeNull()
      expect(endpoint.searchParams.get("sshAuthority")).toBe(`${input.sshAuthority}:22`)
      expect(endpoint.searchParams.get("sshPort")).toBe(String(input.port))
      return Response.json({ root: "/instance", current: "/instance", entries: [] })
    })
    expect(result.path).toBe("/instance")
  })

  test("reports authenticated browse failures", async () => {
    await expect(
      browseRemoteFolders(baseBrowseInput(), async () =>
        Response.json({ message: "browse unavailable" }, { status: 503 }),
      ),
    ).rejects.toThrow("browse unavailable")
    await expect(
      browseRemoteFolders(baseBrowseInput(), async () =>
        Response.json({ root: "/", current: "/", parent: "/bad", entries: [] }),
      ),
    ).rejects.toThrow("invalid parent")
  })

  test("includes and persists the selected agent without persisting an SSH password", async () => {
    const calls: Array<{ url: string; body?: unknown }> = []
    const opencodeWorkspace = { ...workspace, agent: "opencode-cli" as const }
    const result = await connectRemoteWorkspace(
      { ...input, agent: "opencode-cli", recentFolders: ["/old"] },
      async (url, init) => {
        calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : undefined })
        return fetcher([], false, true, opencodeWorkspace)(url, init)
      },
      async () => undefined,
    )
    expect(
      (calls.find((call) => call.url.endsWith("/remote/pairing"))?.body as { workspace: { agent: string } }).workspace
        .agent,
    ).toBe("opencode-cli")
    expect(calls.find((call) => call.url.endsWith("/remote/ssh/validate"))?.body).toEqual(opencodeWorkspace)
    expect(result.state.workspace?.workspace?.agent).toBe("opencode-cli")
    expect(result.state.recentFolders?.[0]?.paths).toEqual([input.directory, "/old"])
    expect(JSON.stringify(result.state)).not.toContain("sshPassword")
  })

  test("fetches a versioned command catalog for a selected CLI agent", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    const base = fetcher(calls, false, true, { ...workspace, agent: "opencode-cli" })
    let saved: Awaited<ReturnType<typeof connectRemoteWorkspace>> | undefined
    const result = await connectRemoteWorkspace(
      { ...input, agent: "opencode-cli" },
      async (url, init) => {
        if (new URL(String(url)).pathname === "/remote/agent/catalog") {
          const headers = new Headers(init?.headers)
          calls.push({ url: String(url), authorization: headers.get("authorization") })
          return Response.json({
            agent: "opencode-cli",
            version: "1.2.3",
            commands: [{ name: "deploy", description: "Deploy the project" }],
          })
        }
        return base(url, init)
      },
      async (state, secret) => {
        saved = { state, secret, pairing: state.workspace! }
      },
    )

    expect(calls.map((call) => new URL(call.url).pathname)).toContain("/remote/agent/catalog")
    expect(result.state.commandCatalog).toEqual({
      agent: "opencode-cli",
      version: "1.2.3",
      commands: expect.arrayContaining([{ name: "deploy", description: "Deploy the project" }, { name: "help" }]),
    })
    expect(saved?.state.commandCatalog?.version).toBe("1.2.3")
  })

  test("fails closed when an OpenCode validation response omits its bound agent", async () => {
    const calls: Array<{ url: string; body?: unknown; authorization: string | null }> = []
    const opencodeWorkspace = { ...workspace, agent: "opencode-cli" as const }
    const base = fetcher(calls, false, true, opencodeWorkspace)
    const altered = async (url: string | URL, init?: RequestInit) => {
      const response = await base(url, init)
      if (String(url).endsWith("/remote/ssh/validate")) return Response.json(workspace)
      return response
    }
    await expect(
      connectRemoteWorkspace({ ...input, agent: "opencode-cli" }, altered, async () => undefined),
    ).rejects.toThrow("exact requested workspace")
    expect(calls.map((call) => new URL(call.url).pathname)).not.toContain("/experimental/workspace/remote/select")
  })
})

function baseBrowseInput() {
  return {
    serverUrl: input.serverUrl,
    username: input.username,
    password: input.password,
    workspaceID: input.workspaceID,
    sshAuthority: input.sshAuthority,
    path: "/",
  }
}
