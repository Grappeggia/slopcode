/** @jsxImportSource @opentui/solid */
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { createSignal, onCleanup, type JSX } from "solid-js"
import { tmpdir } from "./fixture/fixture"
import { createTuiResolvedConfig } from "./fixture/tui-runtime"
import { TestTuiContexts } from "./fixture/tui-environment"
import { TuiConfigProvider } from "../src/config"
import { KVProvider } from "../src/context/kv"
import { ThemeProvider } from "../src/context/theme"
import { SlopcodeKeymapProvider, registerSlopcodeKeymap } from "../src/keymap"
import { DialogProvider } from "../src/ui/dialog"
import { DialogSelect } from "../src/ui/dialog-select"
import { ToastProvider } from "../src/ui/toast"
import { Prompt } from "../src/routes/session/permission"

async function mount(root: string, content: () => JSX.Element) {
  const state = path.join(root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    const config = createTuiResolvedConfig()
    onCleanup(registerSlopcodeKeymap(keymap, renderer, config))

    return (
      <TestTuiContexts directory={root} paths={{ home: root, state, worktree: root }}>
        <SlopcodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <KVProvider>
              <ThemeProvider mode="dark">
                <ToastProvider>
                  <DialogProvider>{content()}</DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </KVProvider>
          </TuiConfigProvider>
        </SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  return testRender(() => <Harness />, { width: 140, height: 20, kittyKeyboard: true })
}

async function waitFor(app: Awaited<ReturnType<typeof testRender>>, text: string) {
  const start = Date.now()
  while (Date.now() - start < 2_000) {
    await app.renderOnce()
    if (app.captureCharFrame().includes(text)) return
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${text}`)
}

test("permission Prompt reacts to available batch actions and normalizes selection", async () => {
  await using tmp = await tmpdir()
  const [options, setOptions] = createSignal<Record<string, string>>({
    once: "Allow selected once",
    reject: "Reject all",
  })
  const selected: string[] = []
  const app = await mount(tmp.path, () => (
    <Prompt
      title="Review build permissions"
      body={<box />}
      options={options()}
      escapeKey="reject"
      onSelect={(option) => selected.push(String(option))}
    />
  ))

  try {
    await waitFor(app, "Review build permissions")
    expect(app.captureCharFrame()).not.toContain("Allow selected for this session")

    setOptions({
      once: "Allow selected once",
      always: "Allow selected for this session",
      project: "Always allow selected for this project",
      reject: "Reject all",
    })
    await waitFor(app, "Allow selected for this session")
    expect(app.captureCharFrame()).toContain("Allow selected for this session")
    expect(app.captureCharFrame()).toContain("Always allow selected for this project")

    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressKey("ARROW_RIGHT")
    setOptions({ once: "Allow selected once", reject: "Reject all" })
    await waitFor(app, "Reject all")
    expect(app.captureCharFrame()).not.toContain("Always allow selected for this project")
    app.mockInput.pressEnter()
    expect(selected).toEqual(["once"])
  } finally {
    app.renderer.destroy()
  }
})

test("permission management refresh runs with an empty successful list", async () => {
  await using tmp = await tmpdir()
  let refreshed = 0
  const app = await mount(tmp.path, () => (
    <DialogSelect
      title="Permissions for this folder"
      options={[]}
      actions={[
        {
          command: "dialog.permission.refresh",
          title: "refresh",
          requiresSelection: false,
          onTrigger: () => {
            refreshed += 1
          },
        },
      ]}
    />
  ))

  try {
    await waitFor(app, "Permissions for this folder")
    app.mockInput.pressKey("r", { ctrl: true })
    expect(refreshed).toBe(1)
  } finally {
    app.renderer.destroy()
  }
})
