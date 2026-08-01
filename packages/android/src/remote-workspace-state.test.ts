import { describe, expect, test } from "bun:test"
import type { AndroidSecureStorage } from "./types"
import { readRemoteWorkspaceState, writeRemoteWorkspaceState } from "./remote-workspace-state"

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
    length: async (namespace) => (await Promise.resolve(0), [...values.keys()].filter((item) => item.startsWith(`${namespace}:`)).length),
  }
}

describe("remote workspace state persistence", () => {
  test("round-trips a persisted remote workspace selection", async () => {
    const storage = memoryStorage()

    await writeRemoteWorkspaceState(storage, {
      version: 1,
      serverUrl: "https://remote.example.test",
      pairing,
      savedAt: "2026-08-01T00:00:00.000Z",
    })

    await expect(readRemoteWorkspaceState(storage)).resolves.toEqual({
      version: 1,
      serverUrl: "https://remote.example.test",
      pairing,
      savedAt: "2026-08-01T00:00:00.000Z",
    })
  })

  test("drops invalid payloads without throwing", async () => {
    const storage = memoryStorage()
    await storage.setItem(
      "slopcode.android.remote.dat",
      "remote.workspace",
      JSON.stringify({
        version: 99,
        serverUrl: " ",
        pairing: { nope: true },
      }),
    )

    await expect(readRemoteWorkspaceState(storage)).resolves.toEqual({ version: 1 })
  })

  test("removes empty state instead of persisting blank shells", async () => {
    const storage = memoryStorage()

    await writeRemoteWorkspaceState(storage, { version: 1 })

    expect(storage.values.size).toBe(0)
  })
})
