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

function stream(input: { text: string; finishReason?: string; wait?: Promise<void> }) {
  return {
    fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "text-start", id: "txt-0" }
      if (input.wait) await input.wait
      yield { type: "text-delta", id: "txt-0", text: input.text }
      yield { type: "text-end", id: "txt-0" }
      yield {
        type: "finish-step",
        finishReason: input.finishReason ?? "stop",
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

describe("session serial drain e2e", () => {
  test(
    "drains five queued prompts one at a time after the active prompt completes",
    async () => {
      await using tmp = await tmpdir({
        git: true,
        config: {
          queue_mode: "serial",
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
            body: JSON.stringify({ title: "Serial Queue Drain" }),
          })
          expect(create.status).toBe(200)
          const session = (await create.json()) as SessionInfo

          const gate = deferred<void>()
          const calls: string[] = []

          spyOn(LLM, "stream").mockImplementation(async (input) => {
            calls.push(JSON.stringify(input.messages))
            if (calls.length === 1) {
              return stream({ text: "working", finishReason: "tool-calls", wait: gate.promise })
            }
            if (calls.length === 2) {
              return stream({ text: "first done" })
            }
            return stream({ text: `queued done ${calls.length - 2}` })
          })

          const first = await app.request(`/session/${session.id}/prompt_async`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              agent: "build",
              parts: [{ type: "text", text: "initial" }],
            }),
          })
          expect(first.status).toBe(204)

          await eventually(() => calls.length === 1)

          for (let i = 1; i <= 5; i++) {
            const response = await app.request(`/session/${session.id}/prompt_async`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                agent: "build",
                parts: [{ type: "text", text: `queued ${i}` }],
              }),
            })
            expect(response.status).toBe(204)
          }

          gate.resolve()

          await eventually(() => calls.length >= 7, 10000)

          expect(calls[1]).not.toMatch(/queued [1-5]/)
          for (let i = 1; i <= 5; i++) {
            const input = calls[i + 1] ?? ""
            expect(input).toContain(`queued ${i}`)
            for (let later = i + 1; later <= 5; later++) {
              expect(input).not.toContain(`queued ${later}`)
            }
          }
        },
      })
    },
    15_000,
  )
})
