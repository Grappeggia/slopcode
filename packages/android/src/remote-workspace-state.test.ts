import { describe, expect, test } from "bun:test"
import type { AndroidSecureStorage } from "./types"
import {
  readRemoteWorkspace,
  normalizeHttpsUrl,
  normalizeRemoteWorkspaceState,
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
    expect(raw).not.toContain("capability")
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

    await expect(readRemoteWorkspace(storage)).resolves.toEqual({ state: { version: 1 }, secret: undefined })
    expect(storage.values.size).toBe(0)
  })

  test("removes empty state instead of persisting blank shells", async () => {
    const storage = memoryStorage()

    await writeRemoteWorkspaceState(storage, { version: 1 })
    await writeRemoteWorkspaceSecret(storage)

    expect(storage.values.size).toBe(0)
  })
})
