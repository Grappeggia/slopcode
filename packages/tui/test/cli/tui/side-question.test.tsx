/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { onCleanup } from "solid-js"
import { SideQuestion } from "../../../src/component/dialog-side-question"
import { TuiConfigProvider } from "../../../src/config"
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

function stream(events: object[]) {
  return new Response(events.map((event) => `event: ${(event as { type: string }).type}\ndata: ${JSON.stringify(event)}\n\n`).join(""), {
    headers: { "content-type": "text/event-stream" },
  })
}

async function mount(input: {
  root: string
  question?: string
  fetch: typeof globalThis.fetch
  onClose?: () => void
}) {
  const config = createTuiResolvedConfig()
  const state = path.join(input.root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const off = registerSlopcodeKeymap(keymap, renderer, config)
    onCleanup(off)

    return (
      <TestTuiContexts directory={input.root} paths={{ state }}>
        <SlopcodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <SDKProvider url="http://test" events={eventSource()} fetch={input.fetch}>
              <KVProvider>
                <ThemeProvider mode="dark">
                  <ToastProvider>
                    <SideQuestion
                      sessionID="ses_test"
                      question={input.question}
                      agent="build"
                      model={{ providerID: "test", modelID: "test-model" }}
                      onClose={input.onClose ?? (() => {})}
                    />
                  </ToastProvider>
                </ThemeProvider>
              </KVProvider>
            </SDKProvider>
          </TuiConfigProvider>
        </SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  return testRender(() => <Harness />, { width: 80, height: 20, kittyKeyboard: true })
}

test("opens a focused composer and streams an answer", async () => {
  await using tmp = await tmpdir()
  let body: unknown
  const app = await mount({
    root: tmp.path,
    fetch: (async (request: RequestInfo | URL) => {
      body = await (request instanceof Request ? request : new Request(request)).json()
      return stream([{ type: "text", text: "The answer" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    app.mockInput.typeText("What is happening?")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("The answer"))

    expect(body).toMatchObject({ question: "What is happening?", agent: "build" })
    expect(app.captureCharFrame()).toContain("complete")
  } finally {
    app.renderer.destroy()
  }
})

test("submits an inline question immediately and closes with escape", async () => {
  await using tmp = await tmpdir()
  let requests = 0
  let closed = 0
  const app = await mount({
    root: tmp.path,
    question: "Existing question",
    onClose: () => closed++,
    fetch: (async () => {
      requests++
      return stream([{ type: "text", text: "Existing answer" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => requests === 1)
    await wait(() => app.captureCharFrame().includes("Existing answer"))
    app.mockInput.pressEscape()
    expect(closed).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})

test("aborts an in-flight side question when unmounted", async () => {
  await using tmp = await tmpdir()
  let aborted = false
  let started!: () => void
  const pending = new Promise<void>((resolve) => (started = resolve))
  const app = await mount({
    root: tmp.path,
    question: "Slow question",
    fetch: (async (request: RequestInfo | URL) => {
      const signal = request instanceof Request ? request.signal : undefined
      signal?.addEventListener("abort", () => (aborted = true))
      started()
      return new Promise<Response>(() => {})
    }) as unknown as typeof globalThis.fetch,
  })

  await pending
  app.renderer.destroy()
  await wait(() => aborted)
})

test("keeps streamed errors retryable after the done event", async () => {
  await using tmp = await tmpdir()
  let requests = 0
  const questions: string[] = []
  const app = await mount({
    root: tmp.path,
    question: "Retry this question",
    fetch: (async (request: RequestInfo | URL) => {
      requests++
      const body = await (request instanceof Request ? request : new Request(request)).json()
      questions.push((body as { question: string }).question)
      if (requests === 1) return stream([{ type: "error", message: "temporary failure" }, { type: "done" }])
      return stream([{ type: "text", text: "Recovered answer" }, { type: "done" }])
    }) as unknown as typeof globalThis.fetch,
  })

  try {
    await wait(() => app.captureCharFrame().includes("temporary failure"))
    expect(app.captureCharFrame()).toContain("failed")
    await app.mockInput.typeText(" corrected")
    app.mockInput.pressEnter()
    await wait(() => app.captureCharFrame().includes("Recovered answer"))
    expect(requests).toBe(2)
    expect(questions).toEqual(["Retry this question", "Retry this question corrected"])
  } finally {
    app.renderer.destroy()
  }
})
