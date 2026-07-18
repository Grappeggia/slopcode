import { expect, test } from "bun:test"
import { CliRenderEvents } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { registerSlopcodeKeymap } from "@slopcode-ai/tui/keymap"
import { RunFooter } from "@/cli/cmd/run/footer"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import type { RunCommand } from "@/cli/cmd/run/types"
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
    expect(app.renderer.footerHeight).toBe(10)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("pwd")
    expect(app.captureCharFrame()).toContain("Allow once")

    app.resize(70, 12)
    await app.renderOnce()
    expect(app.captureCharFrame()).toContain("pwd")
    expect(app.captureCharFrame()).toContain("Allow once")

    app.resize(100, 12)
    footer.event({ type: "stream.view", view: multi })
    expect(app.renderer.footerHeight).toBe(8)

    resizes = 0
    app.resize(70, 12)
    expect(app.renderer.footerHeight).toBe(9)
    expect(app.renderer.height).toBe(9)
    expect(resizes).toBe(2)
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

    out.app.resize(100, 12)
    await out.app.renderOnce()
    expect(out.app.renderer.footerHeight).toBe(8)
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
