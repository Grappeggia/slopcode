import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import z from "zod"
import { Instance } from "../../src/project/instance"
import { Server } from "../../src/server/server"
import { LLM } from "../../src/session/llm"
import { TaskTool } from "../../src/tool/task"
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

describe("session serial queue e2e", () => {
  test("keeps queued prompts blocked until active subtasks are finished", async () => {
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
          body: JSON.stringify({ title: "Serial Queue E2E" }),
        })
        expect(create.status).toBe(200)
        const session = (await create.json()) as SessionInfo

        const gate = deferred<void>()
        const tasks: string[] = []
        const calls: Array<{ input: string; taskRuns: number }> = []

        spyOn(TaskTool, "init").mockImplementation(async () => {
          return {
            description: "mock task",
            parameters: z.any(),
            async execute(args: { description: string }) {
              tasks.push(args.description)
              if (tasks.length === 1) await gate.promise
              return {
                title: args.description,
                metadata: {},
                output: `done ${args.description}`,
              }
            },
          } as any
        })

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls.push({ input: JSON.stringify(input.messages), taskRuns: tasks.length })
          return stream({ text: `turn ${calls.length}` })
        })

        const first = await app.request(`/session/${session.id}/prompt_async`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agent: "build",
            parts: [
              { type: "text", text: "start session" },
              {
                type: "subtask",
                prompt: "subtask one",
                description: "subtask one",
                agent: "general",
              },
              {
                type: "subtask",
                prompt: "subtask two",
                description: "subtask two",
                agent: "general",
              },
            ],
          }),
        })
        expect(first.status).toBe(204)

        await eventually(() => tasks.length === 1)

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

        await eventually(() => tasks.length >= 2, 10000)
        await eventually(() => calls.length >= 3, 10000)

        const reproduced = calls.some((item) => item.taskRuns < 2 && /queued [1-5]/.test(item.input))

        expect(reproduced).toBe(false)
      },
    })
  })
})
