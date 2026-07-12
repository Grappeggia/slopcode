import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { Effect } from "effect"
import { LLM, Model } from "@slopcode-ai/llm"
import * as OpenAIChat from "@slopcode-ai/llm/protocols/openai-chat"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { SessionRequestFingerprint } from "@slopcode-ai/core/session/request-fingerprint"

const api = SessionRequestFingerprint as unknown as {
  readonly make: (input: { readonly data: string }) => Effect.Effect<{ readonly fingerprint: (input: unknown) => string }>
  readonly keyPath: (data: string) => { readonly directory: string; readonly file: string }
}

const input = (credential: string) => ({
  request: LLM.request({
    model: Model.make({ id: "fake-model", provider: "fake", route: OpenAIChat.route }),
    messages: [],
    http: { headers: { authorization: `Bearer ${credential}` } },
  }),
  catalog: ModelV2.Info.empty(ProviderV2.ID.make("fake"), ModelV2.ID.make("fake-model")),
  agent: AgentV2.ID.make("build"),
})

describe("SessionRequestFingerprint installation key", () => {
  test("creates one restart-stable key concurrently with private permissions", async () => {
    const data = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-fingerprint-key-"))
    try {
      const services = await Promise.all(Array.from({ length: 8 }, () => Effect.runPromise(api.make({ data }))))
      const hashes = services.map((service) => service.fingerprint(input("a")))
      expect(new Set(hashes)).toHaveLength(1)
      expect(services[0]!.fingerprint(input("b"))).not.toBe(hashes[0])
      const key = api.keyPath(data)
      expect((await fs.stat(key.directory)).mode & 0o777).toBe(0o700)
      expect((await fs.stat(key.file)).mode & 0o777).toBe(0o600)
      expect(JSON.stringify(hashes)).not.toContain("Bearer")
    } finally {
      await fs.rm(data, { recursive: true, force: true })
    }
  })

  test("a copied database without the installation key cannot reproduce credential identity", async () => {
    const first = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-fingerprint-first-"))
    const second = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-fingerprint-second-"))
    try {
      const original = await Effect.runPromise(api.make({ data: first }))
      const copied = await Effect.runPromise(api.make({ data: second }))
      expect(original.fingerprint(input("a"))).not.toBe(copied.fingerprint(input("a")))
      expect((await Effect.runPromise(api.make({ data: first }))).fingerprint(input("a"))).toBe(original.fingerprint(input("a")))
    } finally {
      await Promise.all([fs.rm(first, { recursive: true, force: true }), fs.rm(second, { recursive: true, force: true })])
    }
  })

  test("rejects symlinked key directories and files", async () => {
    const data = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-fingerprint-symlink-"))
    const target = await fs.mkdtemp(path.join(os.tmpdir(), "slopcode-fingerprint-target-"))
    try {
      const key = api.keyPath(data)
      await fs.symlink(target, key.directory)
      await expect(Effect.runPromise(api.make({ data }))).rejects.toBeDefined()
      await fs.rm(key.directory)
      await fs.mkdir(key.directory, { mode: 0o700 })
      await fs.writeFile(path.join(target, "key"), "unsafe")
      await fs.symlink(path.join(target, "key"), key.file)
      await expect(Effect.runPromise(api.make({ data }))).rejects.toBeDefined()
    } finally {
      await Promise.all([fs.rm(data, { recursive: true, force: true }), fs.rm(target, { recursive: true, force: true })])
    }
  })
})
