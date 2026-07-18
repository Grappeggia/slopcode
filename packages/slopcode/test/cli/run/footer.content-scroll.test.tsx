/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA, ScrollBoxRenderable, TextareaRenderable, type Renderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { PermissionRequest, QuestionRequest } from "@slopcode-ai/sdk/v2"
import { Show, createSignal } from "solid-js"
import { RunPermissionBody } from "@/cli/cmd/run/footer.permission"
import { RunQuestionBody } from "@/cli/cmd/run/footer.question"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import type { PermissionReply, QuestionReply } from "@/cli/cmd/run/types"

function scroll(root: Renderable): ScrollBoxRenderable | undefined {
  if (root instanceof ScrollBoxRenderable) return root
  return root.getChildren().map(scroll).find(Boolean)
}

function permission(input: Partial<PermissionRequest> = {}) {
  return {
    id: "per-1",
    sessionID: "ses-1",
    permission: "external_directory",
    patterns: Array.from({ length: 14 }, (_, index) => `/outside/review-${index}`),
    metadata: {},
    always: Array.from({ length: 14 }, (_, index) => `/outside/review-${index}`),
    ...input,
  } satisfies PermissionRequest
}

function renderPermission(input: {
  requests: PermissionRequest[]
  replies?: PermissionReply[]
  width?: number
  height?: number
}) {
  return testRender(
    () => (
      <box width="100%" height="100%">
        <RunPermissionBody
          requests={input.requests}
          scope="project"
          theme={RUN_THEME_FALLBACK.footer}
          block={RUN_THEME_FALLBACK.block}
          onReply={(reply) => {
            input.replies?.push(reply)
          }}
          onBatchReply={() => {}}
        />
      </box>
    ),
    { width: input.width ?? 80, height: input.height ?? 12, kittyKeyboard: true },
  )
}

function renderQuestion(request: QuestionRequest, width = 48, height = 12, replies?: QuestionReply[]) {
  return testRender(
    () => (
      <box width="100%" height="100%">
        <RunQuestionBody
          request={request}
          theme={RUN_THEME_FALLBACK.footer}
          onReply={(reply) => {
            replies?.push(reply)
          }}
          onReject={() => {}}
        />
      </box>
    ),
    { width, height, kittyKeyboard: true },
  )
}

async function click(app: Awaited<ReturnType<typeof testRender>>, id: string) {
  const item = app.renderer.root.findDescendantById(id)
  if (!item) throw new Error(`expected mouse target ${id}`)
  app.renderer.pause()
  try {
    const frame = app.renderer.frameId
    await app.mockMouse.pressDown(item.x + 1, item.y)
    await app.mockMouse.release(item.x + 1, item.y)
    expect(app.renderer.frameId).toBe(frame)
  } finally {
    app.renderer.resume()
  }
}

function holdFrames() {
  const request = globalThis.requestAnimationFrame
  const cancel = globalThis.cancelAnimationFrame
  const callbacks = new Map<number, Parameters<typeof requestAnimationFrame>[0]>()
  let id = 0
  globalThis.requestAnimationFrame = (callback) => {
    const next = ++id
    callbacks.set(next, callback)
    return next
  }
  globalThis.cancelAnimationFrame = (frame) => {
    callbacks.delete(frame)
  }
  return {
    count: () => callbacks.size,
    flush() {
      const pending = [...callbacks.values()]
      callbacks.clear()
      pending.forEach((callback) => callback(performance.now()))
    },
    restore() {
      globalThis.requestAnimationFrame = request
      globalThis.cancelAnimationFrame = cancel
    },
  }
}

test("direct single permission content scrolls without changing its action", async () => {
  const replies: PermissionReply[] = []
  const app = await renderPermission({ requests: [permission()], replies })

  try {
    await app.renderOnce()
    const body = scroll(app.renderer.root)
    if (!body) throw new Error("expected permission scrollbox")
    expect(app.captureCharFrame()).toContain("/outside/review-0")
    expect(app.captureCharFrame()).not.toContain("/outside/review-13")

    app.mockInput.pressKey("ARROW_DOWN")
    await app.renderOnce()
    expect(body.scrollTop).toBeGreaterThan(0)

    app.mockInput.pressKey("END")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("/outside/review-13")

    app.mockInput.pressEnter()
    await app.waitFor(() => replies.length === 1)
    expect(replies[0]?.reply).toBe("once")
  } finally {
    app.renderer.destroy()
  }
})

test("direct durable permission patterns remain keyboard-scrollable", async () => {
  const replies: PermissionReply[] = []
  const app = await renderPermission({ requests: [permission()], replies })

  try {
    await app.renderOnce()
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressEnter()
    await app.waitForFrame((frame) => frame.includes("survives restarts"))
    expect(app.captureCharFrame()).not.toContain("/outside/review-13")

    app.mockInput.pressKey("END")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("/outside/review-13")

    app.mockInput.pressEnter()
    await app.waitFor(() => replies.length === 1)
    expect(replies[0]?.reply).toBe("project")
  } finally {
    app.renderer.destroy()
  }
})

test("direct forecast focus follows overflow and skips hidden project rows", async () => {
  const requests = Array.from({ length: 10 }, (_, index) =>
    permission({
      id: `per-${index}`,
      permission: `tool-${index}`,
      patterns: [`pattern-${index}`],
      always: [`pattern-${index}`],
      kind: "forecast",
      batchID: "pmb-1",
      batchSize: 10,
      reason: `forecast reason ${index}`,
    }),
  )
  const app = await renderPermission({ requests, height: 11 })

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("forecast reason 0")
    expect(app.captureCharFrame()).not.toContain("forecast reason 8")

    app.mockInput.pressKey(" ")
    Array.from({ length: 8 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("forecast reason 8")

    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressEnter()
    await app.waitForFrame((frame) => frame.includes("Always allow selected patterns"))

    const focused = (text: string) =>
      app
        .captureSpans()
        .lines.flatMap((line) => line.spans)
        .find((item) => item.text.includes(text))
    expect(app.captureCharFrame()).toContain("forecast reason 8")
    expect(focused("[x] tool-8")?.fg.toInts()).toEqual((RUN_THEME_FALLBACK.footer.highlight as RGBA).toInts())
    expect(app.captureCharFrame()).not.toContain("tool-0")

    app.mockInput.pressKey("ARROW_DOWN")
    app.mockInput.pressKey("ARROW_DOWN")
    await app.renderOnce()
    expect(focused("[x] tool-1")?.fg.toInts()).toEqual((RUN_THEME_FALLBACK.footer.highlight as RGBA).toInts())
  } finally {
    app.renderer.destroy()
  }
})

test("direct forecast keeps its focused row visible after a narrow physical shrink", async () => {
  const requests = Array.from({ length: 12 }, (_, index) =>
    permission({
      id: `resize-per-${index}`,
      permission: `resize-tool-${index}`,
      patterns: [`resize-pattern-${index}`],
      always: [`resize-pattern-${index}`],
      kind: "forecast",
      batchID: "pmb-resize",
      batchSize: 12,
      reason: `resize forecast reason ${index} with enough detail to wrap in a narrow terminal`,
    }),
  )
  const app = await renderPermission({ requests, width: 100, height: 18 })

  try {
    await app.renderOnce()
    Array.from({ length: 8 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.waitForFrame((frame) => frame.includes("resize forecast reason 8"))

    app.resize(42, 9)
    await app.waitForFrame((frame) => frame.includes("[x] resize-tool-8"))

    const focused = app
      .captureSpans()
      .lines.flatMap((line) => line.spans)
      .find((item) => item.text.includes("[x] resize-tool-8"))
    expect(app.captureCharFrame()).toContain("[x] resize-tool-8")
    expect(focused?.fg.toInts()).toEqual((RUN_THEME_FALLBACK.footer.highlight as RGBA).toInts())
  } finally {
    app.renderer.destroy()
  }
})

test("direct question selection follows wrapped options through the custom row", async () => {
  const request = {
    id: "que-options",
    sessionID: "ses-1",
    questions: [
      {
        question:
          "Choose the safest deployment strategy. Review every deployment constraint, rollback condition, validation signal, service dependency, database migration, compatibility requirement, security boundary, operator action, regional limitation, and recovery step before selecting an answer.",
        header: "Strategy",
        multiple: true,
        custom: true,
        options: Array.from({ length: 5 }, (_, index) => ({
          label: `Option ${index + 1}`,
          description: `Detailed explanation ${index + 1} that wraps across multiple terminal rows for selection visibility and keeps enough content present to overflow the viewport during keyboard navigation.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 90, 14)

  try {
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Choose the safest deployment")
    expect(app.captureCharFrame()).not.toContain("Type your own answer")

    Array.from({ length: 5 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Type your own answer")

    app.mockInput.pressKey("HOME")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Choose the safest deployment")
  } finally {
    app.renderer.destroy()
  }
})

test("direct question re-reveals selection after shrink without ending manual review", async () => {
  const request = {
    id: "que-resize-selection",
    sessionID: "ses-1",
    questions: [
      {
        question: "BEGIN MANUAL REVIEW before selecting a deployment option.",
        header: "Resize",
        custom: false,
        options: Array.from({ length: 9 }, (_, index) => ({
          label: index === 7 ? "RESIZE TARGET ANSWER" : `Resize option ${index + 1}`,
          description: `Detailed resize explanation ${index + 1} that wraps across several rows after the terminal becomes narrow.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 100, 18)

  try {
    await app.renderOnce()
    Array.from({ length: 7 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.waitForFrame((frame) => frame.includes("RESIZE TARGET ANSWER"))

    app.resize(42, 9)
    await app.waitForFrame((frame) => frame.includes("RESIZE TARGET ANSWER"))
    expect(app.captureCharFrame()).toContain("RESIZE TARGET ANSWER")

    app.mockInput.pressKey("HOME")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("BEGIN MANUAL REVIEW")
    expect(app.captureCharFrame()).not.toContain("RESIZE TARGET ANSWER")

    app.resize(38, 8)
    await app.waitForFrame((frame) => frame.includes("BEGIN MANUAL REVIEW"))
    expect(app.captureCharFrame()).toContain("BEGIN MANUAL REVIEW")
    expect(app.captureCharFrame()).not.toContain("RESIZE TARGET ANSWER")
  } finally {
    app.renderer.destroy()
  }
})

test("direct question keeps a previously rendered first answer visible after narrowing", async () => {
  const request = {
    id: "que-resize-first",
    sessionID: "ses-1",
    questions: [
      {
        question: Array.from({ length: 12 }, (_, index) => `Review first-answer constraint ${index + 1}.`).join(" "),
        header: "First",
        custom: false,
        options: [
          { label: "FIRST RESIZE ANSWER", description: "Keep this selected answer visible after relayout." },
          { label: "Second answer", description: "A second answer for selection context." },
        ],
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 100, 18)

  try {
    await app.waitForFrame((frame) => frame.includes("FIRST RESIZE ANSWER"))
    app.resize(42, 9)
    await app.waitForFrame((frame) => frame.includes("FIRST RESIZE ANSWER"))
    expect(app.captureCharFrame()).toContain("FIRST RESIZE ANSWER")
  } finally {
    app.renderer.destroy()
  }
})

test("direct question preserves a programmatically reviewed viewport across resize", async () => {
  const request = {
    id: "que-resize-programmatic-review",
    sessionID: "ses-1",
    questions: [
      {
        question: "PROGRAMMATIC REVIEW START",
        header: "Review",
        custom: false,
        options: Array.from({ length: 12 }, (_, index) => ({
          label: index === 10 ? "PROGRAMMATIC HIDDEN SELECTION" : `Programmatic option ${index + 1}`,
          description: `Programmatic review detail ${index + 1} that wraps after narrowing.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 100, 18)

  try {
    await app.renderOnce()
    Array.from({ length: 10 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.waitForFrame((frame) => frame.includes("PROGRAMMATIC HIDDEN SELECTION"))
    await app.renderOnce()
    await app.renderOnce()
    const body = scroll(app.renderer.root)
    if (!body) throw new Error("expected question scrollbox")

    body.scrollTo(0)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Programmatic option 1")
    expect(app.captureCharFrame()).not.toContain("PROGRAMMATIC HIDDEN SELECTION")

    app.resize(42, 9)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Programmatic option 1")
    expect(app.captureCharFrame()).not.toContain("PROGRAMMATIC HIDDEN SELECTION")
  } finally {
    app.renderer.destroy()
  }
})

test("direct question cancels deferred resize follow when unmounted", async () => {
  const request = {
    id: "que-resize-cleanup",
    sessionID: "ses-1",
    questions: [
      {
        question: "Choose an answer before cleanup.",
        header: "Cleanup",
        custom: false,
        options: Array.from({ length: 9 }, (_, index) => ({
          label: index === 7 ? "QUESTION CLEANUP TARGET" : `Cleanup answer ${index + 1}`,
          description: `Cleanup detail ${index + 1} that wraps in the narrow layout.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const [visible, setVisible] = createSignal(true)
  const app = await testRender(
    () => (
      <box width="100%" height="100%">
        <Show when={visible()}>
          <RunQuestionBody request={request} theme={RUN_THEME_FALLBACK.footer} onReply={() => {}} onReject={() => {}} />
        </Show>
      </box>
    ),
    { width: 100, height: 18, kittyKeyboard: true },
  )
  let held: ReturnType<typeof holdFrames> | undefined

  try {
    await app.renderOnce()
    Array.from({ length: 7 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.waitForFrame((frame) => frame.includes("QUESTION CLEANUP TARGET"))
    const body = scroll(app.renderer.root)
    if (!body) throw new Error("expected question scrollbox")
    const find = body.content.findDescendantById.bind(body.content)
    let disposed = false
    let stale = 0
    body.content.findDescendantById = (id) => {
      if (disposed) stale++
      return find(id)
    }
    held = holdFrames()

    app.resize(42, 9)
    await app.renderOnce()
    expect(held.count()).toBeGreaterThan(0)
    setVisible(false)
    disposed = true
    await app.renderOnce()

    held.flush()
    held.flush()
    expect(stale).toBe(0)
  } finally {
    held?.restore()
    app.renderer.destroy()
  }
})

test("direct forecast cancels deferred resize follow when reply unmounts it", async () => {
  const requests = Array.from({ length: 10 }, (_, index) =>
    permission({
      id: `cleanup-per-${index}`,
      permission: `cleanup-tool-${index}`,
      patterns: [`cleanup-pattern-${index}`],
      always: [`cleanup-pattern-${index}`],
      kind: "forecast",
      batchID: "pmb-cleanup",
      batchSize: 10,
      reason: `cleanup forecast reason ${index}`,
    }),
  )
  const [visible, setVisible] = createSignal(true)
  const app = await testRender(
    () => (
      <box width="100%" height="100%">
        <Show when={visible()}>
          <RunPermissionBody
            requests={requests}
            scope="project"
            theme={RUN_THEME_FALLBACK.footer}
            block={RUN_THEME_FALLBACK.block}
            onReply={() => {}}
            onBatchReply={() => {
              setVisible(false)
            }}
          />
        </Show>
      </box>
    ),
    { width: 100, height: 18, kittyKeyboard: true },
  )
  let held: ReturnType<typeof holdFrames> | undefined

  try {
    await app.renderOnce()
    Array.from({ length: 7 }).forEach(() => app.mockInput.pressKey("ARROW_DOWN"))
    await app.waitForFrame((frame) => frame.includes("cleanup forecast reason 7"))
    const body = scroll(app.renderer.root)
    if (!body) throw new Error("expected forecast scrollbox")
    const follow = body.scrollChildIntoView.bind(body)
    let disposed = false
    let stale = 0
    body.scrollChildIntoView = (id) => {
      if (disposed) stale++
      follow(id)
    }
    held = holdFrames()

    app.resize(42, 9)
    await app.renderOnce()
    await Bun.sleep(0)
    expect(held.count()).toBeGreaterThan(0)
    app.mockInput.pressEnter()
    await app.renderOnce()
    disposed = true

    held.flush()
    held.flush()
    expect(stale).toBe(0)
  } finally {
    held?.restore()
    app.renderer.destroy()
  }
})

test("direct question only acts on a visible selected answer after content review", async () => {
  const replies: QuestionReply[] = []
  const request = {
    id: "que-visible-action",
    sessionID: "ses-1",
    questions: [
      {
        question: Array.from(
          { length: 36 },
          (_, index) =>
            `${index === 0 ? "Read this long prompt from the beginning." : `Review deployment constraint ${index} before continuing.`}`,
        ).join(" "),
        header: "Action",
        custom: false,
        options: Array.from({ length: 8 }, (_, index) => ({
          label: index === 0 ? "FIRST ACTIONABLE ANSWER" : `Review option ${index + 1}`,
          description: `Description for answer ${index + 1}.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 12, replies)

  try {
    await app.waitForFrame((frame) => frame.includes("FIRST ACTIONABLE ANSWER"))

    app.mockInput.pressKey("HOME")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Read this long prompt from the beginning")
    expect(app.captureCharFrame()).not.toContain("FIRST ACTIONABLE ANSWER")

    app.renderer.pause()
    try {
      const frame = app.renderer.frameId
      app.mockInput.pressEnter()
      app.mockInput.pressEnter()
      expect(app.renderer.frameId).toBe(frame)
      expect(replies).toEqual([])
    } finally {
      app.renderer.resume()
    }
    await app.renderOnce()
    expect(replies).toEqual([])
    expect(app.captureCharFrame()).toContain("FIRST ACTIONABLE ANSWER")

    app.mockInput.pressKey("END")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("Review option 8")
    expect(app.captureCharFrame()).not.toContain("FIRST ACTIONABLE ANSWER")

    app.mockInput.pressEnter()
    await app.renderOnce()
    expect(replies).toEqual([])
    expect(app.captureCharFrame()).toContain("FIRST ACTIONABLE ANSWER")

    app.mockInput.pressEnter()
    await app.waitFor(() => replies.length === 1)
    expect(replies).toEqual([{ requestID: "que-visible-action", answers: [["FIRST ACTIONABLE ANSWER"]] }])
  } finally {
    app.renderer.destroy()
  }
})

test("direct digit activation waits for an offscreen answer to render", async () => {
  const request = {
    id: "que-visible-digit",
    sessionID: "ses-1",
    questions: [
      {
        question: Array.from(
          { length: 36 },
          (_, index) => `Review digit constraint ${index + 1} before continuing.`,
        ).join(" "),
        header: "Digits",
        multiple: true,
        custom: false,
        options: Array.from({ length: 8 }, (_, index) => ({
          label: index === 0 ? "FIRST VISIBLE TOGGLE" : index === 7 ? "LAST OFFSCREEN TOGGLE" : `Toggle ${index + 1}`,
          description: `Description for toggle ${index + 1}.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 12)

  try {
    await app.waitForFrame((frame) => frame.includes("FIRST VISIBLE TOGGLE"))
    app.mockInput.pressKey("1")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("[✓] FIRST VISIBLE TOGGLE")

    app.mockInput.pressKey("HOME")
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("LAST OFFSCREEN TOGGLE")

    app.mockInput.pressKey("8")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("[ ] LAST OFFSCREEN TOGGLE")

    app.mockInput.pressKey("8")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("[✓] LAST OFFSCREEN TOGGLE")
  } finally {
    app.renderer.destroy()
  }
})

test("direct offscreen digit cannot submit before its row renders", async () => {
  const replies: QuestionReply[] = []
  const request = {
    id: "que-offscreen-digit-reply",
    sessionID: "ses-1",
    questions: [
      {
        question: Array.from(
          { length: 36 },
          (_, index) => `Review reply constraint ${index + 1} before continuing.`,
        ).join(" "),
        header: "Reply",
        custom: false,
        options: Array.from({ length: 8 }, (_, index) => ({
          label: index === 0 ? "FIRST REPLY" : index === 7 ? "LAST SAFE REPLY" : `Reply ${index + 1}`,
          description: `Description for reply ${index + 1}.`,
        })),
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 12, replies)
  let paused = false

  try {
    await app.waitForFrame((frame) => frame.includes("FIRST REPLY"))
    app.mockInput.pressKey("HOME")
    await app.renderOnce()
    expect(app.captureCharFrame()).not.toContain("LAST SAFE REPLY")

    app.renderer.pause()
    paused = true
    const frame = app.renderer.frameId
    app.mockInput.pressKey("8")
    app.mockInput.pressKey("8")
    expect(app.renderer.frameId).toBe(frame)
    expect(replies).toEqual([])

    app.renderer.resume()
    paused = false
    await app.waitForFrame((output) => output.includes("LAST SAFE REPLY"))
    app.mockInput.pressKey("8")
    await app.waitFor(() => replies.length === 1)
    expect(replies).toEqual([{ requestID: "que-offscreen-digit-reply", answers: [["LAST SAFE REPLY"]] }])
  } finally {
    if (paused) app.renderer.resume()
    app.renderer.destroy()
  }
})

test("direct visible ordinary option activates with one mouse click", async () => {
  const replies: QuestionReply[] = []
  const request = {
    id: "que-mouse-option",
    sessionID: "ses-1",
    questions: [
      {
        question: "Choose one visible answer.",
        header: "Mouse",
        custom: false,
        options: [
          { label: "Primary", description: "The initially selected answer." },
          { label: "SECOND VISIBLE ANSWER", description: "A visible non-selected answer." },
        ],
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 12, replies)

  try {
    await app.waitForFrame((frame) => frame.includes("SECOND VISIBLE ANSWER"))
    await click(app, "run-question-que-mouse-option-0-1")
    expect(replies).toEqual([{ requestID: "que-mouse-option", answers: [["SECOND VISIBLE ANSWER"]] }])
  } finally {
    app.renderer.destroy()
  }
})

test("direct visible multi-select option toggles with one mouse click", async () => {
  const request = {
    id: "que-mouse-multi",
    sessionID: "ses-1",
    questions: [
      {
        question: "Choose visible answers.",
        header: "Multi",
        multiple: true,
        custom: false,
        options: [
          { label: "Primary", description: "The initially selected answer." },
          { label: "SECOND VISIBLE TOGGLE", description: "A visible non-selected answer." },
        ],
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 12)

  try {
    await app.waitForFrame((frame) => frame.includes("SECOND VISIBLE TOGGLE"))
    await click(app, "run-question-que-mouse-multi-0-1")
    await app.waitForFrame((frame) => frame.includes("[✓] SECOND VISIBLE TOGGLE"))
  } finally {
    app.renderer.destroy()
  }
})

test("direct visible custom row edits with one mouse click", async () => {
  const request = {
    id: "que-mouse-custom",
    sessionID: "ses-1",
    questions: [
      {
        question: "Choose or write one visible answer.",
        header: "Custom",
        custom: true,
        options: [{ label: "Provided", description: "The initially selected answer." }],
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 12)

  try {
    await app.waitForFrame((frame) => frame.includes("Type your own answer"))
    await click(app, "run-question-que-mouse-custom-0-1")
    await app.waitFor(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
  } finally {
    app.renderer.currentFocusedRenderable?.blur()
    app.renderer.currentFocusedEditor?.blur()
    app.renderer.destroy()
  }
})

test("direct custom answer textarea owns arrows home and end", async () => {
  const request = {
    id: "que-editor-keys",
    sessionID: "ses-1",
    questions: [
      {
        question: "Provide a custom answer.",
        header: "Custom",
        custom: true,
        options: [{ label: "Provided", description: "Use the provided answer." }],
      },
    ],
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 80, 14)

  try {
    await app.renderOnce()
    app.mockInput.pressKey("ARROW_DOWN")
    await app.waitForFrame((frame) => frame.includes("Type your own answer"))
    app.mockInput.pressEnter()
    await app.waitFor(() => app.renderer.currentFocusedEditor instanceof TextareaRenderable)
    const area = app.renderer.currentFocusedEditor as TextareaRenderable
    const body = scroll(app.renderer.root)
    if (!body) throw new Error("expected question scrollbox")

    area.setText("alpha\nbeta\ngamma")
    await app.renderOnce()
    area.cursorOffset = area.plainText.length
    const top = body.scrollTop

    app.mockInput.pressKey("HOME")
    await app.renderOnce()
    expect(area.cursorOffset).toBe(0)
    expect(body.scrollTop).toBe(top)

    app.mockInput.pressKey("END")
    await app.renderOnce()
    expect(area.cursorOffset).toBe(area.plainText.length)
    expect(body.scrollTop).toBe(top)

    app.mockInput.pressKey("ARROW_UP")
    await app.renderOnce()
    expect(area.logicalCursor.row).toBe(1)
    expect(body.scrollTop).toBe(top)

    app.mockInput.pressKey("ARROW_DOWN")
    await app.renderOnce()
    expect(area.logicalCursor.row).toBe(2)
    expect(body.scrollTop).toBe(top)

    app.resize(44, 9)
    await app.renderOnce()
    expect(app.renderer.currentFocusedEditor).toBe(area)
    expect(area.plainText).toBe("alpha\nbeta\ngamma")
  } finally {
    app.renderer.currentFocusedRenderable?.blur()
    app.renderer.currentFocusedEditor?.blur()
    app.renderer.destroy()
  }
})

test("direct question review content scrolls from the keyboard", async () => {
  const request = {
    id: "que-review",
    sessionID: "ses-1",
    questions: Array.from({ length: 12 }, (_, index) => ({
      question: `Question ${index + 1}?`,
      header: `R${index + 1}`,
      options: [{ label: "Yes", description: "Confirm this item." }],
    })),
  } satisfies QuestionRequest
  const app = await renderQuestion(request, 100, 11)

  try {
    await app.renderOnce()
    app.mockInput.pressKey("ARROW_LEFT")
    await app.waitForFrame((frame) => frame.includes("R1:"))
    const review = scroll(app.renderer.root)
    if (!review) throw new Error("expected question review scrollbox")
    expect(app.captureCharFrame()).not.toContain("R12:")

    app.mockInput.pressKey("ARROW_DOWN")
    await app.renderOnce()
    expect(review.scrollTop).toBeGreaterThan(0)

    app.mockInput.pressKey("END")
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("R12:")
  } finally {
    app.renderer.destroy()
  }
})
