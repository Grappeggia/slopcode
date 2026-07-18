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
    onDone?: () => void
  },
) {
  const state = path.join(root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")
  const config = createTuiResolvedConfig()
  let replace!: () => void

  function Open() {
    const dialog = useDialog()
    replace = () => dialog.replace(() => <text>Replacement Dialog</text>)
    onMount(() =>
      dialog.replace(() => (
        <DialogSessionDeleteFailed
          session="Important Session"
          workspace="Workspace One"
          onDelete={input.onDelete}
          onRestore={input.onRestore}
          onDone={input.onDone}
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
                  <Toast />
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
  return Object.assign(app, { replace })
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
    await shown(app, "Failed to Delete Session")
    expect(deleted).toBe(0)

    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, "Delete Workspace")
    app.mockInput.pressKey("ARROW_RIGHT")
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

    app.mockInput.pressKey("ARROW_RIGHT")
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

test("restore callback rejection is visible and retryable", async () => {
  await using tmp = await tmpdir()
  let attempts = 0
  const app = await mountDialog(tmp.path, {
    onRestore: () => {
      attempts++
      if (attempts === 1) return Promise.reject(new Error("restore callback failed"))
      return false
    },
  })

  try {
    app.mockInput.pressEnter()
    await shown(app, "restore callback failed")
    expect(app.captureCharFrame()).toContain("Failed to Delete Session")

    app.mockInput.pressEnter()
    await wait(app, () => attempts === 2, "restore callback retry")
  } finally {
    app.renderer.destroy()
  }
})

test("a recovery callback resolved after Escape cannot mutate the replacement dialog", async () => {
  await using tmp = await tmpdir()
  let started = 0
  let done = 0
  let finish!: (result: boolean) => void
  const pending = new Promise<boolean>((resolve) => (finish = resolve))
  const app = await mountDialog(tmp.path, {
    onRestore: () => {
      started++
      return pending
    },
    onDone: () => {
      done++
    },
  })

  try {
    app.mockInput.pressEnter()
    await wait(app, () => started === 1, "pending restore callback")
    app.mockInput.pressEscape()
    await app.renderOnce()
    app.replace()
    await shown(app, "Replacement Dialog")

    finish(true)
    await Bun.sleep(0)
    await app.renderOnce()

    expect(done).toBe(0)
    expect(app.captureCharFrame()).toContain("Replacement Dialog")
  } finally {
    finish(false)
    app.renderer.destroy()
  }
})

test("buffered Enter cannot dismiss or accept workspace deletion before its warning renders", async () => {
  await using tmp = await tmpdir()
  let deleted = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      deleted++
      return false
    },
  })
  let paused = false

  try {
    app.mockInput.pressKey("ARROW_LEFT")
    app.renderer.pause()
    paused = true
    const frame = app.renderer.frameId
    app.mockInput.pressEnter()
    app.mockInput.pressEnter()
    expect(app.renderer.frameId).toBe(frame)
    expect(deleted).toBe(0)

    app.renderer.resume()
    paused = false
    await shown(app, "Delete Workspace")
    expect(deleted).toBe(0)

    await click(app, "Cancel")
    await shown(app, "Failed to Delete Session")
    expect(deleted).toBe(0)
  } finally {
    if (paused) app.renderer.resume()
    app.renderer.destroy()
  }
})

test("delete callback rejection restores usable recovery", async () => {
  await using tmp = await tmpdir()
  let attempts = 0
  const app = await mountDialog(tmp.path, {
    onDelete: () => {
      attempts++
      if (attempts === 1) return Promise.reject(new Error("delete callback failed"))
      return false
    },
  })

  try {
    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, "Delete Workspace")
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressEnter()
    await shown(app, "delete callback failed")
    await shown(app, "Failed to Delete Session")

    app.mockInput.pressKey("ARROW_LEFT")
    app.mockInput.pressEnter()
    await shown(app, "Delete Workspace")
    app.mockInput.pressKey("ARROW_RIGHT")
    app.mockInput.pressEnter()
    await wait(app, () => attempts === 2, "delete callback retry")
  } finally {
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

type WorkspaceStatus = "connected" | "connecting" | "disconnected" | "error"

async function mountList(
  root: string,
  input: {
    status?: WorkspaceStatus
    remove?: () => Response | Promise<Response>
  },
) {
  const state = path.join(root, "state")
  await mkdir(state, { recursive: true })
  await Bun.write(path.join(state, "kv.json"), "{}")
  const config = createTuiResolvedConfig()
  const events = createEventSource()
  let deletes = 0
  let removals = 0
  let statuses = 0
  let sessions = 0
  let dispatch!: (command: string) => void
  let registered!: (command: string) => boolean
  let current!: () => WorkspaceStatus | undefined
  const calls = createFetch(async (url, request) => {
    if (url.pathname === "/config/providers") return json({ providers: [], default: {} })
    if (url.pathname === "/project/current") return json({ id: "proj_test", worktree: root, vcs: "git" })
    if (url.pathname === "/project/proj_test/directories") return json([{ directory: root }])
    if (url.pathname === "/experimental/workspace") {
      return json([
        {
          id: "wrk_connected",
          type: "worktree",
          name: "Workspace One",
          directory: root,
          projectID: "proj_test",
          timeUsed: 1,
        },
      ])
    }
    if (url.pathname === "/experimental/workspace/wrk_connected" && request?.method === "DELETE") {
      removals++
      return json(true)
    }
    if (url.pathname === "/experimental/workspace/status") {
      statuses++
      return json(input.status ? [{ workspaceID: "wrk_connected", status: input.status }] : [])
    }
    if (url.pathname === "/session" && request?.method === "GET") {
      sessions++
      return json([info(root)])
    }
    if (url.pathname === "/session/ses_connected" && request?.method === "DELETE") {
      deletes++
      return (
        input.remove?.() ??
        json({ name: "SessionDeleteError", data: { message: "original delete failure" } }, { status: 500 })
      )
    }
    return undefined
  })

  function Open() {
    const project = useProject()
    const sync = useSync()
    current = () => project.workspace.status("wrk_connected")
    return (
      <Show when={sync.session.get("ses_connected")}>
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
      <TestTuiContexts directory={root} paths={{ home: root, state, worktree: root }}>
        <ExitProvider exit={() => {}}>
          <SlopcodeKeymapProvider keymap={keymap}>
            <ArgsProvider>
              <KVProvider>
                <ToastProvider>
                  <RouteProvider>
                    <TuiConfigProvider config={config}>
                      <SDKProvider url="http://test" directory={root} fetch={calls.fetch} events={events.source}>
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
  await shown(app, "Connected Session")
  await wait(app, () => registered("session.delete"), "session delete command")
  await wait(app, () => statuses > 0 && current() === input.status, "initial workspace status")
  return {
    app,
    deletes: () => deletes,
    removals: () => removals,
    sessions: () => sessions,
    async attempt() {
      dispatch("session.delete")
      await shown(app, "again to confirm")
      dispatch("session.delete")
      await wait(app, () => deletes === 1, "failed session delete request")
    },
    async status(status: WorkspaceStatus) {
      events.emit({
        directory: root,
        workspace: "wrk_connected",
        project: "proj_test",
        payload: {
          id: `evt_${status}`,
          type: "workspace.status",
          properties: { workspaceID: "wrk_connected", status },
        },
      })
      await wait(app, () => current() === status, `${status} workspace status`)
    },
  }
}

test("known unavailable workspace preserves session-delete recovery", async () => {
  await using tmp = await tmpdir()
  const list = await mountList(tmp.path, { status: "disconnected" })

  try {
    await list.attempt()
    await shown(list.app, "Failed to Delete Session")
    expect(list.app.captureCharFrame()).toContain("Workspace One")
  } finally {
    list.app.renderer.destroy()
  }
})

test("connected workspace session-delete failures surface the original error", async () => {
  await using tmp = await tmpdir()
  const list = await mountList(tmp.path, { status: "connected" })

  try {
    await list.attempt()
    await shown(list.app, "original delete failure")

    expect(list.app.captureCharFrame()).toContain("Failed to delete session")
    expect(list.app.captureCharFrame()).not.toContain("Failed to Delete Session")
    expect(list.removals()).toBe(0)
  } finally {
    list.app.renderer.destroy()
  }
})

test("missing and connecting workspace statuses fail closed", async () => {
  for (const status of [undefined, "connecting"] as const) {
    await using tmp = await tmpdir()
    const list = await mountList(tmp.path, { status })

    try {
      await list.attempt()
      await shown(list.app, "original delete failure")
      expect(list.app.captureCharFrame()).not.toContain("Failed to Delete Session")
      expect(list.removals()).toBe(0)
    } finally {
      list.app.renderer.destroy()
    }
  }
})

test("failure handling re-reads a workspace that reconnects during deletion", async () => {
  await using tmp = await tmpdir()
  let release!: (response: Response) => void
  const response = new Promise<Response>((resolve) => (release = resolve))
  const list = await mountList(tmp.path, { status: "disconnected", remove: () => response })

  try {
    await list.attempt()
    await list.status("connected")
    release(json({ name: "SessionDeleteError", data: { message: "reconnected delete failure" } }, { status: 500 }))
    await shown(list.app, "reconnected delete failure")

    expect(list.app.captureCharFrame()).not.toContain("Failed to Delete Session")
    expect(list.removals()).toBe(0)
  } finally {
    release(json({ name: "SessionDeleteError", data: { message: "cleanup" } }, { status: 500 }))
    list.app.renderer.destroy()
  }
})

test("successful deletion refreshes sessions for every known non-connected workspace state", async () => {
  for (const status of ["connecting", "disconnected", "error"] as const) {
    await using tmp = await tmpdir()
    const list = await mountList(tmp.path, { status, remove: () => json(true) })
    const before = list.sessions()

    try {
      await list.attempt()
      await wait(list.app, () => list.sessions() > before, `${status} successful deletion refresh`)
    } finally {
      list.app.renderer.destroy()
    }
  }
})
