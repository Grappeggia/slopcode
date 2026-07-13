import { describe, expect, test } from "bun:test"
import { LLM, Model } from "@slopcode-ai/llm"
import * as OpenAIChat from "@slopcode-ai/llm/protocols/openai-chat"
import { AgentV2 } from "@slopcode-ai/core/agent"
import { ModelV2 } from "@slopcode-ai/core/model"
import { ProviderV2 } from "@slopcode-ai/core/provider"
import { SessionRequestFingerprint } from "@slopcode-ai/core/session/request-fingerprint"

describe("SessionRequestFingerprint", () => {
  const catalog = ModelV2.Info.empty(ProviderV2.ID.make("fake"), ModelV2.ID.make("fake-model"))
  const request = LLM.request({
    model: Model.make({ id: "fake-model", provider: "fake", route: OpenAIChat.route }),
    system: "system",
    messages: [{ role: "user", content: [{ type: "text", text: "context" }] }],
    tools: [{ name: "echo", description: "echo", inputSchema: { type: "object", properties: {} } }],
    toolChoice: "auto",
    providerOptions: { fake: { effort: "low" } },
  })
  const service = SessionRequestFingerprint.fromKey(new Uint8Array(32).fill(1))
  const hash = (patch: Partial<SessionRequestFingerprint.Input> = {}) =>
    service.fingerprint({
      request,
      catalog,
      variant: "default",
      agent: AgentV2.ID.make("build"),
      ...patch,
    })

  test("changes for every restart-sensitive request input", () => {
    const base = hash()
    const api = new ModelV2.Info({ ...catalog, api: { ...catalog.api, id: ModelV2.ID.make("other-api") } })
    const mutations = {
      model: hash({
        request: LLM.updateRequest(request, {
          model: Model.make({ id: "other", provider: "fake", route: OpenAIChat.route }),
        }),
      }),
      api: hash({ catalog: api }),
      variant: hash({ variant: "high" }),
      config: hash({ request: LLM.updateRequest(request, { providerOptions: { fake: { effort: "high" } } }) }),
      context: hash({
        request: LLM.updateRequest(request, {
          messages: [{ role: "user", content: [{ type: "text", text: "changed" }] }],
        }),
      }),
      tools: hash({
        request: LLM.updateRequest(request, {
          tools: [{ name: "other", description: "other", inputSchema: { type: "object" } }],
        }),
      }),
      agent: hash({ agent: AgentV2.ID.make("plan") }),
    }

    expect(base).toMatch(/^[a-f0-9]{64}$/)
    expect(new Set([base, ...Object.values(mutations)])).toHaveLength(Object.keys(mutations).length + 1)
  })

  test("does not expose request credentials in its persisted identity", () => {
    const secret = "request-secret-canary"
    const value = hash({
      request: LLM.updateRequest(request, {
        http: { headers: { authorization: `Bearer ${secret}`, "x-api-key": secret } },
      }),
    })
    expect(value).not.toContain(secret)
    expect(value).toMatch(/^[a-f0-9]{64}$/)
  })

  test("changes for credential, header, cookie, and API-key mutations without exposing low-entropy values", () => {
    const identity = (name: string, value: string) =>
      hash({
        request: LLM.updateRequest(request, { http: { headers: { [name]: value } } }),
      })
    for (const name of ["authorization", "cookie", "x-api-key", "credential"]) {
      const left = identity(name, "a")
      const right = identity(name, "b")
      expect(left).not.toBe(right)
      expect(identity(name, "a")).toBe(left)
      const canary = `low-plaintext-${name}-canary`
      expect(identity(name, canary)).not.toContain(canary)
    }
  })
})
