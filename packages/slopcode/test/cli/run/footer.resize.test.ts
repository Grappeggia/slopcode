import { expect, test } from "bun:test"
import { CliRenderEvents } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { registerSlopcodeKeymap } from "@slopcode-ai/tui/keymap"
import { RunFooter } from "@/cli/cmd/run/footer"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import type { FooterView, RunCommand } from "@/cli/cmd/run/types"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

async function setup(input: { commands?: RunCommand[] } = {}) {
  const app = await createTestRenderer({
    width: 100,
    height: 30,
    screenMode: "split-footer",
    footerHeight: 4,
    consoleMode: "disabled",
    externalOutputMode: "passthrough",
  })
  const config = createTuiResolvedConfig()
  const keymap = createDefaultOpenTuiKeymap(app.renderer)
  const unregister = registerSlopcodeKeymap(keymap, app.renderer, config)
  const footer = new RunFooter(app.renderer, {
    directory: "/tmp",
    permissionScope: "project",
    findFiles: async () => [],
    agents: [],
    resources: [],
    commands: input.commands,
    sessionID: () => "session-1",
    agentLabel: "Build",
    modelLabel: "Model default",
    model: undefined,
    variant: undefined,
    first: false,
    theme: RUN_THEME_FALLBACK,
    keymap,
    tuiConfig: config,
    backgroundSubagents: false,
    diffStyle: "auto",
    onPermissionReply: () => {},
    onPermissionBatchReply: () => {},
    onQuestionReply: () => {},
    onQuestionReject: () => {},
    onEditorOpen: async () => undefined,
  })

  return {
    app,
    footer,
    destroy() {
      footer.destroy()
      unregister()
      app.renderer.destroy()
    },
  }
}

async function expectBoundaries(view: FooterView, heights: number[], labels: string[], rows = labels) {
  const out = await setup()

  try {
    out.footer.event({ type: "stream.view", view })
    await out.app.renderOnce()
    await out.app.waitForFrame((output) => labels.every((label) => output.includes(label)))
    for (const height of heights) {
      out.app.resize(70, height + 4)
      expect(out.app.renderer.footerHeight).toBe(height)
      expect(out.app.renderer.height).toBe(height)
      await out.app.renderOnce()
      const frame = await out.app.waitForFrame((output) => labels.every((label) => output.includes(label)))
      labels.forEach((label) => expect(frame).toContain(label))
      expect(new Set(rows.map((label) => frame.split("\n").findIndex((line) => line.includes(label)))).size).toBe(
        rows.length,
      )
    }
  } finally {
    out.destroy()
  }
}

test("split footer recalculates requested height only for physical resizes", async () => {
  const out = await setup()
  const app = out.app
  const footer = out.footer
  let resizes = 0
  const count = () => {
    resizes++
  }
  const question = {
    type: "question" as const,
    request: {
      id: "question-1",
      sessionID: "session-1",
      questions: [
        {
          question: "Choose one",
          header: "Choice",
          options: [{ label: "First", description: "First option" }],
        },
      ],
    },
  }
  const multi = {
    type: "question" as const,
    request: {
      id: "question-multi",
      sessionID: "session-1",
      questions: [
        {
          question: "Choose the first option",
          header: "First",
          options: [{ label: "FIRST OPTION", description: "First choice" }],
        },
        {
          question: "Choose the second option",
          header: "Second",
          options: [{ label: "SECOND OPTION", description: "Second choice" }],
        },
      ],
    },
  }

  try {
    footer.event({
      type: "stream.view",
      view: question,
    })
    expect(app.renderer.footerHeight).toBe(17)
    app.renderer.on(CliRenderEvents.RESIZE, count)

    app.resize(100, 18)
    expect(app.renderer.footerHeight).toBe(14)
    expect(app.renderer.height).toBe(14)
    expect(resizes).toBe(2)

    resizes = 0
    app.resize(100, 12)
    expect(app.renderer.footerHeight).toBe(8)
    expect(app.renderer.height).toBe(8)
    expect(resizes).toBe(2)

    footer.event({
      type: "stream.view",
      view: {
        type: "permission",
        requests: [
          {
            id: "permission-1",
            sessionID: "session-1",
            permission: "bash",
            patterns: ["pwd"],
            metadata: {},
            always: [],
          },
        ],
      },
    })
    expect(app.renderer.footerHeight).toBe(9)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("pwd")
    expect(app.captureCharFrame()).toContain("Allow once")

    app.resize(70, 13)
    expect(app.renderer.footerHeight).toBe(9)
    expect(app.renderer.height).toBe(9)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("pwd")
    expect(app.captureCharFrame()).toContain("Allow once")

    app.resize(100, 12)
    footer.event({ type: "stream.view", view: multi })
    expect(app.renderer.footerHeight).toBe(8)

    resizes = 0
    app.resize(70, 12)
    expect(app.renderer.footerHeight).toBe(8)
    expect(app.renderer.height).toBe(8)
    expect(resizes).toBe(1)
    const frame = await app.waitForFrame((output) => output.includes("FIRST OPTION"))
    expect(frame).toContain("FIRST OPTION")
    expect(frame).toContain("tab")
    expect(frame).toContain("select")
    expect(frame).toContain("confirm")
    expect(frame).toContain("dismiss")

    resizes = 0
    app.resize(100, 30)
    expect(app.renderer.footerHeight).toBe(17)
    expect(app.renderer.height).toBe(17)
    expect(resizes).toBe(2)
  } finally {
    app.renderer.off(CliRenderEvents.RESIZE, count)
    out.destroy()
  }
})

test("open split footer menu follows final rows through shrink and grow", async () => {
  const out = await setup({
    commands: Array.from({ length: 20 }, (_, index) => ({
      name: `task-${String(index + 1).padStart(2, "0")}`,
      description: `Task ${index + 1}`,
      template: "",
      hints: [],
      source: "command" as const,
    })),
  })

  try {
    await out.app.renderOnce()
    out.app.mockInput.pressKey("p", { ctrl: true })
    await out.app.waitForFrame((frame) => frame.includes("Commands"))
    Array.from({ length: 10 }).forEach(() => out.app.mockInput.pressKey("ARROW_DOWN"))
    await out.app.renderOnce()
    expect(out.app.captureCharFrame()).toContain("task-07")

    out.app.resize(100, 11)
    await out.app.renderOnce()
    expect(out.app.renderer.footerHeight).toBe(7)
    expect(out.app.renderer.height).toBe(7)
    expect(out.app.captureCharFrame()).toContain("task-07")

    out.app.resize(100, 30)
    await out.app.renderOnce()
    const frame = out.app.captureCharFrame()
    expect(out.app.renderer.footerHeight).toBe(17)
    expect(frame).toContain("task-07")
    expect(frame).toContain("task-08")
  } finally {
    out.destroy()
  }
})

test("narrow single question preserves content through its expanded boundary", async () => {
  await expectBoundaries(
    {
      type: "question",
      request: {
        id: "question-single-boundary",
        sessionID: "session-1",
        questions: [
          {
            question: "Choose the single boundary option",
            header: "Single",
            options: [{ label: "SINGLE OPTION", description: "Single boundary choice" }],
          },
        ],
      },
    },
    [7, 8, 9, 10],
    ["Choose the single boundary option", "select", "submit", "dismiss"],
  )
})

test("narrow multi-question preserves content through its expanded boundary", async () => {
  await expectBoundaries(
    {
      type: "question",
      request: {
        id: "question-multi-boundary",
        sessionID: "session-1",
        questions: [
          {
            question: "Choose the first boundary option",
            header: "First",
            options: [{ label: "MULTI OPTION", description: "First boundary choice" }],
          },
          {
            question: "Choose the second boundary option",
            header: "Second",
            options: [{ label: "SECOND OPTION", description: "Second boundary choice" }],
          },
        ],
      },
    },
    [8, 9, 10, 11, 12, 13],
    ["Choose the first boundary option", "First", "Second", "Confirm", "tab", "select", "confirm", "dismiss"],
    ["Choose the first boundary option", "First", "tab", "select", "confirm", "dismiss"],
  )
})

test("narrow permission preserves content through its expanded boundary", async () => {
  await expectBoundaries(
    {
      type: "permission",
      requests: [
        {
          id: "permission-boundary",
          sessionID: "session-1",
          permission: "bash",
          patterns: ["printf boundary-permission"],
          metadata: {},
          always: [],
        },
      ],
    },
    [9, 10, 11, 12],
    ["boundary-permission", "Allow once", "Reject", "select", "confirm", "reject"],
    ["boundary-permission", "Allow once", "select"],
  )
})
