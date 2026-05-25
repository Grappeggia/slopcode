import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { LLM } from "../../src/session/llm"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

type SessionInfo = {
  id: string
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function stream(input: { text: string; wait?: Promise<void>; abort?: AbortSignal }) {
  return {
    fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "text-start", id: "txt-0" }
      if (input.wait) {
        await Promise.race([
          input.wait,
          new Promise<void>((resolve) => {
            input.abort?.addEventListener("abort", () => resolve(), { once: true })
          }),
        ])
      }
      input.abort?.throwIfAborted()
      yield { type: "text-delta", id: "txt-0", text: input.text }
      yield { type: "text-end", id: "txt-0" }
      yield {
        type: "finish-step",
        finishReason: "stop",
        usage: {
          inputTokens: 0,
          outputTokens: 0,
          totalTokens: 0,
          reasoningTokens: 0,
          cachedInputTokens: 0,
        },
        providerMetadata: {},
      }
      yield { type: "finish" }
    })(),
  } as unknown as Awaited<ReturnType<typeof LLM.stream>>
}

async function eventually(check: () => boolean | Promise<boolean>, timeout = 10000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(25)
  }
  throw new Error("condition not met")
}

afterEach(() => {
  mock.restore()
})

describe("session prompt abort e2e", () => {
  test("sync prompt resolves to interrupted message when aborted", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "slopcode/kimi-k2.5-free",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const app = Server.App()
        const create = await app.request("/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "Abort Prompt" }),
        })
        expect(create.status).toBe(200)
        const session = (await create.json()) as SessionInfo

        const gate = deferred<void>()
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls += 1
          return stream({ text: "never", wait: gate.promise, abort: input.abort })
        })

        const messageID = "msg_abort"
        const pending = app.request(`/session/${session.id}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: "build",
            messageID,
            parts: [{ type: "text", text: "interrupt me" }],
          }),
        })

        await eventually(() => calls === 1)

        const abort = await app.request(`/session/${session.id}/abort`, {
          method: "POST",
        })
        expect(abort.status).toBe(200)

        const response = await pending
        expect(response.status).toBe(200)

        const text = await response.text()
        expect(text).not.toContain("DOMException")
        expect(text).not.toContain('"name":"AbortError"')

        const message = JSON.parse(text) as {
          info: {
            parentID: string
            error?: {
              name: string
            }
          }
        }

        expect(message.info.parentID).toBe(messageID)
        expect(message.info.error?.name).toBe("MessageAbortedError")
      },
    })
  })
})
