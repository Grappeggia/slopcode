/** @jsxImportSource @opentui/solid */
import { TextareaRenderable } from "@opentui/core"
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { createSignal, onCleanup } from "solid-js"
import { ConfigAutocompleteV1 } from "@slopcode-ai/core/v1/config/autocomplete"
import { PromptGhost, insertGhost, type PromptGhostRef } from "../../src/component/prompt/ghost"
import { TuiConfigProvider } from "../../src/config"
import { registerSlopcodeKeymap, SlopcodeKeymapProvider } from "../../src/keymap"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

const settings = { ...ConfigAutocompleteV1.Defaults, enabled: true, debounce_ms: 0, min_prefix_chars: 1 }

async function wait(fn: () => boolean, timeout = 2_000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for prompt ghost")
    await Bun.sleep(10)
  }
}

async function mount(input: {
  prefix: string
  width?: number
  maxRows?: number
  settings?: ConfigAutocompleteV1.Resolved
  complete: (input: { prefix: string; signal: AbortSignal }) => Promise<string>
}) {
  const config = createTuiResolvedConfig()
  let textarea!: TextareaRenderable
  let ghost: PromptGhostRef | undefined
  let agent = 0
  let interrupt = 0

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const off = registerSlopcodeKeymap(keymap, renderer, config)
    const offCompeting = keymap.registerLayer({
      commands: [
        { name: "agent.cycle", run: () => void agent++ },
        { name: "session.interrupt", run: () => void interrupt++ },
      ],
      bindings: config.keybinds.gather("competing", ["agent.cycle", "session.interrupt"]),
    })
    const [target, setTarget] = createSignal<TextareaRenderable>()
    const [revision, setRevision] = createSignal(0)
    onCleanup(() => {
      offCompeting()
      off()
    })

    return (
      <TestTuiContexts>
        <SlopcodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <box width={input.width ?? 10}>
              <textarea
                initialValue={input.prefix}
                width="100%"
                focused
                ref={(value: TextareaRenderable) => {
                  textarea = value
                  setTarget(value)
                }}
                onContentChange={() => {
                  setRevision((value) => value + 1)
                  ghost?.schedule()
                }}
                onCursorChange={() => {
                  setRevision((value) => value + 1)
                  ghost?.schedule()
                }}
              />
              <PromptGhost
                ref={(value) => {
                  ghost = value
                }}
                input={target}
                settings={input.settings ?? settings}
                sessionID="ses_test"
                model={{ providerID: "test", modelID: "test-model" }}
                mode="normal"
                parts={0}
                popover={false}
                active
                maxRows={input.maxRows ?? 4}
                revision={revision()}
                color="#777777"
                complete={(request) => input.complete(request)}
                onAccept={(value) => insertGhost(textarea, value)}
              />
            </box>
          </TuiConfigProvider>
        </SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { width: input.width ?? 10, height: 8, kittyKeyboard: true })
  await wait(() => textarea?.focused && !!ghost)
  textarea.gotoBufferEnd()
  await app.renderOnce()
  return {
    app,
    textarea: () => textarea,
    ghost: () => ghost!,
    counts: () => ({ agent, interrupt }),
  }
}

test("ghost keymap wins over agent cycle and busy interrupt while preserving undo", async () => {
  const view = await mount({ prefix: "1234567", complete: async () => "abcdefghijk" })
  try {
    view.ghost().schedule()
    await wait(() => view.ghost().text === "abcdefghijk")
    await view.app.renderOnce()
    const frame = view.app.captureCharFrame()
    expect(frame).toContain("1234567abc")
    expect(frame).toContain("defghijk")

    view.app.mockInput.pressTab()
    await Bun.sleep(20)
    expect(view.textarea().plainText).toBe("1234567abcdefghijk")
    expect(view.counts().agent).toBe(0)

    expect(view.textarea().editBuffer.canUndo()).toBe(true)
    view.textarea().editBuffer.undo()
    expect(view.textarea().plainText).toBe("1234567")

    view.ghost().schedule()
    await wait(() => view.ghost().text === "abcdefghijk")
    view.app.mockInput.pressEscape()
    await wait(() => view.ghost().text === "")
    expect(view.counts().interrupt).toBe(0)
  } finally {
    view.app.renderer.destroy()
  }
})

test("component aborts replaced requests, rejects stale results, and bounds the sent prefix", async () => {
  const pending: { prefix: string; signal: AbortSignal; resolve: (value: string) => void }[] = []
  const view = await mount({
    prefix: "a😀b",
    settings: { ...settings, max_prefix_chars: 3 },
    complete: ({ prefix, signal }) =>
      new Promise((resolve) => {
        pending.push({ prefix, signal, resolve })
      }),
  })
  try {
    view.ghost().schedule()
    await wait(() => pending.length === 1)
    expect(pending[0]?.prefix).toBe("😀b")

    view.textarea().insertText("x")
    await wait(() => pending.length === 2)
    expect(pending[0]?.signal.aborted).toBe(true)

    pending[0]?.resolve(" stale")
    await Bun.sleep(20)
    expect(view.ghost().text).toBe("")

    pending[1]?.resolve(" current")
    await wait(() => view.ghost().text === " current")
  } finally {
    view.app.renderer.destroy()
  }
})
