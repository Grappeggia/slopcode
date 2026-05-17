import { describe, expect, test } from "bun:test"
import { Identifier } from "../../src/id/id"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { Session } from "../../src/session"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

type SessionInfo = {
  id: string
}

async function eventually(check: () => boolean | Promise<boolean>, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(25)
  }
  throw new Error("condition not met")
}

describe("session prompt async failure", () => {
  test("records a terminal assistant error when async prompt admission fails", async () => {
    await using tmp = await tmpdir({ git: true })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const app = Server.App()
        const create = await app.request("/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Async Failure" }),
        })
        expect(create.status).toBe(200)
        const session = (await create.json()) as SessionInfo
        const messageID = Identifier.ascending("message")

        const response = await app.request(`/session/${session.id}/prompt_async`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messageID,
            agent: "missing-agent",
            model: {
              providerID: "slopcode",
              modelID: "kimi-k2.5-free",
            },
            parts: [{ type: "text", text: "this should fail visibly" }],
          }),
        })
        expect(response.status).toBe(204)

        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          return messages.some(
            (message) =>
              message.info.role === "assistant" &&
              message.info.parentID === messageID &&
              !!message.info.time.completed &&
              !!message.info.error,
          )
        })

        const messages = await Session.messages({ sessionID: session.id })
        const assistant = messages.find(
          (message) => message.info.role === "assistant" && message.info.parentID === messageID,
        )
        if (!assistant || assistant.info.role !== "assistant") throw new Error("expected assistant error")
        expect(assistant.info.finish).toBe("error")
        expect(assistant.info.error).toBeDefined()
      },
    })
  })
})
