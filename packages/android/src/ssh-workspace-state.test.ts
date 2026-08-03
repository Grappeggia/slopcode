import { describe, expect, test } from "bun:test"
import { readSshWorkspace, normalizeSshWorkspace, writeSshWorkspace } from "./ssh-workspace-state"

function storage() {
  const values = new Map<string, string>()
  return {
    getItem: async (namespace: string, key: string) => values.get(`${namespace}:${key}`) ?? null,
    setItem: async (namespace: string, key: string, value: string) => void values.set(`${namespace}:${key}`, value),
    removeItem: async (namespace: string, key: string) => void values.delete(`${namespace}:${key}`),
    clear: async () => void values.clear(),
    keys: async () => [],
    length: async () => values.size,
  }
}

const state = {
  version: 1 as const,
  target: "marcos@mac.example.com",
  profile: "marcos@mac.example.com:22",
  host: "mac.example.com",
  port: 22,
  username: "marcos",
  directory: "/Users/marcos/Projects/slopcode",
  agent: "codex-cli" as const,
  recentTargets: ["marcos@mac.example.com"],
  recentFolders: ["/Users/marcos/Projects/slopcode"],
}

describe("direct SSH workspace state", () => {
  test("round-trips only non-secret connection state through secure storage", async () => {
    const secure = storage()
    await writeSshWorkspace(secure, state)
    const next = await readSshWorkspace(secure)
    expect(next).toMatchObject(state)
    expect(JSON.stringify(next)).not.toContain("password")
    expect(JSON.stringify(next)).not.toContain("privateKey")
  })

  test("fails closed on invalid agent, path, or target", () => {
    expect(normalizeSshWorkspace({ ...state, agent: "shell" })).toBeUndefined()
    expect(normalizeSshWorkspace({ ...state, directory: "/tmp/../etc" })).toBeUndefined()
    expect(normalizeSshWorkspace({ ...state, target: "marcos@host;bad" })).toBeUndefined()
  })
})
