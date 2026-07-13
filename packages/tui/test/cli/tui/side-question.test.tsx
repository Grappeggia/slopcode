/** @jsxImportSource @opentui/solid */
import { ScrollBoxRenderable, TextareaRenderable, type Renderable } from "@opentui/core"
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
  width?: number
  height?: number
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

  return testRender(() => <Harness />, {
    width: input.width ?? 90,
    height: input.height ?? 24,
    kittyKeyboard: true,
  })
}

function findScroll(root: Renderable): ScrollBoxRenderable | undefined {
  if (root instanceof ScrollBoxRenderable) return root
  return root.getChildren().map(findScroll).find(Boolean)
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

test("keeps all visible turns while carrying only the newest 32 on the 33rd follow-up", async () => {
  await using tmp = await tmpdir()
  const requests: Array<Record<string, unknown>> = []
  const app = await mount({
    root: tmp.path,
    fetch: (async (request: RequestInfo | URL) => {
      requests.push(
        (await (request instanceof Request ? request : new Request(request)).json()) as Record<string, unknown>,
      )
      return stream([{ type: "text", text: `Answer ${requests.length}` }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    for (let index = 1; index <= 34; index++) {
      app.mockInput.typeText(`Question ${index}`)
      app.mockInput.pressEnter()
      await wait(() => requests.length === index)
      await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "")
    }

    const turns = requests[33]?.turns as Array<{ question: string; answer: string }>
    expect(turns).toHaveLength(32)
    expect(turns[0]).toEqual({ question: "Question 2", answer: "Answer 2" })
    expect(turns.at(-1)).toEqual({ question: "Question 33", answer: "Answer 33" })
    await wait(() => app.captureCharFrame().includes("older turn omitted"))
    const scroll = findScroll(app.renderer.root)
    if (!scroll) throw new Error("expected side transcript scrollbox")
    scroll.scrollTo(0)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Question 1")
  } finally {
    app.renderer.destroy()
  }
})

test("bounds an oversized completed answer in carried context without hiding the transcript", async () => {
  await using tmp = await tmpdir()
  const requests: Array<Record<string, unknown>> = []
  const answer = `start-${"x".repeat(64_000)}-visible-end`
  const next = held([])
  const app = await mount({
    root: tmp.path,
    fetch: (async (request: RequestInfo | URL) => {
      requests.push(
        (await (request instanceof Request ? request : new Request(request)).json()) as Record<string, unknown>,
      )
      if (requests.length === 1) return stream([{ type: "text", text: answer }, { type: "done" }])
      return next.response
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    app.mockInput.typeText("First")
    app.mockInput.pressEnter()
    await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "")
    const scroll = findScroll(app.renderer.root)
    if (!scroll) throw new Error("expected side transcript scrollbox")
    scroll.scrollTo(scroll.scrollHeight)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("visible-end")
    app.mockInput.typeText("Second")
    app.mockInput.pressEnter()
    await wait(() => requests.length === 2)

    const turns = requests[1]?.turns as Array<{ question: string; answer: string }>
    expect(turns[0]?.answer).toHaveLength(64_000)
    expect(turns[0]?.answer.startsWith("start-")).toBe(true)
    await wait(() => app.captureCharFrame().includes("oversized answer truncated"))
    next.finish({ type: "text", text: "next answer" }, { type: "done" })
  } finally {
    app.renderer.destroy()
  }
})

test("normalizes leading whitespace before bounding a carried answer", async () => {
  await using tmp = await tmpdir()
  const requests: Array<Record<string, unknown>> = []
  const copied: string[] = []
  const answer = `${" ".repeat(64_001)}visible answer`
  const recovery = held([])
  const app = await mount({
    root: tmp.path,
    write: async (text) => void copied.push(text),
    fetch: (async (request: RequestInfo | URL) => {
      requests.push(
        (await (request instanceof Request ? request : new Request(request)).json()) as Record<string, unknown>,
      )
      if (requests.length === 1) return stream([{ type: "text", text: answer }, { type: "done" }])
      return recovery.response
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    app.mockInput.typeText("First")
    app.mockInput.pressEnter()
    await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "", 5000)
    app.mockInput.pressKey("c", { ctrl: true })
    await wait(() => copied.length === 1)
    expect(copied[0]).toBe(answer)

    app.mockInput.typeText("Second")
    app.mockInput.pressEnter()
    await wait(() => requests.length === 2)
    const turns = requests[1]?.turns as Array<{ question: string; answer: string }>
    expect(turns[0]?.answer).toBe("visible answer")
    expect(turns[0]?.answer.length).toBeLessThanOrEqual(64_000)
    recovery.finish({ type: "text", text: "Recovered follow-up" }, { type: "done" })
    await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "", 5000)
    app.mockInput.pressKey("c", { ctrl: true })
    await wait(() => copied.length === 2)
    expect(copied[1]).toBe("Recovered follow-up")
  } finally {
    app.renderer.destroy()
  }
})

test("rejects an oversized current question locally and recovers without a doomed request", async () => {
  await using tmp = await tmpdir()
  let requests = 0
  const app = await mount({
    root: tmp.path,
    fetch: (async () => {
      requests++
      return stream([{ type: "text", text: "Recovered" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    const editor = app.renderer.currentFocusedEditor as TextareaRenderable
    editor.setText("x".repeat(64_001))
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("cannot exceed 64,000 characters"))
    expect(requests).toBe(0)

    editor.setText("short retry")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("Recovered"))
    expect(requests).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})

test("scrolls an overflowing completed transcript with up and down", async () => {
  await using tmp = await tmpdir()
  let requests = 0
  const app = await mount({
    root: tmp.path,
    fetch: (async () => {
      requests++
      return stream([
        { type: "text", text: `Answer ${requests}: ${"long completed transcript content ".repeat(5)}` },
        { type: "done" },
      ])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    for (let index = 1; index <= 6; index++) {
      await app.mockInput.typeText(`Question ${index}?`)
      app.mockInput.pressEnter()
      await wait(() => requests === index)
      await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "")
    }

    const scroll = findScroll(app.renderer.root)
    if (!scroll) throw new Error("expected side transcript scrollbox")
    await wait(() => scroll.scrollHeight > scroll.viewport.height && scroll.scrollTop > 0)
    const bottom = scroll.scrollTop

    app.mockInput.pressArrow("up")
    await app.renderOnce()
    expect(scroll.scrollTop).toBeLessThan(bottom)

    app.mockInput.pressArrow("down")
    await app.renderOnce()
    expect(scroll.scrollTop).toBe(bottom)
    expect(app.captureCharFrame()).toContain("up/down scroll")
  } finally {
    app.renderer.destroy()
  }
})

test("keeps the per-question file count monotonic across rounds and resets it", async () => {
  await using tmp = await tmpdir()
  const first = held([
    { type: "status", status: "reading", round: 1 },
    {
      type: "read",
      callID: "read_1",
      path: "first.txt",
      offset: 1,
      limit: 10,
      lines: 1,
      bytes: 4,
      files: 1,
    },
    {
      type: "usage",
      rounds: 1,
      calls: 1,
      files: 1,
      lines: 1,
      bytes: 4,
      inputTokens: 5,
      outputTokens: 1,
    },
    { type: "status", status: "generating", round: 2 },
    { type: "status", status: "reading", round: 2 },
    {
      type: "read",
      callID: "read_2",
      path: "third.txt",
      offset: 1,
      limit: 10,
      lines: 1,
      bytes: 4,
      files: 3,
    },
    { type: "text", text: "Round two answer" },
  ])
  const second = held([{ type: "status", status: "generating", round: 1 }])
  let requests = 0
  const app = await mount({
    root: tmp.path,
    question: "Read several files",
    fetch: (async () => {
      requests++
      return requests === 1 ? first.response : second.response
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("third.txt"))
    expect(app.captureCharFrame()).toContain("reading round 2 | 3/5 files")

    first.finish({ type: "done" })
    await wait(() => (app.renderer.currentFocusedEditor as TextareaRenderable | undefined)?.plainText === "")
    await app.mockInput.typeText("Fresh question")
    app.mockInput.pressEnter()
    await wait(() => requests === 2)
    await wait(() => app.captureCharFrame().includes("generating round 1 | 0/5 files"))
    second.finish({ type: "text", text: "Fresh answer" }, { type: "done" })
  } finally {
    app.renderer.destroy()
  }
})

test("keeps transcript controls usable in a compact terminal", async () => {
  await using tmp = await tmpdir()
  const copied: string[] = []
  const app = await mount({
    root: tmp.path,
    question: "Compact question",
    width: 48,
    height: 16,
    write: async (text) => void copied.push(text),
    fetch: (async () =>
      stream([
        { type: "text", text: "Compact completed answer with enough content to exercise the transcript layout." },
        { type: "done" },
      ])) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("Compact completed answer"))
    const frame = app.captureCharFrame()
    expect(frame).toContain("Side question")
    expect(frame).toContain("enter ask | 0/5 files")
    expect(frame).toContain("ctrl+c copy")
    expect(frame).toContain("up/down scroll")
    expect(app.renderer.currentFocusedEditor).toBeInstanceOf(TextareaRenderable)

    app.mockInput.pressKey("c", { ctrl: true })
    await wait(() => copied.length === 1)
    expect(copied).toEqual(["Compact completed answer with enough content to exercise the transcript layout."])
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
