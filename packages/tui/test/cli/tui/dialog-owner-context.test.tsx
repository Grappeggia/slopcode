/** @jsxImportSource @opentui/solid */
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { createContext, onCleanup, onMount, useContext } from "solid-js"
import { tmpdir } from "../../fixture/fixture"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"

const Owner = createContext<string>()

async function wait(fn: () => boolean, timeout = 2000) {
  const start = Date.now()
  while (!fn()) {
    if (Date.now() - start > timeout) throw new Error("timed out waiting for condition")
    await Bun.sleep(10)
  }
}

test("dialog factories preserve their caller's owner context", async () => {
  await using tmp = await tmpdir()
  const state = path.join(tmp.path, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")

  const [
    { DialogProvider, useDialog },
    { KVProvider },
    { ThemeProvider },
    { TuiConfigProvider },
    { ToastProvider },
    keymap,
  ] = await Promise.all([
    import("../../../src/ui/dialog"),
    import("../../../src/context/kv"),
    import("../../../src/context/theme"),
    import("../../../src/config"),
    import("../../../src/ui/toast"),
    import("../../../src/keymap"),
  ])
  const config = createTuiResolvedConfig()
  let observed: string | undefined

  function Probe() {
    observed = useContext(Owner)
    return <text>dialog-ready</text>
  }

  function Open() {
    const dialog = useDialog()
    onMount(() => dialog.replace(() => <Probe />))
    return <box />
  }

  function Harness() {
    const renderer = useRenderer()
    const keys = createDefaultOpenTuiKeymap(renderer)
    onCleanup(keymap.registerSlopcodeKeymap(keys, renderer, config))

    return (
      <TestTuiContexts directory={tmp.path} paths={{ home: tmp.path, state, worktree: tmp.path }}>
        <keymap.SlopcodeKeymapProvider keymap={keys}>
          <TuiConfigProvider config={config}>
            <KVProvider>
              <ThemeProvider mode="dark">
                <ToastProvider>
                  <DialogProvider>
                    <Owner.Provider value="preserved">
                      <Open />
                    </Owner.Provider>
                  </DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </KVProvider>
          </TuiConfigProvider>
        </keymap.SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { kittyKeyboard: true })
  try {
    await wait(() => observed !== undefined)
    expect(observed).toBe("preserved")
  } finally {
    app.renderer.destroy()
  }
})
