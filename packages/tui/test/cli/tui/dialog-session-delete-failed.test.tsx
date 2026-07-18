/** @jsxImportSource @opentui/solid */
import { createDefaultOpenTuiKeymap } from "@opentui/keymap/opentui"
import { testRender, useRenderer } from "@opentui/solid"
import type { Session } from "@slopcode-ai/sdk/v2"
import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { onCleanup, onMount, Show } from "solid-js"
import { DialogSessionDeleteFailed } from "../../../src/component/dialog-session-delete-failed"
import { DialogSessionList } from "../../../src/component/dialog-session-list"
import { TuiConfigProvider } from "../../../src/config"
import { ArgsProvider } from "../../../src/context/args"
import { ExitProvider } from "../../../src/context/exit"
import { KVProvider } from "../../../src/context/kv"
import { LocalProvider } from "../../../src/context/local"
import { PermissionProvider } from "../../../src/context/permission"
import { ProjectProvider, useProject } from "../../../src/context/project"
import { RouteProvider } from "../../../src/context/route"
import { SDKProvider } from "../../../src/context/sdk"
import { SyncProvider, useSync } from "../../../src/context/sync"
import { ThemeProvider } from "../../../src/context/theme"
import { SlopcodeKeymapProvider, registerSlopcodeKeymap } from "../../../src/keymap"
import { DialogProvider, useDialog } from "../../../src/ui/dialog"
import { Toast, ToastProvider } from "../../../src/ui/toast"
import { TestTuiContexts } from "../../fixture/tui-environment"
import { createEventSource, createFetch, json } from "../../fixture/tui-sdk"
import { createTuiResolvedConfig } from "../../fixture/tui-runtime"
import { tmpdir } from "../../fixture/fixture"

type App = Awaited<ReturnType<typeof testRender>>
type Action = () => boolean | void | Promise<boolean | void>

async function wait(app: App, check: () => boolean, message: string) {
  const start = Date.now()
  while (Date.now() - start < 2_000) {
    await app.renderOnce()
    if (check()) return
    await Bun.sleep(10)
  }
  throw new Error(`timed out waiting for ${message}\n${app.captureCharFrame()}`)
}

async function shown(app: App, text: string) {
  await wait(app, () => app.captureCharFrame().includes(text), text)
}

async function click(app: App, text: string) {
  await app.renderOnce()
  const lines = app.captureCharFrame().split("\n")
  const y = lines.findIndex((line) => line.includes(text))
  if (y === -1) throw new Error(`expected mouse target ${text}`)
  const x = lines[y]!.indexOf(text)
  await app.mockMouse.pressDown(x + 1, y)
  await app.mockMouse.release(x + 1, y)
}

async function mountDialog(
  root: string,
  input: {
    onDelete?: Action
    onRestore?: Action
  },
) {
  const state = path.join(root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")
  const config = createTuiResolvedConfig()

  function Open() {
    const dialog = useDialog()
    onMount(() =>
      dialog.replace(() => (
        <DialogSessionDeleteFailed
          session="Important Session"
          workspace="Workspace One"
          onDelete={input.onDelete}
          onRestore={input.onRestore}
        />
      )),
    )
    return <box />
  }

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    onCleanup(registerSlopcodeKeymap(keymap, renderer, config))

    return (
      <TestTuiContexts directory={root} paths={{ home: root, state, worktree: root }}>
        <SlopcodeKeymapProvider keymap={keymap}>
          <TuiConfigProvider config={config}>
            <KVProvider>
              <ThemeProvider mode="dark">
                <ToastProvider>
                  <DialogProvider>
                    <Open />
                  </DialogProvider>
                </ToastProvider>
              </ThemeProvider>
            </KVProvider>
          </TuiConfigProvider>
        </SlopcodeKeymapProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { width: 100, height: 30, kittyKeyboard: true })
  await shown(app, "Failed to Delete Session")
  return app
}

test("failed session deletion defaults Enter to restore", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  let restored = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
      return false
    },
    onRestore: () => {
      restored++
      return false
    },
  })

  try {
    app.mockInput.pressEnter()
    await wait(app, () => deleted + restored === 1, "initial recovery action")

    expect(restored).toBe(1)
    expect(deleted).toBe(0)
  } finally {
    app.renderer.destroy()
  }
})

test("keyboard workspace deletion requires the named destructive confirmation", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
    },
  })

  try {
    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, "Delete Workspace")

    expect(deleted).toBe(0)
    expect(app.captureCharFrame()).toContain('Delete workspace "Workspace One"?')
    expect(app.captureCharFrame()).toContain("All sessions attached")
    expect(app.captureCharFrame()).toContain("to it will be deleted.")

    app.mockInput.pressEnter()
    await wait(app, () => deleted === 1, "workspace deletion")
  } finally {
    app.renderer.destroy()
  }
})

test("mouse workspace deletion requires a second click in the confirmation", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
    },
  })

  try {
    await click(app, "Delete workspace")
    await shown(app, "Delete Workspace")
    expect(deleted).toBe(0)

    await click(app, "Confirm")
    await wait(app, () => deleted === 1, "mouse-confirmed workspace deletion")
  } finally {
    app.renderer.destroy()
  }
})

test("workspace deletion confirmation can be cancelled without deleting", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
    },
  })

  try {
    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, 'Delete workspace "Workspace One"?')
    await click(app, "Cancel")
    await app.renderOnce()

    expect(deleted).toBe(0)
    expect(app.captureCharFrame()).not.toContain('Delete workspace "Workspace One"?')
  } finally {
    app.renderer.destroy()
  }
})

test("Escape from workspace deletion confirmation never deletes", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
    },
  })

  try {
    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, 'Delete workspace "Workspace One"?')
    app.mockInput.pressEscape()
    await app.renderOnce()

    expect(deleted).toBe(0)
    expect(app.captureCharFrame()).not.toContain('Delete workspace "Workspace One"?')
  } finally {
    app.renderer.destroy()
  }
})

test("pending workspace removal ignores duplicate confirmation input", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  let finish!: (result: boolean) => void
  const pending = new Promise<boolean>((resolve) => (finish = resolve))
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
      return pending
    },
  })

  try {
    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, 'Delete workspace "Workspace One"?')

    app.mockInput.pressEnter()
    app.mockInput.pressEnter()
    app.mockInput.pressEnter()
    await wait(app, () => deleted > 0, "pending workspace removal")
    expect(deleted).toBe(1)
  } finally {
    finish(true)
    app.renderer.destroy()
  }
})

function info(root: string): Session {
  return {
    id: "ses_connected",
    slug: "connected",
    projectID: "proj_test",
    workspaceID: "wrk_connected",
    directory: root,
    title: "Connected Session",
    version: "0.0.0-test",
    time: { created: 1, updated: 1 },
  }
}

test("connected workspace session-delete failures surface the original error", async () => {
  await using tmp = await tmpdir()
  const state = path.join(tmp.path, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")
  const config = createTuiResolvedConfig()
  const events = createEventSource()
  let deletes = 0
  let removals = 0
  let dispatch!: (command: string) => void
  let registered!: (command: string) => boolean
  const calls = createFetch(async (url, request) => {
    if (url.pathname === "/config/providers") return json({ providers: [], default: {} })
    if (url.pathname === "/project/current") return json({ id: "proj_test", worktree: tmp.path, vcs: "git" })
    if (url.pathname === "/project/proj_test/directories") return json([{ directory: tmp.path }])
    if (url.pathname === "/experimental/workspace") {
      if (request?.method === "DELETE") {
        removals++
        return json(true)
      }
      return json([
        {
          id: "wrk_connected",
          type: "worktree",
          name: "Workspace One",
          directory: tmp.path,
          projectID: "proj_test",
          timeUsed: 1,
        },
      ])
    }
    if (url.pathname === "/experimental/workspace/status") {
      return json([{ workspaceID: "wrk_connected", status: "connected" }])
    }
    if (url.pathname === "/session" && request?.method === "GET") return json([info(tmp.path)])
    if (url.pathname === "/session/ses_connected" && request?.method === "DELETE") {
      deletes++
      return json({ name: "SessionDeleteError", data: { message: "original delete failure" } }, { status: 500 })
    }
    return undefined
  })

  function Open() {
    const project = useProject()
    const sync = useSync()
    return (
      <Show when={project.workspace.status("wrk_connected") === "connected" && sync.session.get("ses_connected")}>
        <OpenList />
      </Show>
    )
  }

  function OpenList() {
    const dialog = useDialog()
    onMount(() => dialog.replace(() => <DialogSessionList />))
    return <box />
  }

  function Harness() {
    const renderer = useRenderer()
    const keymap = createDefaultOpenTuiKeymap(renderer)
    dispatch = (command) => keymap.dispatchCommand(command)
    registered = (command) => keymap.getCommands({ visibility: "registered" }).some((item) => item.name === command)
    onCleanup(registerSlopcodeKeymap(keymap, renderer, config))

    return (
      <TestTuiContexts directory={tmp.path} paths={{ home: tmp.path, state, worktree: tmp.path }}>
        <ExitProvider exit={() => {}}>
          <SlopcodeKeymapProvider keymap={keymap}>
            <ArgsProvider>
              <KVProvider>
                <ToastProvider>
                  <RouteProvider>
                    <TuiConfigProvider config={config}>
                      <SDKProvider url="http://test" directory={tmp.path} fetch={calls.fetch} events={events.source}>
                        <PermissionProvider>
                          <ProjectProvider>
                            <SyncProvider>
                              <ThemeProvider mode="dark">
                                <LocalProvider>
                                  <DialogProvider>
                                    <Open />
                                  </DialogProvider>
                                </LocalProvider>
                                <Toast />
                              </ThemeProvider>
                            </SyncProvider>
                          </ProjectProvider>
                        </PermissionProvider>
                      </SDKProvider>
                    </TuiConfigProvider>
                  </RouteProvider>
                </ToastProvider>
              </KVProvider>
            </ArgsProvider>
          </SlopcodeKeymapProvider>
        </ExitProvider>
      </TestTuiContexts>
    )
  }

  const app = await testRender(() => <Harness />, { width: 100, height: 30, kittyKeyboard: true })
  try {
    await shown(app, "Connected Session")
    await wait(app, () => registered("session.delete"), "session delete command")
    dispatch("session.delete")
    await shown(app, "again to confirm")
    dispatch("session.delete")
    await wait(app, () => deletes === 1, "failed session delete request")
    await shown(app, "original delete failure")

    expect(app.captureCharFrame()).toContain("Failed to delete session")
    expect(app.captureCharFrame()).not.toContain("Failed to Delete Session")
    expect(removals).toBe(0)
  } finally {
    app.renderer.destroy()
  }
})
