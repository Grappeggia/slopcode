import { describe, expect, test } from "bun:test"
import { SessionAutocomplete } from "../../src/session/autocomplete"
import { Session } from "../../src/session"
import type { MessageV2 } from "../../src/session/message-v2"
import { Instance } from "../../src/project/instance"
import { Identifier } from "../../src/id/id"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

async function user(input: { sessionID: string; text: string; system?: string }) {
  const info = (await Session.updateMessage({
    id: Identifier.ascending("message"),
    role: "user",
    sessionID: input.sessionID,
    agent: "build",
    model: {
      providerID: "openai",
      modelID: "gpt-4",
    },
    system: input.system,
    time: {
      created: Date.now(),
    },
  })) as MessageV2.User

  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: info.id,
    sessionID: input.sessionID,
    type: "text",
    text: input.text,
  })

  return info
}

async function assistant(input: { sessionID: string; parentID: string; text: string }) {
  const info: MessageV2.Assistant = {
    id: Identifier.ascending("message"),
    role: "assistant",
    sessionID: input.sessionID,
    mode: "default",
    agent: "build",
    path: {
      cwd: "/tmp",
      root: "/tmp",
    },
    cost: 0,
    tokens: {
      output: 0,
      input: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    modelID: "gpt-4",
    providerID: "openai",
    parentID: input.parentID,
    time: {
      created: Date.now(),
    },
    finish: "stop",
  }

  await Session.updateMessage(info)
  await Session.updatePart({
    id: Identifier.ascending("part"),
    messageID: info.id,
    sessionID: input.sessionID,
    type: "text",
    text: input.text,
  })

  return info
}

describe("SessionAutocomplete", () => {
  test("checks request eligibility with whitespace rules", () => {
    expect(SessionAutocomplete.request("   ", 1)).toBe(false)
    expect(SessionAutocomplete.request("ab  ", 4)).toBe(true)
    expect(SessionAutocomplete.request("ab  ", 5)).toBe(false)
  })

  test("adds spacing only when needed", () => {
    expect(SessionAutocomplete.spacing("hello", "world")).toBe(" world")
    expect(SessionAutocomplete.spacing("hello ", "world")).toBe("world")
    expect(SessionAutocomplete.spacing("hello", " world")).toBe(" world")
    expect(SessionAutocomplete.spacing("   ", "world")).toBe("world")
  })

  test("builds current-session context with latest-first prompts and recent assistant responses", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const one = await user({ sessionID: session.id, text: "first prompt", system: "custom system" })
        await assistant({ sessionID: session.id, parentID: one.id, text: "first response" })
        const two = await user({ sessionID: session.id, text: "second prompt" })
        await assistant({ sessionID: session.id, parentID: two.id, text: "second response" })

        const messages = await Session.messages({ sessionID: session.id })
        const context = SessionAutocomplete.context({ messages, related: "" })

        expect(context.system).toBe("custom system")
        expect(context.prompt).toContain("first prompt")
        expect(context.prompt).toContain("second prompt")
        expect(context.prompt.indexOf("second prompt")).toBeLessThan(context.prompt.indexOf("first prompt"))
        expect(context.prompt).toContain("second response")
        expect(context.prompt).toContain("first response")
      },
    })
  })

  test("warms related-session prompts once and enforces limits", async () => {
    await using tmp = await tmpdir({ git: true })
    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const current = await Session.create({ title: "current" })

        const related = [] as Session.Info[]
        for (let i = 0; i < 4; i++) {
          related.push(await Session.create({ title: `related-${i}` }))
        }

        for (const session of related) {
          for (let i = 0; i < 5; i++) {
            await user({ sessionID: session.id, text: `${session.title}-prompt-${i}` })
          }
        }

        const first = await SessionAutocomplete.warm(current.id)
        expect((first.match(/<SESSION index=/g) ?? []).length).toBe(3)
        expect((first.match(/<PROMPT index=/g) ?? []).length).toBe(12)

        await user({ sessionID: related[0].id, text: "new-prompt-after-cache" })

        const second = await SessionAutocomplete.warm(current.id)
        expect(second).toBe(first)
        expect(second).not.toContain("new-prompt-after-cache")
      },
    })
  })
})
