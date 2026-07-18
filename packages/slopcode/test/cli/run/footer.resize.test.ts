import { expect, test } from "bun:test"
import { CliRenderEvents } from "@opentui/core"
import { createTestRenderer } from "@opentui/core/testing"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { registerSlopcodeKeymap } from "@slopcode-ai/tui/keymap"
import { RunFooter } from "@/cli/cmd/run/footer"
import { RUN_THEME_FALLBACK } from "@/cli/cmd/run/theme"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

test("split footer recalculates requested height only for physical resizes", async () => {
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

    footer.event({ type: "stream.view", view: question })
    expect(app.renderer.footerHeight).toBe(8)
    resizes = 0
    app.resize(100, 30)
    expect(app.renderer.footerHeight).toBe(17)
    expect(app.renderer.height).toBe(17)
    expect(resizes).toBe(2)
  } finally {
    app.renderer.off(CliRenderEvents.RESIZE, count)
    footer.destroy()
    unregister()
    app.renderer.destroy()
  }
})
