/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { createSignal, onCleanup, Show } from "solid-js"
import { SideQuestion } from "../../../src/component/dialog-side-question"
import { TuiConfigProvider } from "../../../src/config"
import { ClipboardProvider } from "../../../src/context/clipboard"
import { KVProvider } from "../../../src/context/kv"
import { SDKProvider } from "../../../src/context/sdk"
import { ThemeProvider } from "../../../src/context/theme"
import { SlopcodeKeymapProvider, registerSlopcodeKeymap } from "../../../src/keymap"
import { ToastProvider } from "../../../src/ui/toast"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { eventSource } from "../../fixture/tui-sdk"
import { tmpdir } from "../../fixture/fixture"

async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

function event(value: object) {
  return `event: ${(value as { type: string }).type}\ndata: ${JSON.stringify(value)}\n\n`
}

function stream(events: object[]) {
  return new Response(events.map(event).join(""), {
    headers: { "content-type": "text/event-stream" },
  })
}

function held(events: object[]) {
  let finish!: (...events: object[]) => void
  const response = new Response(
    new ReadableStream({
      start(controller) {
        const encoder = new TextEncoder()
        events.forEach((value) => controller.enqueue(encoder.encode(event(value))))
        finish = (...tail) => {
          tail.forEach((value) => controller.enqueue(encoder.encode(event(value))))
          controller.close()
        }
      },
    }),
    { headers: { "content-type": "text/event-stream" } },
  )
  return { response, finish }
}

async function mount(input: {
  root: string
  question?: string
  fetch: typeof globalThis.fetch
  onClose?: () => void
  write?: (text: string) => Promise<void>
  inactivityTimeout?: number
}) {
  const config = createTuiResolvedConfig()
  const state = path.join(input.root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const off = registerSlopcodeKeymap(keymap, renderer, config)
    const [open, setOpen] = createSignal(true)
    onCleanup(off)

    return (
      <TestTuiContexts directory={input.root} paths={{ state }}>
        <SlopcodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <SDKProvider url="http://test" events={eventSource()} fetch={input.fetch}>
              <ClipboardProvider value={{ write: input.write }}>
                <KVProvider>
                  <ThemeProvider mode="dark">
                    <ToastProvider>
                      <Show when={open()}>
                        <SideQuestion
                          sessionID="ses_test"
                          question={input.question}
                          agent="build"
                          model={{ providerID: "test", modelID: "test-model" }}
                          variant="fast"
                          inactivityTimeout={input.inactivityTimeout}
                          onClose={() => {
                            setOpen(false)
                            input.onClose?.()
                          }}
                        />
                      </Show>
                    </ToastProvider>
                  </ThemeProvider>
                </KVProvider>
              </ClipboardProvider>
            </SDKProvider>
          </TuiConfigProvider>
        </SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  return testRender(() => <Harness />, { width: 90, height: 24, kittyKeyboard: true })
}

test("keeps a transcript and sends exact completed turns on follow-up", async () => {
  await using tmp = await tmpdir()
  const requests: unknown[] = []
  const first = held([
    { type: "status", status: "reading", round: 1 },
    {
      type: "read",
      callID: "read_1",
      path: "notes.txt",
      offset: 1,
      limit: 10,
      lines: 4,
      bytes: 40,
      files: 2,
    },
    {
      type: "usage",
      rounds: 2,
      calls: 1,
      files: 2,
      lines: 4,
      bytes: 40,
      inputTokens: 12,
      outputTokens: 3,
    },
    { type: "text", text: "First answer" },
  ])
  const app = await mount({
    root: tmp.path,
    fetch: (async (request: RequestInfo | URL) => {
      requests.push(await (request instanceof Request ? request : new Request(request)).json())
      if (requests.length === 1) return first.response
      return stream([
        { type: "text", text: requests.length === 2 ? "Second answer" : "Third answer" },
        { type: "done" },
      ])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    app.mockInput.typeText("First question?")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("notes.txt"))
    expect(app.captureCharFrame()).toContain("2/5 files")
    expect(app.captureCharFrame()).toContain("2 rounds")

    first.finish({ type: "done" })
    await wait(() => app.captureCharFrame().includes("First answer"))
    await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "")
    await wait(() => app.captureCharFrame().includes("0/5 files"))
    expect(app.captureCharFrame()).toContain("First question?")

    app.mockInput.typeText("Second question?")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("Second answer"))

    app.mockInput.typeText("Third question?")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("Third answer"))

    expect(requests).toEqual([
      {
        question: "First question?",
        agent: "build",
        model: { providerID: "test", modelID: "test-model" },
        variant: "fast",
      },
      {
        question: "Second question?",
        turns: [{ question: "First question?", answer: "First answer" }],
        agent: "build",
        model: { providerID: "test", modelID: "test-model" },
        variant: "fast",
      },
      {
        question: "Third question?",
        turns: [
          { question: "First question?", answer: "First answer" },
          { question: "Second question?", answer: "Second answer" },
        ],
        agent: "build",
        model: { providerID: "test", modelID: "test-model" },
        variant: "fast",
      },
    ])
    expect(app.captureCharFrame()).toContain("First answer")
    expect(app.captureCharFrame()).toContain("Third question?")
  } finally {
    app.renderer.destroy()
  }
})

test("retries only the failed current question and keeps completed turns", async () => {
  await using tmp = await tmpdir()
  const requests: Array<Record<string, unknown>> = []
  const app = await mount({
    root: tmp.path,
    question: "Completed question",
    fetch: (async (request: RequestInfo | URL) => {
      requests.push(
        (await (request instanceof Request ? request : new Request(request)).json()) as Record<string, unknown>,
      )
      if (requests.length === 1) return stream([{ type: "text", text: "Completed answer" }, { type: "done" }])
      if (requests.length === 2)
        return stream([
          { type: "text", text: "Partial answer" },
          { type: "error", message: "temporary failure" },
          { type: "done" },
        ])
      return stream([{ type: "text", text: "Recovered answer" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("Completed answer"))
    app.mockInput.typeText("Retry this question")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("temporary failure"))
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("Recovered answer"))

    expect(requests.slice(1).map((item) => item.turns)).toEqual([
      [{ question: "Completed question", answer: "Completed answer" }],
      [{ question: "Completed question", answer: "Completed answer" }],
    ])
    expect(requests[2]?.question).toBe("Retry this question")
    expect(JSON.stringify(requests[2])).not.toContain("Partial answer")
  } finally {
    app.renderer.destroy()
  }
})

test("resets inactivity timeout on activity and fails a stalled stream", async () => {
  await using tmp = await tmpdir()
  const app = await mount({
    root: tmp.path,
    question: "Keep alive",
    inactivityTimeout: 80,
    fetch: (async () => {
      const encoder = new TextEncoder()
      return new Response(
        new ReadableStream({
          start(controller) {
            setTimeout(
              () => controller.enqueue(encoder.encode(event({ type: "status", status: "reading", round: 1 }))),
              20,
            )
            setTimeout(
              () =>
                controller.enqueue(
                  encoder.encode(
                    event({
                      type: "read",
                      callID: "read_1",
                      path: "active.txt",
                      offset: 1,
                      limit: 1,
                      lines: 1,
                      bytes: 4,
                      files: 1,
                    }),
                  ),
                ),
              70,
            )
          },
        }),
        { headers: { "content-type": "text/event-stream" } },
      )
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("active.txt"))
    await Bun.sleep(40)
    expect(app.captureCharFrame()).not.toContain("timed out")
    await wait(() => app.captureCharFrame().includes("timed out"))
    expect(app.captureCharFrame()).toContain("failed")
  } finally {
    app.renderer.destroy()
  }
})

test("treats a stream ending without done as retryable and excludes its partial answer", async () => {
  await using tmp = await tmpdir()
  const requests: Array<Record<string, unknown>> = []
  const app = await mount({
    root: tmp.path,
    question: "Missing done",
    fetch: (async (request: RequestInfo | URL) => {
      requests.push(
        (await (request instanceof Request ? request : new Request(request)).json()) as Record<string, unknown>,
      )
      if (requests.length === 1) return stream([{ type: "text", text: "Unfinished answer" }])
      return stream([{ type: "text", text: "Finished answer" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("ended before done"))
    expect(app.captureCharFrame()).toContain("failed")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("Finished answer"))
    expect(requests).toHaveLength(2)
    expect(requests[1]?.turns).toBeUndefined()
    expect(JSON.stringify(requests[1])).not.toContain("Unfinished answer")
  } finally {
    app.renderer.destroy()
  }
})

test("copies the latest completed answer without disabling the composer", async () => {
  await using tmp = await tmpdir()
  const copied: string[] = []
  let requests = 0
  const app = await mount({
    root: tmp.path,
    question: "Copy question",
    write: async (text) => void copied.push(text),
    fetch: (async () => {
      requests++
      return stream([{ type: "text", text: "Copy this answer" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("Copy this answer"))
    app.mockInput.pressKey("c", { ctrl: true })
    await wait(() => copied.length === 1)
    expect(copied).toEqual(["Copy this answer"])

    app.mockInput.typeText("composer still works")
    app.mockInput.pressEnter()
    await wait(() => requests === 2)
  } finally {
    app.renderer.destroy()
  }
})

test("closing aborts in-flight work and discards the panel", async () => {
  await using tmp = await tmpdir()
  let aborted = false
  let closed = 0
  let started!: () => void
  const pending = new Promise<void>((resolve) => (started = resolve))
  const app = await mount({
    root: tmp.path,
    question: "Slow question",
    onClose: () => closed++,
    fetch: (async (request: RequestInfo | URL) => {
      const signal = request instanceof Request ? request.signal : undefined
      signal?.addEventListener("abort", () => (aborted = true))
      started()
      return new Promise<Response>(() => {})
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await pending
    app.mockInput.pressEscape()
    await wait(() => aborted)
    expect(closed).toBe(1)
    expect(app.captureCharFrame()).not.toContain("Side question")
  } finally {
    app.renderer.destroy()
  }
})
