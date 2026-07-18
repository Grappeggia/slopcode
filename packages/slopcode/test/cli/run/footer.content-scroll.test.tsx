/** @jsxImportSource @opentui/solid */
import { expect, test } from "bun:test"
import { RGBA, ScrollBoxRenderable, type Renderable } from "@opentui/core"
import { testRender } from "@opentui/solid"
import type { PermissionRequest, QuestionRequest } from "@slopcode-ai/sdk/v2"
import { RunPermissionBody } from "@/cli/cmd/run/footer.permission"
import { RunQuestionBody } from "@/cli/cmd/run/footer.question"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import type { PermissionReply } from "@/cli/cmd/run/types"

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
      <box width={input.width ?? 80} height={input.height ?? 12}>
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

function renderQuestion(request: QuestionRequest, width = 48, height = 12) {
  return testRender(
    () => (
      <box width={width} height={height}>
        <RunQuestionBody request={request} theme={RUN_THEME_FALLBACK.footer} onReply={() => {}} onReject={() => {}} />
      </box>
    ),
    { width, height, kittyKeyboard: true },
  )
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
