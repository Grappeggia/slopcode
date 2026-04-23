import path from "path"
import { afterEach, describe, expect, mock, spyOn, test } from "bun:test"
import { fileURLToPath } from "url"
import { Instance } from "../../src/project/instance"
import { Session } from "../../src/session"
import { MessageV2 } from "../../src/session/message-v2"
import { SessionPrompt } from "../../src/session/prompt"
import { LLM } from "../../src/session/llm"
import { Log } from "../../src/util/log"
import { tmpdir } from "../fixture/fixture"

Log.init({ print: false })

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((nextResolve, nextReject) => {
    resolve = nextResolve
    reject = nextReject
  })
  return { promise, resolve, reject }
}

function stream(input: { text: string; finishReason: string; wait?: Promise<void> }) {
  return {
    fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "text-start", id: "txt-0" }
      if (input.wait) await input.wait
      if (input.text) {
        yield { type: "text-delta", id: "txt-0", text: input.text }
      }
      yield { type: "text-end", id: "txt-0" }
      yield {
        type: "finish-step",
        finishReason: input.finishReason,
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

function live() {
  return {
    fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "text-start", id: "txt-0" }
      while (true) {
        await Bun.sleep(10)
        yield { type: "text-delta", id: "txt-0", text: "." }
      }
    })(),
  } as unknown as Awaited<ReturnType<typeof LLM.stream>>
}

function title(text: string) {
  return {
    text: Promise.resolve(text),
    fullStream: (async function* () {
      yield { type: "start" }
      yield { type: "finish" }
    })(),
  } as unknown as Awaited<ReturnType<typeof LLM.stream>>
}

async function eventually(check: () => boolean | Promise<boolean>, timeout = 5000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    if (await check()) return
    await Bun.sleep(20)
  }
  throw new Error("condition not met")
}

function text(result: MessageV2.WithParts) {
  return result.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
}

afterEach(() => {
  mock.restore()
})

describe("session.prompt missing file", () => {
  test("does not fail the prompt when a file part is missing", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "openai/gpt-5.2",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        const missing = path.join(tmp.path, "does-not-exist.ts")
        const msg = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          noReply: true,
          parts: [
            { type: "text", text: "please review @does-not-exist.ts" },
            {
              type: "file",
              mime: "text/plain",
              url: `file://${missing}`,
              filename: "does-not-exist.ts",
            },
          ],
        })

        if (msg.info.role !== "user") throw new Error("expected user message")

        const hasFailure = msg.parts.some(
          (part) => part.type === "text" && part.synthetic && part.text.includes("Read tool failed to read"),
        )
        expect(hasFailure).toBe(true)
        await Session.remove(session.id)
      },
    })
  })

  test("keeps stored part order stable when file resolution is async", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        agent: {
          build: {
            model: "openai/gpt-5.2",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})

        const missing = path.join(tmp.path, "still-missing.ts")
        const msg = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          noReply: true,
          parts: [
            {
              type: "file",
              mime: "text/plain",
              url: `file://${missing}`,
              filename: "still-missing.ts",
            },
            { type: "text", text: "after-file" },
          ],
        })

        if (msg.info.role !== "user") throw new Error("expected user message")

        const stored = await MessageV2.get({
          sessionID: session.id,
          messageID: msg.info.id,
        })
        const text = stored.parts.filter((part) => part.type === "text").map((part) => part.text)

        expect(text[0]?.startsWith("Called the Read tool with the following input:")).toBe(true)
        expect(text[1]?.includes("Read tool failed to read")).toBe(true)
        expect(text[2]).toBe("after-file")
        await Session.remove(session.id)
      },
    })
  })
})

describe("session.prompt special characters", () => {
  test("handles filenames with # character", async () => {
    await using tmp = await tmpdir({
      git: true,
      init: async (dir) => {
        await Bun.write(path.join(dir, "file#name.txt"), "special content\n")
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({})
        const template = "Read @file#name.txt"
        const parts = await SessionPrompt.resolvePromptParts(template)
        const fileParts = parts.filter((part) => part.type === "file")

        expect(fileParts.length).toBe(1)
        expect(fileParts[0].filename).toBe("file#name.txt")
        expect(fileParts[0].url).toContain("%23")

        const decodedPath = fileURLToPath(fileParts[0].url)
        expect(decodedPath).toBe(path.join(tmp.path, "file#name.txt"))

        const message = await SessionPrompt.prompt({
          sessionID: session.id,
          parts,
          noReply: true,
        })
        const stored = await MessageV2.get({ sessionID: session.id, messageID: message.info.id })
        const textParts = stored.parts.filter((part) => part.type === "text")
        const hasContent = textParts.some((part) => part.text.includes("special content"))
        expect(hasContent).toBe(true)
        await Session.remove(session.id)
      },
    })
  })
})

describe("session.prompt auto-title", () => {
  test("titles a prompt session from the title model", async () => {
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
        let titles = 0
        spyOn(LLM, "stream").mockImplementation(async (input) => {
          if (input.agent.name === "title") {
            titles++
            return title("Parser failure investigation")
          }
          return stream({ text: "done", finishReason: "stop" })
        })

        const session = await Session.create({})
        await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "debug parser bug" }],
        })
        await eventually(async () => (await Session.get(session.id)).title === "Parser failure investigation")
        expect(titles).toBeGreaterThan(0)
        await Session.remove(session.id)
      },
    })
  })

  test("falls back to prompt text when title generation fails", async () => {
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
        spyOn(LLM, "stream").mockImplementation(async (input) => {
          if (input.agent.name === "title") throw new Error("title provider offline")
          return stream({ text: "done", finishReason: "stop" })
        })

        const session = await Session.create({})
        await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "debug parser failures" }],
        })
        await eventually(async () => (await Session.get(session.id)).title === "debug parser failures")
        await Session.remove(session.id)
      },
    })
  })

  test("titles shell-only sessions from the shell command", async () => {
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
        spyOn(LLM, "stream").mockImplementation(async (input) => {
          if (input.agent.name === "title") {
            return title("Git status check")
          }
          return stream({ text: "done", finishReason: "stop" })
        })

        const session = await Session.create({})
        await SessionPrompt.shell({
          sessionID: session.id,
          agent: "build",
          command: "printf hello",
        })
        await eventually(async () => (await Session.get(session.id)).title === "Git status check", 10000)
        await Session.remove(session.id)
      },
    })
  }, 15_000)
})

describe("session.prompt pause and resume", () => {
  test("persists streamed text deltas before text-end", async () => {
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
        const session = await Session.create({ title: "Streaming Persistence" })
        const gate = deferred<void>()

        spyOn(LLM, "stream").mockImplementation(async () => {
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "text-start", id: "txt-0" }
              yield { type: "text-delta", id: "txt-0", text: "partial reply" }
              await gate.promise
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
        })

        const prompt = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "hello" }],
        })

        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          const assistant = messages.findLast(
            (msg): msg is MessageV2.WithParts & { info: MessageV2.Assistant } => msg.info.role === "assistant",
          )
          return !!assistant && text(assistant) === "partial reply" && !assistant.info.time.completed
        })

        gate.resolve()
        const result = await prompt
        expect(text(result)).toBe("partial reply")
        await Session.remove(session.id)
      },
    })
  })

  test("persists token limit metadata on step-finish parts", async () => {
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
        const session = await Session.create({ title: "Token Limit Metadata" })

        spyOn(LLM, "stream").mockImplementation(async () => {
          return {
            fullStream: (async function* () {
              yield { type: "start" }
              yield { type: "text-start", id: "txt-0" }
              yield { type: "text-delta", id: "txt-0", text: "reply" }
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
            limit() {
              return {
                kind: "tokens" as const,
                limit: 1000,
                remaining: 370,
                consumed: 630,
                consumedPct: 63,
              }
            },
          } as unknown as Awaited<ReturnType<typeof LLM.stream>>
        })

        const result = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "hello" }],
        })

        const finish = result.parts.find((part): part is MessageV2.StepFinishPart => part.type === "step-finish")
        expect(finish?.metadata).toMatchObject({
          slopcode: {
            tokenLimit: {
              kind: "tokens",
              limit: 1000,
              remaining: 370,
              consumed: 630,
              consumedPct: 63,
            },
          },
        })

        await Session.remove(session.id)
      },
    })
  })

  test("pauses the active prompt, preserves the queue, and resumes the paused prompt first", async () => {
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
        const session = await Session.create({ title: "Pause Test" })
        const seen: string[] = []
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls++
          seen.push(JSON.stringify(input.messages))
          if (calls === 1) return live()
          if (calls === 2) return stream({ text: "first resumed done", finishReason: "stop" })
          if (calls === 3) return stream({ text: "second queued done", finishReason: "stop" })
          throw new Error(`unexpected llm call ${calls}`)
        })

        const first = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "first prompt" }],
        })

        await eventually(() => calls === 1)

        const second = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "second prompt" }],
        })

        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          return messages.filter((msg) => msg.info.role === "user").length === 2
        })

        expect(await SessionPrompt.pause(session.id)).toBe(true)
        const error = await first.then(
          () => undefined,
          (cause) => cause as { name?: string },
        )
        expect(error?.name).toBe("MessageAbortedError")

        await Bun.sleep(50)
        expect(calls).toBe(1)

        expect(await SessionPrompt.resume(session.id)).toBe(true)
        const secondResult = await second

        expect(calls).toBe(3)
        expect(seen[1]).toContain("first prompt")
        expect(seen[1]).not.toContain("second prompt")
        expect(seen[2]).toContain("second prompt")

        const messages = await Session.messages({ sessionID: session.id })
        const firstUser = messages.find((msg) => msg.info.role === "user" && text(msg) === "first prompt")
        if (!firstUser || firstUser.info.role !== "user") throw new Error("expected first user prompt")
        const replies = messages.filter(
          (msg): msg is MessageV2.WithParts & { info: MessageV2.Assistant } =>
            msg.info.role === "assistant" && msg.info.parentID === firstUser.info.id,
        )

        expect(replies.some((msg) => msg.info.error?.name === "MessageAbortedError")).toBe(true)
        expect(replies.some((msg) => text(msg) === "first resumed done")).toBe(true)
        expect(text(secondResult)).toBe("second queued done")
      },
    })
  })

  test("injects a replacement prompt ahead of the queue and hides the paused prompt from later context", async () => {
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
        const session = await Session.create({ title: "Inject Test" })
        const seen: string[] = []
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls++
          seen.push(JSON.stringify(input.messages))
          if (calls === 1) return live()
          if (calls === 2) return stream({ text: "third injected done", finishReason: "stop" })
          if (calls === 3) return stream({ text: "second queued done", finishReason: "stop" })
          throw new Error(`unexpected llm call ${calls}`)
        })

        const first = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "first prompt" }],
        })

        await eventually(() => calls === 1)

        const second = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "second prompt" }],
        })

        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          return messages.filter((msg) => msg.info.role === "user").length === 2
        })

        expect(await SessionPrompt.pause(session.id)).toBe(true)
        const error = await first.then(
          () => undefined,
          (cause) => cause as { name?: string },
        )
        expect(error?.name).toBe("MessageAbortedError")

        const third = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          front: true,
          parts: [{ type: "text", text: "third prompt" }],
        })
        const secondResult = await second

        expect(calls).toBe(3)
        expect(text(third)).toBe("third injected done")
        expect(text(secondResult)).toBe("second queued done")
        expect(seen[1]).toContain("third prompt")
        expect(seen[1]).not.toContain("first prompt")
        expect(seen[1]).not.toContain("second prompt")
        expect(seen[2]).toContain("second prompt")
        expect(seen[2]).not.toContain("first prompt")

        const messages = await Session.messages({ sessionID: session.id })
        const firstUser = messages.find((msg) => msg.info.role === "user" && text(msg) === "first prompt")
        if (!firstUser || firstUser.info.role !== "user") throw new Error("expected first user prompt")
        const replies = messages.filter(
          (msg): msg is MessageV2.WithParts & { info: MessageV2.Assistant } =>
            msg.info.role === "assistant" && msg.info.parentID === firstUser.info.id,
        )

        expect(replies.some((msg) => msg.info.error?.name === "MessageAbortedError")).toBe(true)
        expect(replies.some((msg) => text(msg) === "first resumed done")).toBe(false)
      },
    })
  })
})

describe("session.prompt agent variant", () => {
  test("applies agent variant only when using agent model", async () => {
    const prev = process.env.OPENAI_API_KEY
    process.env.OPENAI_API_KEY = "test-openai-key"

    try {
      await using tmp = await tmpdir({
        git: true,
        config: {
          agent: {
            build: {
              model: "openai/gpt-5.2",
              variant: "xhigh",
            },
          },
        },
      })

      await Instance.provide({
        directory: tmp.path,
        fn: async () => {
          const session = await Session.create({})

          const other = await SessionPrompt.prompt({
            sessionID: session.id,
            agent: "build",
            model: { providerID: "slopcode", modelID: "kimi-k2.5-free" },
            noReply: true,
            parts: [{ type: "text", text: "hello" }],
          })
          if (other.info.role !== "user") throw new Error("expected user message")
          expect(other.info.variant).toBeUndefined()

          const match = await SessionPrompt.prompt({
            sessionID: session.id,
            agent: "build",
            noReply: true,
            parts: [{ type: "text", text: "hello again" }],
          })
          if (match.info.role !== "user") throw new Error("expected user message")
          expect(match.info.model).toEqual({ providerID: "openai", modelID: "gpt-5.2" })
          expect(match.info.variant).toBe("xhigh")

          const override = await SessionPrompt.prompt({
            sessionID: session.id,
            agent: "build",
            noReply: true,
            variant: "high",
            parts: [{ type: "text", text: "hello third" }],
          })
          if (override.info.role !== "user") throw new Error("expected user message")
          expect(override.info.variant).toBe("high")

          await Session.remove(session.id)
        },
      })
    } finally {
      if (prev === undefined) delete process.env.OPENAI_API_KEY
      else process.env.OPENAI_API_KEY = prev
    }
  })
})

describe("session.prompt queue mode", () => {
  test("serial waits to process follow-up prompts until current execution completes", async () => {
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
        const session = await Session.create({ title: "Queue Test" })
        const gate = deferred<void>()
        const seen: string[] = []
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls++
          seen.push(JSON.stringify(input.messages))
          if (calls === 1) {
            return stream({ text: "working", finishReason: "tool-calls", wait: gate.promise })
          }
          if (calls === 2) {
            return stream({ text: "first done", finishReason: "stop" })
          }
          if (calls === 3) {
            return stream({ text: "second done", finishReason: "stop" })
          }
          throw new Error(`unexpected llm call ${calls}`)
        })

        const first = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "first prompt" }],
        })

        await eventually(() => calls === 1)

        const second = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "second prompt" }],
        })

        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          return messages.filter((msg) => msg.info.role === "user").length === 2
        })

        gate.resolve()

        const firstResult = await first
        const secondResult = await second

        expect(calls).toBe(3)
        expect(seen[1]).not.toContain("second prompt")
        expect(seen[2]).toContain("second prompt")
        expect(text(firstResult)).toContain("first done")
        expect(text(secondResult)).toContain("second done")
      },
    })
  })

  test("serial does not let concurrent prompt admission inject follow-up prompts", async () => {
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
        const session = await Session.create({ title: "Queue Test" })
        const gate = deferred<void>()
        const seen: string[] = []
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls++
          seen.push(JSON.stringify(input.messages))
          if (calls === 1) {
            return stream({ text: "working", finishReason: "tool-calls", wait: gate.promise })
          }
          if (calls === 2) {
            return stream({ text: "turn one done", finishReason: "stop" })
          }
          if (calls === 3) {
            return stream({ text: "turn two done", finishReason: "stop" })
          }
          throw new Error(`unexpected llm call ${calls}`)
        })

        const first = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "first prompt" }],
        })
        const second = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "second prompt" }],
        })

        await eventually(() => calls === 1)
        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          return messages.filter((msg) => msg.info.role === "user").length === 2
        })
        gate.resolve()

        const firstResult = await first
        const secondResult = await second
        const active = seen[1]?.includes("first prompt") ? "first prompt" : "second prompt"
        const queued = active === "first prompt" ? "second prompt" : "first prompt"

        expect(calls).toBe(3)
        expect(seen[1]).toContain(active)
        expect(seen[1]).not.toContain(queued)
        expect(seen[2]).toContain(queued)
        expect([text(firstResult), text(secondResult)].toSorted()).toEqual(["turn one done", "turn two done"])
      },
    })
  })

  test("injection preserves current follow-up prompt behavior", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        queue_mode: "injection",
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
        const session = await Session.create({ title: "Queue Test" })
        const gate = deferred<void>()
        let calls = 0
        let injected = ""

        spyOn(LLM, "stream").mockImplementation(async (input) => {
          calls++
          if (calls === 1) {
            return stream({ text: "working", finishReason: "tool-calls", wait: gate.promise })
          }
          if (calls === 2) {
            injected = JSON.stringify(input.messages)
            return stream({ text: "combined done", finishReason: "stop" })
          }
          throw new Error(`unexpected llm call ${calls}`)
        })

        const first = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "first prompt" }],
        })

        await eventually(() => calls === 1)

        const second = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "second prompt" }],
        })

        await eventually(async () => {
          const messages = await Session.messages({ sessionID: session.id })
          return messages.filter((msg) => msg.info.role === "user").length === 2
        })

        gate.resolve()

        const firstResult = await first
        const secondResult = await second

        expect(calls).toBe(2)
        expect(injected).toContain("The user sent the following message:")
        expect(injected).toContain("second prompt")
        expect(firstResult.info.id).toBe(secondResult.info.id)
      },
    })
  })

  test("serial prompt runtime is isolated across views on the same session", async () => {
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
        const session = await Session.create({ title: "View Queue Test" })
        const gateA = deferred<void>()
        const gateB = deferred<void>()
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async () => {
          calls++
          if (calls === 1) return stream({ text: "view a done", finishReason: "stop", wait: gateA.promise })
          if (calls === 2) return stream({ text: "view b done", finishReason: "stop", wait: gateB.promise })
          throw new Error(`unexpected llm call ${calls}`)
        })

        let first!: Promise<MessageV2.WithParts>
        let second!: Promise<MessageV2.WithParts>

        await Instance.provide({
          directory: tmp.path,
          viewID: "view-a",
          fn: async () => {
            first = SessionPrompt.prompt({
              sessionID: session.id,
              agent: "build",
              parts: [{ type: "text", text: "first prompt" }],
            })
          },
        })

        await Instance.provide({
          directory: tmp.path,
          viewID: "view-b",
          fn: async () => {
            second = SessionPrompt.prompt({
              sessionID: session.id,
              agent: "build",
              parts: [{ type: "text", text: "second prompt" }],
            })
          },
        })

        await eventually(() => calls === 2)
        gateA.resolve()
        gateB.resolve()

        const firstResult = await first
        const secondResult = await second

        expect(firstResult.info.id).not.toBe(secondResult.info.id)
      },
    })
  })
})

describe("session.prompt shell", () => {
  test("terminates shell commands that exceed the configured timeout", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        shell: {
          timeout_ms: 50,
        },
        agent: {
          build: {
            model: "openai/gpt-5.2",
          },
        },
      },
    })

    await Instance.provide({
      directory: tmp.path,
      fn: async () => {
        const session = await Session.create({ title: "Shell Timeout Test" })
        const result = await SessionPrompt.shell({
          sessionID: session.id,
          agent: "build",
          command: "sleep 5",
        })
        const part = result.parts[0]
        if (part.type !== "tool") throw new Error("expected tool part")
        if (part.state.status !== "completed") throw new Error("expected completed tool state")
        expect(part.state.output).toContain("shell command terminated after exceeding timeout 50 ms")
      },
    })
  })
})

describe("session.prompt turn timeout", () => {
  test("times out the active turn, rejects queued work, and allows recovery", async () => {
    await using tmp = await tmpdir({
      git: true,
      config: {
        queue_mode: "serial",
        session: {
          turn_timeout_ms: 50,
        },
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
        const session = await Session.create({ title: "Turn Timeout Test" })
        let calls = 0

        spyOn(LLM, "stream").mockImplementation(async () => {
          calls++
          if (calls === 1) return live()
          if (calls === 2) return stream({ text: "recovered", finishReason: "stop" })
          throw new Error(`unexpected llm call ${calls}`)
        })

        const first = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "first prompt" }],
        })

        await eventually(() => calls === 1)

        const second = SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "second prompt" }],
        })

        const firstResult = await first
        if (firstResult.info.role !== "assistant") throw new Error("expected assistant reply")
        expect(firstResult.info.error?.name).toBe("MessageTimeoutError")

        const queued = await second.then(
          () => undefined,
          (cause) => cause as { name?: string },
        )
        expect(queued?.name).toBe("MessageTimeoutError")

        const third = await SessionPrompt.prompt({
          sessionID: session.id,
          agent: "build",
          parts: [{ type: "text", text: "third prompt" }],
        })
        expect(text(third)).toBe("recovered")
      },
    })
  })
})
