import { describe, expect, test } from "bun:test"
import type { AndroidSecureStorage } from "./types"
import {
  readRemoteWorkspace,
  normalizeHttpsUrl,
  normalizeRemoteWorkspaceState,
  rememberRemoteFolder,
  remoteFoldersForScope,
  readRemoteWorkspaceSecret,
  readRemoteWorkspaceState,
  writeRemoteWorkspaceSecret,
  writeRemoteWorkspaceState,
} from "./remote-workspace-state"

const pairing = {
  version: "v1",
  id: "pair_demo123",
  code: "ABC123",
  device: {
    id: "dev_phone123",
    name: "Pixel 9",
    platform: "android",
    arch: "arm64",
    version: "15",
    ignored: true,
  },
  host: {
    id: "hst_devbox123",
    name: "Dev Box",
    platform: "linux",
    arch: "x64",
    version: "24.04",
    mode: "ssh",
    secret: "nope",
  },
  workspace: {
    id: "wrk_remote123",
    name: "slopcode",
    mode: "ssh",
    directory: "/workspace/slopcode",
    remoteDirectory: "/srv/slopcode",
    ssh: {
      host: "example.test",
      port: 22,
      user: "marcos",
      password: "discard",
    },
    ignored: "drop",
  },
  capability: {
    fs: true,
    command: true,
    pty: true,
    events: true,
    localWorkspace: false,
    sshWorkspace: true,
  },
} as const

function memoryStorage(): AndroidSecureStorage & { values: Map<string, string> } {
  const values = new Map<string, string>()
  const key = (namespace: string, item: string) => `${namespace}:${item}`
  return {
    values,
    getItem: async (namespace, item) => values.get(key(namespace, item)) ?? null,
    setItem: async (namespace, item, value) => {
      values.set(key(namespace, item), value)
    },
    removeItem: async (namespace, item) => {
      values.delete(key(namespace, item))
    },
    clear: async (namespace) => {
      for (const item of [...values.keys()]) {
        if (item.startsWith(`${namespace}:`)) values.delete(item)
      }
    },
    keys: async (namespace) =>
      [...values.keys()]
        .filter((item) => item.startsWith(`${namespace}:`))
        .map((item) => item.slice(namespace.length + 1)),
    length: async (namespace) => [...values.keys()].filter((item) => item.startsWith(`${namespace}:`)).length,
  }
}

describe("remote workspace state persistence", () => {
  test("rejects secret-bearing HTTPS URLs instead of persisting them", async () => {
    const storage = memoryStorage()
    const urls = [
      "https://slopcode:secret@remote.example.test",
      "https://remote.example.test?token=secret",
      "https://remote.example.test#token=secret",
    ]

    urls.forEach((url) => expect(normalizeHttpsUrl(url)).toBeUndefined())
    expect(normalizeRemoteWorkspaceState({ serverUrl: urls[0] }).serverUrl).toBeUndefined()
    await expect(
      writeRemoteWorkspaceState(storage, {
        version: 1,
        serverUrl: urls[1],
        savedAt: "2026-08-01T00:00:00.000Z",
      }),
    ).rejects.toThrow("without credentials")
    expect(storage.values.size).toBe(0)
  })

  test("round-trips an allowlisted remote workspace record and separate secret", async () => {
    const storage = memoryStorage()

    await writeRemoteWorkspaceState(storage, {
      version: 1,
      serverUrl: "https://remote.example.test/",
      workspace: pairing as never,
      savedAt: "2026-08-01T00:00:00.000Z",
    })
    await writeRemoteWorkspaceSecret(storage, {
      username: "slopcode",
      password: "secret",
    })

    await expect(readRemoteWorkspaceState(storage)).resolves.toEqual({
      version: 1,
      serverUrl: "https://remote.example.test",
      serverSelection: {
        url: "https://remote.example.test",
        workspaceID: "wrk_remote123",
        directory: "/srv/slopcode",
      },
      workspace: {
        version: "v1",
        pairingId: "pair_demo123",
        capability: {
          fs: true,
          command: true,
          pty: true,
          events: true,
          localWorkspace: false,
          sshWorkspace: true,
        },
        device: {
          id: "dev_phone123",
          name: "Pixel 9",
          platform: "android",
          arch: "arm64",
          version: "15",
        },
        host: {
          id: "hst_devbox123",
          name: "Dev Box",
          platform: "linux",
          arch: "x64",
          version: "24.04",
          mode: "ssh",
        },
        workspace: {
          id: "wrk_remote123",
          name: "slopcode",
          mode: "ssh",
          agent: "local-slopcode",
          directory: "/workspace/slopcode",
          remoteDirectory: "/srv/slopcode",
          ssh: {
            host: "example.test",
            port: 22,
            user: "marcos",
          },
        },
      },
      savedAt: "2026-08-01T00:00:00.000Z",
    })

    await expect(readRemoteWorkspaceSecret(storage)).resolves.toEqual({
      username: "slopcode",
      password: "secret",
    })
    const raw = storage.values.get("slopcode.android.remote.dat:remote.workspace.v2")!
    expect(raw).not.toContain("ABC123")
    expect(raw).toContain('"capability"')
    expect(raw).toContain("secret")
    expect(storage.values.has("slopcode.android.remote.dat:remote.workspace")).toBeFalse()
    expect(storage.values.has("slopcode.android.remote.dat:remote.workspace.secret")).toBeFalse()
  })

  test("drops invalid payloads, insecure urls, and unknown fields without throwing", async () => {
    const storage = memoryStorage()
    await storage.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace",
      JSON.stringify({
        version: 99,
        serverUrl: "http://remote.example.test",
        workspace: {
          version: "v1",
          pairingId: "pair_demo123",
          keep: "nope",
        },
      }),
    )
    await storage.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace.secret",
      JSON.stringify({
        password: "",
        code: "ABC123",
      }),
    )

    await expect(readRemoteWorkspaceState(storage)).resolves.toEqual({ version: 1 })
    await expect(readRemoteWorkspaceSecret(storage)).resolves.toBeUndefined()
    expect(storage.values.has("slopcode.android.remote.dat:remote.workspace")).toBeFalse()
  })

  test("discards a credential when its origin or pairing no longer matches", async () => {
    const storage = memoryStorage()
    await storage.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace.v2",
      JSON.stringify({
        version: 1,
        state: {
          version: 1,
          serverUrl: "https://new.example.test",
          workspace: { version: "v1", pairingId: "pair_new" },
        },
        secret: { username: "slopcode", password: "old", origin: "https://old.example.test", pairingId: "pair_old" },
      }),
    )

    await expect(readRemoteWorkspace(storage)).resolves.toEqual({
      state: {
        version: 1,
        serverUrl: "https://new.example.test",
        serverSelection: { url: "https://new.example.test", workspaceID: undefined, directory: undefined },
        workspace: undefined,
        savedAt: undefined,
      },
      secret: undefined,
    })
    expect(storage.values.get("slopcode.android.remote.dat:remote.workspace.v2")).not.toContain('"secret"')
  })

  test("removes empty state instead of persisting blank shells", async () => {
    const storage = memoryStorage()

    await writeRemoteWorkspaceState(storage, { version: 1 })
    await writeRemoteWorkspaceSecret(storage)

    expect(storage.values.size).toBe(0)
  })

  test("migrates a valid legacy state and secret after writing the durable record", async () => {
    const storage = memoryStorage()
    await storage.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace",
      JSON.stringify({
        version: 1,
        serverUrl: "https://legacy.example.test",
        workspace: pairing,
        savedAt: "2026-08-01T00:00:00.000Z",
      }),
    )
    await storage.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace.secret",
      JSON.stringify({ username: "slopcode", password: "secret" }),
    )

    await expect(readRemoteWorkspace(storage)).resolves.toMatchObject({
      state: { serverUrl: "https://legacy.example.test" },
      secret: { username: "slopcode", password: "secret" },
    })
    expect(storage.values.has("slopcode.android.remote.dat:remote.workspace.v2")).toBeTrue()
    expect(storage.values.has("slopcode.android.remote.dat:remote.workspace")).toBeFalse()
    expect(storage.values.has("slopcode.android.remote.dat:remote.workspace.secret")).toBeFalse()
  })

  test("preserves state when a secret is cleared or storage reads fail", async () => {
    const storage = memoryStorage()
    await writeRemoteWorkspaceState(storage, { version: 1, serverUrl: "https://remote.example.test", savedAt: "now" })
    await writeRemoteWorkspaceSecret(storage, { username: "slopcode", password: "secret" })
    await writeRemoteWorkspaceSecret(storage)
    await expect(readRemoteWorkspaceState(storage)).resolves.toMatchObject({
      version: 1,
      serverUrl: "https://remote.example.test",
      savedAt: "now",
    })

    const readFailure = memoryStorage()
    await readFailure.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace.v2",
      JSON.stringify({ version: 1, state: { version: 1, serverUrl: "https://remote.example.test" } }),
    )
    const get = readFailure.getItem
    readFailure.getItem = async (namespace, key) => {
      if (key === "remote.workspace.v2") throw new Error("transient read")
      return get(namespace, key)
    }
    await expect(readRemoteWorkspace(readFailure)).rejects.toThrow("transient read")
    expect(readFailure.values.has("slopcode.android.remote.dat:remote.workspace.v2")).toBeTrue()
  })

  test("bounds, deduplicates, and scopes recent folders without storing credentials", () => {
    const state = normalizeRemoteWorkspaceState({
      version: 1,
      serverUrl: "https://remote.example.test",
      workspace: pairing,
      recentFolders: [
        {
          origin: "https://remote.example.test",
          workspaceID: "wrk_remote123",
          authority: "marcos@example.test:22",
          paths: ["/one", "/one", "/two", "/three", "/four", "/../bad"],
        },
        {
          origin: "https://other.example.test",
          workspaceID: "wrk_remote123",
          authority: "marcos@example.test:22",
          paths: ["/other"],
        },
      ],
    })
    expect(state.recentFolders).toEqual([
      {
        origin: "https://remote.example.test",
        workspaceID: "wrk_remote123",
        authority: "marcos@example.test:22",
        paths: ["/one", "/two", "/three"],
      },
      {
        origin: "https://other.example.test",
        workspaceID: "wrk_remote123",
        authority: "marcos@example.test:22",
        paths: ["/other"],
      },
    ])

    const scope = {
      origin: "https://remote.example.test",
      workspaceID: "wrk_remote123",
      authority: "marcos@example.test:22",
    }
    const next = rememberRemoteFolder(state, scope, "/two")
    expect(remoteFoldersForScope(next, scope)).toEqual(["/two", "/one", "/three"])
    expect(remoteFoldersForScope(next, { ...scope, authority: "other@example.test:22" })).toEqual([])
    expect(JSON.stringify(next)).not.toContain("password")
  })

  test("fails closed on an unknown persisted agent", () => {
    const state = normalizeRemoteWorkspaceState({
      version: 1,
      serverUrl: "https://remote.example.test",
      workspace: {
        ...pairing,
        workspace: { ...pairing.workspace, agent: "unknown-agent" },
      },
    })
    expect(state.workspace?.workspace).toBeUndefined()
  })

  test("round-trips the explicit OpenCode CLI agent selection", async () => {
    const storage = memoryStorage()
    await writeRemoteWorkspaceState(storage, {
      version: 1,
      serverUrl: "https://remote.example.test",
      workspace: {
        ...(pairing as unknown as Record<string, unknown>),
        workspace: { ...pairing.workspace, agent: "opencode-cli" },
      } as never,
    })
    await expect(readRemoteWorkspaceState(storage)).resolves.toMatchObject({
      workspace: { workspace: { agent: "opencode-cli" } },
    })
  })

  test("round-trips the explicit Claude Code agent selection", async () => {
    const storage = memoryStorage()
    await writeRemoteWorkspaceState(storage, {
      version: 1,
      serverUrl: "https://remote.example.test",
      workspace: {
        ...(pairing as unknown as Record<string, unknown>),
        workspace: { ...pairing.workspace, agent: "claude-code" },
      } as never,
    })
    await expect(readRemoteWorkspaceState(storage)).resolves.toMatchObject({
      workspace: { workspace: { agent: "claude-code" } },
    })
  })

  test("persists a bounded remote command catalog and version", async () => {
    const state = normalizeRemoteWorkspaceState({
      version: 1,
      serverUrl: "https://remote.example.test",
      commandCatalog: {
        agent: "claude-code",
        version: "2.1.0",
        commands: [
          { name: "review", description: "Review changes" },
          { name: "review", description: "duplicate" },
          { name: "bad name" },
        ],
      },
    })
    expect(state.commandCatalog).toEqual({
      agent: "claude-code",
      version: "2.1.0",
      commands: [{ name: "review", description: "Review changes" }],
    })
  })
})
