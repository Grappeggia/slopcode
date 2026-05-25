import { afterEach, beforeAll, describe, expect, mock, test } from "bun:test"

let createTerminalManagerForTest: typeof import("./terminal").createTerminalManagerForTest
let getWorkspaceTerminalCacheKey: (dir: string) => string
let getTerminalCacheKey: (dir: string, sessionID?: string) => string
let getLegacyTerminalStorageKeys: (dir: string, legacySessionID?: string) => string[]

beforeAll(async () => {
  mock.module("@solidjs/router", () => ({
    useNavigate: () => () => undefined,
    useParams: () => ({}),
  }))
  mock.module("@slopcode-ai/ui/context", () => ({
    createSimpleContext: () => ({
      use: () => undefined,
      provider: () => undefined,
    }),
  }))
  mock.module("@/context/platform", () => ({
    usePlatform: () => ({ platform: "web" }),
  }))
  mock.module("@/utils/persist", () => ({
    Persist: {
      workspace: (dir: string, key: string, legacy?: string[]) => ({ storage: `workspace:${dir}`, key, legacy }),
      session: (dir: string, session: string, key: string, legacy?: string[]) => ({
        storage: `workspace:${dir}`,
        key: `session:${session}:${key}`,
        legacy,
      }),
      scoped: (dir: string, session: string | undefined, key: string, legacy?: string[]) => {
        if (session) return { storage: `workspace:${dir}`, key: `session:${session}:${key}`, legacy }
        return { storage: `workspace:${dir}`, key, legacy }
      },
    },
    persisted: <T>(_: unknown, store: [T, (value: unknown) => void]) => [store[0], store[1], null, () => true] as const,
    removePersisted: () => {},
  }))
  const mod = await import("./terminal")
  createTerminalManagerForTest = mod.createTerminalManagerForTest
  getWorkspaceTerminalCacheKey = mod.getWorkspaceTerminalCacheKey
  getTerminalCacheKey = mod.getTerminalCacheKey
  getLegacyTerminalStorageKeys = mod.getLegacyTerminalStorageKeys
})

afterEach(() => {
  window.localStorage.clear()
})

describe("getWorkspaceTerminalCacheKey", () => {
  test("uses workspace-only directory cache key", () => {
    expect(getWorkspaceTerminalCacheKey("/repo")).toBe("/repo:__workspace__")
  })
})

describe("getTerminalCacheKey", () => {
  test("uses workspace cache when session id is missing", () => {
    expect(getTerminalCacheKey("/repo")).toBe("/repo:__workspace__")
  })

  test("uses session cache when session id exists", () => {
    expect(getTerminalCacheKey("/repo", "ses_123")).toBe("/repo:session:ses_123")
  })
})

describe("getLegacyTerminalStorageKeys", () => {
  test("keeps workspace storage path when no legacy session id", () => {
    expect(getLegacyTerminalStorageKeys("/repo")).toEqual(["/repo/terminal.v1"])
  })

  test("keeps legacy session storage path isolated", () => {
    expect(getLegacyTerminalStorageKeys("/repo", "session-123")).toEqual(["/repo/terminal/session-123.v1"])
  })
})

describe("session terminal visibility", () => {
  test("switching sessions surfaces only ptys owned by the active session", async () => {
    const handlers = new Map<string, Set<() => void>>()
    const sessions: Record<string, { id: string; title: string; sessionID?: string }[]> = {
      ses_a: [{ id: "pty_a", title: "Terminal 1", sessionID: "ses_a" }],
      ses_b: [{ id: "pty_b", title: "Terminal 1", sessionID: "ses_b" }],
    }
    const sdk = {
      client: {
        pty: {
          list: ({ sessionID }: { sessionID?: string }) =>
            Promise.resolve({ data: sessionID ? (sessions[sessionID] ?? []) : [] }),
          create: () => Promise.resolve({ data: undefined }),
          update: () => Promise.resolve({ data: undefined }),
          remove: () => Promise.resolve({ data: true }),
        },
      },
      event: {
        on(type: string, fn: () => void) {
          const set = handlers.get(type) ?? new Set<() => void>()
          set.add(fn)
          handlers.set(type, set)
          return () => set.delete(fn)
        },
      },
    } as any

    const manager = createTerminalManagerForTest(sdk)
    try {
      const a = manager.session("/repo", "ses_a", "ses_a")
      await a.sync()
      expect(a.snapshot().all.map((pty) => pty.id)).toEqual(["pty_a"])
      expect(manager.cacheKeys()).toEqual(["/repo:session:ses_a"])

      const b = manager.session("/repo", "ses_b", "ses_b")
      await b.sync()
      expect(b.snapshot().all.map((pty) => pty.id)).toEqual(["pty_b"])
      expect(a.snapshot().all.map((pty) => pty.id)).toEqual(["pty_a"])
      expect(manager.cacheKeys()).toEqual(["/repo:session:ses_a", "/repo:session:ses_b"])

      sessions.ses_b = []
      handlers.get("pty.deleted")?.forEach((fn) => fn())
      await Promise.resolve()
      await Promise.resolve()
      expect(b.snapshot().all).toEqual([])
      expect(a.snapshot().all.map((pty) => pty.id)).toEqual(["pty_a"])
    } finally {
      manager.dispose()
    }
  })
})
